/**
 * What changed in each row of Save to remote, in a few words (documentation/editor/spec.md §7.2): a page's
 * fields and blocks, a picture's files and words, the sections moved or renamed, a setting's fields. It compares
 * each file with its last commit. Pure, for the publish view and its tests.
 */
import type { Status, Titles } from './names';

export interface SummaryContext {
  /** A file's status in this save, or undefined when it hasn't changed. */
  status(key: string): Status | undefined;
  /** A JSON file as last committed (undefined when it's new, or isn't JSON). */
  before(key: string): unknown;
  /** A JSON file as it is now (undefined when it's deleted). */
  after(key: string): unknown;
  titles: Titles;
}

type Row = { kind: string; status: Status; keys: string[] };
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const humanise = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? `${/^[aeiou]/.test(one) ? 'an' : 'a'} ${one}` : `${n} ${many}`);

/** Names in a list: "a, b and c", at most two named and the rest counted. */
export function listOf(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

const FIELD: Record<string, string> = {
  slug: 'address', hero: 'lead picture', thumbnailStyle: 'thumbnail style', thumbnails: 'thumbnail shapes', navLabel: 'menu label', seo: 'search settings',
  related: 'related pages', alt: 'alt text', focus: 'focus point', source: 'source link', socialImage: 'social picture',
};
const label = (field: string) => FIELD[field] ?? humanise(field);

/** The top-level fields that differ, in words, leaving out `skip`. */
function fieldsChanged(a: unknown, b: unknown, skip: string[] = []): string[] {
  const x = isObj(a) ? a : {};
  const y = isObj(b) ? b : {};
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => !skip.includes(k) && !same(x[k], y[k])).map(label);
}
const changedLine = (fields: string[]) => (fields.length ? `${cap(listOf(fields))} changed` : null);

const BLOCK: Record<string, string> = { text: 'paragraph', figure: 'picture', subheading: 'subheading', marker: 'marker', table: 'table' };
const blockName = (b: unknown) => (isObj(b) && typeof b.type === 'string' ? BLOCK[b.type] ?? humanise(b.type) : 'block');

/** A page's blocks: how many changed, were added or removed, and whether they moved. */
export function blocksChanged(before: unknown[], after: unknown[]): string[] {
  const id = (b: unknown) => (isObj(b) && typeof b.key === 'string' ? `k:${b.key}` : `j:${JSON.stringify(b)}`);
  const left = new Map<string, unknown[]>();
  for (const b of before) left.set(id(b), [...(left.get(id(b)) ?? []), b]);
  const changed: unknown[] = [];
  const added: unknown[] = [];
  const kept: string[] = [];
  for (const b of after) {
    const hit = left.get(id(b));
    if (hit?.length) {
      const was = hit.shift();
      if (!same(was, b)) changed.push(b);
      kept.push(id(b));
    } else added.push(b);
  }
  const removed = [...left.values()].flat();
  // unkeyed blocks edited in place show up as one removed and one added: pair them as changed
  while (added.length && removed.length && !id(added[0]).startsWith('k:') && !id(removed[0]).startsWith('k:')) {
    changed.push(added.shift());
    removed.shift();
  }
  const order = before.map(id).filter((k) => kept.includes(k));
  const moved = order.join('\n') !== kept.join('\n');
  const say = (list: unknown[], verb: string) => {
    if (!list.length) return [];
    const one = list.length === 1 || list.every((b) => blockName(b) === blockName(list[0]));
    return [`${plural(list.length, one ? blockName(list[0]) : 'block')} ${verb}`];
  };
  return [...say(changed, 'changed'), ...say(added, 'added'), ...say(removed, 'removed'), ...(moved ? ['blocks reordered'] : [])];
}

const PAGE_KIND: Record<string, string> = { note: 'article', page: 'page', gallery: 'gallery' };

