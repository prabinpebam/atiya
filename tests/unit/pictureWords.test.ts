import { describe, expect, it } from 'vitest';
import { captionMissLine } from '../../src/site/editor/model/captionText';
import {
  BATCH_KINDS,
  WORD_KINDS,
  batchAsked,
  batchChanges,
  batchDoneLine,
  batchNeeds,
  batchOffLine,
  batchProgress,
  batchRunLabel,
  cleanPlace,
  cleanWords,
  missingWords,
  needsLine,
  roughly,
  wantedKinds,
  wordMissLine,
  wordsMessages,
  wordsSchema,
  wordsSystem,
  type BatchKind,
} from '../../src/site/editor/model/pictureWords';

describe('suggested words (gallery spec §9.8.2)', () => {
  it('asks only for the kinds wanted, known and in order, each required', () => {
    expect(wantedKinds(['place', 'alt', 'nonsense', 'caption'])).toEqual(['caption', 'alt', 'place']);
    expect(wordsSchema(['caption', 'place'])).toEqual({ type: 'object', properties: { caption: { type: 'string' }, place: { type: 'string' } }, required: ['caption', 'place'], additionalProperties: false });
  });

  it('gives each kind its rules, never who a person is, and a place from coordinates or only what the picture shows', () => {
    const all = wordsSystem(WORD_KINDS, true);
    for (const k of WORD_KINDS) expect(all).toContain(`"${k}":`);
    expect(all).toMatch(/Never say who a person is/);
    expect(all).toMatch(/never a street/);
    expect(wordsSystem(['place'], false)).toMatch(/Never guess/);
    expect(wordsSystem(['caption'], false)).not.toMatch(/"place"/);
  });

  it('sends where it was taken rounded to about a kilometre, only when a place is asked', () => {
    expect(roughly({ lat: 24.81712, lon: 93.93649 })).toEqual({ lat: 24.82, lon: 93.94 });
    const located = wordsMessages('data:x', ['place'], { lat: 24.81712, lon: 93.93649 });
    expect(JSON.stringify(located)).toMatch(/latitude 24\.82, longitude 93\.94/);
    expect(JSON.stringify(located)).not.toMatch(/24\.817/);
    expect(JSON.stringify(wordsMessages('data:x', ['caption'], { lat: 24.8, lon: 93.9 }))).not.toMatch(/latitude/);
    expect(JSON.stringify(wordsMessages('data:x', ['place'], null))).not.toMatch(/latitude/);
  });

  it('holds every kind to its rules and says why one missed', () => {
    const a = cleanWords(JSON.stringify({ caption: 'Photo of boats at dawn', description: 'Boats rest on a calm river.  The sky is pink.', alt: 'A woman named Priya smiling.', place: 'Loktak Lake, Manipur, India.' }), WORD_KINDS);
    expect(a.words).toEqual({ caption: 'Boats at dawn', description: 'Boats rest on a calm river. The sky is pink.', place: 'Loktak Lake, Manipur, India' });
    expect(a.missed).toEqual({ alt: 'identifies' });
    expect(cleanWords('not json', ['caption']).missed).toEqual({ caption: 'empty' });
    expect(cleanWords('{"description":"' + 'Long words. '.repeat(60) + '"}', ['description']).words.description!.length).toBeLessThanOrEqual(400);
  });

  it('keeps a place to a town or region: never a street, a number, or "unknown"', () => {
    expect(cleanPlace('{"place":"Kyoto, Japan"}')).toEqual({ text: 'Kyoto, Japan' });
    expect(cleanPlace('{"place":"St Ives, Cornwall"}')).toEqual({ text: 'St Ives, Cornwall' });
    for (const p of ['12 Baker Street, London', 'MG Road, Bengaluru', 'Unknown', 'Not visible', '', 'x'.repeat(81)]) expect(cleanPlace(JSON.stringify({ place: p }))).toEqual({ text: null, why: 'unplaced' });
  });

  it('says what happened and what to do, and a caption\u2019s lines are exactly the caption suggestion\u2019s', () => {
    for (const why of ['timeout', 'refused', 'unreadable', 'no-writer', 'blind', 'private', 'failed', undefined]) expect(wordMissLine('caption', why)).toBe(captionMissLine(why));
    expect(wordMissLine('caption', 'identifies')).toBe(captionMissLine('refused'));
    expect(wordMissLine('place', 'unplaced')).toBe("The picture doesn't show where it was taken. Write the place yourself.");
    expect(wordMissLine('description', 'timeout')).toBe('The description took too long to come. Try again, or write it yourself.');
    expect(wordMissLine('alt', 'private')).toMatch(/Write the alt text yourself\.$/);
    for (const k of WORD_KINDS) for (const why of ['timeout', 'refused', 'unreadable', 'no-writer', 'blind', 'private', 'failed', 'unplaced']) expect(wordMissLine(k, why)).toMatch(/\.$/);
  });
});

