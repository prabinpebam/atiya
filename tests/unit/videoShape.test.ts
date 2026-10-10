/**
 * An embedded video's own shape (src/site/editor/model/videoShape.ts, server/videoShape.ts): where its
 * provider is asked, what its answer means, a Short taken as portrait, and a provider that can't say.
 */
import { describe, expect, it } from 'vitest';
import { isShorts, oembedUrl, shapeLabel, shapeOf, SHORTS_SHAPE } from '../../src/site/editor/model/videoShape';
import { measureVideo } from '../../src/site/editor/server/videoShape';
import { block } from '../../src/site/content/schema';

const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("an embedded video's shape", () => {
  it('asks each provider for a big player, so the shape is not rounded off', () => {
    expect(oembedUrl({ provider: 'youtube', id: 'yiPUZtXp09Y' })).toBe('https://www.youtube.com/oembed?format=json&maxwidth=1920&maxheight=1920&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DyiPUZtXp09Y');
    expect(oembedUrl({ provider: 'vimeo', id: '680750485' })).toBe('https://vimeo.com/api/oembed.json?maxwidth=1920&url=https%3A%2F%2Fvimeo.com%2F680750485');
  });

  it('reads the width and height of an answer, and nothing else', () => {
    expect(shapeOf({ width: 1920, height: 720 })).toEqual({ width: 1920, height: 720 });
    expect(shapeOf({ width: '1920', height: 1080.4 })).toEqual({ width: 1920, height: 1080 });
    for (const bad of [null, {}, { width: 0, height: 10 }, { width: 10 }, { width: 'wide', height: 10 }]) expect(shapeOf(bad)).toBeNull();
    expect(shapeLabel({ width: 1920, height: 720 })).toBe('1920 × 720');
  });

  it('takes a YouTube Short as portrait from its address (YouTube answers 16:9 for it)', async () => {
    expect(isShorts('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toBe(true);
    expect(isShorts('https://youtu.be/aqz-KE-bpKQ')).toBe(false);
    const never = (async () => {
      throw new Error('not asked');
    }) as unknown as typeof fetch;
    expect(await measureVideo('https://www.youtube.com/shorts/aqz-KE-bpKQ', never)).toEqual({ ok: true, shape: SHORTS_SHAPE });
  });

  it("measures from the provider's answer, and says why when it can't", async () => {
    expect(await measureVideo('https://vimeo.com/680750485', answer({ width: 1920, height: 720 }))).toEqual({ ok: true, shape: { width: 1920, height: 720 } });
    expect(await measureVideo('https://youtu.be/yiPUZtXp09Y', answer({}, 404))).toMatchObject({ ok: false, message: expect.stringMatching(/YouTube didn't say its shape \(404\): it's shown 16:9/) });
    expect(await measureVideo('https://youtu.be/yiPUZtXp09Y', answer({ title: 'no size' }))).toMatchObject({ ok: false });
    const offline = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await measureVideo('https://vimeo.com/680750485', offline)).toMatchObject({ ok: false, message: expect.stringMatching(/Vimeo couldn't be reached/) });
    expect(await measureVideo('https://example.com/video', offline)).toMatchObject({ ok: false, message: expect.stringMatching(/YouTube or Vimeo link/) });
  });

  it("the content keeps an embed's shape only whole: both its width and its height", () => {
    const video = (embed: Record<string, unknown>) => block.safeParse({ type: 'video', embed: { provider: 'vimeo', id: '680750485', ...embed }, title: 'Loop', poster: 'shared/poster' }).success;
    expect(video({})).toBe(true);
    expect(video({ width: 1920, height: 720 })).toBe(true);
    expect(video({ width: 1920 })).toBe(false);
    expect(video({ width: 0, height: 720 })).toBe(false);
  });
});
