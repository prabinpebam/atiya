# The contact form: plan and Definition of Done

How the [contact form](spec.md) gets built: the shared rules first, then the service, the form, the Azure resources and the deploy, each phase leaving the site working. The form only appears once its service answers.

> **TL;DR.**
> - **C1: the rules.** One pure module for both sides: the fields, the links, the challenge.
> - **C2: the service.** `contact-api/`, an Azure Functions app (Node.js 22): the challenge, the checks in the spec's order, Table Storage for one-use and the limits, plain-text email through Azure Communication Services.
> - **C3: the form.** `TextField`'s two props, the `ContactForm` compound and its story, the Contact page's `lead` slot, Ask for access and Get in touch prefilling it.
> - **C4: Azure.** A resource group in the Visual Studio Enterprise subscription: storage, the Function app (Flex Consumption, Central India), Communication Services Email with an Azure-managed domain; settings and CORS; published by `scripts/deploy-contact-api.ps1`.
> - **C5: proof.** Unit and E2E tests, a live message, the docs and the Privacy page.

## 1. Phases

### C1: the rules

1. `contact-api/src/rules.mjs` (pure, no Node or browser API): `LIMITS`, `checkFields(fields)` returning the first problem per field (`required`, `long`, `short`, `format`, `links`, `lines`), `countLinks`, `trimFields`, `ERROR_TEXT` (the spec's messages), `prefill(section)`.
2. `contact-api/src/challenge.mjs` (Node crypto): `issue(secret, now)`, `verify(secret, { challenge, signature, nonce }, now)`, `leadingZeroBits`.
3. `src/site/scripts/contactWork.ts` (Web Crypto): `solve(challenge, difficulty)` in batches.

### C2: the service

1. `contact-api/`: `package.json` (`@azure/functions` 4, `@azure/communication-email`, `@azure/data-tables`, pinned), `host.json`, `.funcignore`.
2. `src/functions/contact.mjs`: `GET contact/challenge`, `POST contact` with the checks of spec §4.2 in order, its own origin check, a 16 KB cap.
3. `src/store.mjs`: one-use challenges and the hourly and daily counters in Table Storage (`contactchallenges`, `contactlimits`), each row with its expiry.
4. `src/send.mjs`: the plain-text email with Reply-To.

### C3: the form

1. `TextField`: `maxlength` and `liveError`, with their story.
2. `ContactForm` (compound): the fields, the honeypot, the button, the privacy line, the alert, the confirmation; `ph-no-capture`; `<noscript>`; its story (the form, an error state, the confirmation, unset).
3. Its script: validation on blur and Send, the draft in `sessionStorage`, the challenge fetched on first focus and solved, Send (with one silent retry on a stale challenge), the outcomes of spec §2.3, the prefill from `?access=`.
4. `IndexLayout`'s `lead` slot, filled on the site's `contactPage`; Ask for access → `?access=<section>#contact-form`; `UnlockPanel`'s Get in touch → `?access=#contact-form`.
5. `PUBLIC_CONTACT_ENDPOINT` in `.env`; the test build's in `.env.test` (a made-up host the tests intercept).

### C4: Azure

1. In `Visual Studio Enterprise Subscription` only: `rg-atiya-contact` in Central India; a storage account; the Function app (Flex Consumption, Node.js 22, 2,048 MB, on demand); a Communication Service and an Email Communication Service with an Azure-managed domain, linked.
2. App settings (spec §4.4), CORS for the site's origins, the secret generated in the script and never printed.
3. `scripts/deploy-contact-api.ps1`: idempotent provisioning, `npm ci --omit=dev`, publish, and a smoke check (`GET /api/contact/challenge`).

### C5: proof

1. Unit tests: `tests/unit/contact.test.ts`.
2. E2E: the "contact form" group in `tests/e2e/contact.spec.ts`.
3. Live: one message through the deployed service; a forged one refused; the hourly limit.
4. Docs: this plan's status, the spec's As built, the access spec's Ask for access, `AGENTS.md`, the Privacy page.

## 2. Definition of Done

| # | Done when | Evidence |
|---|---|---|
| CD1 | The rules hold for both sides | `tests/unit/contact.test.ts`: fields, links, prefill, the challenge round trip (browser solver → service check), expiry, a wrong nonce, a forged signature |
| CD2 | The form sends and confirms | E2E: the request's fields, the confirmation focused with the name and email, the draft cleared |
| CD3 | Every field error and failure is said, and nothing typed is lost | E2E: each error under its field and the first focused; 429, daily, 5xx and offline messages with the values kept; a stale challenge retried once, unseen |
| CD4 | Bots are refused | Unit: honeypot and time; live: a POST without a solved challenge gets 403; the sixth message in an hour gets 429 |
| CD5 | Ask for access reaches the form, started | E2E: from a section's panel to `#contact-form` with the message prefilled; a draft isn't replaced |
| CD6 | Nothing typed goes to telemetry | E2E: no request to the telemetry host carries the typed name, email or message |
| CD7 | Accessible and fits a phone | E2E: axe in both themes; 320 px without sideways scroll; 44 px targets |
| CD8 | It works from GitHub Pages | Live: a message sent through the deployed service arrives with Reply-To set; CORS allows only the site's origins |
| CD9 | No secret in the repository or the build | `verify:prod` passes; the leak checks find no setting value; the deploy script never prints a secret |

## 3. Status

> **6 October 2026: C1 to C5 built; the service is live** at `https://atiya-contact-8a66d9.azurewebsites.net` (spec §12). Not yet on the public site: it goes live with the next deploy of the site.

| # | Status | Evidence |
|---|---|---|
| CD1 | Met | `tests/unit/contact.test.ts`: 19 tests (fields, links, prefill, the round trip from the browser's solver to the service's check, expiry, a forged signature, a wrong nonce) |
| CD2 | Met | E2E "contact form": the request's fields and solved challenge, `elapsed` ≥ 3,000, the confirmation focused with the first name and email, the draft cleared |
| CD3 | Met | E2E: every field error under its field, the first focused; 429, daily, 5xx and offline messages with the values kept; a refused field from the service; a stale challenge retried once, unseen |
| CD4 | Met, partly live | Unit: honeypot, too fast, no time, a used challenge, 5 an hour and 50 a day. Live: another origin gets 403; a POST without a solved challenge gets 403. The hourly limit wasn't tried live: it would send five emails |
| CD5 | Met | E2E: Ask for access on Side projects → `#contact-form` with the request started and `about` sent; a draft survives a reload and isn't replaced; Get in touch starts the general request |
| CD6 | Met | E2E: no request to the telemetry host carries the name, email or message |
| CD7 | Met | E2E: axe in light and dark (with errors showing); 320 px without sideways scroll; 44 px fields and button |
| CD8 | Met, to confirm | Live from localhost (an allowed origin): two messages accepted (202), the confirmation shown; 1.9 s from Send to the confirmation. Their arrival, with Reply-To set, is for the owner to confirm in the inbox |
| CD9 | Met | `verify:prod` passes; the built site holds the endpoint and no key, connection string or secret; the deploy script prints none |
