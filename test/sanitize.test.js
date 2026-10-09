import assert from 'assert';
import { JSDOM } from 'jsdom';

// Initialize global DOM environment for DOMPurify testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://example.com/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { sanitizeHtml, ALLOWED_TAGS, ALLOWED_ATTR } = await import(
  '../dist/popup-manager.esm.js'
);

console.log('Running HTML Sanitization Tests...\n');

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

// 1. Allowed formatting tags are preserved
runTest('1. Allowed formatting tags are preserved', () => {
  const input = `
    <h1>Heading 1</h1>
    <h2>Heading 2</h2>
    <h3>Heading 3</h3>
    <p>This is a <strong>strong</strong> and <b>bold</b> text with <em>emphasis</em> and <i>italic</i>.</p>
    <ul><li>Item 1</li><li>Item 2</li></ul>
    <ol><li>Ordered 1</li></ol>
    <blockquote>Wise words</blockquote>
    <span>Span content</span>
    <br>
  `;
  const sanitized = sanitizeHtml(input);
  assert(sanitized.includes('<h1>Heading 1</h1>'), 'h1 must be preserved');
  assert(sanitized.includes('<h2>Heading 2</h2>'), 'h2 must be preserved');
  assert(sanitized.includes('<h3>Heading 3</h3>'), 'h3 must be preserved');
  assert(sanitized.includes('<strong>strong</strong>'), 'strong must be preserved');
  assert(sanitized.includes('<b>bold</b>'), 'b must be preserved');
  assert(sanitized.includes('<em>emphasis</em>'), 'em must be preserved');
  assert(sanitized.includes('<i>italic</i>'), 'i must be preserved');
  assert(sanitized.includes('<ul>'), 'ul must be preserved');
  assert(sanitized.includes('<li>Item 1</li>'), 'li must be preserved');
  assert(sanitized.includes('<blockquote>Wise words</blockquote>'), 'blockquote must be preserved');
  assert(sanitized.includes('<span>Span content</span>'), 'span must be preserved');
});

// 2. Safe links are preserved and target="_blank" receives rel="noopener noreferrer"
runTest('2. Safe links receive rel="noopener noreferrer" for target="_blank"', () => {
  const input = '<a href="https://example.com/promo" target="_blank" title="Promo Link">Visit Promo</a>';
  const sanitized = sanitizeHtml(input);
  assert(sanitized.includes('href="https://example.com/promo"'), 'href must be preserved');
  assert(sanitized.includes('rel="noopener noreferrer"'), 'rel="noopener noreferrer" must be added');
  assert(sanitized.includes('title="Promo Link"'), 'title attribute must be preserved');
});

// 3. Script tags and execution attempts are completely stripped
runTest('3. Script execution attempts are stripped', () => {
  const input = '<p>Normal text</p><script>alert("xss")</script><script src="https://evil.com/xss.js"></script>';
  const sanitized = sanitizeHtml(input);
  assert(!sanitized.includes('<script'), 'script tags must be removed');
  assert(!sanitized.includes('alert'), 'script body must be removed');
  assert(sanitized.includes('<p>Normal text</p>'), 'safe content must be kept');
});

// 4. Inline event handler attributes are stripped
runTest('4. Inline event handlers (onerror, onclick, etc.) are stripped', () => {
  const input = `
    <p onclick="stealCookies()">Click me</p>
    <a href="https://example.com" onmouseover="malicious()" onclick="alert(1)">Link</a>
    <span onfocus="hack()">Focus</span>
  `;
  const sanitized = sanitizeHtml(input);
  assert(!sanitized.includes('onclick'), 'onclick must be stripped');
  assert(!sanitized.includes('onmouseover'), 'onmouseover must be stripped');
  assert(!sanitized.includes('onfocus'), 'onfocus must be stripped');
  assert(!sanitized.includes('stealCookies'), 'handler values must not execute');
});

// 5. javascript: pseudo-protocol URIs are stripped
runTest('5. javascript: pseudo-protocol URIs are stripped', () => {
  const input = '<a href="javascript:alert(document.cookie)">Malicious Link</a>';
  const sanitized = sanitizeHtml(input);
  assert(!sanitized.includes('javascript:'), 'javascript: URI must be stripped');
  assert(!sanitized.includes('alert(document.cookie)'), 'payload must be removed');
});

// 6. Disallowed embedded elements (iframe, object, embed, svg, form) are stripped
runTest('6. Disallowed embedded elements are stripped', () => {
  const input = `
    <iframe src="https://attacker.com/embed"></iframe>
    <object data="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></object>
    <embed src="flash.swf">
    <svg onload="alert(1)"><circle r="10"/></svg>
    <form action="/login"><input type="password" name="pwd"><button type="submit">Submit</button></form>
  `;
  const sanitized = sanitizeHtml(input);
  assert(!sanitized.includes('<iframe'), 'iframe must be stripped');
  assert(!sanitized.includes('<object'), 'object must be stripped');
  assert(!sanitized.includes('<embed'), 'embed must be stripped');
  assert(!sanitized.includes('<svg'), 'svg must be stripped');
  assert(!sanitized.includes('<form'), 'form must be stripped');
  assert(!sanitized.includes('<input'), 'input must be stripped');
});

console.log(`\nAll ${testsPassed} HTML sanitization tests passed successfully!`);
