/**
 * The edit request's contract (documentation/editor/ai-editing.md §2): the scopes and what each may change,
 * a section's span, the answer's shape (and its strict JSON schema for a writer), and applying an answer by
 * block key, with the reasons one is refused. Pure: the connector (server/aiConnector.ts) and the tests use
 * it; the content check itself is the store's (`checkOnly`).
 */
import { z } from 'astro/zod';
import { block as blockSchema, type Article, type Block } from '../../content/schema';
import { findKey, makeKey } from './keys';

export type Scope = 'block' | 'section' | 'article' | 'empty' | 'comments';
export type Op = 'replace' | 'retype' | 'insert' | 'remove' | 'move';
export const OPS = ['replace', 'retype', 'insert', 'remove', 'move'] as const satisfies readonly Op[];
export const NEEDS = ['none', 'research', 'outside', 'unclear'] as const;
export type Need = (typeof NEEDS)[number];
export type BlockType = Block['type'];

/** What a request is on: its scope, the block (a block's or a section's heading), and for comments the blocks they're on. */
export interface Target {
  scope: Scope;
  /** The block's key, for a block or a section. */
  key?: string;
  /** A block request that asked for another type (§4.3): only then may it retype. */
  retype?: boolean;
  /** For the comments scope: the keys of the blocks the chosen comments are on, and whether one is on the page header. */
  comments?: { keys: string[]; header: boolean };
}

/** The operations each scope may use (§2.3). */
export function allowedOps(t: Target): Op[] {
  switch (t.scope) {
    case 'block':
      return t.retype ? ['replace', 'retype'] : ['replace'];
    case 'section':
    case 'article':
    case 'comments':
      return [...OPS];
    case 'empty':
      return ['insert'];
  }
}

/** Whether the request may change the article's title and summary (§2.3's last row). */
export const mayChangeHeader = (t: Target): boolean => t.scope === 'article' || t.scope === 'empty' || (t.scope === 'comments' && !!t.comments?.header);

/** A section (§2.3): the heading at `index` and every block after it, up to the next heading of the same or a higher level. Null when `index` isn't a heading. */
export function sectionSpan(body: Block[], index: number): { start: number; end: number } | null {
  const h = body[index];
  if (h?.type !== 'heading') return null;
  let end = index + 1;
  while (end < body.length) {
    const b = body[end];
    if (b.type === 'heading' && b.level <= h.level) break;
    end++;
  }
  return { start: index, end };
}

/** The keys a change may touch, or null for any. Inserts and moves are placed by `after`, held to the same keys (comments: anywhere). */
export function scopeKeys(body: Block[], t: Target): { touch: Set<string> | null; place: Set<string> | null } {
  const keysOf = (blocks: Block[]) => new Set(blocks.map((b) => b.key).filter((k): k is string => !!k));
  if (t.scope === 'block') return { touch: new Set(t.key ? [t.key] : []), place: new Set() };
  if (t.scope === 'section') {
    const at = t.key ? findKey(body, t.key)?.at : undefined;
    const span = at === undefined ? null : sectionSpan(body, at);
    const keys = span ? keysOf(body.slice(span.start, span.end)) : new Set<string>();
    return { touch: keys, place: keys };
  }
  if (t.scope === 'comments') return { touch: new Set(t.comments?.keys ?? []), place: null };
  return { touch: null, place: null };
}

// ---------- the answer (§2.2) ----------

/** One change: an operation on a block named by its key, the whole new block, and for an insert or a move the key it goes after (null: first). */
export interface AnswerChange {
  op: Op;
  key: string | null;
  after: string | null;
  block: Block | null;
}
export interface Answer {
  changes: AnswerChange[];
  /** A new title or summary, where the scope allows it. */
  header: { title: string | null; summary: string | null } | null;
  /** One line: the undo step's name and the version's message. */
  summary: string;
  needs: { kind: Need; reason: string | null };
}

const answerShape = z.object({
  changes: z.array(z.object({ op: z.enum(OPS), key: z.string().nullable(), after: z.string().nullable(), block: z.unknown() })),
  header: z.object({ title: z.string().nullable(), summary: z.string().nullable() }).nullable(),
  summary: z.string(),
  needs: z.object({ kind: z.enum(NEEDS), reason: z.string().nullable() }),
});

