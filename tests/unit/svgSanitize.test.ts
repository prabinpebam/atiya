import { describe, expect, it } from 'vitest';
import { sanitizeSvg, SVG_MAX_BYTES, type SvgResult, type SvgSanitized } from '../../src/site/editor/model/svgSanitize';

// gallery spec §4.1: a drawing is cleaned before it's kept, and refused when it can't be made safe

const ok = (r: SvgResult): SvgSanitized => {
  if (!r.ok) throw new Error(`refused: ${r.error}`);
  return r;
};
const refused = (r: SvgResult): string => {
  if (r.ok) throw new Error(`kept: ${r.svg}`);
  return r.error;
};
const wrap = (inner: string, attrs = 'viewBox="0 0 100 50"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;
/** No live code or outside address left anywhere in the cleaned text. */
const inert = (svg: string) => {
  expect(svg).not.toMatch(/<script/i);
  expect(svg).not.toMatch(/\son\w+\s*=/i);
  expect(svg).not.toMatch(/javascript:/i);
  expect(svg).not.toMatch(/foreignObject/i);
  expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/(2000\/svg|1999\/xlink)")/i);
};

describe('a clean drawing', () => {
  it('passes through, with its size from its viewBox and nothing removed', () => {
    const r = ok(sanitizeSvg(wrap('<title>Sun</title><g fill="#f90"><circle cx="50" cy="25" r="20"/><path d="M0 0L10 10"/></g>')));
    expect(r.removed).toEqual([]);
    expect([r.width, r.height]).toEqual([100, 50]);
    expect(r.svg).toContain('<circle cx="50" cy="25" r="20"/>');
    expect(r.svg).toContain('<title>Sun</title>');
    expect(r.svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="50" viewBox="0 0 100 50">/);
  });

  it('keeps its own size in pixels when it gives one, and makes a viewBox from a width and height', () => {
    const own = ok(sanitizeSvg(wrap('<rect width="1" height="1"/>', 'width="2in" height="96pt" viewBox="0 0 10 5"')));
    expect([own.width, own.height]).toEqual([192, 128]);
    const made = ok(sanitizeSvg(wrap('<rect width="1" height="1"/>', 'width="300" height="200px"')));
    expect(made.svg).toContain('viewBox="0 0 300 200"');
    expect([made.width, made.height]).toEqual([300, 200]);
    // a percentage isn't a size: the viewBox's is used
    const pct = ok(sanitizeSvg(wrap('<rect width="1" height="1"/>', 'width="100%" height="100%" viewBox="0 0 640 480"')));
    expect([pct.width, pct.height]).toEqual([640, 480]);
  });

  it('refuses one with no viewBox and no size to make one from', () => {
    expect(refused(sanitizeSvg(wrap('<rect/>', 'width="100%"')))).toMatch(/no viewBox/);
  });

  it('keeps gradients, fragment references, a style sheet with local url()s and embedded rasters', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = ok(
      sanitizeSvg(
        wrap(
          `<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><symbol id="s"><rect width="5" height="5"/></symbol></defs>` +
            `<style>.a{fill:url(#g)} .b{font-weight:700}</style>` +
            `<rect class="a" fill="url('#g')" width="10" height="10"/><use href="#s" x="20"/><use xlink:href="#s" x="40"/>` +
            `<image href="data:image/png;base64,${png}" width="1" height="1"/>`,
          'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50"',
        ),
      ),
    );
    expect(r.removed).toEqual([]);
    expect(r.svg).toContain('<style>.a{fill:url(#g)} .b{font-weight:700}</style>');
    expect(r.svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(r.svg).toContain('<use xlink:href="#s" x="40"/>');
    expect(r.svg).toContain(`data:image/png;base64,${png}`);
  });

  it('reads bytes as UTF-8 and refuses another encoding', () => {
    const r = ok(sanitizeSvg(new TextEncoder().encode(`\uFEFF<?xml version="1.0"?>${wrap('<text>Café</text>')}`)));
    expect(r.svg).toContain('<text>Café</text>');
    expect(refused(sanitizeSvg(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0xff, 0xfe])))).toMatch(/UTF-8/);
  });

  it('escapes text and attributes again as it writes them', () => {
    const r = ok(sanitizeSvg(wrap('<text data-x="a &amp; &quot;b&quot;">1 &lt; 2 &#x26; &#38;</text>')));
    expect(r.svg).toContain('<text data-x="a &amp; &quot;b&quot;">1 &lt; 2 &amp; &amp;</text>');
  });
});

