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
import { sanitizeHtml } from './renderer/sanitize';
import { PopupRenderer, HOST_ELEMENT_ID, RenderCallbacks } from './renderer/shadow-dom';
import {
  EventEmitter,
  SDKEvent,
  EventCallback,
  PopupLoadedPayload,
  PopupShownPayload,
  PopupHiddenPayload,
  PopupClosedPayload,
  PopupErrorPayload,
  PopupDismissalReason,
  PopupErrorContext,
  SDKEventPayloadMap,
} from './events/event-emitter';

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
   * @returns A promise resolving to an array of validated, eligible PublicPopup objects.
   * @throws ConfigurationError if called prior to initialization or after destroy().
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  async load(): Promise<PublicPopup[]> {
    return runtimeManager.load();
  },

  /**
   * Refreshes eligible popup data by performing a fresh network request and schedule revalidation.
   * Updates or removes any active popup display to reflect fresh server data.
   *
   * @returns A promise resolving to an array of validated, eligible PublicPopup objects.
   * @throws ConfigurationError if called prior to initialization or after destroy().
   * @throws ApiClientError if network transport fails or response data is invalid.
   */
  async refresh(): Promise<PublicPopup[]> {
    return runtimeManager.refresh();
  },

  /**
   * Renders and displays an eligible popup on screen inside an isolated Shadow DOM container.
   *
   * - If popupId is omitted, displays the first eligible popup in the backend ordering.
   * - If popupId is supplied, displays that popup only if it is in the loaded eligible list.
   *
   * @param popupId Optional ID of the specific eligible popup to render.
   * @throws ConfigurationError if called prior to initialization or after destruction.
   * @throws Error if called outside a DOM environment or if the requested popup is unavailable.
   */
  show(popupId?: number): void {
    runtimeManager.show(popupId);
  },

  /**
   * Hides the currently active popup and removes its backdrop and keyboard listeners.
   */
  hide(): void {
    runtimeManager.hide();
  },

  /**
   * Cleans up the runtime session, removes the Shadow DOM host, and releases all resources.
   * Subsequent calls to load(), refresh(), or show() will reject until init() is called again.
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

  /**
   * Registers a subscriber callback for an SDK lifecycle event.
   *
   * Supported events:
   * - 'popup:loaded': Fired when eligible popups are retrieved ({ count })
   * - 'popup:shown': Fired when a popup is mounted and visible ({ popupId })
   * - 'popup:hidden': Fired when a popup is hidden from view ({ popupId })
   * - 'popup:closed': Fired when user explicitly dismisses a popup ({ popupId, reason })
   * - 'popup:error': Fired on configuration, network, or rendering failure ({ error, context })
   */
  on<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    runtimeManager.on(event, callback);
  },

  /**
   * Unregisters a previously registered subscriber callback.
   */
  off<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    runtimeManager.off(event, callback);
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
 * Direct function export of show for root namespace convenience.
 */
export const show = (popupId?: number): void => PopupManager.show(popupId);

/**
 * Direct function export of hide for root namespace convenience.
 */
export const hide = (): void => PopupManager.hide();

/**
 * Direct function export of destroy for root namespace convenience.
 */
export const destroy = (): void => PopupManager.destroy();

/**
 * Direct function export of getState for root namespace convenience.
 */
export const getState = (): RuntimeState => PopupManager.getState();

/**
 * Direct function export of on for root namespace convenience.
 */
export const on = <E extends SDKEvent>(event: E, callback: EventCallback<E>): void =>
  PopupManager.on(event, callback);

/**
 * Direct function export of off for root namespace convenience.
 */
export const off = <E extends SDKEvent>(event: E, callback: EventCallback<E>): void =>
  PopupManager.off(event, callback);

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
  sanitizeHtml,
  PopupRenderer,
  HOST_ELEMENT_ID,
  RenderCallbacks,
  EventEmitter,
  SDKEvent,
  EventCallback,
  PopupLoadedPayload,
  PopupShownPayload,
  PopupHiddenPayload,
  PopupClosedPayload,
  PopupErrorPayload,
  PopupDismissalReason,
  PopupErrorContext,
  SDKEventPayloadMap,
};
export default PopupManager;
