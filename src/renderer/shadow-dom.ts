import { PublicPopup } from '../client/types';
import { sanitizeHtml } from './sanitize';
import { getPositionConfig } from './positions';
import { SHADOW_STYLES } from './styles';
import { PopupDismissalReason } from '../events/event-emitter';

/**
 * Standard ID assigned to the SDK's host container element in the host page DOM.
 */
export const HOST_ELEMENT_ID = 'popup-manager-host-root';

function getSafeWebUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** Split CSS box-shadow layers without splitting commas inside rgba()/color(). */
function partitionBoxShadow(value: string): { outset: string; inset: string } {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth = Math.max(0, depth - 1);
    else if (value[index] === ',' && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (value.slice(start).trim()) layers.push(value.slice(start).trim());
  const inset: string[] = [];
  const outset: string[] = [];
  for (const layer of layers) {
    if (/\binset\b/i.test(layer)) inset.push(layer);
    else outset.push(layer);
  }
  return { outset: outset.join(', ') || 'none', inset: inset.join(', ') };
}

function addInsetShadowOverlay(parent: HTMLElement, shadow: string, className: string): void {
  if (!shadow) return;
  const overlay = document.createElement('span');
  overlay.className = className;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.boxShadow = shadow;
  parent.appendChild(overlay);
}

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
  /**
   * Invoked when a visitor submits form or spin interaction inside the popup.
   */
  onSubmit?: (data: {
    popupId: number;
    email?: string;
    name?: string;
    spinResult?: string;
    couponCode?: string;
    formData?: Record<string, any>;
  }) => void;
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
  private onSubmitCallback: ((data: {
    popupId: number;
    email?: string;
    name?: string;
    spinResult?: string;
    couponCode?: string;
    formData?: Record<string, any>;
  }) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private trapKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private imageResizeHandler: (() => void) | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

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
   * Stops any running countdown interval.
   */
  private clearCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Formats a number as zero-padded 2-digit string.
   */
  private pad(n: number): string {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
  }

  /**
   * Starts live countdown ticking for the given segment elements.
   */
  private startCountdown(
    endTime: Date,
    daysEl: HTMLElement,
    hoursEl: HTMLElement,
    minsEl: HTMLElement,
    secsEl: HTMLElement
  ): void {
    this.clearCountdown();

    const tick = () => {
      const diff = endTime.getTime() - Date.now();
      if (diff <= 0) {
        daysEl.textContent = '00';
        hoursEl.textContent = '00';
        minsEl.textContent = '00';
        secsEl.textContent = '00';
        this.clearCountdown();
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      daysEl.textContent = this.pad(days);
      hoursEl.textContent = this.pad(hours);
      minsEl.textContent = this.pad(mins);
      secsEl.textContent = this.pad(secs);
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
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
    this.onSubmitCallback = callbacks?.onSubmit || null;

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

      // Inject custom CSS from popup config (sandboxed inside shadow DOM)
      if (popup.custom_css && popup.custom_css.trim()) {
        styleEl.textContent += '\n/* Custom popup CSS */\n' + popup.custom_css;
      }
      shadowRoot.appendChild(styleEl);

      // 2. Backdrop Overlay (for modal center/middle-center position)
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

      // 4. Card Container (with dynamic inline styles from popup config)
      const card = document.createElement('div');
      card.className = 'popup-manager-card';

      // Apply dynamic border & background from popup settings
      if (popup.background_color) {
        card.style.backgroundColor = popup.background_color;
      }
      if (popup.border_color) {
        card.style.borderColor = popup.border_color;
      }
      if (typeof popup.border_width === 'number' && popup.border_width >= 0) {
        card.style.borderWidth = `${popup.border_width}px`;
        card.style.borderStyle = 'solid';
      }
      const sideBorders = [
        ['Top', popup.border_top_width, popup.border_top_color],
        ['Right', popup.border_right_width, popup.border_right_color],
        ['Bottom', popup.border_bottom_width, popup.border_bottom_color],
        ['Left', popup.border_left_width, popup.border_left_color],
      ] as const;
      for (const [side, width, color] of sideBorders) {
        if (width < 0) continue;
        const key = side.toLowerCase() as 'top' | 'right' | 'bottom' | 'left';
        card.style.setProperty(`border-${key}-width`, `${Math.min(20, width)}px`);
        card.style.setProperty(`border-${key}-style`, 'solid');
        card.style.setProperty(`border-${key}-color`, color || popup.border_color || '#e2e8f0');
      }
      if (popup.box_shadow) card.style.boxShadow = popup.box_shadow;
      card.style.overflow = 'hidden';
      if (typeof popup.border_radius === 'number' && popup.border_radius >= 0) {
        card.style.borderRadius = `${popup.border_radius}px`;
      }

      // 5. Accessible Close Button
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'popup-manager-close-btn';
      closeBtn.setAttribute('aria-label', 'Close popup');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.border = 'none';
      closeBtn.style.boxShadow = 'none';
      if (popup.close_button_color) {
        closeBtn.style.color = popup.close_button_color;
      }
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss('close-button');
      });
      card.appendChild(closeBtn);

      let imageLayout = false;
      let imageFooter: HTMLElement | null = null;
      let isSplit = false;

      if (popup.popup_type === 'wheel') {
        let wheelConfig: any = null;
        try {
          wheelConfig = popup.wheel_config ? JSON.parse(popup.wheel_config) : null;
        } catch {
          wheelConfig = null;
        }
        const slices: Array<{ label: string; code: string; color: string; textColor?: string }> =
          wheelConfig?.slices?.length ? wheelConfig.slices : [
            { label: '15% OFF', code: 'LUCKY15', color: '#f59e0b' },
            { label: '10% OFF', code: 'LUCKY10', color: '#0f766e' },
            { label: 'FREE SHIP', code: 'FREESHIP', color: '#0284c7' },
            { label: '25% OFF', code: 'LUCKY25', color: '#7c3aed' },
            { label: '$10 OFF', code: 'SAVE10', color: '#059669' },
            { label: 'JACKPOT 50%', code: 'JACKPOT50', color: '#e11d48' },
          ];

        const n = slices.length;
        const sliceAngle = 360 / n;
        const cx = 200;
        const cy = 200;
        const r = 190;
        let paths = '';
        slices.forEach((s, i) => {
          const startAngle = i * sliceAngle;
          const endAngle = (i + 1) * sliceAngle;
          const midAngle = startAngle + sliceAngle / 2;
          const a1 = ((startAngle - 90) * Math.PI) / 180;
          const a2 = ((endAngle - 90) * Math.PI) / 180;
          const amid = ((midAngle - 90) * Math.PI) / 180;
          const x1 = (cx + r * Math.cos(a1)).toFixed(1);
          const y1 = (cy + r * Math.sin(a1)).toFixed(1);
          const x2 = (cx + r * Math.cos(a2)).toFixed(1);
          const y2 = (cy + r * Math.sin(a2)).toFixed(1);
          const tx = (cx + 120 * Math.cos(amid)).toFixed(1);
          const ty = (cy + 120 * Math.sin(amid)).toFixed(1);
          paths += `<path d="M200,200 L${x1},${y1} A190,190 0 0,1 ${x2},${y2} Z" fill="${s.color}" stroke="#fff" stroke-width="3"/>`;
          paths += `<text x="${tx}" y="${ty}" fill="${s.textColor || '#fff'}" font-family="Arial,sans-serif" font-weight="900" font-size="${n > 8 ? 11 : 13}" text-anchor="middle" dominant-baseline="central" transform="rotate(${midAngle},${tx},${ty})">${s.label}</text>`;
        });

        const wheelSvg = `<svg id="native-fortune-wheel" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="340" height="340" style="display:block;margin:auto;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.18));transition:transform 3.8s cubic-bezier(0.15, 0.9, 0.2, 1)">
          <circle cx="200" cy="200" r="196" fill="#fff" stroke="#e2e8f0" stroke-width="4"/>
          ${paths}
          <circle cx="200" cy="200" r="38" fill="#111827" stroke="#fff" stroke-width="5"/>
          <circle cx="200" cy="200" r="12" fill="#f59e0b"/>
          <text x="200" y="201" fill="#fff" font-family="Arial,sans-serif" font-weight="800" font-size="10" text-anchor="middle" dominant-baseline="central">SPIN</text>
        </svg>`;

        card.className = 'popup-manager-card popup-manager-wheel-card';
        card.style.maxWidth = '680px';
        card.style.width = 'min(680px, calc(100vw - 24px))';
        if (popup.background_color) card.style.background = popup.background_color;
        if (popup.border_radius) card.style.borderRadius = `${popup.border_radius}px`;

        const wheelGrid = document.createElement('div');
        wheelGrid.className = 'popup-manager-wheel-grid';
        wheelGrid.innerHTML = `
          <div class="popup-manager-wheel-stage">
            <div class="popup-manager-wheel-pointer"></div>
            <div class="popup-manager-wheel-wrapper">${wheelSvg}</div>
          </div>
          <div class="popup-manager-wheel-panel">
            <div id="wheel-intro-content">
              <span class="popup-manager-wheel-badge">EXCLUSIVE OFFER</span>
              <h2 class="popup-manager-wheel-title" style="color:${popup.title_color || '#111827'}">${popup.title}</h2>
              <div class="popup-manager-wheel-body">${sanitizedContent}</div>
              ${wheelConfig?.requireEmail !== false ? `
              <div class="popup-manager-wheel-input-wrap">
                <input type="email" id="wheel-visitor-email" placeholder="${wheelConfig?.emailPlaceholder || 'Enter your email address...'}" class="popup-manager-wheel-input" />
              </div>` : ''}
              <button type="button" id="wheel-action-btn" class="popup-manager-wheel-spin-btn" style="background:${popup.cta_bg_color || '#9bd3f2'};color:${popup.cta_text_color || '#0f2b48'}">
                ${wheelConfig?.spinButtonText || 'SPIN NOW'}
              </button>
              <p class="popup-manager-wheel-disclaimer">One spin per visitor. Terms & conditions apply.</p>
            </div>
            <div id="wheel-winning-content" style="display:none;text-align:center;animation:fadeIn 0.4s ease">
              <span class="popup-manager-wheel-badge" style="background:#dcfce7;color:#15803d">🎉 LUCKY WINNER!</span>
              <h3 id="wheel-winning-title" style="margin:8px 0 6px;font-size:24px;font-weight:900;color:#111827">YOU WON!</h3>
              <p style="margin:0 0 14px;color:#4b5563;font-size:12px">Use this exclusive discount code at checkout:</p>
              <div id="wheel-coupon-box" style="background:#f1f5f9;border:2px dashed #6366f1;border-radius:8px;padding:12px;font-family:monospace;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:2px;margin:0 0 14px">CODE</div>
              <button type="button" id="wheel-copy-btn" class="popup-manager-wheel-spin-btn" style="background:#111827;color:#ffffff;margin-bottom:8px">📋 Copy Code & Shop</button>
            </div>
          </div>
        `;
        card.appendChild(wheelGrid);

        let currentDeg = 0;
        let isSpinning = false;
        const spinBtn = wheelGrid.querySelector<HTMLButtonElement>('#wheel-action-btn');
        const emailInput = wheelGrid.querySelector<HTMLInputElement>('#wheel-visitor-email');
        const svgEl = wheelGrid.querySelector<SVGElement>('#native-fortune-wheel');
        const introEl = wheelGrid.querySelector<HTMLElement>('#wheel-intro-content');
        const winningEl = wheelGrid.querySelector<HTMLElement>('#wheel-winning-content');
        const winningTitle = wheelGrid.querySelector<HTMLElement>('#wheel-winning-title');
        const couponBox = wheelGrid.querySelector<HTMLElement>('#wheel-coupon-box');
        const copyBtn = wheelGrid.querySelector<HTMLButtonElement>('#wheel-copy-btn');

        if (spinBtn) {
          spinBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isSpinning) return;
            const email = emailInput?.value?.trim() || '';
            if (wheelConfig?.requireEmail !== false && !email) {
              if (emailInput) {
                emailInput.focus();
                emailInput.style.borderColor = '#ef4444';
              }
              return;
            }

            isSpinning = true;
            spinBtn.disabled = true;
            spinBtn.textContent = '🎰 Spinning...';
            spinBtn.style.opacity = '0.7';

            const wonIndex = Math.floor(Math.random() * slices.length);
            const fallbackSlice = { label: 'Special Offer', code: 'SAVE10', color: '#f59e0b' };
            const wonSlice = slices[wonIndex] || slices[0] || fallbackSlice;

            const sliceMid = wonIndex * sliceAngle + sliceAngle / 2;
            const targetAlign = (180 - sliceMid + 360) % 360;
            const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360;
            const targetDeg = currentDeg + fullSpins + ((targetAlign - (currentDeg % 360) + 360) % 360);
            currentDeg = targetDeg;

            if (svgEl) {
              svgEl.style.transform = `rotate(${targetDeg}deg)`;
            }

            setTimeout(() => {
              isSpinning = false;
              if (introEl && winningEl) {
                introEl.style.display = 'none';
                winningEl.style.display = 'block';
                if (winningTitle) winningTitle.textContent = `YOU WON ${wonSlice.label}!`;
                if (couponBox) {
                  couponBox.textContent = wonSlice.code;
                  couponBox.style.borderColor = wonSlice.color;
                }
              }

              this.onSubmitCallback?.({
                popupId: popup.id,
                email,
                name: '',
                spinResult: wonSlice.label,
                couponCode: wonSlice.code,
                formData: { email, prize: wonSlice.label, code: wonSlice.code },
              });
            }, 3900);
          });
        }

        if (copyBtn) {
          copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (couponBox && typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(couponBox.textContent || '');
            }
            copyBtn.textContent = '✓ Copied to Clipboard!';
            setTimeout(() => {
              copyBtn.textContent = '📋 Copy Code & Shop';
            }, 2000);
          });
        }
      } else {
      // 6. Banner Image (if configured)
      const bannerImageUrl = getSafeWebUrl(popup.banner_image_url || '');
      imageLayout = Boolean(bannerImageUrl && popup.show_image !== false);
      isSplit = Boolean(
        imageLayout && (
          popup.layout_type === 'side-by-side' ||
          popup.layout_type === 'side-by-side-reverse' ||
          (popup.custom_css && (popup.custom_css.includes('flex-direction: row') || popup.custom_css.includes('flex-direction:row') || popup.custom_css.includes('flex-direction: flex-row')))
        )
      );
      if (isSplit) {
        card.classList.add('popup-manager-side-by-side');
        if (popup.layout_type === 'side-by-side-reverse') {
          card.classList.add('popup-manager-side-by-side-reverse');
        }
      }
      const mediaPanel = imageLayout || popup.show_content !== false ? document.createElement('div') : null;
      if (mediaPanel) {
        mediaPanel.className = 'popup-manager-media-panel';
        mediaPanel.style.borderTopLeftRadius = `${popup.border_radius}px`;
        mediaPanel.style.borderTopRightRadius = `${popup.border_radius}px`;
        const mediaShadow = partitionBoxShadow(popup.media_box_shadow || '');
        mediaPanel.style.boxShadow = mediaShadow.outset;
        if (popup.media_border_width > 0) {
          mediaPanel.style.border = `${Math.min(20, popup.media_border_width)}px solid ${popup.media_border_color || 'transparent'}`;
        }
        if (popup.media_overlay_color && popup.media_overlay_opacity > 0) {
          const overlay = document.createElement('div');
          overlay.className = 'popup-manager-media-overlay';
          overlay.style.backgroundColor = popup.media_overlay_color;
          overlay.style.opacity = String(Math.min(100, Math.max(0, popup.media_overlay_opacity)) / 100);
          mediaPanel.appendChild(overlay);
        }
        mediaPanel.dataset.insetShadow = mediaShadow.inset;
      }
      if (imageLayout) {
        wrapper.removeAttribute('aria-labelledby');
        wrapper.setAttribute('aria-label', popup.title);
      }
      if ((popup.popup_width || 0) > 0) {
        const popupWidth = Math.min(2000, Math.max(200, popup.popup_width || 200));
        wrapper.style.width = `min(${popupWidth}px, calc(100vw - 24px))`;
        wrapper.style.maxWidth = `${popupWidth}px`;
      }
      if ((popup.popup_height || 0) > 0 && !imageLayout) {
        card.style.height = `${Math.min(2000, Math.max(200, popup.popup_height || 200))}px`;
      }
      if (imageLayout && bannerImageUrl) {
        card.classList.add('popup-manager-image-card');
        wrapper.classList.add('popup-manager-image-wrapper');
        const bannerWrap = document.createElement('div');
        bannerWrap.className = 'popup-manager-banner';
        bannerWrap.style.overflow = 'hidden';
        if (isSplit) {
          const isReverse = popup.layout_type === 'side-by-side-reverse';
          bannerWrap.style.borderTopLeftRadius = isReverse ? '0' : `${popup.border_radius}px`;
          bannerWrap.style.borderBottomLeftRadius = isReverse ? '0' : `${popup.border_radius}px`;
          bannerWrap.style.borderTopRightRadius = isReverse ? `${popup.border_radius}px` : '0';
          bannerWrap.style.borderBottomRightRadius = isReverse ? `${popup.border_radius}px` : '0';
          bannerWrap.style.position = 'relative';
          bannerWrap.style.height = 'auto';
          bannerWrap.style.minHeight = '0';
          bannerWrap.style.maxHeight = 'none';
          bannerWrap.style.alignSelf = 'stretch';
          bannerWrap.style.display = 'flex';
        } else {
          bannerWrap.style.borderTopLeftRadius = `${popup.border_radius}px`;
          bannerWrap.style.borderTopRightRadius = `${popup.border_radius}px`;
          const hasBottomContent = Boolean(popup.show_content !== false || popup.cta_text?.trim() || popup.countdown_enabled);
          if (!hasBottomContent) {
            bannerWrap.style.borderBottomLeftRadius = `${popup.border_radius}px`;
            bannerWrap.style.borderBottomRightRadius = `${popup.border_radius}px`;
          }
        }
        const bannerLinkUrl = getSafeWebUrl(popup.banner_link_url || '');
        if (bannerLinkUrl) {
          const bannerLink = document.createElement('a');
          bannerLink.href = bannerLinkUrl;
          bannerLink.target = popup.banner_link_target === '_self' ? '_self' : '_blank';
          bannerLink.rel = 'noopener noreferrer';
          bannerLink.setAttribute('aria-label', 'Banner link');
          bannerLink.className = 'popup-manager-banner-link';
          bannerLink.style.display = 'block';
          bannerLink.style.width = '100%';
          bannerLink.style.height = '100%';
          bannerLink.style.textDecoration = 'none';
          if (isSplit) {
            bannerLink.style.position = 'absolute';
            bannerLink.style.inset = '0';
            bannerLink.style.overflow = 'hidden';
          } else {
            bannerLink.style.position = 'relative';
          }

          const bannerImg = document.createElement('img');
          bannerImg.src = bannerImageUrl;
          bannerImg.alt = '';
          bannerImg.setAttribute('aria-hidden', 'true');
          if (isSplit) {
            bannerImg.style.position = 'absolute';
            bannerImg.style.inset = '0';
            bannerImg.style.width = '100%';
            bannerImg.style.height = '100%';
            bannerImg.style.minHeight = '100%';
            bannerImg.style.maxHeight = 'none';
            bannerImg.style.objectFit = 'cover';
            bannerImg.style.objectPosition = 'center';
          } else {
            bannerImg.style.borderTopLeftRadius = `${popup.border_radius}px`;
            bannerImg.style.borderTopRightRadius = `${popup.border_radius}px`;
            const hasBottomContent = Boolean(popup.show_content !== false || popup.cta_text?.trim() || popup.countdown_enabled);
            if (!hasBottomContent) {
              bannerImg.style.borderBottomLeftRadius = `${popup.border_radius}px`;
              bannerImg.style.borderBottomRightRadius = `${popup.border_radius}px`;
            }
          }

          bannerLink.appendChild(bannerImg);
          bannerWrap.appendChild(bannerLink);
        } else {
          const bannerImg = document.createElement('img');
          bannerImg.src = bannerImageUrl;
          bannerImg.alt = '';
          bannerImg.setAttribute('aria-hidden', 'true');
          if (isSplit) {
            bannerImg.style.position = 'absolute';
            bannerImg.style.inset = '0';
            bannerImg.style.width = '100%';
            bannerImg.style.height = '100%';
            bannerImg.style.minHeight = '100%';
            bannerImg.style.maxHeight = 'none';
            bannerImg.style.objectFit = 'cover';
            bannerImg.style.objectPosition = 'center';
          } else {
            bannerImg.style.borderTopLeftRadius = `${popup.border_radius}px`;
            bannerImg.style.borderTopRightRadius = `${popup.border_radius}px`;
            const hasBottomContent = Boolean(popup.show_content !== false || popup.cta_text?.trim() || popup.countdown_enabled);
            if (!hasBottomContent) {
              bannerImg.style.borderBottomLeftRadius = `${popup.border_radius}px`;
              bannerImg.style.borderBottomRightRadius = `${popup.border_radius}px`;
            }
          }
          bannerWrap.appendChild(bannerImg);
        }

        if (popup.badge_text?.trim()) {
          const badge = document.createElement('span');
          badge.className = 'popup-manager-image-badge';
          badge.textContent = popup.badge_text.trim();
          bannerWrap.appendChild(badge);
        }

        mediaPanel?.appendChild(bannerWrap);
      }

      // 7. Header & Title
      if (!imageLayout) {
        const header = document.createElement('div');
        header.className = 'popup-manager-header';

        const title = document.createElement('h2');
        title.id = 'popup-manager-title';
        title.className = 'popup-manager-title';
        title.textContent = popup.title;
        if (popup.title_color) {
          title.style.color = popup.title_color;
        }
        header.appendChild(title);
        card.appendChild(header);
      }

      // 8. Sanitized Content Body
      let bodyElement: HTMLElement | null = null;
      if (popup.show_content !== false) {
        const body = document.createElement('div');
        body.className = 'popup-manager-body';
        body.innerHTML = sanitizedContent;
        if (isSplit && popup.title && !sanitizedContent.includes('<h1') && !sanitizedContent.includes('<h2') && !sanitizedContent.includes('<h3')) {
          const splitTitle = document.createElement('h2');
          splitTitle.className = 'popup-manager-title';
          splitTitle.textContent = popup.title;
          if (popup.title_color) splitTitle.style.color = popup.title_color;
          body.prepend(splitTitle);
        }
        bodyElement = body;
        if (mediaPanel) mediaPanel.appendChild(body);
        else card.appendChild(body);
      }

      if (mediaPanel?.dataset.insetShadow) {
        addInsetShadowOverlay(mediaPanel, mediaPanel.dataset.insetShadow, 'popup-manager-inset-shadow popup-manager-media-inset-shadow');
      }

      if (mediaPanel) card.appendChild(mediaPanel);

      imageFooter = imageLayout && !isSplit ? document.createElement('div') : null;
      if (imageFooter) imageFooter.className = 'popup-manager-image-footer';
      if (imageFooter && popup.footer_background_color) imageFooter.style.background = popup.footer_background_color;
      const footerShadow = partitionBoxShadow(popup.footer_box_shadow || '');
      if (imageFooter) imageFooter.style.boxShadow = footerShadow.outset;
      if (imageFooter) {
        imageFooter.style.borderBottomLeftRadius = `${popup.border_radius}px`;
        imageFooter.style.borderBottomRightRadius = `${popup.border_radius}px`;
        imageFooter.style.borderTop = `${Math.min(20, Math.max(0, popup.footer_border_width))}px solid ${popup.footer_border_color || 'transparent'}`;
      }
      let imageCountdown: HTMLElement | null = null;

      // 9. Countdown Timer (if enabled)
      if (popup.countdown_enabled) {
        const parsedEndDate = popup.countdown_end_time ? new Date(popup.countdown_end_time) : new Date();
        const endDate = Number.isNaN(parsedEndDate.getTime()) ? new Date() : parsedEndDate;
        const countdownEl = document.createElement('div');
          countdownEl.className = 'popup-manager-countdown';

          if (popup.countdown_title && !imageFooter) {
            const cdTitle = document.createElement('span');
            cdTitle.className = 'popup-manager-countdown-title';
            cdTitle.textContent = popup.countdown_title;
            countdownEl.appendChild(cdTitle);
          }

          const mkSegment = (label: string): { wrap: HTMLElement; value: HTMLElement } => {
            const wrap = document.createElement('div');
            wrap.className = 'popup-manager-countdown-segment';
            const val = document.createElement('span');
            val.className = 'popup-manager-countdown-value';
            val.textContent = '00';
            const lbl = document.createElement('span');
            lbl.className = 'popup-manager-countdown-label';
            lbl.textContent = label;
            wrap.appendChild(val);
            wrap.appendChild(lbl);
            return { wrap, value: val };
          };

          const mkSep = (): HTMLElement => {
            const sep = document.createElement('span');
            sep.className = 'popup-manager-countdown-sep';
            sep.textContent = ':';
            return sep;
          };

          const days = mkSegment(imageFooter ? 'D' : 'Days');
          const hours = mkSegment(imageFooter ? 'H' : 'Hours');
          const mins = mkSegment(imageFooter ? 'M' : 'Mins');
          const secs = mkSegment(imageFooter ? 'S' : 'Secs');

          countdownEl.appendChild(days.wrap);
          countdownEl.appendChild(mkSep());
          countdownEl.appendChild(hours.wrap);
          countdownEl.appendChild(mkSep());
          countdownEl.appendChild(mins.wrap);
          countdownEl.appendChild(mkSep());
          countdownEl.appendChild(secs.wrap);

          if (imageFooter) imageCountdown = countdownEl;
          else card.appendChild(countdownEl);

          this.startCountdown(endDate, days.value, hours.value, mins.value, secs.value);
      }

      // 10. CTA Button (if configured)
      if (popup.cta_text && popup.cta_text.trim()) {
        const footer = imageFooter || document.createElement('div');
        if (imageFooter) footer.classList.add('popup-manager-footer');
        else footer.className = 'popup-manager-footer';

        const ctaEl = document.createElement('a');
        ctaEl.className = 'popup-manager-cta-btn';
        ctaEl.textContent = popup.cta_text;

        const ctaUrl = getSafeWebUrl(popup.cta_url || '');
        if (ctaUrl) {
          ctaEl.href = ctaUrl;
          ctaEl.target = popup.cta_target === '_self' ? '_self' : '_blank';
          ctaEl.rel = 'noopener noreferrer';
        } else {
          ctaEl.removeAttribute('href');
          ctaEl.setAttribute('role', 'button');
          ctaEl.setAttribute('aria-disabled', 'true');
        }

        if (popup.cta_bg_color && !imageFooter) {
          ctaEl.style.backgroundColor = popup.cta_bg_color;
        }
        if (popup.cta_text_color) {
          ctaEl.style.color = popup.cta_text_color;
        }

        if (imageFooter) {
          const action = document.createElement('div');
          action.className = 'popup-manager-image-action';
          const clock = document.createElement('span');
          clock.className = 'popup-manager-clock-icon';
          clock.setAttribute('aria-hidden', 'true');
          clock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/></svg>';
          action.appendChild(clock);
          const details = document.createElement('span');
          details.className = 'popup-manager-image-action-details';
          if (popup.countdown_title) {
            const heading = document.createElement('span');
            heading.className = 'popup-manager-image-action-heading';
            const label = document.createElement('strong');
            label.className = 'popup-manager-image-countdown-title';
            label.textContent = popup.countdown_title;
            heading.appendChild(label);
            if (popup.countdown_enabled) {
              const live = document.createElement('span');
              live.className = 'popup-manager-live-badge';
              live.textContent = 'LIVE';
              heading.appendChild(live);
            }
            details.appendChild(heading);
          }
          ctaEl.classList.add('popup-manager-image-cta');
          ctaEl.innerHTML = `${popup.cta_text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)} <span aria-hidden="true">→</span>`;
          details.appendChild(ctaEl);
          action.appendChild(details);
          footer.appendChild(action);
        } else if (isSplit && bodyElement) {
          bodyElement.appendChild(ctaEl);
        } else {
          footer.appendChild(ctaEl);
          card.appendChild(footer);
        }
      }

      if (imageFooter) {
        if (imageCountdown) imageFooter.appendChild(imageCountdown);
        addInsetShadowOverlay(imageFooter, footerShadow.inset, 'popup-manager-inset-shadow popup-manager-footer-inset-shadow');
        card.appendChild(imageFooter);
      }
      }

      // 11. Regulatory & Compliance Disclaimer (if enabled)
      if (popup.disclaimer_enabled && popup.disclaimer_text && popup.disclaimer_text.trim()) {
        const disclaimerEl = document.createElement('div');
        disclaimerEl.className = 'popup-manager-disclaimer';
        disclaimerEl.innerHTML = sanitizeHtml(popup.disclaimer_text);
        card.appendChild(disclaimerEl);
      }

      wrapper.appendChild(card);
      shadowRoot.appendChild(wrapper);

      if (imageLayout) {
        const bannerImg = card.querySelector<HTMLImageElement>('.popup-manager-banner img');
        const isSplitLayout = isSplit;
        const preferredWidth = Math.min(2000, Math.max(200, popup.popup_width || (isSplitLayout ? 680 : 576)));
        const fitImagePopup = () => {
          if (isSplitLayout) {
            const splitWidth = Math.min(preferredWidth, window.innerWidth - 24);
            wrapper.style.width = `min(${splitWidth}px, calc(100vw - 24px))`;
            wrapper.style.maxWidth = `${splitWidth}px`;
            return;
          }
          if (!bannerImg?.naturalWidth || !bannerImg.naturalHeight) return;
          const maxWidth = Math.max(200, Math.min(preferredWidth, window.innerWidth - 24));
          const maxHeight = Math.max(200, window.innerHeight - 48);
          let fittedWidth = maxWidth;

          for (let attempt = 0; attempt < 3; attempt += 1) {
            wrapper.style.width = `${fittedWidth}px`;
            wrapper.style.maxWidth = `${fittedWidth}px`;
            const footerHeight = imageFooter?.getBoundingClientRect().height || 0;
            const imageHeight = fittedWidth * bannerImg.naturalHeight / bannerImg.naturalWidth;
            const totalHeight = imageHeight + footerHeight + 2;
            if (totalHeight <= maxHeight) break;
            fittedWidth = Math.max(200, fittedWidth * maxHeight / totalHeight);
          }

          wrapper.style.width = `${fittedWidth}px`;
          wrapper.style.maxWidth = `${fittedWidth}px`;
        };

        this.imageResizeHandler = fitImagePopup;
        bannerImg?.addEventListener('load', fitImagePopup);
        window.addEventListener('resize', fitImagePopup);
        fitImagePopup();
      }

      // Custom JavaScript is supplied by an authenticated administrator and runs
      // in the host page context. popupRoot is provided as the mounted popup node.
      if (popup.custom_js && popup.custom_js.trim()) {
        try {
          const runCustomJS = new Function('popupRoot', 'popup', popup.custom_js) as (
            popupRoot: HTMLElement,
            popup: PublicPopup
          ) => void;
          runCustomJS(wrapper, popup);
        } catch (error) {
          console.error('[PopupManager] Custom popup JavaScript failed to run.', error);
        }
      }

      // 10b. Form & Action Submission Handler
      const submitHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        const submitBtn = target.closest<HTMLElement>(
          'button:not(.popup-manager-close-btn), a.popup-manager-cta-btn, [data-popup-action], a[href*="claim"], a[href*="spin"], a[href*="save"], a[href*="harvest"], a[href*="unlock"]'
        );
        if (!submitBtn && e.type !== 'submit') return;

        const emailInput = card.querySelector<HTMLInputElement>('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        const nameInput = card.querySelector<HTMLInputElement>('input[name="name"], input[placeholder*="name" i]');
        const couponEl = card.querySelector<HTMLElement>('strong, [data-coupon-code]');

        const email = emailInput?.value?.trim() || '';
        const name = nameInput?.value?.trim() || '';
        const couponCode = couponEl?.textContent?.trim() || '';

        const isSpin = Boolean(submitBtn?.textContent?.toLowerCase().includes('spin') || card.innerHTML.includes('spin'));
        let spinResult = '';
        let dynamicCoupon = couponCode;

        if (isSpin) {
          const prizes = [
            { label: '15% OFF', code: 'TOMS-SAVE15', angle: 30, color: '#f59e0b' },
            { label: '10% OFF', code: 'TOMS-SAVE10', angle: 90, color: '#0f766e' },
            { label: 'FREE SHIPPING', code: 'TOMS-FREESHIP', angle: 150, color: '#0284c7' },
            { label: '25% OFF', code: 'TOMS-SAVE25', angle: 210, color: '#7c3aed' },
            { label: '$10 OFF', code: 'TOMS-GIFT10', angle: 270, color: '#059669' },
            { label: 'JACKPOT 50%', code: 'TOMS-LUCKY50', angle: 330, color: '#e11d48' }
          ];
          const fallbackPrize = { label: '10% OFF', code: 'TOMS-SAVE10', angle: 90, color: '#0f766e' };
          const wonPrize = prizes[Math.floor(Math.random() * prizes.length)] || fallbackPrize;
          spinResult = wonPrize.label;
          dynamicCoupon = wonPrize.code;

          const wheelImg = card.querySelector<HTMLElement>('.popup-manager-banner img');
          if (wheelImg) {
            const targetAlignment = (180 - wonPrize.angle + 360) % 360;
            const fullTurns = (5 + Math.floor(Math.random() * 3)) * 360;
            const targetDeg = fullTurns + targetAlignment;
            wheelImg.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.9, 0.2, 1)';
            wheelImg.style.transform = `translateX(-30%) rotate(${targetDeg}deg)`;
          }

          if (submitBtn) {
            submitBtn.textContent = '🎰 Spinning...';
          }

          setTimeout(() => {
            const body = card.querySelector<HTMLElement>('.popup-manager-body');
            if (body) {
              body.innerHTML = `
                <div style="text-align:center;padding:10px 0;animation:popIn 0.4s ease">
                  <span style="display:inline-block;padding:4px 12px;background:#dcfce7;color:#15803d;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">🎉 Lucky Winner!</span>
                  <h3 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#111827">YOU WON ${wonPrize.label}!</h3>
                  <p style="margin:0 0 14px;color:#4b5563;font-size:12px">Use the promo code below at checkout:</p>
                  <div style="background:#f1f5f9;border:2px dashed ${wonPrize.color};border-radius:6px;padding:10px;font-family:monospace;font-size:16px;font-weight:900;color:#0f172a;letter-spacing:2px;margin:0 0 16px">${wonPrize.code}</div>
                  <button type="button" class="popup-manager-cta-btn" style="display:block;width:100%;border:none;cursor:pointer;background:#111827;color:#fff;font-weight:800;font-size:12px;text-align:center;padding:11px 16px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 3px 8px rgba(0,0,0,0.2)">✓ Code Applied</button>
                </div>
              `;
            }
          }, 3600);
        }

        const inputs = Array.from(card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'));
        const formData: Record<string, any> = {};
        for (const input of inputs) {
          if (input.name) {
            formData[input.name] = input.value;
          }
        }

        if (email || isSpin) {
          if (e.cancelable) e.preventDefault();
          this.onSubmitCallback?.({
            popupId: popup.id,
            email,
            name,
            spinResult,
            couponCode: dynamicCoupon,
            formData,
          });

          if (submitBtn && !isSpin) {
            submitBtn.setAttribute('data-submitted', 'true');
            if (email) {
              submitBtn.textContent = '✓ Offer Unlocked!';
            }
          }
          if (emailInput) {
            emailInput.disabled = true;
          }
        }
      };

      card.addEventListener('submit', submitHandler);
      card.addEventListener('click', submitHandler);

      // 11. Bind Escape Key Dismissal
      this.keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
          // Prevent backdrop or other elements from seeing the escape
          event.stopPropagation();
          this.dismiss('escape');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      // 12. Focus Management & Focus Trapping (only for modal center position)
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
    // Stop any running countdown timer
    this.clearCountdown();

    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.trapKeydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.trapKeydownHandler);
      this.trapKeydownHandler = null;
    }

    if (this.imageResizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.imageResizeHandler);
      this.imageResizeHandler = null;
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
