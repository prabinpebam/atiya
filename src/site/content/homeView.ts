/**
 * What a home view shows (documentation/home-views/foundation.md §7): the curated picks turned into the
 * components' props, every address and picture resolved. The views' pages call it; the components never
 * read the home model (they're tiers below it), and the model never reads the site's addresses.
 */
import { canonicalPath, content, getAccess, getHome, getPerson, getPlanet, getRecommendations, getRoute, getRoutes, getSite, getStructure } from './repository';
import { footerLinks, siteNav } from './navigation';
import { picture } from './pictures';
import { withBase } from '../design/meta';
import { bentoSettings, bentoTiles } from '../home/bento';
import { leadOf, voicesOf, type PresentEnv } from '../home/present';
import type { ViewId } from '../home/ids';

/** The views that have a page of their own: every offered view that's built, but the classic hub (it's `/`). */
export function viewPaths(): ViewId[] {
  const home = getHome();
  return (home?.offered ?? []).filter((v) => v !== 'classic');
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
async function cardPicture(id: string) {
  const p = await picture(id, 'card');
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
  const site = getSite();
  const owner = getPerson(site.owner);
  const env = presentEnv();
  const settings = bentoSettings(home.settings.bento);
  const tiles = await Promise.all(
    bentoTiles(home.picks, settings, env).map(async ({ quote, picture: media, ...t }) => ({
      ...t,
      ...(quote ? { quote: { text: quote.quote, name: quote.name, ...(quote.title ? { title: quote.title } : {}) } } : {}),
      ...(media ? { picture: await cardPicture(media) } : {}),
    })),
  );
  const voices = settings.words === 'on' ? voicesOf(home.picks, env).map((v) => ({ text: v.quote, name: v.name, ...(v.title ? { title: v.title } : {}) })) : [];
  const showcase = content().showcase ?? {};
  const lead = leadOf({
    name: owner?.name ?? site.name,
    role: owner?.role,
    positioning: site.positioning,
    showcase,
    goal: home.picks.goal,
    resumeHref: env.resumeHref,
    contactHref: env.contactHref,
  });
  return { lead, tiles, voices, density: settings.density };
}
