/**
 * The Review tab's script (documentation/editor/ai-editing.md §8): the decisions, kept as they're made; Accept
 * all and Reject all; Apply, which makes the accepted changes as one save and one undo step; and Discard. The
 * article editor gives it the article and the ways to change it.
 */
import { api, announce } from './client';
import { applyDecisions, applyLabel, reviewItems, type Decision } from '../model/aiReview';
import type { StoredProposal } from '../server/aiProposals';
import type { Block } from '../../content/schema';

export interface ReviewHost {
  /** The article's body as it is now. */
  body: () => Block[];
  /** Makes the accepted changes: one save and one undo step, then selects the block at `at`. */
  apply: (next: Block[], at: number | null) => void;
  /** Selects a block, in the canvas too. */
  select: (index: number) => void;
  /** The proposal was discarded: the inspector is drawn again without the Review tab. */
  closed: () => Promise<void>;
}

const rowsOf = (review: HTMLElement) => [...review.querySelectorAll<HTMLElement>('[data-ai-review-row]')];
const canAccept = (row: HTMLElement) => row.dataset.conflict !== 'removed';

function show(row: HTMLElement, d: Decision | null) {
  row.dataset.decision = d ?? '';
  row.querySelectorAll<HTMLElement>('[data-ai-review-decide]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.aiReviewDecide === d)));
}

function count(review: HTMLElement) {
  const n = rowsOf(review).filter((r) => r.dataset.decision === 'accept' && canAccept(r)).length;
  const apply = review.querySelector<HTMLButtonElement>('[data-ai-review-apply]');
  if (!apply) return;
  apply.querySelector('.label')!.textContent = applyLabel(n);
  apply.disabled = n === 0;
}

export function initReview(root: HTMLElement, host: ReviewHost, signal: AbortSignal) {
  const keep = async (id: string, decisions: Record<string, Decision | null>) => {
    const r = await api('POST', `ai/proposals/${id}`, { decisions });
    if (!r.ok) announce("Your choice wasn't kept: try again", 'negative');
  };

  const apply = async (review: HTMLElement) => {
    const id = review.dataset.aiReview!;
    const r = await api<{ proposal: StoredProposal }>('GET', `ai/proposals/${id}`);
    if (!r.ok) return announce('This proposal is gone: it was applied or discarded elsewhere', 'negative');
    const p = r.data.proposal;
    const decisions = Object.fromEntries(rowsOf(review).map((row) => [row.dataset.aiReviewRow!, (row.dataset.decision || undefined) as Decision | undefined]));
    const items = reviewItems(p.base.body, p.proposal.body);
    const now = host.body();
    const next = applyDecisions(now, items, decisions);
    const n = rowsOf(review).filter((row) => row.dataset.decision === 'accept' && canAccept(row)).length;
    // focus goes to the first block the changes touched (§8.2)
    const first = rowsOf(review).find((row) => row.dataset.decision === 'accept' && next.some((b) => b.key === row.dataset.aiReviewRow));
    const at = first ? next.findIndex((b) => b.key === first.dataset.aiReviewRow) : null;
    await api('DELETE', `ai/proposals/${id}`);
    host.apply(next, at);
    announce(n === 1 ? 'Applied 1 change' : `Applied ${n} changes`);
  };

  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement;
      const review = t.closest<HTMLElement>('[data-ai-review]');
      if (!review) return;
      const id = review.dataset.aiReview!;
      const decide = t.closest<HTMLButtonElement>('[data-ai-review-decide]');
      if (decide && !decide.disabled) {
        const row = decide.closest<HTMLElement>('[data-ai-review-row]')!;
        const pick = decide.dataset.aiReviewDecide as Decision;
        // pressing the chosen one again leaves it undecided
        const d = row.dataset.decision === pick ? null : pick;
        show(row, d);
        count(review);
        void keep(id, { [row.dataset.aiReviewRow!]: d });
        return;
      }
      const all = t.closest<HTMLElement>('[data-ai-review-all]');
      if (all) {
        const d = all.dataset.aiReviewAll as Decision;
        const changed: Record<string, Decision> = {};
        for (const row of rowsOf(review)) {
          const to = d === 'accept' && !canAccept(row) ? 'reject' : d;
          show(row, to);
          changed[row.dataset.aiReviewRow!] = to;
        }
        count(review);
        void keep(id, changed);
        return;
      }
      const go = t.closest<HTMLElement>('[data-ai-review-go]');
      if (go) {
        const i = host.body().findIndex((b) => b.key === go.dataset.aiReviewGo);
        if (i >= 0) host.select(i);
        else announce('That block is only in the proposal: it shows once applied');
        return;
      }
      if (t.closest('[data-ai-review-apply]')) return void apply(review);
      if (t.closest('[data-ai-review-discard]')) {
        const accepted = rowsOf(review).some((row) => row.dataset.decision === 'accept');
        if (accepted && !confirm('Discard this proposal? The changes you accepted are dropped.')) return;
        void (async () => {
          await api('DELETE', `ai/proposals/${id}`);
          await host.closed();
          announce('Proposal discarded');
        })();
      }
    },
    { signal },
  );
}

/** The canvas's marks for an open review (§8.4): each changed block still in the article, with its kind. */
export function reviewMarks(root: HTMLElement, body: Block[]): { index: number; kind: string }[] {
  const review = root.querySelector<HTMLElement>('[data-ai-review]');
  if (!review) return [];
  return rowsOf(review).flatMap((row) => {
    const index = body.findIndex((b) => b.key === row.dataset.aiReviewRow);
    return index >= 0 ? [{ index, kind: row.dataset.kind ?? 'changed' }] : [];
  });
}
