import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('Running SDK smoke tests...');

// 1. Test IIFE bundle
const iifeCode = fs.readFileSync('dist/popup-manager.min.js', 'utf8');
const context = { URL: globalThis.URL };
vm.createContext(context);
vm.runInContext(iifeCode, context);

assert(context.PopupManager, 'PopupManager global must be defined in IIFE');
assert.strictEqual(context.PopupManager.version, '0.1.0', 'PopupManager.version must be 0.1.0');
assert.strictEqual(context.PopupManager.SDK_VERSION, '0.1.0', 'PopupManager.SDK_VERSION must be 0.1.0');
assert.strictEqual(typeof context.PopupManager.init, 'function', 'PopupManager.init must be a function in IIFE');

// Verify calling init() in IIFE context succeeds
context.PopupManager.init({
  websiteKey: 'wg_live_iife_smoke',
  apiBaseUrl: 'http://localhost:8082',
});

// Verify invalid config throws in IIFE context
assert.throws(() => {
  context.PopupManager.init({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' });
});

console.log('✓ IIFE distribution exposes global PopupManager with correct version and functioning init()');

// 2. Test ESM bundle
const esmModule = await import('../dist/popup-manager.esm.js');
assert(esmModule.PopupManager, 'ESM PopupManager must be exported');
assert.strictEqual(esmModule.SDK_VERSION, '0.1.0', 'ESM SDK_VERSION must be 0.1.0');
assert.strictEqual(esmModule.version, '0.1.0', 'ESM version must be 0.1.0');
assert.strictEqual(esmModule.default.version, '0.1.0', 'ESM default.version must be 0.1.0');
assert.strictEqual(typeof esmModule.PopupManager.init, 'function', 'ESM PopupManager.init must be a function');
assert(esmModule.ConfigurationError, 'ESM ConfigurationError must be exported');

// Verify calling init() in ESM succeeds
esmModule.PopupManager.init({
  websiteKey: 'wg_live_esm_smoke',
  apiBaseUrl: 'https://api.example.com',
  autoShow: false,
});

// Verify invalid config throws in ESM
assert.throws(() => {
  esmModule.PopupManager.init({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' });
});

console.log('✓ ESM distribution exports PopupManager, version constants, ConfigurationError, and functioning init()');
console.log('Smoke tests completed successfully!');
