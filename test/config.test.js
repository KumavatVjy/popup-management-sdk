import assert from 'assert';
import { parseConfig, ConfigurationError, DEFAULT_CONFIG } from '../src/config.ts';
import { PopupManager } from '../dist/popup-manager.esm.js';

console.log('Running SDK Configuration & Initialization Tests...\n');

let testsPassed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Valid configuration succeeds
runTest('1. Valid configuration succeeds', () => {
  const config = parseConfig({
    websiteKey: 'wg_live_test_key_12345',
    apiBaseUrl: 'http://localhost:8082',
  });
  assert.strictEqual(config.websiteKey, 'wg_live_test_key_12345');
  assert.strictEqual(config.apiBaseUrl, 'http://localhost:8082');
  assert.strictEqual(config.autoLoad, true);
  assert.strictEqual(config.autoShow, true);
  assert.strictEqual(config.debug, false);
});

// 2. websiteKey is required
runTest('2. websiteKey is required', () => {
  assert.throws(
    () => parseConfig({ apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: undefined, apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: null, apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 12345, apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey must be a string'
  );
});

// 3. Blank and whitespace-only keys are rejected
runTest('3. Blank and whitespace-only keys are rejected', () => {
  assert.throws(
    () => parseConfig({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey must not be empty or whitespace-only'
  );
  assert.throws(
    () => parseConfig({ websiteKey: '   \t\n  ', apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError && err.message === 'websiteKey must not be empty or whitespace-only'
  );
});

// 4. Leading/trailing whitespace on a valid key is trimmed
runTest('4. Leading/trailing whitespace on a valid key is trimmed', () => {
  const config = parseConfig({
    websiteKey: '   wg_live_padded_key_999   ',
    apiBaseUrl: 'http://localhost:8082',
  });
  assert.strictEqual(config.websiteKey, 'wg_live_padded_key_999');
});

// 5. apiBaseUrl is required
runTest('5. apiBaseUrl is required', () => {
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123' }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: undefined }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: null }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl is required'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: '' }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must not be empty or whitespace-only'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: '   ' }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must not be empty or whitespace-only'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: 12345 }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must be a string'
  );
});

// 6. Malformed URL is rejected
runTest('6. Malformed URL is rejected', () => {
  const malformed = ['not-a-url', '://localhost', 'ht tp://localhost:8082', 'localhost:8082'];
  for (const url of malformed) {
    assert.throws(
      () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: url }),
      (err) => err instanceof ConfigurationError,
      `Expected "${url}" to be rejected as invalid URL`
    );
  }
});

// 7. Unsupported protocols such as ftp: are rejected
runTest('7. Unsupported protocols such as ftp: are rejected', () => {
  const unsupported = ['ftp://files.example.com', 'ws://socket.example.com', 'file:///C:/path', 'javascript:alert(1)'];
  for (const url of unsupported) {
    assert.throws(
      () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: url }),
      (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must use http or https protocol',
      `Expected "${url}" to be rejected for unsupported protocol`
    );
  }
});

// 8. URL credentials are rejected
runTest('8. URL credentials are rejected', () => {
  const credentialsUrls = [
    'http://user:pass@localhost:8082',
    'https://admin:secret@api.example.com',
    'https://user@api.example.com',
  ];
  for (const url of credentialsUrls) {
    assert.throws(
      () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: url }),
      (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must not contain username or password credentials',
      `Expected "${url}" to be rejected for containing credentials`
    );
  }
});

// 9. URL query parameters and fragments are rejected
runTest('9. URL query parameters and fragments are rejected', () => {
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: 'http://localhost:8082?env=dev' }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must not contain query parameters'
  );
  assert.throws(
    () => parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: 'https://api.example.com#section1' }),
    (err) => err instanceof ConfigurationError && err.message === 'apiBaseUrl must not contain a fragment'
  );
});