describe('several pictures at once (§9.8.2 Suggest for N pictures)', () => {
  it('asks only for what each one is missing: alt never for a decorative one, and a video only its date', () => {
    expect(missingWords({ kind: 'image', caption: 'Has one', alt: '' }, BATCH_KINDS)).toEqual(['description', 'alt', 'place', 'taken']);
    expect(missingWords({ kind: 'image', decorative: true }, ['alt', 'caption'])).toEqual(['caption']);
    expect(missingWords({ kind: 'video' }, BATCH_KINDS)).toEqual(['taken']);
    expect(missingWords({ kind: 'image', taken: '2026-01-01' }, ['taken'])).toEqual([]);
  });

  it('says its progress and what it found, and that nothing is saved yet', () => {
    expect(batchProgress(3, 12)).toBe('Suggested 3 of 12');
    expect(batchDoneLine(0, 0)).toMatch(/already have/);
    expect(batchDoneLine(0, 2)).toMatch(/No suggestions came for 2 pictures/);
    expect(batchDoneLine(1, 0)).toBe('Suggestions for 1 picture are ready to review: nothing is saved until you save them.');
    expect(batchDoneLine(4, 1)).toMatch(/None came for 1 picture\.$/);
  });

  it('counts what they lack, asks only about those lacking a kind chosen, and says so beside each choice', () => {
    const lacks = { a: ['caption', 'taken'], b: ['caption'], c: [] } as Record<string, BatchKind[]>;
    expect(batchNeeds(Object.values(lacks))).toEqual({ caption: 2, description: 0, alt: 0, place: 0, taken: 1 });
    expect(batchAsked(lacks, ['c', 'b', 'a', 'gone'], ['taken'])).toEqual(['a']);
    expect(batchAsked(lacks, ['c', 'b', 'a'], ['caption', 'alt'])).toEqual(['b', 'a']);
    expect(needsLine(0, 1)).toBe('It has one');
    expect(needsLine(0, 3)).toBe('All have one');
    expect(needsLine(1, 1)).toBe('It needs one');
    expect(needsLine(2, 3)).toBe('2 of 3 need one');
    expect(batchRunLabel(1)).toBe('Suggest for 1 picture');
    expect(batchRunLabel(0)).toBe('Suggest for 0 pictures');
  });

  it('saves only the drafts kept, trimmed, and leaves out a picture whose drafts were all emptied', () => {
    expect(
      batchChanges([
        { media: 'a', words: { caption: '  A field. ', alt: '' } },
        { media: 'b', words: { caption: '   ' } },
        { media: 'c', words: { taken: '2026-05-01', place: 'Kyoto, Japan' } },
      ]),
    ).toEqual([
      { id: 'a', words: { caption: 'A field.' } },
      { id: 'c', words: { place: 'Kyoto, Japan', taken: '2026-05-01' } },
    ]);
  });

  it('says why the writer can\u2019t be asked, what to do, and that dates still can come', () => {
    for (const why of ['no-writer', 'blind', 'private']) expect(batchOffLine(why)).toMatch(/Dates can still come from the files\.$/);
    expect(batchOffLine('unreadable')).toMatch(/videos get only their dates/);
    expect(batchOffLine(undefined)).toMatch(/AI screen/);
  });
});
