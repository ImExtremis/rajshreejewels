import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

/**
 * Sanitises a raw HTML string to prevent XSS attacks while retaining safe styling/structure.
 * Utilised for processing rich storytelling copy, customer names, address blocks, and metadata fields.
 */
export function sanitiseHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'strong', 'em', 'u', 'span', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'a', 'table', 'tbody',
      'tr', 'td', 'th', 'thead', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'id', 'align', 'width']
  });
}

/**
 * Strips all HTML tags from a string completely, leaving only raw text.
 * Ideal for search indexing, short descriptions, and SMS payloads.
 */
export function stripHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] }).trim();
}
