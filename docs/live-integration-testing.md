# Live End-to-End Integration Testing Guide

This document records the procedure and verified results for live browser and backend end-to-end integration testing of the **Popup Manager JavaScript SDK** with the Go backend.

---

## 1. Prerequisites & Environment Setup

- **Go Backend Repository**: `D:\popup-management-system\popup-manager-api`
- **JavaScript SDK Repository**: `D:\popup-management-system\popup-manager-sdk`
- **Database**: Local MySQL running on `127.0.0.1:3306` with database `popup_management`
- **SDK Static Server**: Python HTTP server running on `http://localhost:5173`
- **Go API Server**: Gin HTTP server running on `http://localhost:8082`

---

## 2. Starting the Backend & Configuring CORS

### A. CORS Configuration
In `popup-manager-api/.env`, ensure the SDK testing origin is explicitly registered in `PUBLIC_CORS_ALLOWED_ORIGINS`:

```env
PUBLIC_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
```

### B. Starting the Go API Server
From `D:\popup-management-system\popup-manager-api`:

```powershell
go run cmd/server/main.go
```

Verify that the server starts on port `8082`:
```powershell
curl http://localhost:8082/
# Expected: {"message":"Popup Management API","success":true,"version":"v1"}
```

---

## 3. Serving the SDK Test Pages

From `D:\popup-management-system\popup-manager-sdk`:

```powershell
python -m http.server 5173
```

Test pages are available at:
- `http://localhost:5173/smoke-test.html` (Interactive harness using standalone IIFE bundle with input form)
- `http://localhost:5173/esm-test.html` (Interactive browser verification harness using ESM bundle with configurable form)

---

## 4. Test Data Creation & Website Key Retrieval

### Creating Dedicated Test Records
Create isolated test records in the local database:

1. **Website Record**: A dedicated test site associated with a secure public key `wg_live_<placeholder>`.
2. **Popup Records**:
   - Active popup within scheduled window (`start_time < NOW() < end_time`).
   - Active popup with open schedule (`start_time = NULL`, `end_time = NULL`).
   - Inactive popup (`status = 0`).
   - Future-scheduled popup (`start_time > NOW()`).
   - Expired popup (`end_time < NOW()`).
   - Different website tenant popup (verifying tenant isolation).

### Secure Key Handling
- Never hardcode or commit real or stale website keys in test harnesses (`esm-test.html`, `smoke-test.html`).
- Operators enter their own active website key into the form on test pages; keys are never stored in localStorage, cookies, or printed to diagnostic logs.
- Public delivery requests access popups exclusively through `GET /api/v1/public/popups?website_key={key}`.

---

## 5. Live E2E Integration Test Scenarios & Results

| Test Scenario | Description | Target | Result | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **1. Public Delivery API Contract** | Verifies unauthenticated delivery endpoint returns documented envelope and only eligible public DTO fields. | Go API (`:8082`) | **PASS** | Returns `200 OK` with sanitized fields (`id`, `title`, `content`, `position`, `start_time`, `end_time`). |
| **2. Server Eligibility Filtering** | Confirms inactive, future-scheduled, expired, and foreign-tenant popups are excluded. | Go API (`:8082`) | **PASS** | Only active eligible popups (IDs 901 and 902) returned for site 999. Inactive (903), future (904), expired (905), and tenant beta (906) excluded. |
| **3. Tenant Isolation** | Confirms tenant beta popups are returned only when tenant beta website key is supplied. | Go API (`:8082`) | **PASS** | Query with beta key returned exclusively popup 906. |
| **4. CORS Policy Enforcement** | Allowed origin receives `Access-Control-Allow-Origin: http://localhost:5173`; disallowed origin does not. | Go API (`:8082`) | **PASS** | Validated via `curl -H "Origin: ..."` for both allowed and disallowed origins, including `OPTIONS` preflight handling. |
| **5. IIFE Browser Auto-Load & Auto-Show** | Validates `autoLoad: true` and `autoShow: true` automatically fetches and mounts banner. | Browser (`smoke-test.html`) | **PASS** | Verified in real browser. Banner mounted automatically into Shadow DOM upon initialization. |
| **6. IIFE Browser Manual Control** | Validates explicit `init()`, `load()`, `show()`, `hide()`, `refresh()`, and `destroy()`. | Browser (`smoke-test.html`) | **PASS** | State transitions `CONFIGURED` -> `READY` -> `DESTROYED` confirmed in live DOM. |
| **7. Close Button & Escape Dismissal** | Validates clicking close button and pressing Escape dismisses popup and emits events. | Browser (`smoke-test.html`) | **PASS** | `[popup:closed]` with reasons `'close-button'` and `'escape'` followed by `[popup:hidden]` observed. |
| **8. ESM Module Browser Integration** | Imports `/dist/popup-manager.esm.js` natively in a browser `<script type="module">`. | Browser (`esm-test.html`) | **PASS** | Successfully initialized, loaded, displayed modal 901, and tore down in live browser. |
| **9. HTML Sanitization** | Ensures popup content inside Shadow DOM is sanitized via bundled DOMPurify. | Browser | **PASS** | Allowed tags (`h2`, `p`, `strong`, `a`) rendered cleanly without inline scripts or event handlers. |
| **10. Shadow DOM Encapsulation** | Confirms host styles are isolated from `#popup-manager-host-root`. | Browser | **PASS** | Shadow root `mode: open` verified; styles remain scoped inside `<style>` element. |

---

## 6. Cleanup

After testing is completed:
1. Stop background development processes (Go server, Python HTTP server).
2. Clean up dedicated test records from the database if desired:
   ```sql
   DELETE FROM popups WHERE id >= 901;
   DELETE FROM websites WHERE id >= 998;
   ```
3. Revert any local testing additions from `.env`.
