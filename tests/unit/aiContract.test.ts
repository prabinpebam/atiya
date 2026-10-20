/**
 * The edit request's contract (documentation/editor/ai-editing.md §2; plan: ai-plan.md stage S2): the
 * answer's shape and strict schema, the scopes and what each may change, a section's span, applying an
 * answer by key with every refusal reason, the words read out of a partial answer, the word diff, and the
 * store's dry-run check, which writes nothing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Article, Block } from '../../src/site/content/schema';
import { allowedOps, answerSchema, applyAnswer, parseAnswer, sectionSpan, strict, type Answer, type AnswerChange, type Target } from '../../src/site/editor/model/aiContract';
import { partialWords, wordDiff, wordsField } from '../../src/site/editor/model/aiText';
import { checkOnly, jsonBytes, versionOf } from '../../src/site/editor/server/store';

const body: Block[] = [
  { type: 'text', key: 'intro1', markdown: 'An opening line.' },
  { type: 'heading', key: 'headaa', level: 2, text: 'First' },
  { type: 'text', key: 'firsta', markdown: 'Under the first.' },
  { type: 'heading', key: 'headab', level: 3, text: 'Deeper' },
  { type: 'text', key: 'deepaa', markdown: 'Under the deeper one.' },
  { type: 'heading', key: 'headac', level: 2, text: 'Second' },
  { type: 'text', key: 'second', markdown: 'Under the second.' },
];
const article = { id: 'a', type: 'article', kind: 'note', slug: 'a', title: 'A', summary: 'S', status: 'draft', visibility: 'public', updatedAt: '2026-09-30', locale: 'en', body } as unknown as Article;
const TEXT: Block['type'][] = ['text', 'heading', 'quote', 'table'];
const answer = (changes: Partial<AnswerChange>[], over: Partial<Answer> = {}): Answer => ({
  changes: changes.map((c) => ({ op: 'replace', key: null, after: null, block: null, ...c })),
  header: null,
  summary: 'Changed it',
  needs: { kind: 'none', reason: null },
  ...over,
});
const reasons = (r: ReturnType<typeof applyAnswer>) => (r.ok ? [] : r.reasons.join(' | '));

describe('the answer (S2.1)', () => {
  it('reads a whole answer, with the nulls a strict writer sends for optional fields, and empty reasons as none', () => {
    const r = parseAnswer(JSON.stringify({ changes: [{ op: 'replace', key: 'intro1', after: null, block: { type: 'text', markdown: 'Shorter.', dropcap: null } }], header: null, summary: 'Shortened it', needs: { kind: 'none', reason: '' } }));
    expect(r.ok && r.answer.changes[0].block).toEqual({ type: 'text', markdown: 'Shorter.' });
    expect(r.ok && r.answer.needs).toEqual({ kind: 'none', reason: null });
  });

  it('reads an empty string a model sends for an optional field as missing, but only when the block needs it, and keeps empty cells', () => {
    const table = { type: 'table', columns: ['Year', 'Size'], rows: [['2024', ''], ['2025', '12']], rowHeadings: null, caption: '' };
    const r = parseAnswer(JSON.stringify({ changes: [{ op: 'replace', key: 'intro1', after: null, block: table }], header: null, summary: 'Made a table', needs: { kind: 'none', reason: null } }));
    expect(r.ok && r.answer.changes[0].block).toEqual({ type: 'table', columns: ['Year', 'Size'], rows: [['2024', ''], ['2025', '12']] });
  });

  it("refuses what isn't the shape: not JSON (cut off), a missing part, an unknown operation, a block the contract refuses", () => {
    expect(parseAnswer('{"changes":[{"op":"replace"')).toEqual({ ok: false, reasons: [expect.stringMatching(/isn't complete JSON/)] });
    expect(parseAnswer(JSON.stringify({ changes: [], header: null, needs: { kind: 'none', reason: null } }))).toMatchObject({ ok: false, reasons: [expect.stringMatching(/summary/)] });
    expect(parseAnswer(JSON.stringify({ changes: [{ op: 'rewrite', key: 'a', after: null, block: null }], header: null, summary: 's', needs: { kind: 'none', reason: null } })).ok).toBe(false);
    const twoParagraphs = parseAnswer(JSON.stringify({ changes: [{ op: 'replace', key: 'intro1', after: null, block: { type: 'text', markdown: 'One.\n\nTwo.' } }], header: null, summary: 's', needs: { kind: 'none', reason: null } }));
    expect(twoParagraphs).toMatchObject({ ok: false, reasons: [expect.stringMatching(/text block doesn't fit the content contract/)] });
    const madeUpType = parseAnswer(JSON.stringify({ changes: [{ op: 'replace', key: 'intro1', after: null, block: { type: 'poem', text: 'x' } }], header: null, summary: 's', needs: { kind: 'none', reason: null } }));
    expect(madeUpType.ok).toBe(false);
  });

  it("gives a writer a strict schema: every property required, optional ones nullable, nothing else allowed, no block key, the header only where it may change", () => {
    const s = answerSchema(['text', 'quote'], { header: false }) as { properties: Record<string, Record<string, unknown>> };
    const walk = (node: unknown, at: string): void => {
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (o.properties) {
        expect(o.additionalProperties, at).toBe(false);
        expect([...(o.required as string[])].sort(), at).toEqual(Object.keys(o.properties as object).sort());
        expect(Object.keys(o.properties as object), at).not.toContain(at.includes('.block') ? 'key' : '-');
      }
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    };
    walk(s, 'answer');
    expect(JSON.stringify(s)).not.toMatch(/minLength|default|\$schema/);
    expect(s.properties.header).toEqual({ type: 'null' });
    expect(answerSchema(['text'], { header: true }).properties).toMatchObject({ header: { anyOf: [{ type: 'object' }, { type: 'null' }] } });
    const quote = JSON.stringify(answerSchema(['quote'], { header: false }));
    expect(quote).toContain('"cite":{"anyOf":[{"type":"string"},{"type":"null"}]}');
    expect(strict({ type: 'string', minLength: 1 })).toEqual({ type: 'string' });
    expect(JSON.stringify(answerSchema(['table'], { header: false }))).toContain('"columns":{"minItems":1,"type":"array"');
  });
});

describe('scopes (S2.2, S2.3)', () => {
  it('allows each scope its operations (§2.3)', () => {
    expect(allowedOps({ scope: 'block', key: 'intro1' })).toEqual(['replace']);
    expect(allowedOps({ scope: 'block', key: 'intro1', retype: true })).toEqual(['replace', 'retype']);
    expect(allowedOps({ scope: 'section', key: 'headaa' })).toEqual(['replace', 'retype', 'insert', 'remove', 'move']);
    expect(allowedOps({ scope: 'article' })).toEqual(['replace', 'retype', 'insert', 'remove', 'move']);
    expect(allowedOps({ scope: 'empty' })).toEqual(['insert']);
    expect(allowedOps({ scope: 'comments', comments: { keys: [], header: false } })).toEqual(['replace', 'retype', 'insert', 'remove', 'move']);
  });

  it('spans a section from its heading to the next heading of the same or a higher level', () => {
    expect(sectionSpan(body, 1)).toEqual({ start: 1, end: 5 });
    expect(sectionSpan(body, 3)).toEqual({ start: 3, end: 5 });
    expect(sectionSpan(body, 5)).toEqual({ start: 5, end: 7 });
    expect(sectionSpan(body, 0)).toBeNull();
  });
});

describe('applying an answer by key (S2.4, S2.5)', () => {
  const block: Target = { scope: 'block', key: 'firsta' };
  const section: Target = { scope: 'section', key: 'headaa' };

  it('replaces a block by its key, keeping the key, and leaves every other block as it was', () => {
    const r = applyAnswer(article, answer([{ op: 'replace', key: 'firsta', block: { type: 'text', markdown: 'New words.' } }]), block, TEXT);
    expect(r.ok && r.article.body[2]).toEqual({ type: 'text', key: 'firsta', markdown: 'New words.' });
    expect(r.ok && r.article.body.filter((_, i) => i !== 2)).toEqual(body.filter((_, i) => i !== 2));
    expect(r.ok && r.touched).toEqual(['firsta']);
  });

  it('retypes when asked, keeping the key', () => {
    const r = applyAnswer(article, answer([{ op: 'retype', key: 'firsta', block: { type: 'quote', text: 'Under the first.' } as Block }]), { ...block, retype: true }, TEXT);
    expect(r.ok && r.article.body[2]).toEqual({ type: 'quote', key: 'firsta', text: 'Under the first.' });
  });

  it('inserts, removes and moves inside a section, a new block getting a new key', () => {
    const r = applyAnswer(
      article,
      answer([
        { op: 'insert', after: 'firsta', block: { type: 'text', markdown: 'Added.' } },
        { op: 'remove', key: 'deepaa' },
        { op: 'move', key: 'headab', after: 'headaa' },
      ]),
      section,
      TEXT,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.body.map((b) => b.key?.length === 6 && b.key)).toEqual(['intro1', 'headaa', 'headab', 'firsta', expect.any(String), 'headac', 'second']);
    expect(r.article.body[4]).toMatchObject({ type: 'text', markdown: 'Added.' });
    expect(new Set(r.article.body.map((b) => b.key)).size).toBe(body.length);
  });

  it('changes the title and summary only where the scope allows it', () => {
    const header = { title: 'New title', summary: null };
    expect(applyAnswer(article, answer([], { header }), { scope: 'article' }, TEXT)).toMatchObject({ ok: true, article: { title: 'New title', summary: 'S' } });
    expect(reasons(applyAnswer(article, answer([], { header }), block, TEXT))).toMatch(/title and summary can't change in a block request/);
  });

  it('refuses, with a reason each: an unknown key, a block outside the scope, an operation not allowed, a type not offered, a changed type without a retype', () => {
    expect(reasons(applyAnswer(article, answer([{ op: 'replace', key: 'zzzzzz', block: { type: 'text', markdown: 'x' } }]), { scope: 'article' }, TEXT))).toMatch(/no block has the key zzzzzz/);
    expect(reasons(applyAnswer(article, answer([{ op: 'replace', key: 'second', block: { type: 'text', markdown: 'x' } }]), section, TEXT))).toMatch(/second is outside the request's scope/);
    expect(reasons(applyAnswer(article, answer([{ op: 'insert', after: 'second', block: { type: 'text', markdown: 'x' } }]), section, TEXT))).toMatch(/second is outside the request's scope/);
    expect(reasons(applyAnswer(article, answer([{ op: 'remove', key: 'firsta' }]), block, TEXT))).toMatch(/remove isn't allowed in a block request/);
    expect(reasons(applyAnswer(article, answer([{ op: 'replace', key: 'firsta', block: { type: 'divider' } as Block }]), block, TEXT))).toMatch(/a divider block isn't offered here/);
    expect(reasons(applyAnswer(article, answer([{ op: 'replace', key: 'firsta', block: { type: 'quote', text: 'x' } as Block }]), { ...block, retype: true }, TEXT))).toMatch(/replace keeps a block's type/);
    expect(reasons(applyAnswer(article, answer([]), block, TEXT))).toMatch(/changes nothing/);
  });

  it('keeps an answer that only says why it can’t, for the prompt to show', () => {
    expect(applyAnswer(article, answer([], { needs: { kind: 'research', reason: 'It needs this year’s numbers.' } }), block, TEXT).ok).toBe(true);
  });
});

describe('the words of a streaming answer, and the tracked change', () => {
  it('reads the block’s words as far as they’ve arrived, escapes and all, never a half escape', () => {
    const whole = JSON.stringify({ changes: [{ op: 'replace', key: 'intro1', after: null, block: { type: 'text', markdown: 'A "quoted"\nline é' } }] });
    expect(partialWords(whole, 'markdown')).toBe('A "quoted"\nline é');
    expect(partialWords(whole.slice(0, whole.indexOf('quoted') + 3), 'markdown')).toBe('A "quo');
    expect(partialWords('{"changes":[{"op":"replace","key":"x","block":{"type":"text","markdown":"ab\\', 'markdown')).toBe('ab');
    expect(partialWords('{"changes":[{"op":"replace","key":"x","block":{"type":"te', 'markdown')).toBeNull();
    expect(wordsField('text')).toBe('markdown');
    expect(wordsField('quote')).toBe('text');
    expect(wordsField('table')).toBeNull();
  });

  it('diffs word by word: removed words before the new ones, the rest the same', () => {
    expect(wordDiff('The quick brown fox', 'The slow brown fox jumps')).toEqual([
      { kind: 'same', text: 'The ' },
      { kind: 'del', text: 'quick' },
      { kind: 'add', text: 'slow' },
      { kind: 'same', text: ' brown fox' },
      { kind: 'add', text: ' jumps' },
    ]);
    expect(wordDiff('same', 'same')).toEqual([{ kind: 'same', text: 'same' }]);
  });
});

describe('the dry-run check (S2.6)', () => {
  let dir: string;
  let content: string;
  const env = { CONTENT_ROOT: process.env.CONTENT_ROOT, PRIVATE_ROOT: process.env.PRIVATE_ROOT };
  const put = (key: string, value: unknown) => {
    const abs = join(content, ...key.replace(/^\/content\//, '').split('/'));
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, jsonBytes(value));
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ai-check-'));
    content = join(dir, 'content');
    process.env.CONTENT_ROOT = content;
    process.env.PRIVATE_ROOT = join(dir, 'private-pages');
    put('/content/site.json', { name: 'N', description: 'D', owner: 'p', locale: 'en' });
    put('/content/people/p.json', { id: 'p', name: 'P' });
    put('/content/structures/site.json', { home: { id: 'home', kind: 'hub', slug: '', title: 'Home', children: [{ id: 's', kind: 'hub', slug: 's', title: 'S', children: [{ id: 'a', kind: 'item', item: { type: 'article', id: 'a' } }] }] } });
    put('/content/articles/a.json', { ...article, body: [{ type: 'text', key: 'intro1', markdown: 'Hello.' }] });
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds what the content check would refuse (a picture that isn’t there), and writes nothing', () => {
    const file = join(content, 'articles', 'a.json');
    const was = versionOf(readFileSync(file));
    const next = { ...article, body: [{ type: 'figure', key: 'intro1', media: 'articles/a/not-a-picture' }] };
    const issues = checkOnly([{ key: '/content/articles/a.json', bytes: jsonBytes(next) }]);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/not-a-picture/);
    expect(versionOf(readFileSync(file))).toBe(was);
    expect(checkOnly([{ key: '/content/articles/a.json', bytes: jsonBytes({ ...article, body: [{ type: 'text', key: 'intro1', markdown: 'Bye.' }] }) }])).toEqual([]);
  });
});
