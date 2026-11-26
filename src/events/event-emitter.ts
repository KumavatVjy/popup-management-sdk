/**
 * Event names supported by the Popup Manager SDK.
 */
export type SDKEvent =
  | 'popup:loaded'
  | 'popup:shown'
  | 'popup:hidden'
  | 'popup:closed'
  | 'popup:error'
  | 'popup:submitted'
  | 'popup:spin';

/**
 * Payload emitted when eligible popups are successfully loaded and validated.
 */
export interface PopupLoadedPayload {
  count: number;
}

/**
 * Payload emitted when a popup is mounted and displayed in the DOM.
 */
export interface PopupShownPayload {
  popupId: number;
}

/**
 * Payload emitted when a popup is hidden from display.
 */
export interface PopupHiddenPayload {
  popupId: number;
}

/**
 * Reason for user dismissal of a popup.
 */
export type PopupDismissalReason = 'close-button' | 'backdrop' | 'escape';

/**
 * Payload emitted when a popup is explicitly dismissed by user interaction.
 */
export interface PopupClosedPayload {
  popupId: number;
  reason: PopupDismissalReason;
}

/**
 * Context or category where an SDK error occurred.
 */
export type PopupErrorContext =
  | 'configuration'
  | 'network'
  | 'transport'
  | 'eligibility'
  | 'rendering'
  | 'runtime';

/**
 * Payload emitted when an SDK error occurs.
 * Contains sanitized diagnostic info; never sensitive credentials or keys.
 */
export interface PopupErrorPayload {
  error: string;
  context: PopupErrorContext;
}

/**
 * Payload emitted when a visitor submits a form or lead capture inside a popup.
 */
export interface PopupSubmittedPayload {
  popupId: number;
  email?: string;
  name?: string;
  spinResult?: string;
  couponCode?: string;
  formData?: Record<string, any>;
}

/**
 * Payload emitted when a visitor spins a fortune wheel or lucky draw inside a popup.
 */
export interface PopupSpinPayload {
  popupId: number;
  spinResult: string;
  couponCode?: string;
}

/**
 * Map connecting each SDKEvent to its respective strongly typed payload.
 */
export interface SDKEventPayloadMap {
  'popup:loaded': PopupLoadedPayload;
  'popup:shown': PopupShownPayload;
  'popup:hidden': PopupHiddenPayload;
  'popup:closed': PopupClosedPayload;
  'popup:error': PopupErrorPayload;
  'popup:submitted': PopupSubmittedPayload;
  'popup:spin': PopupSpinPayload;
}

/**
 * Generic callback handler type for an SDK event.
 */
export type EventCallback<E extends SDKEvent = SDKEvent> = (payload: SDKEventPayloadMap[E]) => void;

/**
 * Lightweight, zero-dependency, type-safe event emitter for SDK lifecycle events.
 *
 * Guarantees:
 * - One throwing subscriber does not prevent subsequent subscribers from firing.
 * - Re-registering the same callback is deduplicated.
 * - Errors within event subscribers never bubble into or disrupt core SDK flows.
 */
export class EventEmitter {
  private listeners: Map<SDKEvent, Set<EventCallback<any>>> = new Map();

  /**
   * Registers an event callback subscriber for the given event name.
   *
   * @param event The SDKEvent name to listen for.
   * @param callback The handler function to invoke when the event is emitted.
   */
  public on<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    if (!event || typeof callback !== 'function') {
      return;
    }

    let eventSet = this.listeners.get(event);
    if (!eventSet) {
      eventSet = new Set();
      this.listeners.set(event, eventSet);
    }

    eventSet.add(callback);
  }

  /**
   * Unregisters an event callback subscriber for the given event name.
   *
   * @param event The SDKEvent name.
   * @param callback The handler function to remove.
   */
  public off<E extends SDKEvent>(event: E, callback: EventCallback<E>): void {
    if (!event || typeof callback !== 'function') {
      return;
    }

    const eventSet = this.listeners.get(event);
    if (eventSet) {
      eventSet.delete(callback);
      if (eventSet.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emits an event with the associated payload to all registered subscribers.
   *
   * Safe against throwing subscribers and modifying the subscriber set during execution.
   *
   * @param event The SDKEvent name to emit.
   * @param payload The structured event payload.
   */
  public emit<E extends SDKEvent>(event: E, payload: SDKEventPayloadMap[E]): void {
    const eventSet = this.listeners.get(event);
    if (!eventSet || eventSet.size === 0) {
      return;
    }

    // Clone into an array to avoid mutation during iteration
    const subscribers = Array.from(eventSet);
    for (const subscriber of subscribers) {
      try {
        subscriber(payload);
      } catch (err) {
        // Defensive: a throwing subscriber must never disrupt the SDK lifecycle
        // or prevent other subscribers from receiving the notification.
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[PopupManager] Unhandled exception in subscriber for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Clears all registered event subscribers.
   */
  public clear(): void {
    this.listeners.clear();
  }

  /**
   * Returns the count of registered listeners for an event (useful for test assertions).
   */
  public listenerCount(event: SDKEvent): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
