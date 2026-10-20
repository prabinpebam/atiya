import { describe, expect, it } from 'vitest';
import { answerFrom, askedStatus, closest, moreLabel, MAX_CLOSEST, stem, termsOf, type IndexedAnswer } from '../../src/site/scripts/questionsRules';

const answer = (n: number, question: string, strengths: string[][], evidence: string[] = [], tags = strengths.length, proof?: string[][]): IndexedAnswer => ({
  n,
  id: `q${n}`,
  question,
  tags,
  terms: {
    question: termsOf(question),
    strengths: strengths.map((s) => termsOf(...s)),
    evidence: termsOf(...evidence),
    ...(proof ? { proof: proof.map((p) => termsOf(...p)) } : {}),
  },
});

// a made-up site: each strength its words; question 1 shows every strength, as it always does
const TEAMS = ['Leading design teams', 'Hiring', 'Mentoring', 'People management'];
const SYSTEMS = ['Design systems', 'Design tokens', 'Components'];
const RESEARCH = ['Research', 'Interviews', 'Diary studies'];
const STRATEGY = ['Product strategy', 'Roadmap'];
const ALL = [TEAMS, SYSTEMS, RESEARCH, STRATEGY, ['Craft'], ['Prototyping']];
const answers = [
  answer(1, 'What kind of design leader?', ALL, ['Sam Rivera, in their words']),
  answer(2, 'How does she build teams?', [TEAMS], ['How twelve designers became one studio']),
  answer(3, 'How does she run a design system?', [SYSTEMS], ['One kit for forty products', 'Dark mode in a week']),
  answer(4, 'How does research change plans?', [RESEARCH], ['The study that moved a roadmap']),
  answer(5, 'Contact, or a short résumé?', []),
];

describe('questions in the browser: the address', () => {
  it('reads #q<n> for an answer there is, and nothing else', () => {
    expect(answerFrom('#q1', 9)).toBe(1);
    expect(answerFrom('#q9', 9)).toBe(9);
    expect(answerFrom('#q10', 9)).toBeNull();
    expect(answerFrom('#q0', 9)).toBeNull();
    expect(answerFrom('#q01', 9)).toBeNull();
    expect(answerFrom('#cap-ai', 9)).toBeNull();
    expect(answerFrom('', 9)).toBeNull();
    expect(answerFrom('#q2x', 9)).toBeNull();
  });
});

describe('questions in the browser: terms', () => {
  it('stems a word’s forms alike', () => {
    expect(new Set(['managed', 'managers', 'management', 'manage'].map(stem))).toEqual(new Set(['manag']));
    expect(new Set(['leader', 'leaders', 'leadership', 'leading'].map(stem))).toEqual(new Set(['lead']));
    expect(new Set(['code', 'coded', 'coding'].map(stem))).toEqual(new Set(['cod']));
    expect(new Set(['system', 'systems'].map(stem))).toEqual(new Set(['system']));
    expect(stem('strategies')).toBe('strategy');
    // never fewer than three letters
    expect(stem('ai')).toBe('ai');
    expect(new Set(['use', 'uses'].map(stem))).toEqual(new Set(['use']));
  });

  it('leaves out the small words and keeps each term once, folded', () => {
    expect(termsOf('Has he managed managers?')).toEqual(['manag']);
    expect(termsOf('What does SHE do with AI and code?', 'AI')).toEqual(['ai', 'cod']);
    expect(termsOf('Who’s on the team?')).toEqual(['team']);
    expect(termsOf('', '   ', '?')).toEqual([]);
  });
});

