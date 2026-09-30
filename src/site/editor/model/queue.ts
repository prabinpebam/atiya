/**
 * The article editor's save queue (documentation/editor/spec.md §8.6): never two saves at once. A save
 * asked for while one is in flight is merged into the next job and runs when it finishes; a job that
 * says stop (a conflict) stops the queue for good, so nothing is written over someone else's change.
 * Pure, so the unit tests hold it without a browser.
 */
export type Outcome = 'ok' | 'failed' | 'stop';

export class SaveQueue<J> {
  private running = false;
  private next: J | null = null;
  private halted = false;

  /**
   * @param merge folds a new request into the job waiting (null when none is)
   * @param run saves one job; `more()` says whether another is already waiting (so it can keep newer local edits)
   */
  constructor(
    private readonly merge: (waiting: J | null, request: J) => J,
    private readonly run: (job: J, more: () => boolean) => Promise<Outcome>,
  ) {}

  /** Asks for a save; resolves when this call's work (and whatever joined it) is done. */
  async push(request: J): Promise<void> {
    if (this.halted) return;
    this.next = this.merge(this.next, request);
    if (this.running) return;
    this.running = true;
    try {
      while (this.next !== null && !this.halted) {
        const job = this.next;
        this.next = null;
        if ((await this.run(job, () => this.next !== null)) === 'stop') this.halted = true;
      }
    } finally {
      this.running = false;
    }
  }

  /** A save is in flight or waiting (leaving the page now would lose it). */
  get pending(): boolean {
    return this.running || this.next !== null;
  }

  /** A conflict stopped it: nothing more is saved until the page is loaded again. */
  get stopped(): boolean {
    return this.halted;
  }
}
