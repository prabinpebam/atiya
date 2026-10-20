/**
 * What every home view shows the same way (documentation/home-views/foundation.md §3, §7): a proof item's kind and
 * where it leads, the voices in their words, and the lead's identity and two actions. Pure: the page passes in where
 * things live, so the same picks read the same in every view.
 */
import { CATALOGUE } from './catalogue';
import type { HomePicks, Pick as Placed, StrengthPicks } from './curate';
import { PROOF_KINDS, type ProofKind, type Showcase } from './schema';

/** A kind of proof, as a label beside it. */
export const KIND_LABEL: Record<ProofKind, string> = {
  shipped: 'Shipped',
  led: 'Led',
  built: 'Built',
  wrote: 'Wrote',
  spoke: 'Spoke',
  recognised: 'Recognised',
  said: 'Said',
};

/** Where the views' links lead: the page decides (with the site's base), so this stays pure. */
export interface PresentEnv {
  /** A page's address when it's published and open. */
  pageHref(id: string): string | undefined;
  resumeHref?: string;
  contactHref?: string;
  /** A recommendation's writer, by its ID. */
  person(recommendation: string): { name: string; title?: string } | undefined;
}

/** A proof item, ready to show. */
export interface EvidenceItem {
  key: string;
  source: Placed['source'];
  /** The page's title, the résumé's words, or whose recommendation. */
  title: string;
  kind?: ProofKind;
  kindLabel?: string;
  /** The page, or the résumé for one of its lines. */
  href?: string;
  /** Ask me about it: the contact page, with the strength as its topic. */
  ask?: string;
}

/** The contact page with a topic filled in (Ask me about it). */
export const askHref = (contact: string | undefined, topic: string) => (contact ? `${contact}?topic=${encodeURIComponent(topic)}` : undefined);

export function evidenceItem(p: Placed, strength: StrengthPicks, env: PresentEnv): EvidenceItem | undefined {
  const kind = p.kind ? { kind: p.kind, kindLabel: KIND_LABEL[p.kind] } : {};
  const ask = askHref(env.contactHref, strength.capability.name);
  if (p.source === 'page' && p.id && p.title) {
    const href = env.pageHref(p.id);
    if (!href) return undefined;
    return { key: `page:${p.id}`, source: 'page', title: p.title, href, ...kind, ...(p.ask && ask ? { ask } : {}) };
  }
  if (p.source === 'resume' && p.resume) {
    return { key: `resume:${p.resume}`, source: 'resume', title: p.resume, ...(env.resumeHref ? { href: env.resumeHref } : {}), ...kind, ...(ask ? { ask } : {}) };
  }
  if (p.source === 'recommendation' && p.recommendation) {
    const who = env.person(p.recommendation);
    return who ? { key: `said:${p.recommendation}`, source: 'recommendation', title: `${who.name}, in their words`, kind: 'said', kindLabel: KIND_LABEL.said } : undefined;
  }
  return undefined;
}

/** A strength's details (L3), ready to show: the ones that lead somewhere or can be asked about. */
export const evidenceOf = (s: StrengthPicks, env: PresentEnv): EvidenceItem[] => s.details.flatMap((p) => evidenceItem(p, s, env) ?? []);

/** A strength's strongest kind of proof: the goal's kinds first (Get hired: shipped, led, said), then the rest in order. */
export function strongestKind(s: Pick<StrengthPicks, 'all'>, goal: HomePicks['goal']): ProofKind | undefined {
  const have = new Set(s.all.map((p) => p.kind).filter(Boolean));
  const order = [...(CATALOGUE.goals[goal]?.counts ?? []), ...PROOF_KINDS] as ProofKind[];
  return order.find((k) => have.has(k));
}

/** A quote in someone's words, with who said it. */
export interface Voice {
  recommendation: string;
  quote: string;
  name: string;
  title?: string;
}

/**
 * In their words: the lead voice first, then each shown strength's, one quote per person (a site with three
 * recommendations shows three). A voice without a quote takes the first quote a strength gives that person.
 */
export function voicesOf(picks: Pick<HomePicks, 'leadVoice' | 'strengths'>, env: Pick<PresentEnv, 'person'>): Voice[] {
  const shown = picks.strengths.filter((s) => s.shown);
  const quoteOf = (id: string) => shown.find((s) => s.voice?.recommendation === id)?.voice?.quote;
  const order = [picks.leadVoice, ...shown.map((s) => s.voice)].filter((v): v is { recommendation: string; quote?: string } => !!v);
  const seen = new Set<string>();
  const out: Voice[] = [];
  for (const v of order) {
    if (seen.has(v.recommendation)) continue;
    const quote = v.quote ?? quoteOf(v.recommendation);
    const who = env.person(v.recommendation);
    if (!quote || !who) continue;
    seen.add(v.recommendation);
    out.push({ recommendation: v.recommendation, quote, name: who.name, ...(who.title ? { title: who.title } : {}) });
  }
  return out;
}

/** The lead's identity and its two always-on actions (foundation §7). */
export interface Lead {
  name: string;
  role?: string;
  /** The site's positioning line; none until the person writes one (never made up). */
  positioning?: string;
  facts: string[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export function leadOf(o: { name: string; role?: string; positioning?: string; showcase: Pick<Showcase, 'facts' | 'actions'>; goal: HomePicks['goal']; resumeHref?: string; contactHref?: string }): Lead {
  const labels = CATALOGUE.goals[o.goal]?.actions;
  const primary = o.showcase.actions?.primary ?? labels?.primary;
  const secondary = o.showcase.actions?.secondary ?? labels?.secondary;
  return {
    name: o.name,
    ...(o.role ? { role: o.role } : {}),
    ...(o.positioning?.trim() ? { positioning: o.positioning.trim() } : {}),
    facts: (o.showcase.facts ?? []).map((f) => f.text),
    ...(primary && o.resumeHref ? { primary: { label: primary, href: o.resumeHref } } : {}),
    ...(secondary && o.contactHref ? { secondary: { label: secondary, href: o.contactHref } } : {}),
  };
}
