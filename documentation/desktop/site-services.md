# Contact and visitor counts: options for a person's site

The research and comparison behind the [desktop spec's §9.5](spec.md) (15 October 2026): how a person who doesn't write code adds a contact form and visitor counts to the site Atiya Studio made for them, with no server of ours, in three tiers by setup effort. The spec holds what's decided (O7, O16, O17); this page holds every option looked at, why it was or wasn't chosen, and the sources.

> **TL;DR.**
> - **No server of ours, ever.** Every option is the person's own account with a third party, or nothing. Their site stays a static site on their GitHub Pages.
> - **Three tiers per category,** by setup effort: **Simple** (nothing, or one key to paste), **Balanced** (a free account and a few choices), **Powerful** (more steps, more power). The app says plainly what each gives.
> - **Contact.** Simple: an **Email me** link (no setup), or **Web3Forms** (the site's own form, one key). Balanced: an embedded **Tally** or **Google Forms** form. Powerful: **Jotform** (uploads, logic, an API for agents), or **Cal.com** to book a call.
> - **Visitor counts.** Simple: **GoatCounter**. Balanced: **Umami Cloud** (events too), with **Microsoft Clarity** for heatmaps. Powerful: **PostHog** (what the owner's site uses), or **Google Analytics 4**.
> - **Yes, forms like Google Forms embed:** Google Forms, Microsoft Forms, Tally, Jotform and Cal.com all give an embed for any web page. One generic *Embed a form* setting covers them all.
> - **Agents can do the setup** with the person: the app's `atiya` command and a skill in the site's repository do everything but the sign-ups and email confirmations, which stay a person's.
> - **Private pages stay private:** no counting script ever loads on a private page, the Sign in page or a page with shared cards, whatever the tool.

## 1. The promise

**A way for visitors to reach you, and a sense of who visits, in the few minutes you choose to spend, and still yours, free and working without us.**

| # | Promise | What breaks it |
|---|---|---|
| SP1 | **Your choice of effort.** Each tier says what it gives and what it asks, and the simplest asks almost nothing | A step the tier didn't mention; a "free" option that turns into a bill |
| SP2 | **Yours.** Every account is the person's; nothing passes through a server of ours | A relay, a key of ours, a dashboard of ours |
| SP3 | **Private stays private.** Nothing about a private page ever reaches a third party | A counting script on a private page; a secret address in a report |
| SP4 | **An agent can do it with you.** Everything but the sign-up and an email click can be done by an AI agent, with the same steps the app shows | A step only the app's screens can do |

## 2. Who and why

| # | When I… | I want to… |
|---|---|---|
| J1 | have just made my site | let people reach me without setting anything up today |
| J2 | get a few messages a month | a proper form on my site, in its own look, that emails me |
| J3 | want to ask more than a message (a project brief, a file, a time to talk) | a richer form or a booking page, built the way I like |
| J4 | wonder whether anyone reads my site | a simple count of visits and where they came from, without a cookie banner |
| J5 | care how people use the site | events, journeys, replays, and accept more setup (and maybe a banner) for it |
| J6 | use an AI agent | ask it to set this up, and only do the parts that need me |

## 3. Contact: the options

### 3.1 Two kinds

- **The site's own form** (a form backend): the site draws its own Contact form (today's `ContactForm`, in the site's look, accessible, sentence case) and posts it to a service that emails the person. Best look and accessibility; a key to paste.
- **An embedded form** (a form builder): the person builds a form on the service and the site shows it in a frame. More fields, logic and files, built in the service's own editor; it looks like the service, not the site, and a frame is harder for screen readers and fixed in height.

### 3.2 The tiers

| Tier | Option | What you get | What you do | An agent can |
|---|---|---|---|---|
| **Simple** | **Email me** (the default) | A button that opens the visitor's email app, addressed to you | Nothing beyond choosing, in setup, the address it opens (never GitHub's no-reply one) | Everything |
| **Simple** | **Web3Forms** | The site's own Contact form, emailed to you on each message; spam protection (hCaptcha, honeypot); 250 messages a month free; no file uploads | 1. Enter your email on Web3Forms' page. 2. Open the email it sends and copy the access key. 3. Paste it in the app. The app sends you a test message | Write the setting and send the test; you do steps 1 and 2 (an email click) |
| **Balanced** | **Tally** (embedded) | Your own form with any fields, unlimited responses free, an email per response (a switch in Tally), EU-hosted; popup or in-page | 1. Sign up. 2. Build the form (start from our template link). 3. Turn on email notifications. 4. Publish, copy its link, paste it in the app | Write the setting; you sign up and build |
| **Balanced** | **Google Forms** (embedded) | A form most people already know how to build, answers in a sheet; an email per response is a setting you turn on | 1. With a Google account, build the form. 2. Turn on "Get email notifications for new responses". 3. Send → link, paste it in the app | Write the setting |
| **Powerful** | **Jotform** (embedded) | Long forms with conditional logic, file uploads, payments; hCaptcha by default; an email per submission by default. Free: 5 forms, 100 submissions a month, Jotform's branding | 1. Sign up. 2. Copy an API key from Settings. 3. Tell the app (or your agent) what you want: it builds the form through Jotform's API. 4. Approve it | Build and change the form through Jotform's API, once you've given it a key |
| **Powerful** | **Cal.com** (embedded) | "Book a call": your free times, the visitor picks one, both get an email (SMS too); free for one person | 1. Sign up and connect a calendar. 2. Make an event type. 3. Paste its link | Write the setting; Cal.com's API can make event types once you've signed up |

**Also possible** (one *Embed a form* setting takes any of these links): Microsoft Forms, Fillout, Formbricks, Airtable forms, Zoho Forms, Cognito Forms, Typeform, Calendly. **Not offered:** giscus and utterances (a visitor would need a GitHub account), Basin (its terms ban accounts made by bots), Getform/Forminit (no terms or privacy page found today). FormSubmit (no account, one activation click) is a fallback for Simple if Web3Forms is ever unavailable; it puts the email address in the page unless its alias is used, and relies on reCAPTCHA.

### 3.3 Caveats to say in the app

- An embedded form brings the service's own cookies and look; Calendly's frame can show its own cookie banner.
- Web3Forms' 250 a month, Jotform's 100 and the services' free tiers are theirs to change; the app links each to its pricing page rather than promising numbers.

## 4. Visitor counts: the options

| Tier | Option | What you get | Cookie banner? | What you do | An agent can |
|---|---|---|---|---|---|
| **Simple** | **GoatCounter** | Visits, pages, where visitors came from, browsers, screens, countries; a simple dashboard; ~9 KB; open source; free for reasonable use | No: no cookies, no identifiers | 1. Sign up (a code name, an email). 2. Type the code name in the app | Write the setting and check the count arrives; you sign up (its terms forbid accounts made by bots) |
| **Balanced** | **Umami Cloud** | The same, plus events (which buttons, which pictures), goals and a nicer dashboard; 100,000 events a month and one site free | No | 1. Sign up. 2. Add the site, copy its website ID. 3. Paste it in the app | Add the site and read its ID through Umami's API, once you've signed up and made an API key |
| **Balanced, add-on** | **Microsoft Clarity** | Heatmaps and session replays, free with no limits | Likely, in the EU: it uses cookies (it has a consent mode) | 1. Sign up with a Microsoft account. 2. Add the site, copy its project ID. 3. Paste it | Write the setting |
| **Powerful** | **PostHog** (the owner's site) | Events, funnels, journeys, replays, feature flags; 1 million events a month free, resetting monthly; a public project key that's safe in a page | Yes with its defaults (cookies, local storage); no if the site runs it in memory only (fewer features) | 1. Sign up (it asks a few questions). 2. Copy the project key (`phc_…`). 3. Paste it | Make the project and read its key through PostHog's API, once you've signed up |
| **Powerful** | **Google Analytics 4** | Everything Google gives: audiences, acquisition, Search Console links | Yes (the `_ga` cookie) | 1. Sign up. 2. Make a property and a web stream. 3. Copy the measurement ID (`G-…`). 4. Paste it, and turn on the cookie banner | Make the property through Google's Admin API after one sign-in |

**Not offered:** Plausible, Fathom, Simple Analytics, Pirsch and Tinylytics (trials, then paid: not set-and-forget); Cloudflare Web Analytics (free, but its reports can't hide a page's address and it needs a Cloudflare account, so GoatCounter does its job more simply); GitHub's repository traffic (it doesn't cover a Pages site's visits, and can't hide addresses); Splitbee (closed); Vercel and Netlify Analytics (their hosting only); Statcounter (cookies, and its address controls couldn't be confirmed).

**Never more than one tool per kind:** one count (GoatCounter, Umami, PostHog or GA4), plus Clarity if wanted.

## 5. Private pages stay private (all options)

- **No counting script on a private page, the Sign in page or a page showing shared cards,** whichever tool is chosen: the page's layout leaves it out. This is the rule the owner's site keeps today with PostHog's allowlist, made simpler for third-party tools: no script, nothing to leak.
- **Every other page reports its own path,** never a query or a fragment (GoatCounter's `path`, Umami's `data-auto-pageview=false` with `track({ url })`, PostHog's `capture_pageview: false` with a manual page view, GA4's `page_location`), so a link with a code in it never reaches a report.
- **A cookie banner appears only when the chosen tool needs one** (Clarity, PostHog with cookies, GA4), and says which tool and why. Simple and Balanced without Clarity need none.
- **The leak check** (`verify-sealed.mjs`) adds a rule: no counting script in a sealed or private page.

## 6. How it works

### 6.1 In the app

- Edit mode's Settings gets two cards, **Contact** and **Visitor counts** (and the action center finds both). Each shows the tiers as three choices with their one-line "what you get" and "what you do", the current choice first.
- **Choosing one** opens a short guided panel: the steps, a button that opens the service's page in the browser, a field to paste into (checked for its shape: a Web3Forms key, a GoatCounter code, a `phc_` key, a `G-` ID, an allowed embed link), and a check:
  - Web3Forms: **Send a test message** (it arrives in the person's inbox);
  - an embed: a preview of the frame;
  - counts: **Open my dashboard** (and, after the next Save to remote, "Seen your first visit").
- Saved like any setting: in `content/site.json`'s `services` (the owner's site keeps its own there already), through the store, published with Save to remote. Nothing secret: every value above is public by design.

### 6.2 What the site needs

- `services.contact`: `{ kind: 'email', address }`, `{ kind: 'web3forms', key }`, `{ kind: 'embed', url }` (hosts allowed: Tally, Google Forms, Microsoft Forms, Jotform, Cal.com, Calendly, Fillout, Formbricks, Airtable, Zoho, Cognito, Typeform), or the owner's `{ kind: 'relay', endpoint }` (his Azure service, unchanged).
- `services.counts`: `{ kind: 'goatcounter', code }`, `{ kind: 'umami', id }`, `{ kind: 'posthog', key, host }` (today's), `{ kind: 'ga4', id }`, and optionally `clarity: { id }`.
- The Contact page draws the site's own form for `web3forms` and `relay`, an accessible frame (a title, a "Open the form in a new tab" link beside it, its height from the service's resize message where it sends one) for `embed`, and the Email me button for `email`.
- One small loader per counting tool, fetched on idle like today's PostHog chunk, never on the pages of §5; the 1.2 KB telemetry shim's budget holds.
- The site's Content Security Policy allows exactly the chosen services' hosts: each option names them in the catalogue's `csp` field (by directive; `{origin}` is a pasted link's origin, `{code}` GoatCounter's code name, `{host}` Umami's host), and the build makes the policy from the site's settings (access spec §6.4). A new option isn't done until it names its hosts there.

### 6.3 For agents

- **`atiya services`** in the app's command line, with `--json` like the rest (spec §5): `list` (the options, their tier, steps and what needs a person), `set contact web3forms --key …`, `set counts goatcounter --code …`, `check` (a Web3Forms test message; the counting script answers), `off`. Exit codes say when a person must act ("sign up at …, then run this again").
- **A skill in every site's repository** (`.github/skills/site-services/SKILL.md`, beside its `AGENTS.md`): the tiers, each option's steps split into *the agent does* and *the person does*, the shapes of the values, the private-page rule, and "never use a provider's admin API without the person's own key".
- The app and the skill read one catalogue (`services.json` in the engine: options, tiers, steps, value shapes, links), so the two never disagree.

## 7. Decisions

The owner decided on 15 October 2026 that there's no server of ours and that options come in three tiers by setup effort (spec O7). The picks below are the working defaults in the spec's O7 and O16, open until managed sites ship.

| # | Question | Working default |
|---|---|---|
| S1 | Contact's default for a new site | **Email me**, with the address the person chooses in setup |
| S2 | Simple-tier form | **Web3Forms**; FormSubmit as the fallback |
| S3 | Offer embedded forms at all? | **Yes, as Balanced and Powerful**, through one *Embed a form* setting with an allowlist of hosts |
| S4 | Simple-tier counts | **GoatCounter** |
| S5 | Offer tools that need a cookie banner (Clarity, PostHog with cookies, GA4)? | **Yes, but only in Powerful (and Clarity as an add-on)**, with the banner turned on with them |
| S6 | PostHog for new sites: cookies or memory only? | **Memory only by default** (no banner); cookies as a choice that turns the banner on |
| S7 | The owner's own site | **Unchanged**: his Azure relay and his PostHog, as `relay` and `posthog` |

## 8. Risks

- **Free tiers and terms change** (Web3Forms 250, Jotform 100, Umami 100,000, PostHog 1 million, GoatCounter's "reasonable use"). The app links to each pricing page and never quotes a number as a promise; a yearly review re-checks them.
- **Services close or change hands** (Splitbee closed; Getform became Forminit). One setting per kind makes switching a paste, and Email me always works.
- **Frames are less accessible** than the site's own form: the Contact page always offers the form in a new tab beside the frame, and the Simple form is the site's own.
- **Sign-ups can't be automated:** GoatCounter's terms forbid accounts made by bots, and most services need an email click. Agents stop and hand over at those steps, by design.
- **Facts not confirmed on the providers' own pages** (re-check before building): Microsoft Forms' limits and notifications, Fillout's and Formbricks' free limits, Umami's sign-up steps, Clarity's consent needs, whether GitHub's traffic covers Pages.

## 9. Sources

The providers' own pages, read on 15 October 2026: Web3Forms (pricing, docs), FormSubmit, Formspree, Basin (terms), Formcarry, StaticForms, Formspark, Forminit; Google Forms, Microsoft Forms and Tally help; Typeform, Jotform (pricing, API), Fillout, Formbricks, Airtable, Zoho Forms, Cognito Forms, Cal.com, Calendly; GoatCounter (site, terms), Cloudflare Web Analytics docs, PostHog (pricing, docs), Umami (pricing, docs), Plausible, Fathom, Simple Analytics, Pirsch, Counter.dev, Tinylytics, Microsoft Clarity docs, Google Analytics 4 help and Admin API, Statcounter, Splitbee, GitHub's traffic docs.
