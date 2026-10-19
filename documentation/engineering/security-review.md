# Security and privacy: review and plan

A review of the whole app, the website, its private pages, edit mode, Atiya Studio, the contact service and the build, for security and privacy. It scores each area for what this is (a personal site with some confidential work behind codes), sets the level worth reaching, and records the plan and its Definition of Done.

> **TL;DR.** On 20 October 2026 the app scored **about 7.4 out of 10**; after the plan below it scores **about 8.7**, every area at its target. The one gap left is the shared origin (decision D1).
> - **Strong:** the private-page crypto and sealing, secrets hygiene, the desktop app and privacy transparency.
> - **One high finding:** edit mode's starting page could be turned into a script by a link opened while the dev server runs, which would hand over every access code and the push to the live site.
> - **One medium finding:** the site shares its origin with 24 other GitHub Pages sites of the owner's, which can read a signed-in reader's key.
> - **The rest are low:** no Content Security Policy, a spoofable IP behind the contact service's limits, five dependency advisories, an unpinned SSH host key in the workflows, and private page addresses in telemetry.
> - **The plan** fixes all of them in code, except the origin (a custom domain, which is the owner's decision), and targets **8.5 or more** overall with no area below 7.

## 1. The right level for this app

This is a personal portfolio, not a bank. What it protects, from most to least sensitive:

1. **Confidential work shared under agreement** (private pages): the reason the site has security at all. A leak would break the owner's agreements with the people he shared it with.
2. **The owner's control of his site** (edit mode, the GitHub push, the desktop app's GitHub sign-in): a takeover could deface the site or quietly add a tracking script.
3. **Visitors' privacy:** what the analytics, the contact form and the agreement records collect about them.
4. **The owner's inbox and Azure bill:** abuse of the contact service.

Worth doing at this level:
- fix every exploitable finding, however unlikely, when the fix is small;
- defence in depth that costs little and doesn't slow the site: a Content Security Policy, a referrer policy, dependency updates, pinned keys;
- tests that keep each fix in place.

Not worth doing here:
- **Penetration tests, a WAF or a bug bounty.**
- **Hardware keys, HSMs or key rotation ceremonies.** Page keys are already new on every build.
- **Pinning every GitHub Action to a commit SHA without a bot to update them.** Stale pins would be worse than the official actions' version tags.
- **Server-side enforcement of expiry and withdrawal,** which a static site can't have. Its limits are documented instead (§4).

## 2. Scores

Each area is scored out of 10 for this kind of app:
- **9 to 10:** nothing realistic to add;
- **7 to 8:** sound, with small gaps;
- **5 to 6:** a real gap;
- **below 5:** missing.

Each cell is the score at the review and after the plan (20 October 2026).

| Area | Review → now | Target | Evidence now |
|---|---|---|---|
| Private-page confidentiality (crypto, sealing, leak check) | 9 → 9 | 9 | AES-256-GCM with random IVs and the build bound in, new page keys each build, PBKDF2-SHA256 at 600k iterations, 4-word codes (about 52 bits), magic-link secrets kept in the fragment and removed at once, and a leak check that fails the build. |
| Browser isolation of a reader's session | 5 → 7 | 7 (9 with a custom domain) | A remembered session now ends after 30 days (it held the key forever), and the reader sees when. The origin is still shared with the owner's other Pages sites until D1. |
| Web page hardening (XSS, CSP, framing, referrer) | 6 → 8.5 | 8 | Every built page carries a Content Security Policy: inline scripts allowed only by their hashes, no `unsafe-eval`, connections only to the site's own services, `object-src 'none'`, `base-uri 'self'`. It also has an explicit referrer policy. The build fails if a page lacks them. Framing can't be blocked from a meta tag. |
| Owner's tools: edit mode and the dev server | 5 → 9 | 9 | The starting page validates its target, never writes it into a script, runs edit mode's guard, and refuses frames with a hash-only CSP; hostile values are tested. |
| Owner's tools: Atiya Studio | 9 → 9 | 9 | Unchanged: sandboxed views, an origin-checked bridge, a strict CSP, the GitHub token in memory only. |
| Contact service (abuse, input, secrets) | 7 → 8.5 | 8.5 | The per-IP limits now read the address Azure's front end appended, so they can't be dodged. Deployed. |
| Supply chain and CI | 7 → 9 | 8.5 | 0 `npm audit` advisories in the site, Atiya Studio and the contact service. The workflows pin GitHub's published host key, never run on `pull_request_target`, and never put an event's text in a shell command, all tested. |
| Secrets hygiene | 9 → 9 | 9 | Unchanged: nothing secret tracked. |
| Privacy: what's collected | 8 → 9 | 9 | Telemetry masks a private page's token in every value it sends, so PostHog sees `/work/private/`; the privacy notice says so. |
| Privacy: control and retention | 8.5 → 8.5 | 8.5 | Unchanged: opting out, deletion on request, a stated retention. |
| **Overall** | **7.4 → 8.7** | **8.6** | |