describe('what cleaning removes, and says so', () => {
  it('scripts, in any case and with CDATA, with nothing of them left', () => {
    const r = ok(sanitizeSvg(wrap('<script>alert(1)</script><SCRIPT type="text/javascript"><![CDATA[alert(2)]]></SCRIPT><rect width="1" height="1"/>')));
    expect(r.removed).toEqual(['scripts (2)']);
    expect(r.svg).not.toContain('alert');
    inert(r.svg);
  });

  it('event handlers on every element, the root too', () => {
    const r = ok(sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(1)"><rect onclick="x()" ONMOUSEOVER="y()" width="1" height="1"/></svg>`));
    expect(r.removed).toEqual(['event handlers (3)']);
    inert(r.svg);
  });

  it('foreignObject with the HTML inside it', () => {
    const r = ok(sanitizeSvg(wrap('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><iframe src="http://evil.example/"></iframe><img src="x" onerror="alert(1)"/></div></foreignObject><circle r="1"/>')));
    expect(r.removed).toEqual(['foreignObject (outside markup)']);
    expect(r.svg).not.toMatch(/iframe|img|evil/);
    inert(r.svg);
  });

  it('a link\'s tag, keeping what it draws', () => {
    const r = ok(sanitizeSvg(wrap('<a href="javascript:alert(1)"><rect width="1" height="1"/></a>')));
    expect(r.removed).toEqual(['links']);
    expect(r.svg).toContain('<rect width="1" height="1"/>');
    inert(r.svg);
  });

  it('an animation that would set a link or a handler', () => {
    const r = ok(sanitizeSvg(wrap('<rect width="1" height="1"><set attributeName="onclick" to="alert(1)"/><animate attributeName="xlink:href" values="#a"/><animate attributeName="x" from="0" to="5" dur="1s"/></rect>')));
    expect(r.removed).toEqual(['animations that change links or handlers (2)']);
    expect(r.svg).toContain('attributeName="x"');
    inert(r.svg);
  });

  it('comments, metadata, a document type and editors\' own data', () => {
    const r = ok(
      sanitizeSvg(
        `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><!-- made by hand -->` +
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 1 1" inkscape:version="1.3">` +
          `<metadata><rdf:RDF/></metadata><inkscape:namedview id="n"/><rect inkscape:label="box" width="1" height="1"/></svg>`,
      ),
    );
    expect(r.removed).toEqual(['the document type', 'comments', 'editor data (attributes) (2)', 'metadata', 'editor data (<inkscape:namedview>)']);
    expect(r.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>\n');
  });

  it('elements a drawing isn\'t made of, with everything inside', () => {
    const r = ok(sanitizeSvg(wrap('<iframe src="http://evil.example"/><embed src="x.swf"/><handler>alert(1)</handler><rect width="1" height="1"/>')));
    expect(r.removed).toEqual(['<iframe> (not part of a drawing)', '<embed> (not part of a drawing)', '<handler> (not part of a drawing)']);
    inert(r.svg);
  });

  it('a base address for its links (xml:base)', () => {
    const r = ok(sanitizeSvg(wrap('<g xml:base="https://evil.example/"><use href="#a"/></g>')));
    expect(r.removed).toEqual(['editor data (attributes)']);
    inert(r.svg);
  });
});

describe('what it refuses, with what to do', () => {
  const cases: [string, string, RegExp][] = [
    ['a javascript: href on <use>', '<use href="javascript:alert(1)"/>', /javascript:/],
    ['a javascript: address hidden with white space and case', '<use href=" jAvA&#x09;script:alert(1)"/>', /javascript:/],
    ['a javascript: address in another attribute', '<rect width="1" height="1" values="javascript:alert(1)"/>', /javascript:/],
    ['an outside picture', '<image href="https://evil.example/x.png" width="1" height="1"/>', /outside its own file/],
    ['a use of another file', '<use xlink:href="other.svg#a"/>', /outside its own file/],
    ['a protocol-relative address', '<use href="//evil.example/a.svg#x"/>', /outside its own file/],
    ['a data: drawing inside it', '<image href="data:image/svg+xml;base64,PHN2Zy8+" width="1" height="1"/>', /drawing inside it/],
    ['a data: HTML page', '<image href="data:text/html,&lt;script&gt;" width="1" height="1"/>', /javascript:/],
    ['an outside url() in an attribute', '<rect fill="url(https://evil.example/p.svg#g)" width="1" height="1"/>', /outside its own file/],
    ['an outside url() in a style attribute', '<rect style="fill:url(//evil.example/g)" width="1" height="1"/>', /outside its own file/],
    ['@import in a style sheet', '<style>@import url(https://evil.example/s.css);</style>', /imports another style sheet/],
    ['@import without url()', '<style>@import "s.css";</style>', /imports another style sheet/],
    ['a web font from outside', '<style>@font-face{font-family:x;src:url(https://evil.example/f.woff2)}</style>', /outside its own file/],
    ['image-set() with a bare address', '<style>.a{background:image-set("https://evil.example/a.png" 1x)}</style>', /without url\(\)/],
    ['escaped characters in a style', '<style>.a{fill:u\\72l(https://evil.example)}</style>', /escaped characters/],
    ['code in a style', '<rect style="width:expression(alert(1))"/>', /runs code/],
    ['an unreadable url()', '<rect fill="url(#a" width="1" height="1"/>', /can't read/],
  ];
  for (const [what, inner, why] of cases) {
    it(what, () => {
      expect(refused(sanitizeSvg(wrap(inner)))).toMatch(why);
    });
  }

  it('entities it would have to define, and a document type that declares them', () => {
    expect(refused(sanitizeSvg(`<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>${wrap('<text>&x;</text>')}`))).toMatch(/entities/);
    expect(refused(sanitizeSvg(wrap('<text>&nbsp;</text>')))).toMatch(/entity/);
  });

  it('embedded pictures over 200 KB together', () => {
    const big = 'A'.repeat(150 * 1024);
    const r = sanitizeSvg(wrap(`<image href="data:image/png;base64,${big}" width="1" height="1"/><image href="data:image/jpeg;base64,${big}" width="1" height="1"/>`));
    expect(refused(r)).toMatch(/embedded pictures weigh over 200 KB/);
  });

  it('a drawing over 200 KB', () => {
    const path = `<path d="${'M0 0L1 1'.repeat(Math.ceil(SVG_MAX_BYTES / 8))}"/>`;
    expect(refused(sanitizeSvg(wrap(path)))).toMatch(/up to 200 KB/);
  });

  it('what isn\'t well-formed, or isn\'t a drawing', () => {
    expect(refused(sanitizeSvg(wrap('<g><rect width="1" height="1"></g>')))).toMatch(/well formed/);
    expect(refused(sanitizeSvg(wrap('<g>')))).toMatch(/well formed/);
    expect(refused(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g></g>'))).toMatch(/never closed/);
    expect(refused(sanitizeSvg('<html><svg/></html>'))).toMatch(/isn't an SVG/);
    expect(refused(sanitizeSvg(`${wrap('')}${wrap('')}`))).toMatch(/more than one/);
    expect(refused(sanitizeSvg(`hello ${wrap('')}`))).toMatch(/outside its <svg>/);
    expect(refused(sanitizeSvg(wrap('<rect width="1" <g/>')))).toMatch(/never ends/);
  });
});

describe('the cleaned drawing is clean again', () => {
  it('cleaning twice changes nothing more', () => {
    const once = ok(sanitizeSvg(wrap('<script>x</script><rect onclick="y()" width="1" height="1"/><!-- c -->')));
    const twice = ok(sanitizeSvg(once.svg));
    expect(twice.removed).toEqual([]);
    expect(twice.svg).toBe(once.svg);
  });
});
