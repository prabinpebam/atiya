# The contact form

A form on the site's Contact page that sends a visitor's message to Prabin's inbox: their name, their email so he can reply, and the message in plain text. The site stays static on GitHub Pages; a small Azure Function receives the message and emails it. Bots and spam are stopped before anything is sent, without a CAPTCHA to solve.

> **TL;DR.**
> - **Where:** inline on the Contact page, above its pages (the résumé, the privacy page). **Ask for access** on a section with private work, and **Get in touch** on the Sign in page, lead to it with the message started for them.
> - **What it asks:** name (required), email (required), message (required, plain text, at most 5,000 characters). Nothing else.
> - **How it sends:** the browser posts JSON to an Azure Function (Flex Consumption, Central India) in Prabin's own subscription, which emails him from his own Gmail account over Gmail's SMTP (so Gmail files it as his own mail, not spam), or through Azure Communication Services when Gmail isn't set up, with the visitor's address as Reply-To. Nothing is stored; no copy goes to the visitor.
> - **Against bots and spam**, all invisible to a person: a proof-of-work challenge the browser solves while they type, a honeypot field, a minimum time on the form, strict validation, a limit on links, rate limits per visitor and per day, and one use per challenge.
> - **Costs** a few cents a month (§9). **GitHub Pages** only serves the form; the endpoint's address is public configuration, and every secret lives in the Function's settings.

## 1. Goals and non-goals

**Goals**

- G1. A visitor can write to Prabin from the site, without opening a mail app, and without his address being published.
- G2. A reader who wants to see private work can ask for an access code in one step from where they found it.
- G3. A person never solves a puzzle or waits noticeably; a bot can't flood the inbox or use the form to send mail to anyone else.
- G4. It works on GitHub Pages as built today: no server-side code in the site, no change to hosting.
- G5. It meets the site's design system, accessibility and copy rules, and sends nothing typed to telemetry.

**Non-goals**

- Attachments, rich text, a subject line, categories, or a copy sent to the visitor (an auto-reply would let anyone use the form to send mail to any address).
- A dashboard or a store of messages: the inbox is the store.
- Sending without JavaScript (the challenge needs it; §5.4 says what a visitor without it sees).

## 2. The visitor's experience

### 2.1 Where the form is

