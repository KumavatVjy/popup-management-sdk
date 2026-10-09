# Popup Manager JavaScript SDK

A lightweight, zero-dependency browser SDK for delivering, managing, and rendering popups configured in the Popup Management System.

## Architectural Overview

The SDK connects client websites (HTML, WordPress, React, Next.js, etc.) with the Popup Management System backend via the unauthenticated public delivery endpoint:

```http
GET /api/v1/public/popups?website_key={websiteKey}
```

### Key Principles

- **Zero External Runtime Dependencies**: Standalone bundle with minimal footprint.
- **Shadow DOM Isolation**: Popup styles and markup are isolated from host website styles (rendering layer implemented in subsequent lessons).
- **Dual Distribution**:
  - `dist/popup-manager.esm.js`: ECMAScript module for modern bundlers and SPA frameworks.
  - `dist/popup-manager.min.js`: Minified IIFE bundle exposing the global `PopupManager` object for direct browser `<script>` tag embedding.
- **Security**: No administrative credentials, JWT tokens, or internal database identifiers are included or required. Only public `websiteKey` strings (`wg_live_...`) are used.

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
| `autoShow` | `boolean` | No | `true` | Configuration preference for automatic display after loading (rendering deferred to subsequent lessons; does not attempt DOM rendering currently). |
| `debug` | `boolean` | No | `false` | Enables diagnostic console logging without leaking sensitive keys or full request URLs. |

## Runtime Lifecycle & State Machine

The SDK tracks internal lifecycle status deterministically via `RuntimeState`:

| State | Description |
| :--- | :--- |
| `UNINITIALIZED` | SDK has not been initialized. |
| `CONFIGURED` | Configuration validated and runtime ready to fetch. |
| `LOADING` | Network fetch and schedule revalidation in progress. |
| `READY` | Successfully loaded one or more eligible popups. |
| `IDLE` | Successfully loaded, but zero eligible popups found. |
| `ERROR` | Latest load or refresh request failed. |
| `DESTROYED` | Runtime resources, active client, and retained popups released. |

You can inspect the current state via `PopupManager.getState()`.

## API Methods

### `PopupManager.load(): Promise<PublicPopup[]>`

Fetches active popups from the backend delivery API and applies client-side schedule revalidation.

- Transitions state to `LOADING`, then `READY` (if eligible popups remain) or `IDLE` (if none remain).
- On failure, transitions to `ERROR`, clears retained popups to avoid presenting stale data, and rejects the returned promise.
- Request-generation identifiers prevent stale responses from overwriting newer initialization or concurrent requests.

```ts
try {
  const popups = await PopupManager.load();
  console.log(`Retrieved ${popups.length} eligible popup(s)`);
} catch (error) {
  console.error('Failed to load popups:', error.message);
}
```

### `PopupManager.refresh(): Promise<PublicPopup[]>`

Performs a fresh network request and re-evaluates popup schedule windows against the current timestamp.

- Delegates directly to `load()`, returning a fresh array of eligible popups.

```ts
const freshPopups = await PopupManager.refresh();
```

### `PopupManager.destroy(): void`

Tears down the active runtime session, releases references to the API client, clears retained popups, and transitions state to `DESTROYED`. Subsequent calls to `load()` or `refresh()` will reject until `init()` is called again.

```ts
PopupManager.destroy();
```

## Client-Side Schedule Revalidation

While the backend delivery API filters out inactive and out-of-schedule popups, the SDK revalidates schedule timestamps client-side using `filterEligiblePopups()`:

- `start_time === null` and `end_time === null`: Eligible indefinitely.
- `start_time` provided: `start_time <= now` (inclusive).
- `end_time` provided: `end_time >= now` (inclusive).
- Both provided: `start_time <= now <= end_time` and `start_time <= end_time`.
- Unparseable timestamps or inverted date ranges (`start_time > end_time`) are excluded.

### Public Popup Data Model

Each returned `PublicPopup` object conforms to the sanitized delivery contract:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `number` | Numeric identifier of the popup. |
| `title` | `string` | Title of the popup campaign. |
| `content` | `string` | Popup HTML or text body. |
| `position` | `PopupPosition` | Placement (`center`, `top-banner`, `bottom-left`, or `bottom-right`). |
| `start_time` | `string \| null` | Scheduled display start time (ISO 8601) or null. |
| `end_time` | `string \| null` | Scheduled display expiration time (ISO 8601) or null. |

> **Note on Scope**: In Lesson 3D, runtime lifecycle, client-side schedule eligibility, `autoLoad`, `refresh()`, and `destroy()` are implemented. Rendering popups to the DOM, Shadow DOM encapsulation, CSS styling, and user interaction handlers belong to subsequent lessons.

## Development Scripts

```bash
# Install dependencies
npm install

# Type-check TypeScript sources
npm run typecheck

# Run unit, eligibility, lifecycle, and smoke tests
npm test

# Build ESM and minified IIFE distributions
npm run build

# Clean distribution output
npm run clean
```

## Build Outputs

- `dist/popup-manager.esm.js` — ESM distribution
- `dist/popup-manager.min.js` — Minified IIFE distribution (`window.PopupManager`)
- `dist/types/` — TypeScript declarations
