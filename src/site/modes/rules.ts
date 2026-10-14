/**
 * The content contract's rules for navigation modes (documentation/desktop/modes.md §6), checked
 * against a site's ways in (`content/structures/ways.json`, plan stage 8A), its content and the modes the
 * engine carries:
 *
 * - V33: every mode turned on resolves to a known manifest, at an `api` the engine hosts; `primary` is
 *   the site or a mode that's on;
 * - V34: mounts are unique and collide with no section slug or site route;
 * - V35: a mode's structure fits its schema, and names only the mode's own slots;
 * - V36: a slot shows a section that exists, a section is shown by at most one slot of a mode, and mode
 *   data holds no draft or private page;
 * - V37: a mode turned off keeps its structure (turning it back on restores its map).
 */
import { z } from 'astro/zod';
import type { ContentIndex } from '../content/load';
import { RESERVED } from '../content/routes';
import { BUILTIN_MODES } from './builtin';
import { HOSTED_API, WAYS_FILE, type BuiltinMode, type ModeData, type ModeStructure, type SiteModes } from './contract';

/** Where the rules' issues about which modes are on point. */
const WAYS = `content/${WAYS_FILE}`;
import { buildModeData } from './data';

export interface ModeIssue {
  rule: 'V33' | 'V34' | 'V35' | 'V36' | 'V37';
  /** The file it's about, under the site's folder. */
  file: string;
  message: string;
}

export interface ModeCheck {
  issues: ModeIssue[];
  /** Each mode that's on and passes, with the data its page is given. */
  data: ModeData[];
}

/**
 * @param o the site's ways in, its content, each mode's structure file as read (undefined when
 * it isn't there), and the modes the engine carries
 */
export function checkModes(o: { modes: SiteModes; index: ContentIndex; structures: Record<string, unknown>; base?: string; catalogue?: ReadonlyMap<string, BuiltinMode> }): ModeCheck {
  const catalogue = o.catalogue ?? BUILTIN_MODES;
  const issues: ModeIssue[] = [];
  const data: ModeData[] = [];
  const add = (rule: ModeIssue['rule'], file: string, message: string) => issues.push({ rule, file, message });
  const sections = new Set((o.index.structure.home.children ?? []).filter((n) => n.kind === 'hub').map((n) => n.id));
  // what the site already answers at its top level: its sections and pages, and the code's own routes
  const taken = new Map<string, string>();
  for (const r of o.index.routes) {
    const first = r.path.split('/')[1];
    if (first && !taken.has(first)) taken.set(first, `the site's ${r.node.kind === 'hub' ? 'section' : 'page'} at /${first}/`);
  }
  // `play` is kept for a mode
  for (const r of RESERVED) if (r !== 'play' && !taken.has(r)) taken.set(r, `the site's own /${r}/`);

  const mounts = new Map<string, string>();
  const on = new Set<string>();
  for (const m of o.modes.modes) {
    const mode = catalogue.get(m.id);
    // V33
    if (!mode) {
      if (m.on) add('V33', WAYS, `the mode "${m.id}" isn't one this engine knows: turn it off, or update the engine`);
      continue;
    }
    if (m.on && (mode.manifest.api < HOSTED_API.min || mode.manifest.api > HOSTED_API.max)) {
      add('V33', WAYS, `the mode "${m.id}" is written for version ${mode.manifest.api} of the contract; this engine hosts ${HOSTED_API.min} to ${HOSTED_API.max}`);
      continue;
    }
    if (m.on) on.add(m.id);
    // V34: a mode turned off still answers at its address (its "not offered" page), so it holds its mount too
    const mount = m.mount ?? mode.manifest.mount;
    const other = mounts.get(mount);
    if (other) add('V34', WAYS, `"${m.id}" and "${other}" both want /${mount}/: give one another address`);
    else mounts.set(mount, m.id);
    const clash = taken.get(mount);
    if (clash) add('V34', WAYS, `"${m.id}" at /${mount}/ collides with ${clash}: give the mode another address`);

    const file = `content/${mode.structureFile}`;
    const raw = o.structures[m.id];
    // V37
    if (!m.on) {
      if (raw === undefined) add('V37', file, `"${m.id}" is off but its structure is gone: turning it back on would lose its map`);
      continue;
    }
    // V35
    if (raw === undefined) {
      add('V35', file, `"${m.id}" is on but has no structure: map its slots to sections`);
      continue;
    }
    let structure: ModeStructure;
    try {
      structure = mode.readStructure(raw);
    } catch (e) {
      if (!(e instanceof z.ZodError)) throw e;
      for (const i of e.issues) add('V35', file, `${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }
    const slots = mode.manifest.slots;
    const seenSlots = new Set<string>();
    for (const s of structure.slots) {
      if (seenSlots.has(s.id)) add('V35', file, `the slot "${s.id}" is listed twice`);
      seenSlots.add(s.id);
      if (slots.kind === 'fixed' && !slots.ids.includes(s.id)) add('V35', file, `"${s.id}" isn't one of ${mode.manifest.name}'s slots (${slots.ids.join(', ')})`);
    }
    if (slots.kind === 'per-section' && structure.slots.length > slots.max) add('V35', file, `${mode.manifest.name} holds at most ${slots.max} slots; this has ${structure.slots.length}`);
    // V36
    const shownBy = new Map<string, string>();
    for (const s of structure.slots) {
      if (!s.section) continue;
      if (!sections.has(s.section)) add('V36', file, `the slot "${s.id}" shows "${s.section}", which isn't a section of the site`);
      const before = shownBy.get(s.section);
      if (before) add('V36', file, `the section "${s.section}" is shown by both "${before}" and "${s.id}": a section has one slot in a mode`);
      else shownBy.set(s.section, s.id);
    }
    const md = buildModeData(o.index, { id: m.id, mount, structure, base: o.base ?? '/' });
    const leaked = md.sections.flatMap((s) => s.pages).filter((p) => {
      const route = o.index.routes.find((r) => r.node.kind === 'item' && r.node.item.id === p.id);
      return !route || !route.published || route.access !== 'open';
    });
    for (const p of leaked) add('V36', file, `mode data would hold "${p.id}", which isn't a published open page`);
    if (!issues.some((i) => i.file === file)) data.push(md);
  }
  if (o.modes.primary !== 'site' && !on.has(o.modes.primary)) add('V33', WAYS, `"primary" is "${o.modes.primary}", which isn't a mode that's on: choose "site" or a mode that's on`);
  return { issues, data };
}
