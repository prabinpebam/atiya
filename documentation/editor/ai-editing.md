# Edit mode: AI editing and comments (spec)

How AI helps you write and revise articles in edit mode, and how comments work, with or without AI. Where the AI comes from (keys, local models, your own agent) is [AI services](ai-services.md); the research behind both is [AI research](ai-research.md).

> **TL;DR.**
> - **One pipeline for every AI feature.** You point at something (a block, a section, the article, an empty page, the open comments) and say what you want. Edit mode sends one *edit request*. The connector decides whether it can be done here, a service writes proposed changes as JSON, and they're checked against the content contract and shown for review. Nothing changes until you accept. Accepting is one undo step, with a version kept before and after.
> - **Blocks get a stable name first.** An optional `key` on every block, added by a one-off migration, lets proposals, comments and diffs follow a block as it moves. The site never shows it.
> - **Per block, a prompt under the block and a tracked change in place,** with Keep, Try again and Discard. **From an empty page,** a short interview, then an outline you edit, then the draft. **A whole rewrite** is reviewed change by change, with Accept all.
> - **Honest about what it can't do.** A request that needs the web ("add the latest numbers") is named as such, with a way to hand it to your own agent. AI never invents pictures; where one belongs, it leaves a comment.
> - **Comments** sit on blocks, sections, words, the page header or the article. They're kept in the private repository and listed in a Comments tab. "Address 5 comments" works through them and reports an outcome for each. Fixing a comment never resolves it by itself.
> - **Privacy fits a personal site.** Private pages keep people from browsing everything; they aren't secrets. So any service you've set up may receive them once you've accepted its disclaimer, and each service can be told not to. Grants, codes and reader agreements are never sent.
> - **Status:** specified, not built. Phases and their Definitions of Done are in §15.

<figure class="slate-figure" data-diagram="ai-flow">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 470" role="img" aria-labelledby="ed-ai-flow__title ed-ai-flow__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-ai-flow__title">AI editing: one edit request for every feature</title>
<desc id="ed-ai-flow__desc">Every AI feature starts from a scope: a block, a section, the whole article, an empty page, or the open comments. Edit mode turns it into one edit request: the instruction, the context and the changes allowed. The AI connector first decides, by rules or with Jev, whether it can be done here (a request that needs research goes to your agent instead), then the chosen service, or your own agent, answers with proposed changes as JSON, never with files. Edit mode checks them against the content contract and the store; a refused answer is retried once with the reasons. You review the proposal as one diff, accept or reject each change, and accepting applies it as one undo step, with a version kept just before.</desc>
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
<text x="560" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">Connector or agent</text>
<text x="560" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-flow__body-3" data-slate-fit-padding="16">decides, then writes</text>
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
<figcaption>Every AI feature is the same edit request: decided, written, checked and reviewed, then applied as one step.</figcaption>
</figure>

## 1. Promises, jobs and what you can do

### 1.1 Promises

