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

  /* Backdrop Overlay (Center Modal) */
  .popup-manager-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.55);
    z-index: 2147483646;
    backdrop-filter: blur(2px);
    transition: opacity 0.2s ease-in-out;
  }

  /* General Position Container */
  .popup-manager-wrapper {
    z-index: 2147483647;
    pointer-events: auto;
  }

  /* 1. Center Modal */
  .popup-manager-position-center {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100vw - 32px);
    max-width: 540px;
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
  }

  /* 2. Top Banner */
  .popup-manager-position-top-banner {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    max-height: 40vh;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  /* 3. Bottom-Left Card */
  .popup-manager-position-bottom-left {
    position: fixed;
    bottom: 24px;
    left: 24px;
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
  }

  /* 4. Bottom-Right Card */
  .popup-manager-position-bottom-right {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: calc(100vw - 48px);
    max-width: 420px;
    max-height: calc(100vh - 48px);
    box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12);
  }

  /* Popup Card */
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

  /* Close Button */
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
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  /* Header & Title */
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

  /* Content Body */
  .popup-manager-body {
    padding: 8px 24px 24px 24px;
    overflow-y: auto;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #334155;
    flex-grow: 1;
  }

  .popup-manager-position-top-banner .popup-manager-body {
    padding: 4px 52px 14px 20px;
  }

  /* Typography within sanitized content */
  .popup-manager-body p {
    margin: 0 0 12px 0;
  }

  .popup-manager-body p:last-child {
    margin-bottom: 0;
  }

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
  .popup-manager-body h3:first-child {
    margin-top: 0;
  }

  .popup-manager-body a {
    color: #2563eb;
    text-decoration: underline;
    font-weight: 500;
    word-break: break-word;
  }

  .popup-manager-body a:hover {
    color: #1d4ed8;
  }

  .popup-manager-body ul,
  .popup-manager-body ol {
    margin: 0 0 12px 0;
    padding-left: 20px;
  }

  .popup-manager-body li {
    margin-bottom: 4px;
  }

  .popup-manager-body blockquote {
    margin: 0 0 12px 0;
    padding-left: 12px;
    border-left: 3px solid #cbd5e1;
    color: #64748b;
    font-style: italic;
  }

  /* Responsive layout adjustments for small viewports */
  @media (max-width: 640px) {
    .popup-manager-position-center {
      width: calc(100vw - 24px);
      max-height: calc(100vh - 32px);
    }

    .popup-manager-position-bottom-left,
    .popup-manager-position-bottom-right {
      left: 12px;
      right: 12px;
      bottom: 12px;
      width: calc(100vw - 24px);
      max-width: none;
    }
  }
`;
