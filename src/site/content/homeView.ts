/**
 * What a home view shows (documentation/home-views/foundation.md §7): the curated picks turned into the
 * components' props, every address and picture resolved. The views' pages call it; the components never
 * read the home model (they're tiers below it), and the model never reads the site's addresses.
 */
import { canonicalPath, content, getAccess, getArticle, getHome, getHomeEvidence, getPerson, getPlanet, getRecommendations, getRoute, getRoutes, getSite, getStructure } from './repository';
import { footerLinks, siteNav } from './navigation';
import { picture } from './pictures';
import { withBase } from '../design/meta';
import { bentoSettings, bentoTiles } from '../home/bento';
import { coverIssue, coverSettings } from '../home/cover';
import { proofGrid, proofGridSettings } from '../home/proofGrid';
import { spotlightSettings, spotlightShow } from '../home/spotlight';
import { keywordsField, keywordsSettings } from '../home/keywords';
import { questionsOf, questionsSettings } from '../home/questions';
import { CATALOGUE } from '../home/catalogue';
import { KIND_LABEL, leadOf, strengthsInOrder, voicesOf, type PresentEnv, type Voice } from '../home/present';
import { VIEW_IDS, type ViewId } from '../home/ids';
import type { HomeRouting } from '../scripts/homeRoute';

type Home = NonNullable<ReturnType<typeof getHome>>;

/** The views that have a page of their own (`/views/<id>/`): every offered view that's built, the classic hub too. */
export function viewPaths(): ViewId[] {
  const home = getHome();
  return (home?.offered ?? []).filter((v) => CATALOGUE.views[v].built);
}

/** The role lens's pages (foundation.md §6): `/views/<id>/for/<lens>/` for each offered view but the classic hub, each lens. */
export function lensPaths(): { view: ViewId; lens: string }[] {
  const home = getHome();
  if (!home) return [];
  return viewPaths()
    .filter((v) => v !== 'classic')
    .flatMap((view) => home.lenses.map((l) => ({ view, lens: l.id })));
}

/** A view's address, for a lens or none. */
const viewHref = (view: ViewId, lens?: string) => withBase(`/views/${view}/${lens && view !== 'classic' ? `for/${lens}/` : ''}`);

/**
 * What the head's router needs on a home page (switcher.md §3): which view this page shows and where it is,
 * the site's default and offered views, its lenses and the one this page is ordered for. None without a
 * `home` key (the classic hub is all the site has). Every view has an address (one that isn't offered
 * answers with a short page), so a link may name any.
 */
export function homeRouting(view: ViewId, at: HomeRouting['at'], lens?: string): HomeRouting | undefined {
  const home = getHome();
  if (!home) return undefined;
  const lenses = home.lenses.map((l) => l.id);
  return { at, view, default: home.default, offered: viewPaths(), known: [...VIEW_IDS], lenses, ...(lens ? { lens } : {}), base: withBase('/').replace(/\/$/, '') };
}

/** The lens chip under a view's lead (foundation.md §6): what the page is ordered for, and the way back to the usual order. */
export function lensChip(view: ViewId, lens?: string) {
  const l = lens ? getHome()?.lenses.find((x) => x.id === lens) : undefined;
  return l ? { label: l.label, clear: `${viewHref(view)}?for=` } : undefined;
}

/** The views a site with a home page doesn't offer now (or that aren't built yet): each answers at its address with a short page. */
export function viewsNotOffered(): ViewId[] {
  if (!getHome()) return [];
  const pages = viewPaths();
  return VIEW_IDS.filter((v) => !pages.includes(v));
}

/** A view as Change view lists it. */
export interface ViewChoice {
  id: ViewId;
  label: string;
  line: string;
  href: string;
  current: boolean;
  isDefault: boolean;
}

/**
 * Change view's choices (switcher.md §1): a card per offered view (the default's links to `/`), Use the
 * default, the lenses (foundation.md §6: on a view that can show one), and the other ways to explore.
 * On a lens's page every card keeps the lens. Null when there's nothing to change to.
 */
export function viewSwitch(current: ViewId, lens?: string) {
  const home = getHome();
  const offered = viewPaths();
  if (!home || offered.length < 2) return null;
  const views: ViewChoice[] = offered.map((id) => ({
    id,
    label: CATALOGUE.views[id].label,
    line: CATALOGUE.views[id].line,
    href: lens && id !== 'classic' ? viewHref(id, lens) : withBase(id === home.default ? '/' : `/views/${id}/`),
    current: id === current,
    isDefault: id === home.default,
  }));
  const modes = getPlanet() ? [{ id: 'play', label: 'Little planet', line: 'A game, at /play/', href: withBase('/play/') }] : [];
  const lenses =
    current !== 'classic' && home.lenses.length > 0
      ? {
          heading: `Order ${CATALOGUE.goals[home.picks.goal].lenses.toLowerCase()}`,
          items: home.lenses.map((l) => ({
            id: l.id,
            label: l.label,
            line: `Starts with ${strengthsInOrder(getHome(l.id)!.picks, 'yours')[0]?.capability.name ?? 'your strengths'}`,
            href: viewHref(current, l.id),
            current: l.id === lens,
          })),
          clear: `${viewHref(current)}?for=`,
          usual: !lens,
        }
      : undefined;
  return { views, modes, defaultHref: withBase('/'), ...(lenses ? { lenses } : {}) };
}

