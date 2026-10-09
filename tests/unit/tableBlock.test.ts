import { describe, expect, it } from 'vitest';
import { block } from '../../src/site/content/schema';
import { splitCells, starterTable, tableToText, textToTable } from '../../src/site/editor/model/table';
import { excerptOf, kindOf } from '../../src/site/editor/model/ops';
import { wordCount } from '../../src/site/content/reading';
import type { Article, Block } from '../../src/site/content/schema';

const table: Extract<Block, { type: 'table' }> = { type: 'table', columns: ['**Typeface**', 'Role'], rows: [['**Fraunces**', 'Display'], ['Figtree', '']] };

describe('the table block: its contract', () => {
  it('takes column headings and rows of one-line cells, with a caption, row headings and a width', () => {
    expect(block.safeParse(table).success).toBe(true);
    expect(block.safeParse({ ...table, columns: ['[Typeface](https://example.com)', '~~Role~~'] }).success).toBe(true);
    expect(block.safeParse({ ...table, caption: "The site's typefaces", rowHeadings: true, width: 'wide' }).success).toBe(true);
  });

  it('refuses a row without a cell for each column, a cell of two lines, an empty heading, and more than 8 columns', () => {
    expect(block.safeParse({ ...table, rows: [['a']] }).success).toBe(false);
    expect(block.safeParse({ ...table, rows: [['a\nb', 'c']] }).success).toBe(false);
    expect(block.safeParse({ ...table, columns: [' ', 'Role'] }).success).toBe(false);
    expect(block.safeParse({ ...table, columns: ['[](https://example.com)', 'Role'] }).success).toBe(false);
    expect(block.safeParse({ ...table, columns: [`**${'x'.repeat(81)}**`, 'Role'] }).success).toBe(false);
    expect(block.safeParse({ ...table, columns: Array(9).fill('x'), rows: [Array(9).fill('')] }).success).toBe(false);
    expect(block.safeParse({ ...table, width: 'full' }).success).toBe(false);
  });

  it('is named and summed up in the editor, and its words count towards reading time', () => {
    expect(kindOf(table)).toBe('Table');
    expect(excerptOf(table)).toBe('Typeface, Role');
    expect(excerptOf({ ...table, caption: "The site's typefaces" })).toBe("The site's typefaces");
    const a = { title: 'T', summary: 'S', body: [table] } as unknown as Article;
    expect(wordCount(a)).toBe(2 + 2 + 3);
  });
});

describe("the table block: the inspector's text", () => {
  it('splits cells at |, keeping a | written \\| in its cell', () => {
    expect(splitCells(' a | b \\| c |d')).toEqual(['a', 'b | c', 'd']);
  });

  it('writes the headings, then a row a line, and reads it back unchanged', () => {
    const t = { columns: ['**Typeface**', 'Role'], rows: [['A | B', '**Display**'], ['C', '']] };
    const text = tableToText(t);
    expect(text).toBe('**Typeface** | Role\nA \\| B | **Display**\nC | ');
    expect(textToTable(text)).toEqual({ ok: true, ...t });
  });

  it('fills a short row, skips blank lines, and says what is wrong otherwise', () => {
    expect(textToTable('A | B\n\nx\n')).toEqual({ ok: true, columns: ['A', 'B'], rows: [['x', '']] });
    expect(textToTable('A | B')).toMatchObject({ ok: false, why: expect.stringMatching(/at least one row/) });
    expect(textToTable('A |  | C\nx')).toMatchObject({ ok: false, why: expect.stringMatching(/every column a heading/) });
    expect(textToTable('A | B\nx | y | z')).toMatchObject({ ok: false, why: expect.stringMatching(/Row 1 has 3 cells/) });
    expect(textToTable(`${Array(9).fill('h').join(' | ')}\nx`)).toMatchObject({ ok: false, why: expect.stringMatching(/8 columns/) });
  });

  it('starts a new table the contract takes', () => {
    expect(block.safeParse(starterTable()).success).toBe(true);
  });
});
