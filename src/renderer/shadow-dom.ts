import { PublicPopup } from '../client/types';
import { sanitizeHtml } from './sanitize';
import { getPositionConfig } from './positions';
import { SHADOW_STYLES } from './styles';
import { PopupDismissalReason } from '../events/event-emitter';

/**
 * Standard ID assigned to the SDK's host container element in the host page DOM.
 */
export const HOST_ELEMENT_ID = 'popup-manager-host-root';

/**
 * Focusable element selectors for keyboard accessibility and trapping inside Shadow DOM.
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Callbacks accepted by the renderer during a display session.
 */
export interface RenderCallbacks {
  /**
   * Invoked when the popup is hidden/unmounted (either programmatically or via user dismissal).
   */
  onHide?: () => void;
  /**
   * Invoked when the user explicitly closes or dismisses the popup.
   */
  onClose?: (reason: PopupDismissalReason) => void;
}

/**
 * PopupRenderer manages mounting, Shadow DOM encapsulation, positioning,
 * accessible keyboard focus trapping & restoration, user interactions,
 * animations, and safe removal of popup interface elements.
 */
export class PopupRenderer {
  private host: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private currentPopup: PublicPopup | null = null;
  private onHideCallback: (() => void) | null = null;
  private onCloseCallback: ((reason: PopupDismissalReason) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private trapKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;

  /**
   * Returns true if a popup is currently mounted and visible.
   */
  public isVisible(): boolean {
    return this.currentPopup !== null;
  }

  /**
   * Returns the currently visible PublicPopup, or null if hidden.
   */
  public getVisiblePopup(): PublicPopup | null {
    return this.currentPopup;
  }

  /**
   * Ensures the host container element exists in document.body and has an open Shadow Root.
   */
  private ensureHost(): { host: HTMLElement; shadowRoot: ShadowRoot } {
    if (typeof document === 'undefined') {
      throw new Error('DOM environment is required to render popups');
    }

    let host = document.getElementById(HOST_ELEMENT_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ELEMENT_ID;
      document.body.appendChild(host);
    }

    let shadowRoot = host.shadowRoot;
    if (!shadowRoot) {
      shadowRoot = host.attachShadow({ mode: 'open' });
    }

    this.host = host;
    this.shadowRoot = shadowRoot;

    return { host, shadowRoot };
  }

  /**
   * Collects all currently focusable elements within the active popup Shadow DOM.
   */
  private getFocusableElements(): HTMLElement[] {
    if (!this.shadowRoot) {
      return [];
    }

    const elements = Array.from(
      this.shadowRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );

    // Filter out hidden or non-visible elements
    return elements.filter((el) => {
      return (
        el.offsetWidth > 0 ||
        el.offsetHeight > 0 ||
        el.getClientRects().length > 0 ||
        // Support JSDOM where dimensions are often 0 by default
        el.getAttribute('aria-hidden') !== 'true'
      );
    });
  }

  /**
   * Restores focus to the element that held focus before the modal was opened,
   * if that element still exists and can safely receive focus.
   */
  private restoreFocus(): void {
    const target = this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;

    if (!target) {
      return;
    }

    try {
      if (
        typeof document !== 'undefined' &&
        document.contains(target) &&
        typeof target.focus === 'function'
      ) {
        target.focus();
      }
    } catch {
      // Ignore focus restoration failures silently (e.g. element detached, disabled, or blurred)
    }
  }

  /**
   * Explicitly handles user dismissal and fires the appropriate close callback before hiding.
   */
  private dismiss(reason: PopupDismissalReason): void {
    if (this.onCloseCallback) {
      const cb = this.onCloseCallback;
      this.onCloseCallback = null;
      try {
        cb(reason);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[PopupManager] Error in onClose callback:', err);
        }
      }
    }
    this.hide();
  }