/** A writer's nulls back to missing fields (every field is required in strict mode, so optional ones arrive as null); with `empties`, empty strings too, as some models send "" for a field they leave out. */
function dropNulls(v: unknown, empties = false): unknown {
  if (Array.isArray(v)) return v.map((x) => dropNulls(x, empties));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && !(empties && x === '')).map(([k, x]) => [k, dropNulls(x, empties)]));
  return v;
}

/** The answer, read from a writer's text: its shape and every new block against the content contract. */
export function parseAnswer(text: string): { ok: true; answer: Answer } | { ok: false; reasons: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reasons: ["the answer isn't complete JSON (it may have been cut off)"] };
  }
  const shape = answerShape.safeParse(raw);
  if (!shape.success) return { ok: false, reasons: shape.error.issues.slice(0, 3).map((i) => `the answer's ${i.path.join('.') || 'shape'}: ${i.message}`) };
  const reasons: string[] = [];
  const changes = shape.data.changes.map((c, n): AnswerChange => {
    if (c.block === null || c.block === undefined) return { ...c, block: null };
    let b = blockSchema.safeParse(dropNulls(c.block));
    if (!b.success) {
      const loose = blockSchema.safeParse(dropNulls(c.block, true));
      if (loose.success) b = loose;
    }
    if (!b.success) {
      const type = (c.block as { type?: unknown }).type;
      reasons.push(`change ${n + 1}: the new ${typeof type === 'string' ? type : ''} block doesn't fit the content contract (${b.error.issues[0]?.path.join('.')}: ${b.error.issues[0]?.message})`.replace('  ', ' '));
      return { ...c, block: null };
    }
    const { key: _key, ...block } = b.data;
    return { ...c, block: block as Block };
  });
  if (reasons.length) return { ok: false, reasons };
  const needs = shape.data.needs;
  return { ok: true, answer: { ...shape.data, changes, needs: { kind: needs.kind, reason: needs.reason?.trim() || null } } };
}

/** JSON Schema keywords a strict schema keeps (`minItems` too: both OpenAI's strict mode and a local runner's grammar honour it, so a table never comes with no columns); the rest (lengths, defaults, formats) are the content check's. */
const KEEP = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf', 'description', 'minItems']);

/** A JSON schema made strict (ai-services.md §9.2): every property required, optional ones allowed to be null, nothing else allowed. */
export function strict(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) if (KEEP.has(k)) out[k] = v;
  if (Array.isArray(out.anyOf)) out.anyOf = out.anyOf.map((s) => strict(s as Record<string, unknown>));
  if (out.items && typeof out.items === 'object') out.items = strict(out.items as Record<string, unknown>);
  if (out.properties && typeof out.properties === 'object') {
    const props = out.properties as Record<string, Record<string, unknown>>;
    const required = new Set((out.required as string[] | undefined) ?? []);
    out.properties = Object.fromEntries(Object.entries(props).map(([k, s]) => [k, required.has(k) ? strict(s) : { anyOf: [strict(s), { type: 'null' }] }]));
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

/** The writer's schema for an answer whose new blocks may be only `types` (§2.4: after Decide), and which may change the header or not. */
export function answerSchema(types: BlockType[], opts: { header: boolean }): Record<string, unknown> {
  const blocks = blockSchema.options
    .filter((o) => types.includes(o.shape.type.value as BlockType))
    .map((o) => {
      const s = z.toJSONSchema(o, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown> & { properties: Record<string, unknown>; required?: string[] };
      delete s.properties.key;
      return strict(s);
    });
  const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: 'null' }] });
  const str = { type: 'string' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['changes', 'header', 'summary', 'needs'],
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'key', 'after', 'block'],
          properties: { op: { type: 'string', enum: [...OPS] }, key: nullable(str), after: nullable(str), block: nullable(blocks.length === 1 ? blocks[0] : { anyOf: blocks }) },
        },
      },
      header: opts.header
        ? nullable({ type: 'object', additionalProperties: false, required: ['title', 'summary'], properties: { title: nullable(str), summary: nullable(str) } })
        : { type: 'null' },
      summary: str,
      needs: { type: 'object', additionalProperties: false, required: ['kind', 'reason'], properties: { kind: { type: 'string', enum: [...NEEDS] }, reason: nullable(str) } },
    },
  };
}

