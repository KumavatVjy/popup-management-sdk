import assert from 'assert';
import { JSDOM } from 'jsdom';

console.log('Running SDK Accessibility & Interactions Tests...\n');

let testsPassed = 0;
let dom;

function setupDom(html = '<!DOCTYPE html><html><body><button id="trigger-btn">Open Dialog</button><div id="host-site-content"><h1>Host Page</h1></div></body></html>') {
  dom = new JSDOM(html, {
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
    id: 1,
    title: 'Accessible Modal',
    content: '<p>Body text with a <a id="content-link-1" href="https://example.com/one">First Link</a> and <a id="content-link-2" href="https://example.com/two">Second Link</a></p>',
    position: 'center',
    start_time: null,
    end_time: null,
  },
  {
    id: 2,
    title: 'Top Banner Notification',
    content: '<p>Top banner message</p>',
    position: 'top-banner',
    start_time: null,
    end_time: null,
  },
  {
    id: 3,
    title: 'Bottom-Right Toast',
    content: '<p>Corner toast notification</p>',
    position: 'bottom-right',
    start_time: null,
    end_time: null,
  },
];

// 1. Opening a center modal moves focus into the modal (prefers close button)
await runAsyncTest('1. Opening a center modal moves initial focus into modal close button', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  assert(host && host.shadowRoot, 'Shadow host must exist');

  const closeBtn = host.shadowRoot.querySelector('.popup-manager-close-btn');
  assert(closeBtn, 'Close button must exist');
  assert.strictEqual(host.shadowRoot.activeElement, closeBtn, 'Close button should receive initial focus');

  pm.destroy();
});

// 2. Tab focus cycling stays inside the active modal
await runAsyncTest('2. Tab key cycles focus through modal focusable elements', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  const shadowRoot = host.shadowRoot;

  const closeBtn = shadowRoot.querySelector('.popup-manager-close-btn');
  const links = shadowRoot.querySelectorAll('a');
  const link1 = links[0];
  const link2 = links[1];

  assert(closeBtn && link1 && link2, 'All modal focusable elements must exist');

  // Focus link2 (last element) and press Tab -> should wrap to first element (close button)
  link2.focus();
  assert.strictEqual(shadowRoot.activeElement, link2);

  const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  window.dispatchEvent(tabEvent);

  assert(tabEvent.defaultPrevented, 'Tab event from last element must preventDefault to trap focus');
  assert.strictEqual(shadowRoot.activeElement, closeBtn, 'Focus must wrap to first element (close button)');

  pm.destroy();
});

// 3. Shift+Tab wraps correctly from first element to last element
await runAsyncTest('3. Shift+Tab key wraps focus from first element to last element', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  const shadowRoot = host.shadowRoot;

  const closeBtn = shadowRoot.querySelector('.popup-manager-close-btn');
  const links = shadowRoot.querySelectorAll('a');
  const link2 = links[1];

  closeBtn.focus();
  assert.strictEqual(shadowRoot.activeElement, closeBtn);

  const shiftTabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(shiftTabEvent);

  assert(shiftTabEvent.defaultPrevented, 'Shift+Tab event from first element must preventDefault');
  assert.strictEqual(shadowRoot.activeElement, link2, 'Focus must wrap backwards to last element (link2)');

  pm.destroy();
});

// 4. A modal with only the close button keeps focus on the close button
await runAsyncTest('4. Modal with only one focusable element safely retains focus', async (pm) => {
  const singleFocusPopup = [
    {
      id: 99,
      title: 'Only Close Button',
      content: '<p>No links or buttons here</p>',
      position: 'center',
      start_time: null,
      end_time: null,
    },
  ];

  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: singleFocusPopup });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(99);
  const host = document.getElementById('popup-manager-host-root');
  const shadowRoot = host.shadowRoot;
  const closeBtn = shadowRoot.querySelector('.popup-manager-close-btn');

  closeBtn.focus();

  const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  window.dispatchEvent(tabEvent);

  assert(tabEvent.defaultPrevented, 'Tab event must be prevented');
  assert.strictEqual(shadowRoot.activeElement, closeBtn, 'Focus must remain on close button');

  pm.destroy();
});

