/**
 * A theme's starting point (documentation/site-ui/theming.md §4): the values of the tokens a theme can change,
 * read from the site's own tokens, so every theme is a set of changes to the design system rather than a second
 * copy of it. Pure: built from the token model on the server and handed to the editor's Theme screen as JSON.
 */
import { aliasOf, resolve, type Model, type Token } from '../design/tokenModel';
import { COLOR_ROLES, type ColorRole } from './model';

/** A size in rem at the small end (360 px) and the large end (1280 px) of the fluid range; equal when fixed. */
export interface Span {
  min: number;
  max: number;
}

export interface ThemeBase {
  /** Each role's value (a hex, or rgb() for a translucent role) in each mode. */
  roles: Record<'light' | 'dark', Record<string, string>>;
  /** The primitive each role names in each mode (`p.color.indigo.700`), if it names one. */
  refs: Record<'light' | 'dark', Record<string, string | null>>;
  /** Every colour primitive's value, by its path (`p.color.indigo.700`). */
  primitives: Record<string, string>;
  /** The roles the reader's "more contrast" setting swaps, and the role each becomes. */
  more: Record<string, string>;
  /** The type ramp: `--text-<name>`. */
  text: Record<string, Span>;
  /** The space scale (`--space-<name>`) and the layout's whitespace (gutter, block, section). */
  space: Record<string, Span>;
  /** The radius scale (`--radius-<name>`), in rem. */
  radius: Record<string, number>;
  /** The font stacks of each role. */
  fonts: { display: string; text: string; ui: string };
}

/** The layout's whitespace: the fluid spaces a density setting scales more than the rest. */
export const LAYOUT_SPACES = ['gutter', 'block', 'section'];

const remOf = (v: unknown): number => {
  const o = v as { value: number; unit: string };
  if (!o || typeof o.value !== 'number' || o.unit !== 'rem') throw new Error(`expected a rem dimension, got ${JSON.stringify(v)}`);
  return o.value;
};

const span = (t: Token): Span => ({ min: t.fluidMin !== undefined ? remOf(t.fluidMin) : remOf(t.value), max: remOf(t.value) });

/** The base of every theme: the site's own token values. */
export function themeBase(m: Model): ThemeBase {
  const role = (r: string) => m.byPath.get(`color.${r}`);
  const roles: ThemeBase['roles'] = { light: {}, dark: {} };
  const refs: ThemeBase['refs'] = { light: {}, dark: {} };
  for (const r of [...COLOR_ROLES, 'frost', 'frost-strong', 'scrim', 'smoke', 'smoke-faint', 'shadow', 'shadow-strong'] as (ColorRole | string)[]) {
    const t = role(r);
    if (!t) throw new Error(`no colour role ${r}`);
    for (const mode of ['light', 'dark'] as const) {
      roles[mode][r] = resolve(t, m.byPath, mode);
      refs[mode][r] = aliasOf(t, mode);
    }
  }
  const primitives: Record<string, string> = {};
  for (const t of m.tokens) if (t.path[0] === 'p' && t.path[1] === 'color') primitives[t.path.join('.')] = resolve(t, m.byPath);
  const more: Record<string, string> = {};
  for (const t of m.tokens) {
    if (t.path[0] !== 'color' || t.more === undefined) continue;
    const to = /^\{color\.([\w-]+)\}$/.exec(String(t.more))?.[1];
    if (to) more[t.path[1]] = to;
  }
  const text: Record<string, Span> = {};
  const space: Record<string, Span> = {};
  const radius: Record<string, number> = {};
  for (const t of m.tokens) {
    if (t.path.length !== 2) continue;
    if (t.path[0] === 'text') text[t.path[1]] = span(t);
    else if (t.path[0] === 'space' && t.path[1] !== '0') space[t.path[1]] = span(t);
    else if (t.path[0] === 'radius' && t.path[1] !== 'none') radius[t.path[1]] = remOf(t.value);
  }
  const font = (r: string) => resolve(m.byPath.get(`font.${r}`)!, m.byPath);
  return { roles, refs, primitives, more, text, space, radius, fonts: { display: font('display'), text: font('text'), ui: font('ui') } };
}
