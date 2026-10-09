import {
  PopupManagerConfig,
  NormalizedPopupManagerConfig,
  ConfigurationError,
  parseConfig,
} from './config';
import { PublicPopup, PopupPosition, PublicPopupsResponse } from './client/types';
import { ApiClient, ApiClientError } from './client/api-client';

/**
 * Current version of the Popup Manager SDK.
 */
export const SDK_VERSION = '0.1.0';

/**
 * Alias for SDK_VERSION matching common version property conventions.
 */
export const version = SDK_VERSION;

/**
 * Internal SDK state container.
 * Stores normalized configuration, initialization state, and active API client.
 */
interface InternalState {
  config: NormalizedPopupManagerConfig | null;
  isInitialized: boolean;
  client: ApiClient | null;
}

const state: InternalState = {
  config: null,
  isInitialized: false,
  client: null,
};

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
   *
   * @param config The public PopupManagerConfig options.
   * @throws ConfigurationError if any required option is missing or invalid.
   */
  init(config: PopupManagerConfig): void {
    const normalized = parseConfig(config);
    state.config = normalized;
    state.isInitialized = true;
    state.client = new ApiClient({
      websiteKey: normalized.websiteKey,
      apiBaseUrl: normalized.apiBaseUrl,
      debug: normalized.debug,
    });

    // Attach internal state non-enumerably to prevent dead-code tree-shaking
    // while keeping the public API clean.
    Object.defineProperty(PopupManager, '_state', {
      value: state,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  },

  /**
   * Retrieves active, eligible popups for the configured website from the backend delivery API.
   *
   * Requires successful initialization via PopupManager.init(config).
   * Does not create DOM elements or render anything on screen.
   *
   * @returns A promise resolving to an array of validated PublicPopup objects.
   * @throws ConfigurationError if called prior to initialization.
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  async load(): Promise<PublicPopup[]> {
    if (!state.isInitialized || !state.config || !state.client) {
      throw new ConfigurationError('PopupManager must be initialized before calling load()');
    }
    return state.client.fetchPopups();
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

export {
  PopupManagerConfig,
  NormalizedPopupManagerConfig,
  ConfigurationError,
  PublicPopup,
  PopupPosition,
  PublicPopupsResponse,
  ApiClient,
  ApiClientError,
};
export default PopupManager;
