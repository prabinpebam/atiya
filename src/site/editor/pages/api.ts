/**
 * Edit mode's API (documentation/editor/spec.md §8.5): JSON under /_edit/api/. Injected only by the dev
 * integration and guarded by its middleware (loopback, host, origin, header). A write answers
 * { ok, versions } or { ok: false, issues } with 409 (a conflict) or 422 (the contract's refusal).
 */
import type { APIRoute } from 'astro';
import type { Article, ImageMedia, SiteSettings, Person, PlanetStructure, SiteStructure, ThemeFile, VideoMedia } from '../../content/schema';
import { asTab, commit, jsonBytes, readDoc, type Result } from '../server/store';
import { articleKey, createArticle, deleteArticle, duplicateArticle, saveArticle, PLANET, STRUCTURE, planetKey } from '../server/articles';
import { cropMedia, cropSource, deleteMedia, parseUploadCrop, removeDark, replaceMaster, saveSidecar, setDark, upload, uploadVideo } from '../server/media';
import { isVideoFile } from '../model/upload';
import { measureVideo } from '../server/videoShape';
import { changes, discard, git, publish, push } from '../server/git';
import { changeAddress, createGrant, deleteGrant, extendGrant, moveSectionPages, rescopeGrant, setPageAccess, setSectionOrder, shareMessage, sharingView, updateGrant, withdrawGrant, type GrantEdit, type NewGrant, type PageAccess } from '../server/access';
import { content } from '../../content/repository';
import type { Ways } from '../../modes/contract';
import type { Recommendation, RecommendationSettings } from '../../content/recommendations';
import { saveWays, WAYS_KEY } from '../server/ways';
import { load } from '../server/screens';
import { picture } from '../../content/pictures';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const result = (r: Result & Record<string, unknown>) => json(r, r.ok ? 200 : r.status);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function body<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

/**
 * Test runs: the list, one run judged, one test's detail, and a live stream of either (server-sent events,
 * every half second): `tests/stream?run=<id|current>` for the Tests screen, `&brief=1` for the top bar.
 */
async function tests(parts: string[], url: URL, request: Request): Promise<Response> {
  const { briefOf, currentRun, listRuns, testDetail, viewOf } = await import('../server/testRuns');
  if (parts[1] === 'runs' && !parts[2]) return json({ ok: true, runs: listRuns().slice(0, 60).map((r) => briefOf(r)) });
  if (parts[1] === 'runs' && parts[2]) {
    const runs = listRuns();
    const run = runs.find((r) => r.id === parts[2]);
    if (!run) return json({ ok: false, issues: [{ file: '.test-runs', message: `no run ${parts[2]}` }] }, 404);
    if (parts[3] === 'tests' && parts[4]) {
      const t = testDetail(run, decodeURIComponent(parts[4]));
      return t ? json({ ok: true, test: t }) : json({ ok: false, issues: [{ file: run.id, message: 'no such test' }] }, 404);
    }
    return json({ ok: true, view: viewOf(run, runs) });
  }
  if (parts[1] === 'stream') {
    const want = url.searchParams.get('run') ?? 'current';
    const brief = url.searchParams.get('brief') === '1';
    const enc = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => timer && clearInterval(timer);
    request.signal.addEventListener('abort', stop);
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        const send = (event: string, data: unknown) => {
          try {
            ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            stop();
          }
        };
        const tick = () => {
          try {
            const now = Date.now();
            const runs = listRuns(process.cwd(), now);
            const run = want === 'current' ? currentRun(runs) : runs.find((r) => r.id === want);
            if (brief) send('brief', { asOf: now, run: run ? briefOf(run, now) : null, active: runs.filter((r) => r.active).length });
            else send('view', { asOf: now, runs: runs.slice(0, 60).map((r) => briefOf(r, now)), view: run ? viewOf(run, runs, now) : null });
          } catch (e) {
            send('problem', { message: e instanceof Error ? e.message : String(e) });
          }
        };
        tick();
        timer = setInterval(tick, brief ? 1000 : 500);
      },
      cancel: stop,
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' } });
  }
  return json({ ok: false, issues: [{ file: '', message: 'unknown tests request' }] }, 404);
}

