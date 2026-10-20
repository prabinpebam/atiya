# Edit mode: AI editing and comments (proposal)

A proposal for editing articles with AI in edit mode's article editor: rewriting or retyping one block, starting an article from an empty page, rewriting a whole article, and leaving comments that the AI then works through. It offers options for each part, with pros and cons, and a recommendation, for the owner to review; nothing here is built yet. Which AI services it can use, and how, is in [AI services](ai-services.md); going back to older versions is in [Timeline](timeline.md); what other products do, with sources, is in [AI and history: research](ai-research.md).

> **TL;DR.**
> - **One pipeline for every AI feature.** You point at something (a block, a section, the article, an empty page, the open comments) and say what you want. Edit mode sends one kind of *edit request*, gets proposed changes back as JSON, checks them against the content contract, and shows them for review. Nothing changes until you accept, and accepting is one undo step with a version kept just before.
> - **Blocks need a stable name first.** Today a block is "the fourth block": an AI answer, a comment or a diff can't follow it once anything moves. The first piece of work is an optional `key` on every block (recommended over hashing or a side map).
> - **Per block: a prompt under the block, a diff in place.** Ask AI on the block's toolbar opens a prompt with quick actions; the answer shows as a tracked change (old struck, new inserted), with Keep, Try again and Discard. Changing a block's type is an explicit choice ("Turn into a table, adapting the words"), as every product researched does it.
> - **From an empty page: outline first, with a shortcut to a draft.** A short interview, an outline you can edit, then the draft. AI never invents pictures: where one belongs, it leaves a comment saying what to add.
> - **A whole rewrite is reviewed change by change,** with Accept all. No product researched does this for AI; Word's Track Changes comes closest, and it's what makes a long rewrite safe to take in part.
> - **Comments are anchored to blocks, sections, the page header or the article,** listed in a new Comments tab, and kept in the private repository (the public one is world-readable). Each can be fixed on its own; the sticky footer works through all open ones. Every comment gets an outcome (Addressed, Partly, Needs you), which no product researched offers. Fixing never resolves a comment by itself.
> - **Private pages stay local by default:** a private article is sent only to a provider on this computer (Ollama, LM Studio) unless you allow a cloud one for it.

<figure class="slate-figure" data-diagram="ai-flow">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 470" role="img" aria-labelledby="ed-ai-flow__title ed-ai-flow__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-ai-flow__title">AI editing: one edit request for every feature</title>
<desc id="ed-ai-flow__desc">Every AI feature starts from a scope: a block, a section, the whole article, an empty page, or the open comments. Edit mode turns it into one edit request: the instruction, the context and the changes allowed. A provider answers with proposed changes as JSON, never with files. Edit mode checks them against the content contract and the store; a refused answer is retried once with the reasons. You review the proposal as one diff, accept or reject each change, and accepting applies it as one undo step, with a version kept just before.</desc>
<g id="ed-ai-flow__scope" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-1" x="40" y="40" width="200" height="140" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-1" data-slate-fit-padding="16">Scope</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-flow__body-1" data-slate-fit-padding="16">what you point at</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-1" data-slate-fit-padding="16">A block, a section</text>
<text x="60" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-1" data-slate-fit-padding="16">The article, comments</text>
</g>
<g id="ed-ai-flow__request" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-2" x="290" y="40" width="200" height="140" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="310" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-2" data-slate-fit-padding="16">Edit request</text>
<text x="310" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-flow__body-2" data-slate-fit-padding="16">one contract for all</text>
<text x="310" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-2" data-slate-fit-padding="16">Instruction, context</text>
<text x="310" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-2" data-slate-fit-padding="16">Changes allowed</text>
</g>
<g id="ed-ai-flow__provider" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-3" x="540" y="40" width="200" height="140" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="560" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">Provider</text>
<text x="560" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">any connected service</text>
<text x="560" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">Answers with changes</text>
<text x="560" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">as JSON, never files</text>
</g>
<g id="ed-ai-flow__check" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-4" x="790" y="40" width="180" height="140" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="810" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-4" data-slate-fit-padding="16">Check</text>
<text x="810" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-ai-flow__body-4" data-slate-fit-padding="16">contract and store</text>
<text x="810" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-4" data-slate-fit-padding="16">Valid blocks only</text>
<text x="810" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-flow__body-4" data-slate-fit-padding="16">Real media only</text>
</g>
<g id="ed-ai-flow__review" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-5" x="540" y="290" width="240" height="90" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="560" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-5" data-slate-fit-padding="16">Review</text>
<text x="560" y="346" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-flow__body-5" data-slate-fit-padding="16">one diff, each change kept or not</text>
</g>
<g id="ed-ai-flow__apply" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-flow__body-6" x="240" y="290" width="250" height="90" rx="16" fill="var(--color-brand-bg)" />
<text x="260" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-6" data-slate-fit-padding="16">Apply</text>
<text x="260" y="346" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-ai-flow__body-6" data-slate-fit-padding="16">one undo step, a version before</text>
</g>
<text x="246" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">ask</text>
<text x="496" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">send</text>
<text x="744" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">reply</text>
<text x="700" y="226" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">refused: asked again once, with why</text>
<text x="890" y="262" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">valid</text>
<text x="496" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">accept</text>
<text x="40" y="430" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Nothing reaches the article before you accept it. Accepting saves through the store, like any edit.</text>
<g id="ed-ai-flow__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M240 110 L280 110" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="289,110 280,115 280,105" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-flow__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M490 110 L530 110" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="539,110 530,115 530,105" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-flow__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M740 110 L780 110" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="789,110 780,115 780,105" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-flow__flow-4" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M820 180 L820 205 L700 205 L700 190" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="700,181 705,190 695,190" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-flow__flow-5" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M930 180 L930 335 L790 335" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="781,335 790,340 790,330" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-flow__flow-6" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M540 335 L500 335" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="491,335 500,340 500,330" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Every AI feature is the same edit request: scoped, checked, reviewed, then applied as one step.</figcaption>
</figure>

