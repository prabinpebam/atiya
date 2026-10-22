import { describe, expect, it } from 'vitest';
import {
  ALT_MAX,
  ALT_SYSTEM,
  altMessages,
  altOffer,
  altToSave,
  cleanAlt,
  cutTo,
  identifies,
  missedLine,
  picturesOf,
  picturesTestLine,
  seesPicture,
  suggestsAlt,
  wantsSuggestion,
} from '../../src/site/editor/model/altText';
import type { AiService, AiSettings } from '../../src/site/editor/server/aiSettings';

const answer = (alt: unknown) => JSON.stringify({ alt });
const service = (more: Partial<AiService> = {}): AiService => ({ id: 'w', kind: 'openai-compatible', provider: 'other', name: 'W', base: 'https://w.test/v1', model: 'm', local: false, privatePages: true, pictures: true, ...more });
const settings = (s: Partial<AiService> = {}, more: Partial<AiSettings> = {}): AiSettings => ({ version: 1, services: [service(s)], writer: 'w', decider: { kind: 'rules' }, agents: { propose: false }, ...more });

describe('suggested alt text: the answer (gallery spec §9.6)', () => {
  it('keeps a plain description, tidied', () => {
    expect(cleanAlt(answer('  A wooden bench   under a cherry tree. '))).toEqual({ alt: 'A wooden bench under a cherry tree.' });
    expect(cleanAlt(answer('"A red door."'))).toEqual({ alt: 'A red door.' });
  });

  it('never starts with "image of" or "picture of": the words are taken off and it starts with what it shows', () => {
    expect(cleanAlt(answer('Image of a red door in a stone wall.'))).toEqual({ alt: 'A red door in a stone wall.' });
    expect(cleanAlt(answer('picture of two cups of tea'))).toEqual({ alt: 'Two cups of tea' });
    expect(cleanAlt(answer('A photo showing a dog asleep on a rug.'))).toEqual({ alt: 'A dog asleep on a rug.' });
    expect(cleanAlt(answer('An image of a picture of a map.'))).toEqual({ alt: 'A map.' });
    expect(cleanAlt(answer('Image of'))).toEqual({ alt: null, why: 'empty' });
    for (const lead of ['image of', 'picture of', 'photo of']) expect((cleanAlt(answer(`${lead} a lake at dusk`)) as { alt: string }).alt).not.toMatch(/^(image|picture|photo) of/i);
  });

  it(`is at most ${ALT_MAX} characters, cut at a sentence or a word, never mid-word`, () => {
    const long = `${'A long row of terraced houses painted in soft colours. '.repeat(8)}`.trim();
    const r = cleanAlt(answer(long)) as { alt: string };
    expect(r.alt.length).toBeLessThanOrEqual(ALT_MAX);
    expect(r.alt.endsWith('.')).toBe(true);
    const words = 'word '.repeat(80).trim();
    const cut = cutTo(words);
    expect(cut.length).toBeLessThanOrEqual(ALT_MAX);
    expect(cut).toMatch(/word\.$/);
    expect(cutTo('short')).toBe('short');
    expect(cutTo('x'.repeat(400)).length).toBe(ALT_MAX);
  });

  it('refuses an answer that says who a person is, or what about them cannot be seen', () => {
    for (const text of [
      'A 35-year-old woman reading on a bench.',
      'A man aged about 60 holding a fishing rod.',
      'A woman in her thirties at a desk.',
      'An elderly man walking a dog.',
      'An Asian woman smiling at the camera.',
      'A man of Indian descent cooking.',
      'A man named John standing by a car.',
      'A portrait of the speaker, known as Jane Doe, at a lectern.',
    ]) {
      expect(identifies(text), text).toBe(true);
      expect(cleanAlt(answer(text))).toEqual({ alt: null, why: 'identifies' });
    }
    for (const text of ['A woman reading on a bench.', 'Two children building a sandcastle.', 'A black dog on a white sofa.', 'A sign that reads "Open".', 'A man in a blue coat walking a dog.']) expect(identifies(text), text).toBe(false);
  });

  it('refuses an empty answer, or one that is not the shape asked for', () => {
    expect(cleanAlt(answer(''))).toEqual({ alt: null, why: 'empty' });
    expect(cleanAlt(answer('  " "  '))).toEqual({ alt: null, why: 'empty' });
    expect(cleanAlt(answer(42))).toEqual({ alt: null, why: 'empty' });
    expect(cleanAlt('Sure! A red door.')).toEqual({ alt: null, why: 'empty' });
  });
});

