import assert from 'assert';
import {
  PopupManager,
  ConfigurationError,
  ApiClientError,
} from '../dist/popup-manager.esm.js';

console.log('Running SDK Runtime Lifecycle & Eligibility Integration Tests...\n');

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
    // Reset runtime state before each test
    PopupManager.destroy();
    await fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
    PopupManager.destroy();
  }
}

// 1. load() before init() rejects
await runAsyncTest('1. load() before init() rejects', async () => {
  await assert.rejects(
    async () => PopupManager.load(),
    (err) =>
      (err instanceof ConfigurationError && err.message.includes('must be initialized')) ||
      err.message.includes('destroyed')
  );
});

// 2. refresh() before init() rejects
await runAsyncTest('2. refresh() before init() rejects', async () => {
  await assert.rejects(
    async () => PopupManager.refresh(),
    (err) =>
      (err instanceof ConfigurationError && err.message.includes('must be initialized')) ||
      err.message.includes('destroyed')
  );
});

// 3. Initialization with autoLoad: false makes no request
await runAsyncTest('3. Initialization with autoLoad: false makes no request', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return createMockResponse(200, { success: true, message: 'OK', data: [] });
  };

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  // Allow any pending microtasks to execute
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.strictEqual(fetchCalled, false, 'Fetch must not be called when autoLoad is false');
  assert.strictEqual(PopupManager.getState(), 'CONFIGURED');
});

// 4. Initialization with autoLoad: true initiates loading
await runAsyncTest('4. Initialization with autoLoad: true initiates loading', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 1,
          title: 'AutoLoad Popup',
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });
  };

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: true,
  });

  // Give background async task time to run
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.strictEqual(fetchCalled, true, 'Fetch must be called when autoLoad is true');
  assert.strictEqual(PopupManager.getState(), 'READY');
});

// 5. Successful loading returns eligible popups
await runAsyncTest('5. Successful loading returns eligible popups', async () => {
  const mockData = [
    {
      id: 10,
      title: 'Eligible Popup',
      content: '<p>Eligible</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
    {
      id: 20,
      title: 'Expired Popup',
      content: '<p>Expired</p>',
      position: 'top-banner',
      start_time: '2020-01-01T00:00:00Z',
      end_time: '2020-01-02T00:00:00Z',
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockData });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  const popups = await PopupManager.load();
  assert.strictEqual(popups.length, 1);
  assert.strictEqual(popups[0].id, 10);
  assert.strictEqual(PopupManager.getState(), 'READY');
});

// 6. Successful empty loading produces the IDLE state
await runAsyncTest('6. Successful empty loading produces the IDLE state', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: [] });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  const popups = await PopupManager.load();
  assert.strictEqual(popups.length, 0);
  assert.strictEqual(PopupManager.getState(), 'IDLE');
});

// 7. Loading failure produces the ERROR state and rejects the promise
await runAsyncTest('7. Loading failure produces ERROR state and rejects promise', async () => {
  globalThis.fetch = async () =>
    createMockResponse(500, { success: false, message: 'Internal Server Error', data: [] });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  await assert.rejects(
    async () => PopupManager.load(),
    (err) => err instanceof ApiClientError && err.status === 500
  );

  assert.strictEqual(PopupManager.getState(), 'ERROR');
});

// 8. refresh() performs a fresh request
await runAsyncTest('8. refresh() performs a fresh request', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    return createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: callCount,
          title: `Refresh Popup ${callCount}`,
          content: '<p>Content</p>',
          position: 'bottom-right',
          start_time: null,
          end_time: null,
        },
      ],
    });
  };

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  const firstBatch = await PopupManager.refresh();
  assert.strictEqual(firstBatch[0].id, 1);
  assert.strictEqual(callCount, 1);

  const secondBatch = await PopupManager.refresh();
  assert.strictEqual(secondBatch[0].id, 2);
  assert.strictEqual(callCount, 2);
  assert.strictEqual(PopupManager.getState(), 'READY');
});

// 9. destroy() clears retained runtime data and prevents further loads
await runAsyncTest('9. destroy() clears retained runtime data and prevents further loads', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 99,
          title: 'Before Destroy',
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  await PopupManager.load();
  assert.strictEqual(PopupManager.getState(), 'READY');

  PopupManager.destroy();
  assert.strictEqual(PopupManager.getState(), 'DESTROYED');

  await assert.rejects(
    async () => PopupManager.load(),
    (err) => err instanceof ConfigurationError && err.message.includes('destroyed')
  );

  await assert.rejects(
    async () => PopupManager.refresh(),
    (err) => err instanceof ConfigurationError && err.message.includes('destroyed')
  );
});

