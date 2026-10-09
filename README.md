# Popup Manager JavaScript SDK

A lightweight, zero-dependency browser SDK for delivering, managing, and rendering popups configured in the Popup Management System.

## Architectural Overview

The SDK connects client websites (HTML, WordPress, React, Next.js, etc.) with the Popup Management System backend via the unauthenticated public delivery endpoint:

```http
GET /api/v1/public/popups?website_key={websiteKey}
```

### Key Principles

- **Zero External Host Dependencies**: Pure native Web APIs without framework dependencies (React, jQuery, etc.).
- **Total Style Encapsulation via Shadow DOM**: Popups mount inside `<div id="popup-manager-host-root">` with an open Shadow Root (`attachShadow({ mode: 'open' })`). Styles neither leak into nor bleed out from the host page.
- **Strict HTML Sanitization**: Untrusted popup content is sanitized using DOMPurify with a strict formatting allowlist and safe external link attributes before insertion.
- **Dual Distribution**:
  - `dist/popup-manager.esm.js`: ECMAScript module for modern bundlers and SPA frameworks.
  - `dist/popup-manager.min.js`: Standalone, minified IIFE bundle exposing `window.PopupManager` for direct browser `<script>` tag embedding.
- **Strict Credential Separation**: Runs in untrusted client browsers. Never requires or transmits administrative JWTs, database IDs, or privileged secrets. Only public `websiteKey` strings (`wg_live_...`) are used.

## Configuration & Initialization

Initialize the SDK by calling `PopupManager.init(config)`:

```ts
import PopupManager from 'popup-manager-sdk';

PopupManager.init({
  websiteKey: "wg_live_example",
  apiBaseUrl: "http://localhost:8082",
  autoLoad: true,
  autoShow: true,
  debug: false
});
```

Or via direct browser script tag:

```html
<script src="dist/popup-manager.min.js"></script>
<script>
  PopupManager.init({
    websiteKey: "wg_live_example",
    apiBaseUrl: "http://localhost:8082"
  });
</script>
```

### Configuration Options

| Option | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `websiteKey` | `string` | **Yes** | — | Public website integration key (e.g. `wg_live_...`). Must not be empty or whitespace-only. Leading/trailing whitespace is trimmed. |
| `apiBaseUrl` | `string` | **Yes** | — | Base origin URL of the Popup Management API (e.g. `http://localhost:8082` or `https://api.example.com`). Must be an absolute HTTP or HTTPS URL without credentials, query parameters, or fragments. Trailing slashes are automatically normalized. |
| `autoLoad` | `boolean` | No | `true` | When `true`, initiates background loading asynchronously upon `init()`. When `false`, defers network transport until `load()` or `refresh()` is called. |
| `autoShow` | `boolean` | No | `true` | When `true`, automatically displays the first eligible popup upon successful loading. |
| `debug` | `boolean` | No | `false` | Enables diagnostic console logging without leaking sensitive keys or full request URLs. |

## Runtime Lifecycle States

The SDK tracks internal lifecycle status deterministically via `RuntimeState`:

| State | Description |
| :--- | :--- |
| `UNINITIALIZED` | SDK has not been initialized. |
| `CONFIGURED` | Configuration validated and runtime ready to fetch. |
| `LOADING` | Network fetch and schedule revalidation in progress. |
| `READY` | Successfully loaded one or more eligible popups. |
| `IDLE` | Successfully loaded, but zero eligible popups found. |
| `ERROR` | Latest load or refresh request failed. |
| `DESTROYED` | Runtime resources, active client, and rendered DOM elements released. |

Inspect the current state at any time via `PopupManager.getState()`.

## Public API Methods

### `PopupManager.load(): Promise<PublicPopup[]>`

Fetches active popups from the backend delivery API and revalidates their schedule on the client.

- If `autoShow: true` and eligible popups are returned, displays the first eligible popup.
- On failure, transitions state to `ERROR`, clears retained popups, and rejects the promise.

### `PopupManager.show(popupId?: number): void`

Renders and displays an eligible popup on screen inside the Shadow DOM container.

- If `popupId` is omitted, displays the first eligible popup in the backend ordering.
- If `popupId` is supplied, displays that popup only if it is in the currently loaded eligible list.
- Fails predictably without creating an empty host if no eligible popup is available.

```ts
// Show default first eligible popup
PopupManager.show();

// Show specific popup by ID
PopupManager.show(42);
```

### `PopupManager.hide(): void`

Hides the currently rendered popup, removes its backdrop and keyboard listeners, and clears shadow content. Loaded popup data remains available for future `show()` calls.

```ts
PopupManager.hide();
```

### `PopupManager.refresh(): Promise<PublicPopup[]>`

Performs a fresh network request and re-evaluates popup schedules. Automatically updates or removes any currently rendered popup.

```ts
const freshPopups = await PopupManager.refresh();
```

### `PopupManager.destroy(): void`

Tears down the active runtime session, removes the `#popup-manager-host-root` element from the DOM, and unbinds all listeners.

```ts
PopupManager.destroy();
```

## Supported Positions

The SDK renders popups in four viewport positions:

| Position | Layout & Presentation | Accessibility Semantics |
| :--- | :--- | :--- |
| `center` | Centered modal card with semi-opaque backdrop overlay (`rgba(15, 23, 42, 0.55)`). Responsive max-width (540px) with scrollable body. | `role="dialog"`, `aria-modal="true"`. Backdrop click and `Escape` key dismissal. |
| `top-banner` | Full-width sticky/fixed header banner spanning viewport top. Max height 40vh with scrollable body. | `role="region"`, `aria-label="Promotional banner"`. |
| `bottom-left` | Floating toast card pinned to the lower-left viewport corner (bottom: 24px, left: 24px). | `role="region"`, `aria-label="Promotional notification"`. |
| `bottom-right` | Floating toast card pinned to the lower-right viewport corner (bottom: 24px, right: 24px). | `role="region"`, `aria-label="Promotional notification"`. |

## HTML Security & Sanitization

All popup content is sanitized before injection using DOMPurify against a conservative allowlist:

- **Allowed Tags**: `p`, `br`, `strong`, `b`, `em`, `i`, `ul`, `ol`, `li`, `h1`, `h2`, `h3`, `blockquote`, `a`, `span`.
- **Allowed Attributes**: `href`, `target`, `rel`, `title`, `aria-label`.
- **Neutralized Vectors**: Strips all `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, and `<form>` elements.
- **Event Handlers**: Strips all inline `on*` attributes (`onclick`, `onerror`, `onload`, etc.).
- **URL Safety**: Strips `javascript:` pseudo-protocol URIs. Enforces `rel="noopener noreferrer"` on links opening in `target="_blank"`.

## Development & Testing

```bash
# Install dependencies
npm install

# Type-check TypeScript sources
npm run typecheck

# Run all test suites (configuration, api client, eligibility, runtime, sanitization, renderer, smoke)
npm test

# Build ESM and minified IIFE distributions
npm run build
```

## Build Outputs

- `dist/popup-manager.esm.js` — ESM distribution
- `dist/popup-manager.min.js` — Standalone minified IIFE distribution (`window.PopupManager`)
- `dist/types/` — TypeScript declarations
