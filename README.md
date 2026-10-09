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

## Current Project Status

- **Phase 3 — Lesson 3A: Project Setup & Build Pipeline** (Active)
- Core project configuration, strict TypeScript baseline, and dual Rollup build pipeline established.
- Runtime methods (`init`, `load`, `show`, `hide`, etc.) will be incrementally implemented in upcoming lessons.

## Development Scripts

```bash
# Install dependencies
npm install

# Type-check TypeScript sources
npm run typecheck

# Build ESM and minified IIFE distributions
npm run build

# Clean distribution output
npm run clean
```

## Build Outputs

- `dist/popup-manager.esm.js` — ESM distribution
- `dist/popup-manager.min.js` — Minified IIFE distribution (`window.PopupManager`)
- `dist/types/` — TypeScript declarations