/** Addresses and people as the home model asks for them. */
export function presentEnv(): PresentEnv {
  const site = getSite();
  const href = (id?: string) => {
    if (!id || getAccess(id) !== 'open') return undefined;
    const path = canonicalPath('article', id);
    return path ? withBase(path) : undefined;
  };
  const routes = getRoutes();
  const nodeHref = (node?: string) => {
    const r = node ? routes.find((x) => x.node.id === node && x.access === 'open') : undefined;
    return r ? withBase(r.path) : undefined;
  };
  const people = new Map((getRecommendations() ?? []).map((r) => [r.id, r]));
  return {
    pageHref: href,
    resumeHref: nodeHref(site.resumePage),
    contactHref: nodeHref(site.contactPage),
    person: (id) => {
      const r = people.get(id);
      return r ? { name: r.name, ...(r.title ? { title: r.title } : {}) } : undefined;
    },
  };
}

/** A media item as the cards take it: its sizes, its alt text and its dark mode version. */
async function cardPicture(id: string, slot: 'card' | 'content' = 'card') {
  const p = await picture(id, slot);
  const dark = p.dark ? { src: p.dark.src, srcset: p.dark.srcset, width: p.dark.width, height: p.dark.height, bg: p.dark.bg } : undefined;
  return { src: p.src, srcset: p.srcset, alt: p.alt, width: p.width, height: p.height, bg: p.bg, display: 'fit' as const, ...(dark ? { dark } : {}) };
}

/** The frame every home view shares: the page's title, the header's sections, the footer, and the sections index at the foot. */
export function homeFrame() {
  const site = getSite();
  const owner = getPerson(site.owner);
  const home = getRoute('/')!;
  const routes = getRoutes();
  const pages = (r: (typeof routes)[number]) => routes.filter((p) => p.parent === r.node && p.access === 'open').length;
  return {
    title: owner?.role ? `${site.name} — ${owner.role}` : site.name,
    description: site.description,
    nav: siteNav(getStructure(), routes, home),
    footer: footerLinks(site, routes),
    planet: getPlanet() ? withBase('/play/') : undefined,
    sections: routes
      .filter((r) => r.parent === home.node)
      .map((r) => ({
        href: withBase(r.path),
        title: r.title,
        kicker: pages(r) === 0 ? 'Being written' : undefined,
        summary: r.node.kind === 'hub' ? r.node.summary : undefined,
      })),
  };
}

/** Bento's props (documentation/home-views/bento.md): the lead, the tiles with their pictures, the voices; ordered for a lens when one is given. Null when there's no home. */
export async function bentoView(lens?: string) {
  const home = getHome(lens);
  if (!home) return null;
  const env = presentEnv();
  const settings = bentoSettings(home.settings.bento);
  const tiles = await Promise.all(
    bentoTiles(home.picks, settings, env).map(async ({ quote, picture: media, ...t }) => ({
      ...t,
      ...(quote ? { quote: { text: quote.quote, name: quote.name, ...(quote.title ? { title: quote.title } : {}) } } : {}),
      ...(media ? { picture: await cardPicture(media) } : {}),
    })),
  );
  const voices = settings.words === 'on' ? voicesOf(home.picks, env).map(voiceProps) : [];
  return { lead: homeLead(home, env), tiles, voices, density: settings.density };
}

/** A colleague's words as Voices and Cover take them. */
const voiceProps = (v: Voice) => ({ text: v.quote, name: v.name, ...(v.title ? { title: v.title } : {}) });

/** The lead every view opens with: the person, what they do, their two actions. */
function homeLead(home: Home, env: PresentEnv) {
  const site = getSite();
  const owner = getPerson(site.owner);
  return leadOf({
    name: owner?.name ?? site.name,
    role: owner?.role,
    positioning: site.positioning,
    showcase: content().showcase ?? {},
    goal: home.picks.goal,
    resumeHref: env.resumeHref,
    contactHref: env.contactHref,
  });
}

