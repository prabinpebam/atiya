import { describe, expect, it } from 'vitest';
import { applyTableOperation, type Table } from '../../src/site/editor/model/tableGrid';

const table = (): Table => ({
  type: 'table',
  columns: ['**Name**', 'Role'],
  rows: [
    ['A', '*Design*'],
    ['B', 'Engineering'],
  ],
  rowHeadings: true,
});

describe('inline table operations', () => {
  it('sets rich headings and cells without mutating the table', () => {
    const before = table();
    const heading = applyTableOperation(before, { type: 'set-cell', cell: { row: 'header', column: 1 }, markdown: '[Work](https://example.com)' });
    expect(heading).toMatchObject({ ok: true, table: { columns: ['**Name**', '[Work](https://example.com)'] } });
    expect(before.columns).toEqual(['**Name**', 'Role']);
    const cell = applyTableOperation(before, { type: 'set-cell', cell: { row: 0, column: 1 }, markdown: '~~Old~~ **New**' });
    expect(cell).toMatchObject({ ok: true, table: { rows: [['A', '~~Old~~ **New**'], ['B', 'Engineering']] } });
  });

  it('refuses invalid headings and line breaks', () => {
    expect(applyTableOperation(table(), { type: 'set-cell', cell: { row: 'header', column: 0 }, markdown: '[](https://example.com)' })).toMatchObject({ ok: false, code: 'empty-heading' });
    expect(applyTableOperation(table(), { type: 'set-cell', cell: { row: 'header', column: 0 }, markdown: `**${'x'.repeat(81)}**` })).toMatchObject({ ok: false, code: 'heading-too-long' });
    expect(applyTableOperation(table(), { type: 'set-cell', cell: { row: 0, column: 0 }, markdown: 'a\nb' })).toMatchObject({ ok: false, code: 'invalid-cell' });
  });

  it('inserts, moves and deletes rows with the specified focus', () => {
    const inserted = applyTableOperation(table(), { type: 'insert-row', at: 1 }, { row: 0, column: 1 });
    expect(inserted).toMatchObject({ ok: true, focus: { row: 1, column: 0 }, table: { rows: [['A', '*Design*'], ['', ''], ['B', 'Engineering']] } });
    if (!inserted.ok) throw new Error('insert failed');
    const moved = applyTableOperation(inserted.table, { type: 'move-row', from: 1, to: 2 }, { row: 1, column: 1 });
    expect(moved).toMatchObject({ ok: true, focus: { row: 2, column: 1 }, announcement: 'Row moved to 3 of 3.' });
    if (!moved.ok) throw new Error('move failed');
    const removed = applyTableOperation(moved.table, { type: 'delete-row', row: 2 }, { row: 2, column: 1 });
    expect(removed).toMatchObject({ ok: true, focus: { row: 1, column: 1 }, table: { rows: [['A', '*Design*'], ['B', 'Engineering']] } });
  });

  it('inserts, moves and deletes columns in the heading and every row', () => {
    const inserted = applyTableOperation(table(), { type: 'insert-column', at: 1 }, { row: 0, column: 1 });
    expect(inserted).toMatchObject({
      ok: true,
      focus: { row: 'header', column: 1 },
      table: { columns: ['**Name**', 'Column 1', 'Role'], rows: [['A', '', '*Design*'], ['B', '', 'Engineering']] },
    });
    if (!inserted.ok) throw new Error('insert failed');
    const moved = applyTableOperation(inserted.table, { type: 'move-column', from: 2, to: 0 }, { row: 1, column: 2 });
    expect(moved).toMatchObject({
      ok: true,
      focus: { row: 1, column: 0 },
      table: { columns: ['Role', '**Name**', 'Column 1'], rows: [['*Design*', 'A', ''], ['Engineering', 'B', '']] },
    });
    if (!moved.ok) throw new Error('move failed');
    const removed = applyTableOperation(moved.table, { type: 'delete-column', column: 1 }, { row: 'header', column: 1 });
    expect(removed).toMatchObject({ ok: true, focus: { row: 'header', column: 1 }, table: { columns: ['Role', 'Column 1'], rows: [['*Design*', ''], ['Engineering', '']] } });
  });

  it('keeps generated headings unique by visible text and enforces limits', () => {
    const named: Table = { type: 'table', columns: ['**Column 1**'], rows: [['']] };
    expect(applyTableOperation(named, { type: 'insert-column', at: 1 })).toMatchObject({ ok: true, table: { columns: ['**Column 1**', 'Column 2'] } });
    expect(applyTableOperation({ ...table(), rows: Array.from({ length: 60 }, () => ['', '']) }, { type: 'insert-row', at: 60 })).toMatchObject({ ok: false, code: 'row-limit' });
    expect(applyTableOperation({ type: 'table', columns: Array.from({ length: 8 }, (_, i) => `C${i}`), rows: [Array(8).fill('')] }, { type: 'insert-column', at: 8 })).toMatchObject({
      ok: false,
      code: 'column-limit',
    });
  });

  it('keeps one row and one column and rejects stale coordinates', () => {
    expect(applyTableOperation({ type: 'table', columns: ['A'], rows: [['']] }, { type: 'delete-row', row: 0 })).toMatchObject({ ok: false, code: 'last-row' });
    expect(applyTableOperation({ type: 'table', columns: ['A'], rows: [['']] }, { type: 'delete-column', column: 0 })).toMatchObject({ ok: false, code: 'last-column' });
    expect(applyTableOperation(table(), { type: 'set-cell', cell: { row: 9, column: 0 }, markdown: 'x' })).toMatchObject({ ok: false, code: 'stale-cell' });
  });
});