// ---------- applying an answer by key ----------

export type Applied = { ok: true; article: Article; touched: string[] } | { ok: false; reasons: string[] };

/**
 * The article with the answer's changes made, in order, by key: a new block gets a new key, a replaced or
 * retyped one keeps its own. Refused, with every reason, when a key is unknown, a change is outside the scope,
 * an operation isn't allowed, a block type isn't offered, or the header changes where it may not.
 */
export function applyAnswer(article: Article, answer: Answer, t: Target, types: BlockType[]): Applied {
  const reasons: string[] = [];
  const allowed = new Set(allowedOps(t));
  const { touch, place } = scopeKeys(article.body, t);
  const body = [...article.body];
  const taken = new Set(body.map((b) => b.key).filter((k): k is string => !!k));
  const done = new Set<string>();
  const touched: string[] = [];
  const at = (key: string | null, n: number): number | null => {
    if (key === null) return null;
    const found = findKey(body, key);
    if (!found) reasons.push(`change ${n}: no block has the key ${key}`);
    return found ? found.at : null;
  };
  const placeAfter = (after: string | null, n: number): number | null => {
    if (after === null) {
      if (t.scope !== 'section') return 0;
      reasons.push(`change ${n}: in a section, a block goes after one of the section's blocks`);
      return null;
    }
    if (place && !place.has(after)) {
      reasons.push(`change ${n}: ${after} is outside the request's scope`);
      return null;
    }
    const i = at(after, n);
    return i === null ? null : i + 1;
  };

  answer.changes.forEach((c, k) => {
    const n = k + 1;
    if (!allowed.has(c.op)) return void reasons.push(`change ${n}: ${c.op} isn't allowed in a ${t.scope} request`);
    if (c.op !== 'insert' && c.key && touch && !touch.has(c.key)) return void reasons.push(`change ${n}: the block ${c.key} is outside the request's scope`);
    if (c.key && done.has(c.key)) return void reasons.push(`change ${n}: the block ${c.key} is changed twice`);
    if ((c.op === 'replace' || c.op === 'retype' || c.op === 'insert') && !c.block) return void reasons.push(`change ${n}: ${c.op} needs the whole new block`);
    if (c.block && !types.includes(c.block.type)) return void reasons.push(`change ${n}: a ${c.block.type} block isn't offered here`);
    if (c.op === 'insert') {
      const i = placeAfter(c.after, n);
      if (i === null) return;
      const key = makeKey(taken);
      taken.add(key);
      body.splice(i, 0, { ...c.block!, key });
      touched.push(key);
      return;
    }
    if (!c.key) return void reasons.push(`change ${n}: ${c.op} needs the key of the block it changes`);
    const i = at(c.key, n);
    if (i === null) return;
    done.add(c.key);
    if (c.op === 'replace' || c.op === 'retype') {
      if (c.op === 'replace' && c.block!.type !== body[i].type) return void reasons.push(`change ${n}: replace keeps a block's type (this one is a ${body[i].type}); a new type is a retype`);
      body[i] = { ...c.block!, key: c.key } as Block;
    } else if (c.op === 'remove') body.splice(i, 1);
    else {
      const [moved] = body.splice(i, 1);
      const to = placeAfter(c.after, n);
      if (to === null) return void body.splice(i, 0, moved);
      body.splice(to, 0, moved);
    }
    touched.push(c.key);
  });

  let next: Article = { ...article, body };
  const header = answer.header;
  if (header && (header.title !== null || header.summary !== null)) {
    if (!mayChangeHeader(t)) reasons.push(`the title and summary can't change in a ${t.scope} request`);
    else next = { ...next, ...(header.title !== null ? { title: header.title } : {}), ...(header.summary !== null ? { summary: header.summary } : {}) };
  }
  if (!answer.changes.length && !header && answer.needs.kind === 'none') reasons.push('the answer changes nothing');
  return reasons.length ? { ok: false, reasons } : { ok: true, article: next, touched };
}
