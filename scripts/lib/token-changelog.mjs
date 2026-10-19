/**
 * The token changelogs (docs: documentation/site-ui/token-changelog.md, documentation/game-ui/token-changelog.md).
 *
 * Pure. Each system keeps a generated history beside its tokens (`token-history.json`): a snapshot of the
 * token set at the last build (every token's CSS value and, if it's deprecated, why) and the entries so far,
 * newest first. A build compares the tokens with the snapshot, adds what changed as an entry dated that day
 * (merged into that day's entry if there is one), stores the new snapshot and renders the changelog page.
 * `--check` fails when the result differs from what's committed: someone changed the tokens without a build.
 * `$extensions` (owners, flags) aren't values and aren't recorded, except where they change a token's CSS.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Today's date in the machine's own time zone, as `YYYY-MM-DD`. */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-10-19` → `19 October 2026`. */
export function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * A token's state in the history: its CSS value, and `d` when it's deprecated (DTCG 2025.10 `$deprecated`:
 * `true` is kept as an empty note, a string as the note).
 * @param {string} value @param {boolean | string | undefined} deprecated
 * @returns {{ v: string; d?: string }}
 */
export function stateOf(value, deprecated) {
  const s = { v: value };
  if (deprecated !== undefined && deprecated !== false) s.d = deprecated === true ? '' : String(deprecated);
  return s;
}

const sortedObject = (entries) => Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A snapshot: token path (`c.chopper.thumb-width`) → its state, sorted, so reordering tokens changes nothing.
 * @param {{ path: string[]; value: string; deprecated?: boolean | string }[]} tokens
 */
export function snapshotOf(tokens) {
  return sortedObject(tokens.map((t) => [t.path.join('.'), stateOf(t.value, t.deprecated)]));
}

/** What changed between two snapshots: path → [before | null, after | null], for differing paths only. */
export function diff(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) if (!same(before[k], after[k])) out.push([k, [before[k] ?? null, after[k] ?? null]]);
  return sortedObject(out);
}

/** Two diffs in a row as one: each path keeps its first before and its last after; a change undone drops out. */
export function compose(older, newer) {
  const out = new Map(Object.entries(older));
  for (const [k, [, after]] of Object.entries(newer)) {
    const before = out.has(k) ? out.get(k)[0] : newer[k][0];
    if (same(before, after)) out.delete(k);
    else out.set(k, [before, after]);
  }
  return sortedObject(out);
}

/**
 * The history after a build on `date`. With no history yet, the record starts: a baseline entry with the
 * token count. With nothing changed, the history comes back as it was (so the date never matters then).
 * @param {{ snapshot: Record<string, {v: string; d?: string}>; entries: any[] } | null} history
 * @param {Record<string, {v: string; d?: string}>} snapshot
 * @param {string} date `YYYY-MM-DD`
 */
export function update(history, snapshot, date) {
  if (!history) return { snapshot, entries: [{ date, baseline: Object.keys(snapshot).length }] };
  const changes = diff(history.snapshot, snapshot);
  if (!Object.keys(changes).length) return history;
  const [latest, ...rest] = history.entries;
  let entries;
  if (latest && latest.date === date && !latest.baseline) {
    const merged = compose(latest.changes, changes);
    entries = Object.keys(merged).length ? [{ date, changes: merged }, ...rest] : rest;
  } else entries = [{ date, changes }, ...history.entries];
  return { snapshot, entries };
}

const groupOf = (path) => path.slice(0, path.lastIndexOf('.'));

/**
 * An entry's changes, sorted into what a reader asks: renamed, added, removed, changed in value, deprecated.
 * A removed and an added token with the same value in the same group are a rename, when the pair is the
 * only one of its kind. A token that now aliases a new token holding its old value, and is newly
 * deprecated, was renamed with its old name kept as an alias (the deprecation rule).
 * @param {Record<string, [{v: string; d?: string} | null, {v: string; d?: string} | null]>} changes
 * @param {(path: string) => string} name the CSS custom property of a path
 */
export function classify(changes, name) {
  const added = [];
  const removed = [];
  const changed = [];
  for (const [k, [b, a]] of Object.entries(changes)) {
    if (!b) added.push(k);
    else if (!a) removed.push(k);
    else changed.push(k);
  }
  const renamed = [];
  const used = new Set();
  // plain renames: one removed and one added, same value, same group
  for (const r of removed) {
    const v = changes[r][0].v;
    const to = added.filter((k) => !used.has(k) && groupOf(k) === groupOf(r) && changes[k][1].v === v);
    const from = removed.filter((k) => groupOf(k) === groupOf(r) && changes[k][0].v === v);
    if (to.length === 1 && from.length === 1) {
      renamed.push({ from: r, to: to[0], value: v, alias: false });
      used.add(r).add(to[0]);
    }
  }
  // renames that keep the old name as a deprecated alias of the new one
  for (const k of changed) {
    const [b, a] = changes[k];
    if (b.d !== undefined || a.d === undefined) continue;
    const to = added.find((n) => !used.has(n) && a.v === `var(${name(n)})` && changes[n][1].v === b.v);
    if (to) {
      renamed.push({ from: k, to, value: b.v, alias: true, note: a.d });
      used.add(k).add(to);
    }
  }
  const out = {
    renamed: renamed.sort((x, y) => (x.from < y.from ? -1 : 1)),
    added: added.filter((k) => !used.has(k)).map((k) => ({ path: k, value: changes[k][1].v, note: changes[k][1].d })),
    removed: removed.filter((k) => !used.has(k)).map((k) => ({ path: k, value: changes[k][0].v, wasDeprecated: changes[k][0].d !== undefined })),
    changed: [],
    deprecated: [],
    undeprecated: [],
  };
  for (const k of changed) {
    if (used.has(k)) continue;
    const [b, a] = changes[k];
    if (b.v !== a.v) out.changed.push({ path: k, from: b.v, to: a.v });
    if (b.d === undefined && a.d !== undefined) out.deprecated.push({ path: k, note: a.d });
    else if (b.d !== undefined && a.d === undefined) out.undeprecated.push({ path: k });
    else if (b.d !== undefined && a.d !== undefined && b.d !== a.d) out.deprecated.push({ path: k, note: a.d });
  }
  return out;
}

const code = (s) => `\`${String(s).replace(/`/g, "'")}\``;

