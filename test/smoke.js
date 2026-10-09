import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('Running SDK smoke tests...');

const mockPayload = {
  success: true,
  message: 'Public popups fetched successfully',
  data: [
    {
      id: 1,
      title: 'Smoke Test Popup',
      content: '<p>Smoke Test Content</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ],
};

function createMockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

// 1. Test IIFE bundle
const iifeCode = fs.readFileSync('dist/popup-manager.min.js', 'utf8');
const context = {
  URL: globalThis.URL,
  fetch: async () => createMockResponse(200, mockPayload),
};
vm.createContext(context);
vm.runInContext(iifeCode, context);

assert(context.PopupManager, 'PopupManager global must be defined in IIFE');
assert.strictEqual(context.PopupManager.version, '0.1.0', 'PopupManager.version must be 0.1.0');
assert.strictEqual(context.PopupManager.SDK_VERSION, '0.1.0', 'PopupManager.SDK_VERSION must be 0.1.0');
assert.strictEqual(typeof context.PopupManager.init, 'function', 'PopupManager.init must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.load, 'function', 'PopupManager.load must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.refresh, 'function', 'PopupManager.refresh must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.show, 'function', 'PopupManager.show must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.hide, 'function', 'PopupManager.hide must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.destroy, 'function', 'PopupManager.destroy must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.getState, 'function', 'PopupManager.getState must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.on, 'function', 'PopupManager.on must be a function in IIFE');
assert.strictEqual(typeof context.PopupManager.off, 'function', 'PopupManager.off must be a function in IIFE');

// Verify calling init() in IIFE context succeeds
context.PopupManager.init({
  websiteKey: 'wg_live_iife_smoke',
  apiBaseUrl: 'http://localhost:8082',
  autoLoad: false,
});

assert.strictEqual(context.PopupManager.getState(), 'CONFIGURED');

// Verify calling load() in IIFE context returns popups
const iifePopups = await context.PopupManager.load();
assert.strictEqual(iifePopups.length, 1);
assert.strictEqual(iifePopups[0].title, 'Smoke Test Popup');
assert.strictEqual(context.PopupManager.getState(), 'READY');

// Verify refresh() in IIFE context
const refreshedPopups = await context.PopupManager.refresh();
assert.strictEqual(refreshedPopups.length, 1);

// Verify destroy() in IIFE context
context.PopupManager.destroy();
assert.strictEqual(context.PopupManager.getState(), 'DESTROYED');

// Verify invalid config throws in IIFE context
assert.throws(() => {
  context.PopupManager.init({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' });
});

console.log('✓ IIFE distribution exposes global PopupManager with functioning init(), load(), refresh(), destroy()');

// 2. Test ESM bundle
const esmModule = await import('../dist/popup-manager.esm.js');
assert(esmModule.PopupManager, 'ESM PopupManager must be exported');
assert.strictEqual(esmModule.SDK_VERSION, '0.1.0', 'ESM SDK_VERSION must be 0.1.0');
assert.strictEqual(esmModule.version, '0.1.0', 'ESM version must be 0.1.0');
assert.strictEqual(esmModule.default.version, '0.1.0', 'ESM default.version must be 0.1.0');
assert.strictEqual(typeof esmModule.PopupManager.init, 'function', 'ESM PopupManager.init must be a function');
assert.strictEqual(typeof esmModule.PopupManager.load, 'function', 'ESM PopupManager.load must be a function');
assert.strictEqual(typeof esmModule.PopupManager.refresh, 'function', 'ESM PopupManager.refresh must be a function');
assert.strictEqual(typeof esmModule.PopupManager.show, 'function', 'ESM PopupManager.show must be a function');
assert.strictEqual(typeof esmModule.PopupManager.hide, 'function', 'ESM PopupManager.hide must be a function');
assert.strictEqual(typeof esmModule.PopupManager.destroy, 'function', 'ESM PopupManager.destroy must be a function');
assert.strictEqual(typeof esmModule.PopupManager.getState, 'function', 'ESM PopupManager.getState must be a function');
assert.strictEqual(typeof esmModule.PopupManager.on, 'function', 'ESM PopupManager.on must be a function');
assert.strictEqual(typeof esmModule.PopupManager.off, 'function', 'ESM PopupManager.off must be a function');
assert.strictEqual(typeof esmModule.load, 'function', 'ESM load named export must be a function');
assert.strictEqual(typeof esmModule.refresh, 'function', 'ESM refresh named export must be a function');
assert.strictEqual(typeof esmModule.show, 'function', 'ESM show named export must be a function');
assert.strictEqual(typeof esmModule.hide, 'function', 'ESM hide named export must be a function');
assert.strictEqual(typeof esmModule.destroy, 'function', 'ESM destroy named export must be a function');
assert.strictEqual(typeof esmModule.getState, 'function', 'ESM getState named export must be a function');
assert.strictEqual(typeof esmModule.on, 'function', 'ESM on named export must be a function');
assert.strictEqual(typeof esmModule.off, 'function', 'ESM off named export must be a function');
assert.strictEqual(typeof esmModule.EventEmitter, 'function', 'ESM EventEmitter must be exported');
assert.strictEqual(typeof esmModule.filterEligiblePopups, 'function', 'ESM filterEligiblePopups must be exported');
assert.strictEqual(typeof esmModule.sanitizeHtml, 'function', 'ESM sanitizeHtml must be exported');
assert.strictEqual(typeof esmModule.PopupRenderer, 'function', 'ESM PopupRenderer must be exported');
assert.strictEqual(typeof esmModule.HOST_ELEMENT_ID, 'string', 'ESM HOST_ELEMENT_ID must be exported');
assert(esmModule.ConfigurationError, 'ESM ConfigurationError must be exported');
assert(esmModule.ApiClient, 'ESM ApiClient must be exported');
assert(esmModule.ApiClientError, 'ESM ApiClientError must be exported');
assert(esmModule.RuntimeStates, 'ESM RuntimeStates must be exported');

globalThis.fetch = async () => createMockResponse(200, mockPayload);

// Verify calling init() and load() in ESM succeeds
esmModule.PopupManager.init({
  websiteKey: 'wg_live_esm_smoke',
  apiBaseUrl: 'https://api.example.com',
  autoLoad: false,
  autoShow: false,
});

assert.strictEqual(esmModule.PopupManager.getState(), 'CONFIGURED');

const esmPopups = await esmModule.PopupManager.load();
assert.strictEqual(esmPopups.length, 1);
assert.strictEqual(esmPopups[0].id, 1);
assert.strictEqual(esmModule.PopupManager.getState(), 'READY');

const esmRefreshed = await esmModule.PopupManager.refresh();
assert.strictEqual(esmRefreshed.length, 1);

esmModule.PopupManager.destroy();
assert.strictEqual(esmModule.PopupManager.getState(), 'DESTROYED');

// Verify invalid config throws in ESM
assert.throws(() => {
  esmModule.PopupManager.init({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' });
});

console.log('✓ ESM distribution exports PopupManager with functioning lifecycle methods');
console.log('Smoke tests completed successfully!');
