import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_NOTES, KITS, MARK, ROOT, SKILL_NOTES, check, frontmatter } from '../../scripts/agent-kits.mjs';

const checkedOut = KITS.every((k) => existsSync(join(ROOT, k, 'skills')));
const generated = (folder: string) =>
  readdirSync(join(ROOT, folder), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md') && readFileSync(join(ROOT, folder, f), 'utf8').includes(MARK))
    .map((f) => join(folder, f));

describe('agent kits', () => {
  it('discovery files are generated, named and point inside a pinned kit', () => {
    const files = [...generated('.github/skills'), ...generated('.github/agents')];
    expect(files.length).toBe(Object.keys(SKILL_NOTES).length + Object.keys(AGENT_NOTES).length);
    const modules = readFileSync(join(ROOT, '.gitmodules'), 'utf8');
    for (const f of files) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      const { name, description } = frontmatter(text);
      expect(name, f).toBeTruthy();
      expect(description, f).toBeTruthy();
      const kit = KITS.find((k) => text.includes(`from ${k}/`));
      expect(kit, f).toBeTruthy();
      expect(modules).toContain(`path = ${kit}`);
    }
  });

  it('the repository skills and Slate keep their own names', () => {
    for (const own of ['article-writing', 'ink-sketch', 'slate']) {
      expect(readFileSync(join(ROOT, '.github/skills', own, 'SKILL.md'), 'utf8')).not.toContain(MARK);
    }
  });

  it.skipIf(!checkedOut)('match the pinned kits', () => {
    expect(check()).toEqual({ stale: [], leftovers: [] });
  });
});