/** A note with the custom properties it names set as code: `Use --c-x` → ``Use `--c-x` ``. */
export const codeNames = (s) => String(s).replace(/(^|[^`\w-])(--[a-z][\w-]*[\w])/gi, '$1`$2`');
const note = (d) => (d ? `: ${codeNames(d)}` : '');

/** One entry's lines (its H2 and lists). */
function entryLines(entry, name) {
  if (entry.baseline !== undefined) {
    return [`## Baseline, ${longDate(entry.date)}: ${entry.baseline} tokens`, '', `The record starts here, with the ${entry.baseline} tokens there were on ${longDate(entry.date)}. Earlier changes aren't reconstructed.`, ''];
  }
  const c = classify(entry.changes, name);
  const out = [`## ${longDate(entry.date)}`, ''];
  const list = (title, items) => {
    if (!items.length) return;
    out.push(`**${title}** (${items.length})`, '', ...items.map((s) => `- ${s}`), '');
  };
  list(
    'Renamed',
    c.renamed.map((r) => `${code(name(r.from))} → ${code(name(r.to))} (${code(r.value)})${r.alias ? '; the old name stays for one release as a deprecated alias' : ''}`),
  );
  list('Added', c.added.map((a) => `${code(name(a.path))}: ${code(a.value)}${a.note !== undefined ? ` (deprecated${note(a.note)})` : ''}`));
  list('Removed', c.removed.map((r) => `${code(name(r.path))} (was ${code(r.value)})${r.wasDeprecated ? ', after its release as a deprecated alias' : ''}`));
  list('Changed in value', c.changed.map((x) => `${code(name(x.path))}: ${code(x.from)} → ${code(x.to)}`));
  list('Deprecated', c.deprecated.map((d) => `${code(name(d.path))}${note(d.note)}`));
  list('No longer deprecated', c.undeprecated.map((d) => code(name(d.path))));
  return out;
}

/**
 * The changelog page.
 * @param {{ title: string; tldr: string; about: string[]; history: { snapshot: Record<string, {v: string; d?: string}>; entries: any[] }; name: (path: string) => string }} page
 */
export function renderChangelog({ title, tldr, about, history, name }) {
  const deprecated = Object.entries(history.snapshot).filter(([, s]) => s.d !== undefined);
  const out = [`# ${title}`, '', `> **TL;DR.** ${tldr}`, '', ...about.flatMap((p) => [p, '']), '## Deprecated now', ''];
  if (deprecated.length) {
    out.push('Each still works (the build keeps writing its custom property), but nothing may read it: move its readers, then remove it after one release.', '');
    out.push('| Token | Value | Note |', '|---|---|---|');
    for (const [k, s] of deprecated) out.push(`| ${code(name(k))} | ${code(s.v)} | ${s.d ? codeNames(s.d).replace(/\|/g, '\\|') : ''} |`);
    out.push('');
  } else out.push('None.', '');
  for (const e of history.entries) out.push(...entryLines(e, name));
  return out.join('\n');
}

/** The history file's text (stable: one token per line in the snapshot, two spaces, a final newline). */
export function historyJson(history) {
  const indent = (text, by) => text.split('\n').join(`\n${' '.repeat(by)}`);
  const snap = Object.entries(history.snapshot).map(([k, s]) => `    ${JSON.stringify(k)}: ${JSON.stringify(s)}`);
  return [
    '{',
    `  "$description": ${JSON.stringify('GENERATED by the token build: the last built token set and the changelog entries, newest first. Do not edit.')},`,
    `  "snapshot": {${snap.length ? `\n${snap.join(',\n')}\n  ` : ''}},`,
    `  "entries": ${indent(JSON.stringify(history.entries, null, 2), 2)}`,
    '}',
    '',
  ].join('\n');
}

/** Read a history file's text back (null when there's none yet). */
export function parseHistory(text) {
  if (!text) return null;
  const { snapshot, entries } = JSON.parse(text);
  return { snapshot, entries };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where a source reads a deprecated custom property: `[{ file, name }]`. A name counts only whole
 * (`--c-x` isn't read by `--c-x-y`).
 * @param {string[]} names @param {{ file: string; text: string }[]} files
 */
export function deprecatedReads(names, files) {
  const out = [];
  for (const n of names) {
    const re = new RegExp(`${escapeRe(n)}(?![\\w-])`);
    for (const f of files) if (re.test(f.text)) out.push({ file: f.file, name: n });
  }
  return out;
}