// 5. Focus returns to the previously focused element after dismissal
await runAsyncTest('5. Focus returns to previously focused trigger element after modal dismissal', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  const trigger = document.getElementById('trigger-btn');
  trigger.focus();
  assert.strictEqual(document.activeElement, trigger, 'Trigger element should have focus prior to opening modal');

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  assert(host.shadowRoot.activeElement, 'Focus moved into shadow root');

  // Dismiss modal via close button
  const closeBtn = host.shadowRoot.querySelector('.popup-manager-close-btn');
  closeBtn.click();

  assert.strictEqual(document.activeElement, trigger, 'Focus should be restored to trigger button after dismissal');

  pm.destroy();
});

// 6. Focus restoration safely tolerates an unavailable or removed trigger element
await runAsyncTest('6. Focus restoration tolerates removed or detached target element without error', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  const trigger = document.getElementById('trigger-btn');
  trigger.focus();

  pm.show(1);

  // Remove the trigger from DOM while modal is open
  trigger.remove();

  // Dismissing modal should not throw
  assert.doesNotThrow(() => {
    pm.hide();
  }, 'Hiding modal with detached target must not throw');

  pm.destroy();
});

// 7. Escape dismisses the center modal
await runAsyncTest('7. Escape key dismisses center modal', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  assert.strictEqual(host.shadowRoot.children.length > 0, true, 'Modal should be mounted');

  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.strictEqual(host.shadowRoot.children.length, 0, 'Shadow DOM should be cleared on Escape');

  pm.destroy();
});

// 8. Escape does not create duplicate dismissals or throw on repeated triggers
await runAsyncTest('8. Repeated Escape key triggers do not cause duplicate dismissals or errors', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // Second Escape when already hidden
  assert.doesNotThrow(() => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  pm.destroy();
});

// 9. Non-modal banner/corner layouts do not trap focus
await runAsyncTest('9. Non-modal banner layout does not trap keyboard focus', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  const trigger = document.getElementById('trigger-btn');
  trigger.focus();

  // Show top banner (non-modal)
  pm.show(2);
  const host = document.getElementById('popup-manager-host-root');
  const banner = host.shadowRoot.querySelector('.popup-manager-position-top-banner');
  assert(banner, 'Top banner container should exist');
  assert.strictEqual(banner.getAttribute('aria-modal'), null, 'Top banner must NOT have aria-modal="true"');
  assert.strictEqual(banner.getAttribute('role'), 'region', 'Top banner must have role="region"');

  // Trigger button should still retain document focus (not stolen)
  assert.strictEqual(document.activeElement, trigger, 'Banner must not steal host focus on open');

  // Tab key should not be intercepted/trapped by the banner
  const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  window.dispatchEvent(tabEvent);
  assert.strictEqual(tabEvent.defaultPrevented, false, 'Tab event must not be prevented for non-modal banner');

  pm.destroy();
});

// 10. Close controls have appropriate accessible names and modal has accessible title labeling
await runAsyncTest('10. Modal controls have accessible names and aria-labelledby', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  const shadowRoot = host.shadowRoot;

  const wrapper = shadowRoot.querySelector('.popup-manager-wrapper');
  assert.strictEqual(wrapper.getAttribute('role'), 'dialog');
  assert.strictEqual(wrapper.getAttribute('aria-modal'), 'true');
  assert.strictEqual(wrapper.getAttribute('aria-labelledby'), 'popup-manager-title');

  const title = shadowRoot.getElementById('popup-manager-title');
  assert(title, 'Title element with id popup-manager-title must exist');
  assert.strictEqual(title.textContent, 'Accessible Modal');

  const closeBtn = shadowRoot.querySelector('.popup-manager-close-btn');
  assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Close popup');

  pm.destroy();
});

// 11. Reduced-motion CSS rules are present and correct
await runAsyncTest('11. Prefers-reduced-motion media queries are present in Shadow DOM styles', async (pm) => {
  globalThis.fetch = async () => createMockResponse(200, { success: true, message: 'OK', data: mockPopups });
  pm.init({ websiteKey: 'wg_live_a11y', apiBaseUrl: 'http://localhost:8082', autoLoad: false });
  await pm.load();

  pm.show(1);
  const host = document.getElementById('popup-manager-host-root');
  const styleEl = host.shadowRoot.querySelector('style');
  assert(styleEl, 'Style element must exist in shadow root');

  const css = styleEl.textContent || '';
  assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'CSS must include prefers-reduced-motion query');
  assert(css.includes('animation: none !important'), 'CSS must disable animation in reduced motion');
  assert(css.includes('transition: none !important'), 'CSS must disable transition in reduced motion');

  pm.destroy();
});

console.log(`\nAll ${testsPassed} Accessibility & Interaction tests passed successfully!`);