## 1. What's asked for

| ID | As the owner, I can… | Where | Section |
|---|---|---|---|
| U1 | Ask AI to change one block's words | The block's toolbar | §4 |
| U2 | Ask AI to change a block's type and adapt its content | The same prompt, and Turn into | §4.3 |
| U3 | Start a new article from an empty page | The New article dialog, an empty canvas | §5 |
| U4 | Rewrite the whole article: words and block types | The article's AI menu | §6 |
| U5 | Leave several comments on a block, a section, a heading, the page header | The canvas and the outline | §7 |
| U6 | See and manage every comment in a Comments tab | The inspector's third tab | §7.3 |
| U7 | Have AI address every open comment from a sticky footer button | The Comments tab's footer | §7.4 |
| U8 | Go back to, or copy from, an older version | The timeline | [Timeline](timeline.md) |
| U9 | Choose the AI service | Settings | [AI services](ai-services.md) |

## 2. The edit request: one contract under every feature

Every feature above is the same exchange with a different scope. Building it once keeps them consistent (the research's lesson from Apple's Writing Tools, which behave differently per app) and lets every provider plug in the same way.

**The request** (what edit mode sends):

```json
{
  "scope": { "kind": "block", "key": "k7f2qa" },
  "instruction": "Shorter, and lead with the result",
  "article": { "title": "…", "kind": "note", "blocks": [ … ] },
  "style": "the site's house style, from the article-writing guidance",
  "allowed": ["replace", "retype"],
  "comments": [ ]
}
```

- **`scope.kind`** is `block`, `section` (a heading and what follows it up to the next heading of the same or a higher level), `article`, `empty` or `comments`.
- **`allowed`** says what the answer may do: `replace` a block's content, `retype` it, `insert` and `remove` blocks, `move` them, and change the `title` or `summary`. A block prompt allows only its block; a whole rewrite allows everything.
- **The whole article goes as context** even for one block, so a rewrite fits what's around it; a long article's other blocks can be cut to their first lines to save cost.

**The answer** (what the provider returns, as JSON):

```json
{
  "changes": [
    { "op": "replace", "key": "k7f2qa", "block": { "type": "text", "text": "…" } }
  ],
  "comments": [ { "on": "k9xx01", "outcome": "addressed", "note": "Cut the second example" } ],
  "summary": "Shortened the intro to two sentences."
}
```

**The check.** The answer is parsed with the same Zod schemas the content contract uses ([schema.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts)), then the changed article goes through the store's check, exactly as a save does ([store.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/server/store.ts)). So an answer can't add a block type the site doesn't have, a picture that doesn't exist, a link to a page that isn't there, or anything outside `allowed`. A refused answer is sent back once with the reasons; refused again, you see what went wrong and nothing changes.

**What AI can never change:** a page's access, status, section, slug, ID or dates, its pictures' files, or any other article. Those stay your actions.

## 3. Blocks need a stable name

