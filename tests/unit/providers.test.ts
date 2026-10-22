import { describe, expect, it } from 'vitest';
import { isPortraitUrl, isProvider, isProviderId, oembedUrl, pageUrl, parseVideoUrl, playerUrl, PROVIDER_IDS, PROVIDERS, shareUrl, VIDEO_HOSTS } from '../../src/site/content/providers';
import { BASE } from '../../src/site/services/csp';

/** The video providers are one list (documentation/gallery/spec.md §4.2, D-G20). */
describe('video providers', () => {
  it('are YouTube and Vimeo, each with every address the site needs', () => {
    expect(PROVIDER_IDS).toEqual(['youtube', 'vimeo']);
    expect(Object.keys(PROVIDERS)).toEqual([...PROVIDER_IDS]);
    for (const p of PROVIDER_IDS) {
      expect(PROVIDERS[p].name).toBeTruthy();
      expect(PROVIDERS[p].patterns.length).toBeGreaterThan(0);
      expect(PROVIDERS[p].hosts.length).toBeGreaterThan(0);
    }
    expect(isProvider('youtube')).toBe(true);
    expect(isProvider('tiktok')).toBe(false);
    expect(isProvider(undefined)).toBe(false);
  });

  it.each([
    ['https://youtu.be/vIVX-KVUWAE', 'youtube', 'vIVX-KVUWAE'],
    ['https://www.youtube.com/watch?v=vIVX-KVUWAE&t=3', 'youtube', 'vIVX-KVUWAE'],
    ['youtube.com/watch?feature=share&v=vIVX-KVUWAE', 'youtube', 'vIVX-KVUWAE'],
    ['https://m.youtube.com/shorts/abc_DEF-123', 'youtube', 'abc_DEF-123'],
    ['https://www.youtube.com/embed/yiPUZtXp09Y', 'youtube', 'yiPUZtXp09Y'],
    ['https://www.youtube-nocookie.com/embed/yiPUZtXp09Y?autoplay=1', 'youtube', 'yiPUZtXp09Y'],
    ['  https://vimeo.com/12345  ', 'vimeo', '12345'],
    ['https://player.vimeo.com/video/680750485?dnt=1', 'vimeo', '680750485'],
    ['http://www.vimeo.com/294956094', 'vimeo', '294956094'],
  ])('recognise %s', (url, provider, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider, id });
    expect(isProviderId(provider as 'youtube', id)).toBe(true);
  });

  it.each(['https://example.com/video', 'https://youtu.be/abc', 'https://vimeo.com/channels/staff', 'https://www.youtube.com/@someone', ''])('know nothing of %j', (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });

  it('hold each ID to its shape', () => {
    expect(isProviderId('youtube', 'zUOy-NPaP6M')).toBe(true);
    expect(isProviderId('youtube', 'abc')).toBe(false);
    expect(isProviderId('youtube', 'a/b/c/d/e')).toBe(false);
    expect(isProviderId('vimeo', '1234686450')).toBe(true);
    expect(isProviderId('vimeo', 'abc123')).toBe(false);
  });

  it('build the players, pages and pasted links the site has always used', () => {
    expect(playerUrl('youtube', 'vIVX-KVUWAE', { autoplay: true })).toBe('https://www.youtube-nocookie.com/embed/vIVX-KVUWAE?autoplay=1');
    expect(playerUrl('vimeo', '12345', { autoplay: true })).toBe('https://player.vimeo.com/video/12345?autoplay=1&dnt=1');
    expect(playerUrl('youtube', 'vIVX-KVUWAE')).toBe('https://www.youtube-nocookie.com/embed/vIVX-KVUWAE');
    expect(playerUrl('vimeo', '12345')).toBe('https://player.vimeo.com/video/12345?dnt=1');
    expect(pageUrl('youtube', 'vIVX-KVUWAE')).toBe('https://www.youtube.com/watch?v=vIVX-KVUWAE');
    expect(pageUrl('vimeo', '12345')).toBe('https://vimeo.com/12345');
    expect(shareUrl('youtube', 'vIVX-KVUWAE')).toBe('https://youtu.be/vIVX-KVUWAE');
    expect(shareUrl('vimeo', '12345')).toBe('https://vimeo.com/12345');
    // a pasted link reads back as the same video
    for (const p of PROVIDER_IDS) {
      const id = p === 'youtube' ? 'vIVX-KVUWAE' : '12345';
      for (const url of [playerUrl(p, id), pageUrl(p, id), shareUrl(p, id)]) expect(parseVideoUrl(url)).toEqual({ provider: p, id });
    }
  });

  it('ask oEmbed for a big player', () => {
    expect(oembedUrl('youtube', 'https://www.youtube.com/watch?v=yiPUZtXp09Y')).toBe('https://www.youtube.com/oembed?format=json&maxwidth=1920&maxheight=1920&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DyiPUZtXp09Y');
    expect(oembedUrl('vimeo', 'https://vimeo.com/680750485')).toBe('https://vimeo.com/api/oembed.json?maxwidth=1920&url=https%3A%2F%2Fvimeo.com%2F680750485');
  });

  it('know a Short is portrait by its address', () => {
    expect(isPortraitUrl(' https://www.youtube.com/shorts/abc_DEF-123')).toBe(true);
    expect(isPortraitUrl('https://youtu.be/abc_DEF-123')).toBe(false);
    expect(isPortraitUrl('https://vimeo.com/12345')).toBe(false);
  });

  it('frame their players from exactly the hosts the policy allows', () => {
    expect(VIDEO_HOSTS).toEqual(['https://www.youtube-nocookie.com', 'https://player.vimeo.com']);
    expect(BASE['frame-src']).toEqual(["'self'", ...VIDEO_HOSTS]);
    for (const p of PROVIDER_IDS) {
      const origin = new URL(playerUrl(p, p === 'youtube' ? 'vIVX-KVUWAE' : '12345', { autoplay: true })).origin;
      expect(PROVIDERS[p].hosts).toContain(origin);
    }
  });
});
