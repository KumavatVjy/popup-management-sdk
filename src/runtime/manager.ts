import { NormalizedPopupManagerConfig, ConfigurationError } from '../config';
import { PublicPopup } from '../client/types';
import { ApiClient } from '../client/api-client';
import { RuntimeState } from './state';
import { filterEligiblePopups } from './eligibility';
import { PopupRenderer } from '../renderer/shadow-dom';
import { EventEmitter, SDKEvent, EventCallback, PopupDismissalReason } from '../events/event-emitter';

/**
 * RuntimeManager orchestrates SDK lifecycle states, active network transport,
 * client-side schedule revalidation, rendering display, teardown, and event emissions.
 */
export class RuntimeManager {
  private state: RuntimeState = 'UNINITIALIZED';
  private config: NormalizedPopupManagerConfig | null = null;
  private client: ApiClient | null = null;
  private popups: PublicPopup[] = [];
  private generationId: number = 0;
  private renderer: PopupRenderer = new PopupRenderer();
  private events: EventEmitter = new EventEmitter();

  /**
   * Registers a subscriber callback for an SDK lifecycle event.
   */
  public on<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    this.events.on(event, callback);
  }

  /**
   * Removes a subscriber callback for an SDK lifecycle event.
   */
  public off<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    this.events.off(event, callback);
  }

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
      const err = new ConfigurationError('PopupManager has been destroyed. Call init() before calling load()');
      this.events.emit('popup:error', { error: err.message, context: 'runtime' });
      throw err;
    }

    if (this.state === 'UNINITIALIZED' || !this.config || !this.client) {
      const err = new ConfigurationError('PopupManager must be initialized before calling load()');
      this.events.emit('popup:error', { error: err.message, context: 'configuration' });
      throw err;
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

        const message = error instanceof Error ? error.message : 'Failed to fetch popups';
        this.events.emit('popup:error', { error: message, context: 'network' });
      }
      throw error;
    }

    const eligible = filterEligiblePopups(rawPopups);

    // Only update state if this request is still the active generation and not destroyed
    if (this.generationId === currentGeneration && (this.state as RuntimeState) !== 'DESTROYED') {
      this.popups = eligible;
      this.state = eligible.length > 0 ? 'READY' : 'IDLE';

      // Emit popup:loaded event with eligible count
      this.events.emit('popup:loaded', { count: eligible.length });

      // If autoShow is configured and eligible popups exist, display the first popup
      if (this.config.autoShow) {
        if (eligible.length > 0) {
          if (typeof document !== 'undefined') {
            try {
              this.show();
            } catch (err) {
              // Gracefully handle render failures during autoShow
              const message = err instanceof Error ? err.message : 'Failed to auto-show popup';
              this.events.emit('popup:error', { error: message, context: 'rendering' });
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
      const err = new ConfigurationError('PopupManager has been destroyed. Call init() before calling show()');
      this.events.emit('popup:error', { error: err.message, context: 'runtime' });
      throw err;
    }

    if (this.state === 'UNINITIALIZED' || !this.config) {
      const err = new ConfigurationError('PopupManager must be initialized before calling show()');
      this.events.emit('popup:error', { error: err.message, context: 'configuration' });
      throw err;
    }

    if (typeof document === 'undefined') {
      const err = new Error('DOM environment is required to render popups');
      this.events.emit('popup:error', { error: err.message, context: 'rendering' });
      throw err;
    }

    if (this.popups.length === 0) {
      const err = new Error('No eligible popups available to display');
      this.events.emit('popup:error', { error: err.message, context: 'eligibility' });
      throw err;
    }

    let target: PublicPopup;
    if (popupId !== undefined) {
      const found = this.popups.find((p) => p.id === popupId);
      if (!found) {
        const err = new Error(`Popup with ID ${popupId} is not available or ineligible`);
        this.events.emit('popup:error', { error: err.message, context: 'eligibility' });
        throw err;
      }
      target = found;
    } else {
      target = this.popups[0]!;
    }

    const targetId = target.id;

    try {
      this.renderer.render(target, {
        onClose: (reason: PopupDismissalReason) => {
          // 1. User dismissal: emit popup:closed first with the reason
          this.events.emit('popup:closed', { popupId: targetId, reason });
        },
        onHide: () => {
          // 2. Then emit popup:hidden
          this.events.emit('popup:hidden', { popupId: targetId });
        },
      });

      // Emit popup:shown once successfully mounted
      this.events.emit('popup:shown', { popupId: targetId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to render popup';
      this.events.emit('popup:error', { error: message, context: 'rendering' });
      throw err;
    }
  }

  /**
   * Hides the currently rendered popup and removes its backdrop and event listeners.
   */
  public hide(): void {
    const visiblePopup = this.renderer.getVisiblePopup();
    if (visiblePopup) {
      // Programmatic hide: renderer will invoke onHide -> emits popup:hidden (no popup:closed)
      this.renderer.hide();
    }
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
    // Release registered event callbacks
    this.events.clear();
  }
}