- **The Contact page** (the site's `contactPage`, a section): its title and standfirst, then the form, then its pages as cards. The form is a section of its own, titled **Send a message**, with the anchor `#contact-form`.
- **Ask for access** (on a section whose work is shared with invited readers, [access spec §2.1](../access/spec.md)) links to `contact/?access=<section>#contact-form`. The form opens with the message already started: "Hello Prabin, I'd like an access code to read the work in Work." The visitor can change it or write their own.
- **Get in touch** in the Sign in panel links to `contact/?access=#contact-form`: the message starts "Hello Prabin, I'd like an access code to read your shared work."
- A started message never replaces anything the visitor already typed (a draft kept in the tab, §2.4).

### 2.2 The form

| Field | Control | Rules | Errors (what happened, how to fix it) |
|---|---|---|---|
| **Your name** | Text, `autocomplete="name"` | Required; 1 to 100 characters; no line breaks | "Enter your name." / "Keep your name under 100 characters." |
| **Your email** | Email, `autocomplete="email"`, hint: "I'll reply to this address." | Required; at most 254 characters; one `@`, a dot in the domain, no spaces or line breaks | "Enter your email so I can reply." / "Enter an email address like name@example.com." |
| **Message** | Multiline (8 rows), hint: "Plain text. Up to 5,000 characters." | Required; 10 to 5,000 characters after trimming; at most 3 links | "Write your message." / "Write a little more: at least 10 characters." / "Keep it under 5,000 characters: it's {n} now." / "Take out some links: up to 3 are allowed." |

- **One button:** **Send message** (primary). It shows **Sending…** with a spinner while it sends, and the fields are read-only meanwhile.
- **Under it, one line:** "Your message goes straight to my inbox. Nothing is kept on this site." It links to the Privacy page.
- **Validation** happens when the visitor leaves a field they've changed, and on Send for all of them; each error sits under its field (`aria-invalid`, tied with `aria-describedby`), and on Send the first field in error takes the focus. An error clears as soon as the value is fixed. Leaving a field can show its error but never takes one away: a line disappearing as Send is pressed would move the button between the press and the release, and the click would be lost.
- **Counting:** once a message passes 4,000 characters, its hint counts what's left ("312 characters left").

### 2.3 After Send

| Outcome | What the visitor sees |
|---|---|
| **Sent** | The form is replaced by a confirmation, focused and announced: **Message sent**, "Thanks, {first name}. I'll reply to {email}." and **Send another message** (which brings back an empty form). |
| **A field the server refused** | Its error under the field, as in §2.2; the rest kept. |
| **Too many messages** (rate limit) | An alert above the button: "You've sent several messages in a short time. Try again in an hour." Everything typed is kept. |
| **The day's limit reached** | "The form is resting for today. Try again tomorrow." Kept. |
| **The check that stops bots failed** (an expired or reused challenge) | The form fetches a new challenge and sends again once, unseen; only if that fails: "Something went wrong on my side. Try again in a few minutes." |
| **Offline, or the service didn't answer** (15 s) | "Your message didn't send. Check your connection and try again." Kept. |
| **The service failed** (5xx) | "Something went wrong on my side. Try again in a few minutes." Kept. |

Nothing typed is lost on a failure; a retry is pressing Send again.

### 2.4 Details that make it feel right

- **A draft is kept in the tab** (`sessionStorage`, this tab only) as the visitor types, so going to read a page and coming back keeps it; a sent message clears it. Nothing is kept across tabs or after the tab closes.
- **The challenge is solved while they type** (§5.1): started when a field is first focused, so Send is instant. Pressing Send before it's done waits for it (under a second on a phone), still showing **Sending…**.
- **Theme, phone and keyboard:** it uses the site's fields and button; on a phone the fields fill the width; the form keeps 44 px targets and no sideways scroll from 320 px.

## 3. UI

- **A compound, `ContactForm`** (`src/site/components/compounds/`), made of fundamentals only: `Heading`, `TextField` (with two new props, §3.1), `Button`, `Text`, `Link`, `Icon`. Its own wrapper lays them out; it never restyles them.
- **Layout:** a single column at the reading measure (`--size-measure`), fields stacked with `--space-6` between them, the button and the privacy line below; the section's title above. On the Contact page it sits between the intro and the cards (`IndexLayout`'s `lead` slot).
- **The confirmation** replaces the form in place, with a success icon in tonal style.
- **The alert** (rate limits, failures) is a `role="alert"` line above the button, in the negative colour with the error icon, cleared on the next Send.
- **The honeypot** (§5.2) is a real input hidden from people: off-screen, `aria-hidden="true"`, `tabindex="-1"`, `autocomplete="off"`, labelled "Leave this empty".

### 3.1 `TextField`'s new props

- `maxlength`: passed to the input or textarea.
- `liveError`: the field also renders its error line, hidden and empty, for a page's script to fill and show (`data-field-error`, its text in `data-field-error-text`): the same look as a server-rendered error. The script ties it with `aria-describedby` only while it shows.

## 4. The service

### 4.1 Shape

A Node.js 22 Azure Function app (`contact-api/` in this repository, deployed on its own) with two HTTP functions, anonymous:

| Route | Method | Does |
|---|---|---|
| `/api/contact/challenge` | GET | Returns a fresh proof-of-work challenge (§5.1): `{ challenge, signature, difficulty }` |
| `/api/contact` | POST | Checks and sends a message (§4.2) |

Requests are JSON (`Content-Type: application/json`), at most 16 KB; anything else is refused before it's read.