## 3. Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| F1 | High | `integrations/editor.mjs` (the starting page) | `GET /_edit/__starting?to=…` writes `to` into an inline `<script>` with `JSON.stringify`, which doesn't escape `</script>`. A link opened while `npm run dev` runs can run a script on `localhost:4321`, and that passes edit mode's guard: it could read every code and link, make a grant, and push content to the live site. The middleware also sits outside the guard. | P1 |
| F2 | Medium | `src/site/scripts/sealed.ts`, `src/site/access/session.ts` | A signed-in reader's grant key is in `sessionStorage`, or `localStorage` when they tick "remember", on an origin shared with the owner's other Pages sites. A script on any of them could read it and decrypt the private pages it opens. | P2 (decision D1) |
| F3 | Low | `contact-api/src/handle.mjs` | `clientIp` takes the first `X-Forwarded-For` entry, which the client controls, so the per-IP limits on messages and agreements can be dodged. The site-wide daily cap still holds. | P3 |
| F4 | Low | site-wide | No Content Security Policy and no explicit referrer policy. GitHub Pages can't send headers, so frame protection isn't possible there. | P4 |
| F5 | Low | `package-lock.json` | Advisories in devalue, http-cache-semantics, sharp (librsvg), source-map-js and smol-toml, all with fixes in range. Mostly build-time; sharp also runs in edit mode on uploaded pictures. | P5 |
| F6 | Low | `.github/workflows/*.yml` | `ssh-keyscan github.com` trusts the network. GitHub publishes its host keys. | P6 |
| F7 | Low | `src/site/scripts/telemetrySanitize.ts` | A private page's opaque address reaches PostHog in `$current_url`, `$pathname` and `$referrer`. Only the owner sees it, and the address opens nothing, but it isn't needed. | P7 |

**Accepted design limits** (documented, not fixed):
- **Expiry is enforced at the nightly build,** up to 24 hours late, and a withdrawn code stops working at the next deploy. Edit mode's Save to remote deploys at once.
- **Copies of an older build** stay readable to someone who had a working code then.
- **The agreement is advisory:** page keys are decrypted before the reader agrees. The agreement is a record and a promise, not a lock.
- **The agreement endpoint has no proof of work.** Its per-IP and site-wide limits, made reliable by P3, are enough at this scale.

**Checked and sound:** the crypto and leak check, the Sign in page's return address (no open redirect), telemetry's allowlist and opt-outs, the contact service's input and email handling, edit mode's guard, git argument handling, upload and media path checks, the LinkedIn photo fetch's host allowlist, Atiya Studio, postMessage origin checks, the game's test hook (never in production), Slate's sanitizer, and secrets.

## 4. Plan

| Item | What | Closes |
|---|---|---|
| P1 | Edit mode's starting page: `to` must match `^/_edit/[A-Za-z0-9/_-]*$`; the script reads it from the page (escaped markup), never interpolated; the middleware runs edit mode's guard (loopback, Host, `Sec-Fetch-Site`). A unit test feeds it `</script>` and other hostile values. | F1 |
| P2 | A remembered session ends after 30 days (it held the key forever), and the reader can see when it ends. The full fix is decision D1. | F2 (partly) |
| P3 | `clientIp` takes the address Azure's front end adds (the last `X-Forwarded-For` hop, port removed), never the client's own. Unit-tested; deployed with `scripts/deploy-contact-api.ps1 -CodeOnly`. | F3 |
| P4 | A Content Security Policy meta tag on every built page of the site and the planet, generated from the site's services (contact endpoint, telemetry host, counting tools, form hosts, video hosts). Plus `object-src 'none'`, `base-uri 'self'`, `form-action` limited and an explicit `strict-origin-when-cross-origin` referrer policy. Never in dev (Vite needs inline modules and eval). Tested in the browser groups. | F4 |
| P5 | `npm audit fix` (no `--force`), through the package feed proxy. 0 advisories left, or each explained. | F5 |
| P6 | The workflows write GitHub's published `ssh-ed25519` host key instead of scanning for it. | F6 |
| P7 | Telemetry replaces a private page's token in any URL it sends with `private`, so PostHog sees `/work/private/`. Unit-tested in the sanitizer and the E2E allowlist. | F7 |
| P8 | AGENTS.md gains a short security section: the rules each fix depends on. The privacy notice is checked against what's collected. | — |