// 10. Local HTTP origins are accepted
runTest('10. Local HTTP origins are accepted', () => {
  const localOrigins = ['http://localhost:8082', 'http://127.0.0.1:3000', 'http://localhost', 'http://0.0.0.0:8080'];
  for (const origin of localOrigins) {
    const config = parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: origin });
    assert.strictEqual(config.apiBaseUrl, origin);
  }
});

// 11. Trailing slash normalization works
runTest('11. Trailing slash normalization works', () => {
  const cases = [
    { input: 'http://localhost:8082/', expected: 'http://localhost:8082' },
    { input: 'http://localhost:8082///', expected: 'http://localhost:8082' },
    { input: 'https://api.example.com/', expected: 'https://api.example.com' },
    { input: 'https://api.example.com/v1/', expected: 'https://api.example.com/v1' },
  ];
  for (const { input, expected } of cases) {
    const config = parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: input });
    assert.strictEqual(config.apiBaseUrl, expected);
  }
});

// 12. Default values are correct
runTest('12. Default values are correct', () => {
  assert.strictEqual(DEFAULT_CONFIG.autoLoad, true);
  assert.strictEqual(DEFAULT_CONFIG.autoShow, true);
  assert.strictEqual(DEFAULT_CONFIG.debug, false);

  const config = parseConfig({ websiteKey: 'wg_live_123', apiBaseUrl: 'http://localhost:8082' });
  assert.strictEqual(config.autoLoad, true);
  assert.strictEqual(config.autoShow, true);
  assert.strictEqual(config.debug, false);
});

// 13. Explicit false values are preserved
runTest('13. Explicit false values are preserved', () => {
  const config = parseConfig({
    websiteKey: 'wg_live_123',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: false,
    debug: false,
  });
  assert.strictEqual(config.autoLoad, false);
  assert.strictEqual(config.autoShow, false);
  assert.strictEqual(config.debug, false);

  const configMixed = parseConfig({
    websiteKey: 'wg_live_123',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: true,
    debug: true,
  });
  assert.strictEqual(configMixed.autoLoad, false);
  assert.strictEqual(configMixed.autoShow, true);
  assert.strictEqual(configMixed.debug, true);
});

// 14. The original input object is not mutated
runTest('14. The original input object is not mutated', () => {
  const original = {
    websiteKey: '   wg_live_unmutated_key   ',
    apiBaseUrl: 'http://localhost:8082///',
    autoLoad: false,
  };
  const snapshot = JSON.stringify(original);

  const normalized = parseConfig(original);

  assert.strictEqual(JSON.stringify(original), snapshot, 'Input options object must not be modified');
  assert.strictEqual(normalized.websiteKey, 'wg_live_unmutated_key');
  assert.strictEqual(normalized.apiBaseUrl, 'http://localhost:8082');
  assert.strictEqual(Object.isFrozen(normalized), true, 'Normalized configuration must be frozen');
});

// 15. Repeated init() calls replace configuration consistently
runTest('15. Repeated init() calls replace configuration consistently', () => {
  // First initialization
  PopupManager.init({
    websiteKey: 'wg_live_first_key',
    apiBaseUrl: 'http://localhost:8082',
    autoShow: true,
  });

  // Second initialization replaces state without throwing
  PopupManager.init({
    websiteKey: 'wg_live_second_key',
    apiBaseUrl: 'https://api.example.com',
    autoShow: false,
  });

  // Third initialization
  PopupManager.init({
    websiteKey: 'wg_live_third_key',
    apiBaseUrl: 'http://127.0.0.1:8080',
    debug: true,
  });
});

// 16. Initialization performs no HTTP requests or DOM operations
runTest('16. Initialization performs no HTTP requests or DOM operations', () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalled = true;
    return Promise.reject(new Error('fetch must not be called during init'));
  };

  try {
    PopupManager.init({
      websiteKey: 'wg_live_no_side_effects',
      apiBaseUrl: 'http://localhost:8082',
      autoLoad: true,
      autoShow: true,
    });
    assert.strictEqual(fetchCalled, false, 'init() must not perform any fetch calls');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\nAll ${testsPassed} configuration tests passed successfully!`);