Today a block is known by its place: `body.3`. That's fine while one person edits, but everything here needs to follow a block as others move: a proposal made while you kept typing, a comment on a paragraph that you then move, a diff between two versions where a block was inserted above.

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. A `key` on every block** (recommended) | An optional short random string (`"key": "k7f2qa"`), given by edit mode when a block is made, and to existing blocks by a one-off migration | Exact and cheap. Survives moves, edits and retyping. Diffs, comments and AI answers all use it. The built site ignores it | A schema change (every block type gains an optional field); every article file changes once; hand-written blocks need one (edit mode adds it on the next save) |
| B. Find blocks by content | Match blocks between versions by their type and a similarity score | No schema change | Guesswork: two similar paragraphs, or a heavily rewritten one, are matched wrong. Comments can jump to the wrong block |
| C. A side map | A file beside each article listing each block's key by position | No change to the article's shape | Two files to keep in step on every edit, and any outside edit (an agent, a text editor) breaks the map silently |

The key is written to the article's JSON, so outside tools (and agents through [MCP](ai-services.md)) see the same names. The build leaves it out of the page, and `build-parity` keeps the published site unchanged.

## 4. One block: rewrite or retype (U1, U2)

### 4.1 Where you ask

- **Ask AI** on the selected block's toolbar (beside move, duplicate and delete), with a sparkle icon from the site's icon set.
- **A shortcut** to open it on the selected block. Ctrl+J is the browser's downloads and Ctrl+I is italic; Ctrl+Shift+Space is the candidate, to check against the browser and Atiya Studio.
- **Turn into** (the existing dialog) gains "Adapt with AI" where the change can't be made by moving words across, for example a paragraph into a table or a list into a collection.

### 4.2 How the answer shows

| Option | What you see | Pros | Cons | Seen in |
|---|---|---|---|---|
| **A. Prompt under the block, tracked change in place** (recommended) | A small prompt opens under the block, with quick actions (Shorter, Longer, Fix grammar, Simpler, Make a list, Make a table). The answer replaces the block on the canvas as a tracked change: removed words struck, new ones marked. Keep, Try again, Discard | The change is where your eyes are, in the page's real typography. Word-level diff shows exactly what moved. Quick to undo | A retyped block (paragraph to table) can't be shown word by word: it shows before and after one above the other instead | Cursor's Cmd+K, VS Code's inline chat, Word's Track Changes |
| B. Prompt in the inspector | An AI section in the Block tab; the answer previews on the canvas | Room for longer prompts and a history of tries; nothing covers the canvas | Your eyes go back and forth between the panel and the block | Google Docs' Gemini panel, Sanity's AI Assist |
| C. Replace, then decide | The block is rewritten at once; Keep or Discard | The simplest to build | No view of what changed, so you'd have to read it all again or trust it (the halo effect NN/g warns about) | Notion AI |

