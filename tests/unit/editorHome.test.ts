import { describe, expect, it } from 'vitest';
import {
  addStrength,
  editStrength,
  highlightState,
  moveStrength,
  movePin,
  offerView,
  proofState,
  removeStrength,
  setActionLabel,
  setCuration,
  setDefaultView,
  setGoal,
  setHighlightState,
  setProofState,
  setViewSetting,
  setVoice,
  strengthId,
  strengthTextProblem,
  type HomeResult,
} from '../../src/site/editor/model/home';
import type { Counts } from '../../src/site/home/health';
import { showcaseFile, type Showcase } from '../../src/site/home/schema';

const ok = <T>(r: HomeResult<T>): T => {
  if (!r.ok) throw new Error(`refused: ${r.field}: ${r.message}`);
  return r.value;
};
const refused = <T>(r: HomeResult<T>) => {
  if (r.ok) throw new Error('expected a refusal');
  return r;
};

const strength = (id: string) => ({ id, name: `Strength ${id}`, short: id, line: 'Shipped it at scale' });
const base = (): Showcase => ({
  capabilities: [strength('lead'), strength('ai'), strength('make')],
  facts: [{ id: 'years', text: '18 years', source: 'ref:article/resume' }],
});
const counts = (c: Partial<Counts> = {}): Counts => ({ strengths: 3, pictures: 2, highlights: 1, everyPicture: false, keywords: 4, proof: 6, kinds: 2, answers: 0, ...c });

describe('the Home screen: strengths', () => {
  it('adds a strength with an ID from its name, and keeps every other field', () => {
    const s = ok(addStrength(base(), { name: 'Design systems!', short: 'Systems', line: 'Three systems, one team' }));
    expect(s.capabilities.map((c) => c.id)).toEqual(['lead', 'ai', 'make', 'design-systems']);
    expect(s.facts).toEqual(base().facts);
    expect(showcaseFile.safeParse(s).success).toBe(true);
    expect(strengthId('Lead', ['lead', 'lead-2'])).toBe('lead-3');
    expect(strengthId('!!!', [])).toBe('strength');
  });

  it('refuses a seventh strength, and words past the limits, naming the field and the fix', () => {
    let s = base();
    for (const n of ['four', 'five', 'six']) s = ok(addStrength(s, { name: n, short: n, line: 'A line' }));
    const seventh = refused(addStrength(s, { name: 'seven', short: 'seven', line: 'A line' }));
    expect(seventh.field).toBe('strengths');
    expect(seventh.message).toMatch(/Six is the most/);
    expect(refused(addStrength(base(), { name: 'x', short: 'Thirteen char', line: 'ok' })).field).toBe('short');
    expect(refused(addStrength(base(), { name: 'x', short: 'x', line: 'one two three four five six seven' })).message).toBe('Keep the line to 6 words: it has 7.');
    expect(refused(addStrength(base(), { name: ' ', short: 'x', line: 'ok' })).field).toBe('name');
    expect(strengthTextProblem('short', 'Twelve chars')).toBeNull();
  });

  it('renames a strength and keeps its ID, pins and voice', () => {
    const before: Showcase = { ...base(), capabilities: [{ ...strength('lead'), proof: [{ ref: 'ref:article/a' }], voice: { recommendation: 'r1', quote: 'She leads well' } }, strength('ai'), strength('make')] };
    const s = ok(editStrength(before, 'lead', { name: 'Leading teams', line: ' Built a team of 40 ' }));
    expect(s.capabilities[0]).toEqual({ ...before.capabilities[0], name: 'Leading teams', line: 'Built a team of 40' });
    expect(refused(editStrength(before, 'gone', { name: 'x' })).field).toBe('strengths');
    expect(refused(editStrength(before, 'lead', { short: 'far too long a name' })).field).toBe('short');
  });

  it('removes a strength and every mention of it, and says when the home falls back to the hub', () => {
    const before: Showcase = {
      ...base(),
      highlights: [{ ref: 'ref:article/a', capability: 'ai' }, { ref: 'ref:article/b', capability: 'lead' }],
      lenses: [{ id: 'eng', label: 'Engineering', order: ['ai', 'lead'] }],
      questions: [{ id: 'q', question: 'Why?', answer: 'Because.', capabilities: ['ai', 'make'] }],
      reel: { chapters: [{ capability: 'ai' }, { capability: 'make' }] },
    };
    const r = removeStrength(before, 'ai');
    const s = ok(r);
    expect(s.capabilities.map((c) => c.id)).toEqual(['lead', 'make']);
    expect(s.highlights).toEqual([{ ref: 'ref:article/b', capability: 'lead' }]);
    expect(s.lenses?.[0].order).toEqual(['lead']);
    expect(s.questions?.[0].capabilities).toEqual(['make']);
    expect(s.reel?.chapters).toEqual([{ capability: 'make' }]);
    expect(r.ok && r.note).toMatch(/classic hub until you have 3/);
  });

  it('moves a strength to any place, clamped to the list', () => {
    expect(ok(moveStrength(base(), 'make', 0)).capabilities.map((c) => c.id)).toEqual(['make', 'lead', 'ai']);
    expect(ok(moveStrength(base(), 'lead', 99)).capabilities.map((c) => c.id)).toEqual(['ai', 'make', 'lead']);
  });
});