/** A page compared with its last commit. */
export function pageChanged(before: unknown, after: unknown): string | null {
  const a = isObj(before) ? before : {};
  const b = isObj(after) ? after : {};
  if (!isObj(before)) return isObj(after) ? `New ${PAGE_KIND[String(b.kind)] ?? 'page'}${b.status === 'published' ? ', published' : ''}` : null;
  if (!isObj(after)) return null;
  const parts: string[] = [];
  if (a.status !== b.status) parts.push(b.status === 'published' ? 'published' : a.status === 'published' ? 'unpublished' : `status set to ${humanise(String(b.status))}`);
  const dates = ['updatedAt', 'publishedAt', 'reviewedAt'];
  const fields = fieldsChanged(a, b, ['body', 'status', 'id', 'type', 'locale', ...dates]);
  if (fields.length) parts.push(`${listOf(fields)} changed`);
  parts.push(...blocksChanged(Array.isArray(a.body) ? a.body : [], Array.isArray(b.body) ? b.body : []));
  if (!parts.length && dates.some((d) => !same(a[d], b[d]))) parts.push('dates updated');
  return parts.length ? cap(parts.join(', ')) : 'Formatting only';
}

const MEDIA_NOUN: Record<string, string> = { image: 'picture', video: 'video', document: 'document' };

/** A picture, video or document: its files and its words. */
export function mediaChanged(row: Row, ctx: SummaryContext): string | null {
  const sidecar = row.keys.find((k) => k.endsWith('.json'));
  const before = sidecar ? ctx.before(sidecar) : undefined;
  const after = sidecar ? ctx.after(sidecar) : undefined;
  const noun = MEDIA_NOUN[String((isObj(after) ? after : isObj(before) ? before : {}).kind)] ?? 'file';
  const dark = row.keys.find((k) => /\.dark\.\w+$/.test(k));
  const poster = row.keys.find((k) => /\.poster\.\w+$/.test(k));
  const master = row.keys.find((k) => k !== sidecar && k !== dark && k !== poster);
  if (row.status === 'added') return `New ${noun}${dark ? ' with a dark version' : ''}`;
  if (row.status === 'deleted') return null;
  const parts: string[] = [];
  const replaced = master && ctx.status(master);
  if (replaced) parts.push(replaced === 'added' ? `${noun} file added` : replaced === 'deleted' ? `${noun} file removed` : `${noun} replaced`);
  for (const [key, name] of [[dark, 'dark version'], [poster, 'poster']] as const) {
    const s = key && ctx.status(key);
    if (s) parts.push(`${name} ${s === 'added' ? 'added' : s === 'deleted' ? 'removed' : 'replaced'}`);
  }
  // a new file brings its own measures: only the words and settings someone chose are worth saying
  const fields = fieldsChanged(before, after, ['file', 'facts', 'dark', 'poster', 'animation', 'width', 'height', 'duration', 'kind']);
  if (fields.length) parts.push(`${listOf(fields)} changed`);
  return parts.length ? cap(parts.join(', ')) : null;
}

type Placed = { name: string; parent: string; at: number; own: string };

function placements(root: unknown, titles: Titles): Map<string, Placed> {
  const out = new Map<string, Placed>();
  const walk = (node: unknown, parent: string, at: number) => {
    if (!isObj(node) || typeof node.id !== 'string') return;
    const item = isObj(node.item) ? String(node.item.id) : null;
    const name = String(node.navLabel ?? node.title ?? (item && titles.article(item)) ?? item ?? node.id);
    const { children, ...own } = node;
    out.set(node.id, { name, parent, at, own: JSON.stringify(own) });
    if (Array.isArray(children)) children.forEach((c, i) => walk(c, node.id as string, i));
  };
  walk(root, '', 0);
  return out;
}

/** The site's structure: sections and pages added, removed, moved, renamed or reordered, and the navigation. */
export function structureChanged(before: unknown, after: unknown, titles: Titles): string | null {
  const a = placements(isObj(before) ? before.home : undefined, titles);
  const b = placements(isObj(after) ? after.home : undefined, titles);
  const added: string[] = [];
  const moved: string[] = [];
  const edited: string[] = [];
  let reordered = false;
  for (const [id, now] of b) {
    const was = a.get(id);
    if (!was) added.push(now.name);
    else if (was.parent !== now.parent) moved.push(now.name);
    else {
      if (was.own !== now.own) edited.push(now.name);
      if (was.at !== now.at) reordered = true;
    }
  }
  const removed = [...a].filter(([id]) => !b.has(id)).map(([, p]) => p.name);
  const parts = [
    ...(added.length ? [`${listOf(added)} added`] : []),
    ...(removed.length ? [`${listOf(removed)} removed`] : []),
    ...(moved.length ? [`${listOf(moved)} moved`] : []),
    ...(edited.length ? [`${listOf(edited)} changed`] : []),
    ...(reordered && !added.length && !removed.length && !moved.length ? ['order changed'] : []),
    ...(isObj(before) && isObj(after) && !same(before.menus, after.menus) ? ['navigation changed'] : []),
  ];
  return parts.length ? cap(parts.join(', ')) : null;
}

