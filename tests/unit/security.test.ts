import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Security rules that live outside any one component (documentation/engineering/security-review.md). Each fix the
 * review made in a component is held by that component's own tests; these are the repository-wide ones.
 */
const ROOT = process.cwd();
const WORKFLOWS = join(ROOT, '.github/workflows');
const workflows = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => [f, readFileSync(join(WORKFLOWS, f), 'utf8')] as const);

/** GitHub's published SSH host key (https://api.github.com/meta, ssh_keys). */
const GITHUB_ED25519 = 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl';

describe('workflows (P6)', () => {
  it("trust GitHub's published SSH host key, never one scanned from the network", () => {
    for (const [f, s] of workflows) {
      expect(s, f).not.toMatch(/ssh-keyscan/);
      if (/known_hosts/.test(s)) expect(s, f).toContain(GITHUB_ED25519);
    }
  });

  it('never run on pull_request_target, and say what they may touch', () => {
    for (const [f, s] of workflows) {
      expect(s, f).not.toMatch(/pull_request_target/);
      expect(s, f).toMatch(/^permissions:|^\s+permissions:/m);
    }
  });

  it('never put an expression from an event straight into a shell command', () => {
    // ${{ github.event.* }} in a run: block is the classic script injection; pass it through env: instead
    for (const [f, s] of workflows) expect(s.match(/run:[^\n]*\$\{\{\s*github\.event\./g) ?? [], f).toEqual([]);
  });
});
