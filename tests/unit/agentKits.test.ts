import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_NOTES, KITS, MARK, ROOT, SKILL_NOTES, check, frontmatter, orchestrationHooks } from '../../scripts/agent-kits.mjs';

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

  it.skipIf(!checkedOut)("installs agent-orchestration's session clock and guard as project hooks", () => {
    const hooks = orchestrationHooks();
    expect([...hooks.keys()].sort()).toEqual(['.github/hooks/orchestration-clock.json', '.github/hooks/orchestration-clock.mjs', '.github/hooks/orchestration-guard.json']);
    const events = (rel: string) => Object.keys(JSON.parse(hooks.get(rel) ?? '{}').hooks);
    expect(events('.github/hooks/orchestration-clock.json')).toEqual(['sessionStart', 'postToolUse', 'preCompact', 'agentStop']);
    expect(events('.github/hooks/orchestration-guard.json')).toEqual(['preToolUse', 'userPromptSubmitted']);
    for (const rel of ['.github/hooks/orchestration-clock.json', '.github/hooks/orchestration-guard.json']) {
      for (const [entry] of Object.values(JSON.parse(hooks.get(rel) ?? '{}').hooks) as { command: string }[][]) {
        expect(entry.command, rel).toMatch(/^node \.github\/hooks\/orchestration-clock\.mjs \w+$/);
      }
    }
  });

  it('registers AI integration as a tooling-only skill with a dedicated offline updater', () => {
    expect(KITS).toContain('ai-integration');
    expect(SKILL_NOTES['ai-integration']).toContain('no site or engine build reads it');
    const updater = readFileSync(join(ROOT, 'scripts/update-ai-integration.ps1'), 'utf8');
    expect(updater).toContain('node --test');
    expect(updater).toContain('catalogue validate');
  });
});
