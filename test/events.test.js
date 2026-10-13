import assert from 'assert';
import { JSDOM } from 'jsdom';

console.log('Running SDK Public Event System Tests...\n');

let testsPassed = 0;
let dom;

function setupDom() {
  dom = new JSDOM('<!DOCTYPE html><html><body><div id="host-site-content"><h1>Host Page</h1></div></body></html>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.HTMLElement = dom.window.HTMLElement;
}

function createMockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function runAsyncTest(name, fn) {
  setupDom();
  const originalFetch = globalThis.fetch;
  try {
    const { PopupManager } = await import('../dist/popup-manager.esm.js?t=' + Date.now());
    await fn(PopupManager);
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

const mockPopups = [
  {
    id: 101,
    title: 'Event Promo Modal',
    content: '<p>Body text with event hooks</p>',
    position: 'center',
    start_time: null,
    end_time: null,
  },
  {
    id: 102,
    title: 'Second Banner',
    content: '<p>Second banner</p>',
    position: 'top-banner',
    start_time: null,
    end_time: null,
  },
];

// 1. popup:loaded is emitted after a successful load with count
await runAsyncTest('1. popup:loaded is emitted after a successful load with eligible count', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const events = [];
  pm.on('popup:loaded', (payload) => {
    events.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  assert.strictEqual(events.length, 1, 'popup:loaded must fire once');
  assert.strictEqual(events[0].count, 2, 'popup:loaded payload must contain count = 2');

  pm.destroy();
});

// 2. popup:shown is emitted only when a popup is mounted and visible
await runAsyncTest('2. popup:shown is emitted only after popup is mounted and visible', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const shownEvents = [];
  pm.on('popup:shown', (payload) => {
    shownEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  assert.strictEqual(shownEvents.length, 0, 'popup:shown must NOT fire prior to show()');

  pm.show(101);
  assert.strictEqual(shownEvents.length, 1, 'popup:shown must fire when show() mounts popup');
  assert.strictEqual(shownEvents[0].popupId, 101);

  pm.destroy();
});

// 3. popup:hidden is emitted after programmatic hide
await runAsyncTest('3. popup:hidden is emitted after programmatic hide() call', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const hiddenEvents = [];
  pm.on('popup:hidden', (payload) => {
    hiddenEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  pm.show(101);
  assert.strictEqual(hiddenEvents.length, 0, 'popup:hidden must not fire while visible');

  pm.hide();
  assert.strictEqual(hiddenEvents.length, 1, 'popup:hidden must fire after hide()');
  assert.strictEqual(hiddenEvents[0].popupId, 101);

  // Calling hide again on an already hidden popup should not fire duplicate popup:hidden
  pm.hide();
  assert.strictEqual(hiddenEvents.length, 1, 'Duplicate hide() must not fire duplicate popup:hidden');

  pm.destroy();
});

// 4. User dismissal emits popup:closed followed by popup:hidden
await runAsyncTest('4. User close button dismissal emits popup:closed then popup:hidden', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const eventOrder = [];
  pm.on('popup:closed', (payload) => {
    eventOrder.push({ type: 'closed', payload });
  });
  pm.on('popup:hidden', (payload) => {
    eventOrder.push({ type: 'hidden', payload });
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  pm.show(101);
  const host = document.getElementById('popup-manager-host-root');
  const closeBtn = host.shadowRoot.querySelector('.popup-manager-close-btn');

  closeBtn.click();

  assert.strictEqual(eventOrder.length, 2, 'Should emit closed then hidden');
  assert.strictEqual(eventOrder[0].type, 'closed', 'popup:closed must precede popup:hidden');
  assert.strictEqual(eventOrder[0].payload.popupId, 101);
  assert.strictEqual(eventOrder[0].payload.reason, 'close-button');

  assert.strictEqual(eventOrder[1].type, 'hidden', 'popup:hidden must fire following popup:closed');
  assert.strictEqual(eventOrder[1].payload.popupId, 101);

  pm.destroy();
});

// 5. Backdrop click dismissal emits popup:closed with reason 'backdrop'
await runAsyncTest('5. Backdrop click dismissal emits popup:closed with reason backdrop', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const closedEvents = [];
  pm.on('popup:closed', (payload) => {
    closedEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  pm.show(101);
  const host = document.getElementById('popup-manager-host-root');
  const backdrop = host.shadowRoot.querySelector('.popup-manager-backdrop');

  backdrop.click();

  assert.strictEqual(closedEvents.length, 1);
  assert.strictEqual(closedEvents[0].reason, 'backdrop');

  pm.destroy();
});

// 6. Escape dismissal emits popup:closed with reason 'escape'
await runAsyncTest('6. Escape key dismissal emits popup:closed with reason escape', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const closedEvents = [];
  pm.on('popup:closed', (payload) => {
    closedEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  pm.show(101);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.strictEqual(closedEvents.length, 1);
  assert.strictEqual(closedEvents[0].reason, 'escape');

  pm.destroy();
});

// 7. Programmatic hide does NOT emit popup:closed
await runAsyncTest('7. Programmatic hide() does not emit popup:closed', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  const closedEvents = [];
  pm.on('popup:closed', (payload) => {
    closedEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  pm.show(101);
  pm.hide();

  assert.strictEqual(closedEvents.length, 0, 'Programmatic hide must NOT emit popup:closed');

  pm.destroy();
});

// 8. popup:error safely reports failures
await runAsyncTest('8. popup:error reports failures with sanitized diagnostic payload', async (pm) => {
  globalThis.fetch = async () => createMockResponse(500, { message: 'Internal Server Error' });

  const errorEvents = [];
  pm.on('popup:error', (payload) => {
    errorEvents.push(payload);
  });

  pm.init({ websiteKey: 'wg_live_events_secret_123', apiBaseUrl: 'http://localhost:8082', autoLoad: false });

  await assert.rejects(async () => {
    await pm.load();
  });

  assert.strictEqual(errorEvents.length, 1, 'popup:error must be emitted');
  assert.strictEqual(errorEvents[0].context, 'network');
  assert(typeof errorEvents[0].error === 'string');
  // Confirm website key is NOT leaked into error payload
  assert.strictEqual(errorEvents[0].error.includes('wg_live_events_secret_123'), false, 'Sensitive key must not leak');

  pm.destroy();
});

// 9. off() removes the expected subscriber
await runAsyncTest('9. off() unregisters the specified subscriber callback', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  let callCount = 0;
  const cb = () => {
    callCount++;
  };

  pm.on('popup:loaded', cb);
  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  assert.strictEqual(callCount, 1, 'Callback should fire once');

  pm.off('popup:loaded', cb);
  await pm.load();
  assert.strictEqual(callCount, 1, 'Callback must not fire after off()');

  pm.destroy();
});

// 10. One subscriber failure does not prevent other subscribers from executing
await runAsyncTest('10. Unhandled exception in subscriber does not disrupt other subscribers or SDK', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  let healthyCalled = false;
  const faultySubscriber = () => {
    throw new Error('Subscriber intentional explosion');
  };
  const healthySubscriber = () => {
    healthyCalled = true;
  };

  pm.on('popup:loaded', faultySubscriber);
  pm.on('popup:loaded', healthySubscriber);

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false });

  // load() should succeed without re-throwing the subscriber error
  await assert.doesNotReject(async () => {
    await pm.load();
  });

  assert.strictEqual(healthyCalled, true, 'Healthy subscriber must have run successfully');

  pm.destroy();
});

// 11. destroy() cleans up event subscribers according to documented lifecycle
await runAsyncTest('11. destroy() clears all registered event subscribers', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  let callCount = 0;
  pm.on('popup:loaded', () => {
    callCount++;
  });

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  assert.strictEqual(callCount, 1);

  pm.destroy();

  // Re-init with new config - previously registered subscriber should not fire
  pm.init({ websiteKey: 'wg_live_events_new', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  assert.strictEqual(callCount, 1, 'Destroyed subscribers must not fire after reinitialization');

  pm.destroy();
});

// 12. Reinitialization during in-flight request does not leak stale events
await runAsyncTest('12. In-flight request from previous session does not emit stale events after destroy', async (pm) => {
  let resolveFirstFetch;
  const firstPromise = new Promise((resolve) => {
    resolveFirstFetch = resolve;
  });

  let shownCalls = 0;
  pm.on('popup:shown', () => {
    shownCalls++;
  });

  globalThis.fetch = () => firstPromise;

  pm.init({ websiteKey: 'wg_live_events', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  const pendingLoad = pm.load();

  // Destroy immediately while load is in-flight
  pm.destroy();

  // Resolve old fetch
  resolveFirstFetch(createMockResponse(200, { success: true, message: 'OK', data: mockPopups }));

  try {
    await pendingLoad;
  } catch {
    // Ignore rejection or completion of aborted load
  }

  assert.strictEqual(shownCalls, 0, 'No popup:shown events should be emitted from stale session');
});

// 13. Synchronous destroy inside popup:loaded subscriber does not cause unhandled rejection or stale rendering
await runAsyncTest('13. Synchronous destroy inside popup:loaded subscriber safely aborts rendering without error', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  let shownEvents = 0;
  let loadedEvents = 0;
  let errorEvents = 0;

  pm.on('popup:loaded', () => {
    loadedEvents++;
    // Synchronously destroy the SDK inside the subscriber callback
    pm.destroy();
  });

  pm.on('popup:shown', () => {
    shownEvents++;
  });

  pm.on('popup:error', () => {
    errorEvents++;
  });

  pm.init({
    websiteKey: 'wg_live_events',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: true, // autoShow is enabled to verify it does NOT attempt to show after destroy
  });

  // load() should resolve without throwing TypeError or unhandled rejection
  const result = await pm.load();

  assert.strictEqual(loadedEvents, 1, 'popup:loaded should have fired once');
  assert.strictEqual(shownEvents, 0, 'No popup:shown event should fire after synchronous destroy');
  assert.strictEqual(errorEvents, 0, 'No popup:error event should fire as a result of clean destroy');
  assert.strictEqual(pm.getState(), 'DESTROYED', 'State should be DESTROYED');
  assert.strictEqual(result.length, mockPopups.length, 'load() promise still resolves with eligible popups');

  // Verify no host element exists in the DOM
  const host = document.getElementById('popup-manager-host-root');
  assert.strictEqual(host, null, 'No DOM host should be mounted after synchronous destroy');
});

// 14. Synchronous reinitialization inside popup:loaded subscriber preserves new session without stale render
await runAsyncTest('14. Synchronous reinitialization inside popup:loaded subscriber safely isolates sessions', async (pm) => {
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount++;
    return createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  };

  let shownEvents = [];

  pm.on('popup:shown', (payload) => {
    shownEvents.push(payload.popupId);
  });

  pm.on('popup:loaded', (payload) => {
    // Synchronously reinitialize with new config
    pm.init({
      websiteKey: 'wg_live_reinit_session',
      apiBaseUrl: 'http://localhost:8082',
      autoLoad: false,
      autoShow: false,
    });
  });

  pm.init({
    websiteKey: 'wg_live_initial_session',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: true, // First session wanted autoShow
  });

  await pm.load();

  // The first session's autoShow must NOT have fired on the newly initialized session
  assert.strictEqual(shownEvents.length, 0, 'Old session must not auto-show after synchronous reinit');
  assert.strictEqual(pm.getState(), 'CONFIGURED', 'Runtime state must reflect new session state (CONFIGURED)');

  pm.destroy();
});

console.log(`\nAll ${testsPassed} Public Event System tests passed successfully!`);

