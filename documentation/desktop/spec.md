# The desktop app: spec

The site as a product: an app that lets the owner write without developer tools, and lets anyone (or their AI agent) go from nothing to their own portfolio on GitHub Pages in one sitting, with the site, edit mode, private pages and, if they want them, ways to explore it like the planet. This page is the spec (v2, for review; v1 is critiqued in §15). Ways to explore are specified in [navigation modes](modes.md); stages, tests and Definitions of Done are in the [plan](plan.md); how the app fits with the site, its private pages and its ways to explore is in [the whole plan](../atiya.md).

> **TL;DR.**
> - **The promise** (§1): *your own site, live today, in three choices, without a terminal; yours, free, and working without us.* For the owner: *open the app and write.* For agents: *one command, and every answer machine-readable.*
> - **Setup is three choices** (§4): **Make my site** → **Continue with GitHub** (one button for signing in and signing up; the code is copied and GitHub's page opened for them) → **Create my site** on one prefilled screen (name, address, how visitors explore, sample pages). Edit mode opens about half a minute later, while the site goes live in the background.
> - **Less to set up:** no private repository, deploy key or secret until the person first makes a page private (§4.4); no username screen (GitHub's sign-up asks); email confirmation detected, not asked about; the workspace kept out of synced folders.
> - **Agents** (§5) use the same setup through a CLI: `atiya setup --name "Ada Lovelace" --yes --json` takes a token from `GH_TOKEN` or the GitHub CLI, prints JSON events, exits with codes that say what's needed, and resumes when run again. The site's repository carries an `AGENTS.md` so an agent can maintain it too.
> - **The engine is pinned** (§6): a person's repository holds only content, `atiya.json` and a short workflow; the site's code is a versioned engine release, the same in the app and in every build.
> - **Processes** (§7): only the main process holds the token; edit mode runs as a supervised `astro dev` on loopback, answering only the app's views; views are sandboxed, with no Node.
> - **The owner** opens his checkout in the app (a *developer workspace*): his own `astro dev`, edit mode in a window, alive as long as the app (§7.6). It replaces `serve.ps1`.

<figure class="slate-figure" data-diagram="desktop">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" role="img" aria-labelledby="dk-arch__title dk-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="dk-arch__title">The desktop app: from a window on the person's computer to their GitHub Pages site</title>
<desc id="dk-arch__desc">The app's window shows the setup screens and, once set up, edit mode, which is the engine's own pages. Neither view runs Node: they talk to the main process over a narrow bridge. The main process alone holds the GitHub token, in the system keychain; it signs in, sets up the account's repositories and settings through the GitHub API, supervises the engine and runs git. The engine process is astro dev with edit mode, bundled inside the app at one pinned version; it answers only the app's own views on the loopback address and writes the checked content into the workspace on disk. Save to remote pushes the workspace to the person's two repositories; GitHub Actions builds them with the same pinned engine, seals the private pages, checks for leaks and deploys to GitHub Pages.</desc>
<g id="dk-arch__window" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-1" x="40" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-1" data-slate-fit-padding="16">The app window</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-arch__body-1" data-slate-fit-padding="16">sandboxed views, no Node</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-1" data-slate-fit-padding="16">Setup and the app frame</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-1" data-slate-fit-padding="16">Edit mode: the engine's pages</text>
</g>
<g id="dk-arch__main" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-2" x="365" y="40" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="385" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-2" data-slate-fit-padding="16">Main process</text>
<text x="385" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="dk-arch__body-2" data-slate-fit-padding="16">the only part with the token</text>
<text x="385" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-2" data-slate-fit-padding="16">Sign-in, setup, updates</text>
<text x="385" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-2" data-slate-fit-padding="16">Keychain, git, the engine</text>
</g>
<g id="dk-arch__api" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-3" x="690" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="710" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-3" data-slate-fit-padding="16">GitHub API</text>
<text x="710" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-arch__body-3" data-slate-fit-padding="16">the person's own account</text>
<text x="710" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-3" data-slate-fit-padding="16">Repositories, deploy key</text>
<text x="710" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-3" data-slate-fit-padding="16">Secret, Pages settings</text>
</g>
<g id="dk-arch__engine" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-4" x="40" y="270" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="60" y="302" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-4" data-slate-fit-padding="16">Engine process</text>
<text x="60" y="324" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="dk-arch__body-4" data-slate-fit-padding="16">astro dev, pinned, inside the app</text>
<text x="60" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-4" data-slate-fit-padding="16">Edit mode and its contract</text>
<text x="60" y="392" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-4" data-slate-fit-padding="16">Answers the app's views only</text>
</g>
<g id="dk-arch__workspace" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-5" x="365" y="270" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="385" y="302" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-5" data-slate-fit-padding="16">Workspace</text>
<text x="385" y="324" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="dk-arch__body-5" data-slate-fit-padding="16">a folder in your home folder</text>
<text x="385" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-5" data-slate-fit-padding="16">content/ and atiya.json</text>
<text x="385" y="392" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-5" data-slate-fit-padding="16">private-pages/, once used</text>
</g>
<g id="dk-arch__repos" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-6" x="690" y="270" width="270" height="150" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="710" y="302" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-6" data-slate-fit-padding="16">Their repositories</text>
<text x="710" y="324" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-arch__body-6" data-slate-fit-padding="16">on GitHub, owned by the person</text>
<text x="710" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-6" data-slate-fit-padding="16">The site (public)</text>
<text x="710" y="392" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-arch__body-6" data-slate-fit-padding="16">Private pages, once used</text>
</g>
<g id="dk-arch__actions" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-7" x="365" y="500" width="270" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="385" y="530" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-7" data-slate-fit-padding="16">GitHub Actions</text>
<text x="385" y="552" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-arch__body-7" data-slate-fit-padding="16">same engine: build, seal, check</text>
</g>
<g id="dk-arch__pages" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="dk-arch__body-8" x="40" y="500" width="270" height="70" rx="16" fill="var(--color-brand-bg)" />
<text x="60" y="530" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="dk-arch__body-8" data-slate-fit-padding="16">GitHub Pages</text>
<text x="60" y="552" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="dk-arch__body-8" data-slate-fit-padding="16">login.github.io</text>
</g>
<text x="318" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">bridge</text>
<text x="643" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">REST</text>
<text x="92" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">edit, preview</text>
<text x="300" y="220" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">starts</text>
<text x="570" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">clones, syncs</text>
<text x="835" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">creates</text>
<text x="316" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">valid writes</text>
<text x="641" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">push</text>
<text x="660" y="526" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">on push</text>
<text x="316" y="526" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploy</text>
<text x="40" y="612" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Nothing on this computer runs on the person's site, and nothing on the site depends on the app being installed.</text>
<g id="dk-arch__flow-1" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M310 115 L355 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,115 355,120 355,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-2" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M635 115 L680 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="689,115 680,120 680,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-3" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M175 190 L175 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="175,269 180,260 170,260" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-4" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M420 190 L420 228 L260 228 L260 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="260,269 265,260 255,260" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-5" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M560 190 L560 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="560,269 565,260 555,260" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-6" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M825 190 L825 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="825,269 830,260 820,260" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-7" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M310 345 L355 345" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,345 355,350 355,340" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-8" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M635 345 L680 345" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="689,345 680,350 680,340" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-9" data-slate-svg-step="17" data-slate-svg-effect="draw">
<path d="M825 420 L825 535 L645 535" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="636,535 645,540 645,530" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-arch__flow-10" data-slate-svg-step="18" data-slate-svg-effect="draw">
<path d="M365 535 L320 535" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="311,535 320,540 320,530" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The app's parts and where each piece of data goes. Only the main process holds the token; only the engine writes content; only GitHub Actions builds the site.</figcaption>
</figure>

## 1. The customer promise

| # | To | Promise | Measured by | Target |
|---|---|---|---|---|
| P1 | Anyone | **Your own portfolio site, live at your own address, today.** | Time from opening the app to edit mode on their site, with a GitHub account / without | ≤ 3 min / ≤ 10 min of their time |
| P2 | Anyone | **Three choices, no terminal, no developer words.** | Choices made in the app before edit mode; terminals, SSH keys, git commands or file paths they must see | 3; none |
| P3 | Anyone | **Yours, free, and working without us.** | Where every repository, secret and setting lives; recurring cost; services of ours in the path | Their GitHub account; nothing; none (the contact relay is opt-in) |
| P4 | Anyone | **Just the site, or a way to explore it, changeable any time.** | Steps to turn the planet on or off | One switch |
| P5 | The owner | **Open the app and write.** | Steps from a closed app to typing in edit mode; things that stop the server | One launch; only quitting the app |
| P6 | Agents | **One command sets a site up or checks it, and every answer is machine-readable.** | Commands for a full setup; output; a second run | One; JSON events and exit codes; resumes, changes nothing done |
| P7 | Everyone | **Nothing breaks silently.** | Failures without words and a way on | None |

The promises are the project's Definition of Done ([plan §2](plan.md#2-project-definition-of-done)).

## 2. Who, and the jobs they hire it for

| # | Who | When… | I want to… | So I can… |
|---|---|---|---|---|
| J1 | A newcomer (a designer, a student, a job hunter) | I need somewhere to show my work | have a professional site at my own address, quickly | send a link today |
| J2 | The owner | I have an idea for an article | open the editor and write at once | not lose the moment to dev setup |
| J3 | A site's owner | I've written something new | publish it without thinking about how | keep my site current |
| J4 | A site's owner | a recruiter asks for work I can't publish | share a private page with just them | get the job without breaking an NDA |
| J5 | A site's owner | I want my site to stand out, or to stay plain | choose how visitors explore it | match the site to me |
| J6 | A site's owner | I'm on another computer | carry on where I left off | work anywhere |
| J7 | An AI agent, asked by a person | "Set up a portfolio site for me", or "add this article" | do it with commands and read the results | finish without a person clicking through screens |
| J8 | A site's owner | my site didn't update, or the app says something's wrong | know what happened and fix it | trust it |
| J9 | A maker | I've an idea for a new way to explore a site | build it alone and plug it in | share it with anyone ([modes](modes.md)) |

## 3. What a person can do

| Job | They can |
|---|---|
| J1 | Download one installer; make a site with three choices; start editing about half a minute after choosing, while the site goes live; find their site at `https://<login>.github.io/` |
| J2 | Open the app on their checkout and be in edit mode; close VS Code and every terminal without stopping it; restart the dev server from a menu |
| J3 | Edit pages on the page; save to remote with one button; see when the site has updated |
| J4 | Make a page private; the first time, the app sets up private pages by itself (one dialog); share it with a code or a link (the Access screen, as today) |
| J5 | Choose at setup between the site with a little planet and just the site; switch either way at any time in edit mode's Ways to explore |
| J6 | Sign in on another computer and choose their site; it's cloned and opened; changes from both computers merge, and a page changed on both asks which to keep |
| J7 | Run `atiya setup`, `atiya status`, `atiya doctor` with JSON output; read the site repository's `AGENTS.md`; edit `content/` and push, with the build checking every change |
| J8 | See the site's state in the frame (saved, going live, live, a failed build with its step's name); run Check my site (the same checks as `atiya doctor`), with a fix offered for each problem |
| J9 | Build a mode with the mode kit, run it against sample content, check it, and turn it on for a site ([modes §7](modes.md#7-making-a-mode-in-isolation)) |

## 4. The first run and setup

### 4.1 The flow

<ol class="slate-steps">
  <li class="slate-step">
    <p class="slate-step__title">Welcome: Make my site</p>
    <p>One sentence of what they'll get, and that their GitHub username becomes their address. Two buttons: Make my site, and Open my existing site.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Continue with GitHub</p>
    <p>One button for both signing in and creating an account. The app copies a short code and opens GitHub's page in their browser; they paste it and choose Authorize. GitHub's page offers Create an account to anyone without one.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Your site: Create my site</p>
    <p>One screen, filled in from their GitHub profile: their name, their address, how visitors explore it, and sample pages to start from. Each can be changed, none needs to be.</p>
  </li>
  <li class="slate-step">
    <p class="slate-step__title">Edit mode, going live</p>
    <p>About half a minute of ticks (Creating your site, Saving your first pages, Turning on publishing), then edit mode opens on their home page. The frame says Going live until the site answers, then Live, with Open my site.</p>
  </li>
</ol>

### 4.2 Flow decisions

| # | Decision | Chosen | Why |
|---|---|---|---|
| F1 | Sign-in and sign-up | One button, **Continue with GitHub**: the OAuth device flow of an OAuth App; GitHub's own page handles sign-up | One path for everyone; the password stays with GitHub and their password manager; nothing embedded |
| F2 | The device code | Copied to the clipboard and GitHub's device page opened when they press the button; the code also shown large, with Copy code and Open GitHub again | They paste and authorize; nothing to retype |
| F3 | A new account's email | Detected after sign-in: only if it's unconfirmed does a screen say so, checking again every 5 seconds by itself (and Check now) | GitHub won't let an unconfirmed account create a repository; most people never see this screen |
| F4 | Questions before creating | One screen, prefilled; its only button is **Create my site** | Every answer has a good default and can change later |
| F5 | The address | `<login>.github.io`; if they already have that repository, `<login>.github.io/site/` (the name changeable under More options) | The shortest address that's free, without a question |
| F6 | How visitors explore | Two cards: **The site, with a little planet to walk around** (chosen) and **Just the site** | P4; the planet is the site's signature, plain is one click |
| F7 | Starting content | **Start with sample pages** (on): seven sections with a few sample pages written as instructions; off gives the sections empty | A site that already looks like a portfolio teaches by example |
| F8 | Private pages | Not set up at first; the first time a page is made private, one dialog sets up the private repository, its key and the build's secret | Setup stays short; most people start public |
| F9 | Waiting for the first build | Not waited for: edit mode opens after the first push; Going live shows in the frame; a notification says when it's live | Minutes of waiting become minutes of writing |
| F10 | Where the files go | `<home>/Atiya/<address>/`, changeable under More options; never Documents | Windows often syncs Documents to OneDrive, which locks git's files mid-write |
| F11 | Choosing a username | No screen of ours: GitHub's sign-up asks; the welcome says the username becomes the address | v1's username screen added a step most people don't need |
| F12 | Developers | Not on the welcome: **File → Open a source folder**, and offered by itself when the app is started from a checkout | Keeps the newcomer's path to two buttons |

### 4.3 The screens

**Welcome.** Title: "Your own site, live today". Line: "Atiya Studio makes you a portfolio site and publishes it with GitHub, free. Your GitHub username becomes its address." Buttons: **Make my site** (primary), **Open my existing site**.

**Continue with GitHub.** Title: "Connect GitHub". Line: "GitHub keeps your site and publishes it. If you don't have an account, you can create one on the next page." Button: **Continue with GitHub**. After pressing it: "Paste this code on GitHub's page, then choose Authorize", the code (large, selectable), **Copy code**, **Open GitHub again**, and the time left. On success: their avatar and "Signed in as ada".

**Confirm your email** (only if needed). "GitHub needs you to confirm your email before it can keep your site. Open the email from GitHub and choose its link. This page carries on by itself." **Check now**, **Open GitHub's email settings**.

**Your site.**
- **Your name**: from their GitHub profile (else their login).
- **Address**: `ada.github.io`, shown as a link-like line, not a field.
- **How visitors explore it**: the two cards of F6, each with a small picture.
- **Start with sample pages**: a switch, on.
- **More options** (closed): the address's name (project sites only), where it's kept on this computer.
- Button: **Create my site**.

**Creating.** The ticks, in words: Creating your site on GitHub; Saving your first pages; Turning on publishing; Opening edit mode. A failure stops on its line with words and **Try again** (§4.5).

**Edit mode** opens on the home page, with the frame saying **Going live: about 3 minutes**, then **Live** and **Open my site**. A first-visit tip in edit mode's own style points at a heading: "Click any words to change them."

### 4.4 What setup does

Each step has a **check** (already done?) and an **act**; the machine always checks first, so a step run twice is harmless, and a crash, a quit or a lost connection resumes at the step it stopped on. Its state is a file in the workspace (`.atiya/setup.json`, ignored by git), holding each step's result and IDs, never a secret.

| # | Step | Check | Act |
|---|---|---|---|
| 1 | Signed in | A token that GitHub accepts, with the scopes setup needs | Device flow (app), or the agent's token source (§5.2) |
| 2 | Email confirmed | GitHub reports a confirmed primary email | Wait (F3) |
| 3 | Site repository | `<login>/<name>` exists, is theirs and public, and is empty or already an Atiya site | Create it, empty |
| 4 | Workspace | The folder holds a git repository whose `origin` is that repository and whose first commit has `atiya.json` | Copy the starter for their choices, write their name, `atiya.json`, the workflow, `README.md`, `AGENTS.md` and `.gitattributes`; commit "Create my site" |
| 5 | Publishing | Pages is on, built by GitHub Actions | Turn it on (`build_type: workflow`); if GitHub refuses on an empty repository, after step 6 |
| 6 | First save | The repository's `main` is the workspace's | Push |
| 7 | Edit mode | — | Open it (setup is done for the person here) |
| 8 | First build | A run of the site's workflow on that commit succeeded | Start the workflow if the push didn't within 30 s; follow it |
| 9 | Live | The address answers with their site | Poll it; then the frame says Live |

**Private pages, later (F8).** The first time a page is made private, one dialog ("Set up private pages: your private pages are kept in a second, private repository that only you can see") runs: the private repository (`<name>-private`), the read-only deploy key on it, the key sealed into the site repository's `PRIVATE_CONTENT_KEY` secret, the `private-pages` submodule, a commit. The same check-and-act machine, and an agent command (`atiya private setup`).

### 4.5 Failures

| Failure | They see | Way on |
|---|---|---|
| No connection | "Can't reach GitHub. Setup carries on when you're back online." | Retries by itself |
| They declined on GitHub | "GitHub wasn't connected. Atiya Studio needs it to keep and publish your site." | Continue with GitHub |
| The code expired | "That code has run out." | Get a new code |
| The address is another repository of theirs (not an Atiya site) | "You already have a repository called ada.github.io. Your site will be at ada.github.io/site instead." (F5 does this without asking) | — |
| GitHub asks the app to slow down | "GitHub asked us to wait. Trying again at 14:05." | Waits |
| GitHub Actions is off for the account | "GitHub Actions is off for your account, and it publishes your site." | Open GitHub's settings, Try again |
| The first build fails | "Your site didn't publish." with the failing step's name (never its log, which can name private pages) | Try again; Check my site |
| The token stops working | "GitHub isn't connected any more." | Continue with GitHub |

### 4.6 Another computer, an existing site

**Open my existing site** → Continue with GitHub → a list of their repositories that hold an `atiya.json` → choose one → it's cloned (with its private repository, if it has one) and opened. A site made by a newer app asks them to update the app; an older one is offered **Update your site** (§10.3).

### 4.7 Sync

On open and before Save to remote the app fetches; with nothing unsaved it fast-forwards, otherwise it rebases the content commits. Content is one resource per file, so a conflict is a resource changed on both computers, shown in words ("Article: My work at Contoso, changed here and on another computer") with **Keep this one** and **Keep the other**; the result goes through the content check before it's committed. Quitting with changes not saved to remote asks whether to save them first.

## 5. Setting up with an agent

### 5.1 The CLI

The same setup machine, without screens. It ships inside the app (`<install>/resources/bin/atiya`, put on the PATH only if the person turns on Settings → **Let command-line tools use Atiya Studio**) and in the engine's repository (`node apps/desktop/bin/atiya.mjs`).

| Command | Does |
|---|---|
| `atiya setup [options]` | Makes a site, or resumes one (§4.4) |
| `atiya status [--dir <dir>] [--json]` | The site's state: signed in, saved, pushed, last build, live |
| `atiya doctor [--dir <dir>] [--json]` | Every check of §4.4 and the site's content contract, each with its fix |
| `atiya private setup` | Sets up private pages (§4.4) |
| `atiya sites [--json]` | The person's Atiya sites on GitHub |

`atiya setup` options, all optional:

| Option | Default |
|---|---|
| `--name "<their name>"` | Their GitHub profile's name, else their login |
| `--repo <name>` | `<login>.github.io`, else `site` (F5) |
| `--explore little-planet\|site` | `little-planet` |
| `--samples` / `--no-samples` | `--samples` |
| `--dir <folder>` | `<home>/Atiya/<repo>` |
| `--token env\|gh\|device` | The first that works, in that order (§5.2) |
| `--yes` | Without it, setup prints its plan and changes nothing |
| `--no-wait` | Return after the first save, without waiting for the build |
| `--json` | JSON lines on stdout instead of words |
| `--dry-run` | The plan only, with every check run and nothing changed |

### 5.2 Tokens

1. **`env`:** `GH_TOKEN`, else `GITHUB_TOKEN`.
2. **`gh`:** the GitHub CLI's token (`gh auth token`), if the GitHub CLI is installed and signed in.
3. **`device`:** the device flow; in `--json` it emits the code and the address as an action for the agent to show its person, and waits.

The token needs the `repo` and `workflow` scopes (a classic token, or the GitHub CLI's default plus `workflow`: `gh auth refresh -s workflow`). A token without them stops setup at step 1 with exit code 30 and the command that fixes it. A token is never printed, written or logged.

### 5.3 Output and exit codes

`--json` writes one JSON object per line:

```json
{"type":"plan","steps":["signed-in","email","repository","workspace","publishing","first-save","first-build","live"],"site":{"repository":"ada/ada.github.io","url":"https://ada.github.io/","dir":"C:\\Users\\ada\\Atiya\\ada.github.io"}}
{"type":"step","step":"repository","state":"done","message":"Created ada/ada.github.io"}
{"type":"action","needs":"confirm-email","message":"GitHub needs ada to confirm their email.","url":"https://github.com/settings/emails"}
{"type":"result","ok":true,"live":false,"site":{"repository":"ada/ada.github.io","url":"https://ada.github.io/","dir":"…"}}
```

| Exit code | Means | What the agent does |
|---|---|---|
| 0 | Done (live, or saved with `--no-wait`) | Report the address |
| 10 | Needs the person: sign in, confirm email | Show the `action` event's message and address, then run the same command again |
| 20 | A conflict it won't resolve alone (the folder holds another site) | Ask the person, then pass `--dir` |
| 30 | GitHub refused (scopes, Actions off, rate limit) | Show the message; it names the fix |
| 1 | Anything else | Show the message; `atiya doctor --json` |

### 5.4 Agents maintaining a site

Setup writes `AGENTS.md` into the site repository: what the repository is (content only; the engine is pinned), where each kind of content lives and its contract (a link to the [content spec](../content/spec.md)), never to edit `atiya.json`'s engine pin or the workflow by hand, how to check a change (`atiya doctor`), and that a push to `main` publishes. The build checks every push with the content contract, so a bad edit fails the build and the live site keeps its last good version.

## 6. The product model

### 6.1 Words

| Word | Means |
|---|---|
| **Engine** | The site's code: layouts, the mode host and its built-in modes, edit mode, the content contract, the sealer, the build. Versioned and released from this repository |
| **Engine release** | An immutable archive of the engine at one version, without anyone's content, with its lockfile, generated assets and a checksum (§10.1) |
| **Site repository** | The person's public repository: `content/`, `atiya.json`, a short workflow, `AGENTS.md`. No code |
| **Private repository** | Made on first use (F8): private pages, their media and the grants, kept in the site repository as the `private-pages/` submodule |
| **Workspace** | The site repository cloned on a computer (`<home>/Atiya/<address>/`) |
| **Managed site** | A site the app runs with its own engine (everyone but the owner) |
| **Developer workspace** | A source checkout the app runs with its own code (the owner) |
| **Navigation mode** | An optional way to explore the site, plugged in through the [mode contract](modes.md) |

### 6.2 Where the engine lives

| Option | Their repository holds | Updates | Verdict |
|---|---|---|---|
| A. A copy of everything | All the code and their content | Hundreds of files they never wrote, per update | Too heavy for a non-developer's repository |
| **B. Content, and a pinned engine** | Content, `atiya.json`, a short workflow | One commit: the pin, the workflow reference, migrations | **Chosen** |
| C. The engine as an npm package | Content, `package.json`, a lockfile | Bump the dependency | A package manifest in a non-developer's repository |
| D. A hosted build service | Content | Ours | Puts us in every site's path (against P3) |

If this repository or its releases ever went away, **Keep a copy of the engine** (Settings → Advanced) commits the release into their repository and builds from it (A, on demand).

<figure class="slate-figure" data-diagram="desktop-engine">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 505" role="img" aria-labelledby="dk-engine__title dk-engine__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="dk-engine__title">One engine, pinned: the same release in the app and in the site's build</title>
<desc id="dk-engine__desc">The engine's source is this repository. A release workflow tests it, builds it and packs it, without anyone's content, into a versioned engine release with a checksum. The app bundles that release with its installed dependencies; each person's site build downloads the same release, checks its checksum and builds their content with it, through a reusable workflow pinned to the release's commit. The site's atiya.json names the version and the checksum. The app opens a site only at its own engine version, and moving a site to a newer one is a commit the app makes: the pin, the workflow reference and any content migrations together.</desc>
<g id="dk-engine__source" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-1" x="40" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-1" data-slate-fit-padding="16">Engine source</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-engine__body-1" data-slate-fit-padding="16">this repository</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-1" data-slate-fit-padding="16">Site, planet, edit mode</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-1" data-slate-fit-padding="16">Starter content, tests</text>
</g>
<g id="dk-engine__release-workflow" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-2" x="365" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="385" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-2" data-slate-fit-padding="16">Release workflow</text>
<text x="385" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-engine__body-2" data-slate-fit-padding="16">on a version tag</text>
<text x="385" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-2" data-slate-fit-padding="16">Tests, verify:prod</text>
<text x="385" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-2" data-slate-fit-padding="16">Packs code, no content</text>
</g>
<g id="dk-engine__release" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-3" x="690" y="40" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="710" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-3" data-slate-fit-padding="16">Engine release</text>
<text x="710" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="dk-engine__body-3" data-slate-fit-padding="16">immutable, with a checksum</text>
<text x="710" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-3" data-slate-fit-padding="16">engine-1.4.0.tgz</text>
<text x="710" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-3" data-slate-fit-padding="16">sha256 and commit</text>
</g>
<g id="dk-engine__pin" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-4" x="40" y="290" width="270" height="130" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="60" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-4" data-slate-fit-padding="16">atiya.json</text>
<text x="60" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="dk-engine__body-4" data-slate-fit-padding="16">in the person's site repository</text>
<text x="60" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-4" data-slate-fit-padding="16">engine 1.4.0 and its sha256</text>
</g>
<g id="dk-engine__build" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-5" x="365" y="290" width="270" height="130" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="385" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-5" data-slate-fit-padding="16">The site's build</text>
<text x="385" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-engine__body-5" data-slate-fit-padding="16">reusable workflow at the commit</text>
<text x="385" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-5" data-slate-fit-padding="16">Their content, this engine</text>
</g>
<g id="dk-engine__app" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="dk-engine__body-6" x="690" y="290" width="270" height="130" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="710" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="dk-engine__body-6" data-slate-fit-padding="16">The app</text>
<text x="710" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="dk-engine__body-6" data-slate-fit-padding="16">one engine version inside</text>
<text x="710" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="dk-engine__body-6" data-slate-fit-padding="16">With its node_modules</text>
</g>
<text x="318" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">tag</text>
<text x="643" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">publishes</text>
<text x="835" y="244" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">bundled</text>
<text x="560" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">downloaded, checksum checked</text>
<text x="318" y="346" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">pins</text>
<text x="190" y="464" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">opens a site only at its own version; updating the pin is a commit it makes</text>
<g id="dk-engine__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M310 115 L355 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,115 355,120 355,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-engine__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M635 115 L680 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="689,115 680,120 680,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-engine__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M825 190 L825 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="825,289 830,280 820,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-engine__flow-4" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M760 190 L760 230 L500 230 L500 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="500,289 505,280 495,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-engine__flow-5" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M310 355 L355 355" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,355 355,360 355,350" fill="var(--color-neutral-fg-2)" />
</g>
<g id="dk-engine__flow-6" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M825 420 L825 480 L175 480 L175 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="175,421 180,430 170,430" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>One engine release, in two places: inside the app, and in every build of a person's site. The site's atiya.json pins it, and the app keeps the two in step.</figcaption>
</figure>

### 6.3 What a site repository holds

```text
<login>.github.io/
  atiya.json                 the engine pin, the ways to explore, the site's switches
  content/                   the content folder: articles, media, people, structures, site.json
  .github/workflows/site.yml calls the engine's reusable workflow at a pinned commit
  .gitattributes             content JSON at LF
  .gitignore                 .atiya/ (setup's state)
  AGENTS.md  README.md       for agents and for people
  private-pages/ .gitmodules only once private pages are set up (F8)
  modes/                     optional: the site's own navigation modes (modes §8.2)
```

`atiya.json`:

```json
{
  "schema": 1,
  "engine": { "version": "1.4.0", "sha256": "…", "commit": "…" },
  "contract": 1,
  "features": { "designLibrary": false, "docs": false },
  "owner": { "login": "ada", "id": 12345678 }
}
```

- **`engine`** is what CI downloads and checks; **`contract`** is the content contract's version, which migrations move (§10.3).
- **Which ways to explore are on** isn't here: it's content, `content/structures/ways.json`, written by edit mode's Ways to explore and by setup from the first run's choice ([modes §2](modes.md#2-the-site-and-turning-modes-on-and-off), decision D-W1).
- **`features`**: which of the engine's own parts the site publishes (the design library, the documentation).
- **The site's services aren't here either** (O15, D): the contact form's endpoint and the telemetry key are `services` in `content/site.json`, so the owner's site, built from source, and every managed site read them from the same place. Secrets are never there; an endpoint is an address, and a PostHog key is public configuration, set only if they turn telemetry on.

```json
"services": {
  "contact": { "endpoint": "https://…azurewebsites.net" },
  "telemetry": { "key": "phc_…", "host": "https://us.i.posthog.com", "site": "https://ada.github.io/" }
}
```

A build makes them the page's `PUBLIC_CONTACT_ENDPOINT`, `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`. The telemetry key is used only in a build for the address `telemetry.site` names (compared with `SITE_URL` and `BASE_PATH`, which both workflows set), so a local production build never sends anything, and nor does a copy of the site published at another address (the key is in the content, which a fork copies); a `--mode test` build never reads `services` at all (its endpoint is `.env.test`'s made-up host).

The workflow the app writes:

```yaml
name: Site
on:
  push: { branches: [main] }
  workflow_dispatch:
  schedule: [{ cron: '45 18 * * *' }]   # expiry dates take effect nightly
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  site:
    uses: prabinpebam/atiya/.github/workflows/site-build.yml@<commit of the engine release>
    secrets: inherit
```

The reusable `site-build.yml` (in this repository) does what `deploy.yml` does today with the engine release in place of a code checkout: check out the site (and its private submodule, if it has one, with the deploy key), download the release named in `atiya.json`, check its checksum and that its commit is the workflow's own (`job.workflow_sha`), `npm ci`, put the site's `content/` and `private-pages/` where the engine reads them, build quietly, seal, check for leaks and budgets, deploy. Pinning by commit means a moved tag can't change what runs with the person's secrets.

### 6.4 The owner's own site

Today he's a developer workspace: his repository is the engine's source and his site, built by `deploy.yml`. An engine release never holds his content or his own mode (`content/`, `private-pages/`, `modes/cozy-life/`; a test holds it), and his site turns on his own mode at `/play/`, so his visitors see no change.

**Decided (O15: D, stay on source, and prove both builds match).** His site keeps the source's tight feedback loop (edit the code, see it at once, publish from the same repository) and its address; his live site is never moved. What everyone else gets is proven instead ([plan stage 10](plan.md#stage-10-one-engine-two-builds)):

- **One build script.** `deploy.yml` and `site-build.yml` both run `scripts/build-site.mjs` (build quietly, check the sealer ran, check for leaks, check the budgets), so the two can't drift. It's in every engine release.
- **The same settings path.** A site's services (the contact form's endpoint, the telemetry key) are content: `services` in `content/site.json`, read by every build the same way, from source or from a release. Nothing comes from the engine's `.env` or its repository's variables any more.
- **A parity check.** `scripts/build-parity.mjs` builds one content folder twice from one commit: from the source, as `deploy.yml` does, and through that commit's engine pack, as `site-build.yml` does. It compares the two outputs file by file, with only the sealer's random parts normalised, and allows exactly one difference: `docs/`, which no release carries. It runs on his content (with his private pages, in CI) on every push to `main`, beside the deploy and never blocking it, and on the starter in every release.
- **A canary site for the release path.** What he doesn't use every day (the first run, Update your site, `site-build.yml` on a real repository) is tested on a second site of his, made with the app and moved to each new release before anyone else gets it (§10.3).
- **His own mode** goes through the consumer path once the planet is split (M3): Cozy life is built as a site's own mode (modes §8.2) in both builds, so the parity check covers it.

His content stays apart (`content/`, `private-pages/`), so a move to a content-only repository stays possible later; the options weighed are in O15.

## 7. The app's architecture

### 7.1 Processes

| Process | Runs | May | May not |
|---|---|---|---|
| **Main** (Electron, Node) | Windows, setup, the GitHub client, the keychain, git, the server's supervisor, updates | Read the token; call GitHub; start and stop the server | Render remote content; run the site's code |
| **Views** (sandboxed) | The frame and setup from `app://`; edit mode and the site preview from the server's loopback origin | Call a narrow bridge (§7.4) | Use Node; leave their origin; read the token |
| **Server** (a utility process for a managed site; the system's Node for a developer workspace) | `astro dev` with edit mode, on `localhost:<port>` | Read and write the workspace through edit mode's store; run git for Save to remote with a token handed to each call | Keep the token; listen beyond loopback; answer a managed site's requests without the launch token |
| **Tools** | git and ffmpeg (bundled for managed sites) | What edit mode asks of them | Prompt; read the person's global git configuration |

### 7.2 The window

- **One window** with two views: the **frame** (`app://`), which draws the window itself and its one title bar row, and the **body**: setup (`app://`) or edit mode (`http://localhost:<port>/_edit/`), an inset card under the bar.
- **The app's own window** (plan stage 7A). On Windows and Linux there's no system title bar or menu bar: the window is transparent and frameless, with 20 px corners (`--radius-lg`), a shadow and a 16 px margin round it whose clicks pass through to what's behind. The shadow is drawn inside that margin, and the window's own bounds clip anything past it, so it's made from the margin (its offset, spread and blur reach at most the margin on every side), never a general shadow token: one that reached further would end in a hard line at the margin's edge. The app moves it by the bar, resizes it from every edge and corner, snaps it at screen edges with a preview, fills the work area's height at its own width and place when its top or bottom edge is dragged to that edge of the screen (the bottom counts at the taskbar too) or double-clicked, as Windows does (a move by the bar, or another double-click, puts its height back), maximizes and restores it (square corners, no margin), offers Snap Layouts on Maximize (a moment's rest, or ↓), keyboard Move and Size, and full screen (F11), and remembers its place (`window.json`). A system maximize (Win+↑) becomes the app's own. On macOS it's the system's window, its traffic lights inset into the same row. `--native-window` (or `ATIYA_WINDOW=native`) asks for the system's frame anywhere.
- **One title bar row.** At the start: the logo, which opens the app's menu (also Alt+Space, or a right-click on the bar: the commands the menu bar had, and the window's); the title; Edit mode | Site, a segmented control (a radio group); Open in browser, an icon button; the dev server, a dot whose colour is its state (its name says it), opening a popover with the site, its address, what went wrong and its last log lines, and Restart or Use it. Then the colour theme (one for the whole app, below), then the screen's own title (an article's breadcrumb, its status tags). At the end: the screen's own controls (its tools, the save status, the Tests status, Save to remote), going live and its actions (Open my site, See why, Check my site), then Minimize, Maximize or Restore, and Close. The taskbar names the site. A popover drops over the body: the frame's view comes on top while it's open.
- **Edit mode's header is in the row** (plan stage 7B), so there's never a second row. The app's view asks edit mode with an `X-Atiya-Studio` request header; edit mode then draws no header of its own (`data-studio`), keeps it in the page hidden, and describes it to the app (its title, then its controls, in order: plain words, icons by name, states; `src/site/editor/scripts/studio.ts`) whenever it changes. The row draws that description with the app's own controls, and each one asks edit mode to press the original (a choice, the theme, is applied as its own list would), so whatever a screen puts in its header works as it did. The bridge for this is edit mode's alone (`window.atiyaStudio`, only on the dev server's `/_edit/` pages): it can publish a description and hear commands, nothing else, and the main process checks both (`src/core/studio-header.mjs`). A set of toggles that pick one of several (the article's Desktop, Tablet and Phone widths) is described as one choice, drawn as a single button with a small menu, and the line saying what became of the last save to remote stays out of the row. A full row squeezes by priority: the app's name steps aside for the screen's title, then the save status and the Tests status lose their words (kept in their names), then the screen's tags. The row follows the theme chosen in edit mode. In a browser, edit mode keeps its own header.
- **Who's signed in, and which site is open** (plan stage 7C): the row's last item before the window's controls is the account button: the GitHub avatar (or initials, or a person icon when signed out) and the open site's name, named in full for screen readers ("Ada Lovelace, signed in to GitHub as ada"). It opens a popover: the GitHub account (name and @login) with **Sign out**, or **Sign in with GitHub** when signed out; then **Your sites**, every site the app remembers (several can share one GitHub account), each with its address, the open one first and marked, and a press opening another; then Make a new site, Open my existing site and Open a source folder. Signing out asks once, inline (Stay signed in, Sign out), forgets the stored token, and starts a managed site's server again without it; signing in from the menu is setup's sign-in (the device flow, or the GitHub CLI's token until the OAuth App exists) and comes back where it was. A source checkout saves to remote with the computer's own git sign-in, and the popover says so. A path is never shown for a site the app made.
- **One colour theme for the whole app** (plan stage 7D): Match the system, Light or Dark, chosen from the title bar's left group (after the server's dot) and remembered. It sets Electron's `nativeTheme`, which every view follows, and the site's own theme storage on the dev server's origin (`site.theme`), which the site and edit mode read before their first paint, so they never choose a theme of their own in the app: their switches are hidden there, and edit mode leaves its own out of the row. The documentation (Slate, at `/docs/`) keeps its own stored choice (`slate-theme-pref`), so in the app that choice is set to follow (auto, which follows `nativeTheme`), its `data-theme` set to the app's theme at once, and its toggle hidden (`docsThemeScript` in `src/core/theme.mjs`). In a browser, the site, edit mode and the documentation keep their switches.
- **The body is a card,** inset by `--space-2` with corners following the window's: a view can only round its four corners alike, so it can't meet the window's rounded edges.
- **Edit mode is unchanged.** The frame adds only what edit mode can't know: the account, which site, going live, updates.
- **The site's state** in the frame: Starting edit mode…; Saved; Going live; Live; Didn't publish (with the step); Offline.
- **Navigation is locked.** A view navigates only within its own origin; any other link opens in the system browser. Edit mode uses `localhost`, never `127.0.0.1`, so YouTube embeds play.
- **Closing the window** keeps the app in the system tray (the server stays up) unless turned off in Settings; **Quit** stops the server after any write in progress.
- **The frame and setup** are static pages in the app, styled with the site's own semantic tokens (`src/site/styles/tokens.css`, copied at the app's build) and fonts, following the system's light or dark mode and the site's copy rules. Rebuilding them from the site's compiled components is a later step (§14, O13).

### 7.3 The server process

- **Started** by the supervisor with the workspace's paths (`CONTENT_ROOT`, and `PRIVATE_ROOT` when private pages exist), a free port (`--port <n>`, host `localhost`), and its caches in the app's data folder (`ATIYA_CACHE_DIR`, read by `dev-isolation.mjs`). For a managed site it's `utilityProcess.fork` on the bundled engine's `astro` entry (Node 24, inside Electron 44); for a developer workspace, the checkout's own `astro dev` under the system's Node, on 4321.
- **Ready** when it answers; until then edit mode's own first-start page shows progress.
- **Supervised:** a crash restarts it after 1, 2, then 4 seconds, then the frame says what happened, with **Restart** and the last lines of its log. Unsaved typing survives, as across any dev server restart.
- **The launch token** (managed sites): the guard ([edit mode §8.2](../editor/spec.md#82-the-request-guard)) also requires `X-Atiya-Launch: <token>`, new every launch; the main process adds it to its views' requests to the server's origin. A browser tab or another program gets 403.

### 7.4 The bridge

| Call | Who may | Does |
|---|---|---|
| `setup.state`, `setup.start(inputs)`, `setup.retry`, `setup.onEvent` | `app://` | Drives setup (§4) |
| `account.state`, `account.signOut` | `app://` | Who is signed in |
| `sites.list`, `sites.open`, `sites.clone` | `app://` | The site switcher, an existing site |
| `server.status`, `server.restart`, `server.onStatus` | `app://` | The frame's state and Restart |
| `open.external(url)` | `app://` | `https:` URLs only, in the system browser |

### 7.5 Git and GitHub

- **Sign-in** is the device flow of an OAuth App the owner registers (`Atiya Studio`), with the `repo`, `workflow` and `user:email` scopes, as GitHub Desktop does. Its token goes to the system keychain through `safeStorage` (DPAPI on Windows, the Keychain on macOS). A GitHub App, which can be narrowed to the repositories it makes, replaces it once a spike shows it can do every step for a brand-new account (O8).
- **git** for managed sites is a portable git the app ships, with `GIT_CONFIG_NOSYSTEM=1` and its own global file: `user.name` their name, `user.email` their no-reply address (`<id>+<login>@users.noreply.github.com`), `core.autocrlf false`, no credential helper. Their own git settings are never read or changed.
- **The token reaches git only as a header for one call** (`GIT_CONFIG_COUNT` with `http.https://github.com/.extraheader`), as `actions/checkout` does: never in a URL, an argument, a file or a log. Edit mode's Save to remote gets it from the main process per push, in memory only.
- **Edit mode's rules stay:** never force, never prompt, a failed push leaves the commit with Push again.

### 7.6 The developer workspace

- **Open a source folder** (File menu, or offered by itself when the app is started from a checkout) checks it's an engine checkout (`package.json`'s name, `astro.config.mjs`, `node_modules/astro`) and remembers it.
- The app runs the checkout's own `astro dev` on 4321 under the system's Node and git, with the owner's credentials, as `npm run dev` does. No launch token: a browser tab on `localhost:4321`, the E2E tooling and agents work as before.
- If 4321 is already taken, the frame names the process and offers **Use it** (edit mode on that server) or **Try again**.
- It replaces `serve.ps1`; AGENTS.md says "run the site" means the app when it's installed.

## 8. Security and privacy

| Threat | Defence |
|---|---|
| Another program or a web page drives a managed site's edit mode, and its push | The launch token; loopback only; the existing guard (Host, Origin, `X-Editor`, `Sec-Fetch-Site`); framing refused |
| Content in edit mode gets Node or the token | Sandboxed views, context isolation, no Node, navigation locked; the bridge only for `app://`; the token never in a view |
| The token is stolen from disk or a log | Keychain only; never in a file, an argument, a URL or a log; a redactor on every log line, unit-tested |
| An agent's run does something unasked | The CLI changes nothing without `--yes`; `--dry-run` runs every check and changes nothing |
| The engine or its workflow is changed under a site | Pinned by commit; the release checked against `atiya.json`'s checksum |
| Private content leaks through the new build | The same sealer and leak check in `site-build.yml` before upload; the build log stays in the runner |
| The deploy key is copied | Read-only, on the private repository only; its private half exists only in memory while it's sealed into the secret; **Replace the key** in Settings |
| A fake update | A signed app and signed updates |
| The app reports on people | Nothing is sent to us; crash reports are a GitHub issue they see before sending |

Electron's checklist applies: context isolation, the sandbox, no Node in views, a content security policy for `app://` (served by `protocol.handle` from a fixed list), permission requests refused, and, for the shipped app, the fuses off (`runAsNode`, Node options, the inspector) and the archive's integrity checked.

## 9. A person's site

### 9.1 What's on

| Part | The owner's site | A managed site |
|---|---|---|
| The site: sections, pages, galleries, video, PDFs | Yes | Yes |
| Edit mode, Save to remote, Publish | Yes | Yes |
| Private pages, codes and links, the agreement | Yes | Yes, set up on first use (F8); the agreement's email needs the contact relay |
| Ways to explore | Cozy life, his own mode | None, or any built-in mode ([modes](modes.md)) |
| Chopper, the family, Prabin, his music | In his mode | Not in Little planet (O5, O6) |
| Contact form | His service | Off by default; the shared relay if offered (O7) |
| Telemetry | His PostHog | Off; their own PostHog key in Settings |
| The design library and the documentation | Yes | Off |
| Site icons (Font Awesome Pro) | His licence | A decision before release (O4) |

### 9.2 Out of the code, into content

Every place the engine names its owner reads the site's own settings instead (`SITE_NAME`, the default descriptions, `play.astro`'s brand, `SITE_PARENT_DOMAIN`, `Moved.astro`); a test fails on his name or handle in engine source outside the starter and the stories.

### 9.3 The starter

`starter/` in this repository: a valid content folder with seven sections (About, Work, Approach, Writing, Speaking, Projects, Contact), a few sample pages written as instructions, a person and the site's settings with placeholders setup fills, and a structure for each built-in mode. Setup copies the parts their choices need (no `planet.json` for just the site; no sample pages without samples) and writes their name. A unit test loads every combination through the content contract.

### 9.4 GitHub's limits

- **Pages:** a site of at most 1 GB, about 100 GB of traffic a month, published only from a public repository on GitHub Free.
- **Files:** git refuses a file over 100 MB; edit mode keeps a video under it.
- **The nightly build stops after 60 days without a commit** (GitHub turns off a public repository's schedules). For a managed site the reusable workflow skips the owner's activity guard; the app turns the schedule back on when it opens a site, and while any grant has an expiry date it offers **Keep expiry dates working** (an empty commit). Withdraw now still takes effect at once.

## 10. Versions and updates

### 10.1 The engine release

A tag `engine-v<version>` runs `release.yml`: the unit tests, `npm run check`, `verify:prod` on the starter, the parity check on the starter (§6.4: its source build and its build through this commit's engine pack match), then `engine-<version>.tgz` (code, lockfile, `public/`, generated assets, built-in modes, the mode kit, the starter, the shared build script; never `content/`, `private-pages/`, `modes/cozy-life/`, `assets-src/`, `documentation/`, `tests/`) with its sha256 and commit, as a release asset. Semver: a major version needs a content migration.

### 10.2 The app's release

One engine release, its production dependencies installed per platform, a portable git and an ffmpeg without GPL parts, packed per user on Windows (no administrator) and as a notarized disk image on macOS. Auto-update downloads in the background and applies at the next restart, never during a write or a save to remote.

### 10.3 Moving a site to a newer engine

The app opens a site only at its own engine version. **Update your site** runs the content migrations through the store, writes the pin and the workflow's commit, commits and saves to remote, and follows the build; if it fails and no migration ran, **Go back** restores the pin.

**The canary goes first** (O15, D). The owner keeps a second site of his own, made with the app like anyone's, with the starter's samples, private pages and Little planet on. Each new release is installed and the canary moved to it (Update your site), built by `site-build.yml` and looked at before the release is offered to anyone else: the release path his own site, built from source, never takes.

## 11. Packaging and platforms

- Windows 10 and 11 first (x64, then arm64), then macOS; Linux later.
- Electron 44.6.0 (Node 24; the newest stable the package feed carries), pinned exactly.
- An installer under 250 MB, measured once the engine is bundled: the preview installer (plan stage 9P) is 209 MB. It installs per user with no administrator, and carries the engine as one archive the app unpacks on its first start (into its own data folder, one folder per release), because an installer writing the engine's 29,000 files one by one took more than ten minutes.
- Signing: Azure Trusted Signing (Windows), Developer ID and notarization (macOS). A new signed app still meets SmartScreen's warning until it builds reputation, so the download page shows it.
- The app is built on GitHub Actions runners per platform; on the owner's managed laptop, `apps/desktop` installs through the package feed proxy.

## 12. Accessibility and copy

- Setup and the frame: the site's tokens, sentence case, verbs on buttons, the glossary; axe in light and dark; keyboard alone; the device code is selectable text, announced when it appears.
- No developer words before edit mode: never repository without saying what it is, never a path, never git. "Save to remote" appears only inside edit mode, as today.
- Every wait shows its progress where it happens ([edit mode §2.2](../editor/spec.md#22-never-a-silent-wait-progress-where-it-happens)).

## 13. Costs

| Who | What | Cost |
|---|---|---|
| A person | GitHub Free: a public repository with Pages and Actions, a private one | Nothing |
| The owner | Windows code signing | About US$10 a month |
| The owner | Apple Developer Program, for macOS | US$99 a year |
| The owner, if offered | The contact relay | Cents to a few dollars a month |
| The owner | The OAuth App, releases, the reusable workflow | Nothing |

## 14. Decisions

Working defaults, used by the build until the owner decides otherwise:

| # | Decision | Working default | Open until |
|---|---|---|---|
| O1 | The app's name | Atiya Studio | Before the first public release |
| O2 | Where the engine lives | B: content and a pinned engine | Decided |
| O3 | A licence for the engine | None yet: nothing ships to anyone else until it's chosen | Before the first public release |
| O4 | The site icons for managed sites | Font Awesome Free behind the same `iconData.ts`, unless the Pro licence allows other people's sites | Before managed sites ship |
| O5 | Who greets visitors in Little planet | The site owner's own avatar, on the player characters' rigs | Stage 8 |
| O6 | Little planet's music | Ambient sounds only | Stage 8 |
| O7 | The contact form | Off; the shared relay, opt-in, later | Before managed sites ship |
| O8 | Sign-in | An OAuth App (device flow); a GitHub App if a spike proves it | Stage 5 |
| O9 | Platforms | Windows first | Stage 9 |
| O10 | Crash reports | A pre-filled GitHub issue | Stage 9 |
| O11 | Telemetry for the app | None | — |
| O12 | Navigation modes' own decisions | As recommended in [modes §12](modes.md#12-open-decisions) | Stage 8 |
| O13 | The app's own screens | Static pages on the site's tokens; the site's compiled components later | Stage 9 |
| O14 | The access agreement's words name the owner ("and Prabin is told") | Change them to "and the site's owner is told" with a new `AGREEMENT_VERSION` (every current reader agrees again), or keep them for the owner and give managed sites their own | Before private pages ship to managed sites (stage 5) |
| O15 | Whether and how the owner's site tests the consumer version without losing the source's tight loop (§6.4) | D: stay on source, with one build script for both, the same settings path and a CI check that both builds match, plus a canary consumer site; A, B, C: move to a content-only repository at the same address (names swapped), the root address or a custom domain (every engine change would reach his site only through a release); E: a content-only repository built against his local engine (two repositories to agree on every live change) | **Decided 2026-10-14: D.** His live site never moves; a second site tests releases |

## 15. Critique of v1, and what changed

v1 was written from the architecture outwards. Read as a newcomer, and as an agent:

| # | v1 | Problem | v2 |
|---|---|---|---|
| C1 | Started with processes and repositories | No promise to hold the design to, nothing measurable | §1 promises with targets, §2 jobs, §3 what people can do, then decisions; the promises are the project's Definition of Done |
| C2 | Twelve setup steps on screen, with a username screen and availability checks | Many decisions before anything happens; most are answered by defaults | Three choices (§4.1); defaults from their GitHub profile; GitHub's own sign-up asks the username (F11) |
| C3 | Sign-in and sign-up as separate paths | Two places to get lost | One button (F1); GitHub's page offers sign-up |
| C4 | A private repository, deploy key and secret at setup | Slower, more permissions, more to fail, for something most people use later | Set up on first use (F8) |
| C5 | Setup waited for the first build | Minutes of watching a progress bar | Edit mode opens after the first push; going live in the background (F9) |
| C6 | Workspace in Documents | OneDrive locks git's files on many Windows machines | `<home>/Atiya/` (F10) |
| C7 | Only a person could set up a site | Agents can't click through screens | The CLI over the same machine, JSON events, exit codes, `--yes` and `--dry-run`, tokens from the environment or the GitHub CLI, and `AGENTS.md` in every site (§5) |
| C8 | A GitHub App as the default | An unproven path for a new account (installation scope for repositories it makes) | An OAuth App's device flow, proven by GitHub Desktop; a GitHub App only once proven (O8) |
| C9 | Open decisions blocked the start | Nothing could be built | Working defaults (§14), each with when it must be settled |
| C10 | The app's screens to be compiled from the site's components | A build pipeline before the first screen | The site's tokens in static pages now; components later (O13) |

## 16. As built

On the `desktop-app` branch, stage by stage ([plan §6](plan.md#6-status) has the evidence).

- **The app** is `apps/desktop/`: Electron 44.6.0 (Node 24), plain ES modules with JSDoc types, no bundler. Pure parts in `src/core/` (the supervisor, the folder check, the view rules, settings, and the setup machine in `src/core/setup/`), Electron in `src/main/` (the main process, the first run's `SetupFlow`, the token store, the preload), the pages in `src/ui/`, styled with the site's own tokens and fonts, copied in by `scripts/sync-ui.mjs` when the app starts (never committed twice).
- **The owner's app** (stage 1) runs his checkout's own `astro dev` on 4321 under the system's Node; a managed site's runs the engine's `astro dev` with `CONTENT_ROOT` at its workspace on 4325, so the two never collide.
- **A managed site** (stage 7) runs on the bundled engine (`apps/desktop/engine/`, from a release by `scripts/bundle-engine.mjs`; the checkout the app runs from when there is none) under `utilityProcess.fork`. Setup, sync and the server's own git use the bundled git (dugite 3.2.3, git 2.53). Astro writes its own `.astro/` folder in the engine, so the engine isn't strictly read-only: the installer (stage 9) must put it where the person can write, a per-user install. For real GitHub, the token reaches the managed server's git as configuration in that one process's environment (`GIT_CONFIG_COUNT` with the extra header), for its life rather than per push (§7.5): edit mode's push runs git itself, and a per-push hand-over would need a bridge into the server. It's still never in a URL, an argument, a file or a log.
- **A new site name, or a way to explore turned on or off, restarts the dev server** once edit mode has had no write in flight for 1.5 s (reads, some of them streams, aren't counted).
- **Private pages on first use** (stage 5) are `src/core/setup/private.mjs`, run by `atiya private setup` and by the app's `private.html`, which a managed site's edit mode links to (`src/site/editor/model/desktop.ts`) wherever it would offer the access choice. The repository is `<site repository>-private`; the deploy key is titled "Atiya Studio: the site build reads private pages", and a missing key or secret makes both again (the private half is never kept). When it's done the server starts again, because it reads `private-pages/` from its start.
- **Quitting** is graceful: Chromium keeps the key that safeStorage encrypts the token with in `Local State`, written on its way out, so `app.exit()` would lose the token at every quit. A crash before the first quit can still lose it: the person signs in again.
- **The CLI** (stage 2) is `apps/desktop/bin/atiya.mjs`; the fake GitHub, `src/core/setup/fake-github.mjs`, is a real HTTP server with real bare git repositories, used by the tests and by `npm start -- --fake-github`.
- **The starter** (stage 2) is `starter/content/`: seven sections (About, Work, Approach, Writing, Speaking, Projects, Contact), the planet's seven buildings mapped to them, and four sample pages written as instructions.
- **Setup's state** is the machine's checks: every run checks every step, so the state file (`.atiya/setup.json`) only records what was made; the app also remembers an unfinished setup's choices and resumes it at launch.
- **Sign-in** uses the device flow when the app has an OAuth App's client ID (`ATIYA_GITHUB_CLIENT_ID`, stage 5); until then the app and the CLI sign in with the GitHub CLI's token or `GH_TOKEN`.
- **The site's identity and features** (stage 4) come from the content: the name from `content/site.json`, the planet from the ways file (`content/structures/ways.json`, stage 8A; without one, from the presence of `content/structures/planet.json`), the design library and documentation from `atiya.json` (on for the engine's own repository, which has none). A site without the planet builds (it used to fail) and ships none of the planet; `/play/` sends home when it never had one, and is the "not offered" page of [modes §2](modes.md#2-the-site-and-turning-modes-on-and-off) when the planet is turned off.
- **The app's own window** (stage 7A): the geometry, the placement and the window controller are pure modules ported from the owner's focus-notes (`src/core/window/`: `geometry.mjs`, `placement.mjs`, `custom-window.mjs`, unit-tested with stand-ins for Electron); `src/main/window-frame.mjs` builds the window, its snap preview and the window's IPC, answered for the frame's page alone. The frame's page (`frame.html`) covers the whole window and paints everything but the card: a transparent, rounded hole whose spread shadow is the window's surface. `sync-ui` brings the site's favicon (the logo) and the icons the bar uses from the site's icon set.
- **Edit mode's header in the row** (stage 7B): `EditorLayout` reads the `X-Atiya-Studio` request header (`data-studio`; the header row hidden, its grid row gone) and runs `scripts/studio.ts`, which reads the hidden header (`readHeader`), publishes it on every change (a `MutationObserver`, at most once a frame) and runs commands (`runCommand`: a click, or a Select's `select-change`). The app adds the request header to its body view's requests to the dev server, and its frame draws the description (`frame.js`: the context after the start group, the controls before the end group, a menu for a choice); `sync-ui` brings the site's whole icon set, by its own names and by Font Awesome's. Test and script launches (`ATIYA_BACKGROUND=1`) show the window without taking focus.
- **One engine, two builds** (stage 10, O15: D): `scripts/build-site.mjs` is the one build-and-check script (`deploy.yml`, `site-build.yml`, `site-build-local.mjs`); `integrations/services.mjs` makes `content/site.json`'s `services` the build's `PUBLIC_*` variables (none in a test build; the telemetry key only in a build for the address `services.telemetry.site` names); `scripts/build-parity.mjs` with the pure comparison `scripts/lib/parity.mjs` builds one site both ways and compares (the sealer's build ID, key IDs, ciphertexts and media names normalised to their shapes; private pages and sealed files counted, never named); `parity.yml` runs it on every push to `main` with the private pages, and `release.yml` on the starter. Setup's `atiya.json` now carries `features: { designLibrary, docs }`, and a site's services are content. The owner's endpoint left `.env` (deleted) for his `content/site.json`, and the PostHog key the repository's variables (`deploy.yml` passes none); `deploy-contact-api.ps1` writes the endpoint there.
- **Found on the way, for later stages:** the access agreement still names the owner (O14). The planet's host and characters are the owner's until stage 8 (O5).
