/**
 * The proposal store (documentation/editor/ai-editing.md §12): one open proposal per article (one request
 * per article at a time, §15), kept in `.atiya/proposals/<article-id>.json` beside the AI settings, never
 * committed. It's deleted when applied or discarded, and swept after 30 days untouched. It holds the body the
 * proposal was made from, so the review (`model/aiReview.ts`) can show and apply it after a reload.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { contentRoot } from '../../content/source';
import type { Block } from '../../content/schema';
import type { Target } from '../model/aiContract';
import type { Decision } from '../model/aiReview';
import type { Proposal } from './aiConnector';
import { writeJsonAtomic } from './aiSettings';

/** How long an untouched proposal is kept. */
export const KEEP_DAYS = 30;

/** A proposal as it's kept: what was asked, what it was made from, the answer and your decisions so far. */
export interface StoredProposal {
  version: 1;
  /** The article's ID (the file's name). */
  id: string;
  /** Who proposed: a service's name, or an agent's (§8.5). */
  by: string;
  target: Target;
  instruction: string;
  /** The article's store version it was made from, or null if it had unsaved edits. */
  madeFrom: string | null;
  /** The body and header it was made from: the review's "before". */
  base: { body: Block[]; header: { title?: string; summary?: string } };
  proposal: Proposal;
  /** Accept or reject, by block key. A change not here is undecided. */
  decisions: Record<string, Decision>;
  /** An interview's answers (§6), so a reload or Try again doesn't ask again. */
  answers?: Record<string, string>;
  createdAt: string;
  touchedAt: string;
}

/** What the AI screen lists (§8.5). */
export interface ProposalSummary {
  id: string;
  by: string;
  summary: string;
  createdAt: string;
  touchedAt: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** The folder: `.atiya/proposals/` in the site's folder (the content folder's parent). */
export const proposalsDir = (root = contentRoot()) => join(dirname(root), '.atiya', 'proposals');

function fileOf(id: string, dir: string): string {
  // an article's ID is the file's name: never a path
  if (!ID.test(id)) throw new Error('That isn\'t an article ID.');
  return join(dir, `${id}.json`);
}

const stale = (p: Pick<StoredProposal, 'touchedAt'>, now: number) => now - Date.parse(p.touchedAt) > KEEP_DAYS * 86_400_000;

function load(file: string): StoredProposal | null {
  try {
    const p = JSON.parse(readFileSync(file, 'utf8')) as StoredProposal;
    return p?.version === 1 && typeof p.id === 'string' && p.proposal && p.base ? p : null;
  } catch {
    return null;
  }
}

/** Keeps a new proposal, replacing the article's last one. */
export function keepProposal(p: Omit<StoredProposal, 'version' | 'decisions' | 'createdAt' | 'touchedAt'>, dir = proposalsDir(), now = Date.now()): StoredProposal {
  const at = new Date(now).toISOString();
  const kept: StoredProposal = { version: 1, ...p, decisions: {}, createdAt: at, touchedAt: at };
  writeJsonAtomic(fileOf(p.id, dir), kept);
  return kept;
}

/** The article's open proposal, or null. One past its time is deleted, not returned. */
export function readProposal(id: string, dir = proposalsDir(), now = Date.now()): StoredProposal | null {
  const file = fileOf(id, dir);
  if (!existsSync(file)) return null;
  const p = load(file);
  if (!p || stale(p, now)) {
    rmSync(file, { force: true });
    return null;
  }
  return p;
}

/** Records your decisions (merged with those made before) and touches the proposal. */
export function decide(id: string, decisions: Record<string, Decision | null>, dir = proposalsDir(), now = Date.now()): StoredProposal | null {
  const p = readProposal(id, dir, now);
  if (!p) return null;
  for (const [key, d] of Object.entries(decisions)) {
    if (d) p.decisions[key] = d;
    else delete p.decisions[key];
  }
  p.touchedAt = new Date(now).toISOString();
  writeJsonAtomic(fileOf(id, dir), p);
  return p;
}

/** Deletes the article's proposal: applied or discarded. */
export function dropProposal(id: string, dir = proposalsDir()): void {
  rmSync(fileOf(id, dir), { force: true });
}

/** Every open proposal, newest first; sweeps those past their time and any unreadable file. */
export function listProposals(dir = proposalsDir(), now = Date.now()): ProposalSummary[] {
  if (!existsSync(dir)) return [];
  const out: ProposalSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = join(dir, name);
    const p = load(file);
    if (!p || stale(p, now) || `${p.id}.json` !== name) {
      rmSync(file, { force: true });
      continue;
    }
    out.push({ id: p.id, by: p.by, summary: p.proposal.summary, createdAt: p.createdAt, touchedAt: p.touchedAt });
  }
  return out.sort((a, b) => b.touchedAt.localeCompare(a.touchedAt));
}
