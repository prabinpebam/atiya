# Game UI and design system: Definition of Done

> **TL;DR.** The design-system work is done when these items hold: the rules are written down, the tokens are the only source of values, one arbiter owns the focus lane and <kbd>E</kbd>, the copy follows the guide, it's accessible, and it's all enforced by tests. Each row gives its evidence. The spec is [spec.md](spec.md) and the rules are [design-system.md](design-system.md).

| # | Item | Evidence | Status |
|---|---|---|---|
| 1 | Research on game UI practice, cited | [spec.md](spec.md) §1: BotW's HUD talk at CEDEC, Fagerholt and Lorentzon's diegesis model, Unreal CommonUI layers and Lyra, Unity XRI interactor scoring, the Game Accessibility Guidelines, Xbox Accessibility Guidelines 101/102/104, WCAG 2.2, DTCG 2025.10, Material 3 token tiers, the Microsoft, Apple, Mailchimp and NN/g copy guides | Done |
| 2 | Audit of the UI as it was, with the clash reproduced | [spec.md](spec.md) §2; `assets/clash-before.jpg`, `assets/companion-steals-prompt.jpg` | Done |
| 3 | Spec v1, a critique, and a v2 as built | [spec.md](spec.md) §3 to §5, including the owner's direction that the game is wood (§5.1) | Done |
| 4 | Tokens: one DTCG source, three tiers, generated CSS and reference | `src/design/tokens.json` → `scripts/build-tokens.mjs` → `src/styles/tokens.css`, [tokens.md](tokens.md); the unit test checks they're up to date | Done |
| 5 | No raw values in component CSS | `designSystem.test.ts`: no colour literals, no primitives, z-index from layers only, type, weight, leading, radius, motion and spacing from tokens | Done |
| 6 | Components are catalogued and read only surface roles | [design-system.md](design-system.md) §4; wood defines every paper role (test) | Done |
| 7 | Surfaces with one meaning each: wood for the game, paper for the website | `body.play.surface-wood`; the landing and classic pages stay paper; screenshots in the spec | Done |
| 8 | Principles and a framework for deciding | [design-system.md](design-system.md) §1 (P1 to P9, ranked) and §2 | Done |
| 9 | Screen regions with the centre kept clear | [design-system.md](design-system.md) §5, `assets/regions.svg` | Done |
| 10 | **The activation prompt never clashes with the talk box**: one focus lane, one arbiter for both the screen and <kbd>E</kbd> | `ui/lanes.ts` `focusLane`, used by `Hud.tsx`, `TalkBox.tsx` and `controller.interact()`; `lanes.test.ts`; the E2E test "one thing asks at a time" (talk by a landmark: only the talk box shows, and <kbd>E</kbd> advances it); `assets/talk-by-landmark-after.jpg` | Done |
| 11 | The aside has its own rank, and yields on narrow screens | `asideLane` (site card, then hint; nothing during a talk; compact rule); `lanes.test.ts` | Done |
| 12 | Target tiers: the companion never steals the prompt | `TIER_U` in `systems/interactables.ts`; `lanes.test.ts` | Done |
| 13 | Toasts: readable and announced; the talk guard | `toastMs`, `TALK_GUARD_MS`; `lanes.test.ts` | Done |
| 14 | Copy principles and a glossary, with the drift fixed | [design-system.md](design-system.md) §7; the copy lint in `designSystem.test.ts` | Done |
| 15 | Accessibility: contrast on both surfaces, 44 px targets, larger text, focus, reduced motion, scoped keys | [design-system.md](design-system.md) §8; the contrast tests; the menu's "Larger text" (`data-testid="large-text"`, saved) | Done |
| 16 | Found on the way: the brand link honours the base path; the mobile header doesn't wrap | `play.astro` `withBase('/')`; the mobile screenshot | Done |
| 17 | No regressions, and the budgets are met | `npx vitest run` (all passing), `npm run check` (0 errors), `npm run verify:prod` (game JS 447.5 of 450 KB gz, on demand 64.9 of 70), the full `npm run e2e`: 56 of 58 passed on the first run; the two failures were fixed and re-run green (a test still expected the old "Open full page" copy, and focus didn't return to the preview card's Open button because the card unmounted under the dialog, which `laneBeneath` now fixes) | Done |
| 18 | Documented as the source of truth | This folder, registered on the docs site ([the docs home](../index.html)); AGENTS.md points agents here | Done |

## Deferred

These are recorded in [spec.md](spec.md) §6, each with its reason:

- a world-anchored prompt chip;
- a notification queue with priorities;
- key remapping;
- a high-contrast theme;
- a dialog log and a text-speed setting.