| ID | Promise | Held by |
|---|---|---|
| P1 | **Nothing changes until you accept it.** Every proposal is reviewed. Applying it is one undo step, with a version kept before and after | §8, the [timeline](timeline.md#3-when-a-version-is-kept) |
| P2 | **It fits the site.** An answer can use only the site's blocks, pictures and pages, in the house style. Anything else is refused before you see it | §2's check |
| P3 | **It says what it can't do.** A request that needs the web, a picture or a setting is named as such, with a way forward. It's never faked | §10 |
| P4 | **Your notes are kept.** A comment is never deleted or moved without you, and fixing never resolves it | §7 |
| P5 | **You know who sees your words.** Every prompt names the service it sends to. Private pages go only where you've allowed them | §9 |

### 1.2 Jobs

| When I… | I want to… | So I can… |
|---|---|---|
| see a paragraph that says the right thing badly | have it rewritten in place, seeing exactly what changed | keep my voice and still move fast |
| have content that reads better as another kind of block | turn it into that block with the words adapted | skip retyping it |
| start an article with only notes, links or a talk | be asked a few questions, then get an outline and a draft | not face a blank page |
| feel a whole article is too long or loose | get a rewrite I can take in part | keep the parts I already like |
| read a draft and spot things to fix | leave comments where they apply | come back to them, alone or with AI |
| have left many comments | have AI work through them and say what it did for each | see what still needs me |
| ask for something that needs new facts | be told so, and pass it to an agent that can search | get real numbers, not invented ones |
| have my own agent (Claude Code, Codex, Hermes Agent) work on an article | review its changes in the editor like any other | never have an article changed behind my back |

### 1.3 What you can do

| ID | As the owner, I can… | Where | Section |
|---|---|---|---|
| U1 | Ask AI to change one block's words | The block's toolbar, a shortcut, a text selection | §4 |
| U2 | Ask AI to change a block's type and adapt its content | The same prompt, and Turn into | §4.3 |
| U3 | Start a new article from an empty page | The New article dialog, an empty canvas | §5 |
| U4 | Rewrite the whole article: words and block types | The article's AI menu | §6 |
| U5 | Leave comments on a block, a section, words, the page header or the article | The canvas, the outline, the Comments tab | §7 |
| U6 | See and manage every comment | The inspector's Comments tab | §7.3 |
| U7 | Have AI address open comments, and see an outcome for each | The Comments tab's footer, or one comment's Fix with AI | §7.5 |
| U8 | Go back to, or copy from, an older version | The timeline | [Timeline](timeline.md) |
| U9 | Choose and set up the AI service | The AI screen | [AI services](ai-services.md) |
| U10 | Ask AI about a whole section | A heading's toolbar | §4.1 |
| U11 | Have AI review my article and leave comments, changing nothing | The article's AI menu | §6 |
| U12 | Be told when a request needs research, and hand it to my agent | The prompt | §10.1 |
| U13 | Review changes my own agent proposed | A banner in the article editor, the AI screen | §8.5 |
| U14 | Stop a request and keep what it's written so far | The prompt, Esc | §4.2 |
| U15 | Step through earlier tries | The prompt's result bar | §4.2 |
| U16 | See which blocks AI wrote that I haven't edited since | The canvas, in edit mode only | §8.6 |

## 2. The edit request: one contract under every feature

Every feature is the same exchange with a different scope. Building it once keeps the features consistent. The research's lesson from Apple's Writing Tools, which behave differently in each app, is to avoid that. It also lets every service, and every agent, plug in the same way. The parts below are the contract. Their exact schema lives in the code, beside the content contract ([schema.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts)), not in this page.

### 2.1 The request

| Part | What it holds |
|---|---|
| Scope | Its kind: `block`, `section`, `article`, `empty` or `comments`. For a block or a section, the block's key. For comments, the chosen comments |
| Instruction | Your words, or a quick action's own wording |
| Article | Its title, summary and kind, and every block with its key. Blocks outside the scope go whole while the request fits in half the model's context. Past that, they're cut to their first sentence |
| Allowed | The operations the answer may use (§2.3) |
| Block types | The types that fit this request, after Decide (§2.4) |
| Pictures | The pictures already in the article, by ID and alt text, so a retype can reuse them. Never the picture files |
| Links | The IDs and titles of the site's published pages, so a link it adds points somewhere real |
| Comments | For the `comments` scope: each comment's ID, what it's on, any quoted words, and its thread |
| Style | The house style: plain words, short sentences, contribution first in a case study. It's a short text kept with the connector, from the [article-writing skill](https://github.com/prabinpebam/atiya/blob/main/.github/skills/article-writing/SKILL.md) |

The article and the comments are marked as material to work on, never as instructions (§9).

### 2.2 The answer

| Part | What it holds |
|---|---|
| Changes | A list. Each has an operation, the block's key, the whole new block (valid against the block's schema) and, for an insert or a move, the key it goes after |
| Outcomes | For the `comments` scope, one per comment: **Addressed**, **Partly** or **Needs you**, with a one-line note |
| New comments | Comments AI leaves on a key: a picture to add, or a point from Review my article. They're posted as AI's (§7.2) |
| Summary | One line, used as the undo step's name and the version's message ("Shortened the intro") |
| Needs | `none`, or why it couldn't do it: `research` (needs facts it doesn't have), `outside` (asks for something AI can't change), or `unclear` (a question back), with one sentence |

### 2.3 Scopes and what each may change

| Operation | Does | Block | Section | Article | Empty page | Comments |
|---|---|---|---|---|---|---|
| Replace | Changes a block's content, same type | Yes | Yes | Yes | No | On the comments' blocks |
| Retype | Turns a block into another type | When asked (§4.3) | Yes | Yes | No | On the comments' blocks |
| Insert | Adds a block after a key | No | Inside the section | Yes | Yes | Yes |
| Remove | Removes a block | No | Inside the section | Yes | No | On the comments' blocks |
| Move | Moves a block after another | No | Inside the section | Yes | No | Yes |
| Title, summary | Changes the article's title or summary | No | No | Yes | Yes | When a comment is on the page header |

A section is a heading and every block after it, up to the next heading of the same or a higher level.

### 2.4 Decide, write, check

1. **Decide.** Can it be done here at all, and which block types fit? Rules in code answer by default. Jev answers when it's on. The questions, the rules and the thresholds are in [AI services §9](ai-services.md#9-the-connector-decide-write-check). A request that needs research stops here, before anything is sent to a writer (§10.1).
2. **Write.** The chosen service writes the answer, held to the answer's schema where the service supports one. A block's text streams as it comes. Everything else arrives whole.
3. **Check.** The answer is parsed with the content contract's schemas. Then the changed article goes through the store's check, exactly as a save does ([store.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/server/store.ts)). That covers every reference, no private picture on a public page, unique heading anchors and every V rule. Then come the scope rules: every operation allowed, and every key in scope.

A refused answer is sent back once with the reasons. Refused again, you see the first reason and nothing changes. So an answer can't add a block type the site doesn't have, a picture that doesn't exist, a link to a page that isn't there, or a change outside its scope.

**What AI can never change:** a page's access, status, section, slug, ID or dates, a picture's file or its sidecar, another article, comments' state (only you resolve), the site's settings or structure. Those stay your actions. An instruction that asks for one gets `outside` (§10.2).

## 3. Blocks need a stable name

Today a block is known by its place, `body.3`. That's fine while one person edits. But every feature here must follow a block as others move: a proposal made while you kept typing, a comment on a paragraph you then move, a diff between two versions with a block inserted above.

**Decided: a `key` on every block.**

- **The field.** Every block type gains an optional `key`: six lowercase letters and digits, random, unique within its article. It isn't a heading's `id` (the anchor readers see in links), and the site never renders it.
- **When a block gets one.** Edit mode gives every new block a key: inserted, pasted, made from the palette, or added by AI. Turn into keeps the key, since it's the same block. Duplicate and paste give the copy a new one. Saving fills in any missing key, so a block written by hand or by an agent gets one on its next save.
- **The migration.** A one-off script adds keys to every article, public and private, and changes nothing else. Run twice, it changes nothing. It's committed on its own in each repository.
- **The check.** The loader refuses two blocks with the same key in one article. Edit mode repairs a duplicate before saving, by giving the later block a new key.
- **The site.** The renderer ignores the key, so `build-parity` holds and the published pages are byte for byte the same.
- **Who uses it.** Proposals, comments, AI's marks and the timeline's diff find blocks by key. The editor's forms keep their position-based names.

Rejected: matching blocks by content (guesswork: two similar paragraphs, or a heavily rewritten one, are matched wrong) and a side map of keys beside each article (two files to keep in step, broken silently by any outside edit).

## 4. One block: rewrite or retype (U1, U2)

### 4.1 Where you ask

- **Ask AI** on the selected block's toolbar, after Turn into, with the sparkles icon. On a heading it reads **Ask about section** (U10) and scopes to the heading's section.
- **Ctrl+Shift+Space** opens it on the selected block. Ctrl+J is the browser's downloads and Ctrl+I is italic. Before it ships, the key is checked against the browser, Atiya Studio and edit mode's own keys (§11.1).
- **With words selected,** the format bar gains Ask AI. The scope is still the block, and the instruction names the selected words.
- **Turn into** gains **Adapt with AI** where the change can't be made by moving words across: a paragraph into a table, or a list into a collection (§4.3).

### 4.2 Task flow

1. You select a block and choose Ask AI. A prompt opens under the block, with its field focused.
2. You type an instruction and press Enter, or choose a quick action: **Make shorter**, **Make longer**, **Simplify**, **Fix spelling**, **Make a list** or **Make a table**.
3. **Decide** runs, in under a second. If the request needs research, is outside what AI can change, or is unclear, the prompt says so and offers the way forward (§10). Nothing is written.
4. **Write.** The new text streams into the block as a tracked change: removed words struck, new ones marked. The prompt shows "Writing with OpenAI" and **Stop**.
5. **Check.** If the check refuses the answer, the request is retried once. If the second answer is refused too, you see why.
6. **The result bar** replaces the prompt: **Keep** (Enter), **Try again**, **Discard**, the tries ("1 of 3", with arrows), and a field to ask for more ("Make it warmer").
7. **Keep** applies it: one save, one undo step named with the summary, and a version kept before and after. **Discard** puts the block back as it was. Asking for more starts a new try from the one shown.

- **Stop** keeps what's been written as a try, and offers Keep or Try again. It's never lost. A retyped block can't be half-made, so stopping one keeps nothing.
- **Tries** are kept until you keep one or discard them all. Stepping between them redraws the tracked change. A worse second try never loses the first.
- **Esc** closes the prompt. A finished proposal stays: the block keeps a small "AI proposal" tag, and choosing it brings back the result bar.
- **One request per article** runs at a time. While one runs, Ask AI elsewhere in the article is disabled, and its tooltip says "AI is working on this article."

### 4.3 Changing a block's type

Every product researched keeps a change of type apart from a rewrite. Here the prompt says what it'll do before doing it.

- **Asking for a table, a list, a quote and so on** offers the change as the first choice: "Turn into a table, adapting the words."
- **Turn into's Adapt with AI** asks no question: it sends the target type as the instruction.
- **The types offered** are only the site's, after Decide filters them (§2.4). A picture block (figure, gallery, carousel) is offered only when the pictures it needs are already in the article. A gallery or a carousel needs at least two.
- **The answer** arrives whole, with a progress line instead of streaming. It's shown as before and after, one above the other, because a table can't be diffed word by word against a paragraph.

### 4.4 The prompt's anatomy

| Part | What it is | Copy |
|---|---|---|
| Field | One line that grows to four, with the placeholder | "Tell AI what to change" |
| Quick actions | A row of buttons, shown while the field is empty | Make shorter, Make longer, Simplify, Fix spelling, Make a list, Make a table |
| Service line | The service and model it'll send to, with a link to the AI screen. For a private page, it adds the page's state | "Sends this article to {service}, {model}" / "Private page: sends it to {service}" |
| Send | A primary icon button | Name: "Send" |
| Status | The current step, then the elapsed time after 3 seconds | "Deciding…", "Writing with OpenAI… 12 s", "Checking…" |
| Stop | Shown while writing | "Stop" |
| Result bar | Replaces the field once there's an answer | Keep, Try again, Discard, "1 of 3", "Ask for more" |
| Note | A refusal, an error or a needs route, in place of the result bar | §10 |

### 4.5 States

| State | What you see | What you can do |
|---|---|---|
| No service | The prompt with "Set up an AI service to use this" and **Set up AI** | Open the AI screen |
| Ready | Field, quick actions, service line | Type, choose, send, close |
| Deciding | "Deciding…" (shown only past 300 ms) | Stop |
| Writing | Tracked change growing; status with time | Stop |
| Checking | "Checking…" | Wait (under a second) |
| Proposed | Tracked change; result bar | Keep, Try again, Discard, step tries, ask for more |
| Needs | A note naming why (§10) | Its choices |
| Failed | A note saying what happened and what to do (§10.4) | Try again, Set up AI |

## 5. Starting from an empty page (U3)

**Decided: outline first,** with your own material as part of the interview, and **Skip to draft** for when you'd rather have the whole thing at once.

### 5.1 Task flow

1. **Start.** The New article dialog offers two choices: **Blank page** and **Start with AI**. An article made blank still offers **Start with AI** on its empty canvas, in place of the first block.
2. **The interview** opens on the canvas, as one panel with three fields:
   - "What's it about?" (required)
   - "Who is it for?"
   - "What do you have?", where you paste notes, links or a transcript.

   The article's kind is the one chosen in the dialog. Buttons: **Make an outline**, and **Skip to draft**.
3. **The outline** comes back as headings, each with one line saying what it covers. You edit any line, reorder (drag, or Alt+Up and Alt+Down), delete, or add one. **Try again** makes a new outline. **Write the draft** goes on.
4. **The draft** is written one section at a time, each streaming into place under its heading. The status says "Writing section 2 of 5." **Stop** keeps the sections already written.
5. **The review** (§8) shows the draft as a proposal: every block an insert, a title and a summary. **Accept all** applies it. The article stays a Draft, so nothing is published.

### 5.2 Rules

- **Pictures.** AI can't add one, because a figure needs a real picture. Where one belongs, it leaves an AI comment on the spot: "A photo of the first prototype here." You add pictures by hand, as now.
- **Your words first.** With material pasted, the draft keeps your sentences where it can and says so in its summary.
- **The interview's answers** are kept with the proposal, so a reload or Try again doesn't ask again. They're deleted when the proposal is applied or discarded.
- **Scope.** An empty-page request may only insert blocks and set the title and summary (§2.3).

## 6. Rewriting the whole article (U4, U11)

**Decided: reviewed change by change,** with a version kept before and after, so "replace all, restore if needed" is still there through the [timeline](timeline.md).

### 6.1 The AI menu

The article editor's header gets an **AI** button with the sparkles icon in its `tools` slot. In Atiya Studio it appears in the app's title bar, like every tool. It opens a menu:

| Item | Does | Scope and allowed |
|---|---|---|
| **Tighten** | Same structure, fewer words | Article; replace only |
| **Restructure** | Headings, order and block types may change | Article; everything |
| **Change the tone…** | Opens a field, "Describe the tone", with suggestions (Warmer, More formal, More direct) | Article; replace only |
| **Ask about the article…** | Your own words, for the whole article | Article; everything |
| **Review my article** | Leaves AI comments on what to fix, and changes nothing (U11) | Article; new comments only |
| **Address comments** | The same as the Comments tab's footer (§7.5) | Comments |

### 6.2 Task flow

1. Choose an item. A small dialog says what will be sent and its size: "About 3,200 words to OpenAI." For a private page, it adds "This page is private." Then **Start** or **Cancel**.
2. **Decide**, then **write**. A whole rewrite doesn't stream into the canvas. A progress line in the status says "Writing with OpenAI… 40 s," and **Stop** cancels it with nothing kept, because half an article isn't reviewable.
3. **Check**, then the **review** (§8) opens in the inspector, with the canvas showing the proposed article.
4. **Apply** takes the changes you accepted, in one step.

Review my article ends differently: its comments are added to the Comments tab, marked as AI's, and the tab opens. Nothing in the article changes.

## 7. Comments (U5, U6, U7)

Comments work without any AI service. AI only adds Fix with AI, Address comments and its own comments.

### 7.1 What a comment is on

| Anchor | How you make it | Kept as |
|---|---|---|
| A block | Comment on its toolbar | The block's key |
| A section | Comment on a heading, then choose **This heading** or **Its section** | The heading's key, marked as a section |
| Words in a block | Select words, then Comment on the format bar | The block's key and the quoted words |
| The page header | Comment on the canvas's header (title, summary, lead picture) | The header |
| The article | **Add a comment** in the Comments tab, with nothing chosen | The article |

Several comments can sit on the same thing, and each has replies.

**When the anchor goes:** a comment on a removed block, or on quoted words that are no longer there, is marked **Outdated** and kept. It shows what it was on, and can be re-pinned (choose a block, then **Pin here**) or resolved. It's never deleted or moved silently. That's GitHub's model for review comments; Figma's "disconnected but kept" is the same idea.

### 7.2 Where comments are kept

**Decided: in the private repository,** `private-pages/comments/<article-id>.json`, for every article, public or private. The public repository is world-readable, and a note like "this paragraph is weak" doesn't belong on GitHub. A site without a private repository yet keeps them in `.atiya/comments/` on this computer, and they move across when one is set up.

- **What a thread holds:** its ID, its anchor, its author, when it was made, its text, its replies, its state (open or resolved) and, after Address comments, its last outcome and note.
- **Authors:** you, **AI** (with the service's name), or an agent by the name it gives through MCP. AI and agents never post under your name. Word's Copilot posting as the user is the research's anti-pattern.
- **Written through the store,** with its own schema check, like any content. They're committed with the next Save to remote, as part of the private repository's commit, so they're in the [timeline](timeline.md).
- **With the article:** deleting an article deletes its comments. A copy starts with none. Changing a page's access doesn't move them, because they're already private.

### 7.3 The Comments tab

The inspector gets a third tab beside Block and Page: **Comments**, with the open count ("Comments 5").

| Part | What it is |
|---|---|
| Filter | Open, Resolved, Outdated, All. Default Open |
| List | Threads in the article's order, each headed by what it's on: an icon and its first words ("Paragraph: When we started…"). Choosing a thread selects its block and scrolls the canvas to it |
| Thread | The text, the author and when; replies; **Reply**, **Resolve** (or **Reopen**), **Fix with AI**, and **Delete** for your own (a deleted thread asks first) |
| New comment | A field at the top for the chosen block, section, header or article. "Comment on this paragraph." **Post** (Ctrl+Enter), **Cancel** |
| Outcome | After Address comments, a tag on each thread: Addressed, Partly or Needs you, with the note |
| Footer | **Address 5 comments**, sticky, shown when any are open and an AI service is set up |
| Empty | "No comments yet. Select a block and add one." |

On the canvas, a block with open comments shows a count in its margin, and the outline shows the same count on its row. Choosing the count opens the tab on that block's threads.

### 7.4 Adding a comment

1. Select a block (or words, or the header) and choose **Comment**, or press Ctrl+Alt+M (the key Google Docs and Word use).
2. The Comments tab opens with the new comment's field focused, already anchored.
3. Type, then **Post** (Ctrl+Enter). Esc cancels, and asks first if there's text.

### 7.5 Address comments (U7)

**Fix with AI** on one thread and **Address 5 comments** in the footer are the same request with one comment or several. Every mature tool offers both, told apart by where you press (GitHub's Fix with Copilot and Add to batch).

1. **Choose which.** The footer opens a list of open comments, all ticked. With Jev on, comments it judges need a person (a photo to take, a question only you can answer) start unticked, with the reason: "Needs you: asks for a photo." Untick any to leave out. **Address 4**.
2. **One request** carries them (scope `comments`), each with its anchor's key.
3. **The review** (§8) shows the changes. Each thread shows its outcome: **Addressed**, **Partly** (with what's left), or **Needs you**, posted as AI's reply with its question. No product researched gives an outcome for each comment.
4. **Fixing isn't resolving.** After you apply, the tab offers **Resolve 4 addressed**: one click, never automatic. GitHub and CodeRabbit do the same, and Word's auto-resolve is the risky one.

## 8. Review: one component for every proposal

One review shows every proposal: a section, a whole rewrite, comments, an empty page, an agent's changes, and (read only, in the [timeline](timeline.md)) the difference between two versions. A single block's proposal stays in place under the block (§4.2) and uses the same diff.

### 8.1 Anatomy

While a proposal is open, the inspector gets a **Review** tab, chosen for you.

| Part | What it is | Copy |
|---|---|---|
| Head | Who proposed it, the summary, and the count | "OpenAI proposed 6 changes: Shortened the intro and merged two sections." |
| Bulk | Accept all, Reject all | "Accept all", "Reject all" |
| Rows | One per change, in the article's order. Unchanged blocks fold into a line ("12 blocks unchanged") | §8.2 |
| Foot | **Apply**, with the count of accepted changes, and **Discard** | "Apply 4 changes", "Discard" |

| A row's part | What it is |
|---|---|
| Kind | A tag: Changed, Retyped (from Paragraph to Table), Added, Removed or Moved |
| Name | The block's type and first words |
| Diff | For text, words struck and inserted. For anything else, before and after, one above the other |
| Decision | **Accept** and **Reject**, a two-way toggle. A change starts undecided |
| Conflict | When you've changed the block since (§8.3) |

### 8.2 Task flow

1. Read the canvas, which draws the proposed article with the changes marked. Choosing a row scrolls the canvas to it, and choosing a marked block selects its row.
2. Accept or reject each change, or use Accept all.
3. **Apply** applies the accepted changes as one save and one undo step, named with the summary. A version is kept before and after ([Timeline §3](timeline.md#3-when-a-version-is-kept)). Undecided and rejected changes are dropped.
4. The proposal is deleted. The Review tab closes, and focus goes to the first changed block.

**Discard** asks first if any change was accepted. Leaving the article keeps the proposal (§12), and coming back reopens the review.

### 8.3 If you edited meanwhile

A proposal records the version it was made from. Changes are matched by key.

- **A change to a block you haven't touched** applies as usual.
- **A change to a block you've changed since** shows "You've changed this block since," with both versions, and **Use mine** or **Use AI's**. It can't be applied until you choose.
- **A change to a block you've removed** shows "This block was removed," and can only be rejected.
- **A change that's now refused by the check** (a picture you deleted) shows the reason, and can only be rejected.

### 8.4 The canvas's marks

Inserted words are underlined in the accent's tint. Removed words are struck through and muted. An added block has a bar in its margin, and a removed block is faded and struck. A moved block carries a "Moved" tag at its new place and a ghost line at its old one. Every mark has a text twin for screen readers (§11.2), and in forced colours the marks use underline and strike-through, never colour alone.

### 8.5 Proposals from your agent (U13)

An agent proposes through edit mode's MCP server ([AI services §10](ai-services.md#10-edit-mode-as-an-mcp-server)), and its proposal goes through the same check.

- **In the article editor,** a banner: "Claude Code proposed 3 changes." with **Review**, which opens the Review tab.
- **On the AI screen,** a list of open proposals with their article, author and age, each linking to its review.
- **An agent's proposal never applies itself.** The agent can ask whether it was applied, and is told Applied, Partly applied, Discarded or Still open.

### 8.6 Marking AI's words (U16)

**Decided: in edit mode only, per block.** A block whose content came from an accepted AI change carries a small "AI" mark in its margin until you edit its words. The version's message says "AI-assisted." Readers see nothing. The marks are kept in the article's comments file, by key, never in the article.

## 9. Safety and privacy

The site's private pages keep people from browsing everything. They aren't secrets. So the rules are set for that: clear about where your words go, and easy to tighten.

- **Every prompt names the service** it sends to, and the AI screen says what each one does with your words ([AI services §6](ai-services.md#6-keys-privacy-and-cost)). Changing service is one choice.
- **Private pages** may go to any service whose disclaimer you've accepted once, at setup. The prompt adds "Private page" to its service line. Each service has a switch, **Don't send private pages**, off by default. With it on, a private page's AI actions use the next service that allows them, or say none does (§10.4). The same switch exists for agents through MCP.
- **Never sent:** grants, access codes, reader agreements, keys, the timeline's history, other articles' text (only the titles and IDs of published pages, for links), and anything about a private page to a request on a public one.
- **Prompt injection.** The article and the comments go as material, clearly marked, never as instructions. The model gets no tools and no files: it can only return a proposal, and §2's check limits what a proposal can do. So a hostile sentence pasted into an article can, at worst, make a bad proposal that you reject. An agent through MCP has its own tools, but it reaches the site only by proposing.
- **Keys** never go in `content/`, a log, an answer or the browser. See [AI services §6](ai-services.md#6-keys-privacy-and-cost).
- **Cost.** An article-sized request says its size before it's sent, and any request can be stopped.
- **Logs.** The dev server logs a request's service, size, time and outcome, never its words.

## 10. When AI can't, or fails

### 10.1 It needs research (U12)

The connector has no web search, so a model asked for "the latest numbers" would answer from what it learned in training, out of date and stated with confidence. Decide catches it first: rules look for words like latest, current, this year, statistics, sources and cite, and Jev, when it's on, answers "does this need facts from outside the article?" (see [AI services §9](ai-services.md#9-the-connector-decide-write-check)). A writer can also answer `research` when it gets there.

The prompt shows a note in place of the result bar:

> **This needs research from the web.** AI here can only use what's in the article. Your own agent can search, then propose the changes for you to review.

| Choice | Does |
|---|---|
| **Copy for your agent** | Copies a ready prompt and says "Copied. Paste it into your agent." The prompt names edit mode's MCP server, the article's title and ID, the section's heading and key, and your words. It asks the agent to research with its own tools, cite its sources in a comment, and send the changes with `propose_changes` |
| **Ask anyway** | Sends it to the writer. The proposal's head says "Written without research: check every number," and AI leaves a comment on each number it wrote |
| **Cancel** | Closes the note |

Later, in Atiya Studio, **Open in terminal** starts your agent with that prompt ([AI services §5](ai-services.md#5-recommendation-and-phases)). Until an agent is set up, Copy for your agent links to the AI screen's agent setup.

### 10.2 It asks for something AI can't change

The note names the setting and where it is: "AI can't change a page's access. Change it in Page settings." with a link that opens the Page tab. The same pattern covers status, section, slug, pictures and other articles.

### 10.3 It's unclear

The writer may answer with a question ("Shorter for which reader: the summary or the body?"). The prompt shows it above the field, with your words kept, so you can answer and send.

### 10.4 Errors and edge cases

| Situation | What you see | What you can do |
|---|---|---|
| No service set up | "Set up an AI service to use this." | **Set up AI** |
| A private page, and every service is set not to get one | "This page is private, and no service is set to get private pages." | **Change on the AI screen** |
| The key is refused | "OpenAI refused the key. Check it on the AI screen." | **Open AI screen** |
| Out of credit or quota | "OpenAI says the account is out of credit." | **Open AI screen** |
| Rate-limited | Retried once, after the wait the service asks for, if that's 10 seconds or less. Then "OpenAI is busy. Try again in a minute." | **Try again** |
| The service is down or unreachable | "Couldn't reach OpenAI. Check your connection." | **Try again** |
| Ollama or LM Studio isn't running | "Ollama isn't running on this computer. Start it, then try again." | **Try again** |
| No answer starts within 30 seconds (120 for a model on this computer, which may be loading), or it stalls for 30 | "OpenAI stopped answering." What arrived is kept as a try | **Try again** |
| The answer is cut off at the model's limit | Treated as refused by the check, so it's retried once | As refused |
| Refused twice by the check | "The answer didn't fit the site: {first reason}." Nothing changed | **Try again** |
| Jev is slow (over 1 second) or down | Nothing: Decide falls back to rules. The AI screen shows "Jev didn't answer; rules decided" | None needed |
| The article changed in another tab | The conflict path (§8.3) | Choose per change |
| The dev server restarted mid-request | The request is lost, and the prompt says "The request stopped." Finished proposals are kept on disk and reopen | **Try again** |
| A second request on the same article | Ask AI is disabled. "AI is working on this article." | Wait, or Stop the first |

Every message follows the copy rules: what happened, then what to do, with no "Error:" prefix and no codes.

## 11. Accessibility, feedback and performance

### 11.1 Keyboard

| Key | Where | Does |
|---|---|---|
| Ctrl+Shift+Space | A block selected | Ask AI |
| Enter | The prompt's field | Send. Shift+Enter is a new line |
| Enter | The result bar | Keep |
| Esc | The prompt | Stop while writing; otherwise close, keeping a finished proposal |
| Ctrl+Alt+M | A block or words selected | Comment |
| Ctrl+Enter | A comment's field | Post |
| Alt+] and Alt+[ | The review | Next and previous change |
| Alt+Enter, Alt+Backspace | A review row | Accept, Reject |
| Up, Down | The review's rows, the comment list | Move between rows (one tab stop for the list) |

These avoid edit mode's existing keys: Alt+Up and Alt+Down (move a block), Ctrl+[ and Ctrl+] (indent), Ctrl+Shift+D (duplicate), Ctrl+B, Ctrl+I and Ctrl+K, Ctrl+Alt+0, 2, 3 and 4, and Ctrl+Shift+7, 8 and 9. They're listed in the article editor's help popover, never spelled out in a panel.

### 11.2 Screen readers and focus

- **Announcements** go through edit mode's live region: "Writing with OpenAI", "Proposal ready: 6 changes", "Applied 4 changes", "This needs research from the web", and every error's first sentence.
- **Tracked changes** are marked as insertions and deletions, with hidden "added" and "removed" words, so they read in order.
- **Each review row** is a labelled group ("Change 2 of 6, Retyped from Paragraph to Table"). The toggle says Accepted, Rejected or Undecided.
- **Focus.** Opening the prompt focuses its field. Keep and Discard return focus to the block. Apply sends it to the first changed block. Closing the Comments tab's field returns it to what opened it.
- **Reduced motion.** Streamed text appears in place without a typing effect, and marks don't animate.

### 11.3 Feedback

Every wait goes through edit mode's task tracker, with the `c.editor` feedback timings: a sign after 300 ms, shown for at least 500 ms, the elapsed time after 3 seconds, and "done" held for 2 seconds. The affected element carries the busy state: the block for one block, the article's header for an article-sized request, the Comments tab's footer for Address. Applying reports through the save status, like any save. Typing elsewhere in the article is never blocked while AI writes.

### 11.4 Performance

The service's own time isn't ours to budget, so it's shown instead. What edit mode does is budgeted in `perf/budgets.json`, with benchmark steps against the stand-in service:

| Measure | Budget |
|---|---|
| `editor:ai-prompt-open`: Ask AI to the field ready | 100 ms |
| `editor:ai-review-render`: an answer to the review drawn, for 60 changes | 150 ms |
| `editor:ai-apply`: Apply to the canvas redrawn | 300 ms |
| `editor:comments-open`: the Comments tab drawn, for 100 threads | 150 ms |

## 12. What's stored

| What | Where | Committed | Kept until |
|---|---|---|---|
| Block keys | In each article | Yes, with the article | The block goes |
| Comments, their outcomes, AI's marks | `private-pages/comments/<article-id>.json` (before a private repository: `.atiya/comments/`) | With Save to remote, to the private repository | The article is deleted |
| Proposals, with their tries and an interview's answers | `.atiya/proposals/` on this computer | Never | Applied or discarded, or 30 days untouched |
| AI settings and keys | See [AI services §11](ai-services.md#11-whats-stored) | Never | Removed |

Nothing about AI is sent to telemetry: edit mode is dev-only and has none.

## 13. How it's built

Where each piece goes, so the implementation follows edit mode's rules. The names of files and functions are the implementer's.

- **Pure logic in `src/site/editor/model/`, unit-tested:**
  - building a request from a scope;
  - a section's span;
  - the scope rules and the never-change list;
  - the word diff, and the block diff by key;
  - merging a proposal with later edits;
  - keys (make, repair duplicates);
  - comment anchors and Outdated;
  - outcomes and Resolve addressed;
  - the needs rules (§10.1);
  - the text Copy for your agent copies.
- **Server in `src/site/editor/server/`:**
  - the connector ([AI services §9](ai-services.md#9-the-connector-decide-write-check));
  - the proposal store in `.atiya/proposals/`;
  - comments written through the store, as `/private/` keys like any private content.
- **Edit mode's API:**
  - routes under `/_edit/api/ai/` (propose, stop, proposals, apply) and `/_edit/api/comments/`, behind edit mode's guard like every other route;
  - the answer streams to the page as server-sent events.
- **Parts,** each with a story and samples:
  - the prompt and its result bar;
  - the Review tab and its row;
  - the Comments tab, a thread, the comment field and the Address footer;
  - the interview and the outline;
  - the needs note.

  They're made of the kit and fundamentals only. A new kind of control is a new fundamental first.
- **The canvas** draws the marks from the proposal, inside its own frame. Applying goes through the article's save with `atOnce`, and the canvas is redrawn behind the old one, never reloaded in view.
- **The content contract:**
  - the optional `key` on every block in [schema.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts), with the loader's unique-key check;
  - the comments file's own schema;
  - the [content spec](../content/spec.md) lists both.
- **The timeline:** version before and after, and the shared review, in read-only mode ([Timeline](timeline.md)).
- **Icons:** sparkles, comment and comments, imported one at a time with the site's icon script, each checked by eye.
- **Studio:** the AI and Comment buttons sit in the header's slots, so they appear in the app's title bar with no extra work.

## 14. Tests

| Kind | What it covers |
|---|---|
| Unit | Every piece of pure logic in §13, including each refusal reason of the check, the migration run twice, and keys through Turn into, duplicate and paste |
| Editor E2E (`--project=editor`, the fixture server) | Against a stand-in AI service that gives scripted answers, as the contact form's tests use a stand-in. Ask AI: keep, discard, tries, stop and keep, refused twice, needs research and Copy for your agent. Retype. A section. A whole rewrite, partly accepted. A conflict. Comments: add, reply, resolve, Outdated, re-pin. Address with outcomes, then Resolve addressed. The empty page. An agent's proposal through a scripted MCP client. A private page with a service set not to get it |
| Accessibility | A keyboard-only run of Ask AI, review and comments; axe on each new part, in both themes |
| Visual | Every new part's story, light and dark, at the three widths |
| Performance | Benchmark steps for §11.4's budgets |
| Build | `build-parity` after the key migration: the published site unchanged |

Tests never call a real service. Trying one is done on purpose, once per phase, and noted in that phase's evidence.

## 15. Phases and Definition of Done

One plan for both pages: [AI services](ai-services.md#5-recommendation-and-phases) refers to it. The stages, each one's Definition of Done and their status are in the [plan](ai-plan.md).

| Phase | What | Needs | Done when |
|---|---|---|---|
| 1. Foundations | Block keys and the migration. The contract and the check. The connector with the OpenAI-compatible adapter and rules-only Decide. The AI screen with cloud and local setup. The proposal store. Ask AI on a block, reviewed in place. The needs-research route | — | The block flow passes its E2E against the stand-in, keyboard-only and axe included. Budgets are met. Build parity holds after the migration. Ollama and one cloud key have each been tried once for real |
| 2. More reach | The Review tab. Turn into with AI. Section scope. The Anthropic and Gemini adapters. Jev as the decider | 1 | Decide routes the same with Jev on and off. Jev's thresholds are set from at least 100 labelled requests and recorded in the as-built notes |
| 3. Comments | Anchors, storage, the Comments tab, adding, Fix with AI on one | 1 | Comments E2E passes. They're committed to the private repository with Save to remote. The fallback folder moves across when a private repository is set up |
| 4. Whole article | Address comments with outcomes. Tighten, Restructure, Change the tone, Ask about the article, Review my article. AI's marks | 2, 3, the timeline's versions | A partly accepted rewrite passes E2E, with a version before and after |
| 5. Empty page | Start with AI, the interview, the outline, the draft | 2 | The flow passes E2E, from the New article dialog and from an empty canvas |
| 6. Your agent | Edit mode as an MCP server and its setup ([AI services §10](ai-services.md#10-edit-mode-as-an-mcp-server)) | 1, so it can move earlier | A scripted MCP client proposes, and the proposal is reviewed and applied in E2E. Claude Code or Codex has been tried once for real |
| 7. Studio terminal | A terminal beside the article, Open in terminal, the command provider | 6 | Its Studio E2E passes |
| 8. Copilot SDK | Copilot as a writer inside the prompt | 1 | Tried once with a real Copilot subscription |

Every phase also updates this page's as-built notes and the content spec, and passes the checks for what it changed.

## 16. Decisions

| Decision | Chosen | Why, and what was rejected |
|---|---|---|
| How blocks are named | A `key` on every block (§3) | Exact and cheap. Matching by content guesses; a side map drifts |
| A block's answer | A tracked change in place (§4) | Your eyes stay on the block, in the page's own type (Cursor, VS Code's inline chat, Word). An inspector panel moves your eyes away. Replacing at once hides what changed (Notion; the halo effect NN/g warns about) |
| An empty page | Outline first, your material in the interview, Skip to draft (§5) | One prompt and one draft is hard to steer and drifts (Notion, Word's Draft with Copilot) |
| A whole rewrite | Reviewed change by change (§6) | Take the good parts (Word's Track Changes). Replace-all is all or nothing (ChatGPT Canvas, Notion). A copy to compare means merging by hand |
| Where comments live | The private repository, falling back to this computer (§7.2) | The public repository is world-readable |
| The footer's label | "Address 5 comments" (§7.5) | The copy rules: a verb and an object, three words or fewer. "Update article as per comments" was the first wording |
| Resolving | One click after applying, never automatic (§7.5) | GitHub and CodeRabbit. Word's auto-resolve is the risky one |
| AI's words | Marked in edit mode only, per block (§8.6) | You see what you haven't made yours (iA Writer's idea); readers see nothing. Marking on the site was rejected |
| Private pages | May go to a service whose disclaimer you've accepted; each service can refuse them (§9) | Private here means "not for browsing", not secret |
| The shortcut | Ctrl+Shift+Space (§11.1) | Ctrl+J is downloads, Ctrl+I is italic |
| The decider | Rules by default, Jev when it's on ([AI services §9](ai-services.md#9-the-connector-decide-write-check)) | Jev answers typed questions fast and cheaply, but it's early access, so nothing may depend on it |
| Proposals | On this computer, never committed (§12) | They're drafts of drafts. Committing them would fill the history |
| Authors | AI and agents post under their own names (§7.2) | Word's Copilot posting as the user is the anti-pattern |
| Concurrency | One request per article at a time (§4.2) | Two proposals on one article would conflict with each other |

## 17. Later, and what it won't do

**Later:**
- Marks on AI's words, word by word.
- A setting to resolve addressed comments automatically.
- AI suggesting pictures from the library for a figure, alt text included.
- Address comments across several articles.
- Translation.

**Won't:**
- AI publishes, changes access, or touches grants and codes.
- AI makes, edits or generates pictures in an article.
- A chat sidebar that talks about the article without proposing changes.
- AI running in the background without being asked.
- Readers' comments.

## 18. As built

Each phase records here what it built, where it differs from this spec, and its evidence. Stage by stage evidence is in the [plan's status](ai-plan.md#5-status).

### Block keys (phase 1, stage S1)

- **The field and the check.** Every block type in `src/site/content/schema.ts` takes an optional `key` (`blockKey`, six lowercase letters and digits). The loader (`load.ts`, beside the heading-anchor check) refuses a repeated key in one article, naming the later block's `body.<n>.key`.
- **The rules** are pure in `src/site/editor/model/keys.ts`: `withKeys` fills a missing or malformed key and re-keys the later of two blocks that share one (so a duplicate's original keeps its name), `findKey` finds a block, and `withoutKeys` lets `isMeaningful` ignore keys, so keying an article never moves its updated date.
- **When a block gets one.** As built, keys are given at the save, not at the moment a block appears: the article editor keys the body in its one save queue before each `PUT`, and the server's `saveArticle` keys it again for any other writer. The result is the one §3 describes: a new, pasted or AI-added block is keyed on its first save, a copy gets its own. `ops.replace` carries the replaced block's key to a rebuilt one, so Turn into keeps it.
- **The migration.** `node scripts/add-block-keys.mjs` (`--check` to only count, `--root` for another content folder) keyed the 17 articles in `content/`: 495 blocks, nothing else changed; a second run changes nothing. It differs from §3 in one way: **private pages weren't migrated.** `private-pages/` is its own repository, so its pages get their keys on their next save in edit mode instead. Nothing needs a key before a proposal is made, and a proposal is only made in edit mode, after a save.
- **The site** never renders a key: the production build before and after the migration is the same (1,390 files, the sealed files the same shapes).

### The contract and the connector (phase 1, stages S2 and S3)

- **Where they live.** The answer's shape, its strict schema, the scopes and applying an answer by key are pure in `src/site/editor/model/aiContract.ts`; Decide's rules in `model/aiDecide.ts`; the writer's messages (the article marked as material, cut to a budget outside the scope) in `model/aiPrompt.ts`; a block's words read out of a partial answer and the word diff in `model/aiText.ts`. The connector is `server/aiConnector.ts` (it writes nothing), and the dry run of the content check is `checkOnly` in `server/store.ts`, run against the editor's draft as sent, not the saved file.
- **Not built yet:** the proposal store (S3.7). A proposal lives only in the open prompt: closing it or reloading the page loses it.

### Ask AI on a block (phase 1, stage S5.1)

- **Where it is.** The canvas's block toolbar has Ask AI (the sparkles icon), and Ctrl+Shift+Space opens it on the selected block. As built it's offered on text, subheadings, markers and quotes only; a heading (which asks about its section) and the other blocks come with the rest of S5.
- **The parts.** The prompt is the `AiPrompt` part, composed into the canvas by `CanvasChrome`'s slot and placed under the block; every word it shows is in `model/aiCopy.ts`. The frame's side (`scripts/aiPrompt.ts`) draws it and the change; the editor's side (`scripts/ai.ts`) sends the request to `POST /_edit/api/ai/propose` and reads the answer as it streams.
- **The change in the block.** The proposed words are drawn in the block itself, word by word, as `<ins>` and `<del>` with the text twins "added:" and "removed:". Their styles are in `CanvasChrome`, the one canvas part allowed to style markup it didn't write. The block's own content comes back on Discard, Close or Escape.
- **Keep** makes the change through the editor's own `change`, so it saves, redraws and undoes in one step like any edit. The request sends the article as the editor has it, keyed in place, so a block added since the last save still has a key; the next save writes it.
- **Tries (S5.2).** Try again sends the same request again and keeps every try; the bar under the summary says "2 of 3", and Previous try and Next try redraw the change for the one shown. Ask for more sends a new request that starts from the try shown, and its answer is one more try. Keep keeps the try shown; Discard drops them all and puts the block back. The rules are pure in `model/aiTries.ts`.
- **Stop (S5.3).** Stop, or Escape while it's writing, ends the request. What arrived is kept as a try ("Stopped part way") when the request was a rewrite; a retype keeps nothing. With no tries the note says it stopped; with tries, Show tries goes back to them.
- **Not built yet:** Escape on a proposal discards it (the spec closes the prompt and leaves an "AI proposal" tag on the block); one request per article (Ask AI elsewhere is still offered while one runs); a retype shown before and after; Ask AI in the format bar for selected words; the notes for refusals, research, no service and private pages (S5.4 onwards).
- **Tests** never reach a model: the fixture server starts a stand-in service (`scripts/lib/ai-stand-in.mjs`) that cuts a block to its first sentence, or adds a sentence when asked for it longer, and sets it up as the writer ([AI services §16](ai-services.md#16-as-built)).

