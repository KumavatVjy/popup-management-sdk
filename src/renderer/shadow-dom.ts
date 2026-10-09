import { PublicPopup } from '../client/types';
import { sanitizeHtml } from './sanitize';
import { getPositionConfig } from './positions';
import { SHADOW_STYLES } from './styles';

/**
 * Standard ID assigned to the SDK's host container element in the host page DOM.
 */
export const HOST_ELEMENT_ID = 'popup-manager-host-root';

/**
 * PopupRenderer manages mounting, Shadow DOM encapsulation, positioning,
 * user interactions, and safe removal of popup interface elements.
 */
export class PopupRenderer {
  private host: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private currentPopup: PublicPopup | null = null;
  private onHideCallback: (() => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

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
   * Renders the specified eligible popup inside the Shadow DOM host.
   *
   * @param popup The PublicPopup data to render.
   * @param onHide Optional callback fired when the popup is dismissed or hidden.
   */
  public render(popup: PublicPopup, onHide?: () => void): void {
    if (typeof document === 'undefined') {
      throw new Error('DOM environment is required to render popups');
    }

    // Clean up any previously active popup DOM or listeners before re-rendering
    this.hide();

    this.onHideCallback = onHide || null;

    try {
      const sanitizedContent = sanitizeHtml(popup.content);
      const positionConfig = getPositionConfig(popup.position);
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
        backdrop.addEventListener('click', () => this.hide());
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
        this.hide();
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
          this.hide();
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.currentPopup = popup;
    } catch (err) {
      // In case of an unexpected rendering failure, ensure no broken DOM remains
      this.destroy();
      throw err;
    }
  }

  /**
   * Hides the active popup and cleans up DOM nodes and listeners inside the Shadow Root.
   * Does not remove the host element or reset loaded data.
   */
  public hide(): void {
    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.shadowRoot) {
      while (this.shadowRoot.firstChild) {
        this.shadowRoot.removeChild(this.shadowRoot.firstChild);
      }
    }

    const wasVisible = this.currentPopup !== null;
    this.currentPopup = null;

    if (wasVisible && this.onHideCallback) {
      const cb = this.onHideCallback;
      this.onHideCallback = null;
      cb();
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
  }
}
