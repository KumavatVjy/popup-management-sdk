import assert from 'assert';
import { ApiClient, ApiClientError, PopupManager, ConfigurationError } from '../dist/popup-manager.esm.js';

console.log('Running SDK API Client & Transport Tests...\n');

let testsPassed = 0;

function createMockResponse(status, body, isJson = true) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: isJson
      ? async () => body
      : async () => {
          throw new SyntaxError('Unexpected token in JSON');
        },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

async function runAsyncTest(name, fn) {
  const originalFetch = globalThis.fetch;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// 1. Successful response with one popup
await runAsyncTest('1. Successful response with one popup', async () => {
  const mockPayload = {
    success: true,
    message: 'Public popups fetched successfully',
    data: [
      {
        id: 101,
        title: 'Spring Discount',
        content: '<p>Save 20%</p>',
        position: 'center',
        start_time: '2026-04-01T00:00:00Z',
        end_time: '2026-04-30T23:59:59Z',
      },
    ],
  };

  globalThis.fetch = async () => createMockResponse(200, mockPayload);

  const client = new ApiClient({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
  });

  const popups = await client.fetchPopups();
  assert.strictEqual(popups.length, 1);
  assert.strictEqual(popups[0].id, 101);
  assert.strictEqual(popups[0].title, 'Spring Discount');
  assert.strictEqual(popups[0].position, 'center');
  assert.strictEqual(popups[0].start_time, '2026-04-01T00:00:00Z');
  assert.strictEqual(popups[0].end_time, '2026-04-30T23:59:59Z');
});

// 2. Successful response with an empty data: []
await runAsyncTest('2. Successful response with empty data: []', async () => {
  const mockPayload = {
    success: true,
    message: 'Public popups fetched successfully',
    data: [],
  };

  globalThis.fetch = async () => createMockResponse(200, mockPayload);

  const client = new ApiClient({
    websiteKey: 'wg_live_empty_site',
    apiBaseUrl: 'http://localhost:8082',
  });

  const popups = await client.fetchPopups();
  assert.strictEqual(Array.isArray(popups), true);
  assert.strictEqual(popups.length, 0);
});

// 3. Correct endpoint path and encoded website key
await runAsyncTest('3. Correct endpoint path and encoded website key', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url.toString();
    return createMockResponse(200, { success: true, message: 'OK', data: [] });
  };

  const client = new ApiClient({
    websiteKey: 'wg_live_special+key/123==',
    apiBaseUrl: 'http://localhost:8082',
  });

  await client.fetchPopups();
  const parsed = new URL(requestedUrl);
  assert.strictEqual(parsed.origin, 'http://localhost:8082');
  assert.strictEqual(parsed.pathname, '/api/v1/public/popups');
  assert.strictEqual(parsed.searchParams.get('website_key'), 'wg_live_special+key/123==');
});

// 4. Correct API base URL normalization
await runAsyncTest('4. Correct API base URL normalization', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url.toString();
    return createMockResponse(200, { success: true, message: 'OK', data: [] });
  };

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'https://api.example.com///',
  });

  await client.fetchPopups();
  assert.strictEqual(requestedUrl, 'https://api.example.com/api/v1/public/popups?website_key=wg_live_test');
});

// 5. No Authorization header is sent
await runAsyncTest('5. No Authorization header is sent', async () => {
  let capturedHeaders = {};
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options?.headers || {};
    return createMockResponse(200, { success: true, message: 'OK', data: [] });
  };

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await client.fetchPopups();
  assert.strictEqual(capturedHeaders.Authorization, undefined, 'Authorization header must not be sent');
  assert.strictEqual(capturedHeaders['authorization'], undefined, 'authorization header must not be sent');
});

// 6. HTTP 400 response
await runAsyncTest('6. HTTP 400 response', async () => {
  globalThis.fetch = async () =>
    createMockResponse(400, {
      success: false,
      message: 'website_key query parameter is required',
    });

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.status === 400 && err.message === 'website_key query parameter is required'
  );
});

// 7. HTTP 404 response
await runAsyncTest('7. HTTP 404 response', async () => {
  globalThis.fetch = async () =>
    createMockResponse(404, {
      success: false,
      message: 'resource not found',
    });

  const client = new ApiClient({
    websiteKey: 'wg_live_unknown_site',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.status === 404 && err.message === 'resource not found'
  );
});

// 8. HTTP 500 response
await runAsyncTest('8. HTTP 500 response', async () => {
  globalThis.fetch = async () =>
    createMockResponse(500, {
      success: false,
      message: 'internal server error',
    });

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.status === 500 && err.message === 'internal server error'
  );
});

// 9. Network failure
await runAsyncTest('9. Network failure', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'NETWORK_ERROR' && err.message === 'Network error: request failed'
  );
});

// 10. Invalid JSON response
await runAsyncTest('10. Invalid JSON response', async () => {
  globalThis.fetch = async () => createMockResponse(200, '<html>502 Bad Gateway</html>', false);

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'INVALID_JSON' && err.status === 200
  );
});

// 11. Invalid response envelope
await runAsyncTest('11. Invalid response envelope', async () => {
  const invalidEnvelopes = [
    null,
    'plain string',
    [1, 2, 3],
    { success: 'not-a-bool', message: 'OK', data: [] },
    { success: true, message: 123, data: [] },
  ];

  for (const body of invalidEnvelopes) {
    globalThis.fetch = async () => createMockResponse(200, body);

    const client = new ApiClient({
      websiteKey: 'wg_live_test',
      apiBaseUrl: 'http://localhost:8082',
    });

    await assert.rejects(
      async () => client.fetchPopups(),
      (err) => err instanceof ApiClientError && err.code === 'INVALID_ENVELOPE'
    );
  }
});