**While it writes**, the answer streams into the block, and Stop gives you Keep what's there or Try again (Jetpack AI's pattern), rather than losing it. A retyped block comes whole (a half table isn't a table), with a progress line instead.

**Try again** keeps the tries: arrows step through them (1 of 3), like Word's Regenerate and ChatGPT's versions, so a worse second try never loses the first.

### 4.3 Changing a block's type

Every product researched keeps a change of type separate from rewriting (Google Docs' prompt to a table, Jetpack's "Turn list into a table", Word's "Transform content"). So the prompt says what it will do before it does it: "Turn into a table, adapting the words" appears as a choice when you ask for one, and in Turn into. The answer may only use the site's block types (§2), and a picture-based block (a figure, a gallery, a carousel) is offered only when the pictures already exist in the article or the library.

## 5. Starting from an empty page (U3)

| Option | How | Pros | Cons | Seen in |
|---|---|---|---|---|
| A. One prompt, one draft | Describe it; a whole draft appears | The fastest | Hard to steer; long drafts drift from what you meant; you edit a lot afterwards | Notion, Google Docs' Help me create, Word's Draft with Copilot |
| **B. Outline first** (recommended, with A as "Skip to draft") | A short interview (who it's for, the point, what you have: notes, links, a talk), then an outline of headings with one line each that you edit, reorder or cut, then the draft section by section | You decide the shape before any words; each section can be redone alone; matches how case studies are written | One more step | Gamma's Plan mode (Express mode is its one-shot) |
| C. From your material | Paste notes, a transcript or an old document; AI shapes it into the site's blocks, keeping your words where it can | Your voice, not the model's | Needs the material first | Word's grounding files, Google Docs' Drive content |

Recommended: **B, with C's material as part of the interview** and A as a button. Where it starts:

- **The New article dialog** gets "Start with AI" beside the blank page.
- **An empty article's canvas** shows the prompt in place of the first block, so an article made blank can still start this way.
- **The draft lands as a draft** (status Draft), saved like any edit: nothing is published.
- **Pictures:** AI can't add one (a figure needs a real picture). Where one belongs, it leaves a comment (§7) on the spot: "A photo of the first prototype here". You add pictures by hand, as you do now.
- **House style:** the request carries the site's writing guidance (the article-writing skill's rules: plain words, short sentences, contribution first for case studies), so a draft reads like the rest of the site.

## 6. Rewriting the whole article (U4)

| Option | How | Pros | Cons | Seen in |
|---|---|---|---|---|
| A. Replace all, restore if needed | The article is rewritten; the timeline has the old one | Simple | All or nothing: liking 90% means re-merging by hand (the research's warning about Notion and Canvas) | ChatGPT Canvas, Notion |
| **B. Review change by change** (recommended) | A review list beside the canvas: each block kept, changed, retyped, added, removed or moved, with its diff. Accept or reject each; Accept all; Discard | Take the good parts, leave the rest. The same review as one block and as comments | More to build: the review component (§8) | Word's Track Changes with Copilot |
| C. A copy to compare | AI writes into a copy; you compare them side by side and bring parts across | Your article is untouched until you merge | Two articles to keep in step, and merging by hand is slow | Branching in code review |

Recommended: **B**, with a version kept before it applies (so A's safety is there too). A whole rewrite asks first what kind: Tighten (same structure, fewer words), Restructure (headings and order may change), Change the tone, or your own words.

## 7. Comments (U5, U6, U7)

### 7.1 What a comment is on

- **A block:** a paragraph, a figure, a table.
- **A section:** a heading and everything under it to the next heading of the same or a higher level (a comment on a heading's "section" button, or on the heading itself, which asks which).
- **The page header:** the title, the summary, the lead picture.
- **The article:** general notes.
- **Words in a block**, optionally: select the words and comment; the comment keeps the quoted text, so it can say when the words are gone.

Several comments can sit on the same thing, each with replies.

**When the anchor goes:** a comment on a removed block, or on words that are gone, is marked *Outdated* and kept, showing what it was on, and can be re-pinned or resolved; it's never deleted or moved silently (GitHub's model for review comments, the safest in the research; Figma's "disconnected but kept" is the same idea).

### 7.2 Where comments are kept

| Option | Where | Pros | Cons |
|---|---|---|---|
| A. In the article | A `comments` list in the article's JSON | Travels with the article; one file | The public repository is world-readable: notes like "this paragraph is weak" would be published on GitHub. A schema change the build must strip |
| **B. Beside it, in the private repository** (recommended) | `private-pages/comments/<article-id>.json`, for every article, public or private | Private by default; versioned with the article, since the private repository's commits are the [timeline](timeline.md); never part of the build | Needs the private repository, which every site will have ([Drafts and publishing](drafts-and-publishing.md)); until then, falls back to C |
| C. On this computer only | A gitignored folder or Studio's app data | Nothing leaves the machine | Lost with the machine; not in the timeline; not on another computer |

Recommended: **B, falling back to C** until the site has its private repository. The comments of a private article are already in that repository's privacy; a public article's comments stay out of the public one.

### 7.3 The Comments tab

The inspector gets a third tab beside Block and Page: **Comments**, with the open count.

- **The list** follows the article's order, grouped by what each is on (its icon and first words); choosing one selects its block on the canvas and scrolls to it.
- **A filter:** Open, Resolved, Outdated, All. Resolved comments stay (Word and Notion keep them: recoverable, not deleted).
- **Each comment:** its words, when, Reply, Resolve, and **Fix with AI** (this comment alone).
- **On the canvas,** a block with comments shows a small count in its margin; the outline shows the same count on its row.
- **Adding:** Comment on the block's toolbar, on a text selection's format bar, and in the tab (on the selected block, its section, the header or the article).
- **AI's comments** (pictures to add, a review you asked for) are marked as AI's with their own author and icon, never under your name (Word Copilot's posting as the user is the research's anti-pattern).

### 7.4 "Update article as per comments"

The tab's sticky footer holds the button, with the count: **Address 5 comments**. (The copy rules want a verb and three words or fewer; "Update article as per comments" is your wording, so it's a decision in §11.)

1. **Choose which:** all open comments are ticked; untick any to leave out.
2. **One request** carries them (scope `comments`), each with its anchor's key.
3. **The review** (§8) shows the changes, and each comment shows its outcome: **Addressed**, **Partly** (with what's left), or **Needs you** (a question back, posted as AI's reply). No product researched gives a per-comment outcome; the structured answer makes it cheap here.
4. **Fixing isn't resolving:** after you accept, "Resolve 4 addressed" is one click, never automatic (GitHub's and CodeRabbit's default; Word's auto-resolve is the risky one). A setting can make it automatic later.

Every mature tool offers both a single fix and a batch (GitHub's Fix with Copilot and Add to batch; CodeRabbit's reply in a thread or in the conversation), told apart by where you press. Here: Fix with AI on a comment, the footer for all.

## 8. Review: one component for every proposal

One review shows every AI proposal: one block, a whole rewrite, comments, and (in the [timeline](timeline.md)) the difference between two versions.

- **Each change** is a row: what it is (Changed, Retyped from Paragraph to Table, Added, Removed, Moved), its diff (words struck and inserted for text; before and after for anything else), Accept and Reject.
- **Unchanged blocks** fold away; Accept all, Reject all.
- **On the canvas**, the proposed article is drawn with the changes marked, so you read it as the page will be.
- **Keyboard:** next and previous change, accept, reject (named in the help popover, never spelled out in the panel). A screen reader hears "6 changes proposed", and each row is a labelled group.
- **Applying** is one step in undo ("AI: shortened the intro"), and a version is kept just before it (see [Timeline §3](timeline.md#3-when-a-version-is-kept)).
- **If you edited meanwhile:** changes are matched by key. Ones to blocks you didn't touch apply; ones to a block you changed show both, and you choose.

**Marking AI's words.** Three levels, a decision for you:

| Option | What | Pros | Cons |
|---|---|---|---|
| None | Nothing marks them after accepting | Simple; it's your article | You can't see later what you never read closely |
| **In edit mode only** (recommended) | Accepted AI words are tinted until you edit them (iA Writer's grey-until-revised) and the version's message says "AI-assisted" | You see what you haven't made yours; readers see nothing | A small marker per block to keep (`edited by AI` in the comments file, not the article) |
| On the site | A note on the published page | Open with readers | Not asked for; the article is yours either way |

## 9. Safety and privacy

- **What's sent, said up front:** the prompt shows which service will see it ("Sends this article to Claude"). Changing service is one click.
- **Private pages:** a private article is sent only to a provider on this computer (Ollama, LM Studio) unless you allow a cloud provider for it, once per article. The private repository's comments follow the same rule.
- **Prompt injection:** the article and comments go as data, clearly marked, never as instructions. The model gets no tools and no files: it can only return a proposal, and §2's check limits what a proposal can do. So a hostile sentence pasted into an article can, at worst, make a bad proposal you reject.
- **Keys** never go in `content/`, a log or the browser: see [AI services §6](ai-services.md#6-keys-privacy-and-cost).
- **Cost:** a whole-article request shows its size first ("about 9,000 words to send"), and a running request can always be stopped.

## 10. Phases

| Phase | What | Needs |
|---|---|---|
| 1 | Block keys, the edit request, the check, the review component, one provider | §3, §2, §8, one adapter |
| 2 | Ask AI on a block, Turn into with AI | 1 |
| 3 | Comments: anchors, storage, the Comments tab, Fix with AI | 1 |
| 4 | Address all comments, whole rewrite | 2, 3 |
| 5 | Start from an empty page | 2 |
| 6 | More providers, edit mode as an MCP server | [AI services §5](ai-services.md#5-recommendation-and-phases) |

Each phase ends with its unit tests (the edit request's check, anchors, outcomes, the diff) and an editor E2E against a stand-in provider: tests never call a real AI service.

## 11. Decisions for you

1. **Block keys** (§3): A, a `key` on every block, with a one-off migration?
2. **Per-block answer** (§4.2): A, a tracked change in place?
3. **Empty page** (§5): outline first, with Skip to draft?
4. **Whole rewrite** (§6): reviewed change by change?
5. **Where comments live** (§7.2): the private repository, falling back to this computer?
6. **The footer's label** (§7.4): "Address 5 comments", or your "Update article as per comments"?
7. **Resolving** (§7.4): one click after accepting, or automatic?
8. **Marking AI's words** (§8): in edit mode only?
9. **Private pages** (§9): local providers only, unless allowed per article?
10. **The shortcut** (§4.1): Ctrl+Shift+Space?
