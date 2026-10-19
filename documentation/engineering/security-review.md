# Security and privacy: review and plan

A review of the whole app, the website, its private pages, edit mode, Atiya Studio, the contact service and the build, for security and privacy. It scores each area for what this is (a personal site with some confidential work behind codes), sets the level worth reaching, and records the plan and its Definition of Done.

> **TL;DR.** On 20 October 2026 the app scores **about 7.4 out of 10** overall.
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

| Area | Score | Target | Why |
|---|---|---|---|
| Private-page confidentiality (crypto, sealing, leak check) | 9 | 9 | AES-256-GCM with random IVs and the build bound in, new page keys each build, PBKDF2-SHA256 at 600k iterations, 4-word codes (about 52 bits), magic-link secrets kept in the fragment and removed at once, and a leak check that fails the build. |
| Browser isolation of a reader's session | 5 | 7 (9 with a custom domain) | The site's origin, `prabinpebam.github.io`, is shared with 24 other Pages sites, some loading scripts from CDNs. A signed-in reader's key sits in Web Storage there with no time limit when remembered. |
| Web page hardening (XSS, CSP, framing, referrer) | 6 | 8 | No injection point was found, and the markdown renderer and Slate escape their input. But nothing limits what a script could load or send if one appeared, and GitHub Pages sends no security headers. |
| Owner's tools: edit mode and the dev server | 5 | 9 | The guard against cross-site requests and DNS rebinding is good. But the starting page's `?to=` parameter is written into an inline script, outside the guard. |
| Owner's tools: Atiya Studio | 9 | 9 | Sandboxed views with context isolation, a bridge that answers only the app's pages, a strict CSP, the GitHub token in memory only, the deploy key sealed, and the bundled `gh` checked against a pinned hash. |
| Contact service (abuse, input, secrets) | 7 | 8.5 | Origin check, signed proof of work on the form, header-safe fields, plain-text email, secrets only in the app's settings. But its per-IP limits trust the first `X-Forwarded-For` hop, which a client sets. |
| Supply chain and CI | 7 | 8.5 | Minimal workflow permissions, no `pull_request_target`, official actions, integrity hashes on every lockfile entry. But 4 high and 1 moderate advisories in transitive dependencies (all fixable), and the workflows trust whatever `ssh-keyscan github.com` returns. |
| Secrets hygiene | 9 | 9 | No secret is tracked; the contact service's settings, the GitHub token and the deploy key never touch the repository. |
| Privacy: what's collected | 8 | 9 | A clear notice, no cookies, GPC/DNT/`?telemetry=off` honoured, an allowlist on protected pages, consent before Clarity or GA4, and nothing from the contact form. But a private page's opaque address reaches PostHog in the URL and the referrer. |
| Privacy: control and retention | 8.5 | 8.5 | Opting out, deletion on request, retention stated (a year), and the agreement record explained. |
| **Overall** | **7.4** | **8.6** | |

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

- [ ] P1 to P8 are done, each held by the test named in the plan.
- [ ] The audit's scores in §2 are re-scored with the evidence, at or above their targets (the origin area at 7 without D1).
- [ ] `npm audit` reports no advisories in the site, Atiya Studio or the contact service, or each remaining one is explained here.
- [ ] Unit tests, `npm run check`, `npm run verify:prod` and `node scripts/build-parity.mjs` pass; the browser groups touched (site, protected content, contact, planet, editor) pass, apart from failures that predate this work.
- [ ] The live site serves the CSP and referrer policy, and its pages, the planet, a private page and the contact form work there.
- [ ] D1 and D2 are put to the owner; this page says what was decided.
