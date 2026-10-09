import assert from 'assert';
import { JSDOM } from 'jsdom';

console.log('Running Shadow DOM Popup Renderer Tests...\n');

let testsPassed = 0;

// Setup JSDOM environment
let dom;

function setupDom() {
  dom = new JSDOM('<!DOCTYPE html><html><body><div id="host-site-content"><h1>Host Page</h1></div></body></html>', {
    url: 'https://example.com/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
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

// 1 & 2. Rendering creates the expected Shadow DOM host with ID popup-manager-host-root
await runAsyncTest('1 & 2. Host element has expected ID and contains open Shadow DOM', async (pm) => {
  const mockPopups = [
    {
      id: 1,
      title: 'Test Promo',
      content: '<p>Test Promo Body</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({
    websiteKey: 'wg_live_test_site',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: false,
    autoShow: false,
  });

  await pm.load();
  pm.show();

  const host = document.getElementById('popup-manager-host-root');
  assert(host, 'Host element must exist in document');
  assert.strictEqual(host.id, 'popup-manager-host-root');
  assert(host.shadowRoot, 'Host must attach open ShadowRoot');
  assert.strictEqual(host.shadowRoot.mode, 'open');
});

// 3. Center positioning renders correctly
await runAsyncTest('3. Center positioning renders modal with backdrop and dialog role', async (pm) => {
  const mockPopups = [
    {
      id: 10,
      title: 'Center Modal',
      content: '<p>Center Content</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  const backdrop = shadow.querySelector('.popup-manager-backdrop');
  assert(backdrop, 'Center modal must have a backdrop');

  const wrapper = shadow.querySelector('.popup-manager-position-center');
  assert(wrapper, 'Wrapper must have center position class');
  assert.strictEqual(wrapper.getAttribute('role'), 'dialog');
  assert.strictEqual(wrapper.getAttribute('aria-modal'), 'true');
});

// 4. Top-banner positioning renders correctly
await runAsyncTest('4. Top-banner positioning renders banner without backdrop', async (pm) => {
  const mockPopups = [
    {
      id: 20,
      title: 'Top Banner',
      content: '<p>Banner Content</p>',
      position: 'top-banner',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  assert(!shadow.querySelector('.popup-manager-backdrop'), 'Top banner must not have backdrop');

  const wrapper = shadow.querySelector('.popup-manager-position-top-banner');
  assert(wrapper, 'Wrapper must have top-banner position class');
  assert.strictEqual(wrapper.getAttribute('role'), 'region');
  assert.strictEqual(wrapper.getAttribute('aria-modal'), null);
});

// 5. Bottom-left positioning renders correctly
await runAsyncTest('5. Bottom-left positioning renders card without backdrop', async (pm) => {
  const mockPopups = [
    {
      id: 30,
      title: 'Bottom Left Card',
      content: '<p>Left Content</p>',
      position: 'bottom-left',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  assert(!shadow.querySelector('.popup-manager-backdrop'), 'Bottom-left must not have backdrop');
  const wrapper = shadow.querySelector('.popup-manager-position-bottom-left');
  assert(wrapper, 'Wrapper must have bottom-left position class');
  assert.strictEqual(wrapper.getAttribute('role'), 'region');
});

// 6. Bottom-right positioning renders correctly
await runAsyncTest('6. Bottom-right positioning renders card without backdrop', async (pm) => {
  const mockPopups = [
    {
      id: 40,
      title: 'Bottom Right Card',
      content: '<p>Right Content</p>',
      position: 'bottom-right',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  assert(!shadow.querySelector('.popup-manager-backdrop'), 'Bottom-right must not have backdrop');
  const wrapper = shadow.querySelector('.popup-manager-position-bottom-right');
  assert(wrapper, 'Wrapper must have bottom-right position class');
  assert.strictEqual(wrapper.getAttribute('role'), 'region');
});

// 7. Popup title and sanitized content appear
await runAsyncTest('7. Popup title and sanitized content appear in shadow root', async (pm) => {
  const mockPopups = [
    {
      id: 50,
      title: 'Exclusive Deal',
      content: '<p>Save <strong>50%</strong> today! <script>evil()</script></p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  const titleEl = shadow.querySelector('.popup-manager-title');
  assert.strictEqual(titleEl.textContent, 'Exclusive Deal');

  const bodyEl = shadow.querySelector('.popup-manager-body');
  assert(bodyEl.innerHTML.includes('Save <strong>50%</strong> today!'));
  assert(!bodyEl.innerHTML.includes('<script>'), 'Scripts must be sanitized');
});

// 8 & 9. The close button exists, has an accessible name, and hides popup on click
await runAsyncTest('8 & 9. Close button has accessible name and closes popup on click', async (pm) => {
  const mockPopups = [
    {
      id: 60,
      title: 'Close Test',
      content: '<p>Content</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  const closeBtn = shadow.querySelector('.popup-manager-close-btn');
  assert(closeBtn, 'Close button must exist');
  assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Close popup');
  assert.strictEqual(closeBtn.tagName, 'BUTTON');

  // Trigger close button click
  closeBtn.click();

  // Content inside shadow root should now be cleared
  assert.strictEqual(shadow.children.length, 0, 'Shadow DOM content should be cleared on hide');
});

// 10. PopupManager.hide() removes visible popup without affecting host page
await runAsyncTest('10. PopupManager.hide() cleans up popup while keeping host page intact', async (pm) => {
  const mockPopups = [
    {
      id: 70,
      title: 'Hide Test',
      content: '<p>Content</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  pm.hide();

  const host = document.getElementById('popup-manager-host-root');
  assert(host, 'Host root remains attached after hide for potential reuse');
  assert.strictEqual(host.shadowRoot.children.length, 0);

  // Host page element is unaffected
  const hostContent = document.getElementById('host-site-content');
  assert(hostContent, 'Host website elements must remain intact');
});

// 11. Repeated show/hide operations do not create duplicate containers
await runAsyncTest('11. Repeated show/hide operations do not create duplicate hosts', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'P1', content: '<p>C1</p>', position: 'center', start_time: null, end_time: null },
    { id: 2, title: 'P2', content: '<p>C2</p>', position: 'top-banner', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  pm.hide();
  pm.show(2);
  pm.hide();
  pm.show(1);

  const hosts = document.querySelectorAll('#popup-manager-host-root');
  assert.strictEqual(hosts.length, 1, 'Exactly one host container must exist');
});

// 12. destroy() removes host and renderer resources
await runAsyncTest('12. destroy() removes host element and releases resources', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'P1', content: '<p>C1</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  assert(document.getElementById('popup-manager-host-root'), 'Host should exist before destroy');

  pm.destroy();

  assert.strictEqual(
    document.getElementById('popup-manager-host-root'),
    null,
    'Host element must be removed on destroy'
  );
});

// 13. Reinitialization works after destruction
await runAsyncTest('13. Reinitialization works after destruction', async (pm) => {
  const mockPopups = [
    { id: 99, title: 'Reinit', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key1', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();
  pm.destroy();

  pm.init({ websiteKey: 'key2', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const host = document.getElementById('popup-manager-host-root');
  assert(host, 'New host must be created after reinitialization');
  assert.strictEqual(
    host.shadowRoot.querySelector('.popup-manager-title').textContent,
    'Reinit'
  );
});

// 14. Unknown popup ID fails without creating empty host
await runAsyncTest('14. Unknown popup ID fails predictably without empty host', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'Only Popup', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false, autoShow: false });
  await pm.load();

  assert.throws(
    () => pm.show(99999),
    (err) => err.message.includes('99999')
  );

  assert.strictEqual(
    document.getElementById('popup-manager-host-root'),
    null,
    'Empty host must not be created on invalid show ID'
  );
});

// 15. Missing eligible data does not create an empty popup
await runAsyncTest('15. Missing eligible data fails show() without creating empty host', async (pm) => {
  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: [] });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  assert.throws(
    () => pm.show(),
    (err) => err.message.includes('No eligible popups')
  );

  assert.strictEqual(document.getElementById('popup-manager-host-root'), null);
});

// 16. Missing DOM support rejects safely
await runAsyncTest('16. Missing DOM support rejects show() predictably', async (pm) => {
  const tempDoc = globalThis.document;
  try {
    delete globalThis.document;

    assert.throws(
      () => pm.show(),
      (err) => err.message.includes('DOM') || err.message.includes('initialized')
    );
  } finally {
    globalThis.document = tempDoc;
  }
});

// 17. Basic keyboard dismissal works (Escape key)
await runAsyncTest('17. Escape key dismissal hides visible popup', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'Esc Test', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  assert(shadow.querySelector('.popup-manager-card'), 'Card must be visible before Escape');

  // Dispatch Escape keydown on window
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  assert.strictEqual(shadow.children.length, 0, 'Popup must be dismissed after Escape');
});

// 18. Styles are contained in Shadow DOM
await runAsyncTest('18. Styles are scoped within Shadow DOM style tag', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'Style Scoping', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  const styleEl = shadow.querySelector('style');
  assert(styleEl, 'Style tag must exist in shadow root');
  assert(styleEl.textContent.includes('.popup-manager-wrapper'), 'Scattered styles must be scoped');

  // Verify head of host document does not have SDK styles injected
  const headStyles = document.head.querySelectorAll('style');
  for (const s of headStyles) {
    assert(!s.textContent.includes('popup-manager-backdrop'), 'SDK styles must not leak into host head');
  }
});

// 24. Auto-show displays a popup after a successful background load
await runAsyncTest('24. autoShow: true automatically displays popup after load', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'AutoShow Promo', content: '<p>Auto Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({
    websiteKey: 'key',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: true,
    autoShow: true,
  });

  // Give background async load time to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  const host = document.getElementById('popup-manager-host-root');
  assert(host, 'Host must be automatically rendered when autoShow: true');
  const title = host.shadowRoot.querySelector('.popup-manager-title');
  assert.strictEqual(title.textContent, 'AutoShow Promo');
});

// 25. autoShow: false does not display a popup automatically
await runAsyncTest('25. autoShow: false does not display popup automatically', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'No AutoShow', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({
    websiteKey: 'key',
    apiBaseUrl: 'http://localhost:8082',
    autoLoad: true,
    autoShow: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  const host = document.getElementById('popup-manager-host-root');
  assert.strictEqual(host, null, 'Host must not be created when autoShow: false');
});

// 26. Backdrop click dismisses center modal
await runAsyncTest('26. Backdrop click dismisses center modal', async (pm) => {
  const mockPopups = [
    { id: 1, title: 'Backdrop Dismiss', content: '<p>Content</p>', position: 'center', start_time: null, end_time: null },
  ];

  globalThis.fetch = async () =>
    createMockResponse(200, { success: true, message: 'OK', data: mockPopups });

  pm.init({ websiteKey: 'key', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();
  pm.show();

  const shadow = document.getElementById('popup-manager-host-root').shadowRoot;
  const backdrop = shadow.querySelector('.popup-manager-backdrop');
  assert(backdrop, 'Backdrop must exist');

  backdrop.click();

  assert.strictEqual(shadow.children.length, 0, 'Popup must be dismissed on backdrop click');
});

console.log(`\nAll ${testsPassed} Shadow DOM popup renderer tests passed successfully!`);