  /**
   * Renders the specified eligible popup inside the Shadow DOM host.
   *
   * @param popup The PublicPopup data to render.
   * @param callbacks Optional onHide and onClose lifecycle callbacks.
   */
  public render(popup: PublicPopup, callbacks?: RenderCallbacks): void {
    if (typeof document === 'undefined') {
      throw new Error('DOM environment is required to render popups');
    }

    // Clean up any previously active popup DOM or listeners before re-rendering
    this.hide();

    this.onHideCallback = callbacks?.onHide || null;
    this.onCloseCallback = callbacks?.onClose || null;

    try {
      const sanitizedContent = sanitizeHtml(popup.content);
      const positionConfig = getPositionConfig(popup.position);

      // For modal center popups, capture currently focused element for safe restoration later
      if (positionConfig.isModal && typeof document !== 'undefined') {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && typeof active.focus === 'function') {
          this.previouslyFocusedElement = active;
        } else {
          this.previouslyFocusedElement = null;
        }
      } else {
        this.previouslyFocusedElement = null;
      }

      const { shadowRoot } = this.ensureHost();

      // Clear any prior children inside shadow root
      while (shadowRoot.firstChild) {
        shadowRoot.removeChild(shadowRoot.firstChild);
      }

      // 1. Inject Encapsulated Styles
      const styleEl = document.createElement('style');
      styleEl.textContent = SHADOW_STYLES;
      shadowRoot.appendChild(styleEl);

      // 2. Backdrop Overlay (for modal center position)
      if (positionConfig.hasBackdrop) {
        const backdrop = document.createElement('div');
        backdrop.className = 'popup-manager-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.addEventListener('click', () => this.dismiss('backdrop'));
        shadowRoot.appendChild(backdrop);
      }

      // 3. Position Wrapper
      const wrapper = document.createElement('div');
      wrapper.className = `popup-manager-wrapper ${positionConfig.wrapperClass}`;
      wrapper.setAttribute('role', positionConfig.role);

      if (positionConfig.isModal) {
        wrapper.setAttribute('aria-modal', 'true');
      }

      wrapper.setAttribute('aria-labelledby', 'popup-manager-title');

      // 4. Card Container
      const card = document.createElement('div');
      card.className = 'popup-manager-card';

      // 5. Accessible Close Button
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'popup-manager-close-btn';
      closeBtn.setAttribute('aria-label', 'Close popup');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss('close-button');
      });
      card.appendChild(closeBtn);

      // 6. Header & Title
      const header = document.createElement('div');
      header.className = 'popup-manager-header';

      const title = document.createElement('h2');
      title.id = 'popup-manager-title';
      title.className = 'popup-manager-title';
      title.textContent = popup.title;
      header.appendChild(title);
      card.appendChild(header);

      // 7. Sanitized Content Body
      const body = document.createElement('div');
      body.className = 'popup-manager-body';
      body.innerHTML = sanitizedContent;
      card.appendChild(body);

      wrapper.appendChild(card);
      shadowRoot.appendChild(wrapper);

      // 8. Bind Escape Key Dismissal
      this.keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
          // Prevent backdrop or other elements from seeing the escape
          event.stopPropagation();
          this.dismiss('escape');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      // 9. Focus Management & Focus Trapping (only for modal center position)
      if (positionConfig.isModal) {
        // Shift initial focus to close button (or initial focusable element)
        try {
          closeBtn.focus();
        } catch {
          // Ignore environments where focus is unsupported
        }

        // Trap focus inside modal
        this.trapKeydownHandler = (event: KeyboardEvent) => {
          if (event.key !== 'Tab') {
            return;
          }

          const focusable = this.getFocusableElements();
          if (focusable.length === 0) {
            event.preventDefault();
            return;
          }

          if (focusable.length === 1) {
            // Only one focusable element exists (e.g. close button); keep focus on it
            event.preventDefault();
            try {
              focusable[0]?.focus();
            } catch {
              // Ignore focus error
            }
            return;
          }

          const firstEl = focusable[0];
          const lastEl = focusable[focusable.length - 1];

          if (!firstEl || !lastEl) {
            return;
          }

          // Determine currently focused element within shadow root
          const activeInShadow = shadowRoot.activeElement;

          if (event.shiftKey) {
            // Shift + Tab: if on first element or outside, cycle to last element
            if (activeInShadow === firstEl || !activeInShadow) {
              event.preventDefault();
              try {
                lastEl.focus();
              } catch {
                // Ignore focus error
              }
            }
          } else {
            // Tab: if on last element, cycle to first element
            if (activeInShadow === lastEl) {
              event.preventDefault();
              try {
                firstEl.focus();
              } catch {
                // Ignore focus error
              }
            }
          }
        };

        window.addEventListener('keydown', this.trapKeydownHandler);
      }

      this.currentPopup = popup;
    } catch (err) {
      // In case of an unexpected rendering failure, ensure no broken DOM remains
      this.destroy();
      throw err;
    }
  }

  /**
   * Hides the active popup and cleans up DOM nodes and listeners inside the Shadow Root.
   * Restores focus to previously active element if applicable.
   * Does not remove the host element or reset loaded data.
   */
  public hide(): void {
    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.trapKeydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.trapKeydownHandler);
      this.trapKeydownHandler = null;
    }

    if (this.shadowRoot) {
      while (this.shadowRoot.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }
    }

    const wasVisible = this.currentPopup !== null;
    this.currentPopup = null;
    this.onCloseCallback = null;

    // Restore focus if a modal was active
    this.restoreFocus();

    if (wasVisible && this.onHideCallback) {
      const cb = this.onHideCallback;
      this.onHideCallback = null;
      try {
        cb();
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[PopupManager] Error in onHide callback:', err);
        }
      }
    }
  }

  /**
   * Fully removes the Shadow DOM host element and all associated resources from the DOM.
   */
  public destroy(): void {
    this.hide();

    if (this.host && typeof document !== 'undefined') {
      this.host.remove();
    }

    this.host = null;
    this.shadowRoot = null;
    this.currentPopup = null;
    this.onHideCallback = null;
    this.onCloseCallback = null;
    this.previouslyFocusedElement = null;
  }
}