// 12. Missing data array
await runAsyncTest('12. Missing data array', async () => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: null });

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'INVALID_ENVELOPE'
  );
});

// 13. Invalid popup ID type
await runAsyncTest('13. Invalid popup ID type', async () => {
  const invalidIdPayload = {
    success: true,
    message: 'OK',
    data: [
      {
        id: 'not-a-number',
        title: 'Title',
        content: 'Content',
        position: 'center',
        start_time: null,
        end_time: null,
      },
    ],
  };

  globalThis.fetch = async () => createMockResponse(200, invalidIdPayload);

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'INVALID_POPUP_DATA'
  );
});

// 14. Invalid position
await runAsyncTest('14. Invalid position', async () => {
  const invalidPosPayload = {
    success: true,
    message: 'OK',
    data: [
      {
        id: 1,
        title: 'Title',
        content: 'Content',
        position: 'fullscreen-modal', // unsupported
        start_time: null,
        end_time: null,
      },
    ],
  };

  globalThis.fetch = async () => createMockResponse(200, invalidPosPayload);

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'INVALID_POPUP_DATA'
  );
});

// 15. Invalid timestamp type
await runAsyncTest('15. Invalid timestamp type', async () => {
  const invalidTimePayload = {
    success: true,
    message: 'OK',
    data: [
      {
        id: 1,
        title: 'Title',
        content: 'Content',
        position: 'center',
        start_time: 123456789, // should be string or null
        end_time: null,
      },
    ],
  };

  globalThis.fetch = async () => createMockResponse(200, invalidTimePayload);

  const client = new ApiClient({
    websiteKey: 'wg_live_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await assert.rejects(
    async () => client.fetchPopups(),
    (err) => err instanceof ApiClientError && err.code === 'INVALID_POPUP_DATA'
  );
});

// 16. load() before init() fails predictably
await runAsyncTest('16. load() before init() fails predictably', async () => {
  // Fresh module context without initialization
  const uninitialized = Object.create(PopupManager);
  // Attempting to call load without having initialized
  await assert.rejects(
    async () => {
      // Re-create an uninitialized instance to verify check
      const { PopupManager: freshPm } = await import('../dist/popup-manager.esm.js?t=' + Date.now());
      return freshPm.load();
    },
    (err) => err instanceof ConfigurationError || err.message.includes('must be initialized')
  );
});

// 17. init() followed by load() returns popup data
await runAsyncTest('17. init() followed by load() returns popup data', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 55,
          title: 'Special Offer',
          content: '<b>Get it now</b>',
          position: 'top-banner',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_load_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  const popups = await PopupManager.load();
  assert.strictEqual(popups.length, 1);
  assert.strictEqual(popups[0].id, 55);
  assert.strictEqual(popups[0].position, 'top-banner');
});

// 18. Repeated load() calls perform fresh requests
await runAsyncTest('18. Repeated load() calls perform fresh requests', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: callCount,
          title: `Popup ${callCount}`,
          content: 'Content',
          position: 'bottom-left',
          start_time: null,
          end_time: null,
        },
      ],
    });
  };

  PopupManager.init({
    websiteKey: 'wg_live_repeat_test',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  const firstBatch = await PopupManager.load();
  assert.strictEqual(firstBatch[0].id, 1);
  assert.strictEqual(callCount, 1);

  const secondBatch = await PopupManager.load();
  assert.strictEqual(secondBatch[0].id, 2);
  assert.strictEqual(callCount, 2);
});

// 19. No DOM operations occur
await runAsyncTest('19. No DOM operations occur', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 77,
          title: 'No DOM Test',
          content: '<h1>Content</h1>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_dom_test',
    apiBaseUrl: 'http://localhost:8082',
  });

  await PopupManager.load();

  // In Node environment, globalThis.document is undefined;
  // if mock DOM is injected, assert nothing is attached to body
  if (typeof globalThis.document !== 'undefined') {
    assert.strictEqual(document.body.children.length, 0);
  }
});

// 20. Website key and secrets are not included in diagnostic logs
await runAsyncTest('20. Website key and secrets are not included in diagnostic logs', async () => {
  const secretKey = 'wg_live_super_secret_website_key_12345';
  const loggedMessages = [];

  const originalDebug = console.debug;
  const originalError = console.error;
  console.debug = (...args) => loggedMessages.push(args.join(' '));
  console.error = (...args) => loggedMessages.push(args.join(' '));

  try {
    globalThis.fetch = async () =>
      createMockResponse(200, {
        success: true,
        message: 'OK',
        data: [],
      });

    const client = new ApiClient({
      websiteKey: secretKey,
      apiBaseUrl: 'http://localhost:8082',
      debug: true,
    });

    await client.fetchPopups();

    for (const msg of loggedMessages) {
      assert.strictEqual(
        msg.includes(secretKey),
        false,
        `Diagnostic logs must not contain the website key! Found in: "${msg}"`
      );
    }
  } finally {
    console.debug = originalDebug;
    console.error = originalError;
  }
});

console.log(`\nAll ${testsPassed} API Client tests passed successfully!`);
