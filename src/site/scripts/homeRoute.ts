/**
 * Which home view a visitor sees (documentation/home-views/switcher.md §2, §3; foundation.md §6): a link
 * first, then the visitor's own pick, then the site's default; and the role lens, kept for the visit.
 * The decision runs in the page's head, before the first paint, so a redirect never flashes the wrong view
 * and Back doesn't loop (`location.replace`). It's a plain script, emitted inline by PageShell, which reads
 * what the build knows from `<html data-home-*>`; `homeAttrs` writes those. Tier 0: no component reads it.
 */

/** What the build knows about the page the router runs on. */
export interface HomeRouting {
  /** The site's root (`/`, which shows the default) or a view's own address (`/views/<id>/…`). */
  at: 'root' | 'view';
  /** The view this page shows. */
  view: string;
  /** The site's default view. */
  default: string;
  /** The views the site offers. */
  offered: string[];
  /** Every view a link may name (a view that isn't offered has its own "not offered" page). */
  known: string[];
  /** The site's lenses, by ID. */
  lenses: string[];
  /** The lens this page is ordered for, if any. */
  lens?: string;
  /** The base path, without its trailing slash (`/atiya` on GitHub Pages, else empty). */
  base: string;
}

/** The attributes `<html>` carries for the router. */
export function homeAttrs(r: HomeRouting): Record<string, string> {
  return {
    'data-home-at': r.at,
    'data-home-view': r.view,
    'data-home-default': r.default,
    'data-home-offered': r.offered.join(' '),
    'data-home-known': r.known.join(' '),
    'data-home-lenses': r.lenses.join(' '),
    'data-home-lens': r.lens ?? '',
    'data-home-base': r.base,
  };
}

/** The storage keys: the visitor's pick (kept across visits), the visit's lens, and how the next page was reached. */
export const HOME_KEYS = { view: 'site.homeView', lens: 'site.homeLens', arrival: 'site.homeArrival', changed: 'site.homeChanged' } as const;

/**
 * The router, as the inline script's source. Leaves the page alone with `?mode=` (the classic hub's ways in);
 * with storage blocked, it follows the address alone and keeps nothing. Unit-tested by running this string against
 * a stand-in document, location, history and storage (tests/unit/homeRoute.test.ts).
 */
export const HOME_ROUTER = `(function () {
  var d = document.documentElement;
  var attr = function (n) { return d.getAttribute('data-home-' + n) || ''; };
  var list = function (n) { var v = attr(n); return v ? v.split(' ') : []; };
  var has = function (l, x) { return !!x && l.indexOf(x) >= 0; };
  var get = function (s, k) { try { return s.getItem(k); } catch (e) { return null; } };
  var set = function (s, k, v) { try { s.setItem(k, v); } catch (e) {} };
  var drop = function (s, k) { try { s.removeItem(k); } catch (e) {} };
  var storage = function (n) { try { return window[n]; } catch (e) { return null; } };
  var local = storage('localStorage'), session = storage('sessionStorage');
  var q = new URLSearchParams(location.search);
  if (q.has('mode')) return;
  var at = attr('at'), view = attr('view'), def = attr('default'), base = attr('base'), mine = attr('lens');
  var offered = list('offered'), known = list('known'), lenses = list('lenses');
  var lens = null, asked = false, source = at === 'root' ? 'default' : 'link';
  if (q.has('for') && (q.get('for') === '' || has(lenses, q.get('for')))) {
    asked = true;
    lens = q.get('for') || null;
    if (lens) set(session, '${HOME_KEYS.lens}', lens); else drop(session, '${HOME_KEYS.lens}');
  } else if (mine) {
    lens = mine;
    set(session, '${HOME_KEYS.lens}', mine);
  } else {
    lens = get(session, '${HOME_KEYS.lens}');
    if (lens && !has(lenses, lens)) { drop(session, '${HOME_KEYS.lens}'); lens = null; }
  }
  var want = view;
  if (at === 'root') {
    var linked = q.get('view'), stored = get(local, '${HOME_KEYS.view}');
    if (has(known, linked)) { want = linked; source = 'link'; }
    else if (stored && has(offered, stored)) { want = stored; source = 'stored'; }
    else if (stored) drop(local, '${HOME_KEYS.view}');
    if (want === 'classic' && asked && lens) {
      for (var i = 0; i < offered.length; i++) if (offered[i] !== 'classic') { want = offered[i]; source = 'link'; break; }
    }
  }
  if (want === 'classic' || !has(offered, want)) lens = null;
  var here = location.pathname.replace(/\\/?$/, '/');
  var target = here;
  if (at === 'root' && want === def && !lens) target = base + '/';
  else if (at === 'root' || lens !== (mine || null)) target = base + '/views/' + want + '/' + (lens ? 'for/' + lens + '/' : '');
  q.delete('for');
  q.delete('view');
  var rest = q.toString();
  var to = target + (rest ? '?' + rest : '') + location.hash;
  if (here === target) {
    if (to !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', to);
    return;
  }
  set(session, '${HOME_KEYS.arrival}', source);
  location.replace(to);
})();`;

/** A change the visitor made in Change view, kept for the page it opens. */
export interface HomeChange {
  from: string;
  to?: string;
  default?: boolean;
}

/** What a page tells telemetry, and says, once it's shown (tests/unit/homeViews.test.ts). */
export function homeEvents(page: { view: string; at: string; lens: string }, arrival: string | null, changed: HomeChange | null) {
  const events: [string, Record<string, string>][] = [['home_view', { view: page.view, lens: page.lens || 'none', source: arrival ?? (page.at === 'root' ? 'default' : 'link') }]];
  if (changed?.default) events.push(['view_default', { from: changed.from }]);
  else if (changed?.to && changed.to !== changed.from) events.push(['view_switch', { from: changed.from, to: changed.to }]);
  return { events, announce: !!changed && changed.from !== page.view };
}
