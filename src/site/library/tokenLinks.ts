/** Where a token is shown in the design library: its token page, at its row. */
import { withBase } from '../design/meta';

const PAGE: [RegExp, string][] = [
  [/^--(p-color|color)-/, 'color'],
  [/^--(p-font|font|axes|text|leading|tracking|weight)-/, 'typography'],
  [/^--(space|size)-/, 'space'],
  [/^--(radius|border|shadow)-/, 'shape'],
  [/^--(duration|ease)-/, 'motion'],
  [/^--(layer|breakpoint|opacity|c)-/, 'layers'],
];

export const tokenPage = (name: string): string => PAGE.find(([re]) => re.test(name))?.[1] ?? 'layers';
export const tokenAnchor = (name: string): string => `token${name.slice(1)}`;
export const tokenHref = (name: string): string => withBase(`/design/tokens/${tokenPage(name)}/#${tokenAnchor(name)}`);
