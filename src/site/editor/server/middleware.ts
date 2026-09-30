/**
 * Guards every editor route (documentation/editor/spec.md §8.2). Injected by integrations/editor.mjs in
 * dev only, so it never runs in a build; for any other path it does nothing.
 */
import { defineMiddleware } from 'astro:middleware';
import { FRAME_HEADERS, guard } from '../model/guard';

const PREFIX = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/_edit`;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return next();
  let clientAddress: string | undefined;
  try {
    clientAddress = context.clientAddress;
  } catch {
    clientAddress = undefined;
  }
  const verdict = guard({ method: context.request.method, url: context.url, clientAddress, header: (n) => context.request.headers.get(n) });
  if (!verdict.ok) return new Response('Forbidden', { status: 403, headers: FRAME_HEADERS });
  const response = await next();
  for (const [name, value] of Object.entries(FRAME_HEADERS)) response.headers.set(name, value);
  return response;
});
