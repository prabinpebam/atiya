/**
 * The album editor's viewer and its words (documentation/gallery/spec.md §9.3, §9.5, §9.8): where an item sits,
 * the review of alt text, and the info panel's words into a sidecar as the content check will take them.
 */
import { describe, expect, it } from 'vitest';
import { imageMedia, videoMedia } from '../../src/site/content/schema';
import { batchProblem, nextToReview, reviewIds, sizeWords, viewerStep, withBatch, withWords, wordsProblem, type Words } from '../../src/site/editor/model/albumViewer';

const words = (w: Partial<Words> = {}): Words => ({ caption: '', description: '', alt: '', decorative: false, taken: '', place: '', title: '', credit: '', licenceName: '', licenceUrl: '', ...w });
const cells = [{ id: 'a' }, { id: 'b', needsAlt: true }, { id: 'c' }, { id: 'd', needsAlt: true }, { id: 'e', needsAlt: true }];

describe('the viewer: where an item sits (§9.5)', () => {
  it('counts it and names its neighbours, null at the ends', () => {
    expect(viewerStep(['a', 'b', 'c'], 'b')).toEqual({ at: 2, of: 3, prev: 'a', next: 'c' });
    expect(viewerStep(['a', 'b', 'c'], 'a')).toEqual({ at: 1, of: 3, prev: null, next: 'b' });
    expect(viewerStep(['a'], 'a')).toEqual({ at: 1, of: 1, prev: null, next: null });
    expect(viewerStep(['a'], 'z')).toBeNull();
  });

  it('a review goes through the pictures needing alt text, keeping the one open in its place', () => {
    expect(reviewIds(cells, 'b')).toEqual(['b', 'd', 'e']);
    expect(reviewIds(cells, 'c')).toEqual(['b', 'c', 'd', 'e']);
  });

  it('after one gets its words, goes on to the next, then back to the first before it, then ends', () => {
    expect(nextToReview(cells, 'b')).toBe('d');
    expect(nextToReview(cells, 'e')).toBe('b');
    expect(nextToReview([{ id: 'a' }, { id: 'b' }], 'b')).toBeNull();
  });
});

describe("the info panel's words (§4, §9.5)", () => {
  it('refuses what the content check would, in the editor\u2019s words', () => {
    expect(wordsProblem('image', words())).toBeNull();
    expect(wordsProblem('image', words({ alt: 'Image of a boat' }))).toMatch(/image of/);
    expect(wordsProblem('image', words({ alt: 'x'.repeat(251) }))).toMatch(/250/);
    expect(wordsProblem('image', words({ place: 'A\nB' }))).toMatch(/one line/);
    expect(wordsProblem('image', words({ taken: '3 May' }))).toMatch(/day/);
    expect(wordsProblem('video', words())).toMatch(/title/);
    expect(wordsProblem('embed', words({ title: 'A walk' }))).toBeNull();
    expect(wordsProblem('image', words({ licenceUrl: 'https://example.com' }))).toMatch(/licence/);
  });

  it('writes a picture\u2019s words into a copy of its sidecar, keeping the rest, an empty word taking its field out', () => {
    const sidecar = { kind: 'image' as const, file: 'a.webp', alt: 'Old', caption: 'Old caption', focus: '40% 60%', visibility: 'public' as const };
    const next = withWords(sidecar, 'image', words({ caption: ' A boat ', alt: 'A red boat at the quay.', place: 'Kochi', taken: '2026-05-03' }));
    expect(next).toEqual({ kind: 'image', file: 'a.webp', alt: 'A red boat at the quay.', caption: 'A boat', focus: '40% 60%', visibility: 'public', place: 'Kochi', taken: '2026-05-03' });
    expect(imageMedia.safeParse(next).success).toBe(true);
    const plain = withWords(next, 'image', words({ decorative: true }));
    expect(plain).toEqual({ kind: 'image', file: 'a.webp', focus: '40% 60%', visibility: 'public', decorative: true });
    expect(sidecar.caption).toBe('Old caption');
  });

  it('sends a video\u2019s cleared words empty (its save keeps what isn\u2019t sent), with its title and never alt text', () => {
    const sidecar = { kind: 'video' as const, file: 'v.mp4', title: 'Old', width: 960, height: 540, place: 'Goa', visibility: 'public' as const };
    const next = withWords(sidecar, 'video', words({ title: 'The tide', alt: 'ignored' }));
    expect(next).toMatchObject({ title: 'The tide', place: '', description: '', taken: '' });
    expect('alt' in next).toBe(false);
    expect(videoMedia.safeParse({ ...next, place: undefined, description: undefined, taken: undefined }).success).toBe(true);
  });

  it('keeps a licence\u2019s other fields, and takes it out with its name', () => {
    const sidecar = { kind: 'image' as const, file: 'a.webp', alt: 'A', licence: { name: 'CC BY', url: 'https://x.example', attribution: 'Ada' } };
    expect(withWords(sidecar, 'image', words({ alt: 'A', licenceName: 'CC BY 4.0' })).licence).toEqual({ name: 'CC BY 4.0', attribution: 'Ada' });
    expect('licence' in withWords(sidecar, 'image', words({ alt: 'A' }))).toBe(false);
  });
});

describe('several items at once (§9.3 Set the date, Set the place; §9.5 Accept all)', () => {
  it('refuses an empty or a bad change', () => {
    expect(batchProblem([])).toMatch(/Choose/);
    expect(batchProblem([{ id: 'a', words: { taken: 'May' } }])).toMatch(/day/);
    expect(batchProblem([{ id: 'a', words: { place: 'x'.repeat(500) } }])).toMatch(/one line/);
    expect(batchProblem([{ id: 'a', words: { alt: 'Photo of a cat' } }])).toMatch(/image of/);
    expect(batchProblem([{ id: 'a', words: { taken: '', place: 'Goa' } }])).toBeNull();
  });

  it('sets or clears only the fields given; alt text never on a video, and it ends decorative', () => {
    const pic = { kind: 'image' as const, file: 'a.webp', decorative: true as const, place: 'Goa', taken: '2026-05-01' };
    expect(withBatch(pic, { taken: '', alt: 'A boat.' })).toEqual({ kind: 'image', file: 'a.webp', place: 'Goa', alt: 'A boat.' });
    const vid = { kind: 'video' as const, file: 'v.mp4', title: 'V' };
    expect(withBatch(vid, { alt: 'A', place: 'Kochi' })).toEqual({ kind: 'video', file: 'v.mp4', title: 'V', place: 'Kochi' });
  });

  it('says a file\u2019s size in words', () => {
    expect(sizeWords(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(sizeWords(640 * 1024)).toBe('640 KB');
    expect(sizeWords(10)).toBe('1 KB');
  });
});
