# Home page views

The home page has one job: a hiring manager or recruiter who lands on it should leave with a complete, correct picture of what the owner can do, and enough confidence to shortlist him. These pages design several ways to present that home page, called **home views**. Every view reads the same content, the **capability spine**, and shows it at three levels of detail. A visitor can switch views at any time, and the site has a default. The views were designed on the owner's site and are specified for every site Atiya makes: anyone's strengths, proof found in their own pages, and the controls to curate it. They're being built in stages: Bento, Cover, Proof grid and Spotlight are built and offered at their own addresses, and the [plan](plan.md) says what's built and what's next.

> **TL;DR.**
> - **The failure to design against:** a hiring manager misses a strong capability that the site *does* show. So every view puts all six capabilities on its first screen, with no click, and a test holds that (the coverage rule, [foundation §5](foundation.md)).
> - **Three levels in every view:** L1, the map (all six capabilities, about 10 seconds); L2, the signal (a proof line, a picture, a voice); L3, the detail (the evidence, opened in place). Full pages are one step further ([foundation](foundation.md)).
> - **One spine, seven views:** Bento, Cover, Spotlight, Showreel, Keywords, Proof grid and Questions all read one curated file of capabilities and their proof. Little planet stays a separate way to explore, at `/play/`.
> - **The recommended default is Bento:** the highest coverage and scan speed for the least risk. Cover and Proof grid come next, then Showreel as the high-impact option the visitor chooses (§6).
> - **Switching is a visitor's choice, kept on their device,** with a link per view so a recruiter can share the one they like ([switcher](switcher.md)).
> - **The biggest finding isn't a layout:** AI transformation and product strategy, two of the strongest capabilities, rest mostly on résumé lines. Short proof pages for them would lift every view ([foundation §4](foundation.md)).
> - **For every site, not only the owner's:**
>   - a goal (Get hired, Win clients, Share my work), 3 to 6 strengths, and proof the rules find in the person's published pages ([for every site](for-every-site.md));
>   - curated by rules that are reproducible and explain every pick, with pins and hides on top ([curation](curation.md)); AI helps only while the person edits, and every word it proposes is quoted from their own pages ([AI curation](ai-curation.md));
>   - made on one edit mode screen, Home, with a first run of about ten minutes ([owner flows](owner-flows.md)), and controls in three layers so the first run needs three answers ([controls](controls.md)).

