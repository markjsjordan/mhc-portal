/* eslint-disable sonarjs/code-eval -- test file intentionally contains XSS payload strings */
import { describe, it, expect } from 'vitest';
import { escapeHtmlStrict } from '../html-escape';

/**
 * Expected values were captured from sanitize-html@2.18.1 configured with
 * { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: 'recursiveEscape' },
 * the behavior this util replaces. Divergences on malformed input are documented
 * inline: we intentionally choose the safer (fully escaped) output there.
 */
describe('escapeHtmlStrict', () => {
  describe('parity with the sanitize-html configuration it replaces', () => {
    const parity: Array<[string, string]> = [
      ['<script>alert("XSS")</script>John Doe', '&lt;script&gt;alert("XSS")&lt;/script&gt;John Doe'],
      ['Hello<script>malicious()</script> World', 'Hello&lt;script&gt;malicious()&lt;/script&gt; World'],
      ['<img src=x onerror="alert(1)">', '&lt;img /&gt;'],
      ['<a href="javascript:alert(1)">Click</a>', '&lt;a&gt;Click&lt;/a&gt;'],
      ['<div><p>Hello</p><b>World</b></div>', '&lt;div&gt;&lt;p&gt;Hello&lt;/p&gt;&lt;b&gt;World&lt;/b&gt;&lt;/div&gt;'],
      ['<<script>script>alert(1)<</script>/script>', '&lt;&lt;script&gt;script&gt;alert(1)&lt;&lt;/script&gt;/script&gt;'],
      ['<textarea></textarea/><img src=x onerror=alert(1)>', '&lt;textarea&gt;&lt;/textarea&gt;&lt;img /&gt;'],
      ['<a title=">" href=x>t</a>', '&lt;a&gt;t&lt;/a&gt;'],
      ["<a title='>' onclick=x>t</a>", '&lt;a&gt;t&lt;/a&gt;'],
      ['<br/>', '&lt;br /&gt;'],
      ['<br>x</br>', '&lt;br /&gt;x&lt;br /&gt;'],
      ['<img src=x></img>', '&lt;img /&gt;'],
      ['<!-- c -->t', 't'],
      ['<!DOCTYPE html>', ''],
      ['<?xml ?>', ''],
      ['日本語 <b>テスト</b>', '日本語 &lt;b&gt;テスト&lt;/b&gt;'],
      ['line1\n<b>line2</b>\r\n', 'line1\n&lt;b&gt;line2&lt;/b&gt;\r\n'],
    ];
    it.each(parity)('%j', (input, expected) => {
      expect(escapeHtmlStrict(input)).toBe(expected);
    });
  });

  describe('orphan and mismatched closing tags', () => {
    const cases: Array<[string, string]> = [
      ['</b>', ''],
      ['x</b>', 'x'],
      ['<b></b>', '&lt;b&gt;&lt;/b&gt;'],
      ['<b>a</b></b>', '&lt;b&gt;a&lt;/b&gt;'],
      ['<i></b>', '&lt;i&gt;'],
      ['<b></i></b>', '&lt;b&gt;&lt;/b&gt;'],
      ['<b><i></b></i>', '&lt;b&gt;&lt;i&gt;&lt;/b&gt;'],
      ['<div><span></div></span>', '&lt;div&gt;&lt;span&gt;&lt;/div&gt;'],
      ['<script>x</script></script>', '&lt;script&gt;x&lt;/script&gt;'],
    ];
    it.each(cases)('%j', (input, expected) => {
      expect(escapeHtmlStrict(input)).toBe(expected);
    });
  });

  describe('plain text and entities', () => {
    const cases: Array<[string, string]> = [
      ['plain text', 'plain text'],
      ['', ''],
      ['a < b > c', 'a &lt; b &gt; c'],
      ['<3', '&lt;3'],
      ["O'Brien & Sons", "O'Brien &amp; Sons"],
      ['AT&T', 'AT&amp;T'],
      ['Price: $5 & up <3 AT&amp;T', 'Price: $5 &amp; up &lt;3 AT&amp;T'],
      ['&copy; &eacute;', '© é'],
      ['&quot;hi&quot;', '"hi"'],
      ['&amp;lt;', '&amp;lt;'],
      ['&unknown;', '&amp;unknown;'],
    ];
    it.each(cases)('%j', (input, expected) => {
      expect(escapeHtmlStrict(input)).toBe(expected);
    });
  });

  describe('entity-encoded markup cannot smuggle a tag', () => {
    it('decodes then re-escapes numeric references', () => {
      expect(escapeHtmlStrict('&#60;script&#62;')).toBe('&lt;script&gt;');
      expect(escapeHtmlStrict('&#x3c;script&#x3e;')).toBe('&lt;script&gt;');
    });
    it('keeps an already-escaped tag inert (not decoded into a live tag)', () => {
      expect(escapeHtmlStrict('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
    it('does not turn an escaped comment opener into a live comment on a second pass', () => {
      const once = escapeHtmlStrict('&lt;!--x--&gt;');
      expect(once).toBe('&lt;!--x--&gt;');
      expect(escapeHtmlStrict(once)).toBe(once);
    });
  });

  describe('malformed input fails safe', () => {
    it('escapes an unterminated tag instead of emitting live attributes', () => {
      // sanitize-html returns the bare attribute text `href="x`; we keep it fully escaped.
      expect(escapeHtmlStrict('<a href="x')).toBe('&lt;a href="x');
    });
    it('never emits a raw angle bracket', () => {
      for (const s of ['<', '>', '<<', '<>', '<a', '<!', '<?', '< script>', '<a "<b>']) {
        expect(escapeHtmlStrict(s)).not.toMatch(/[<>]/);
      }
    });
    it('never leaves an unescaped ampersand', () => {
      for (const s of ['&', '&&', '&a', '&#', '&#x;', 'a&b;c', '&amp']) {
        expect(escapeHtmlStrict(s)).not.toMatch(/&(?!(?:lt|gt|amp);)/);
      }
    });
    it('drops invalid numeric references rather than emitting a control character', () => {
      expect(escapeHtmlStrict('x&#0;y')).not.toContain('\u0000');
    });
  });

  describe('properties', () => {
    // Deterministic PRNG so the property test is reproducible.
    const atoms = ['<', '>', '&', '"', "'", '/', '=', ' ', 'script', 'img', 'onerror', 'javascript:', '&#60;', '&#x3e;', '&lt;', 'a', '!--', '?'];
    const fuzz: string[] = [];
    let seed = 1337;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let n = 0; n < 3000; n += 1) {
      let s = '';
      const len = 1 + Math.floor(rnd() * 14);
      for (let k = 0; k < len; k += 1) s += atoms[Math.floor(rnd() * atoms.length)] ?? '';
      fuzz.push(s);
    }

    it('output never contains < or >, and only &lt; &gt; &amp; entities', () => {
      for (const s of fuzz) {
        const out = escapeHtmlStrict(s);
        expect(out).not.toMatch(/[<>]/);
        expect(out).not.toMatch(/&(?!(?:lt|gt|amp);)/);
      }
    });

    it('is idempotent, so running it in more than one middleware is safe', () => {
      for (const s of fuzz) {
        const once = escapeHtmlStrict(s);
        expect(escapeHtmlStrict(once)).toBe(once);
      }
    });
  });
});
