import { describe, expect, it } from 'vitest';
import { CAPTION_MAX } from '../../src/site/content/schema';
import { CAPTION_SUGGEST_MAX, CAPTION_SYSTEM, captionMessages, captionMissLine, captionOffer, cleanCaption } from '../../src/site/editor/model/captionText';
import { EMPTY_SETTINGS, type AiService, type AiSettings } from '../../src/site/editor/server/aiSettings';

const writer = (more: Partial<AiService> = {}): AiService => ({ id: 'eyes', kind: 'openai-compatible', provider: 'other', name: 'Eyes', base: 'https://eyes.test/v1', model: 'm', local: false, privatePages: true, pictures: true, ...more });
const settings = (s: Partial<AiService> = {}, more: Partial<AiSettings> = {}): AiSettings => ({ ...structuredClone(EMPTY_SETTINGS), services: [writer(s)], writer: 'eyes', ...more });

describe('suggested captions: the request (gallery spec §9.8.1)', () => {
  it('asks for a short line, never who someone is, never anything invented', () => {
    expect(CAPTION_SUGGEST_MAX).toBeLessThanOrEqual(CAPTION_MAX);
    expect(CAPTION_SYSTEM).toContain(`At most ${CAPTION_SUGGEST_MAX} characters`);
    expect(CAPTION_SYSTEM).toMatch(/Never say who a person is/);
    expect(CAPTION_SYSTEM).toMatch(/Never invent a place, a date, an event or a name/);
    expect(CAPTION_SYSTEM).toMatch(/"image of"/);
  });

  it('sends the rules and the picture alone: no name, no page words', () => {
    const m = captionMessages('data:image/jpeg;base64,AAAA');
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ role: 'system', content: CAPTION_SYSTEM });
    expect(m[1].content).toEqual([{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }]);
  });
});

describe('suggested captions: the answer', () => {
  it('is tidied: no "photo of", sentence case, no wrapping quotes', () => {
    expect(cleanCaption('{"caption":"photo of a kite over the beach"}')).toEqual({ caption: 'A kite over the beach' });
    expect(cleanCaption('{"caption":"  \\"Rain on the window.\\"  "}')).toEqual({ caption: 'Rain on the window.' });
  });

  it(`is cut to ${CAPTION_SUGGEST_MAX} characters at a whole word`, () => {
    const c = cleanCaption(JSON.stringify({ caption: 'word '.repeat(60) })).caption!;
    expect(c.length).toBeLessThanOrEqual(CAPTION_SUGGEST_MAX);
    expect(c.endsWith('word.')).toBe(true);
  });

  it('is refused when it is empty, not JSON, the wrong shape, or says who someone is', () => {
    expect(cleanCaption('{"caption":"  "}')).toEqual({ caption: null, why: 'empty' });
    expect(cleanCaption('A kite.')).toEqual({ caption: null, why: 'empty' });
    expect(cleanCaption('{"alt":"A kite."}')).toEqual({ caption: null, why: 'empty' });
    expect(cleanCaption('{"caption":"A woman in her thirties flying a kite"}')).toEqual({ caption: null, why: 'identifies' });
    expect(cleanCaption('{"caption":"A boy named Sam on the sand"}')).toEqual({ caption: null, why: 'identifies' });
  });
});

describe('suggested captions: when one is offered', () => {
  it('needs a writer whose model sees pictures, but not the alt text switch', () => {
    expect(captionOffer(settings(), false).on).toBe(true);
    expect(captionOffer(settings({}, { alt: { suggest: false } }), false).on).toBe(true);
    expect(captionOffer({ ...settings(), writer: null }, false)).toEqual({ on: false, why: 'no-writer' });
    expect(captionOffer(settings({ pictures: false }), false)).toEqual({ on: false, why: 'blind' });
    expect(captionOffer(settings({ pictures: undefined }), false)).toEqual({ on: false, why: 'blind' });
  });

  it("offers a private page's picture only to a writer that may get private pages", () => {
    expect(captionOffer(settings({ privatePages: false }), true)).toEqual({ on: false, why: 'private' });
    expect(captionOffer(settings({ privatePages: true }), true).on).toBe(true);
  });
});

describe('suggested captions: a miss says what happened and what to do (H9)', () => {
  it('names a remedy for each reason, and a fallback for the rest', () => {
    const lines = ['timeout', 'refused', 'unreadable', 'no-writer', 'blind', 'private', 'failed', undefined].map(captionMissLine);
    expect(new Set(lines).size).toBe(lines.length - 1);
    expect(captionMissLine(undefined)).toBe(captionMissLine('failed'));
    for (const l of lines) {
      expect(l).toMatch(/^[A-Z]/);
      expect(l).toMatch(/(Try again|yourself|AI screen)/);
      expect(l).not.toMatch(/Error|error|OK\b|click/);
    }
    expect(captionMissLine('blind')).toMatch(/AI screen/);
  });
});
