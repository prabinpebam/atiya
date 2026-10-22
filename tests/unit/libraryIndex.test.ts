/**
 * The library's index (documentation/gallery/spec.md §3.4, §4.2, §9.4, V55): an item found by its fingerprint or,
 * for a linked video, its provider and ID; and where an item is used (the albums it's in, the articles using it).
 */
import { describe, expect, it } from 'vitest';
import { findByFingerprint, findLinkedVideo, fingerprintOf, usesOf } from '../../src/site/editor/server/libraryIndex';
import type { ContentIndex } from '../../src/site/content/load';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const docs: Record<string, unknown> = {
  '/content/site.json': { name: 'N', fingerprint: A },
  '/content/media/library/beach.json': { kind: 'image', file: 'beach.webp', alt: 'A beach', fingerprint: A, visibility: 'public' },
  '/content/media/library/old.json': { kind: 'image', file: 'old.webp', alt: 'Before fingerprints', visibility: 'public' },
  '/content/media/library/cv.json': { kind: 'document', file: 'cv.pdf', title: 'CV', fingerprint: B },
  '/private/media/albums/family/clip.json': { kind: 'video', file: 'clip.mp4', title: 'A clip', fingerprint: B, visibility: 'public' },
  '/content/media/albums/trip/talk.json': { kind: 'embed', provider: 'youtube', id: 'dQw4w9WgXcQ', title: 'The talk', poster: { file: 'talk.poster.webp' }, visibility: 'public' },
};

describe("the library's index", () => {
  it('fingerprints a file as the SHA-256 of its bytes, in lowercase hex', () => {
    expect(fingerprintOf(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('finds the item made from the same file, public or private, and only a library sidecar', () => {
    expect(findByFingerprint(A, docs)).toEqual({ id: 'library/beach', kind: 'image', origin: 'public' });
    // the document has the same fingerprint as the private video, but isn't a library item
    expect(findByFingerprint(B, docs)).toEqual({ id: 'albums/family/clip', kind: 'video', origin: 'private' });
    expect(findByFingerprint('c'.repeat(64), docs)).toBeNull();
    expect(findByFingerprint('not a hash', docs)).toBeNull();
    expect(findByFingerprint('', { '/content/media/library/old.json': { kind: 'image', fingerprint: '' } })).toBeNull();
  });

  it('finds a linked video by its provider and ID', () => {
    expect(findLinkedVideo('youtube', 'dQw4w9WgXcQ', docs)).toEqual({ id: 'albums/trip/talk', kind: 'embed', origin: 'public', title: 'The talk' });
    expect(findLinkedVideo('vimeo', 'dQw4w9WgXcQ', docs)).toBeNull();
    expect(findLinkedVideo('youtube', 'other', docs)).toBeNull();
  });

  it("lists the albums an item is in and the articles that use it, in title order, with where each lives", () => {
    const album = (id: string, title: string, media: string[], status = 'published') => [id, { id, title, status, items: [...media.map((m) => ({ media: m })), { text: 'A card' }] }] as const;
    const article = (id: string, title: string, body: unknown[], over: Record<string, unknown> = {}) => [id, { id, type: 'article', kind: 'note', slug: id, title, summary: 'S', status: 'published', visibility: 'public', updatedAt: '2026-01-01', locale: 'en', body, ...over }] as const;
    const index = {
      albums: new Map([album('trip', 'Trip', ['library/beach', 'library/old']), album('family', 'Family', ['library/beach'], 'draft'), album('none', 'None', ['library/old'])]),
      articles: new Map([
        article('z', 'Zebra', [{ type: 'figure', media: 'library/beach' }]),
        article('h', 'Hero', [], { hero: { media: 'library/beach' } }),
        article('v', 'Video', [{ type: 'video', media: 'library/beach' }]),
        article('o', 'Other', [{ type: 'figure', media: 'library/old' }]),
      ]),
      origins: new Map([['family', 'private'], ['trip', 'public'], ['none', 'public'], ['z', 'public'], ['h', 'private'], ['v', 'public'], ['o', 'public']]),
    } as unknown as Pick<ContentIndex, 'albums' | 'articles' | 'origins'>;
    const uses = usesOf(index, 'library/beach');
    expect(uses.albums).toEqual([
      { id: 'family', title: 'Family', status: 'draft', origin: 'private' },
      { id: 'trip', title: 'Trip', status: 'published', origin: 'public' },
    ]);
    expect(uses.articles.map((a) => [a.id, a.origin])).toEqual([['h', 'private'], ['v', 'public'], ['z', 'public']]);
    expect(usesOf(index, 'library/nowhere')).toEqual({ albums: [], articles: [] });
  });
});
