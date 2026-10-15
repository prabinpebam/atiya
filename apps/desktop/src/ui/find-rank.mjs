// @ts-check
// The action center's finding and ordering (documentation/desktop/action-center.md §7): pure, so the frame's
// panel and the tests share it. A result is found when every word typed matches somewhere in it; its score is
// the best place its weakest word matched, plus a little for being used lately or being an action or setting.

/**
 * @typedef {{ key: string, group: string, title: string, words?: string[], detail?: string, text?: string }} FindItem
 * @typedef {{ key: string, group: string, text?: string, _item: FindItem, _t: string, _starts: number[], _initials: string, _w: string, _d: string, _x: string }} Prepared
 * @typedef {{ item: FindItem, score: number, marks: [number, number][], snippet?: string }} Found
 */

/** The groups, in the order they're shown (§4.1). */
export const GROUPS = ['actions', 'screen', 'settings', 'pages', 'sections', 'media', 'go'];
/** How many results a group shows (§6.2). */
export const LIMITS = { actions: 5, screen: 5, settings: 5, pages: 5, sections: 5, media: 6, go: 5 };
/** How many results Recent keeps (§8.5). */
export const RECENT_MAX = 8;

const MARKS = /[\u0300-\u036f]/g;
const WORDY = /[\p{L}\p{N}]/u;

/**
 * Lower case, without accents, every other character a space, and the same length as what it was given, so a
 * match's place in it is its place in the title.
 * @param {string} s
 */
export function fold(s) {
  // most text is plain ASCII: folded in one pass
  if (!/[^\x00-\x7f]/.test(s)) return s.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  let out = '';
  for (const ch of s) {
    if (ch < '\x80') {
      out += /[a-zA-Z0-9]/.test(ch) ? ch.toLowerCase() : ' ';
      continue;
    }
    const f = ch.normalize('NFKD').replace(MARKS, '').toLowerCase();
    const one = f.length === 1 && WORDY.test(f) ? f : ' ';
    // a character outside the basic plane is two code units in the title: keep the length
    out += ch.length === 2 ? `${one} ` : one;
  }
  return out;
}

/** The words typed, folded. @param {string} q */
export const words = (q) => fold(q).split(' ').filter(Boolean);

const flat = (/** @type {string | undefined} */ s) => (s ? ` ${fold(s)}` : '');

/**
 * Folds every result once, so a search only compares.
 * @param {FindItem[]} items
 * @returns {Prepared[]}
 */
export function prepare(items) {
  return items.map((it) => {
    const t = fold(it.title);
    const starts = [];
    for (let i = 0; i < t.length; i++) if (t[i] !== ' ' && (i === 0 || t[i - 1] === ' ')) starts.push(i);
    return { key: it.key, group: it.group, text: it.text, _item: it, _t: t, _starts: starts, _initials: starts.map((i) => t[i]).join(''), _w: flat((it.words ?? []).join(' ')), _d: flat(it.detail), _x: flat(it.text) };
  });
}

/**
 * Where one word matched, at its best (§7), and the letters to mark in the title.
 * @param {string} w @param {Prepared} p
 * @returns {{ score: number, marks: [number, number][] }}
 */
function scoreWord(w, p) {
  const t = p._t;
  // a word of one or two letters matches only where a word starts: inside words it matches almost anything
  const short = w.length < 3;
  if (t.startsWith(w)) return { score: 90, marks: [[0, w.length]] };
  for (const s of p._starts) if (t.startsWith(w, s)) return { score: 75, marks: [[s, s + w.length]] };
  const inside = short ? -1 : t.indexOf(w);
  if (inside >= 0) return { score: 55, marks: [[inside, inside + w.length]] };
  if (w.length >= 2 && p._initials.startsWith(w)) return { score: 50, marks: p._starts.slice(0, w.length).map((s) => /** @type {[number, number]} */ ([s, s + 1])) };
  if (p._w.includes(` ${w}`)) return { score: 45, marks: [] };
  if (short ? p._d.includes(` ${w}`) : p._w.includes(w) || p._d.includes(w)) return { score: 30, marks: [] };
  // a page's body, where a word starts
  if (p._x.includes(` ${w}`)) return { score: 15, marks: [] };
  return { score: 0, marks: [] };
}

/** A few words of the body round where a word matched it, for the card. @param {string} text @param {string} f the body folded, after a space @param {string} w */
function snippetOf(text, f, w) {
  // the folded body starts with a space, so a word starting at f[i + 1] starts at text[i]
  const at = f.indexOf(` ${w}`);
  if (at < 0) return undefined;
  const from = Math.max(0, f.lastIndexOf(' ', Math.max(0, at + 1 - 60)));
  const to = Math.min(text.length, at + w.length + 100);
  const cut = text.slice(from, to).trim();
  return `${from > 0 ? '…' : ''}${cut}${to < text.length ? '…' : ''}`;
}

/**
 * Every result that matches, best first.
 * @param {Prepared[]} items
 * @param {string} query
 * @param {{ recent?: string[] }} [o]
 * @returns {Found[]}
 */
export function search(items, query, o = {}) {
  const ws = words(query);
  if (!ws.length) return [];
  const whole = ws.join(' ');
  const recent = o.recent ?? [];
  /** @type {Found[]} */
  const found = [];
  for (const p of items) {
    let score = 101;
    /** @type {[number, number][]} */
    const marks = [];
    /** @type {string | undefined} */
    let inText;
    for (const w of ws) {
      const r = scoreWord(w, p);
      if (r.score === 15) inText ??= w;
      if (!r.score) {
        score = 0;
        break;
      }
      score = Math.min(score, r.score);
      marks.push(...r.marks);
    }
    if (!score) continue;
    const t = p._t.replace(/ +/g, ' ').trim();
    if (t === whole) score = 100;
    else if (t.startsWith(whole)) score = Math.max(score, 90);
    const r = recent.indexOf(p.key);
    if (r >= 0) score += 12 * (1 - r / RECENT_MAX);
    if (p.group === 'actions' || p.group === 'settings') score += 4;
    const inBody = inText && p.text ? snippetOf(p.text, p._x, inText) : undefined;
    found.push({ item: p._item, score, marks: merge(marks), ...(inBody ? { snippet: inBody } : {}) });
  }
  return found.sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length || a.item.title.localeCompare(b.item.title));
}

/** Overlapping marks as one. @param {[number, number][]} m @returns {[number, number][]} */
function merge(m) {
  const s = [...m].sort((a, b) => a[0] - b[0]);
  /** @type {[number, number][]} */
  const out = [];
  for (const r of s) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/**
 * The top hit, then each group's best, in the groups' order (§7), each with how many more there were.
 * @param {Found[]} found best first
 * @returns {{ top: Found | null, groups: { id: string, items: Found[], more: number }[] }}
 */
export function group(found) {
  const top = found[0] ?? null;
  const groups = GROUPS.map((id) => {
    const all = found.filter((f) => f.item.group === id && f !== top);
    const limit = LIMITS[/** @type {keyof typeof LIMITS} */ (id)];
    return { id, items: all.slice(0, limit), more: Math.max(0, all.length - limit) };
  }).filter((g) => g.items.length);
  return { top, groups };
}

/**
 * Recent, with what was just chosen first: at most RECENT_MAX, no repeats.
 * @param {string[]} recent @param {string} key
 */
export function remember(recent, key) {
  return [key, ...recent.filter((k) => k !== key)].slice(0, RECENT_MAX);
}
