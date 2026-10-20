/**
 * The Home screen's changes (documentation/home-views/controls.md §1 to §5; plan stage 3.2): the goal, the strengths
 * and their words, Auto, Pinned and Hidden for proof and highlights, a strength's voice, the always-on actions' labels,
 * More options, and the views offered with the default and each view's settings. Each change returns the new spine
 * (`content/showcase.json`) or home key (`content/structures/ways.json`), or a refusal naming the field and what to do
 * instead (§5). Only differences from the defaults are stored (CT6). Pure: the store writes what these return.
 */
import { CATALOGUE, type SettingSpec } from '../../home/catalogue';
import { canOffer, shortOf, type Counts, type HomeWays } from '../../home/health';
import { GOALS, VIEW_IDS, type Goal, type ViewId } from '../../home/ids';
import { normalise } from '../../home/evidence';
import { CURATION_DEFAULTS, PROOF_KINDS, RECENT, STRICT, type Capability, type ProofItem, type ProofKind, type Showcase } from '../../home/schema';

/** A change made, with what the person should know about it; or refused, with the field and what to do instead. */
export type HomeResult<T> = { ok: true; value: T; note?: string } | { ok: false; field: string; message: string };

const done = <T>(value: T, note?: string): HomeResult<T> => ({ ok: true, value, ...(note ? { note } : {}) });
const refuse = <T>(field: string, message: string): HomeResult<T> => ({ ok: false, field, message });

export const MIN_STRENGTHS = 3;
export const MAX_STRENGTHS = 6;
export const NAME_MAX = 48;
export const SHORT_MAX = 12;
export const LINE_WORDS = 6;
export const VOICE_WORDS = 12;
export const LABEL_MAX = 32;
export const MAX_HIGHLIGHTS = 8;

/** Where an item the rules can place stands (§4). */
export type ItemState = 'auto' | 'pinned' | 'hidden';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** What's wrong with a strength's name, short name or line, or null. */
export function strengthTextProblem(field: 'name' | 'short' | 'line', value: string): string | null {
  const v = value.trim();
  if (field === 'name') {
    if (!v) return 'Give the strength a name.';
    return v.length > NAME_MAX ? `Keep the name to ${NAME_MAX} characters: it has ${v.length}.` : null;
  }
  if (field === 'short') {
    if (!v) return `Give it a short name for tight places, ${SHORT_MAX} characters at most.`;
    return v.length > SHORT_MAX ? `Keep the short name to ${SHORT_MAX} characters: it has ${v.length}.` : null;
  }
  if (!v) return `Write its line: its proof as a fact, in ${LINE_WORDS} words or fewer.`;
  return words(v) > LINE_WORDS ? `Keep the line to ${LINE_WORDS} words: it has ${words(v)}.` : null;
}