describe('questions in the browser: the closest answers', () => {
  it('finds an answer by its own words first', () => {
    expect(closest('How do you build a team?', answers)[0].n).toBe(2);
    expect(closest('research', answers)[0].n).toBe(4);
  });

  it('finds one through the strengths it shows, and a word’s other forms', () => {
    // question 1 shows every strength, so it comes after the one that shows this one alone
    expect(closest('Has she managed managers?', answers).map((a) => a.n)).toEqual([2, 1]);
    expect(closest('mentor', answers)[0].n).toBe(2);
  });

  it('puts the answer that leads with a strength before one that shows it second', () => {
    const two = [answer(1, 'How does she work with others?', [STRATEGY, TEAMS]), answer(2, 'How does she build teams?', [TEAMS, SYSTEMS])];
    expect(closest('hiring', two).map((a) => a.n)).toEqual([2, 1]);
    expect(closest('roadmap', two).map((a) => a.n)).toEqual([1]);
  });

  it('finds one through a strength’s other proof, the items there’s no room to show, least of all', () => {
    const nine = ['Managing a team of nine'];
    const two = [
      answer(1, 'How does she work with others?', [STRATEGY, TEAMS], [], undefined, [[], nine]),
      answer(2, 'What has she shipped?', [SYSTEMS, TEAMS], [], undefined, [[], nine]),
      answer(3, 'How does she build teams?', [TEAMS], [], undefined, [nine]),
    ];
    expect(closest('Has she managed managers?', two).map((a) => a.n)).toEqual([3, 1, 2]);
    // shown evidence counts before it
    const shown = [answer(1, 'How does she work with others?', [TEAMS], [], undefined, [nine]), answer(2, 'What has she shipped?', [SYSTEMS], nine)];
    expect(closest('nine', shown)[0].n).toBe(2);
  });

  it('finds one through its evidence’s titles', () => {
    expect(closest('dark mode', answers).map((a) => a.n)).toEqual([3]);
  });

  it('puts the answer that shows a strength alone before the one that shows them all', () => {
    // question 1 shows every strength, so a strength's word says less about it
    expect(closest('design tokens', answers)[0].n).toBe(3);
    expect(closest('interviews', answers)[0].n).toBe(4);
  });

  it('a word every answer has counts less than one only a few have', () => {
    // "design" is in questions 1 and 3 and in nearly every strength; "kit" only in question 3's evidence
    expect(closest('design kit', answers)[0].n).toBe(3);
  });

  it('a question typed as it’s written finds its own answer, even where a longer question has its words too', () => {
    // question 2's full question also says "design" and "leaders", and it shows fewer strengths: question 1 still wins
    const both = [answer(1, 'What kind of design leader?', ALL), answer(2, 'How does she work with design and product leaders?', [['Partnering'], ['Product strategy']])];
    expect(closest('What kind of design leader?', both)[0].n).toBe(1);
    expect(closest('How does she work with design and product leaders?', both)[0].n).toBe(2);
  });

  it('matches the word still being typed by its beginning, and only then', () => {
    expect(closest('resea', answers, true)[0].n).toBe(4);
    expect(closest('resea', answers)).toEqual([]);
    // two letters are too few to guess from
    expect(closest('re', answers, true)).toEqual([]);
    // only the last word is unfinished
    const found = closest('resea team', answers, true).map((a) => a.n);
    expect(found[0]).toBe(2);
    expect(found).not.toContain(4);
  });

  it('gives at most a few, and none for words the site doesn’t have or only small words', () => {
    expect(closest('design', answers).length).toBeLessThanOrEqual(MAX_CLOSEST);
    expect(closest('Underwater basket weaving', answers)).toEqual([]);
    expect(closest('What is it?', answers)).toEqual([]);
    expect(closest('', answers)).toEqual([]);
    expect(closest('anything', [])).toEqual([]);
  });
});

describe('questions in the browser: words', () => {
  it('says the closest answer, or that there is none', () => {
    expect(askedStatus({ n: 6, question: 'How does he build teams?' })).toBe('Closest answer: question 6, How does he build teams?');
    expect(askedStatus()).toBe('There’s no answer to that here yet.');
  });

  it('counts the questions Show more adds', () => {
    expect(moreLabel(1)).toBe('Show 1 more question');
    expect(moreLabel(5)).toBe('Show 5 more questions');
  });
});
