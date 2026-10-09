import DOMPurify from 'dompurify';

/**
 * Strict allowlist of HTML formatting tags permitted in popup content.
 * Disallows executable scripts, objects, iframes, and arbitrary media embeds.
 */
export const ALLOWED_TAGS: readonly string[] = Object.freeze([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'a',
  'span',
]);

/**
 * Strict allowlist of permitted HTML attributes.
 * Disallows all event handlers (onclick, onerror, etc.) and inline style attributes.
 */
export const ALLOWED_ATTR: readonly string[] = Object.freeze([
  'href',
  'target',
  'rel',
  'title',
  'aria-label',
]);

/**
 * Resolves the active DOMPurify instance across browser and DOM-equipped test environments.
 */
function getPurifyInstance(): typeof DOMPurify {
  if (typeof window !== 'undefined') {
    // If DOMPurify is exported as a factory function (common in node / test environments)
    if (typeof (DOMPurify as unknown) === 'function') {
      return (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(window);
    }
    return DOMPurify;
  }
  throw new Error('DOM environment is required for HTML sanitization');
}

/**
 * Sanitizes untrusted popup HTML using DOMPurify against a conservative allowlist.
 *
 * Rules:
 * - Allows basic typography and formatting tags (p, b, i, h1-h3, lists, blockquotes, links, spans).
 * - Strips all script tags, iframes, embed objects, svg, and form elements.
 * - Strips all inline event handlers (onclick, onerror, onload, etc.).
 * - Neutralizes javascript: pseudo-protocol URIs in links.
 * - Enforces safe rel="noopener noreferrer" on external links opening in new tabs.
 *
 * @param dirtyHtml The raw untrusted HTML string from the popup payload.
 * @returns Sanitized, safe HTML string.
 * @throws Error if executed outside a DOM environment.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  const purify = getPurifyInstance();

  // Reset and register custom hook for safe link handling
  purify.removeHooks('afterSanitizeAttributes');
  purify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A') {
      const target = node.getAttribute('target');
      if (target === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  return purify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ADD_ATTR: ['target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}
