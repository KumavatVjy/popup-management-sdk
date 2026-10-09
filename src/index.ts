import {
  PopupManagerConfig,
  NormalizedPopupManagerConfig,
  ConfigurationError,
  parseConfig,
} from './config';

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
 * Stores normalized configuration and initialization state.
 */
interface InternalState {
  config: NormalizedPopupManagerConfig | null;
  isInitialized: boolean;
}

const state: InternalState = {
  config: null,
  isInitialized: false,
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
   * Repeated calls safely replace the active configuration.
   *
   * @param config The public PopupManagerConfig options.
   * @throws ConfigurationError if any required option is missing or invalid.
   */
  init(config: PopupManagerConfig): void {
    const normalized = parseConfig(config);
    state.config = normalized;
    state.isInitialized = true;

    // Attach internal state non-enumerably to prevent dead-code tree-shaking
    // and keep the public API clean without adding getters.
    Object.defineProperty(PopupManager, '_state', {
      value: state,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  },
};

/**
 * Direct function export of init for root namespace convenience.
 */
export const init = (config: PopupManagerConfig): void => PopupManager.init(config);

export { PopupManagerConfig, ConfigurationError };
export default PopupManager;
