---
name: slate
description: "Use when: creating, converting, reviewing, or updating documentation, research, references, benchmarks, presentations, or a Slate documentation site; acting on Slate revisions or block comments. Loads the repository's canonical Slate system and skill."
argument-hint: "Documentation task"
user-invocable: true
disable-model-invocation: false
---

# Slate

Read and follow [the canonical Slate skill](../../../slate/SKILL.md). The package beside that file owns all
generic guidance, components, templates, assets, subskills, runtime code, scripts, and tests. Do not
duplicate or specialize those resources in this discovery adapter.

Repository-specific authority, content, branding, and validation rules remain outside the generic
package and apply in addition to it: AGENTS.md, "Documentation site". This repository's host is
`documentation`; reader revisions are served with
`node slate/scripts/serve-revisions.mjs --repo . --host documentation --port 8765` and handled with
`node slate/scripts/revisions.mjs list|show|check|archive --repo . --host documentation`.
