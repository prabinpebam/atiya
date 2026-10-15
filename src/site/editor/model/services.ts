/**
 * Edit mode's Contact and Visitor counts cards (desktop spec §9.5, plan stage 11.6): the choices each card
 * offers, from the services catalogue, and the site settings a choice makes. Pure; the Settings screen draws
 * the cards (components/ServicesForms.astro) and saves what this returns.
 */
import { catalogue, embedHost, fits, optionOf, shapeText, type ContactSetting, type CountsSetting, type Shape } from '../../services/services';
import type { SiteSettings } from '../../content/schema';

export const TIER_LABEL = { simple: 'Simple', balanced: 'Balanced', powerful: 'Powerful' } as const;
type Tier = keyof typeof TIER_LABEL;

export type ServiceGroup = 'contact' | 'counts';

export interface ServiceChoice {
  id: string;
  name: string;
  tier: Tier;
  gives: string;
  asks: string;
  steps: { who: 'person' | 'agent'; text: string; url?: string }[];
  /** The value it asks for, if any: its field's label, its shape, what the shape is, an example. */
  value?: { label: string; shape: Shape; hint: string; example: string };
  /** What's in the field now (the current choice's value). */
  current?: string;
  site?: string;
  dashboard?: string;
  check: string;
  /** Kept as content/site.json has it; this card doesn't edit it (the owner's own service, PostHog). */
  kept?: boolean;
}

type Option = (typeof catalogue.contact)[number] | (typeof catalogue.counts)[number] | (typeof catalogue.addons)[number];
const choiceOf = (o: Option, current?: string): ServiceChoice => ({
  id: o.id,
  name: o.name,
  tier: o.tier as Tier,
  gives: o.gives,
  asks: o.asks,
  steps: o.steps as ServiceChoice['steps'],
  value: { label: o.value.label, shape: o.value.shape as Shape, hint: shapeText(o.value.shape as Shape), example: o.value.example },
  current,
  site: 'site' in o ? o.site : undefined,
  dashboard: 'dashboard' in o ? o.dashboard : undefined,
  check: o.check,
});

const otherHosts = [...new Set(catalogue.embedHosts.map((h) => h.name))].filter((n) => !catalogue.contact.some((o) => o.name === n));

/** The Contact card's choices, and which is chosen. */
export function contactChoices(site: SiteSettings): { chosen: string; choices: ServiceChoice[] } {
  const c = site.services?.contact as ContactSetting | undefined;
  const chosen = optionOf(c) ?? 'none';
  const valueOf = (id: string) => (chosen !== id || !c ? undefined : 'address' in c ? c.address : 'key' in c ? c.key : 'url' in c ? c.url : undefined);
  const choices = catalogue.contact.map((o) => choiceOf(o, valueOf(o.id)));
  choices.push({
    id: 'embed',
    name: 'Another form',
    tier: 'powerful',
    gives: `A form or booking page from ${otherHosts.slice(0, -1).join(', ')} or ${otherHosts.at(-1)}.`,
    asks: 'An account there, a form you build, and its link.',
    steps: [
      { who: 'person', text: 'Build the form on the service you use and copy its link.' },
      { who: 'agent', text: 'Paste the link here.' },
    ],
    value: { label: "The form's link", shape: 'embed', hint: shapeText('embed'), example: 'https://forms.office.com/r/abc123' },
    current: valueOf('embed'),
    check: 'preview',
  });
  if (chosen === 'relay' && c && 'endpoint' in c)
    choices.unshift({ id: 'relay', name: 'Your contact service', tier: 'powerful', gives: `The Contact form, sent by your own service at ${c.endpoint}.`, asks: 'Your own server: kept as content/site.json has it.', steps: [], check: 'none', kept: true });
  return { chosen, choices };
}