describe('suggested alt text: what is sent and what is asked (§9.6)', () => {
  it('sends the rules and the picture alone: no file name, no words of the page', () => {
    const m = altMessages('data:image/jpeg;base64,AAAA');
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ role: 'system', content: ALT_SYSTEM });
    expect(m[1]).toEqual({ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }] });
  });

  it('asks for what is visible, short, never "image of", never who a person is, and text read out', () => {
    expect(ALT_SYSTEM).toContain(`${ALT_MAX} characters`);
    expect(ALT_SYSTEM).toMatch(/never start with "image of", "picture of"/i);
    expect(ALT_SYSTEM).toMatch(/never say who a person is/i);
    expect(ALT_SYSTEM).toMatch(/age, ethnicity/);
    expect(ALT_SYSTEM).toMatch(/text .* read it out/i);
  });
});

describe('suggested alt text: when it is offered', () => {
  it("is the writer's, when its model sees pictures and the switch is on", () => {
    expect(altOffer(settings(), false)).toMatchObject({ on: true, service: { id: 'w' } });
    expect(altOffer({ ...settings(), writer: null }, false)).toEqual({ on: false, why: 'no-writer' });
    expect(altOffer(settings({ pictures: false }), false)).toEqual({ on: false, why: 'blind' });
    expect(altOffer(settings({ pictures: undefined }), false)).toEqual({ on: false, why: 'blind' });
    expect(altOffer(settings({}, { alt: { suggest: false } }), false)).toEqual({ on: false, why: 'off' });
    expect(altOffer(settings({}, { alt: { suggest: true } }), false).on).toBe(true);
  });

  it("sends a private page's picture only to a service that may get private pages", () => {
    expect(altOffer(settings({ privatePages: false }), true)).toEqual({ on: false, why: 'private' });
    expect(altOffer(settings({ privatePages: false }), false).on).toBe(true);
    expect(altOffer(settings({ privatePages: true }), true).on).toBe(true);
  });

  it('is on by default, and the Pictures row says what the last Test found', () => {
    expect(suggestsAlt({})).toBe(true);
    expect(suggestsAlt({ alt: { suggest: false } })).toBe(false);
    expect(picturesOf(service())).toBe('yes');
    expect(picturesOf(service({ pictures: false }))).toBe('no');
    expect(picturesOf(service({ pictures: undefined }))).toBe('untested');
    expect(picturesOf(null)).toBe('untested');
    expect(picturesTestLine(undefined)).toBe('');
    expect(picturesTestLine(true)).toBe(' It can see pictures.');
    expect(picturesTestLine(false)).toBe(" It can't see pictures.");
  });

  it('never suggests for a picture with alt text, nor a decorative one', () => {
    expect(wantsSuggestion({ alt: '' })).toBe(true);
    expect(wantsSuggestion({ alt: '   ' })).toBe(true);
    expect(wantsSuggestion({ alt: 'A dog.' })).toBe(false);
    expect(wantsSuggestion({ alt: '', decorative: true })).toBe(false);
  });

  it('saves only what is in the field: an unaccepted suggestion is never saved and is not alt text', () => {
    expect(altToSave('', 'A red door.')).toBe('');
    expect(altToSave(' A red door. ', 'A red door.')).toBe('A red door.');
  });

  it('says how many pictures were not suggested', () => {
    expect(missedLine(0)).toBe('');
    expect(missedLine(1)).toMatch(/^1 picture wasn't suggested alt text/);
    expect(missedLine(3)).toMatch(/^3 pictures weren't suggested alt text/);
  });

  it('reads the Test of picture input: the colour was red', () => {
    expect(seesPicture('{"colour":"Red"}')).toBe(true);
    expect(seesPicture('{"colour":"crimson"}')).toBe(true);
    expect(seesPicture('{"colour":"blue"}')).toBe(false);
    expect(seesPicture('{"ok":true}')).toBe(false);
    expect(seesPicture('red')).toBe(false);
  });
});
