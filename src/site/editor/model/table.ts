/**
 * A table block's cells as the inspector writes them (documentation/editor/spec.md §3.5): the column
 * headings on the first line, then a row a line, its cells split by "|" (a "|" in a cell written "\|").
 * A row with fewer cells than columns is filled with empty ones. Pure, so both directions are unit-tested.
 */
import { TABLE_MAX_COLUMNS, TABLE_MAX_ROWS, type Block } from '../../content/schema';

type Table = Extract<Block, { type: 'table' }>;

const escapeCell = (c: string) => c.replace(/\|/g, '\\|');

/** A line's cells: split at each "|" not written "\|", trimmed, with "\|" back to "|". */
export function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (line[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += line[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** The table as the inspector's text. */
export function tableToText(t: Pick<Table, 'columns' | 'rows'>): string {
  return [t.columns, ...t.rows].map((r) => r.map(escapeCell).join(' | ')).join('\n');
}

/** The inspector's text as the table's columns and rows, or why it isn't one. */
export function textToTable(text: string): { ok: true; columns: string[]; rows: string[][] } | { ok: false; why: string } {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, why: 'Write the column headings on the first line, and at least one row under them.' };
  const columns = splitCells(lines[0]);
  if (columns.length > TABLE_MAX_COLUMNS) return { ok: false, why: `Keep it to ${TABLE_MAX_COLUMNS} columns.` };
  if (columns.some((c) => !c)) return { ok: false, why: 'Give every column a heading.' };
  if (columns.some((c) => c.length > 80)) return { ok: false, why: 'Keep each column heading to 80 characters.' };
  if (lines.length - 1 > TABLE_MAX_ROWS) return { ok: false, why: `Keep it to ${TABLE_MAX_ROWS} rows.` };
  const rows: string[][] = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = splitCells(lines[n]);
    if (cells.length > columns.length) return { ok: false, why: `Row ${n} has ${cells.length} cells, but there are ${columns.length} columns: add a column heading, or write a "|" in a cell as "\\|".` };
    rows.push([...cells, ...Array<string>(columns.length - cells.length).fill('')]);
  }
  return { ok: true, columns, rows };
}

/** A new table to start from: two columns, two empty rows. */
export const starterTable = (): Table => ({ type: 'table', columns: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']] });