describe('the Home screen: Auto, Pinned, Hidden', () => {
  const page = { ref: 'ref:article/a' };

  it('pins, hides and returns a page to Auto under one strength only', () => {
    let s = ok(setProofState(base(), 'ai', page, 'pinned'));
    expect(proofState(s.capabilities[1], page)).toBe('pinned');
    expect(proofState(s.capabilities[0], page)).toBe('auto');
    s = ok(setProofState(s, 'ai', page, 'hidden'));
    expect(s.capabilities[1].proof).toBeUndefined();
    expect(s.capabilities[1].hide).toEqual(['ref:article/a']);
    expect(proofState(s.capabilities[1], page)).toBe('hidden');
    s = ok(setProofState(s, 'ai', page, 'auto'));
    expect(s.capabilities[1]).toEqual(strength('ai'));
  });

  it('pins a résumé line once, whatever its spacing, and never hides one', () => {
    const line = { kind: 'led' as const, resume: 'Led a team of 40' };
    let s = ok(setProofState(base(), 'lead', line, 'pinned'));
    s = ok(setProofState(s, 'lead', { kind: 'led', resume: 'led a  team of 40' }, 'pinned'));
    expect(s.capabilities[0].proof).toHaveLength(1);
    expect(refused(setProofState(s, 'lead', line, 'hidden')).field).toBe('proof');
  });

  it('says when there are more pins than places', () => {
    let s: Showcase = { ...base(), curation: { detail: 3 } };
    for (const id of ['a', 'b', 'c']) s = ok(setProofState(s, 'ai', { ref: `ref:article/${id}` }, 'pinned'));
    const r = setProofState(s, 'ai', { ref: 'ref:article/d' }, 'pinned');
    expect(r.ok && r.note).toBe('4 pinned, 3 shown: the first 3. Change Details shown or unpin one.');
  });

  it('reorders pins', () => {
    let s = base();
    for (const id of ['a', 'b', 'c']) s = ok(setProofState(s, 'ai', { ref: `ref:article/${id}` }, 'pinned'));
    s = ok(movePin(s, 'ai', 2, 0));
    expect(s.capabilities[1].proof?.map((p) => p.ref)).toEqual(['ref:article/c', 'ref:article/a', 'ref:article/b']);
    expect(refused(movePin(s, 'ai', 5, 0)).field).toBe('proof');
  });

  it('pins a highlight to a strength (eight at most), hides one, and returns it to Auto', () => {
    let s = ok(setHighlightState(base(), 'ref:article/a', 'pinned', 'make'));
    expect(highlightState(s, 'ref:article/a')).toBe('pinned');
    expect(refused(setHighlightState(s, 'ref:article/b', 'pinned')).field).toBe('highlights');
    s = ok(setHighlightState(s, 'ref:article/a', 'hidden'));
    expect(s.highlights).toBeUndefined();
    expect(s.hideHighlights).toEqual(['ref:article/a']);
    s = ok(setHighlightState(s, 'ref:article/a', 'auto'));
    expect(s).toEqual(base());
    for (let i = 0; i < 8; i++) s = ok(setHighlightState(s, `ref:article/p${i}`, 'pinned', 'ai'));
    expect(refused(setHighlightState(s, 'ref:article/p9', 'pinned', 'ai')).message).toMatch(/Eight highlights/);
  });
});

