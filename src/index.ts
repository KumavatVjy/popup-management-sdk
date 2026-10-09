import {
  PopupManagerConfig,
  NormalizedPopupManagerConfig,
  ConfigurationError,
  parseConfig,
} from './config';
import { PublicPopup, PopupPosition, PublicPopupsResponse } from './client/types';
import { ApiClient, ApiClientError } from './client/api-client';
import { RuntimeState, RuntimeStates } from './runtime/state';
import { filterEligiblePopups } from './runtime/eligibility';
import { RuntimeManager } from './runtime/manager';

/**
 * Current version of the Popup Manager SDK.
 */
export const SDK_VERSION = '0.1.0';

/**
 * Alias for SDK_VERSION matching common version property conventions.
 */
export const version = SDK_VERSION;

/**
 * Internal singleton RuntimeManager coordinating lifecycle state, transport, and eligibility.
 */
const runtimeManager = new RuntimeManager();

/**
 * Public PopupManager SDK entry point.
 */
export const PopupManager = {
  version: SDK_VERSION,

  /**
   * Initializes the PopupManager SDK with the specified configuration.
   *
   * Validates and normalizes the provided options, storing them internally.
   * Repeated calls safely replace the active configuration and API transport.
   * If autoLoad is enabled (default), starts background popup retrieval asynchronously.
   *
   * @param config The public PopupManagerConfig options.
   * @throws ConfigurationError if any required option is missing or invalid.
   */
  init(config: PopupManagerConfig): void {
    const normalized = parseConfig(config);
    const client = new ApiClient({
      websiteKey: normalized.websiteKey,
      apiBaseUrl: normalized.apiBaseUrl,
      debug: normalized.debug,
    });

    runtimeManager.init(normalized, client);

    // Attach runtime non-enumerably to prevent dead-code tree-shaking
    // while keeping the public API object clean.
    Object.defineProperty(PopupManager, '_runtime', {
      value: runtimeManager,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  },

  /**
   * Retrieves active, eligible popups for the configured website from the backend delivery API,
   * revalidating their schedule on the client.
   *
   * Requires successful initialization via PopupManager.init(config).
   * Does not create DOM elements or render anything on screen.
   *
   * @returns A promise resolving to an array of validated, eligible PublicPopup objects.
   * @throws ConfigurationError if called prior to initialization or after destroy().
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  async load(): Promise<PublicPopup[]> {
    return runtimeManager.load();
  },

  /**
   * Refreshes eligible popup data by performing a fresh network request and schedule revalidation.
   *
   * Replaces retained popup data and updates runtime lifecycle state.
   * Does not create DOM elements or display anything on screen.
   *
   * @returns A promise resolving to an array of validated, eligible PublicPopup objects.
   * @throws ConfigurationError if called prior to initialization or after destroy().
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  async refresh(): Promise<PublicPopup[]> {
    return runtimeManager.refresh();
  },

  /**
   * Cleans up the runtime session and releases resources.
   *
   * Transitions state to DESTROYED and clears retained popup data.
   * Subsequent calls to load() or refresh() will reject until init() is called again.
   */
  destroy(): void {
    runtimeManager.destroy();
  },

  /**
   * Returns the current lifecycle state of the SDK runtime.
   */
  getState(): RuntimeState {
    return runtimeManager.getState();
  },
};

/**
 * Direct function export of init for root namespace convenience.
 */
export const init = (config: PopupManagerConfig): void => PopupManager.init(config);

/**
 * Direct function export of load for root namespace convenience.
 */
export const load = (): Promise<PublicPopup[]> => PopupManager.load();

/**
 * Direct function export of refresh for root namespace convenience.
 */
export const refresh = (): Promise<PublicPopup[]> => PopupManager.refresh();

/**
 * Direct function export of destroy for root namespace convenience.
 */
export const destroy = (): void => PopupManager.destroy();

/**
 * Direct function export of getState for root namespace convenience.
 */
export const getState = (): RuntimeState => PopupManager.getState();

export {
  PopupManagerConfig,
  NormalizedPopupManagerConfig,
  ConfigurationError,
  PublicPopup,
  PopupPosition,
  PublicPopupsResponse,
  ApiClient,
  ApiClientError,
  RuntimeState,
  RuntimeStates,
  filterEligiblePopups,
  RuntimeManager,
};
export default PopupManager;