<figure class="slate-figure" data-diagram="home-overview">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 630" role="img" aria-labelledby="hv-overview__title hv-overview__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-overview__title">Home page views: one capability spine, many ways to present it</title>
<desc id="hv-overview__desc">The site's content feeds a capability spine: six capabilities, each with its proof, plus highlights, voices and facts. An optional role lens reorders the spine without hiding anything. Every home view reads the same spine and presents it its own way: Bento, the default, then Cover, Spotlight, Showreel, Keywords, Proof grid and Questions. Little planet stays a separate way to explore, at /play/. Every view shows three levels of detail, and the résumé, contact and Change view are always one action away.</desc>
<g id="hv-overview__content" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-1" x="40" y="40" width="270" height="130" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-1" data-slate-fit-padding="16">content/</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-1" data-slate-fit-padding="16">pages, résumé, voices</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-1" data-slate-fit-padding="16">Published open pages only</text>
<text x="60" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-1" data-slate-fit-padding="16">Never a private page</text>
</g>
<g id="hv-overview__spine" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-2" x="365" y="40" width="270" height="130" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="385" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-2" data-slate-fit-padding="16">The capability spine</text>
<text x="385" y="94" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-overview__body-2" data-slate-fit-padding="16">showcase.json</text>
<text x="385" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-2" data-slate-fit-padding="16">Six capabilities, each proved</text>
<text x="385" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-2" data-slate-fit-padding="16">Highlights, voices, facts</text>
</g>
<g id="hv-overview__lens" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-3" x="690" y="40" width="270" height="130" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="710" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-3" data-slate-fit-padding="16">The role lens</text>
<text x="710" y="94" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-overview__body-3" data-slate-fit-padding="16">?for=leader|ai|strategy</text>
<text x="710" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-3" data-slate-fit-padding="16">Reorders, never hides</text>
<text x="710" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-3" data-slate-fit-padding="16">Shown as a chip you can clear</text>
</g>
<g id="hv-overview__views" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-4" x="40" y="220" width="920" height="290" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-4" data-slate-fit-padding="16">Home views</text>
<text x="172" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-4" data-slate-fit-padding="16">at / and /views/&lt;id&gt;/: one way to present the home, chosen by the visitor</text>
<rect id="hv-overview__body-5" x="60" y="280" width="205" height="96" rx="14" fill="var(--color-brand-bg)" />
<text x="76" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-5" data-slate-fit-padding="16">Bento</text>
<text x="76" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-overview__body-5" data-slate-fit-padding="16">the default</text>
<text x="76" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-overview__body-5" data-slate-fit-padding="16">Every capability at once</text>
<rect id="hv-overview__body-6" x="285" y="280" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="301" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-6" data-slate-fit-padding="16">Cover</text>
<text x="301" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-6" data-slate-fit-padding="16">a magazine cover</text>
<text x="301" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-6" data-slate-fit-padding="16">Six cover lines</text>
<rect id="hv-overview__body-7" x="510" y="280" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="526" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-7" data-slate-fit-padding="16">Spotlight</text>
<text x="526" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-7" data-slate-fit-padding="16">one highlight at a time</text>
<text x="526" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-7" data-slate-fit-padding="16">Every item on the rail</text>
<rect id="hv-overview__body-8" x="735" y="280" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="751" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-8" data-slate-fit-padding="16">Showreel</text>
<text x="751" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-8" data-slate-fit-padding="16">a 90-second film</text>
<text x="751" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-8" data-slate-fit-padding="16">Chapters you can jump</text>
<rect id="hv-overview__body-9" x="60" y="392" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="76" y="424" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-9" data-slate-fit-padding="16">Keywords</text>
<text x="76" y="446" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-9" data-slate-fit-padding="16">pick what you hire for</text>
<text x="76" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-9" data-slate-fit-padding="16">Results by your picks</text>
<rect id="hv-overview__body-10" x="285" y="392" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="301" y="424" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-10" data-slate-fit-padding="16">Proof grid</text>
<text x="301" y="446" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-10" data-slate-fit-padding="16">capability by evidence</text>
<text x="301" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-10" data-slate-fit-padding="16">Every claim, its proof</text>
<rect id="hv-overview__body-11" x="510" y="392" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="526" y="424" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-11" data-slate-fit-padding="16">Questions</text>
<text x="526" y="446" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-11" data-slate-fit-padding="16">the nine questions</text>
<text x="526" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-11" data-slate-fit-padding="16">Answers with evidence</text>
<rect id="hv-overview__body-12" x="735" y="392" width="205" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="751" y="424" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-overview__body-12" data-slate-fit-padding="16">Little planet</text>
<text x="751" y="446" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-overview__body-12" data-slate-fit-padding="16">a mode, at /play/</text>
<text x="751" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-12" data-slate-fit-padding="16">Explore as a game</text>
</g>
<g id="hv-overview__levels" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-13" x="40" y="540" width="450" height="64" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="566" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-overview__body-13" data-slate-fit-padding="16">Every view, three levels</text>
<text x="60" y="590" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-13" data-slate-fit-padding="16">L1 the map · L2 the signal · L3 the detail</text>
</g>
<g id="hv-overview__always" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="hv-overview__body-14" x="510" y="540" width="450" height="64" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="530" y="566" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-overview__body-14" data-slate-fit-padding="16">Always one action away</text>
<text x="530" y="590" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-overview__body-14" data-slate-fit-padding="16">Résumé · Contact me · Change view</text>
</g>
<text x="512" y="202" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">feeds every view</text>
<g id="hv-overview__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M310 105 L355 105" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,105 355,110 355,100" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-overview__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M690 105 L645 105" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="636,105 645,110 645,100" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-overview__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M500 170 L500 210" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="500,219 505,210 495,210" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>One capability spine, many ways to present it. Every view shows three levels, and the résumé, contact and Change view are always one action away.</figcaption>
</figure>