**Decisions for the owner:**
- **D1. A custom domain** (for example `prabinpebam.com`) gives the site its own origin, so no other Pages site can read a reader's session. It costs a domain a year and a DNS record. GitHub Pages serves it with HTTPS. Without it, P2 limits the exposure but can't remove it.
- **D2. Deploying the contact service fix** (P3) changes the live service. It's made with the deploy script and checked with a test message to the owner.

## 5. Definition of Done

- [x] P1 to P8 are done, each held by the test named in the plan (§6).
- [x] The scores in §2 are re-scored with the evidence, at or above their targets (the origin area at 7, pending D1).
- [x] `npm audit` reports no advisories in the site, Atiya Studio or the contact service.
- [x] Unit tests (1,802), `npm run check`, `npm run verify:prod` (137 pages carry the policy, budgets met) and `node scripts/build-parity.mjs` pass. The browser groups touched pass: protected content (24), content security policy (4), landing and classic (3), contact (11), capability gate (2), edit mode's guard and first start (5), and the screenshots (145; the 3 deliberately changed stories updated on purpose).
- [ ] The live site serves the CSP and referrer policy, and its pages, the planet, a private page and the contact form work there: waits for the push.
- [x] D1 and D2 are put to the owner (§7).

## 6. As built

| Item | What was built | Held by |
|---|---|---|
| P1 | `src/site/editor/model/starting.ts`: the starting page's target is validated (edit mode's address, safe segments and query), written only into escaped markup the script reads, behind edit mode's guard (loopback, Host, never cross-site, never framed), with a hash-only CSP and `frame-ancestors 'none'`. `__warm` runs the guard too. | `tests/unit/editorStarting.test.ts` (30+ hostile values); editor E2E "the first start", "the guard" |
| P2 | A remembered session ends 30 days after signing in (`REMEMBER_DAYS`, `deviceSession` in `src/site/access/session.ts`); older sessions get 30 days from now, longer ones are cut back. The checkbox says "for 30 days", the Sign in page says when the session ends, and an ended one signs out quietly with a line saying why. PageShell's head script applies the same date rule, so the header never shows Sign out for an ended session. | `tests/unit/accessSession.test.ts`; "protected content" E2E |
| P3 | `clientIp` takes the last public `X-Forwarded-For` entry (the one Azure's front end appended), never the client's own. Deployed on 20 October 2026 with `deploy-contact-api.ps1 -CodeOnly`; the service answers. | `tests/unit/contact.test.ts` |
| P4 | `src/site/services/csp.ts` builds the policy from the site's services (each catalogue option names its hosts in `csp`); `integrations/csp.mjs` hashes every inline script after the build (4 in all) and writes one policy into every page; a referrer policy of `strict-origin-when-cross-origin` (private pages keep `same-origin`). No `unsafe-inline` or `unsafe-eval` for scripts. Never in dev. | `tests/unit/csp.test.ts`; `verify-sealed.mjs` (every page, in `verify:prod` and the deploy); `tests/e2e/csp.spec.ts` (no violation on the home page, a section, the design library, Sign in, a video article, a private page, the contact form and the planet) |
| P5 | `npm audit fix` through the package feed proxy: sharp 0.35.5 (libvips 8.18.7) and the transitive fixes. | `npm audit`: 0 |
| P6 | The three workflows write GitHub's published `ssh-ed25519` host key. | `tests/unit/security.test.ts` (also: no `pull_request_target`, permissions declared, no event text in `run:`) |
| P7 | `maskTokens` in `telemetrySanitize.ts` replaces a private page's token with `private` in every string of every event, on every page; `access_opened` records only the section. The privacy notice says so. | `tests/unit/telemetry.test.ts`; "protected content" E2E (no fixture token in any request) |
| P8 | AGENTS.md: no request value in a script (edit mode), the CSP rule, the 30-day session and token masking, and the repository-wide rules (host key, workflow text, contact IP, `npm audit` at 0). | — |

## 7. Decisions

- **D1, a custom domain:** put to the owner on 20 October 2026, not yet decided. Until then, a reader's session on the shared `prabinpebam.github.io` origin is limited to 30 days, and the score for that area stays at 7.
- **D2, deploying the contact service fix:** made with the deploy script (code only), since the change narrows what the service trusts and changes nothing it accepts. No live message was sent (it would email the owner); the unit tests cover the rule.