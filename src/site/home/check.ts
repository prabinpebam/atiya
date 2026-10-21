/**
 * The home page's content check (documentation/home-views/foundation.md §2, curation.md §2, switcher.md §5): what
 * the spine's and the ways file's shapes can't hold. Every page it names is public and placed (saved picks
 * can wait for publication), every quote, fact and résumé line is found word for word in its source, and every ID it names
 * exists. The views' minimums aren't refused here: a site falls back from a view below its minimum (for-every-site
 * §5), and edit mode refuses to save one as the default. Pure.
 */
import type { ContentIndex, Issue } from '../content/load';
import { CATALOGUE } from './catalogue';
import { buildEvidence, fullText, normalise, pageOfNode } from './evidence';
import type { HomeWays } from './health';
import { VIEW_IDS, type ViewId } from './ids';
import { PROOF_KINDS, SHOWCASE_FILE, TOPICS_FILE, refId, type ProofItem, type Showcase } from './schema';

const SHOWCASE = `content/${SHOWCASE_FILE}`;
const TOPICS = `content/${TOPICS_FILE}`;
const WAYS = 'content/structures/ways.json';
const PUBLIC = new Set(['public', 'publicRedacted', 'summaryOnly']);
/** A quotation in an answer: “…” or "…". */
const QUOTE = /[“"]([^”"]{2,})[”"]/g;

type Index = Pick<ContentIndex, 'site' | 'articles' | 'origins' | 'routes' | 'recommendations' | 'media'> & { showcase: Showcase | null; topics: { topics: { id: string }[] } | null };

/** Why a page can't be named by the home page (empty when it's open), so the message says what to change. */
function whyNot(index: Index, id: string, published = true): string {
  const a = index.articles.get(id);
  if (!a) return `"${id}" isn't a page of the site`;
  if (index.origins.get(id) === 'private') return `"${id}" is a private page: the home page names open pages only (V25)`;
  if (a.visibility !== 'public') return `"${id}" isn't public`;
  const r = index.routes.find((x) => x.node.kind === 'item' && x.node.item.id === id);
  if (!r) return `"${id}" isn't placed on the site`;
  if (r.access !== 'open') return `"${id}" is a private page: the home page names open pages only (V25)`;
  if (published && !r.published) return `"${id}" isn't published`;
  return '';
}

/** The issues of the spine, the vocabulary and the ways file's home key. `skip`: pages already failing their own check. */
export function checkHome(index: Index, ways: { home?: HomeWays } | null, skip: ReadonlySet<string> = new Set()): Issue[] {
  const issues: Issue[] = [];
  const add = (file: string, message: string, path?: string) => issues.push({ file, message, ...(path ? { path } : {}) });
  const { showcase, topics } = index;
  const evidence = buildEvidence(index);

  const vocab = new Set<string>();
  topics?.topics.forEach((t, i) => {
    if (vocab.has(t.id)) add(TOPICS, `the topic "${t.id}" is listed twice`, `topics.${i}.id`);
    vocab.add(t.id);
  });

  if (showcase) {
    const add2 = (message: string, path?: string) => add(SHOWCASE, message, path);
    /** Saved picks can wait for publication; facts still need a published source. */
    const page = (ref: string, at: string, published = false) => {
      const id = refId(ref);
      if (skip.has(id)) return false;
      const why = whyNot(index, id, published);
      if (why) add2(why, at);
      return !why;
    };
    const recs = new Map(index.recommendations.map((r) => [r.id, r]));
    const rec = (id: string, at: string) => {
      const r = recs.get(id);
      if (!r) add2(`the recommendation "${id}" doesn't exist`, at);
      else if (r.hidden) add2(`the recommendation "${id}" is hidden: show it, or choose another`, at);
      return r && !r.hidden ? r : undefined;
    };
    const resumeId = pageOfNode(index, index.site.resumePage);
    const notProof = new Map([
      [resumeId, 'résumé'],
      [pageOfNode(index, index.site.contactPage), 'contact'],
      [pageOfNode(index, index.site.privacyPage), 'privacy'],
    ]);
    const resumeText = resumeId && !whyNot(index, resumeId) ? fullText(index.articles.get(resumeId)!) : undefined;
    const proof = (p: ProofItem, at: string) => {
      if (p.ref) {
        const id = refId(p.ref);
        const which = id ? notProof.get(id) : undefined;
        if (which) add2(`"${id}" is the ${which} page: pin a line from it instead`, `${at}.ref`);
        else page(p.ref, `${at}.ref`);
      } else if (p.resume !== undefined) {
        if (!index.site.resumePage) add2('a résumé line needs the site\'s résumé page (resumePage in site.json)', `${at}.resume`);
        else if (!resumeText) add2(`the résumé page "${index.site.resumePage}" isn't an open, published page`, `${at}.resume`);
        else if (!resumeText.includes(normalise(p.resume))) add2(`"${p.resume}" isn't on the résumé page word for word: copy it from there`, `${at}.resume`);
      } else if (p.recommendation) rec(p.recommendation, `${at}.recommendation`);
    };
    const unique = (list: { id?: string }[] | undefined, what: string, path: string) => {
      const seen = new Set<string>();
      list?.forEach((x, i) => {
        if (x.id === undefined) return;
        if (seen.has(x.id)) add2(`two ${what} have the ID "${x.id}"`, `${path}.${i}.id`);
        seen.add(x.id);
      });
      return seen;
    };
    const caps = unique(showcase.capabilities, 'strengths', 'capabilities');
    unique(showcase.highlights, 'highlights', 'highlights');
    const lenses = unique(showcase.lenses, 'lenses', 'lenses');
    unique(showcase.questions, 'questions', 'questions');
    const needCap = (id: string, at: string) => {
      if (!caps.has(id)) add2(`"${id}" isn't one of your strengths`, at);
    };
    const topic = (t: string, at: string) => {
      if (!vocab.has(t) && !evidence.topicsInUse.has(t)) add2(`"${t}" is neither in ${TOPICS} nor a topic of an open page`, at);
    };
    const section = (s: string, at: string) => {
      if (!evidence.sections.has(s)) add2(`"${s}" isn't a section of the site`, at);
    };
    const media = (id: string, at: string) => {
      const m = index.media.get(id);
      if (!m) add2(`media "${id}" doesn't exist`, at);
      else if (m.origin === 'private' || !PUBLIC.has(m.visibility)) add2(`media "${id}" isn't public: the home page shows public pictures only`, at);
    };
    const keyOf = (p: ProofItem) => (p.ref ? `page:${refId(p.ref)}` : p.resume !== undefined ? `resume:${normalise(p.resume)}` : `rec:${p.recommendation}`);

    showcase.capabilities.forEach((c, i) => {
      const at = `capabilities.${i}`;
      const pinned = new Set<string>();
      c.proof?.forEach((p, j) => {
        proof(p, `${at}.proof.${j}`);
        const k = keyOf(p);
        if (pinned.has(k)) add2(`${c.name} pins the same thing twice`, `${at}.proof.${j}`);
        pinned.add(k);
      });
      c.hide?.forEach((ref, j) => {
        if (!page(ref, `${at}.hide.${j}`)) return;
        if (pinned.has(`page:${refId(ref)}`)) add2(`${c.name} both pins and hides "${refId(ref)}": keep one`, `${at}.hide.${j}`);
      });
      if (c.voice) {
        const r = rec(c.voice.recommendation, `${at}.voice.recommendation`);
        if (r && !normalise(r.text).includes(normalise(c.voice.quote))) add2(`"${c.voice.quote}" isn't in ${r.name}'s recommendation word for word: copy it from there`, `${at}.voice.quote`);
      }
      if (c.media) media(c.media, `${at}.media`);
      c.match?.topics?.forEach((t, j) => topic(t, `${at}.match.topics.${j}`));
      c.match?.sections?.forEach((s, j) => section(s, `${at}.match.sections.${j}`));
      c.lens?.forEach((l, j) => {
        if (!lenses.has(l)) add2(`"${l}" isn't one of your lenses`, `${at}.lens.${j}`);
      });
    });

    showcase.facts?.forEach((f, i) => {
      if (!page(f.source, `facts.${i}.source`, true)) return;
      if (!fullText(index.articles.get(refId(f.source))!).includes(normalise(f.text))) add2(`"${f.text}" isn't on "${refId(f.source)}" word for word`, `facts.${i}.text`);
    });
    showcase.highlights?.forEach((h, i) => {
      page(h.ref, `highlights.${i}.ref`);
      needCap(h.capability, `highlights.${i}.capability`);
    });
    showcase.hideHighlights?.forEach((ref, i) => page(ref, `hideHighlights.${i}`));
    const leave = showcase.curation?.leaveOut;
    leave?.topics?.forEach((t, i) => topic(t, `curation.leaveOut.topics.${i}`));
    leave?.sections?.forEach((s, i) => section(s, `curation.leaveOut.sections.${i}`));
    if (showcase.held) {
      for (const [cap, refs] of Object.entries(showcase.held.proof)) {
        needCap(cap, `held.proof.${cap}`);
        refs.forEach((ref, j) => page(ref, `held.proof.${cap}.${j}`));
      }
      showcase.held.highlights.forEach((h, i) => {
        page(h.ref, `held.highlights.${i}.ref`);
        needCap(h.capability, `held.highlights.${i}.capability`);
      });
    }
    showcase.lenses?.forEach((l, i) => {
      const seen = new Set<string>();
      l.order?.forEach((id, j) => {
        needCap(id, `lenses.${i}.order.${j}`);
        if (seen.has(id)) add2(`the lens "${l.label}" lists "${id}" twice`, `lenses.${i}.order.${j}`);
        seen.add(id);
      });
      if (l.voice) rec(l.voice, `lenses.${i}.voice`);
    });
    // an answer's quotes are someone's words, or a page's: found word for word in a shown recommendation or an open page
    let said: string[] | undefined;
    const quoted = (q: string) => {
      said ??= [...index.recommendations.filter((r) => !r.hidden).map((r) => normalise(r.text)), ...[...evidence.open].map((id) => fullText(index.articles.get(id)!))];
      const n = normalise(q);
      return said.some((t) => t.includes(n));
    };
    showcase.questions?.forEach((q, i) => {
      q.capabilities.forEach((id, j) => needCap(id, `questions.${i}.capabilities.${j}`));
      q.proof?.forEach((p, j) => proof(p, `questions.${i}.proof.${j}`));
      for (const m of q.answer.matchAll(QUOTE)) {
        if (!quoted(m[1])) add2(`"${m[1]}" isn't in a recommendation or an open page word for word: copy it from there, or drop the quotation marks`, `questions.${i}.answer`);
      }
    });
    showcase.reel?.chapters.forEach((ch, i) => {
      needCap(ch.capability, `reel.chapters.${i}.capability`);
      if (ch.highlight) page(ch.highlight, `reel.chapters.${i}.highlight`);
    });
  }

  const home = ways?.home;
  if (home) {
    const offered = home.offered ?? (home.default ? [home.default] : []);
    if (home.default && !offered.includes(home.default)) add(WAYS, `the default view, ${CATALOGUE.views[home.default].label}, isn't one of the views offered`, 'home.default');
    const seen = new Set<string>();
    offered.forEach((v, i) => {
      if (seen.has(v)) add(WAYS, `${CATALOGUE.views[v].label} is offered twice`, `home.offered.${i}`);
      seen.add(v);
      if (!CATALOGUE.views[v].built) add(WAYS, `${CATALOGUE.views[v].label} isn't built in this engine yet: offer it once it is`, `home.offered.${i}`);
    });
    if (home.default && !CATALOGUE.views[home.default].built) add(WAYS, `${CATALOGUE.views[home.default].label} isn't built in this engine yet`, 'home.default');
    for (const [view, values] of Object.entries(home.settings ?? {}) as [ViewId, Record<string, unknown>][]) {
      if (!VIEW_IDS.includes(view)) continue;
      const specs = CATALOGUE.views[view].settings;
      for (const [key, value] of Object.entries(values ?? {})) {
        const at = `home.settings.${view}.${key}`;
        const spec = specs[key];
        if (!spec) {
          add(WAYS, `${CATALOGUE.views[view].label} has no setting "${key}"`, at);
          continue;
        }
        const wrong = (what: string) => add(WAYS, `${spec.label} is ${what}`, at);
        if (spec.type === 'choice') {
          if (typeof value !== 'string' || !spec.values?.includes(value)) wrong(`one of ${spec.values?.join(', ')}`);
        } else if (spec.type === 'number') {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < (spec.min ?? -Infinity) || value > (spec.max ?? Infinity)) wrong(`a whole number from ${spec.min} to ${spec.max}`);
        } else if (spec.type === 'picture') {
          const m = typeof value === 'string' ? index.media.get(value) : undefined;
          if (!m || m.origin === 'private' || !PUBLIC.has(m.visibility)) wrong('a public picture in content/media/');
        } else if (spec.type === 'highlight') {
          // a highlight's ID or its page; without a spine, the home page is the Classic hub and the setting waits
          if (showcase && (typeof value !== 'string' || !(showcase.highlights ?? []).some((h) => h.id === value || h.ref === value))) wrong('one of your highlights');
        } else if (spec.type === 'kinds') {
          const list = Array.isArray(value) ? value : [];
          const ok = Array.isArray(value) && list.every((k) => (PROOF_KINDS as readonly unknown[]).includes(k)) && new Set(list).size === list.length && list.length <= (spec.max ?? PROOF_KINDS.length);
          if (!ok) wrong(`a list of kinds of proof (${PROOF_KINDS.join(', ')}), each once`);
        }
      }
    }
  }
  return issues;
}