## 1. The problem

The home page is a first impression with a hard time limit. Recruiters spend about 7.4 seconds on a first pass over a résumé ([Ladders eye-tracking study](https://www.theladders.com/career-advice/why-do-recruiters-spend-only-7-4-seconds-on-resumes)), and a portfolio's home page gets a similar glance before the visitor decides whether to go on. The owner's range is wide: design leadership, product strategy, AI transformation, hands-on making, craft and storytelling, and systems. A wide range is a strength, but on a home page it's also a risk: whatever doesn't fit the first glance is missed.

Today the home page is a hub of sections, and its summary says the site is under construction. The sections are the right place for the full content ([sections spec](../sections/spec.md)), but the home page doesn't yet say *what the sections prove*. The views below each answer the [nine questions hiring visitors ask](../ia-navigation/01-goals-audiences-and-journeys.md) in a different way.

## 2. Who it's for

| Persona | Priority | Time they give it | What they need to see | Success looks like |
|---|---|---|---|---|
| **Recruiter** (in-house or agency) | P1 | 10 to 60 seconds | Level, title, years, the positioning, the keywords their role needs, the résumé | Forwards the profile to the hiring manager, or downloads the résumé |
| **Hiring manager** (a design director or VP, or a product leader hiring design) | P1 | 1 to 5 minutes | What kind of leader he is, outcomes he influenced, what he personally led or made, how he uses AI | Shortlists him, or writes to him |
| **Interview panel** (product, engineering, design peers) | P2 | 5 to 15 minutes, before the loop | Specific work, how he works with partners, what's public and what isn't | Arrives with sharper questions |
| **General audience** (designers, peers, event organisers) | P3 | Browsing | The making, the writing, the community work | Reads a piece, follows, invites him to speak |
| **Returning visitor** (a hiring manager before the interview, or a colleague they shared it with) | Any | Short, targeted | The same thing they saw last time, fast | Finds it in one step |

The audiences and priorities follow the [goals, audiences and journeys](../ia-navigation/01-goals-audiences-and-journeys.md) page of the IA work.

**The people who make the home page** are a second audience: everyone who makes a site with Atiya Studio, from a student with three projects to a writer with two hundred notes. Their goals differ (getting hired, winning clients, sharing their work), and most will give the home page ten minutes, once. Their personas and what each needs are on [Home views for every site §1](for-every-site.md); their scenarios and flows on [Making your home page](owner-flows.md).

## 3. Goals and outcomes

| Goal | Outcome we can observe | Target |
|---|---|---|
| Every capability is seen | Each of the six capabilities is visible on the first screen, at 1280 px and at 360 px, with no action | 100% of views, held by a test |
| Every capability is remembered | Capability recall after 60 seconds, in a moderated test | At least 4 of 6 |
| The visitor knows whether to dig deeper | First-click test: the click lands on the capability the task names | At least 80% |
| The shortlist happens | Résumé opens, résumé downloads and contact opens, per visit | Measured from launch; the default should beat the current home |
| The first impression holds | Visits that leave within 10 seconds | Under 10% |

How each is measured is on [How we'll know](evaluation.md).

## 4. Design principles

1. **The map before the story.** All six capabilities come first, before any highlight, film or choice (L1).
2. **Every claim has proof.** A capability is shown only with something that proves it: a page, a résumé line or a colleague's words.
3. **Show, then tell.** A picture and a short line first; no line on the home page is longer than about 12 words.
4. **One spine, many views.** The content is written once. A view only presents it.
5. **The visitor is in control.** Nothing moves on its own unless the visitor chose a view that moves, and then it can be paused.
6. **The résumé and contact are never more than one action away,** in every view, at every width.
7. **Honest about confidentiality.** Work with no public page is shown as a résumé line with "Ask me about it", never padded or guessed at.
8. **Fast and accessible everywhere:** from 320 px, by keyboard, with reduced motion, without the visitor's patience.

## 5. The views at a glance

| View | In one line | Best for | Page |
|---|---|---|---|
| **Bento** | Every capability as a tile on one screen, each with its proof | Everyone; the default | [Bento](bento.md) |
| **Cover** | The home page as a magazine cover with six cover lines | A strong first impression with editorial calm | [Cover](cover.md) |
| **Spotlight** | One highlight on stage, every highlight on the rail | Visitors who like to browse one thing at a time | [Spotlight](spotlight.md) |
| **Showreel** | A 90-second film made of live page content, with chapters | Impact; a visitor who has time and wants to be shown | [Showreel](showreel.md) |
| **Keywords** | Pick what you hire for; the matching evidence comes forward | A recruiter with a job description in hand | [Keywords](keywords.md) |
| **Proof grid** | Every capability against the kinds of evidence for it | An analytical hiring manager, or a panel | [Proof grid](proof-grid.md) |
| **Questions** | The nine questions hiring visitors ask, answered with evidence | A hiring manager who thinks in questions | [Questions](questions.md) |
| **Little planet** | Explore the site as a game | The general audience, and a memorable second visit | [Navigation modes](../desktop/modes.md) |

More ideas that could become views later, Career river, Two sides and The short version among them, are on [More ideas](more-ideas.md).

## 6. Assessment

How each view does against the failure case and the other goals. "Miss risk" is the chance a hiring manager misses a relevant capability.

| View | L1 coverage | Scan speed | Miss risk | Impact | Phone | Effort |
|---|---|---|---|---|---|---|
| **Bento** | High | High | Low | High | Medium to high | Medium |
| **Cover** | Medium to high | High | Low to medium | High | Medium | Low |
| **Proof grid** | Very high | Medium | Very low | Medium | Low to medium | Low |
| **Questions** | High | Medium | Low to medium | Medium | High | Medium |
| **Spotlight** | Medium | Medium | Medium to high | Medium | High | Low to medium |
| **Showreel** | Medium | Medium | Medium | Very high | Medium | High |
| **Keywords** | Low to medium | Low | High if the visitor never picks | High | Medium | Medium to high |
| **Little planet** | Low | Low | High | Very high | Low | Built |

**The recommendation:**
- **Bento as the default.** It's the only option that is high on coverage, scan speed and impact at once, and it carries a role lens well.
- **Cover and Proof grid** as the first alternatives: Cover for an editorial first impression at low cost, Proof grid for the visitor who wants every claim and its proof in one table.
- **Showreel** as the visitor's choice, never the default: the most impressive, and the most expensive to make and keep current.
- **Keywords and Questions** later: both are strong when the visitor engages, and both depend on the spine being complete.
- **Spotlight** shares the showreel's highlights, so it costs little once those exist, but it's the weakest of the seven at L1.

## 7. Pages in this set

| Page | What it covers |
|---|---|
| [The capability spine](foundation.md) | The three levels, the six capabilities and their evidence, the coverage rule, the role lens, what's always on screen, copy rules |
| [Choosing a view](switcher.md) | Change view, addresses, what's remembered, transitions, how views relate to modes |
| [Bento](bento.md), [Cover](cover.md), [Spotlight](spotlight.md), [Showreel](showreel.md), [Keywords](keywords.md), [Proof grid](proof-grid.md), [Questions](questions.md) | Each view's design: levels, layout at 1280, 768 and 360, task flows, visuals, motion, accessibility, what it needs, risks |
| [More ideas](more-ideas.md) | Career river, Two sides, The short version, Little planet's part, Constellation |
| [How we'll know](evaluation.md) | Tests with hiring managers and recruiters, and with site owners on their own work; telemetry; targets |
| [Home views for every site](for-every-site.md) | The general model: goals, 3 to 6 strengths, kinds and sources of proof, each view at 3 to 6, minimums, budgets as a site grows, a new site |
| [Curating the home page](curation.md) | Curation without AI: what's stored, the evidence index, matching, the score, filling the slots, what happens when content changes, the health report, scale |
| [Curating with AI](ai-curation.md) | Where AI runs, the curation request, the grounding check, ten jobs and their rule-based twins, tailoring to a job, agents, privacy |
| [Making your home page](owner-flows.md) | The Home screen in edit mode, the first run, eleven scenarios and their flows, curation where the person already is, links for a role or a job |
| [Controls](controls.md) | Three layers of controls, advanced settings, one vocabulary for every view's settings, Auto, Pinned and Hidden, guardrails |
| [Plan and Definitions of Done](plan.md) | How the phases are built: eight stages, the project's Definition of Done and each stage's, working alongside other features, status and evidence |

## 8. Phases

| Phase | What ships | Why then |
|---|---|---|
| **1** | The capability spine and its coverage test; **Bento** as the default; Change view; the role lens. For every site: the curation rules and the health report; the Home screen with its first run, Strengths, Highlights and Views tabs; the topic vocabulary | The default carries most visits; the spine is what every other view reads, and the engine is generic from the start (H10) |
| **2** | **Cover** and **Proof grid** | Low effort, two very different first impressions, both high on coverage |
| **3** | **Spotlight**, **Showreel** and its MP4 cut | They share the highlights; the reel is the largest single piece of work |
| **4** | **Keywords** | Needs the keyword field and its synonyms curated |
| **5** | **Questions** | Needs an answer per question, with evidence, that the owner signs off |

Alongside phase 1, the content work in [foundation §4](foundation.md) (short proof pages for AI transformation and product strategy) does more for every view than any layout. The Links tab (lenses and job links) can follow any phase; AI curation follows AI editing's first phase, in its own phases ([AI curation §11](ai-curation.md)). How the phases are built, stage by stage, and what "done" means for each: [plan](plan.md).

## 9. Open decisions

Each view page lists its own. These decide the whole set.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| H1 | The six capabilities and their names | As proposed; merge Craft into Making; split Leadership into org building and people | As proposed, after the owner reads [foundation §3](foundation.md) |
| H2 | The default view | Bento; Cover; Proof grid | Bento |
| H3 | Which views are offered at launch | All seven; phase 1 and 2 only | Phase 1 and 2 only; add views as they're built |
| H4 | Motion that runs on its own, for the showreel and the keyword drift | Amend [visual language §6](../site-ui/visual-language.md) for views the visitor chose; no such motion | Amend it, scoped to a view the visitor chose, always with a pause |
| H5 | Where views live | `/` and `/views/<id>/`; a query string only | `/` and `/views/<id>/` ([switcher §2](switcher.md)) |
| H6 | The role lens in phase 1 | Yes; later | Yes: it's cheap once the spine exists, and it helps a recruiter share the right first screen |
| H7 | Proof pages for AI transformation and product strategy | Write them; leave résumé lines | Write them, within what can be said publicly |
| H8 | Which facts appear on the home page (years, team size, people reached) | All verified facts; a few | A few, each with its source |
| H9 | The home hub's summary, which now says the site is under construction | Replace it with the positioning line; keep it | Replace it with the positioning line |
| H10 | Home views as an engine feature for every Atiya site, or the owner's only | Engine from the start, the owner's site first; owner only, generic later | Engine from the start, with the owner's site as its first user ([for every site §7](for-every-site.md), FS5) |
