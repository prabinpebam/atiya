import { describe, expect, it } from 'vitest';
import { ILLUSTRATION_MAX, illustrationProblems, prepareIllustration } from '../../src/site/scripts/illustration';

const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
  <title>Two bars, the second twice the first</title>
  <desc>A drawing</desc>
  <!-- a comment -->
  <defs><linearGradient id="g"><stop offset="0" data-stop="accent"/><stop offset="1" data-stop="accent-soft" stop-opacity="0.4"/></linearGradient></defs>
  <rect x="10" y="50" width="30" height="40" rx="4" data-ink="accent" data-motion="grow"/>
  <rect x="60" y="10" width="30" height="80" rx="4" fill="url(#g)" data-motion="grow" data-step="1"/>
  <path d="M0 95 H200" data-line="rule" stroke-width="2" pathLength="1" data-motion="draw"/>
  <text x="100" y="20" font-size="11" text-anchor="middle" data-ink="muted">2&#215; &amp; more</text>
</svg>`;

describe('illustration: the check', () => {
  it('takes a drawing made of roles, shapes, gradients and motion', () => {
    expect(illustrationProblems(ok)).toEqual([]);
  });

  it.each([
    ['a script', '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>', '<script>'],
    ['a style', '<svg viewBox="0 0 1 1"><style>*{}</style></svg>', '<style>'],
    ['an event handler', '<svg viewBox="0 0 1 1"><rect onclick="x()" width="1" height="1"/></svg>', 'onclick'],
    ['a link', '<svg viewBox="0 0 1 1"><use href="#a"/></svg>', '<use>'],
    ['an outside picture', '<svg viewBox="0 0 1 1"><image href="https://x.test/a.png"/></svg>', '<image>'],
    ['foreign markup', '<svg viewBox="0 0 1 1"><foreignObject/></svg>', '<foreignObject>'],
    ['a style attribute', '<svg viewBox="0 0 1 1"><rect style="fill:red" width="1" height="1"/></svg>', 'style'],
    ['a colour', '<svg viewBox="0 0 1 1"><rect fill="#f00" width="1" height="1"/></svg>', 'colour role'],
    ['an outside reference', '<svg viewBox="0 0 1 1"><rect fill="url(https://x.test/#a)" width="1" height="1"/></svg>', 'fill'],
    ['an unknown role', '<svg viewBox="0 0 1 1"><rect data-ink="red" width="1" height="1"/></svg>', 'data-ink'],
    ['an unknown motion', '<svg viewBox="0 0 1 1"><rect data-motion="spin" width="1" height="1"/></svg>', 'data-motion'],
    ['a draw without its length', '<svg viewBox="0 0 1 1"><path d="M0 0H1" data-motion="draw"/></svg>', 'pathLength'],
    ['a moving part with its own transform', '<svg viewBox="0 0 1 1"><rect transform="rotate(4)" data-motion="grow" width="1" height="1"/></svg>', 'on a <g>'],
    ['a step too far', '<svg viewBox="0 0 1 1"><rect data-step="9" width="1" height="1"/></svg>', 'data-step'],
    ['no viewBox', '<svg><rect width="1" height="1"/></svg>', 'viewBox'],
    ['an unclosed tag', '<svg viewBox="0 0 1 1"><g></svg>', 'closes'],
    ['two roots', '<svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg>', 'one <svg>'],
    ['a doctype', '<!DOCTYPE svg><svg viewBox="0 0 1 1"></svg>', 'declarations'],
    ['CDATA', '<svg viewBox="0 0 1 1"><text><![CDATA[x]]></text></svg>', 'CDATA'],
    ['an unquoted value', '<svg viewBox="0 0 1 1"><rect width=1 height="1"/></svg>', 'well formed'],
    ['loose words', '<svg viewBox="0 0 1 1">hello</svg>', 'outside <text>'],
    ['a bare ampersand', '<svg viewBox="0 0 1 1"><text>A & B</text></svg>', 'entity'],
    ['another namespace', '<svg xmlns="http://evil.test" viewBox="0 0 1 1"></svg>', 'xmlns'],
    ['a javascript value', '<svg viewBox="0 0 1 1"><rect transform="javascript(1)" width="1" height="1"/></svg>', 'transform'],
    ['a wrapped root', '<div><svg viewBox="0 0 1 1"></svg></div>', '<div>'],
  ])('refuses %s', (_, svg, says) => {
    const problems = illustrationProblems(svg);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' | ')).toContain(says);
  });

  it('refuses one too long', () => {
    const long = `<svg viewBox="0 0 1 1">${'<g></g>'.repeat(ILLUSTRATION_MAX / 7 + 1)}</svg>`;
    expect(illustrationProblems(long).join()).toContain('at most');
  });
});

describe('illustration: drawing it', () => {
  const p = prepareIllustration(ok, 'ill-3');

  it('names it from its title, and hides the drawing itself', () => {
    expect(p.label).toBe('Two bars, the second twice the first');
    expect(p.markup).not.toMatch(/<title|<desc|<!--/);
    expect(p.markup).toMatch(/^<svg[^>]*aria-hidden="true" focusable="false">/);
  });

  it('makes its parts the page’s own', () => {
    expect(p.markup).toContain('id="ill-3-g"');
    expect(p.markup).toContain('fill="url(#ill-3-g)"');
    expect(p.markup).not.toContain('url(#g)');
  });

  it('fills its place, keeping its shape', () => {
    expect(p.markup).not.toMatch(/<svg[^>]*\s(width|height)=/);
    expect(p.ratio).toBe(2);
    expect(p.moves).toBe(true);
  });

  it('is decoration without a title', () => {
    const d = prepareIllustration('<svg viewBox="0 0 3 1"><rect width="1" height="1"/></svg>', 'x');
    expect(d.label).toBeUndefined();
    expect(d.moves).toBe(false);
    expect(d.ratio).toBe(3);
  });
});
