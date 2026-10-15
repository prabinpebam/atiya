/**
 * The site's services (documentation/desktop/spec.md §9.5, plan stage 11): the shapes of the values a person
 * pastes, which hosts an embedded form may come from, and what the Contact page draws. Pure, for the content
 * contract, the pages, edit mode and the app's `atiya services` command alike. The options themselves are
 * catalogue.json.
 */
import catalogue from './catalogue.json';

export { catalogue };

/** The shape each pasted value must have (catalogue.json `value.shape`). */
export const SHAPES = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  goatcounter: /^[a-z0-9-]{2,50}$/,
  ga4: /^G-[A-Z0-9]{4,}$/,
  clarity: /^[a-z0-9]{6,20}$/,
} as const;

export type Shape = keyof typeof SHAPES | 'embed';

/** The service an embedded form's link is on (an allowed host), or null. */
export function embedHost(url: string): { host: string; name: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  return catalogue.embedHosts.find((e) => (h === e.host || h.endsWith(`.${e.host}`)) && (!('path' in e) || u.pathname.startsWith(e.path as string))) ?? null;
}

/** Whether a value has its shape. */
export function fits(shape: Shape, value: string): boolean {
  return shape === 'embed' ? !!embedHost(value) : SHAPES[shape].test(value);
}

/** What a value of a shape should look like, said to a person (catalogue.json `shapes`). */
export const shapeText = (shape: Shape) => catalogue.shapes[shape];

/** The site's contact setting, as content/site.json holds it. */
export type ContactSetting = { kind?: 'relay'; endpoint: string } | { kind: 'email'; address: string } | { kind: 'web3forms'; key: string } | { kind: 'embed'; url: string };

/** What the Contact page draws. */
export type ContactView = { kind: 'relay'; endpoint: string } | { kind: 'web3forms'; key: string } | { kind: 'email'; address: string } | { kind: 'embed'; url: string; name: string } | { kind: 'none' };

/**
 * What the Contact page draws, from the site's setting. A test build always draws the relay form on its
 * made-up endpoint (`.env.test`), so no test reaches a real service.
 */
export function contactView(setting: ContactSetting | undefined, o: { test?: boolean; testEndpoint?: string } = {}): ContactView {
  if (o.test) return o.testEndpoint ? { kind: 'relay', endpoint: o.testEndpoint } : { kind: 'none' };
  if (!setting) return { kind: 'none' };
  if ('endpoint' in setting) return { kind: 'relay', endpoint: setting.endpoint };
  if (setting.kind === 'embed') {
    const host = embedHost(setting.url);
    return host ? { kind: 'embed', url: setting.url, name: host.name } : { kind: 'none' };
  }
  return setting;
}

/** The counting tool's setting (`services.counts`). */
export type CountsSetting = { kind: 'goatcounter'; code: string; site: string } | { kind: 'umami'; id: string; host?: string; site: string } | { kind: 'ga4'; id: string; site: string };

/** Which catalogue option a setting is (an embed by its host; another embed host is `embed`). */
export function optionOf(setting: ContactSetting | CountsSetting | undefined): string | null {
  if (!setting) return null;
  if ('endpoint' in setting) return 'relay';
  if (setting.kind === 'embed') {
    const host = embedHost(setting.url)?.name;
    return catalogue.contact.find((o) => o.kind === 'embed' && o.name === host)?.id ?? 'embed';
  }
  return setting.kind;
}