/**
 * AI (documentation/editor/ai-editing.md, ai-services.md §9): the writer's line for the prompt, and a request
 * through the connector, answered as server-sent events (status, words, proposal, note, error). Closing the
 * request stops the writer.
 */
async function ai(parts: string[], method: string, request: Request): Promise<Response> {
  const { propose, writerLine } = await import('../server/aiConnector');
  if (method === 'GET' && parts[1] === 'status') return json({ ok: true, writer: writerLine() });
  // a section's or the article's proposal, kept until it's applied or discarded (ai-editing.md §8, §13)
  if (parts[1] === 'proposals') {
    const store = await import('../server/aiProposals');
    if (!parts[2]) return method === 'GET' ? json({ ok: true, proposals: store.listProposals() }) : json({ ok: false, issues: [{ file: '', message: 'unknown AI request' }] }, 404);
    const id = parts[2];
    if (!ID.test(id)) return json({ ok: false, issues: [{ file: '', message: 'not an article' }] }, 400);
    if (method === 'DELETE') {
      store.dropProposal(id);
      return json({ ok: true });
    }
    if (method === 'POST') {
      const { decisions } = await body<{ decisions: Record<string, 'accept' | 'reject' | null> }>(request);
      const valid = decisions && typeof decisions === 'object' && Object.values(decisions).every((d) => d === 'accept' || d === 'reject' || d === null);
      if (!valid) return json({ ok: false, issues: [{ file: '', message: 'not a decision' }] }, 400);
      const kept = store.decide(id, decisions);
      return kept ? json({ ok: true, proposal: kept }) : json({ ok: false, issues: [{ file: id, message: 'no proposal to review' }] }, 404);
    }
    const kept = store.readProposal(id);
    return kept ? json({ ok: true, proposal: kept }) : json({ ok: false, issues: [{ file: id, message: 'no proposal to review' }] }, 404);
  }
  // the AI screen: services, the writer, Test (ai-services.md §7, §8)
  const routed = await (await import('../server/aiServices')).aiServicesRoute(parts, method, request);
  if (routed) return routed;
  if (method !== 'POST' || parts[1] !== 'propose') return json({ ok: false, issues: [{ file: '', message: 'unknown AI request' }] }, 404);
  const req = await body<import('../server/aiConnector').ProposeRequest>(request);
  const scopes = ['block', 'section', 'article', 'empty', 'comments'];
  if (!ID.test(req?.id ?? '') || !Array.isArray(req.article?.body) || !scopes.includes(req.target?.scope) || typeof req.instruction !== 'string' || req.instruction.length > 4000)
    return json({ ok: false, issues: [{ file: '', message: 'not an AI request' }] }, 400);
  const enc = new TextEncoder();
  const stop = new AbortController();
  request.signal.addEventListener('abort', () => stop.abort());
  // a proposal wider than a block is kept, so the Review tab can be left and come back to
  const keep = req.target.scope === 'block' ? null : await import('../server/aiProposals');
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (e: import('../server/aiConnector').AiEvent) => {
        if (keep && e.type === 'proposal' && !stop.signal.aborted)
          keep.keepProposal({ id: req.id, by: e.proposal.service, target: req.target, instruction: req.instruction, madeFrom: null, base: { body: req.article.body, header: { title: req.article.title, summary: req.article.summary } }, proposal: e.proposal });
        try {
          ctrl.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          stop.abort();
        }
      };
      void propose(req, send, stop.signal).finally(() => {
        try {
          ctrl.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel: () => stop.abort(),
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' } });
}

const handle: APIRoute = async ({ request, params, url }) => {
  const path = (params.path ?? '').replace(/\/$/, '');
  const method = request.method.toUpperCase();
  const parts = path.split('/');
  try {
    // ---------- test runs, read only (documentation/editor/test-runs.md §7) ----------
    if (method === 'GET' && parts[0] === 'tests') return await tests(parts, url, request);

    // ---------- AI: the writer's line and a request through the connector ----------
    if (parts[0] === 'ai') return await ai(parts, method, request);

    // ---------- where the dev server's time went (documentation/engineering/performance.md §3) ----------
    if (method === 'GET' && path === 'perf') {
      const g = globalThis as { __siteRequests?: { at: number }[]; __sitePerfTotals?: Map<string, unknown> };
      const since = Number(url.searchParams.get('since') ?? 0);
      return json({ ok: true, now: Date.now(), requests: (g.__siteRequests ?? []).filter((r) => r.at >= since), totals: Object.fromEntries(g.__sitePerfTotals ?? []) });
    }

    // ---------- where the site's launcher leads ----------
    if (method === 'GET' && path === 'where') {
      const at = url.searchParams.get('path') ?? '/';
      const index = content();
      const route = index.routes.find((r) => r.path === at);
      if (route?.node.kind === 'item' && route.node.item.type === 'article') return json({ label: 'Edit this page', href: `/_edit/articles/${route.node.item.id}/` });
      if (route?.node.kind === 'hub' && route.path !== '/') return json({ label: 'Edit this section', href: '/_edit/sections/' });
      return json({ label: 'Edit mode', href: '/_edit/' });
    }

    // ---------- documents ----------
    if (method === 'GET' && path === 'doc') {
      const key = url.searchParams.get('key') ?? '';
      const doc = readDoc(key);
      return doc ? json(doc) : json({ ok: false }, 404);
    }

    // ---------- an embedded video's own shape, from its provider (model/videoShape.ts) ----------
    if (method === 'GET' && path === 'video-shape') {
      const r = await measureVideo(url.searchParams.get('url') ?? '');
      return r.ok ? json({ ok: true, ...r.shape }) : json({ ok: false, issues: [{ file: '', path: 'url', message: r.message }] }, 422);
    }

    // ---------- the action center (documentation/desktop/action-center.md §8.2, §8.3) ----------
    if (parts[0] === 'find') {
      const { findIndex, findThumb, setFindSetting } = await import('../server/find');
      if (method === 'GET' && parts.length === 1) {
        const loaded = load();
        return loaded.ok ? json(findIndex(loaded.index)) : json({ ok: false, issues: loaded.issues }, 422);
      }
      if (method === 'GET' && parts[1] === 'thumb') {
        const index = content();
        const thumb = await findThumb(index, url.searchParams.get('id') ?? '');
        return thumb ? json({ ok: true, thumb }) : json({ ok: false }, 404);
      }
      if (method === 'PUT' && parts[1] === 'settings' && parts[2]) {
        const b = await body<{ value: unknown; version: string | null }>(request);
        const r = await setFindSetting(decodeURIComponent(parts.slice(2).join('/')), b.value, b.version ?? null);
        return r ? json(r, r.ok ? 200 : r.status) : json({ ok: false, issues: [{ file: '', message: 'no such setting' }] }, 404);
      }
    }

    // ---------- articles ----------
    if (parts[0] === 'articles') {
      const id = parts[1];
      if (id && !ID.test(id)) return json({ ok: false }, 404);
      if (method === 'POST' && !id) return result(await createArticle(await body(request)));
      if (method === 'PUT' && id && parts.length === 2) {
        const b = await body<{ article: Article; section?: string | null; place?: string | null; ifMatch: Record<string, string | null> }>(request);
        return result(await saveArticle({ id, article: b.article, section: b.section, ifMatch: b.ifMatch ?? {} }));
      }
      if (method === 'POST' && id && parts[2] === 'duplicate') return result(await duplicateArticle(id));
      // its access (documentation/access/spec.md §8.2): open or private, and a private page's address
      if (method === 'PUT' && id && parts[2] === 'access') {
        const b = await body<{ access: PageAccess; section?: string }>(request);
        if (!['open', 'private'].includes(b.access)) return json({ ok: false, issues: [{ file: 'private/structures/overlay.json', message: 'open or private' }] }, 422);
        return result(await setPageAccess(id, b.access, b.section));
      }
      if (method === 'POST' && id && parts[2] === 'address') return result(await changeAddress(id));
      if (method === 'DELETE' && id) {
        const b = request.headers.get('content-type')?.includes('json') ? await body<{ ifMatch?: Record<string, string | null> }>(request) : {};
        return result(await deleteArticle(id, url.searchParams.get('media') === '1', b.ifMatch ?? {}));
      }
    }

    // ---------- access: grants, and a section's open and private pages moved and ordered (documentation/access/spec.md §8) ----------
    if (parts[0] === 'access') {
      if (method === 'POST' && parts[1] === 'grants' && !parts[2]) return result(await createGrant(await body<NewGrant>(request)));
      const gid = parts[2];
      if (parts[1] === 'grants' && gid && !/^g[a-z2-7]{8}$/.test(gid)) return json({ ok: false }, 404);
      // a grant's details, what it opens and its end date in one save; and a grant deleted (the Access screen)
      if (method === 'PUT' && parts[1] === 'grants' && gid && !parts[3]) return result(await updateGrant(gid, await body<GrantEdit>(request)));
      if (method === 'DELETE' && parts[1] === 'grants' && gid && !parts[3]) return result(await deleteGrant(gid));
      if (method === 'POST' && parts[1] === 'grants' && parts[3] === 'extend') return result(await extendGrant(gid, (await body<{ expires: string | null }>(request)).expires));
      if (method === 'POST' && parts[1] === 'grants' && parts[3] === 'scope') return result(await rescopeGrant(gid, (await body<{ scope: { sections?: string[]; pages?: string[] } }>(request)).scope));
      if (method === 'POST' && parts[1] === 'grants' && parts[3] === 'withdraw') return result(await withdrawGrant(gid));
      if (method === 'GET' && parts[1] === 'grants' && parts[3] === 'message') {
        const g = sharingView().grants.find((x) => x.id === gid);
        return g ? json({ ok: true, ...shareMessage(g) }) : json({ ok: false }, 404);
      }
      if (method === 'PUT' && parts[1] === 'sections' && parts[2] && ID.test(parts[2])) return result(await setSectionOrder(parts[2], (await body<{ order: string[] }>(request)).order));
      if (method === 'POST' && parts[1] === 'moves' && !parts[2]) {
        const b = await body<{ pages: string[]; to: string; index?: number }>(request);
        if (!Array.isArray(b.pages) || !b.pages.every((p) => ID.test(p)) || (b.to !== '_off' && !ID.test(b.to))) return json({ ok: false }, 422);
        return result(await moveSectionPages(b.pages, b.to, b.index));
      }
    }

    // ---------- the site structure, the settings, people ----------
    if (method === 'PUT' && path === 'structure') {
      const b = await body<{ structure: SiteStructure; ifMatch: Record<string, string | null> }>(request);
      const changes = [{ key: STRUCTURE, bytes: jsonBytes(b.structure) }];
      const ifMatch: Record<string, string | null> = { [STRUCTURE]: b.ifMatch?.[STRUCTURE] ?? null };
      // pages moved to another section follow it to its building, in the same transaction
      const was = readDoc<SiteStructure>(STRUCTURE);
      return result(await commit({ changes, ifMatch }));
    }
    // the planet structure: what each building holds (documentation/sections/spec.md §7.4); the loader checks V13 to V16
    if (method === 'PUT' && path === 'planet') {
      const b = await body<{ planet: PlanetStructure; ifMatch: Record<string, string | null> }>(request);
      // wherever the structure is now (the old place during the move, M1.1); the version the screen read it at
      const key = planetKey();
      const version = b.ifMatch?.[key] ?? Object.values(b.ifMatch ?? {})[0] ?? null;
      return result(await commit({ changes: [{ key, bytes: jsonBytes(b.planet) }], ifMatch: { [key]: version } }));
    }
    // which ways in are on (plan stage 8A), saved as the action center's switches save them (server/ways.ts)
    if (method === 'PUT' && path === 'ways') {
      const b = await body<{ ways: Ways; ifMatch: Record<string, string | null> }>(request);
      return result(await saveWays(b.ways, b.ifMatch?.[WAYS_KEY] ?? null));
    }
    // recommendations (documentation/sections/recommendations.md §4): the list, and a section's settings
    // a recommendation's photo: uploaded (multipart: id, file), or taken once from its LinkedIn profile (JSON: id)
    if (method === 'POST' && path === 'recommendations/photo') {
      const { setPhoto } = await import('../server/recommendations');
      if ((request.headers.get('content-type') ?? '').startsWith('multipart/')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File) || !file.size) return json({ ok: false, issues: [{ file: 'content/recommendations.json', path: 'photo', message: 'Choose a picture to upload.' }] }, 422);
        return result(await setPhoto(String(form.get('id') ?? ''), { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) }));
      }
      const b = await body<{ id: string }>(request);
      return result(await setPhoto(b.id ?? ''));
    }
    if (parts[0] === 'recommendations' && method === 'PUT') {
      const { saveRecommendations, saveSectionRecommendations, RECOMMENDATIONS_KEY } = await import('../server/recommendations');
      if (parts[1] === 'section') {
        const b = await body<{ section: string; settings: Partial<RecommendationSettings>; ifMatch?: Record<string, string | null> }>(request);
        return result(await saveSectionRecommendations(b.section, b.settings ?? {}, b.ifMatch?.[STRUCTURE] ?? null));
      }
      if (parts.length === 1) {
        const b = await body<{ items: Recommendation[]; ifMatch?: Record<string, string | null> }>(request);
        return result(await saveRecommendations(Array.isArray(b.items) ? b.items : [], b.ifMatch?.[RECOMMENDATIONS_KEY] ?? null));
      }
    }
    // themes (documentation/site-ui/theming.md §8): a person's own, never a preset
    if (parts[0] === 'themes') {
      const { applyTheme, deleteTheme, saveTheme, themeKey, SITE_KEY } = await import('../server/themes');
      if (method === 'PUT' && parts[1] === 'active') {
        const b = await body<{ id: string; ifMatch?: Record<string, string | null> }>(request);
        if (!ID.test(b.id ?? '')) return json({ ok: false, issues: [{ file: 'content/site.json', message: 'not a theme' }] }, 422);
        return result(await applyTheme(b.id, b.ifMatch?.[SITE_KEY] ?? null));
      }
      if (parts[1] && ID.test(parts[1])) {
        if (method === 'PUT') {
          const b = await body<{ theme: ThemeFile; ifMatch?: Record<string, string | null> }>(request);
          return result(await saveTheme({ ...b.theme, id: parts[1] }, b.ifMatch?.[themeKey(parts[1])] ?? null));
        }
        if (method === 'DELETE') {
          const b = await body<{ ifMatch?: Record<string, string | null> }>(request).catch(() => ({}) as { ifMatch?: Record<string, string | null> });
          return result(await deleteTheme(parts[1], b.ifMatch?.[themeKey(parts[1])] ?? readDoc(themeKey(parts[1]))?.version ?? null));
        }
      }
      if (method === 'POST' && parts[1] === 'fonts') {
        const { importFont } = await import('../server/fonts');
        const b = await body<{ url: string; category?: string }>(request);
        return result(await importFont(b.url, b.category));
      }
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
        if (!(file instanceof File)) return json({ ok: false, issues: [{ file: 'content/media', path: 'file', message: 'choose a picture or a video to upload' }] }, 422);
        // a video file (media.md §12): kept as it is, with the poster frame the browser took
        if (isVideoFile(file)) {
          const poster = form.get('poster');
          return result(
            await uploadVideo({
              file: { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
              owner: String(form.get('owner') ?? 'shared'),
              title: String(form.get('title') ?? ''),
              caption: String(form.get('caption') ?? ''),
              width: Number(form.get('width')),
              height: Number(form.get('height')),
              duration: Number(form.get('duration')) || undefined,
              ...(poster instanceof File && poster.size ? { poster: Buffer.from(await poster.arrayBuffer()) } : {}),
            }),
          );
        }
        const crop = parseUploadCrop(form.get('crop'));
        const r = await upload({
          file: { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
          owner: String(form.get('owner') ?? 'shared'),
          alt: String(form.get('alt') ?? ''),
          decorative: form.get('decorative') === 'on' || form.get('decorative') === 'true',
          caption: String(form.get('caption') ?? ''),
          ...(crop ? { crop } : {}),
        });
        return result(r);
      }
      // the crop: what it cuts from (the original of a copy), and the cut
      if (method === 'GET' && id.endsWith('/crop')) {
        const target = id.replace(/\/crop$/, '');
        const src = await cropSource(target);
        if (!src) return json({ ok: false, issues: [{ file: `content/media/${target}.json`, message: "doesn't exist" }] }, 404);
        const p = await picture(src.id, 'popout');
        return json({ ok: true, source: { id: src.id, src: p.src, srcset: p.srcset, width: src.width, height: src.height }, rect: src.rect, isCopy: src.isCopy });
      }
      if (method === 'POST' && id.endsWith('/crop')) {
        const b = await body<{ rect: { x: number; y: number; width: number; height: number }; copy?: boolean }>(request);
        return result(await cropMedia(id.replace(/\/crop$/, ''), b.rect, { copy: !!b.copy }));
      }
      if (method === 'POST' && id.endsWith('/replace')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return json({ ok: false, issues: [{ file: 'content/media', path: 'file', message: 'choose a picture' }] }, 422);
        return result(await replaceMaster(id.replace(/\/replace$/, ''), Buffer.from(await file.arrayBuffer())));
      }
      // a picture's dark mode version: added or replaced (multipart: file, and a crop chosen first), or removed
      if (method === 'POST' && id.endsWith('/dark')) {
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return json({ ok: false, issues: [{ file: 'content/media', path: 'file', message: 'choose the dark version' }] }, 422);
        const crop = parseUploadCrop(form.get('crop'));
        return result(await setDark(id.replace(/\/dark$/, ''), Buffer.from(await file.arrayBuffer()), crop ?? undefined));
      }
      if (method === 'DELETE' && id.endsWith('/dark')) return result(await removeDark(id.replace(/\/dark$/, '')));
      if (method === 'PUT' && id) {
        const b = await body<{ sidecar: ImageMedia | VideoMedia; ifMatch: Record<string, string | null> }>(request);
        return result(await saveSidecar(id, b.sidecar, b.ifMatch ?? {}));
      }
      if (method === 'DELETE' && id) return result(await deleteMedia(id));
    }

    // ---------- publishing ----------
    if (method === 'GET' && path === 'changes') return json({ ok: true, ...(await changes()) });
    if (method === 'POST' && path === 'discard') {
      const b = await body<{ keys?: string[] }>(request);
      return result(await discard(Array.isArray(b.keys) ? b.keys.map(String) : []));
    }
    if (method === 'POST' && path === 'publish') {
      const titles = {
        article: (id: string) => (readDoc<Article>(`/content/articles/${id}.json`) ?? readDoc<Article>(`/private/articles/${id}.json`))?.value.title,
        person: (id: string) => readDoc<Person>(`/content/people/${id}.json`)?.value.name,
      };
      const b = await body<{ message: string; publish?: string[]; keys?: string[] }>(request);
      // only the changes ticked (each resource's files), or every change when none are named
      const keys = Array.isArray(b.keys) ? b.keys.filter((k): k is string => typeof k === 'string' && /^\/(content|private)\/[a-z0-9/._-]+$/i.test(k) && !k.includes('..')) : undefined;
      // drafts chosen on the Publish screen go on the site with this publish: their Status becomes Published first
      const published: string[] = [];
      for (const pid of (Array.isArray(b.publish) ? b.publish : []).filter((x) => typeof x === 'string' && ID.test(x))) {
        const key = articleKey(pid);
        const doc = readDoc<Article>(key);
        if (!doc) return json({ ok: false, issues: [{ file: key.slice(1), message: "doesn't exist" }] }, 422);
        if (doc.value.status === 'published') continue;
        const r = await saveArticle({ id: pid, article: { ...doc.value, status: 'published' }, ifMatch: { [key]: doc.version } });
        if (!r.ok) return result(r);
        published.push(pid);
      }
      // a draft published now goes with the changes chosen
      if (keys) for (const pid of (Array.isArray(b.publish) ? b.publish : []).filter((x) => typeof x === 'string' && ID.test(x))) keys.push(articleKey(pid));
      const r = await publish(b.message ?? '', titles, { keys });
      // published back to what the remote already has: nothing new to send, and that's done
      if (!r.ok && published.length && (await changes({ fresh: true })).files.length === 0) return json({ ok: true, commit: (await git(['rev-parse', '--short', 'HEAD'])).stdout.trim(), pushed: true });
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

/** The editor tab a request says it's from, if it's one (an id the client made up: letters, digits and dashes). */
const tabOf = (request: Request) => {
  const tab = request.headers.get('X-Editor-Tab') ?? '';
  return /^[a-z0-9-]{8,64}$/i.test(tab) ? tab : null;
};

// every request runs as its tab: what it writes reaches every other open page as that tab's change
export const ALL: APIRoute = (ctx) => asTab(tabOf(ctx.request), () => handle(ctx));