/** A new strength's ID from its name: kebab-case, kept apart from the IDs already taken. */
export function strengthId(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'strength';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

const findStrength = (s: Showcase, id: string) => s.capabilities.find((c) => c.id === id);
const GONE = "That strength isn't on your home page any more: reload the screen.";
const withStrength = (s: Showcase, id: string, f: (c: Capability) => Capability): Showcase => ({ ...s, capabilities: s.capabilities.map((c) => (c.id === id ? f(c) : c)) });

/** What the site is for: it sets the actions' labels, the kinds of proof that count most and the default view (§1). */
export function setGoal(s: Showcase, goal: string): HomeResult<Showcase> {
  if (!GOALS.includes(goal as Goal)) return refuse('goal', 'Choose Get hired, Win clients or Share my work.');
  const { goal: _old, ...rest } = s;
  return done(goal === 'hired' ? rest : { ...rest, goal: goal as Goal });
}

/** Adds a strength at the end: 6 at most, each with its name, short name and line. */
export function addStrength(s: Showcase, text: { name: string; short: string; line: string }): HomeResult<Showcase> {
  if (s.capabilities.length >= MAX_STRENGTHS) return refuse('strengths', "Six is the most a phone's first screen can show. Merge two, or make one a topic.");
  for (const field of ['name', 'short', 'line'] as const) {
    const problem = strengthTextProblem(field, text[field]);
    if (problem) return refuse(field, problem);
  }
  const id = strengthId(text.name, s.capabilities.map((c) => c.id));
  return done({ ...s, capabilities: [...s.capabilities, { id, name: text.name.trim(), short: text.short.trim(), line: text.line.trim() }] });
}

/** Renames a strength or changes its line; its ID stays, so links and lenses still work. */
export function editStrength(s: Showcase, id: string, text: Partial<Record<'name' | 'short' | 'line', string>>): HomeResult<Showcase> {
  if (!findStrength(s, id)) return refuse('strengths', GONE);
  for (const field of ['name', 'short', 'line'] as const) {
    const v = text[field];
    const problem = v === undefined ? null : strengthTextProblem(field, v);
    if (problem) return refuse(field, problem);
  }
  const trimmed = Object.fromEntries(Object.entries(text).flatMap(([k, v]) => (v === undefined ? [] : [[k, v.trim()]])));
  return done(withStrength(s, id, (c) => ({ ...c, ...trimmed })));
}

/** Removes a strength and every mention of it (its highlights, its reel chapter, the lenses' and questions' lists). */
export function removeStrength(s: Showcase, id: string): HomeResult<Showcase> {
  if (!findStrength(s, id)) return refuse('strengths', GONE);
  const next: Showcase = { ...s, capabilities: s.capabilities.filter((c) => c.id !== id) };
  if (s.highlights) next.highlights = s.highlights.filter((h) => h.capability !== id);
  if (s.lenses) next.lenses = s.lenses.map((l) => (l.order ? { ...l, order: l.order.filter((o) => o !== id) } : l));
  if (s.questions) next.questions = s.questions.map((q) => ({ ...q, capabilities: q.capabilities.filter((c) => c !== id) }));
  if (s.reel) next.reel = { chapters: s.reel.chapters.filter((c) => c.capability !== id) };
  const left = next.capabilities.length;
  return done(next, left < MIN_STRENGTHS ? `With ${left} ${left === 1 ? 'strength' : 'strengths'}, your home page is the classic hub until you have ${MIN_STRENGTHS}.` : undefined);
}

/** Moves a strength to a place in the order (Move up, Move down, a drag). */
export function moveStrength(s: Showcase, id: string, to: number): HomeResult<Showcase> {
  const from = s.capabilities.findIndex((c) => c.id === id);
  if (from < 0) return refuse('strengths', GONE);
  const list = [...s.capabilities];
  const [moved] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, to)), 0, moved);
  return done({ ...s, capabilities: list });
}

const sameItem = (a: ProofItem, b: ProofItem) =>
  (a.ref !== undefined && a.ref === b.ref) || (a.resume !== undefined && b.resume !== undefined && normalise(a.resume) === normalise(b.resume)) || (a.recommendation !== undefined && a.recommendation === b.recommendation);

/** A proof item's state under a strength: Pinned (in its proof), Hidden (a page in its hide list) or Auto. */
export function proofState(c: Capability, item: ProofItem): ItemState {
  if ((c.proof ?? []).some((p) => sameItem(p, item))) return 'pinned';
  return item.ref && (c.hide ?? []).includes(item.ref) ? 'hidden' : 'auto';
}

/** Pins, hides or returns to Auto a proof item under one strength (hidden is per strength: §4). */
export function setProofState(s: Showcase, id: string, item: ProofItem, state: ItemState): HomeResult<Showcase> {
  const c = findStrength(s, id);
  if (!c) return refuse('strengths', GONE);
  if (state === 'hidden' && !item.ref) return refuse('proof', 'Only a page can be hidden. A résumé line or a recommendation shows only while it’s pinned: set it to Auto instead.');
  const proof = (c.proof ?? []).filter((p) => !sameItem(p, item));
  const hide = (c.hide ?? []).filter((r) => r !== item.ref);
  if (state === 'pinned') proof.push(item);
  if (state === 'hidden') hide.push(item.ref!);
  const { proof: _p, hide: _h, ...rest } = c;
  const next = withStrength(s, id, () => ({ ...rest, ...(proof.length ? { proof } : {}), ...(hide.length ? { hide } : {}) }));
  const shown = s.curation?.detail ?? CURATION_DEFAULTS.detail;
  const note = state === 'pinned' && proof.length > shown ? `${proof.length} pinned, ${shown} shown: the first ${shown}. Change Details shown or unpin one.` : undefined;
  return done(next, note);
}

