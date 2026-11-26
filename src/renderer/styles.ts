/**
 * Encapsulated styles injected exclusively into the Shadow DOM root.
 * Completely immune to host page CSS while preventing style leakage out of the popup.
 */
export const SHADOW_STYLES = /* css */ `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #1e293b;
    box-sizing: border-box;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* Keyframe Animations */
  @keyframes pm-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes pm-center-scale-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes pm-middle-center-scale-in {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes pm-banner-slide-down {
    from { opacity: 0; transform: translateY(-100%); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pm-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pm-slide-in-left {
    from { opacity: 0; transform: translateX(-16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes pm-slide-in-right {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* Backdrop Overlay (Center/Middle-Center Modal) */
  .popup-manager-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.55);
    z-index: 2147483646;
    backdrop-filter: blur(2px);
    animation: pm-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* General Position Container */
  .popup-manager-wrapper {
    z-index: 2147483647;
    pointer-events: auto;
  }

  .popup-manager-wrapper.popup-manager-image-wrapper {
    width: min(576px, calc(100vw - 32px));
    max-width: 576px;
  }

  /* === 9-Grid + Legacy Positions === */

  /* 1. Center (legacy alias = middle-center modal) */
  .popup-manager-position-center {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100vw - 32px);
    max-width: 540px;
    max-height: calc(100vh - 64px);
    max-height: calc(100dvh - 64px);
    display: flex;
    flex-direction: column;
    animation: pm-center-scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 2. Top Banner (full-width) */
  .popup-manager-position-top-banner {
    position: fixed;
    top: 0;
    top: env(safe-area-inset-top, 0px);
    left: 0;
    width: 100vw;
    max-height: 40vh;
    max-height: 40dvh;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    animation: pm-banner-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .popup-manager-position-top-banner-center,
  .popup-manager-position-bottom-banner-center {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    width: 100vw;
    max-height: 40vh;
    max-height: 40dvh;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .popup-manager-position-top-banner-center {
    top: env(safe-area-inset-top, 0px);
    animation: pm-banner-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .popup-manager-position-bottom-banner-center {
    bottom: env(safe-area-inset-bottom, 0px);
    animation: pm-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 3. Bottom-Left Card */
  .popup-manager-position-bottom-left {
    position: fixed;
    bottom: 24px;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    left: 24px;
    left: calc(24px + env(safe-area-inset-left, 0px));
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    max-height: calc(100dvh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 4. Bottom-Right Card */
  .popup-manager-position-bottom-right {
    position: fixed;
    bottom: 24px;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    right: 24px;
    right: calc(24px + env(safe-area-inset-right, 0px));
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    max-height: calc(100dvh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 5. Top-Left */
  .popup-manager-position-top-left {
    position: fixed;
    top: 24px;
    top: calc(24px + env(safe-area-inset-top, 0px));
    left: 24px;
    left: calc(24px + env(safe-area-inset-left, 0px));
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-in-left 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 6. Top-Center */
  .popup-manager-position-top-center {
    position: fixed;
    top: 24px;
    top: calc(24px + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100vw - 48px);
    max-width: 480px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 7. Top-Right */
  .popup-manager-position-top-right {
    position: fixed;
    top: 24px;
    top: calc(24px + env(safe-area-inset-top, 0px));
    right: 24px;
    right: calc(24px + env(safe-area-inset-right, 0px));
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 8. Middle-Left */
  .popup-manager-position-middle-left {
    position: fixed;
    top: 50%;
    left: 24px;
    left: calc(24px + env(safe-area-inset-left, 0px));
    transform: translateY(-50%);
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-in-left 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 9. Middle-Center (full modal with backdrop) */
  .popup-manager-position-middle-center {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100vw - 32px);
    max-width: 540px;
    max-height: calc(100vh - 64px);
    max-height: calc(100dvh - 64px);
    display: flex;
    flex-direction: column;
    animation: pm-middle-center-scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 10. Middle-Right */
  .popup-manager-position-middle-right {
    position: fixed;
    top: 50%;
    right: 24px;
    right: calc(24px + env(safe-area-inset-right, 0px));
    transform: translateY(-50%);
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* 11. Bottom-Center */
  .popup-manager-position-bottom-center {
    position: fixed;
    bottom: 24px;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100vw - 48px);
    max-width: 480px;
    max-height: calc(100vh - 48px);
    max-height: calc(100dvh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
    animation: pm-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* === Popup Card === */
  .popup-manager-card {
    background: #ffffff;
    color: #1e293b;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: inherit;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
  }

  .popup-manager-position-top-banner .popup-manager-card {
    border-radius: 0;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 1px solid #cbd5e1;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06);
  }

  /* === Close Button === */
  .popup-manager-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 20px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    margin: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
    z-index: 10;
  }

  .popup-manager-close-btn:hover {
    background-color: #f1f5f9;
    color: #0f172a;
  }

  .popup-manager-close-btn:focus-visible {
    outline: none;
    box-shadow: none;
  }

  /* === Banner Image === */
  .popup-manager-banner {
    width: 100%;
    display: block;
    overflow: hidden;
    flex-shrink: 0;
    line-height: 0;
  }

  .popup-manager-banner img {
    width: 100%;
    height: auto;
    max-height: 220px;
    object-fit: cover;
    display: block;
    border: none;
  }

  /* === Header & Title === */
  .popup-manager-header {
    padding: 20px 52px 8px 24px;
    flex-shrink: 0;
  }

  .popup-manager-position-top-banner .popup-manager-header {
    padding: 12px 52px 4px 20px;
  }

  .popup-manager-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
  }

  .popup-manager-position-top-banner .popup-manager-title {
    font-size: 1.05rem;
  }

  /* === Content Body === */
  .popup-manager-body {
    padding: 8px 24px 20px 24px;
    overflow-y: auto;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #334155;
    flex-grow: 1;
    min-height: 0;
    overscroll-behavior: contain;
  }

  .popup-manager-position-top-banner .popup-manager-body {
    padding: 4px 52px 14px 20px;
  }

  /* Typography within sanitized content */
  .popup-manager-body p { margin: 0 0 12px 0; }
  .popup-manager-body p:last-child { margin-bottom: 0; }

  .popup-manager-body h1,
  .popup-manager-body h2,
  .popup-manager-body h3 {
    color: #0f172a;
    margin: 16px 0 8px 0;
    font-weight: 600;
    line-height: 1.3;
  }

  .popup-manager-body h1:first-child,
  .popup-manager-body h2:first-child,
  .popup-manager-body h3:first-child { margin-top: 0; }

  .popup-manager-body a {
    color: #2563eb;
    text-decoration: underline;
    font-weight: 500;
    word-break: break-word;
  }

  .popup-manager-body a:hover { color: #1d4ed8; }

  .popup-manager-body ul,
  .popup-manager-body ol { margin: 0 0 12px 0; padding-left: 20px; }

  .popup-manager-body li { margin-bottom: 4px; }

  .popup-manager-body blockquote {
    margin: 0 0 12px 0;
    padding-left: 12px;
    border-left: 3px solid #cbd5e1;
    color: #64748b;
    font-style: italic;
  }

  /* === Countdown Timer === */
  .popup-manager-countdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .popup-manager-countdown-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-right: 4px;
  }

  .popup-manager-countdown-segment {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 44px;
    background: #1e293b;
    border-radius: 8px;
    padding: 6px 4px 4px;
  }

  .popup-manager-countdown-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .popup-manager-countdown-label {
    font-size: 0.6rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 3px;
  }

  .popup-manager-countdown-sep {
    font-size: 1.2rem;
    font-weight: 700;
    color: #334155;
    line-height: 1;
    padding-bottom: 4px;
  }

  /* === CTA Button === */
  .popup-manager-footer {
    padding: 0 24px 20px 24px;
    flex-shrink: 0;
  }

  .popup-manager-cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 12px 20px;
    border-radius: 8px;
    border: none;
    background: #2563eb;
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: opacity 0.15s ease, transform 0.1s ease;
    line-height: 1.3;
  }

  .popup-manager-cta-btn:hover {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  .popup-manager-cta-btn:active {
    opacity: 1;
    transform: none;
  }

  .popup-manager-cta-btn:focus-visible {
    outline: 2px solid #93c5fd;
    outline-offset: 2px;
  }

  /* Image campaigns use a separate image panel above the action and timer footer. */
  .popup-manager-image-card {
    max-height: none;
    overflow: hidden;
    background: #09090b;
    border: 1px solid rgba(255,255,255,.16);
  }

  .popup-manager-image-card { width: 100%; }

  .popup-manager-media-panel {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    background: transparent;
  }
  .popup-manager-inset-shadow {
    position: absolute;
    inset: 0;
    z-index: 3;
    border-radius: inherit;
    pointer-events: none;
  }
  .popup-manager-media-inset-shadow { border-top-left-radius: inherit; border-top-right-radius: inherit; }
  .popup-manager-media-overlay {
    position: absolute;
    z-index: 1;
    inset: 0;
    pointer-events: none;
  }
  .popup-manager-media-panel > .popup-manager-banner,
  .popup-manager-media-panel > .popup-manager-body {
    position: relative;
    z-index: 2;
  }
  .popup-manager-image-card .popup-manager-media-panel > .popup-manager-body {
    color: #fff;
    background: transparent;
  }
  .popup-manager-image-card .popup-manager-media-panel > .popup-manager-body :is(h1,h2,h3,h4,h5,h6) {
    color: inherit;
  }

  .popup-manager-image-card .popup-manager-banner {
    position: relative;
    width: 100%;
    max-height: none;
    overflow: hidden;
    flex: 0 0 auto;
    line-height: 0;
    background: #09090b;
  }

  .popup-manager-image-card .popup-manager-banner img {
    display: block;
    width: 100%;
    height: auto;
    max-height: none;
    object-fit: contain;
    object-position: center;
  }

  .popup-manager-banner a,
  .popup-manager-banner .popup-manager-banner-link,
  .popup-manager-image-card .popup-manager-banner a {
    display: block;
    width: 100%;
    height: 100%;
    position: relative;
    text-decoration: none;
    line-height: 0;
  }
  .popup-manager-image-badge {
    position: absolute;
    z-index: 2;
    top: 14px;
    left: 14px;
    padding: 7px 12px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    color: #fff;
    background: rgba(30,41,59,.88);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
  }
  .popup-manager-image-card .popup-manager-image-footer {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    color: #fff;
    background: linear-gradient(180deg, rgba(12,12,15,.94), #09090b);
    border-top: 1px solid rgba(255,255,255,.12);
  }
  .popup-manager-footer-inset-shadow { z-index: 3; }
  .popup-manager-image-card .popup-manager-image-action { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .popup-manager-image-card .popup-manager-clock-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border: 1px solid rgba(255,255,255,.38);
    border-radius: 12px;
    color: #f4f4f5;
    background: rgba(255,255,255,.12);
  }
  .popup-manager-clock-icon svg { width: 22px; height: 22px; }
  .popup-manager-image-action-details { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
  .popup-manager-image-action-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .popup-manager-image-countdown-title { color: #f4f4f5; font-size: 12px; line-height: 1.2; font-weight: 800; text-transform: uppercase; }
  .popup-manager-live-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; height: 22px; padding: 0 8px; box-sizing: border-box; white-space: nowrap; flex: 0 0 auto; border: 1px solid rgba(244,63,94,.55); border-radius: 999px; color: #fb7185; background: rgba(244,63,94,.13); font-size: 9px; font-weight: 800; letter-spacing: .06em; }
  .popup-manager-image-card .popup-manager-cta-btn.popup-manager-image-cta {
    display: inline-flex;
    width: auto;
    gap: 8px;
    padding: 0;
    border-radius: 0;
    background: transparent;
    color: #fff;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 700;
  }
  .popup-manager-image-card .popup-manager-image-cta { display: inline-flex; align-items: center; gap: 7px; color: #fff; text-decoration: none; font-size: 12px; line-height: 1.2; font-weight: 700; }
  .popup-manager-image-card .popup-manager-countdown {
    gap: 5px;
    padding: 0;
    flex: 0 0 auto;
    background: transparent;
    border: 0;
  }
  .popup-manager-image-card .popup-manager-countdown-segment {
    min-width: 40px;
    padding: 7px 6px 5px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    background: linear-gradient(145deg,#242428,#111114);
    box-shadow: inset 0 1px rgba(255,255,255,.08);
  }
  .popup-manager-image-card .popup-manager-countdown-value { color: #fff; font-size: 15px; }
  .popup-manager-image-card .popup-manager-countdown-label {
    display: block;
    height: auto !important;
    min-height: 0 !important;
    margin-top: 1px;
    padding: 0 !important;
    color: #a1a1aa;
    font-size: 8px;
    line-height: 1 !important;
    writing-mode: horizontal-tb !important;
  }
  .popup-manager-image-card .popup-manager-countdown-sep { display: none; }

  /* === Responsive === */
  @media (max-width: 640px) {
    .popup-manager-image-card {
      width: calc(100vw - 24px);
      max-height: none;
    }

    .popup-manager-image-card .popup-manager-banner,
    .popup-manager-image-card .popup-manager-banner img { max-height: none; }

    .popup-manager-image-card .popup-manager-image-footer { gap: 8px; padding: 12px; }
    .popup-manager-image-card .popup-manager-clock-icon { width: 34px; height: 34px; border-radius: 10px; }
    .popup-manager-image-card .popup-manager-image-action { gap: 8px; }
    .popup-manager-image-card .popup-manager-image-countdown-title { font-size: 10px; }
    .popup-manager-image-card .popup-manager-countdown { gap: 3px; }
    .popup-manager-image-card .popup-manager-countdown-segment { min-width: 32px; padding: 6px 4px 4px; border-radius: 9px; }
    .popup-manager-image-card .popup-manager-countdown-value { font-size: 12px; }
    .popup-manager-image-card .popup-manager-countdown-label { font-size: 7px; }

    .popup-manager-position-center,
    .popup-manager-position-middle-center {
      width: calc(100vw - 24px);
      max-height: calc(100vh - 32px);
      max-height: calc(100dvh - 32px);
    }

    .popup-manager-position-bottom-left,
    .popup-manager-position-bottom-right,
    .popup-manager-position-bottom-center,
    .popup-manager-position-top-left,
    .popup-manager-position-top-right,
    .popup-manager-position-top-center,
    .popup-manager-position-middle-left,
    .popup-manager-position-middle-right {
      left: 12px;
      right: 12px;
      bottom: 12px;
      width: calc(100vw - 24px);
      max-width: none;
      transform: none;
    }

    .popup-manager-position-top-left,
    .popup-manager-position-top-right,
    .popup-manager-position-top-center {
      top: 12px;
      bottom: auto;
    }

    .popup-manager-position-middle-left,
    .popup-manager-position-middle-right {
      top: auto;
      bottom: 12px;
      transform: none;
    }
  }

  /* === Side-by-Side (Split) 2-Column Popup Layout === */
  .popup-manager-side-by-side .popup-manager-media-panel,
  .popup-manager-side-by-side-reverse .popup-manager-media-panel {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch !important;
    align-content: stretch !important;
    min-height: 380px !important;
    height: 100% !important;
    flex: 1 1 auto !important;
    width: 100% !important;
  }
  .popup-manager-side-by-side-reverse .popup-manager-media-panel {
    flex-direction: row-reverse !important;
  }
  .popup-manager-side-by-side .popup-manager-banner,
  .popup-manager-side-by-side-reverse .popup-manager-banner {
    flex: 0 0 45% !important;
    width: 45% !important;
    align-self: stretch !important;
    min-height: 0 !important;
    height: auto !important;
    max-height: none !important;
    position: relative !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    display: flex !important;
  }
  .popup-manager-side-by-side .popup-manager-banner a,
  .popup-manager-side-by-side-reverse .popup-manager-banner a,
  .popup-manager-side-by-side .popup-manager-banner .popup-manager-banner-link,
  .popup-manager-side-by-side-reverse .popup-manager-banner .popup-manager-banner-link {
    position: absolute !important;
    inset: 0 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    display: block !important;
    overflow: hidden !important;
    text-decoration: none !important;
  }
  .popup-manager-side-by-side .popup-manager-banner img,
  .popup-manager-side-by-side-reverse .popup-manager-banner img {
    position: absolute !important;
    inset: 0 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    max-height: none !important;
    object-fit: cover !important;
    object-position: center !important;
    display: block !important;
    border-radius: 0 !important;
  }
  .popup-manager-side-by-side .popup-manager-image-badge,
  .popup-manager-side-by-side-reverse .popup-manager-image-badge {
    position: absolute !important;
    z-index: 5 !important;
  }
  .popup-manager-side-by-side .popup-manager-body,
  .popup-manager-side-by-side-reverse .popup-manager-body {
    flex: 1 1 55% !important;
    width: 55% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    padding: 32px 32px !important;
    box-sizing: border-box !important;
  }
  .popup-manager-side-by-side .popup-manager-body .popup-manager-title,
  .popup-manager-side-by-side-reverse .popup-manager-body .popup-manager-title {
    margin: 0 0 12px 0 !important;
    font-size: 22px !important;
    font-weight: 800 !important;
    line-height: 1.25 !important;
  }
  .popup-manager-side-by-side .popup-manager-body .popup-manager-cta-btn,
  .popup-manager-side-by-side-reverse .popup-manager-body .popup-manager-cta-btn {
    margin-top: 14px !important;
    width: 100% !important;
  }
  @media (max-width: 480px) {
    .popup-manager-side-by-side .popup-manager-media-panel,
    .popup-manager-side-by-side-reverse .popup-manager-media-panel {
      flex-direction: column !important;
      min-height: auto !important;
    }
    .popup-manager-side-by-side .popup-manager-banner,
    .popup-manager-side-by-side-reverse .popup-manager-banner {
      flex: 0 0 180px !important;
      width: 100% !important;
      height: 180px !important;
      min-height: 180px !important;
      position: relative !important;
    }
    .popup-manager-side-by-side .popup-manager-banner a,
    .popup-manager-side-by-side-reverse .popup-manager-banner a {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }
    .popup-manager-side-by-side .popup-manager-banner img,
    .popup-manager-side-by-side-reverse .popup-manager-banner img {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
    .popup-manager-side-by-side .popup-manager-body,
    .popup-manager-side-by-side-reverse .popup-manager-body {
      width: 100% !important;
      flex: 1 1 auto !important;
      padding: 24px 20px !important;
    }
  }

  /* === Gamified Wheel Popup Layout === */
  .popup-manager-wheel-card {
    position: relative;
    max-width: 680px;
    width: min(680px, calc(100vw - 24px));
    border-radius: 20px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .popup-manager-wheel-grid {
    display: flex;
    flex-direction: row;
    align-items: center;
    min-height: 390px;
  }

  .popup-manager-wheel-stage {
    flex: 0 0 46%;
    width: 46%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
  }

  .popup-manager-wheel-wrapper {
    position: relative;
    transform: translateX(-34%);
  }

  .popup-manager-wheel-pointer {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    border-left: 24px solid #111827;
    z-index: 30;
    filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.35));
  }

  .popup-manager-wheel-panel {
    flex: 1 1 54%;
    width: 54%;
    padding: 32px 36px 32px 14px;
    box-sizing: border-box;
  }

  .popup-manager-wheel-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    background: rgba(99, 102, 241, 0.12);
    color: #4f46e5;
    margin-bottom: 8px;
  }

  .popup-manager-wheel-title {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 900;
    line-height: 1.2;
  }

  .popup-manager-wheel-body {
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .popup-manager-wheel-input {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 14px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 10px;
    outline: none;
    background: #ffffff;
    color: #1e293b;
  }

  .popup-manager-wheel-input:focus {
    border-color: #6366f1;
  }

  .popup-manager-wheel-spin-btn {
    display: block;
    width: 100%;
    border: none;
    cursor: pointer;
    background: #9bd3f2;
    color: #0f2b48;
    font-weight: 800;
    font-size: 13px;
    text-align: center;
    padding: 12px 18px;
    border-radius: 6px;
    letter-spacing: 1px;
    text-transform: uppercase;
    box-shadow: 0 4px 12px rgba(155, 211, 242, 0.4);
    transition: all 0.2s ease;
  }

  .popup-manager-wheel-spin-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(155, 211, 242, 0.5);
  }

  .popup-manager-wheel-disclaimer {
    text-align: center;
    color: #94a3b8;
    font-size: 10px;
    margin: 10px 0 0;
  }

  /* === Regulatory & Compliance Disclaimer Section === */
  .popup-manager-disclaimer {
    padding: 8px 18px 10px;
    font-size: 10px;
    line-height: 1.45;
    color: #64748b;
    background: rgba(0, 0, 0, 0.03);
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    text-align: center;
    overflow-wrap: anywhere;
    box-sizing: border-box;
    width: 100%;
  }

  .popup-manager-disclaimer a {
    color: inherit;
    text-decoration: underline;
  }

  .popup-manager-disclaimer p {
    margin: 0 0 4px 0;
  }

  .popup-manager-disclaimer p:last-child {
    margin-bottom: 0;
  }

  .popup-manager-image-card .popup-manager-disclaimer,
  .popup-manager-card[style*="#0"] .popup-manager-disclaimer,
  .popup-manager-card[style*="#1"] .popup-manager-disclaimer {
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 480px) {
    .popup-manager-wheel-grid {
      flex-direction: column;
    }
    .popup-manager-wheel-stage {
      width: 100%;
      height: 190px;
      overflow: hidden;
    }
    .popup-manager-wheel-wrapper {
      transform: translateY(-22%);
    }
    .popup-manager-wheel-pointer {
      left: 50%;
      top: 14px;
      transform: translateX(-50%);
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-top: 24px solid #111827;
    }
    .popup-manager-wheel-panel {
      width: 100%;
      padding: 20px;
    }
  }

  /* === Reduced-motion support === */
  @media (prefers-reduced-motion: reduce) {
    .popup-manager-backdrop,
    .popup-manager-wrapper {
      animation: none !important;
      transition: none !important;
    }

    .popup-manager-position-center,
    .popup-manager-position-middle-center {
      transform: translate(-50%, -50%) !important;
    }

    .popup-manager-position-top-center,
    .popup-manager-position-bottom-center {
      transform: translateX(-50%) !important;
    }

    .popup-manager-position-middle-left,
    .popup-manager-position-middle-right {
      transform: translateY(-50%) !important;
    }

    * {
      transition-duration: 0.001ms !important;
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
