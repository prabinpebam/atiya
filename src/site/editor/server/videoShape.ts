/**
 * Asks a video's provider for its shape (oEmbed), for the article editor (model/videoShape.ts holds the
 * rules). Dev only, like every editor route. A Short is portrait by its address; a provider that can't be
 * reached, or doesn't know the video, leaves the shape unknown (the player is then 16:9).
 */
import { parseVideo } from '../model/ops';
import { isShorts, oembedUrl, shapeOf, SHORTS_SHAPE, type Shape } from '../model/videoShape';

export async function measureVideo(url: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; shape: Shape } | { ok: false; message: string }> {
  const embed = parseVideo(url);
  if (!embed) return { ok: false, message: 'Use a YouTube or Vimeo link (https://youtu.be/…, https://vimeo.com/…).' };
  if (isShorts(url)) return { ok: true, shape: SHORTS_SHAPE };
  try {
    const res = await fetchImpl(oembedUrl(embed), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, message: `${embed.provider === 'youtube' ? 'YouTube' : 'Vimeo'} didn't say its shape (${res.status}): it's shown 16:9` };
    const shape = shapeOf(await res.json());
    return shape ? { ok: true, shape } : { ok: false, message: "its shape couldn't be read: it's shown 16:9" };
  } catch {
    return { ok: false, message: `${embed.provider === 'youtube' ? 'YouTube' : 'Vimeo'} couldn't be reached to read its shape: it's shown 16:9` };
  }
}
