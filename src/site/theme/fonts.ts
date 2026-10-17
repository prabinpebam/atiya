/**
 * A theme's fonts (documentation/site-ui/theming.md §5.2): each role's stack, from a preset face or a font
 * imported into content/fonts/, always ending in the role's own fallbacks, so a font that doesn't load leaves the
 * page readable in the face it would have had.
 */
import { CUSTOM_FONT, ROLE_FALLBACK, faceById, type FontRef, type FontRole } from './model';

export type FontCategory = 'serif' | 'sans-serif' | 'monospace' | 'display' | 'handwriting';
export const FONT_CATEGORIES: readonly FontCategory[] = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'];

/** A font imported into the site (content/fonts/<id>.json, its files beside it). */
export interface FontFile {
  id: string;
  /** Its family name, as its @font-face names it. */
  family: string;
  category: FontCategory;
  /** Where it was imported from (a stylesheet or a font file's address). */
  source: string;
  /** Its licence, as the person says it (Google Fonts' are the SIL Open Font License). */
  licence?: string;
  /** Its files: one per style, a variable font's weight a range (`100 900`). */
  faces: { style: 'normal' | 'italic'; weight: string; file: string }[];
}

const MONO = "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace";

/** The stack a custom font falls back to: the role's own face if it's of the same kind, else a face of its kind. */
function fallbackFor(role: FontRole, category: FontCategory): string {
  if (category === 'monospace') return MONO;
  const own = faceById(ROLE_FALLBACK[role])!;
  if (category === own.category || category === 'display' || category === 'handwriting') return own.stack;
  return faceById(category === 'serif' ? 'newsreader' : 'figtree')!.stack;
}

const quote = (family: string) => `'${family.replace(/['\\]/g, '')}'`;

/** A role's font stack for a theme's choice, and the imported font it needs (if any). */
export function fontStack(ref: FontRef, role: FontRole, fonts: ReadonlyMap<string, FontFile>): { stack: string; font?: FontFile } {
  const face = faceById(ref);
  if (face) return { stack: face.stack };
  const id = CUSTOM_FONT.exec(ref)?.[1];
  const font = id ? fonts.get(id) : undefined;
  // a font that's gone (deleted, never imported) leaves the role's own face
  if (!font) return { stack: faceById(ROLE_FALLBACK[role])!.stack };
  return { stack: `${quote(font.family)}, ${fallbackFor(role, font.category)}`, font };
}

/** @font-face rules for the imported fonts a theme uses. */
export function fontFaces(fonts: FontFile[], url: (file: string) => string): string {
  return fonts
    .flatMap((f) =>
      f.faces.map((face) =>
        [
          '@font-face {',
          `  font-family: ${quote(f.family)};`,
          `  font-style: ${face.style};`,
          `  font-weight: ${face.weight};`,
          '  font-display: swap;',
          `  src: url('${url(face.file)}') format('woff2');`,
          '}',
        ].join('\n'),
      ),
    )
    .join('\n');
}
