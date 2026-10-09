# Popup Manager JavaScript SDK

A lightweight, zero-dependency browser SDK for delivering, managing, and rendering popups configured in the Popup Management System.

## Architectural Overview

The SDK connects client websites (HTML, WordPress, React, Next.js, etc.) with the Popup Management System backend via the unauthenticated public delivery endpoint:

```http
GET /api/v1/public/popups?website_key={websiteKey}
```

### Key Principles

- **Zero External Runtime Dependencies**: Standalone bundle with minimal footprint.
- **Shadow DOM Isolation**: Popup styles and markup are isolated from host website styles.
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
| `autoLoad` | `boolean` | No | `true` | Whether to automatically fetch eligible popups upon initialization. |
| `autoShow` | `boolean` | No | `true` | Whether to automatically display eligible popups after loading. |
| `debug` | `boolean` | No | `false` | Enables verbose diagnostic logging for troubleshooting. |

## Loading Popups

Retrieve eligible, active popups from the backend using `PopupManager.load()`:

```ts
// After PopupManager.init(...)
try {
  const popups = await PopupManager.load();
  console.log(`Retrieved ${popups.length} eligible popup(s)`);
} catch (error) {
  console.error('Failed to load popups:', error.message);
}
```

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

> **Note on Current Scope**: In Lesson 3C, `PopupManager.load()` performs network transport, error normalization, and response validation. Rendering popups to the DOM, Shadow DOM encapsulation, scheduling evaluation, and trigger listeners belong to subsequent lessons.

## Development Scripts

```bash
# Install dependencies
npm install

# Type-check TypeScript sources
npm run typecheck

# Run configuration unit and smoke tests
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
