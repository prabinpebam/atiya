/**
 * A table block's direct-edit operations (documentation/editor/table-editing.md §8): pure changes that
 * keep its rows rectangular, enforce the editorial limits and say where focus returns.
 */
import { plainText } from '../../content/markdown';
import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS, type Block } from '../../content/schema';

export type Table = Extract<Block, { type: 'table' }>;
export type TableCell = { row: 'header' | number; column: number };
export type TableOperation =
  | { type: 'set-cell'; cell: TableCell; markdown: string }
  | { type: 'insert-row'; at: number }
  | { type: 'move-row'; from: number; to: number }
  | { type: 'delete-row'; row: number }
  | { type: 'insert-column'; at: number }
  | { type: 'move-column'; from: number; to: number }
  | { type: 'delete-column'; column: number };
export type TableProblem = 'stale-cell' | 'empty-heading' | 'heading-too-long' | 'invalid-cell' | 'row-limit' | 'column-limit' | 'last-row' | 'last-column';
export type TableResult =
  | { ok: true; table: Table; focus: TableCell; announcement: string }
  | { ok: false; code: TableProblem; message: string };

const fail = (code: TableProblem, message: string): TableResult => ({ ok: false, code, message });
const clamp = (n: number, last: number) => Math.max(0, Math.min(last, n));
const validCell = (table: Table, cell: TableCell) =>
  Number.isInteger(cell.column) &&
  cell.column >= 0 &&
  cell.column < table.columns.length &&
  (cell.row === 'header' || (Number.isInteger(cell.row) && cell.row >= 0 && cell.row < table.rows.length));
const generatedHeading = (table: Table) => {
  const used = new Set(table.columns.map((c) => plainText(c).trim()));
  let n = 1;
  while (used.has(`Column ${n}`)) n++;
  return `Column ${n}`;
};
const focusAfterColumn = (active: TableCell, column: number, rows: number): TableCell => ({
  row: active.row === 'header' ? 'header' : clamp(active.row, rows - 1),
  column,
});

/** Applies one valid table edit, or returns the actionable reason it cannot be applied. */
export function applyTableOperation(table: Table, operation: TableOperation, active: TableCell = operation.type === 'set-cell' ? operation.cell : { row: 'header', column: 0 }): TableResult {
  if (!validCell(table, active)) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');

  if (operation.type === 'set-cell') {
    if (!validCell(table, operation.cell)) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    if (/[\r\n]/.test(operation.markdown)) return fail('invalid-cell', 'A table cell is one line. Remove the line break and try again.');
    const columns = [...table.columns];
    const rows = table.rows.map((row) => [...row]);
    if (operation.cell.row === 'header') {
      const visible = plainText(operation.markdown).trim();
      if (!visible) return fail('empty-heading', 'Column headings cannot be empty. Add a heading to continue.');
      if (visible.length > 80) return fail('heading-too-long', 'Column headings can have up to 80 characters. Shorten this heading.');
      columns[operation.cell.column] = operation.markdown.trim();
    } else rows[operation.cell.row][operation.cell.column] = operation.markdown;
    return { ok: true, table: { ...table, columns, rows }, focus: operation.cell, announcement: 'Cell updated' };
  }

  if (operation.type === 'insert-row') {
    if (table.rows.length >= TABLE_MAX_ROWS) return fail('row-limit', `This table can have up to ${TABLE_MAX_ROWS} rows.`);
    if (!Number.isInteger(operation.at) || operation.at < 0 || operation.at > table.rows.length) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    const rows = table.rows.map((row) => [...row]);
    rows.splice(operation.at, 0, Array<string>(table.columns.length).fill(''));
    return { ok: true, table: { ...table, rows }, focus: { row: operation.at, column: 0 }, announcement: `Row added. ${rows.length} rows.` };
  }

  if (operation.type === 'move-row') {
    if (![operation.from, operation.to].every((n) => Number.isInteger(n) && n >= 0 && n < table.rows.length)) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    const rows = table.rows.map((row) => [...row]);
    const [moved] = rows.splice(operation.from, 1);
    rows.splice(operation.to, 0, moved);
    return { ok: true, table: { ...table, rows }, focus: { row: operation.to, column: active.column }, announcement: `Row moved to ${operation.to + 1} of ${rows.length}.` };
  }

  if (operation.type === 'delete-row') {
    if (table.rows.length === 1) return fail('last-row', 'A table needs at least one row.');
    if (!Number.isInteger(operation.row) || operation.row < 0 || operation.row >= table.rows.length) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    const rows = table.rows.map((row) => [...row]);
    rows.splice(operation.row, 1);
    return {
      ok: true,
      table: { ...table, rows },
      focus: { row: clamp(operation.row, rows.length - 1), column: active.column },
      announcement: `Row deleted. ${rows.length} rows.`,
    };
  }

  if (operation.type === 'insert-column') {
    if (table.columns.length >= TABLE_MAX_COLUMNS) return fail('column-limit', `This table can have up to ${TABLE_MAX_COLUMNS} columns.`);
    if (!Number.isInteger(operation.at) || operation.at < 0 || operation.at > table.columns.length) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    const columns = [...table.columns];
    columns.splice(operation.at, 0, generatedHeading(table));
    const rows = table.rows.map((row) => {
      const next = [...row];
      next.splice(operation.at, 0, '');
      return next;
    });
    return { ok: true, table: { ...table, columns, rows }, focus: { row: 'header', column: operation.at }, announcement: `Column added. ${columns.length} columns.` };
  }

  if (operation.type === 'move-column') {
    if (![operation.from, operation.to].every((n) => Number.isInteger(n) && n >= 0 && n < table.columns.length)) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
    const move = <T>(values: T[]) => {
      const next = [...values];
      const [moved] = next.splice(operation.from, 1);
      next.splice(operation.to, 0, moved);
      return next;
    };
    return {
      ok: true,
      table: { ...table, columns: move(table.columns), rows: table.rows.map(move) },
      focus: focusAfterColumn(active, operation.to, table.rows.length),
      announcement: `Column moved to ${operation.to + 1} of ${table.columns.length}.`,
    };
  }

  if (table.columns.length === 1) return fail('last-column', 'A table needs at least one column.');
  if (!Number.isInteger(operation.column) || operation.column < 0 || operation.column >= table.columns.length) return fail('stale-cell', 'The table changed before that action finished. Review it and try again.');
  const columns = table.columns.filter((_, column) => column !== operation.column);
  const rows = table.rows.map((row) => row.filter((_, column) => column !== operation.column));
  return {
    ok: true,
    table: { ...table, columns, rows },
    focus: focusAfterColumn(active, clamp(operation.column, columns.length - 1), rows.length),
    announcement: `Column deleted. ${columns.length} columns.`,
  };
}
