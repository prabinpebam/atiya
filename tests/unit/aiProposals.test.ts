import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Block } from '../../src/site/content/schema';
import { decide, dropProposal, keepProposal, KEEP_DAYS, listProposals, readProposal } from '../../src/site/editor/server/aiProposals';

const DAY = 86_400_000;
const body: Block[] = [{ type: 'heading', key: 'headaa', level: 2, text: 'First' } as Block, { type: 'text', key: 'textaa', markdown: 'One.' } as Block];
const proposed: Block[] = [body[0], { type: 'text', key: 'textaa', markdown: 'One, shorter.' } as Block];
const made = (id: string) => ({
  id,
  by: 'Ollama',
  target: { scope: 'section' as const, key: 'headaa' },
  instruction: 'Make it shorter',
  madeFrom: 'v1',
  base: { body, header: { title: 'A page' } },
  proposal: { summary: 'Shortened it.', body: proposed, header: null, touched: ['textaa'], retype: false, service: 'Ollama', model: 'stand-in', ms: 12 },
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'proposals-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('the proposal store (ai-editing §12)', () => {
  it('keeps one proposal per article and reads it back after a reload', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    keepProposal(made('a-page'), dir, now);
    const p = readProposal('a-page', dir, now)!;
    expect(p.proposal.summary).toBe('Shortened it.');
    expect(p.base.body).toEqual(body);
    expect(p.decisions).toEqual({});
    expect(p.createdAt).toBe('2026-10-20T10:00:00.000Z');
    keepProposal({ ...made('a-page'), instruction: 'Again' }, dir, now + 1000);
    expect(readProposal('a-page', dir, now)!.instruction).toBe('Again');
    expect(readdirSync(dir)).toEqual(['a-page.json']);
  });

  it('remembers decisions, merging and clearing them, and touches the proposal', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    keepProposal(made('a-page'), dir, now);
    decide('a-page', { textaa: 'accept' }, dir, now + DAY);
    const p = decide('a-page', { headaa: 'reject', textaa: null }, dir, now + 2 * DAY)!;
    expect(p.decisions).toEqual({ headaa: 'reject' });
    expect(p.touchedAt).toBe(new Date(now + 2 * DAY).toISOString());
    expect(decide('none-here', { textaa: 'accept' }, dir, now)).toBeNull();
  });

  it('is deleted when applied or discarded', () => {
    keepProposal(made('a-page'), dir);
    dropProposal('a-page', dir);
    expect(readProposal('a-page', dir)).toBeNull();
    dropProposal('a-page', dir);
  });

  it('lists open proposals, newest first, and sweeps those untouched for 30 days', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    keepProposal(made('old-one'), dir, now - (KEEP_DAYS + 1) * DAY);
    keepProposal(made('kept-one'), dir, now - (KEEP_DAYS - 1) * DAY);
    keepProposal(made('new-one'), dir, now);
    writeFileSync(join(dir, 'broken.json'), '{ not json');
    expect(listProposals(dir, now).map((p) => p.id)).toEqual(['new-one', 'kept-one']);
    expect(readdirSync(dir).sort()).toEqual(['kept-one.json', 'new-one.json']);
    expect(readProposal('kept-one', dir, now + 2 * DAY)).toBeNull();
  });

  it('never takes a path for an article ID', () => {
    expect(() => readProposal('../ai', dir)).toThrow();
    expect(() => keepProposal(made('a/b'), dir)).toThrow();
    expect(listProposals(join(dir, 'nothing'))).toEqual([]);
  });
});
