/**
 * Strict HTML neutralization for untrusted free-text input.
 *
 * Replaces `sanitize-html` configured as
 *   { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'recursiveEscape' }
 * which was the only way this codebase used it.
 *
 * WHY NOT sanitize-html: v2.18+ depends on an ESM-only htmlparser2@12. Vercel's
 * serverless Node launcher cannot `require()` ES modules (ERR_REQUIRE_ESM), so the
 * function crashed at cold start and every route returned 500. Native Node 22 does
 * support require(esm), so local dev and CI never reproduced it.
 *
 * Dependency policy: `entities` must stay on a CommonJS release (4.x, pinned via
 * root package.json overrides). Do not move it to an ESM-only major without
 * verifying on a Vercel preview deploy. scripts/check-esm-only-deps.mjs enforces this.
 *
 * Algorithm: tokenize the RAW input into tags and text FIRST, then decode character
 * references only inside text and re-escape `& < >`. Decoding before tokenizing would
 * let `&lt;!--` become a live comment on a second pass; this order keeps the function
 * idempotent, so running it in more than one middleware is safe.
 *
 * Behavior (verified differentially against sanitize-html@2.18.1, see tests):
 *  - Every tag is escaped to inert text (`<b>` -> `&lt;b&gt;`), never emitted raw.
 *  - Attributes are DROPPED (`<img src=x onerror=...>` -> `&lt;img /&gt;`), so
 *    handler/URL payloads do not survive even as escaped text.
 *  - Comments, doctype, processing instructions and stray closing tags are removed.
 *  - A lone `<` or `>` ("a < b") is escaped as text.
 */
import { decodeHTML } from 'entities';

/** Decode references in a text segment, then escape the three markup-significant characters. */
function renderText(text: string): string {
  return decodeHTML(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Find the '>' closing a tag starting after `from`, ignoring '>' inside quoted attribute values. */
function findTagEnd(s: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < s.length; i += 1) {
    const ch = s.charAt(i);
    if (quote !== null) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

/** HTML void elements: never have children or a closing tag, always render as `<name />`. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed', 'frame', 'hr', 'image',
  'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Render a tag as inert text with attributes dropped, tracking open tags so that
 * orphan closing tags are removed (matching sanitize-html). Doctype and processing
 * instructions render to '' (dropped).
 */
function renderTag(rawTag: string, openTags: string[]): string {
  const m = /^(\/?)\s*([A-Za-z][\d:A-Za-z-]*)/.exec(rawTag);
  if (m === null) return '';
  const isClosing = m[1] === '/';
  const name = (m[2] ?? '').toLowerCase();
  const display = m[2] ?? '';

  if (isClosing) {
    // sanitize-html treats a stray </br> as <br>.
    if (name === 'br') return '&lt;br /&gt;';
    const at = openTags.lastIndexOf(name);
    if (at === -1) return '';
    openTags.length = at;
    return `&lt;/${display}&gt;`;
  }

  if (VOID_ELEMENTS.has(name) || /\/\s*$/.test(rawTag)) return `&lt;${display} /&gt;`;
  openTags.push(name);
  return `&lt;${display}&gt;`;
}

/**
 * Neutralize HTML in untrusted text. Idempotent on its own output.
 */
export function escapeHtmlStrict(input: string): string {
  const openTags: string[] = [];
  let out = '';
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf('<', i);
    if (lt === -1) {
      out += renderText(input.slice(i));
      break;
    }
    out += renderText(input.slice(i, lt));

    // Comments: drop through the closing marker (or to end if unterminated).
    if (input.startsWith('<!--', lt)) {
      const end = input.indexOf('-->', lt + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }

    // '<' not followed by a tag-start char is plain text ("a < b", "<3").
    if (!/[!/?A-Za-z]/.test(input.charAt(lt + 1))) {
      out += '&lt;';
      i = lt + 1;
      continue;
    }

    const gt = findTagEnd(input, lt + 1);
    if (gt === -1) {
      // Unterminated tag: keep the remainder as escaped, inert text (no live attributes).
      out += `&lt;${renderText(input.slice(lt + 1))}`;
      break;
    }
    out += renderTag(input.slice(lt + 1, gt), openTags);
    i = gt + 1;
  }
  return out;
}