describe('the Home screen: voices, actions and More options', () => {
  const words = 'He builds teams that ship. Calm under pressure, and always generous with credit.';

  it('takes a voice word for word from the recommendation, 12 words at most, and clears it', () => {
    let s = ok(setVoice(base(), 'lead', { recommendation: 'r1', quote: 'calm under  pressure', words }));
    expect(s.capabilities[0].voice).toEqual({ recommendation: 'r1', quote: 'calm under pressure' });
    expect(refused(setVoice(base(), 'lead', { recommendation: 'r1', quote: 'Calm in a crisis', words })).message).toMatch(/word for word/);
    expect(refused(setVoice(base(), 'lead', { recommendation: 'r1', quote: words, words })).message).toBe('Choose 12 words at most: this has 13.');
    s = ok(setVoice(s, 'lead', null));
    expect(s).toEqual(base());
  });

  it('sets the goal, storing nothing for Get hired', () => {
    expect(ok(setGoal(base(), 'clients')).goal).toBe('clients');
    expect('goal' in ok(setGoal({ ...base(), goal: 'clients' }, 'hired'))).toBe(false);
    expect(refused(setGoal(base(), 'fame')).field).toBe('goal');
  });

  it("renames the actions, and goes back to the goal's words when emptied or equal", () => {
    let s = ok(setActionLabel(base(), 'secondary', 'Say hello'));
    expect(s.actions).toEqual({ secondary: 'Say hello' });
    s = ok(setActionLabel(s, 'secondary', ''));
    expect(s.actions).toBeUndefined();
    expect(ok(setActionLabel(base(), 'primary', 'Read résumé')).actions).toBeUndefined();
    expect(refused(setActionLabel(base(), 'primary', 'x'.repeat(33))).field).toBe('actions.primary');
  });

  it('stores only the options that differ from the defaults', () => {
    let s = ok(setCuration(base(), 'detail', 7));
    s = ok(setCuration(s, 'hold', true));
    expect(s.curation).toEqual({ detail: 7, hold: true });
    s = ok(setCuration(s, 'detail', 5));
    s = ok(setCuration(s, 'hold', false));
    expect(s).toEqual(base());
    expect(refused(setCuration(base(), 'detail', 9)).message).toBe('Show 3 to 8 details.');
    expect(refused(setCuration(base(), 'strict', 'tight' as never)).field).toBe('curation.strict');
  });
});

describe('the Home screen: views', () => {
  it('makes a view the default only when it meets its minimum, and offers it', () => {
    const home = ok(setDefaultView({ default: 'classic' }, 'bento', counts()));
    expect(home).toEqual({ default: 'bento', offered: ['classic', 'bento'] });
    expect(refused(setDefaultView({}, 'spotlight', counts())).message).toBe('Spotlight needs 4 highlights with pictures; you have 1.');
    expect(refused(setDefaultView({}, 'questions', counts({ answers: 9 }))).message).toMatch(/isn't built/);
    expect(ok(setDefaultView({ default: 'bento', offered: ['bento'] }, 'classic', counts({ strengths: 1 }))).default).toBe('classic');
  });

  it('offers and withdraws views, never the default and never one below its minimum', () => {
    let home = ok(offerView({ default: 'bento' }, 'proof-grid', true, counts({ kinds: 3, proof: 8 })));
    expect(home.offered).toEqual(['bento', 'proof-grid']);
    expect(refused(offerView(home, 'bento', false, counts())).message).toMatch(/your default view/);
    expect(refused(offerView(home, 'cover', true, counts({ pictures: 0 }))).field).toBe('offered.cover');
    home = ok(offerView(home, 'proof-grid', false, counts()));
    expect(home.offered).toEqual(['bento']);
  });

  it("stores a view's settings only where they differ, and refuses values it doesn't have", () => {
    let home = ok(setViewSetting({ default: 'bento' }, 'bento', 'density', 'full'));
    expect(home.settings).toEqual({ bento: { density: 'full' } });
    home = ok(setViewSetting(home, 'spotlight', 'count', 6));
    home = ok(setViewSetting(home, 'proof-grid', 'columns', ['led', 'shipped', 'said']));
    home = ok(setViewSetting(home, 'bento', 'density', 'calm'));
    expect(home.settings).toEqual({ spotlight: { count: 6 }, 'proof-grid': { columns: ['led', 'shipped', 'said'] } });
    home = ok(setViewSetting(home, 'spotlight', 'count', null));
    home = ok(setViewSetting(home, 'proof-grid', 'columns', undefined));
    expect(home).toEqual({ default: 'bento' });
    expect(refused(setViewSetting(home, 'spotlight', 'count', 9)).message).toBe('Choose 4 to 8.');
    expect(refused(setViewSetting(home, 'bento', 'lead', 'loud')).field).toBe('settings.bento.lead');
    expect(refused(setViewSetting(home, 'bento', 'autoplay', true)).message).toMatch(/no setting called autoplay/);
    expect(refused(setViewSetting(home, 'proof-grid', 'columns', ['led', 'led'])).message).toMatch(/each once/);
  });
});
