/**
 * Edit mode's API (documentation/editor/spec.md §8.5): JSON under /_edit/api/. Injected only by the dev
 * integration and guarded by its middleware (loopback, host, origin, header). A write answers
 * { ok, versions } or { ok: false, issues } with 409 (a conflict) or 422 (the contract's refusal).
 */
import type { APIRoute } from 'astro';
import type { Article, ImageMedia, SiteSettings, Person, SiteStructure } from '../../content/schema';
import { commit, jsonBytes, readDoc, type Result } from '../server/store';
import { createArticle, deleteArticle, duplicateArticle, saveArticle, STRUCTURE } from '../server/articles';
import { deleteMedia, replaceMaster, saveSidecar, upload } from '../server/media';
import { changes, discard, publish, push } from '../server/git';
import { content } from '../../content/repository';
import { picture } from '../../content/pictures';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const result = (r: Result & Record<string, unknown>) => json(r, r.ok ? 200 : r.status);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function body<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export const ALL: APIRoute = async ({ request, params, url }) => {
  const path = (params.path ?? '').replace(/\/$/, '');
  const method = request.method.toUpperCase();
  const parts = path.split('/');
  try {
    // ---------- where the site's launcher leads ----------
    if (method === 'GET' && path === 'where') {
      const at = url.searchParams.get('path') ?? '/';
      const index = content();
      const route = index.routes.find((r) => r.path === at);
      if (route?.node.kind === 'item' && route.node.item.type === 'article') return json({ label: 'Edit this page', href: `/_edit/articles/${route.node.item.id}/` });
      if (route?.node.kind === 'hub' && route.node.template !== 'home') return json({ label: 'Edit this section', href: '/_edit/sections/' });
      return json({ label: 'Edit mode', href: '/_edit/' });
    }

    // ---------- documents ----------
    if (method === 'GET' && path === 'doc') {
      const key = url.searchParams.get('key') ?? '';
      const doc = readDoc(key);
      return doc ? json(doc) : json({ ok: false }, 404);
    }

    // ---------- articles ----------
    if (parts[0] === 'articles') {
      const id = parts[1];
      if (id && !ID.test(id)) return json({ ok: false }, 404);
      if (method === 'POST' && !id) return result(await createArticle(await body(request)));
      if (method === 'PUT' && id && parts.length === 2) {
        const b = await body<{ article: Article; section?: string | null; ifMatch: Record<string, string | null> }>(request);
        return result(await saveArticle({ id, article: b.article, section: b.section, ifMatch: b.ifMatch ?? {} }));
      }
      if (method === 'POST' && id && parts[2] === 'duplicate') return result(await duplicateArticle(id));
      if (method === 'DELETE' && id) {
        const b = request.headers.get('content-type')?.includes('json') ? await body<{ ifMatch?: Record<string, string | null> }>(request) : {};
        return result(await deleteArticle(id, url.searchParams.get('media') === '1', b.ifMatch ?? {}));
      }
    }

    // ---------- the site structure, the settings, people ----------
    if (method === 'PUT' && path === 'structure') {
      const b = await body<{ structure: SiteStructure; ifMatch: Record<string, string | null> }>(request);
      return result(await commit({ changes: [{ key: STRUCTURE, bytes: jsonBytes(b.structure) }], ifMatch: { [STRUCTURE]: b.ifMatch?.[STRUCTURE] ?? null } }));
    }
    if (method === 'PUT' && path === 'site') {
      const b = await body<{ site: SiteSettings; ifMatch: Record<string, string | null> }>(request);
      const key = '/content/site.json';
      return result(await commit({ changes: [{ key, bytes: jsonBytes(b.site) }], ifMatch: { [key]: b.ifMatch?.[key] ?? null } }));
    }
    if (method === 'PUT' && parts[0] === 'people' && parts[1] && ID.test(parts[1])) {
      const b = await body<{ person: Person; ifMatch: Record<string, string | null> }>(request);
      const key = `/content/people/${parts[1]}.json`;
      return result(await commit({ changes: [{ key, bytes: jsonBytes({ ...b.person, id: parts[1] }) }], ifMatch: { [key]: b.ifMatch?.[key] ?? null } }));
    }

    // ---------- media ----------
    if (parts[0] === 'media') {
      const id = parts.slice(1).join('/');
      if (method === 'GET' && !id) {
        const index = content();
        const list = await Promise.all(
          [...index.media.values()].map(async (m) => {
            const p = await picture(m.id, 'card');
            return { id: m.id, alt: m.alt ?? '', decorative: !!m.decorative, caption: m.caption ?? '', thumb: p.thumb, src: p.src, width: p.width, height: p.height };
          }),
        );
        return json({ ok: true, media: list });
      }
      if (method === 'POST' && !id) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return json({ ok: false, issues: [{ file: 'content/media', path: 'file', message: 'choose a picture to upload' }] }, 422);
        const r = await upload({
          file: { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
          owner: String(form.get('owner') ?? 'shared'),
          alt: String(form.get('alt') ?? ''),
          decorative: form.get('decorative') === 'on' || form.get('decorative') === 'true',
          caption: String(form.get('caption') ?? ''),
        });
        return result(r);
      }
      if (method === 'POST' && id.endsWith('/replace')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return json({ ok: false, issues: [{ file: 'content/media', path: 'file', message: 'choose a picture' }] }, 422);
        return result(await replaceMaster(id.replace(/\/replace$/, ''), Buffer.from(await file.arrayBuffer())));
      }
      if (method === 'PUT' && id) {
        const b = await body<{ sidecar: ImageMedia; ifMatch: Record<string, string | null> }>(request);
        return result(await saveSidecar(id, b.sidecar, b.ifMatch ?? {}));
      }
      if (method === 'DELETE' && id) return result(await deleteMedia(id));
    }

    // ---------- publishing ----------
    if (method === 'GET' && path === 'changes') return json({ ok: true, ...(await changes()) });
    if (method === 'POST' && path === 'discard') return result(await discard((await body<{ key: string }>(request)).key));
    if (method === 'POST' && path === 'publish') {
      const r = await publish((await body<{ message: string }>(request)).message ?? '');
      return json(r, r.ok ? 200 : 422);
    }
    if (method === 'POST' && path === 'push') {
      const r = await push();
      return json(r, r.ok ? 200 : 422);
    }

    return json({ ok: false, issues: [{ file: '', message: `no such editor call: ${method} ${path}` }] }, 404);
  } catch (e) {
    return json({ ok: false, issues: [{ file: '', message: (e as Error).message }] }, 500);
  }
};
