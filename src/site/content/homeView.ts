/**
 * What a home view shows (documentation/home-views/foundation.md §7): the curated picks turned into the
 * components' props, every address and picture resolved. The views' pages call it; the components never
 * read the home model (they're tiers below it), and the model never reads the site's addresses.
 */
import { canonicalPath, content, getAccess, getArticle, getHome, getPerson, getPlanet, getRecommendations, getRoute, getRoutes, getSite, getStructure } from './repository';
import { footerLinks, siteNav } from './navigation';
import { picture } from './pictures';
import { withBase } from '../design/meta';
import { bentoSettings, bentoTiles } from '../home/bento';
import { coverIssue, coverSettings } from '../home/cover';
import { proofGrid, proofGridSettings } from '../home/proofGrid';
import { CATALOGUE } from '../home/catalogue';
import { KIND_LABEL, leadOf, voicesOf, type PresentEnv, type Voice } from '../home/present';
import { VIEW_IDS, type ViewId } from '../home/ids';
import type { HomeRouting } from '../scripts/homeRoute';

type Home = NonNullable<ReturnType<typeof getHome>>;

/** The views that have a page of their own (`/views/<id>/`): every offered view that's built, the classic hub too. */
export function viewPaths(): ViewId[] {
  const home = getHome();
  return (home?.offered ?? []).filter((v) => CATALOGUE.views[v].built);
}

/**
 * What the head's router needs on a home page (switcher.md §3): which view this page shows and where it is,
 * the site's default and offered views. None without a `home` key (the classic hub is all the site has).
 * Every view has an address (one that isn't offered answers with a short page), so a link may name any.
 * The lenses get their pages in stage 2c (plan.md §6).
 */
export function homeRouting(view: ViewId, at: HomeRouting['at']): HomeRouting | undefined {
  const home = getHome();
  if (!home) return undefined;
  return { at, view, default: home.default, offered: viewPaths(), known: [...VIEW_IDS], lenses: [], base: withBase('/').replace(/\/$/, '') };
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
 * default, and the other ways to explore. Null when there's nothing to change to.
 */
export function viewSwitch(current: ViewId) {
  const home = getHome();
  const offered = viewPaths();
  if (!home || offered.length < 2) return null;
  const views: ViewChoice[] = offered.map((id) => ({
    id,
    label: CATALOGUE.views[id].label,
    line: CATALOGUE.views[id].line,
    href: withBase(id === home.default ? '/' : `/views/${id}/`),
    current: id === current,
    isDefault: id === home.default,
  }));
  const modes = getPlanet() ? [{ id: 'play', label: 'Little planet', line: 'A game, at /play/', href: withBase('/play/') }] : [];
  return { views, modes, defaultHref: withBase('/') };
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

/** Bento's props (documentation/home-views/bento.md): the lead, the tiles with their pictures, the voices. Null when there's no home. */
export async function bentoView() {
  const home = getHome();
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

/** Cover's props (documentation/home-views/cover.md): the lead, In this issue, the cover story and picture, a feature per strength, a colleague's words. Null when there's no home. */
export async function coverView() {
  const home = getHome();
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

/** Proof grid's props (documentation/home-views/proof-grid.md): the lead, the columns with their names, a row per strength, the colleagues' words. Null when there's no home. */
export function proofGridView() {
  const home = getHome();
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