/** Any other JSON document: lists of things with IDs are counted, other fields named. */
export function documentChanged(before: unknown, after: unknown): string | null {
  if (!isObj(before) || !isObj(after)) return null;
  const parts: string[] = [];
  const fields: string[] = [];
  for (const k of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
    const x = before[k];
    const y = after[k];
    if (same(x, y)) continue;
    const listed = (v: unknown) => Array.isArray(v) && v.every((e) => isObj(e) && typeof e.id === 'string');
    if (!listed(x) || !listed(y)) {
      fields.push(label(k));
      continue;
    }
    const one = humanise(k).replace(/s$/, '');
    const was = new Map((x as Obj[]).map((e) => [e.id as string, e]));
    const now = new Map((y as Obj[]).map((e) => [e.id as string, e]));
    const count = (n: number, verb: string) => (n ? [`${plural(n, one)} ${verb}`] : []);
    parts.push(
      ...count([...now.keys()].filter((id) => !was.has(id)).length, 'added'),
      ...count([...now].filter(([id, e]) => was.has(id) && !same(was.get(id), e)).length, 'changed'),
      ...count([...was.keys()].filter((id) => !now.has(id)).length, 'removed'),
    );
  }
  if (fields.length) parts.unshift(`${listOf(fields)} changed`);
  return parts.length ? cap(parts.join(', ')) : null;
}

const PAGE = /^\/(content|private)\/articles\/([^/]+)\.json$/;
const MEDIA_SIDE = /^\/(content|private)\/media\/(.+)\.json$/;

/** The same page or picture in the other folder (made private, or made open), when this save moves it. */
function counterpart(row: Row, ctx: SummaryContext): { key: string; toPrivate: boolean } | null {
  for (const key of row.keys) {
    const m = PAGE.exec(key) ?? MEDIA_SIDE.exec(key);
    if (!m) continue;
    const other = key.replace(/^\/(content|private)\//, `/${m[1] === 'content' ? 'private' : 'content'}/`);
    const otherStatus = ctx.status(other);
    if (row.status === 'deleted' && otherStatus === 'added') return { key: other, toPrivate: m[1] === 'content' };
    if (row.status === 'added' && otherStatus === 'deleted') return { key: other, toPrivate: m[1] === 'private' };
  }
  return null;
}

/** One row's summary, or null when there's nothing to add to its status. */
export function summariseChange(row: Row, ctx: SummaryContext): string | null {
  try {
    const move = counterpart(row, ctx);
    if (move && row.status === 'deleted') return move.toPrivate ? 'Made private: moves to the private pages' : 'Made open: moves out of the private pages';
    const key = row.keys[0];
    if (row.kind === 'Article' || row.kind === 'Private page') {
      const before = move ? ctx.before(move.key) : ctx.before(key);
      const said = row.status === 'deleted' ? null : pageChanged(before, ctx.after(key));
      if (!move) return said;
      const prefix = move.toPrivate ? 'Made private' : 'Made open';
      return said && said !== 'Formatting only' ? `${prefix}, ${said.charAt(0).toLowerCase()}${said.slice(1)}` : prefix;
    }
    if (row.kind === 'Media' || row.kind === 'Private media') {
      if (move) return move.toPrivate ? 'Made private with its page' : 'Made open with its page';
      return mediaChanged(row, ctx);
    }
    if (row.status !== 'changed' || !key.endsWith('.json')) return null;
    if (row.kind === 'Sections') return structureChanged(ctx.before(key), ctx.after(key), ctx.titles);
    return documentChanged(ctx.before(key), ctx.after(key));
  } catch {
    return null;
  }
}
