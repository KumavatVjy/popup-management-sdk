import { NormalizedPopupManagerConfig, ConfigurationError } from '../config';
import { PublicPopup } from '../client/types';
import { ApiClient } from '../client/api-client';
import { RuntimeState } from './state';
import { filterEligiblePopups } from './eligibility';
import { PopupRenderer } from '../renderer/shadow-dom';

/**
 * RuntimeManager orchestrates SDK lifecycle states, active network transport,
 * client-side schedule revalidation, rendering display, and teardown.
 */
export class RuntimeManager {
  private state: RuntimeState = 'UNINITIALIZED';
  private config: NormalizedPopupManagerConfig | null = null;
  private client: ApiClient | null = null;
  private popups: PublicPopup[] = [];
  private generationId: number = 0;
  private renderer: PopupRenderer = new PopupRenderer();

  /**
   * Returns the current lifecycle state of the SDK runtime.
   */
  public getState(): RuntimeState {
    return this.state;
  }

  /**
   * Returns a copy of the last successfully loaded and schedule-eligible popups.
   */
  public getPopups(): readonly PublicPopup[] {
    return [...this.popups];
  }

  /**
   * Returns true if a popup is currently mounted and visible on screen.
   */
  public isVisible(): boolean {
    return this.renderer.isVisible();
  }

  /**
   * Initializes or replaces the active runtime session with normalized configuration
   * and an initialized API client.
   *
   * Resets any existing rendered popup and increments the generation ID to prevent prior
   * pending requests from updating state. If autoLoad is enabled, initiates background loading.
   *
   * @param config The normalized configuration object.
   * @param client The configured ApiClient instance.
   */
  public init(config: NormalizedPopupManagerConfig, client: ApiClient): void {
    // Tear down any existing rendered popup and listeners
    this.renderer.destroy();

    // Invalidate any in-flight requests from prior initialization
    this.generationId++;

    this.config = config;
    this.client = client;
    this.popups = [];
    this.state = 'CONFIGURED';

    if (config.autoLoad) {
      // Trigger background load asynchronously; catch internally to prevent unhandled rejections
      this.load().catch((err: unknown) => {
        if (this.config?.debug) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.debug(`[PopupManager] Background auto-load failed: ${message}`);
        }
      });
    }
  }

  /**
   * Loads eligible popups from the backend delivery API and revalidates their schedule.
   * If autoShow is enabled and a DOM environment exists, automatically displays the first eligible popup.
   *
   * @returns A promise resolving to an array of validated, schedule-eligible PublicPopup objects.
   * @throws ConfigurationError if called before init() or after destroy().
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  public async load(): Promise<PublicPopup[]> {
    if (this.state === 'DESTROYED') {
      throw new ConfigurationError('PopupManager has been destroyed. Call init() before calling load()');
    }

    if (this.state === 'UNINITIALIZED' || !this.config || !this.client) {
      throw new ConfigurationError('PopupManager must be initialized before calling load()');
    }

    const currentGeneration = ++this.generationId;
    this.state = 'LOADING';

    let rawPopups: PublicPopup[];
    try {
      rawPopups = await this.client.fetchPopups();
    } catch (error) {
      // Only update state if this request is still the active generation and not destroyed
      if (this.generationId === currentGeneration && (this.state as RuntimeState) !== 'DESTROYED') {
        this.state = 'ERROR';
        this.popups = [];
        this.renderer.hide();
      }
      throw error;
    }

    const eligible = filterEligiblePopups(rawPopups);

    // Only update state if this request is still the active generation and not destroyed
    if (this.generationId === currentGeneration && (this.state as RuntimeState) !== 'DESTROYED') {
      this.popups = eligible;
      this.state = eligible.length > 0 ? 'READY' : 'IDLE';

      // If autoShow is configured and eligible popups exist, display the first popup
      if (this.config.autoShow) {
        if (eligible.length > 0) {
          if (typeof document !== 'undefined') {
            try {
              this.show();
            } catch {
              // Gracefully handle render failures during autoShow
            }
          }
        } else {
          this.renderer.hide();
        }
      }
    }

    return eligible;
  }

  /**
   * Refreshes eligible popup data by performing a fresh network request and schedule revalidation.
   * Updates or removes any active popup display to reflect fresh server data.
   *
   * @returns A promise resolving to an array of validated, schedule-eligible PublicPopup objects.
   */
  public async refresh(): Promise<PublicPopup[]> {
    return this.load();
  }

  /**
   * Displays an eligible popup on screen inside the Shadow DOM host.
   *
   * - If popupId is omitted, displays the first eligible popup in the backend ordering.
   * - If popupId is supplied, displays that popup only if it is in the loaded eligible list.
   * - Fails predictably without creating an empty host if no eligible popup is available.
   *
   * @param popupId Optional ID of the specific eligible popup to render.
   * @throws ConfigurationError if called prior to initialization or after destruction.
   * @throws Error if called outside a DOM environment or if the requested popup is unavailable.
   */
  public show(popupId?: number): void {
    if (this.state === 'DESTROYED') {
      throw new ConfigurationError('PopupManager has been destroyed. Call init() before calling show()');
    }

    if (this.state === 'UNINITIALIZED' || !this.config) {
      throw new ConfigurationError('PopupManager must be initialized before calling show()');
    }

    if (typeof document === 'undefined') {
      throw new Error('DOM environment is required to render popups');
    }

    if (this.popups.length === 0) {
      throw new Error('No eligible popups available to display');
    }

    let target: PublicPopup;
    if (popupId !== undefined) {
      const found = this.popups.find((p) => p.id === popupId);
      if (!found) {
        throw new Error(`Popup with ID ${popupId} is not available or ineligible`);
      }
      target = found;
    } else {
      target = this.popups[0]!;
    }

    this.renderer.render(target);
  }

  /**
   * Hides the currently rendered popup and removes its backdrop and event listeners.
   */
  public hide(): void {
    this.renderer.hide();
  }

  /**
   * Cleans up the runtime session, releases resources, and removes the Shadow DOM host.
   */
  public destroy(): void {
    this.generationId++;
    this.state = 'DESTROYED';
    this.renderer.destroy();
    this.popups = [];
    this.config = null;
    this.client = null;
  }
}
