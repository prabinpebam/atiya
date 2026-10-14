// @ts-check
/**
 * The files a new site's repository gets beside its content (documentation/desktop/spec.md §6.3, §5.4).
 * Pure: each returns a file's text.
 */
import { ENGINE_REPOSITORY } from './engine.mjs';

/**
 * @typedef {{ login: string, id: number, name: string, repo: string, url: string,
 *   explore: 'little-planet' | 'site', engine: { version: string, commit: string | null, sha256: string | null } }} SiteFacts
 */

/** What the app and the build own: the engine's pin, the contract, the developer features and the owner. Which ways in are on is content (`content/structures/ways.json`, plan stage 8A). @param {SiteFacts} s */
export function atiyaJson(s) {
  return (
    JSON.stringify(
      {
        schema: 1,
        engine: s.engine,
        contract: 1,
        // the engine's own parts it publishes; its services (contact, telemetry) are content/site.json's (spec §6.3)
        features: { designLibrary: false, docs: false },
        owner: { login: s.login, id: s.id },
      },
      null,
      2,
    ) + '\n'
  );
}

/** The workflow that builds the site with the pinned engine. @param {SiteFacts} s */
export function workflow(s) {
  const ref = s.engine.commit ?? 'main';
  return [
    '# Builds and publishes this site with the engine release pinned in atiya.json.',
    '# Written by Atiya Studio: don\'t edit it by hand; the app updates it with the engine.',
    'name: Site',
    'on:',
    '  push: { branches: [main] }',
    '  workflow_dispatch:',
    "  schedule: [{ cron: '45 18 * * *' }]",
    'permissions: { contents: read, pages: write, id-token: write }',
    'concurrency: { group: pages, cancel-in-progress: false }',
    'jobs:',
    '  site:',
    `    uses: ${ENGINE_REPOSITORY}/.github/workflows/site-build.yml@${ref}`,
    '    secrets: inherit',
    '',
  ].join('\n');
}

/** For agents working in the repository. @param {SiteFacts} s */
export function agentsMd(s) {
  return `# AGENTS.md

This is ${s.name}'s portfolio site, published at ${s.url} by GitHub Pages. It was made by Atiya Studio.

## What's here

- \`content/\`: everything on the site, as JSON: pages (\`articles/\`), the sections and navigation (\`structures/site.json\`), the planet's buildings (\`structures/modes/little-planet.json\`), which ways to explore are on (\`structures/ways.json\`), people, settings (\`site.json\`) and media with their sidecars (\`media/\`).
- \`atiya.json\`: the engine version this site is built with, and which ways to explore it are on. Don't change \`engine\` by hand: Atiya Studio updates it together with the workflow.
- \`.github/workflows/site.yml\`: builds and publishes the site with that engine. Don't edit it.

There is no code here: the site's code is the engine, pinned in \`atiya.json\`.

## Changing content

- Edit the JSON in \`content/\`, keeping to the content contract: https://github.com/${ENGINE_REPOSITORY}/blob/main/documentation/content/spec.md (pages are blocks; text is a small Markdown subset; IDs never change).
- Check before pushing: \`atiya doctor --dir .\` (Atiya Studio's command-line tool), or open the site in Atiya Studio, whose edit mode checks every save.
- A push to \`main\` publishes. The build checks the whole content contract, so a change that breaks it fails the build and the live site keeps its last good version.
- Commit content as LF JSON with two-space indents and a final newline.

## State

\`atiya status --dir . --json\` says whether everything is saved, pushed, built and live.
`;
}

/** For people who find the repository on GitHub. @param {SiteFacts} s */
export function readme(s) {
  return `# ${s.name}

This repository holds the content of ${s.name}'s site, ${s.url}

It's edited with Atiya Studio and published by GitHub Pages. The site's code isn't here: it's the engine named in \`atiya.json\`.
`;
}

export const GITATTRIBUTES = '* text=auto eol=lf\ncontent/**/*.json text eol=lf\n*.webp binary\n*.png binary\n*.jpg binary\n*.gif binary\n*.pdf binary\n*.mp4 binary\n*.webm binary\n';
export const GITIGNORE = '.atiya/\nnode_modules/\n';
