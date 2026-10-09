import { NormalizedPopupManagerConfig, ConfigurationError } from '../config';
import { PublicPopup } from '../client/types';
import { ApiClient } from '../client/api-client';
import { RuntimeState } from './state';
import { filterEligiblePopups } from './eligibility';

/**
 * RuntimeManager orchestrates SDK lifecycle states, active network transport,
 * client-side schedule revalidation, and teardown.
 */
export class RuntimeManager {
  private state: RuntimeState = 'UNINITIALIZED';
  private config: NormalizedPopupManagerConfig | null = null;
  private client: ApiClient | null = null;
  private popups: PublicPopup[] = [];
  private generationId: number = 0;

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
   * Initializes or replaces the active runtime session with normalized configuration
   * and an initialized API client.
   *
   * Increments the generation ID to prevent any prior pending requests from updating
   * runtime state. If autoLoad is enabled, initiates background loading asynchronously
   * with safe internal error handling.
   *
   * @param config The normalized configuration object.
   * @param client The configured ApiClient instance.
   */
  public init(config: NormalizedPopupManagerConfig, client: ApiClient): void {
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
   *
   * Lifecycle transitions:
   * - Transitions to LOADING while the request is in flight.
   * - Transitions to READY if at least one eligible popup is found.
   * - Transitions to IDLE if no eligible popups are found.
   * - Transitions to ERROR if network transport or validation fails.
   *
   * On failure, previously retained popup data is cleared to prevent stale data display.
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
      }
      throw error;
    }

    const eligible = filterEligiblePopups(rawPopups);

    // Only update state if this request is still the active generation and not destroyed
    if (this.generationId === currentGeneration && (this.state as RuntimeState) !== 'DESTROYED') {
      this.popups = eligible;
      this.state = eligible.length > 0 ? 'READY' : 'IDLE';
    }

    return eligible;
  }

  /**
   * Refreshes eligible popup data by performing a fresh network request and schedule revalidation.
   *
   * Delegates directly to load(), ensuring fresh network transport, client-side schedule
   * re-evaluation against the current timestamp, and runtime state updates.
   *
   * @returns A promise resolving to an array of validated, schedule-eligible PublicPopup objects.
   */
  public async refresh(): Promise<PublicPopup[]> {
    return this.load();
  }

  /**
   * Cleans up the runtime session and releases resources.
   *
   * Transitions state to DESTROYED, invalidates in-flight requests, and clears retained
   * popup data and client references. Subsequent calls to load() or refresh() will reject
   * until init() is called again.
   */
  public destroy(): void {
    this.generationId++;
    this.state = 'DESTROYED';
    this.popups = [];
    this.config = null;
    this.client = null;
  }
}