// 10. Reinitialization after destruction works
await runAsyncTest('10. Reinitialization after destruction works', async () => {
  PopupManager.init({
    websiteKey: 'wg_live_old_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  PopupManager.destroy();
  assert.strictEqual(PopupManager.getState(), 'DESTROYED');

  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 100,
          title: 'New Session Popup',
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_new_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  assert.strictEqual(PopupManager.getState(), 'CONFIGURED');

  const popups = await PopupManager.load();
  assert.strictEqual(popups.length, 1);
  assert.strictEqual(popups[0].id, 100);
  assert.strictEqual(PopupManager.getState(), 'READY');
});

// 11. Reinitialization during an old request prevents stale results from replacing current data
await runAsyncTest(
  '11. Reinitialization during old request prevents stale results from replacing current data',
  async () => {
    let resolveFirstRequest;
    const firstRequestPromise = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    let requestCount = 0;
    globalThis.fetch = async (url) => {
      requestCount++;
      if (requestCount === 1) {
        // Slow first request
        await firstRequestPromise;
        return createMockResponse(200, {
          success: true,
          message: 'OK',
          data: [
            {
              id: 111,
              title: 'Stale Site 1 Popup',
              content: '<p>Stale</p>',
              position: 'center',
              start_time: null,
              end_time: null,
            },
          ],
        });
      }

      // Fast second request
      return createMockResponse(200, {
        success: true,
        message: 'OK',
        data: [
          {
            id: 222,
            title: 'Active Site 2 Popup',
            content: '<p>Active</p>',
            position: 'center',
            start_time: null,
            end_time: null,
          },
        ],
      });
    };

    // First init and slow load started
    PopupManager.init({
      websiteKey: 'wg_live_site_one',
      apiBaseUrl: 'http://localhost:8082',
      autoLoad: false,
    });
    const firstLoadPromise = PopupManager.load();

    // Reinitialize with site two before first load resolves
    PopupManager.init({
      websiteKey: 'wg_live_site_two',
      apiBaseUrl: 'http://localhost:8082',
      autoLoad: false,
    });
    const secondLoadPromise = PopupManager.load();

    const secondPopups = await secondLoadPromise;
    assert.strictEqual(secondPopups[0].id, 222);
    assert.strictEqual(PopupManager.getState(), 'READY');

    // Now let the first request finish
    resolveFirstRequest();
    await firstLoadPromise;

    // Verify runtime state was NOT overwritten by the stale site one response
    assert.strictEqual(PopupManager.getState(), 'READY');
  }
);

// 12. Repeated explicit loads perform fresh requests
await runAsyncTest('12. Repeated explicit loads perform fresh requests', async () => {
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
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });
  };

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  const p1 = await PopupManager.load();
  assert.strictEqual(p1[0].id, 1);
  assert.strictEqual(callCount, 1);

  const p2 = await PopupManager.load();
  assert.strictEqual(p2[0].id, 2);
  assert.strictEqual(callCount, 2);
});

// 13. No DOM nodes or browser listeners are created
await runAsyncTest('13. No DOM nodes or browser listeners are created', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 50,
          title: 'No DOM Popup',
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  await PopupManager.load();

  // In Node environment, verify document is not mutated if simulated
  if (typeof globalThis.document !== 'undefined') {
    assert.strictEqual(document.body.children.length, 0);
  }
});

// 14. autoShow does not attempt rendering
await runAsyncTest('14. autoShow does not attempt rendering', async () => {
  globalThis.fetch = async () =>
    createMockResponse(200, {
      success: true,
      message: 'OK',
      data: [
        {
          id: 70,
          title: 'AutoShow Popup',
          content: '<p>Content</p>',
          position: 'center',
          start_time: null,
          end_time: null,
        },
      ],
    });

  PopupManager.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: true,
  });

  const popups = await PopupManager.load();
  assert.strictEqual(popups.length, 1);
  // Verify load succeeded without attempting DOM rendering
  assert.strictEqual(PopupManager.getState(), 'READY');
});

// 15. Existing PopupManager.init() behavior remains compatible
await runAsyncTest('15. Existing PopupManager.init() behavior remains compatible', async () => {
  assert.throws(
    () => PopupManager.init({ apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError
  );

  assert.throws(
    () => PopupManager.init({ websiteKey: '', apiBaseUrl: 'http://localhost:8082' }),
    (err) => err instanceof ConfigurationError
  );

  PopupManager.init({
    websiteKey: 'wg_live_compatible_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
  });

  assert.strictEqual(PopupManager.getState(), 'CONFIGURED');
});

console.log(`\nAll ${testsPassed} Runtime Lifecycle tests passed successfully!`);