/** Cover's props (documentation/home-views/cover.md): the lead, In this issue, the cover story and picture, a feature per strength, a colleague's words; ordered for a lens when one is given. Null when there's no home. */
export async function coverView(lens?: string) {
  const home = getHome(lens);
  if (!home) return null;
  const env = presentEnv();
  const settings = coverSettings(home.settings.cover);
  const issue = coverIssue(home.picks, settings, env);
  const lines = await Promise.all(
    issue.lines.map(async ({ picture: media, details, ...l }) => ({
      ...l,
      details: details.map(({ key, title, kindLabel, href, ask }) => ({ key, title, ...(kindLabel ? { kindLabel } : {}), ...(href ? { href } : {}), ...(ask ? { ask } : {}) })),
      ...(media && settings.density === 'full' ? { picture: await cardPicture(media) } : {}),
    })),
  );
  const voices = voicesOf(home.picks, env).map(voiceProps);
  const story = issue.story && {
    href: issue.story.href,
    title: issue.story.title,
    capability: issue.lines.find((l) => l.id === issue.story!.capability)?.name ?? '',
    ...(getArticle(issue.story.id)?.summary ? { summary: getArticle(issue.story.id)!.summary } : {}),
  };
  const also = [
    ...(env.resumeHref ? [{ label: 'Résumé', href: env.resumeHref }] : []),
    ...(env.contactHref ? [{ label: 'Contact', href: env.contactHref }] : []),
  ];
  return {
    lead: homeLead(home, env),
    lines,
    ...(story ? { story } : {}),
    ...(issue.picture ? { picture: await cardPicture(issue.picture, 'content') } : {}),
    // the voice set large halfway is the first; the rest are In their words, at the foot
    ...(voices[0] ? { quote: voices[0] } : {}),
    voices: voices.slice(1),
    density: settings.density,
    also,
  };
}

/** Proof grid's props (documentation/home-views/proof-grid.md): the lead, the columns with their names, a row per strength, the colleagues' words; ordered for a lens when one is given. Null when there's no home. */
export function proofGridView(lens?: string) {
  const home = getHome(lens);
  if (!home) return null;
  const env = presentEnv();
  const settings = proofGridSettings(home.settings['proof-grid']);
  const grid = proofGrid(home.picks, settings, env);
  return {
    lead: homeLead(home, env),
    columns: grid.columns.map((kind) => ({ kind, label: KIND_LABEL[kind] })),
    rows: grid.rows.map(({ id, name, line, total, cells, groups }) => ({
      id,
      name,
      line,
      total,
      cells: cells.map(({ kind, count, state, label }) => ({ kind, count, state, label })),
      groups: groups.map(({ kind, heading, items }) => ({
        kind,
        heading,
        items: items.map(({ key, source, title, href, ask }) => ({ key, source, title, ...(href ? { href } : {}), ...(ask ? { ask } : {}) })),
      })),
    })),
    voices: voicesOf(home.picks, env).map(voiceProps),
    density: settings.density,
    empty: settings.empty,
  };
}

/** Spotlight's props (documentation/home-views/spotlight.md): the lead, Jump to, the highlights on the stage with their pictures and details, the voices; ordered for a lens when one is given. Null when there's no home. */
export async function spotlightView(lens?: string) {
  const home = getHome(lens);
  if (!home) return null;
  const env = presentEnv();
  const settings = spotlightSettings(home.settings.spotlight);
  const show = spotlightShow(home.picks, settings, env);
  const slides = await Promise.all(
    show.slides.map(async ({ picture: media, details, ...s }) => ({
      ...s,
      ...(getArticle(s.id)?.summary ? { summary: getArticle(s.id)!.summary } : {}),
      details: details.map(({ key, title, kindLabel, href, ask }) => ({ key, title, ...(kindLabel ? { kindLabel } : {}), ...(href ? { href } : {}), ...(ask ? { ask } : {}) })),
      ...(media ? { picture: await cardPicture(media, 'content') } : {}),
    })),
  );
  return {
    lead: homeLead(home, env),
    slides,
    jump: show.jump,
    voices: voicesOf(home.picks, env).map(voiceProps),
    motion: settings.motion,
  };
}

/** Keywords' props (documentation/home-views/keywords.md): the lead, a group of keywords per strength with what each matches, the proof they bring forward, the voices; ordered for a lens when one is given. Null when there's no home. */
export function keywordsView(lens?: string) {
  const home = getHome(lens);
  const evidence = getHomeEvidence();
  if (!home || !evidence) return null;
  const env = presentEnv();
  const settings = keywordsSettings(home.settings.keywords);
  const field = keywordsField(home.picks, evidence, content().topics?.topics ?? [], settings, env);
  return {
    lead: homeLead(home, env),
    groups: field.groups.map(({ total: _total, ...g }) => g),
    items: field.items.map(({ source: _source, ...x }) => x),
    voices: voicesOf(home.picks, env).map(voiceProps),
    motion: settings.motion,
    typing: settings.typing === 'on',
    contact: env.contactHref,
  };
}

/** Questions' props (documentation/home-views/questions.md): the lead, the person's answers in order (question 1 mapping every strength), whether Ask something else is shown, the contact page, the voices; ordered for a lens when one is given. Null when there's no home. */
export function questionsView(lens?: string) {
  const home = getHome(lens);
  const evidence = getHomeEvidence();
  if (!home || !evidence) return null;
  const env = presentEnv();
  const settings = questionsSettings(home.settings.questions);
  const gridHref = viewPaths().includes('proof-grid') ? withBase('/views/proof-grid/') : undefined;
  const model = questionsOf({ questions: content().showcase?.questions, picks: home.picks, evidence, topics: content().topics?.topics ?? [], settings, env, ...(gridHref ? { gridHref } : {}) });
  return {
    lead: homeLead(home, env),
    answers: model.answers,
    ask: model.ask,
    voices: voicesOf(home.picks, env).map(voiceProps),
    contact: env.contactHref,
  };
}
