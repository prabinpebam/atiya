# AI editing: plan and Definition of Done

How [AI editing](ai-editing.md) and [AI services](ai-services.md) are built: phase 1 split into six stages, then phases 2 to 8, each with its own Definition of Done, and one Definition of Done for the whole.

> **TL;DR.**
> - **Phase 1, Foundations, is six stages,** each committed on its own once its Definition of Done is met:
>   - S1 block keys;
>   - S2 the edit contract and its check;
>   - S3 the connector;
>   - S4 the AI screen;
>   - S5 Ask AI on a block;
>   - S6 Atiya Studio's key dialog.
> - **Phases 2 to 8** follow the spec's order: more reach, comments, the whole article, the empty page, your agent, the Studio terminal, the Copilot SDK.
> - **The whole is done** when every stage is, the published site is byte for byte the same, nothing of AI reaches a build, no key leaks, tests never call a real service, and the specs' as-built notes say what was built.
> - **Changed from the spec:** the Review tab moves from phase 1 to phase 2, with section scope, the first scope that makes more than one change. Phase 1's review is the tracked change in place (§2.5).

## 1. The overall Definition of Done

The task is done when every row holds.

| # | Criterion | Evidence |
|---|---|---|
| D1 | Every stage below has met its own Definition of Done | The status table (§5), each row with its commit and evidence |
| D2 | The published site is unchanged: block keys and everything else in edit mode leave the built pages as they were | The built `dist/` compared before and after S1, identical; `node scripts/build-parity.mjs` passes |
| D3 | Nothing of AI reaches a build: no route, script, style or setting | `npm run verify:prod` passes (it already fails on `/_edit`) |
| D4 | No key leaks: never in a page, a response, a log, `content/`, `private-pages/` or `.atiya/` | The key scan (unit and E2E) passes |
| D5 | Tests never call a real service; real tries are made on purpose and recorded | The stand-in service in every E2E; each real try named in the status table |
| D6 | Every new screen and part is usable by keyboard alone and passes axe in both themes | The editor E2E's keyboard and axe tests |
| D7 | Every new part follows the editor tier: kit and fundamentals only, a story with samples, short | `tests/unit/editorDesignSystem.test.ts` passes |
| D8 | The specs say what was built | [AI editing §18](ai-editing.md#18-as-built) and [AI services §16](ai-services.md#16-as-built) filled in; the [content spec](../content/spec.md) lists the block key; the docs checks pass |
| D9 | Each stage is its own commit, holding only its own files, and nothing is pushed without the owner | `git log` |

## 2. Phase 1: Foundations

### 2.1 S1: block keys

Builds [AI editing §3](ai-editing.md#3-blocks-need-a-stable-name).
- The content contract: an optional `key` on every block type, and the loader refusing two blocks with the same key in one article.
- Pure helpers: make a key, fill missing keys, and give a duplicate's later copy a new one.
- Edit mode gives keys: the client fills and repairs before each save, and the server does the same on every save, so an article written by hand gets its keys on its next save.
- A migration script for `content/`. Private pages get their keys on their next save, so no private-repository commit is needed now.
- `.atiya/` added to the owner's `.gitignore`.

| # | Criterion | Evidence |
|---|---|---|
| S1.1 | The schema accepts a key on every block type and refuses a malformed one | Unit test |
| S1.2 | The loader refuses a repeated key in one article, naming the block | Unit test |
| S1.3 | Fill and repair: missing keys filled, a later duplicate re-keyed, existing keys kept | Unit test |
| S1.4 | A save fills missing keys and repairs duplicates; a duplicated block's copy gets a new key | Unit test on the save; editor E2E duplicating a block |
| S1.5 | The migration adds keys to every article in `content/`, changes nothing else, and run twice changes nothing | Unit test; the script's second run reports 0 files changed |
| S1.6 | The built site is byte for byte the same after the migration | `dist/` compared before and after |

### 2.2 S2: the edit contract and its check

Builds [AI editing §2](ai-editing.md#2-the-edit-request-one-contract-under-every-feature). Pure logic, then the store's check without writing.
- The answer's shape (changes, outcomes, new comments, summary, needs), as a schema.
- A section's span, and the operations each scope allows.
- Applying an answer's changes to an article by key.
- The scope check: every operation allowed, every key in scope, the fields AI may never change untouched.
- The content check of the changed article, through the store, without writing anything.

| # | Criterion | Evidence |
|---|---|---|
| S2.1 | An answer that isn't the shape is refused with a reason | Unit test |
| S2.2 | Each scope allows exactly the operations in §2.3's table | Unit test per scope |
| S2.3 | A section runs from its heading to the next heading of the same or a higher level | Unit test |
| S2.4 | Applying replace, retype, insert, remove and move by key gives the expected article; new blocks get keys | Unit test |
| S2.5 | Each refusal has its reason: an unknown key, a key outside the scope, an operation not allowed, a field AI may never change, a block that breaks the content contract (a missing picture) | Unit test per reason |
| S2.6 | The content check runs without writing a byte | Unit test: the files' versions are unchanged after the check |

### 2.3 S3: the connector

Builds [AI services §9](ai-services.md#9-the-connector-decide-write-check) and §11, for the OpenAI-compatible adapter with Decide by rules.
- Settings in `.atiya/ai.json`, beside the content folder, written to a temporary file and renamed, never holding a key.
- Keys read from the environment (`ATIYA_AI_<ID>_KEY`). `scripts/serve.ps1` fills them from Windows Credential Manager entries named `atiya-ai-<id>`, without printing them.
- Decide by rules: needs research, outside, the kind of change, the allowed block types.
- The request's prompt: the instruction, the article as material, the allowed types and pictures, the house style.
- The OpenAI-compatible adapter: a strict JSON schema made from the content contract, streaming, Stop, the time limits, the error mapping.
- Write, check, and one retry with the reasons.
- The proposal store in `.atiya/proposals/`, deleting proposals untouched for 30 days.
- Routes under `/_edit/api/ai/`: settings, test, local runners, propose (streamed as server-sent events), stop, proposals, keep and discard.
- A stand-in OpenAI-compatible service and a stand-in Ollama for the tests, started by the editor's test server.

| # | Criterion | Evidence |
|---|---|---|
| S3.1 | Decide's rules give each answer in [AI services §9.1](ai-services.md#91-decide)'s table | Unit test |
| S3.2 | The adapter's request carries a strict schema (every field required, no extra properties) and the material marked as material | Unit test |
| S3.3 | Streamed answers are read in pieces, and a block's text is read out of a partial answer | Unit test against recorded stand-in answers |
| S3.4 | Each failure maps to its state: key refused, out of credit, busy, unreachable, not running, can't follow the shape | Unit test |
| S3.5 | A refused answer is retried once with the reasons; refused twice, the request ends with the first reason | Unit test with a stand-in |
| S3.6 | The settings file is written atomically and never holds a key | Unit test |
| S3.7 | Proposals are kept, listed, kept or discarded, and removed after 30 days untouched (moved to phase 2: in phase 1 a proposal lives in its prompt, and only the Review tab lists them) | Unit test |
| S3.8 | The routes answer only behind edit mode's guard, and never return a key | Unit test; the key scan |

### 2.4 S4: the AI screen

Builds [AI services §7](ai-services.md#7-setting-up-task-flows) and §8 for phase 1: the intro, the writer, Found on this computer, the services' cards and Add a service. The Decider (Jev) comes in phase 2 and Agents in phase 6.
- A screen at `/_edit/ai/`, in `SCREENS` with the words it's found by, and its route in the integration.
- Add a service: its kind, name, base URL, the key's state (plain dev names the Credential Manager entry, with Copy name), the model, the disclaimer accepted once, Don't send private pages.
- Each card: state, model, the private-pages switch, the disclaimer, Test, Remove, the last test.
- Local runners found while the screen is open, offered with Add.

| # | Criterion | Evidence |
|---|---|---|
| S4.1 | Adding a local service from Found on this computer, testing it and making it the writer works by keyboard alone | Editor E2E against the stand-in Ollama |
| S4.2 | Adding a cloud service with plain dev shows Key missing and the entry's name, and Key found once the environment has it | Editor E2E |
| S4.3 | Test shows each failure in the card's state and its words | Editor E2E against the stand-in's scripted failures |
| S4.4 | Remove asks first, and the next service becomes the writer | Editor E2E |
| S4.5 | The screen passes axe in light and dark; each new part has a story and samples | Editor E2E; the design-system test |

### 2.5 S5: Ask AI on a block

Builds [AI editing §4](ai-editing.md#4-one-block-rewrite-or-retype-u1-u2) for one block, with the review in place (§8's diff, drawn under the block).
- Ask AI on the selected block's toolbar, Ctrl+Shift+Space, and Ask AI in the format bar with words selected.
- The prompt: the field, the quick actions, the service line, Send, the status with its time, Stop.
- The answer as a tracked change in the canvas, filling in as it streams; a retyped block shown before and after.
- The result bar: Keep, Try again, Discard, the tries, Ask for more.
- The notes: no service, needs research (with Copy for your agent, Ask anyway and Cancel), outside, unclear, and each error.
- Keep is one save and one undo step named with the summary.

| # | Criterion | Evidence |
|---|---|---|
| S5.1 | Ask AI, Make shorter, then Keep: the block changes, one undo step brings it back | Editor E2E against the stand-in |
| S5.2 | Discard puts the block back; Try again keeps both tries, and stepping between them redraws the change | Editor E2E |
| S5.3 | Stop while writing keeps what arrived as a try | Editor E2E with a slow stand-in answer |
| S5.4 | Refused twice shows the first reason and changes nothing | Editor E2E |
| S5.5 | "Add the latest numbers" stops at Decide with the research note, and Copy for your agent copies the prompt | Editor E2E |
| S5.6 | With no service, the prompt offers Set up AI | Editor E2E |
| S5.7 | A private page with every service set not to get it says so and sends nothing | Editor E2E |
| S5.8 | The whole flow works by keyboard alone, the canvas's marks have text twins, and axe passes | Editor E2E |
| S5.9 | Opening the prompt takes under 100 ms (`editor:ai-prompt-open`) | The benchmark step against its budget |
| S5.10 | Ollama on this computer has been tried once for real, and one cloud key | Recorded in §5 |

### 2.6 S6: Atiya Studio's key dialog

Builds the Studio half of [AI services §6.1](ai-services.md#61-keys).
- The app's own key dialog, drawn over edit mode, opened by one bridge request that answers only whether a key was saved.
- Keys kept with `safeStorage` in the app's data, handed to the managed server's environment at start, and to a running server through one write-only call carrying the launch header.

| # | Criterion | Evidence |
|---|---|---|
| S6.1 | A key saved in the dialog reaches the running site without a restart | Studio E2E |
| S6.2 | The key is never in edit mode's page, its requests or answers, or the site's folder | Studio E2E's scan |
| S6.3 | Removing a service deletes its key | Studio E2E |

## 3. Phases 2 to 8

Each phase's Definition of Done is the spec's ([AI editing §15](ai-editing.md#15-phases-and-definition-of-done)), plus the overall rows D2 to D9 for what it changes.

| Phase | What | Definition of Done |
|---|---|---|
| 2. More reach | The Review tab and the proposal store, S3.7 (both moved here). Section scope. Turn into's Adapt with AI. The Anthropic and Gemini adapters. Jev as the decider, with its card on the AI screen | A section's proposal, partly accepted, passes E2E through the Review tab. Decide routes the same with Jev on and off. Jev's threshold is set from at least 100 labelled requests and recorded. Jev and the two adapters tried once for real |
| 3. Comments | Anchors, storage, the Comments tab, adding, Fix with AI on one | Comments E2E passes. Saved to the private repository with Save to remote. The fallback folder moves across |
| 4. Whole article | Address comments with outcomes, the AI menu's actions, AI's marks | A partly accepted rewrite passes E2E, with a version before and after |
| 5. Empty page | Start with AI, the interview, the outline, the draft | The flow passes E2E, from the New article dialog and from an empty canvas |
| 6. Your agent | The MCP server and the Agents section | A scripted MCP client proposes, and the proposal is reviewed and applied in E2E. One agent tried once for real |
| 7. Studio terminal | The terminal, Open in terminal, the command provider | Its Studio E2E passes |
| 8. Copilot SDK | Copilot as a writer | Tried once with a real Copilot subscription |

**Needs from the owner:** a cloud key for S5.10 and phase 2's tries, Jev's key and the labelled requests for phase 2, a decision on each new dependency (the MCP SDK in phase 6, node-pty and xterm.js in phase 7, the Copilot SDK in phase 8), and when to push.

## 4. Order and how each stage is checked

S1, S2 and S3 go in that order: the check needs keys, and the connector needs the check. S4 and S5 need S3. S6 needs S4. Phase 2 needs phase 1; phases 3, 6 and 8 need only phase 1.

Each stage runs only what it changes, as [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md) sets out: the unit tests it touches, `npm run check` when types change, and the editor E2E tests for its screens through the test launcher. (`npx vitest related` stops on the private media glob in `masters.ts` before running anything, so the unit files that import the changed modules are named directly.) The end of phase 1 runs the broad checks once: every unit test, `npm run check`, `npm run verify:prod`, `build-parity`, and the whole editor project.

## 5. Status

| Stage | State | Commit | Evidence |
|---|---|---|---|
| S1 Block keys | Done | "Editor: block keys (AI plan S1)" | S1.1–S1.3: `blockKeys.test.ts` (every block type takes a key; fill, repair, find) and `content.test.ts` (a repeated key refused). S1.4: `editorServer.test.ts` "block keys on save", and the editor E2E "blocks: add from the palette, move, duplicate and delete" asserts every saved key is valid and unique after a duplicate. S1.5: the script keyed 17 articles (495 blocks), a second run reported 0 to change, and every article equals its committed version with its keys removed. S1.6: the production build before and after compared with `compareBuilds`: 1,390 files the same, sealed shapes the same. Also: the 29 unit files that import the changed modules (390 tests) and `npm run check` (0 errors). Private pages get keys on their next save ([AI editing §18](ai-editing.md#18-as-built)) |
| S2 The contract and its check | Done | "AI editing S2 and S3 core" | S2.1–S2.6: `aiContract.test.ts` (the answer's shape and its strict schema; each scope's operations; a section's span; replace, retype, insert, remove and move by key, a new block getting a new key; a reason for each refusal; the dry-run check finds a missing picture and writes nothing) |
| S3 The connector | Done (S3.7 moved to phase 2) | "AI editing S2 and S3 core", "AI S3.8: the key scan" | S3.1–S3.6: `aiConnector.test.ts` (Decide's rules; the strict schema and the material marked; streamed pieces and a block's words from a partial answer; each failure named; one retry with the reasons; settings written atomically, keys only from the environment), and a test against the stand-in service over real HTTP. Tried on Ollama on this computer (qwen3.8:27b): shorten, rewrite and a table retype in 5 to 9.5 s. S3.8: `aiServices.test.ts` "the key scan" (every AI route adds, changes, tests and removes a keyed service with the key in no answer, no file and not in the settings; the key reaches only the writer's request, never an event; the guard refuses a write without the header, from another origin, cross-site or from off the computer), and the AI screen's E2E "keys" test |
| S4 The AI screen | Done | "AI S4: the AI screen" | S4.1–S4.4: the editor E2E "editor: AI screen" (4 tests): the writer and Found on this computer by keyboard, adding the stand-in runner, testing it and making it the writer; a cloud service with Key missing and the Credential Manager entry's name, then Key found; each scripted failure's state and words; Remove asks first and the next service becomes the writer. S4.5: the same file runs axe in light and dark; the four parts have stories and samples, and their screenshots (28, light and dark at 1024 and 1440) are baselines. Also: `aiServices.test.ts` and the touched unit files (471 tests), `npm run check` (0 errors), and S5.1's E2E still passes. Keys are read by the server from Credential Manager, not filled by `serve.ps1` ([AI services §16](ai-services.md#16-as-built)) |
| S5 Ask AI on a block | In progress: S5.1 to S5.9 done; S5.10 waits for a cloud key | "AI S5.1: Ask AI on a block", "AI S5.2, S5.3: tries and Stop", "AI S5.4 to S5.9: notes, research, no service, private, keyboard, open time" | S5.4 to S5.8: the editor E2E "editor: AI" (8 tests, with "editor: AI screen" 12 of 12 passing): an answer refused twice shows the first reason and leaves the block; "the latest numbers" stops at the research note, Copy for your agent copies the prompt, Cancel closes, Ask anyway proposes; with no service the only choice is Set up AI, focused, and it opens the AI screen; a private page whose writer isn't allowed it says so before anything is sent, the connector answers only `status` and `error` (`private`), and the file is unchanged; the whole flow by keyboard (Ctrl+Shift+Space, Escape, Enter, Tab and Shift+Tab inside the prompt, Enter keeps), every mark's text twin ("removed: ", "added: "), and axe with no violations on the prompt and the change. S5.9: the benchmark's new step measures `editor/interaction/ai-prompt-open` at 45.3 ms against 100 ms. Also: `aiCopy.test.ts`, `aiTries.test.ts` and `editorDesignSystem.test.ts` (135 tests), `npm run check` (0 errors), and the AiPrompt screenshots (example 4 again, the new research note as example 5) in light and dark. The whole editor project ran once: 58 passed and 6 failed, all failures already known; the AI screen test failed there only because another change's file edits reloaded the dev server mid-run, and it passes alone. S5.2 and S5.3: the editor E2E "editor: AI" (Try again keeps both tries, Ask for more adds a third from the one shown, stepping redraws the change, Discard puts the block back; Stop while the stand-in writes slowly keeps what arrived as a try, and Escape stops), `aiTries.test.ts`, `npm run check` (0 errors), and the AiPrompt screenshots in light and dark. S5.1: the editor E2E "editor: AI" (Ask AI on a paragraph, Make shorter, the tracked change in the block, Keep saves it with its key, one undo brings it back), against the stand-in service the fixture server starts. Also: `npm run check` (0 errors), the editor and site design-system tests, `aiCopy.test.ts`, and the AiPrompt part's screenshots in light and dark. S5.10, the Ollama half: on the owner's running site, Make shorter on a real paragraph through Ollama on this computer (qwen3.8:27b) proposed 84 words cut to 56 in 24.7 s, writing nothing; the cloud key is still to try. Before release: `npm run verify:prod` passes (every budget, no edit mode in the build). Ask AI is offered on text, subheadings, markers and quotes so far ([AI editing §18](ai-editing.md#18-as-built)) |
| S6 Studio's key dialog | Planned | | |
| Phases 2 to 8 | Planned | | |