/** The Visitor counts card's choices, which is chosen, the site's address it counts and Clarity's ID. */
export function countsChoices(site: SiteSettings, address: string): { chosen: string; choices: ServiceChoice[]; address: string; clarity: string } {
  const s = site.services ?? {};
  const c = s.counts as CountsSetting | undefined;
  const chosen = s.telemetry ? 'posthog' : (optionOf(c) ?? 'none');
  const choices = catalogue.counts.map((o) => choiceOf(o, c && o.kind === c.kind ? ('code' in c ? c.code : c.id) : undefined));
  if (s.telemetry)
    choices.unshift({ id: 'posthog', name: 'PostHog', tier: 'powerful', gives: 'Events, journeys and recordings, from your PostHog project.', asks: 'Kept as content/site.json has it.', steps: [], dashboard: s.telemetry.host?.replace('.i.', '.') ?? 'https://app.posthog.com/', check: 'dashboard', kept: true });
  choices.push({ id: 'none', name: "Don't count visits", tier: 'simple', gives: 'No counting tool on the site.', asks: 'Nothing.', steps: [], check: 'none' });
  return { chosen, choices, address: c?.site ?? s.telemetry?.site ?? address, clarity: s.clarity?.id ?? '' };
}

/** A dashboard's address for a value (GoatCounter's names the code). */
export const dashboardOf = (choice: ServiceChoice, value: string) => choice.dashboard?.replace('{code}', encodeURIComponent(value || 'your-code'));

/** Why a value doesn't fit its choice, said to a person, or null. */
export function valueIssue(choice: ServiceChoice, value: string): string | null {
  if (!choice.value) return null;
  if (!value) return `Paste the ${choice.value.label.toLowerCase().replace(/^(the|your) /, '')} first.`;
  if (choice.value.shape === 'email' && /noreply\.github\.com$/i.test(value)) return "That's GitHub's no-reply address, which nobody reads: use the address you want visitors to write to.";
  if (fits(choice.value.shape, value)) return null;
  if (choice.value.shape === 'embed') return /^https:\/\//.test(value) && !embedHost(value) ? `That link isn't on a service the site can show (${catalogue.embedHosts.map((h) => h.name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}).` : 'Paste the full link, starting with https://.';
  return `That doesn't look right: ${choice.value.hint}`;
}

/** The site's GitHub Pages address from its git remote (`https://<owner>.github.io/<repo>/`), or ''. */
export function pagesAddress(remote: string | null | undefined): string {
  const m = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(remote ?? '');
  if (!m) return '';
  const owner = m[1].toLowerCase();
  return m[2].toLowerCase() === `${owner}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${m[2]}/`;
}

type Result = { site: SiteSettings } | { issue: string };

/** The settings with a contact choice (its value checked); `relay` keeps what's there. */
export function withContact(site: SiteSettings, id: string, value: string): Result {
  const { choices } = contactChoices(site);
  const choice = choices.find((c) => c.id === id);
  if (!choice) return { issue: 'Choose how visitors reach you.' };
  if (choice.kept) return { site };
  const v = value.trim();
  const issue = valueIssue(choice, v);
  if (issue) return { issue };
  const option = catalogue.contact.find((o) => o.id === id);
  const kind = option?.kind ?? 'embed';
  const contact = { kind, [option?.value.field ?? 'url']: v } as ContactSetting;
  return { site: { ...site, services: { ...site.services, contact } as SiteSettings['services'] } };
}

/** The settings with a counting choice, its address and Clarity's ID (each checked); `posthog` keeps PostHog. */
export function withCounts(site: SiteSettings, id: string, value: string, address: string, clarity: string): Result {
  const { choices } = countsChoices(site, address);
  const choice = choices.find((c) => c.id === id);
  if (!choice) return { issue: 'Choose how to count visits, or not to.' };
  const services: Record<string, unknown> = { ...site.services };
  const v = value.trim();
  const at = address.trim();
  const cl = clarity.trim();
  if (id === 'none') {
    delete services.counts;
    delete services.telemetry;
    if (cl) return { issue: 'Clarity counts beside a counting tool: choose one, or clear its project ID.' };
  } else if (!choice.kept) {
    const issue = valueIssue(choice, v);
    if (issue) return { issue };
    if (!/^https:\/\/[^/\s]+\/?/.test(at)) return { issue: "Write your site's address, starting with https://: only a build for that address counts visits." };
    const option = catalogue.counts.find((o) => o.id === id)!;
    services.counts = { kind: option.kind, [option.value.field]: v, site: at.endsWith('/') ? at : `${at}/` };
    delete services.telemetry;
  }
  if (cl && !fits('clarity', cl)) return { issue: `That Clarity project ID doesn't look right: ${shapeText('clarity')}` };
  if (cl) services.clarity = { id: cl };
  else delete services.clarity;
  const next = { ...site, services } as SiteSettings;
  if (!Object.keys(services).length) delete next.services;
  return { site: next };
}
