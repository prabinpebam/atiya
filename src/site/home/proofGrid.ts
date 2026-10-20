/**
 * Proof grid's table (documentation/home-views/proof-grid.md §3, §4; for-every-site.md §3.3): a row per strength
 * shown, a column per kind of proof, and in each cell how much of that kind proves it. Counted from the picks, never
 * typed: a cell is filled when something of it is on the site (a page, a colleague's words), outlined when it's all
 * résumé lines, empty when there's none. Pure.
 */
import type { HomePicks, StrengthPicks } from './curate';
import { KIND_LABEL, evidenceItem, strengthsInOrder, type EvidenceItem, type PresentEnv } from './present';
import { PROOF_KINDS, type ProofKind } from './schema';

/** The most columns the grid has (controls.md §3). */
export const MAX_COLUMNS = 5;

export interface ProofGridSettings {
  /** Full: each cell's count; calm: its mark only. */
  density: 'calm' | 'full';
  /** The person's order, or by the depth of their proof (a lens overrides both). */
  order: 'yours' | 'strongest';
  /** The person's columns, in their order; none: the kinds the site uses most. */
  columns?: ProofKind[];
  /** An empty cell: a faint dot, or nothing. */
  empty: 'show' | 'hide';
}

export const PROOF_GRID_DEFAULTS: ProofGridSettings = { density: 'full', order: 'yours', empty: 'show' };

const isKind = (k: unknown): k is ProofKind => (PROOF_KINDS as readonly unknown[]).includes(k);

/** The view's settings as Proof grid reads them, anything unknown taken as its default. */
export function proofGridSettings(s: Record<string, unknown> = {}): ProofGridSettings {
  const list = Array.isArray(s.columns) ? s.columns : [];
  const columns = list.length > 0 && list.length <= MAX_COLUMNS && list.every(isKind) && new Set(list).size === list.length ? (list as ProofKind[]) : undefined;
  return {
    density: s.density === 'calm' || s.density === 'full' ? s.density : PROOF_GRID_DEFAULTS.density,
    order: s.order === 'yours' || s.order === 'strongest' ? s.order : PROOF_GRID_DEFAULTS.order,
    ...(columns ? { columns } : {}),
    empty: s.empty === 'show' || s.empty === 'hide' ? s.empty : PROOF_GRID_DEFAULTS.empty,
  };
}

/** Every proof item of a strength that can be shown (it leads somewhere, or can be asked about). */
const shownItems = (s: StrengthPicks, env: PresentEnv): EvidenceItem[] => s.all.flatMap((p) => evidenceItem(p, s, env) ?? []);

/** The columns: the person's, else the five kinds the strengths shown use most (ties in the kinds' own order), in that order. */
export function gridColumns(strengths: StrengthPicks[], settings: Pick<ProofGridSettings, 'columns'>, env: PresentEnv): ProofKind[] {
  if (settings.columns?.length) return settings.columns;
  const used = new Map<ProofKind, number>();
  for (const s of strengths) for (const item of shownItems(s, env)) if (item.kind) used.set(item.kind, (used.get(item.kind) ?? 0) + 1);
  const top = [...used].sort((a, b) => b[1] - a[1] || PROOF_KINDS.indexOf(a[0]) - PROOF_KINDS.indexOf(b[0])).slice(0, MAX_COLUMNS);
  return PROOF_KINDS.filter((k) => top.some(([kind]) => kind === k));
}

export type CellState = 'filled' | 'outlined' | 'empty';

export interface GridCell {
  kind: ProofKind;
  count: number;
  /** How many of them are on the site: pages and colleagues' words (the rest are résumé lines). */
  onSite: number;
  state: CellState;
  /** Everything it says, as its button's name: "Design leadership, led: 5 items, 2 on the site". */
  label: string;
}

/** A group of a row's evidence: one kind (a column), or the rest. */
export interface EvidenceGroup {
  kind: ProofKind | 'other';
  heading: string;
  items: EvidenceItem[];
}

export interface GridRow {
  id: string;
  name: string;
  short: string;
  line: string;
  /** Every piece of evidence it has, of any kind: "9 proofs" on a phone's closed row. */
  total: number;
  cells: GridCell[];
  /** Its evidence by column, then the rest; only groups with something in them. */
  groups: EvidenceGroup[];
}

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** A cell's name, which says everything its fill and count do. */
export function cellLabel(name: string, kind: ProofKind, count: number, onSite: number): string {
  const head = `${name}, ${KIND_LABEL[kind].toLowerCase()}`;
  if (count === 0) return `${head}: none`;
  return `${head}: ${items(count)}, ${onSite === 0 ? 'on the résumé' : `${onSite} on the site`}`;
}

export interface ProofGrid {
  columns: ProofKind[];
  rows: GridRow[];
}

export function proofGrid(picks: HomePicks, settings: ProofGridSettings, env: PresentEnv): ProofGrid {
  const strengths = strengthsInOrder(picks, settings.order);
  const columns = gridColumns(strengths, settings, env);
  const rows = strengths.map((s): GridRow => {
    const all = shownItems(s, env);
    const cells = columns.map((kind): GridCell => {
      const mine = all.filter((i) => i.kind === kind);
      const onSite = mine.filter((i) => i.source !== 'resume').length;
      const state: CellState = mine.length === 0 ? 'empty' : onSite > 0 ? 'filled' : 'outlined';
      return { kind, count: mine.length, onSite, state, label: cellLabel(s.capability.name, kind, mine.length, onSite) };
    });
    const other = all.filter((i) => !i.kind || !columns.includes(i.kind));
    const groups: EvidenceGroup[] = [
      ...columns.map((kind) => ({ kind, heading: KIND_LABEL[kind], items: all.filter((i) => i.kind === kind) })),
      { kind: 'other' as const, heading: 'Other evidence', items: other },
    ].filter((g) => g.items.length > 0);
    return { id: s.id, name: s.capability.name, short: s.capability.short, line: s.capability.line, total: all.length, cells, groups };
  });
  return { columns, rows };
}