/** Moves a pin within a strength's pins. */
export function movePin(s: Showcase, id: string, from: number, to: number): HomeResult<Showcase> {
  const c = findStrength(s, id);
  if (!c) return refuse('strengths', GONE);
  const proof = [...(c.proof ?? [])];
  if (from < 0 || from >= proof.length) return refuse('proof', "That pin isn't there any more: reload the screen.");
  const [moved] = proof.splice(from, 1);
  proof.splice(Math.max(0, Math.min(proof.length, to)), 0, moved);
  return done(withStrength(s, id, (x) => ({ ...x, proof })));
}

/** A page's state among the highlights. */
export function highlightState(s: Showcase, ref: string): ItemState {
  if ((s.highlights ?? []).some((h) => h.ref === ref)) return 'pinned';
  return (s.hideHighlights ?? []).includes(ref) ? 'hidden' : 'auto';
}

/** Pins a page as a highlight of a strength (8 at most), hides it from the highlights, or returns it to Auto. */
export function setHighlightState(s: Showcase, ref: string, state: ItemState, capability?: string): HomeResult<Showcase> {
  const highlights = (s.highlights ?? []).filter((h) => h.ref !== ref);
  const hidden = (s.hideHighlights ?? []).filter((r) => r !== ref);
  if (state === 'pinned') {
    if (!capability || !findStrength(s, capability)) return refuse('highlights', 'Choose the strength this highlight proves.');
    if (highlights.length >= MAX_HIGHLIGHTS) return refuse('highlights', `Eight highlights at most: unpin one first.`);
    highlights.push({ ref, capability });
  }
  if (state === 'hidden') hidden.push(ref);
  const { highlights: _h, hideHighlights: _x, ...rest } = s;
  return done({ ...rest, ...(highlights.length ? { highlights } : {}), ...(hidden.length ? { hideHighlights: hidden } : {}) });
}

/** A strength's voice: a sentence chosen from a recommendation's words, word for word, 12 words at most; none clears it. */
export function setVoice(s: Showcase, id: string, voice: { recommendation: string; quote: string; words: string } | null): HomeResult<Showcase> {
  if (!findStrength(s, id)) return refuse('strengths', GONE);
  if (!voice) return done(withStrength(s, id, ({ voice: _v, ...c }) => c));
  const quote = voice.quote.trim().replace(/\s+/g, ' ');
  if (!quote) return refuse('voice', 'Select a sentence from their words.');
  if (words(quote) > VOICE_WORDS) return refuse('voice', `Choose ${VOICE_WORDS} words at most: this has ${words(quote)}.`);
  if (!normalise(voice.words).includes(normalise(quote))) return refuse('voice', 'Choose a sentence from their words: a voice is quoted word for word, never typed.');
  return done(withStrength(s, id, (c) => ({ ...c, voice: { recommendation: voice.recommendation, quote } })));
}

/** Renames one of the two always-on actions; empty goes back to the goal's own words. They're never removed. */
export function setActionLabel(s: Showcase, which: 'primary' | 'secondary', label: string): HomeResult<Showcase> {
  const v = label.trim();
  if (v.length > LABEL_MAX) return refuse(`actions.${which}`, `Keep the label to ${LABEL_MAX} characters: it has ${v.length}.`);
  const goal = CATALOGUE.goals[s.goal ?? 'hired'];
  const actions = { ...s.actions };
  if (!v || v === goal.actions[which]) delete actions[which];
  else actions[which] = v;
  const { actions: _a, ...rest } = s;
  return done(Object.keys(actions).length ? { ...rest, actions } : rest);
}

type Curation = NonNullable<Showcase['curation']>;

