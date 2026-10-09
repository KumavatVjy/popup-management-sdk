import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('Running SDK smoke tests...');

// 1. Test IIFE bundle
const iifeCode = fs.readFileSync('dist/popup-manager.min.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(iifeCode, context);

assert(context.PopupManager, 'PopupManager global must be defined in IIFE');
assert.strictEqual(context.PopupManager.version, '0.1.0', 'PopupManager.version must be 0.1.0');
assert.strictEqual(context.PopupManager.SDK_VERSION, '0.1.0', 'PopupManager.SDK_VERSION must be 0.1.0');
console.log('✓ IIFE distribution exposes global PopupManager with correct version');

// 2. Test ESM bundle
const esmModule = await import('../dist/popup-manager.esm.js');
assert(esmModule.PopupManager, 'ESM PopupManager must be exported');
assert.strictEqual(esmModule.SDK_VERSION, '0.1.0', 'ESM SDK_VERSION must be 0.1.0');
assert.strictEqual(esmModule.version, '0.1.0', 'ESM version must be 0.1.0');
assert.strictEqual(esmModule.default.version, '0.1.0', 'ESM default.version must be 0.1.0');
console.log('✓ ESM distribution exports PopupManager and version constants correctly');
console.log('Smoke tests completed successfully!');
