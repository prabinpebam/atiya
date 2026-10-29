import { describe, expect, it } from 'vitest';
import { embedLink, mediaLinkIds, pictureLink, refResolver, videoLink } from '../../src/site/content/mediaLinks';
import { renderMarkdown } from '../../src/site/content/markdown';

describe('links to the library (media.md §11.1)', () => {
  it('finds each linked item once, in order, and nothing else', () => {
    const text = 'See [a](ref:media/articles/a/pic), [b](ref:article/b), [c](ref:media/x/cv) and [a again](ref:media/articles/a/pic).';
    expect(mediaLinkIds(text)).toEqual(['articles/a/pic', 'x/cv']);
    expect(mediaLinkIds(JSON.stringify([{ markdown: text }]))).toEqual(['articles/a/pic', 'x/cv']);
  });

  it('a picture goes to its largest size and carries its lightbox data, its dark version too', () => {
    const t = pictureLink('a/pic', { src: '/m/s.webp', full: '/m/f.webp', thumb: '/m/t.webp', alt: 'A dog', caption: 'Chopper', dark: { src: '/m/sd.webp', full: '/m/fd.webp' } });
    expect(t).toEqual({ href: '/m/f.webp', data: { lightbox: 'link:a/pic', thumb: '/m/t.webp', alt: 'A dog', caption: 'Chopper', fullDark: '/m/fd.webp', thumbDark: '/m/sd.webp' } });
    expect(pictureLink('p', { src: '/s', full: '/f', alt: '', largest: { src: '/l' } }).href).toBe('/l');
  });

  it("a video file goes to its file; a linked video to its page, played in the lightbox's player", () => {
    expect(videoLink('v', { src: '/v.mp4', type: 'video/mp4', title: 'Walk', duration: 12, poster: { src: '/p.webp', thumb: '/pt.webp' } })).toEqual({
      href: '/v.mp4',
      data: { lightbox: 'link:v', kind: 'video', alt: 'Walk', videoType: 'video/mp4', poster: '/p.webp', thumb: '/pt.webp', duration: '12' },
    });
    expect(embedLink('e', { page: 'https://youtu.be/x', player: 'https://www.youtube-nocookie.com/embed/x', title: 'Talk', poster: { src: '/p.webp' } })).toMatchObject({
      href: 'https://youtu.be/x',
      data: { kind: 'embed', embedSrc: 'https://www.youtube-nocookie.com/embed/x', poster: '/p.webp' },
    });
  });

  it('renders a library link with its data, and still resolves pages', () => {
    const links = new Map([['a/pic', pictureLink('a/pic', { src: '/s.webp', full: '/f.webp', alt: 'A "dog" & cat' })]]);
    const resolveRef = refResolver(links, (type, id) => (type === 'article' ? `/notes/${id}/` : undefined));
    const html = renderMarkdown('[The dog](ref:media/a/pic) and [a note](ref:article/b).', { resolveRef });
    expect(html).toContain('<a href="/f.webp" data-lightbox="link:a/pic" data-thumb="/s.webp" data-alt="A &quot;dog&quot; &amp; cat">The dog</a>');
    expect(html).toContain('<a href="/notes/b/">a note</a>');
    expect(html).not.toContain('data-caption');
    expect(() => renderMarkdown('[gone](ref:media/a/gone)', { resolveRef })).toThrow(/unknown link target/);
  });
});