/** One of More options (§2); a value equal to the default is left out. */
export function setCuration<K extends 'recent' | 'strict' | 'detail' | 'hold'>(s: Showcase, key: K, value: Curation[K]): HomeResult<Showcase> {
  const ok =
    key === 'recent' ? RECENT.includes(value as never) : key === 'strict' ? STRICT.includes(value as never) : key === 'detail' ? Number.isInteger(value) && (value as number) >= 3 && (value as number) <= 8 : typeof value === 'boolean';
  if (!ok) return refuse(`curation.${key}`, key === 'detail' ? 'Show 3 to 8 details.' : key === 'hold' ? 'Hold is on or off.' : `Choose one of ${(key === 'recent' ? RECENT : STRICT).join(', ')}.`);
  const curation: Curation = { ...s.curation };
  if (value === CURATION_DEFAULTS[key]) delete curation[key];
  else curation[key] = value;
  const { curation: _c, ...rest } = s;
  return done(Object.keys(curation).length ? { ...rest, curation } : rest);
}

const label = (view: ViewId) => CATALOGUE.views[view].label;
const inOrder = (views: Iterable<ViewId>) => VIEW_IDS.filter((v) => new Set(views).has(v));
const needs = (view: ViewId, counts: Counts): string | null => {
  if (!CATALOGUE.views[view].built) return `${label(view)} isn't built in this version yet.`;
  const short = shortOf(view, counts);
  return short.length ? `${short.join('; ')}.` : null;
};

/** Offers a view to visitors, or stops offering it. A view below its minimum can't be offered; the default can't be withdrawn. */
export function offerView(home: HomeWays, view: ViewId, on: boolean, counts: Counts): HomeResult<HomeWays> {
  const offered = new Set(home.offered ?? (home.default ? [home.default] : []));
  if (on) {
    const need = view === 'classic' ? null : needs(view, counts);
    if (need) return refuse(`offered.${view}`, need);
    offered.add(view);
  } else {
    if ((home.default ?? 'classic') === view) return refuse(`offered.${view}`, `${label(view)} is your default view: make another the default first.`);
    offered.delete(view);
  }
  return done({ ...home, offered: inOrder(offered) });
}

/** Makes a view the home page (`/`) and offers it. Never a view below its minimum (§5). */
export function setDefaultView(home: HomeWays, view: ViewId, counts: Counts): HomeResult<HomeWays> {
  if (view !== 'classic' && !canOffer(view, counts)) return refuse('default', needs(view, counts) ?? `${label(view)} can't be offered yet.`);
  const offered = inOrder([...(home.offered ?? []), ...(home.default ? [home.default] : []), view]);
  return done({ ...home, default: view, offered });
}

function settingProblem(spec: SettingSpec, value: unknown): string | null {
  switch (spec.type) {
    case 'choice':
      return spec.values?.includes(value as string) ? null : `Choose ${(spec.labels ?? spec.values ?? []).join(', ')}.`;
    case 'number': {
      const min = spec.min ?? 0;
      const max = spec.max ?? min;
      return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? null : `Choose ${min} to ${max}.`;
    }
    case 'kinds': {
      const kinds = Array.isArray(value) ? (value as string[]) : [];
      const ok = kinds.length >= 1 && kinds.length <= 5 && new Set(kinds).size === kinds.length && kinds.every((k) => PROOF_KINDS.includes(k as ProofKind));
      return ok ? null : 'Choose 1 to 5 kinds of proof, each once.';
    }
    default:
      return typeof value === 'string' && value.trim() ? null : 'Choose one, or leave it to the rules.';
  }
}

/** One of a view's settings (§3). A value equal to the default, or none, is left out; a view with none left has no entry. */
export function setViewSetting(home: HomeWays, view: ViewId, key: string, value: unknown): HomeResult<HomeWays> {
  const spec = CATALOGUE.views[view].settings[key];
  if (!spec) return refuse(`settings.${view}.${key}`, `${label(view)} has no setting called ${key}.`);
  const cleared = value === undefined || value === null || value === '';
  const problem = cleared ? null : settingProblem(spec, value);
  if (problem) return refuse(`settings.${view}.${key}`, problem);
  const own: Record<string, unknown> = { ...home.settings?.[view] };
  if (cleared || value === spec.default) delete own[key];
  else own[key] = value;
  const settings: NonNullable<HomeWays['settings']> = { ...home.settings };
  if (Object.keys(own).length) settings[view] = own;
  else delete settings[view];
  const { settings: _s, ...rest } = home;
  return done(Object.keys(settings).length ? { ...rest, settings } : rest);
}