### 4.2 What `POST /api/contact` checks, in order

1. **The origin:** `Origin` is one of the allowed origins (`https://prabinpebam.github.io`, and `http://localhost:4321` for the dev server); CORS allows only those (the platform's CORS setting and the function's own check). Otherwise `403 { error: "origin" }`.
2. **The size and shape:** JSON, ≤ 16 KB, only the fields `name`, `email`, `message`, `website` (the honeypot), `elapsed`, `challenge`, `signature`, `nonce` and `about` (optional: the section an access request is about, ≤ 80 characters). Otherwise `400 { error: "shape" }`.
3. **The challenge** (§5.1): its HMAC is valid, it hasn't expired (10 minutes), and the nonce solves it. Fails: `403 { error: "challenge" }`.
4. **The honeypot** (§5.2): not empty → `202 { ok: true }` (a bot learns nothing) and nothing is sent.
5. **The time on the form:** `elapsed` (ms from when the form appeared) under 3,000, or missing → treated as the honeypot.
6. **The fields** (§2.2's rules, the same ones): fails → `400 { error: "invalid", fields: { email: "format" } }`.
7. **One use per challenge:** the challenge's ID is recorded (Table Storage); seen before → `403 { error: "challenge" }`.
8. **Rate limits** (Table Storage): per visitor (the client IP, hashed with a secret salt, never stored in the clear) at most **5 an hour**; for the whole site at most **50 a day**. Over → `429 { error: "rate" }` or `429 { error: "daily" }`.
9. **Send** (§4.3). Accepted by the email service (queued for delivery: delivery takes a few seconds more, and the visitor needn't wait for it) → `202 { ok: true }`. The email service refused it → `502 { error: "send" }`.

### 4.3 The email

- **From:** Prabin's own Gmail address (the app setting `GMAIL_USER`), sent by his account over Gmail's SMTP with an app password (`GMAIL_APP_PASSWORD`), display name "Prabin's site" (D7). Gmail signs it as his and files a message from his own account to himself in his inbox. Without those two settings, it's from an Azure-managed sender (`DoNotReply@<id>.azurecomm.net`), same display name, which Gmail tends to take for spam.
- **To:** Prabin's address, from the app setting `CONTACT_TO` (never in the repository or the site).
- **Reply-To:** the visitor's email, with their name, so replying in the mail app answers them.
- **Subject:** "Message from {name}" (or "Access request from {name}" when it came from Ask for access).
- **Body, plain text only:** their name, email, the section asked about (if any), the message as written, and the time (UTC). No HTML part, so nothing in a message can render or run.

### 4.4 Configuration

| Setting | Where | What |
|---|---|---|
| `PUBLIC_CONTACT_ENDPOINT` | The site's `.env` (committed: an address, not a secret) | The Function app's base URL; the form adds `/api/contact`. Unset (a fork), the form isn't shown and the section says "The contact form isn't set up on this copy of the site." |
| `CONTACT_TO` | Function app setting | Where messages go |
| `ACS_CONNECTION_STRING`, `CONTACT_FROM` | Function app settings | The Azure email service and its sender, used when Gmail isn't set up |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Function app settings (the password a secret, set by `deploy-contact-api.ps1 -Gmail`, which asks for it without showing it) | Send from Prabin's own Gmail account; both set, or the Azure sender is used |
| `CONTACT_SECRET` | Function app setting (random, 32 bytes) | Signs challenges and salts the IP hash |
| `RATE_TABLE_CONNECTION` | Function app setting | The storage account's tables |
| `ALLOWED_ORIGINS` | Function app setting | Comma-separated origins |

The test build reads `https://contact.test` from `.env.test`, but a `PUBLIC_CONTACT_ENDPOINT` already in the terminal's environment would override it (Vite's order), and the tests would reach the real service. So `.env` is never injected into terminals: VS Code's `python.terminal.useEnvFile` stays off.

## 5. Bots and spam

No single check is enough; together they make sending one message cheap for a person and sending many costly and pointless for a bot.

### 5.1 Proof of work (no CAPTCHA)

- The server issues a challenge: a random 16-byte salt and an expiry, signed with HMAC-SHA-256 (`CONTACT_SECRET`). It's stateless until it's used.
- The browser finds a nonce such that SHA-256(`salt:nonce`) starts with `difficulty` zero bits (**16**: about 65,000 hashes on average, a fraction of a second on a laptop, about a second on a phone), with Web Crypto, in batches so the page stays responsive.
- The server checks the signature, the expiry and the solution in microseconds, and records the challenge so it can't be used twice.
- **Why:** it costs a person nothing they notice, needs no third party, sets no cookie and asks for no data, and makes each automated message cost real CPU time.

### 5.2 Honeypot and time

- A field named `website`, hidden from people (§3), that bots fill in. Filled → the server says "sent" and drops it.
- A message sent less than 3 seconds after the form appeared is dropped the same way (a person can't type a name, an email and 10 characters faster). The form itself waits out the rest before sending, so a person who comes back to a draft and presses Send at once isn't taken for a bot.

### 5.3 Content and rates

- Validation as §2.2 on both sides; line breaks are refused in the name and email (no header injection), and the email body is plain text.
- More than 3 links (`http://`, `https://`, `www.`) in a message → refused with its error: link spam is the commonest form spam.
- 5 an hour per visitor, 50 a day in all: an attack that gets past everything else is still bounded (at most 50 emails a day, about $0.01).

### 5.4 Without JavaScript

The form can't solve the challenge, so it isn't offered: the section shows "The contact form needs JavaScript to send." (`<noscript>`), and the rest of the page works.

## 6. Privacy and telemetry

- **What's kept:** nothing on the site; in Azure, in Table Storage, only each used challenge's random ID (so it can't be used twice) and the counters behind the limits: per hour under a salted one-way hash of the IP (never the address), and per day. The message exists only in transit and in Prabin's inbox. The rows aren't pruned yet: they hold nothing about a person, and cost nothing worth noting.
- **Telemetry:** the form's wrapper carries `ph-no-capture`, so PostHog's autocapture records no click or text in it; the form sends no events of its own; nothing typed is ever in a request to the telemetry host (an E2E test reads every request).
- **The Privacy page** says that a message sent through the form goes through Microsoft Azure to Prabin's inbox and isn't stored by the site.

## 7. Accessibility

- Every field has a visible label and a Required note; hints and errors are tied with `aria-describedby`; errors use `aria-invalid`, the error icon and words, not colour alone.
- The confirmation takes the focus and is announced (`role="status"`); the alert is `role="alert"`.
- The honeypot is hidden from assistive tech and the tab order.
- axe finds nothing serious in light and dark; 44 px targets; no sideways scroll at 320 px.

## 8. Hosting on GitHub Pages

- The site stays static. The form is HTML and a small script; the only network calls are `fetch`es to the Function, cross-origin, allowed by CORS for the site's origin alone.
- The endpoint's address is in the site's `.env` (public, like any address in the page); every secret is in the Function app's settings in Azure, never in the repository, the build or the page.
- The Function is deployed from this repository by `scripts/deploy-contact-api.ps1` (it provisions what's missing and publishes), not by the site's workflow: the site deploys without Azure credentials.

## 9. Cost

Flex Consumption's monthly free grant (250,000 executions, 100,000 GB-s) covers it many times over; email is $0.00025 each; the storage account costs cents. At 100 messages a month: **under $0.15**. At the daily cap every day: about $0.40 a month. The subscription is Prabin's Visual Studio Enterprise subscription (its monthly credit).

## 10. Testing

- **Unit:** the rules (fields, links, the challenge's signature, expiry and solution), shared by the site and the service; the browser's solver against the server's check; the prefill text.
- **E2E (group "contact form"):** the service is mocked by the test (`page.route`), never called: sending (the request's shape, the confirmation, focus), each field error, each failure message with the typed text kept, the retry after a stale challenge, Ask for access prefilling, the draft surviving a reload, the honeypot out of reach, nothing typed in telemetry requests, axe in both themes, a 320 px phone.
- **Live, once after deploying:** one real message through the deployed service, received with Reply-To set; a POST without a solved challenge refused; a burst over the hourly limit refused.

## 11. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | An Azure Function in Prabin's subscription, not a form service | His inbox only, his address private, no third party holding messages, a few cents a month (owner's choice, 6 October 2026) |
| D2 | Proof of work, honeypot and time, not a CAPTCHA | No puzzle, no third-party script or cookie; layered with rate limits it bounds abuse |
| D3 | No copy to the visitor | Anyone could otherwise use the form to email any address |
| D4 | Plain-text email only | Nothing in a message can render, track or run |
| D5 | Central India | Close to Prabin; Flex Consumption is available there |
| D6 | The rules live once, in `contact-api/src/rules.mjs`, and the site imports them | The browser and the service can never disagree about what's valid |
| D7 | Sent from Prabin's own Gmail over SMTP with an app password, not from Azure's shared domain | Messages from `azurecomm.net` went to his spam. Azure can only send from a domain it has verified, never `gmail.com`, so the way to send "as" his Gmail is for his account to send it. A custom domain with SPF, DKIM and DMARC would also work, but the site has none (owner's request, 7 October 2026) |

## 12. As built

> **As built (6 October 2026).** Built and live as specified above, with the three refinements written into it (leaving a field never clears an error, §2.2; the time on the form counts from when it appears, and the form waits out the rest, §5.2; the service answers once the email is accepted, §4.2). See the [plan](plan.md) for the Definition of Done.

- **Azure** (Visual Studio Enterprise subscription, resource group `rg-atiya-contact`, Central India): the storage account `atiyacontact8a66d9`, the Function app `atiya-contact-8a66d9` (Flex Consumption, Node.js 22, 2,048 MB, on demand), the Email Communication Service `atiya-contact-email-8a66d9` with its Azure-managed domain (data in India), and the Communication Service `atiya-contact-acs-8a66d9` linked to it. The endpoint is `https://atiya-contact-8a66d9.azurewebsites.net`.
- **The code:** the rules in [contact-api/src/rules.mjs](https://github.com/prabinpebam/atiya/blob/main/contact-api/src/rules.mjs) (the site reaches them through `src/site/scripts/contactRules.ts`, its tier 0), the proof of work in `challenge.mjs` and the browser's `src/site/scripts/contactWork.ts`, the request handling in `handle.mjs` (what it remembers and sends are passed in, so every path is unit-tested), Table Storage in `store.mjs`, the email in `send.mjs`, the runtime's wiring in `functions/contact.mjs`; the form is the `ContactForm` compound, on the Contact page through `IndexLayout`'s `lead` slot.
- **Publishing:** `scripts/deploy-contact-api.ps1` installs the production packages here and publishes them as a zip, because the lockfile names the Microsoft package feed, which Azure can't reach.
- **Sending from Gmail (7 October 2026):** `send.mjs` picks the way from the settings (`transport`, unit-tested with the Gmail message itself, `gmailMessage`) and sends by `nodemailer` (pinned) to `smtp.gmail.com:465`. Turned on with `pwsh -File scripts/deploy-contact-api.ps1 -Gmail <address>` after creating an app password at https://myaccount.google.com/apppasswords (it needs 2-Step Verification); `-NoGmail` goes back to the Azure sender. Gmail allows about 500 messages a day from an account, well above the form's 50.
- **Measured:** the challenge answers in about 3.4 s from cold and at once when warm; from Send to the confirmation, 1.9 s (it was 14 s while the service waited for delivery).
