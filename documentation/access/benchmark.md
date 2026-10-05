# Protected content: quality benchmark

The bar that locked pages, private pages, signing in and telemetry must meet before they're done. Every row is measurable and names its evidence; the [plan's Definition of Done](plan.md#2-definition-of-done) is checked against it. The design is in the [spec](spec.md).

> **TL;DR.**
> - **Nothing readable leaks:** the leak check passes on every build, and catches every kind of leak planted in its own tests (QB1).
> - **The crypto is standard and checked:** published test vectors, and refusals of every malformed or weakened file (QB2).
> - **A grant sees its scope and nothing else,** proved by a matrix of grants and pages (QB3).
> - **Deploys, sign-out and the back button never leave readable content or false errors** (QB4, QB5).
> - **Telemetry sends nothing secret,** checked by inspecting every request (QB6).
> - **It's light, accessible and safe to publish** (QB7 to QB10), and the code meets the repository's own checks (QB11, QB12).

## Benchmark

| # | Area | The bar | Evidence |
|---|---|---|---|
| QB1 | Plaintext containment | `verify:sealed` passes on the test build and on the production build: every private-origin file sealed and gone, no seal marker left, every protected shell neutral and `noindex`, no protected word (12 characters or more, or a title, heading, alt text, caption, ID, slug or token of any length) and no private master's bytes anywhere in `dist/` | `npm run verify:prod`; the E2E build |
| QB1a | | The leak check's own tests plant at least 12 kinds of leak (a short title, a heading, an attribute, an HTML-encoded word, a word in JSON, a picture size, a dark version, a poster, a video, an orphan private file, an open page linking to a token, a shell without `noindex`) and every one fails it | `tests/unit/sealed.test.ts` |
| QB1b | | The sealer's and the leak check's output never contains a protected title, ID, slug or token, on success or failure | `tests/unit/sealed.test.ts` (their output, captured) |
| QB2 | Cryptography | PBKDF2-HMAC-SHA256 (RFC 7914 §11), HKDF-SHA256 (RFC 5869, case 1) and AES-256-GCM (the GCM specification's test case 16) match their published vectors | `tests/unit/access.test.ts` |
| QB2a | | At least 8 malformed or weakened files are refused without deriving or decrypting: an unknown version, an unknown KDF, a lower or higher iteration count, a short salt, a short IV, a file over its size limit, a changed header, a truncated tag | `tests/unit/access.test.ts` |
| QB2b | | Round trips for every sealed kind; a wrong key, one changed byte, another build's file and swapped additional data all fail cleanly; 100,000 generated IVs hold no repeat | `tests/unit/access.test.ts` |
| QB3 | Scope isolation | For every fixture grant (all of a section, one page, a link to a private page, an expired one, a withdrawn one), signed in: exactly its covered cards show, exactly its covered pages open, and no other protected title or token is anywhere in the page's DOM | E2E "protected content": the scope matrix |
| QB4 | Deploy consistency | A page whose keyring is from another build (or missing) reloads once, then shows "The site was just updated…", never "doesn't work"; a current page after a deploy signs in with a remembered key | Unit (the runtime's decisions); E2E (a page given a stale build ID) |
| QB5 | Browser lifecycle | Sign-out removes every decrypted region and card, puts back the neutral title, clears both storages and revokes blobs; another open tab signs out too; Back after signing out shows no protected text | E2E "protected content" |
| QB6 | Telemetry | With telemetry pointed at a fake host: no request holds a protected title, heading, sentence, code, link secret, URL fragment or recipient detail; protected pages send only the allowlisted events and properties; GPC, DNT and `?telemetry=off` each send zero requests; sign-out resets the identity | E2E "protected content" (every request body captured and decoded); `tests/unit/telemetry.test.ts` |
| QB7 | Performance | The sign-in runtime is at most 12 KB gzip and loads only where it's needed (a protected page, a section with sealed cards, the Sign in page, or anywhere while signed in); an open page gains at most 1.5 KB gzip of script; telemetry is its own chunk, loaded on idle | `scripts/size-report.mjs` (site budgets) |
| QB7a | | In headless Chromium on the development machine: signing in with a code (PBKDF2 and the keyring) under 2 s; swapping in a page's regions under 200 ms after its keyring opens; decrypting a 10 MB video under 1.5 s | E2E "protected content" (timed) |
| QB7b | | The planet's loading budgets are unchanged | `npm run verify:prod` |
| QB8 | Accessibility | No axe violations on the Sign in page, a signed-in section, a locked page and a private page's note, in light and dark; no sideways scroll at 320 px; every control at least 44 px; focus on the page's heading after a page opens; one live announcement per outcome | E2E "protected content", "site on a phone" |
| QB9 | Failure handling | Wrong code, expired, withdrawn, offline, no Web Crypto, a damaged file, and a link that doesn't cover the page each show their own message from spec §7.2 | Unit (the runtime's messages); E2E (each case it can reach) |
| QB10 | Publishing safety | Private commit pushed before the public one; a public message is yours only when nothing private changed; a failed push is recovered with Push again; deleting a grant, reusing its ID or changing a withdrawn grant's scope is refused; the tests use fixture repositories only | E2E "editor"; `tests/unit/editorAccess.test.ts` |
| QB11 | Repository checks | `npm run check` has no errors; `npm test` passes; the site design system's tests pass for every new component (tokens only, tiers, doc comments, stories, copy rules, hover twins) | `npm run check`; `npm test` |
| QB12 | Documentation | The spec's "As built" records what was built and its evidence; AGENTS.md has the feature's rules | The docs |

## What isn't measured here, and why

- **Phones' real speed and memory.** QB7a is measured in headless Chromium on the development machine. Signing in on a four-year-old phone may take two to three times as long; the 10 MB video cap leaves room for that (spec §5.5). Check one real phone by hand before sharing the first code.
- **Browsers other than Chromium.** The E2E tests run in Chromium. Web Crypto, `BroadcastChannel` and the `pageshow` event are in every current browser; try Safari and Firefox by hand once before sharing.
- **The live PostHog project.** QB6 checks what the site sends. That PostHog keeps IP addresses depends on the project's setting (spec §9.5), checked once in its dashboard.
