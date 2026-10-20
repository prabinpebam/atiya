# Showreel

Showreel plays the profile as a short film: about 90 seconds in eight chapters, an introduction, his range, then one chapter per capability, each with its proof, a picture in motion and a colleague's words. It isn't a video file: it's the page's own content, animated, so every word is real text, every frame has a way into its evidence, and it changes when the content does. It's the most impressive of the views and the most expensive, so it's the visitor's choice, never the default. It's part of [Home page views](README.md) and reads the [capability spine](foundation.md).

> **TL;DR.**
> - **A film made of live content:** an HTML timeline built from the spine, animated with the Web Animations API: seekable, accessible, and current. About 90 seconds, eight chapters.
> - **The chapter bar names all six capabilities before anything plays (L1).** Each chapter is the signal (L2), and **Open this** on every frame pauses the reel and opens that chapter's evidence (L3).
> - **It plays only once chosen,** muted, at most three loops, then holds on its last frame. Pause, Previous, Next and the speed are always on screen; a transcript gives the whole reel as text. Reduced motion gets stills.
> - **On a phone,** the stage is 4:5, with the six capabilities named in a still line under the controls.
> - **An MP4 cut,** rendered with HyperFrames from the same composition, is made for sharing. **Claude Motion** is useful for storyboards only.
> - **It needs one change to the site's rules:** motion that runs on its own, scoped to a view the visitor chose (open decision H4).

<figure class="slate-figure" data-diagram="home-showreel">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="hv-showreel__title hv-showreel__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-showreel__title">Showreel: a 90-second film made of live page content</title>
<desc id="hv-showreel__desc">The stage plays chapter 3 of 8, Design leadership: its proof, a visual in motion and a quote, with Open this, which pauses the reel and opens the evidence. Below the stage, eight progress segments are labelled with the chapter names, so all six capabilities are named before anything plays. Pause, Previous, Next and the reading speed are always visible, and a transcript gives the whole reel as text. On a phone the stage is 4:5, with its controls below, then a still line naming the six capabilities, then the transcript.</desc>
<text x="40" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Wide screen, 1280 px</text>
<text x="740" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Phone, 360 px</text>
<g id="hv-showreel__wide" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-1" x="40" y="56" width="660" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-showreel__strip" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-2" x="56" y="72" width="628" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-showreel__body-2" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="452" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-showreel__body-2" data-slate-fit-padding="16">Résumé · Contact · Change view</text>
</g>
<g id="hv-showreel__stage" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-3" x="56" y="128" width="628" height="300" rx="16" fill="var(--color-brand-bg)" />
<text x="76" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">Chapter 3 of 8 · 0:24</text>
<text x="76" y="190" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">Design leadership</text>
<text x="76" y="214" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">Built Belong's design org from scratch;</text>
<text x="76" y="234" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">leads teams of 5 to 9 designers at Microsoft</text>
<rect id="hv-showreel__body-4" x="76" y="254" width="300" height="150" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="92" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-4" data-slate-fit-padding="16">Visual: the team's own</text>
<text x="92" y="340" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-4" data-slate-fit-padding="16">rebrand art, in motion</text>
<text x="400" y="286" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">“one of the most complete</text>
<text x="400" y="306" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">design leaders I know”</text>
<text x="400" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">March Roger, Partner Design</text>
<text x="400" y="348" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-3" data-slate-fit-padding="16">Director, Windows</text>
<rect id="hv-showreel__body-5" x="400" y="364" width="150" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="416" y="389" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-5" data-slate-fit-padding="16">Open this</text>
</g>
<g id="hv-showreel__chapters" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-6" x="56" y="440" width="73" height="12" rx="6" fill="var(--color-brand-bg)" />
<text x="56" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Intro</text>
<rect id="hv-showreel__body-7" x="135" y="440" width="73" height="12" rx="6" fill="var(--color-brand-bg)" />
<text x="135" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Range</text>
<rect id="hv-showreel__body-8" x="214" y="440" width="73" height="12" rx="6" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="214" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Leadership</text>
<rect id="hv-showreel__body-9" x="293" y="440" width="73" height="12" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="293" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Strategy</text>
<rect id="hv-showreel__body-10" x="372" y="440" width="73" height="12" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="372" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">AI</text>
<rect id="hv-showreel__body-11" x="451" y="440" width="73" height="12" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="451" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Making</text>
<rect id="hv-showreel__body-12" x="530" y="440" width="73" height="12" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="530" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Craft</text>
<rect id="hv-showreel__body-13" x="609" y="440" width="73" height="12" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="609" y="474" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Systems</text>
</g>
<g id="hv-showreel__controls" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-14" x="56" y="488" width="90" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="513" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-14" data-slate-fit-padding="16">Pause</text>
<rect id="hv-showreel__body-15" x="154" y="488" width="110" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="170" y="513" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-15" data-slate-fit-padding="16">Previous</text>
<rect id="hv-showreel__body-16" x="272" y="488" width="80" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="288" y="513" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-16" data-slate-fit-padding="16">Next</text>
<rect id="hv-showreel__body-17" x="360" y="488" width="130" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="376" y="513" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-17" data-slate-fit-padding="16">Speed 1×</text>
<text x="520" y="513" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-1" data-slate-fit-padding="16">Loop 1 of 3</text>
</g>
<g id="hv-showreel__transcript" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-18" x="56" y="540" width="628" height="80" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="568" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-showreel__body-18" data-slate-fit-padding="16">Transcript</text>
<text x="72" y="592" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-showreel__body-18" data-slate-fit-padding="16">3 · Design leadership: built Belong's design org from scratch; teams of 5 to 9.</text>
</g>
<g id="hv-showreel__phone" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-19" x="740" y="56" width="220" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-showreel__phone-strip" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-20" x="752" y="72" width="196" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-showreel__body-20" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="896" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-20" data-slate-fit-padding="16">Menu</text>
</g>
<g id="hv-showreel__phone-stage" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-21" x="752" y="124" width="196" height="246" rx="14" fill="var(--color-brand-bg)" />
<text x="768" y="150" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-21" data-slate-fit-padding="16">3 of 8 · 0:24</text>
<text x="768" y="182" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-showreel__body-21" data-slate-fit-padding="16">Design</text>
<text x="768" y="204" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-showreel__body-21" data-slate-fit-padding="16">leadership</text>
<text x="768" y="228" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-21" data-slate-fit-padding="16">Built Belong's design</text>
<text x="768" y="246" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-showreel__body-21" data-slate-fit-padding="16">org from scratch</text>
<rect id="hv-showreel__body-22" x="768" y="262" width="164" height="92" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="784" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-22" data-slate-fit-padding="16">Visual</text>
</g>
<g id="hv-showreel__phone-controls" data-slate-svg-step="10" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-23" x="752" y="382" width="21" height="10" rx="5" fill="var(--color-brand-bg)" />
<rect id="hv-showreel__body-24" x="777" y="382" width="21" height="10" rx="5" fill="var(--color-brand-bg)" />
<rect id="hv-showreel__body-25" x="802" y="382" width="21" height="10" rx="5" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<rect id="hv-showreel__body-26" x="827" y="382" width="21" height="10" rx="5" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-showreel__body-27" x="852" y="382" width="21" height="10" rx="5" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-showreel__body-28" x="877" y="382" width="21" height="10" rx="5" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-showreel__body-29" x="902" y="382" width="21" height="10" rx="5" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-showreel__body-30" x="927" y="382" width="21" height="10" rx="5" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-showreel__body-31" x="752" y="404" width="64" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="431" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-31" data-slate-fit-padding="16">Pause</text>
<rect id="hv-showreel__body-32" x="824" y="404" width="58" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="840" y="431" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-32" data-slate-fit-padding="16">Back</text>
<rect id="hv-showreel__body-33" x="890" y="404" width="58" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="906" y="431" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-33" data-slate-fit-padding="16">Next</text>
</g>
<g id="hv-showreel__phone-text" data-slate-svg-step="11" data-slate-svg-effect="fade-rise">
<rect id="hv-showreel__body-34" x="752" y="460" width="196" height="84" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="486" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-showreel__body-34" data-slate-fit-padding="16">In this reel</text>
<text x="768" y="510" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-34" data-slate-fit-padding="16">Leadership · Strategy · AI</text>
<text x="768" y="530" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-showreel__body-34" data-slate-fit-padding="16">Making · Craft · Systems</text>
<rect id="hv-showreel__body-35" x="752" y="556" width="196" height="64" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="582" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-showreel__body-35" data-slate-fit-padding="16">Transcript</text>
<text x="768" y="604" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-showreel__body-35" data-slate-fit-padding="16">Read it instead</text>
</g>
<text x="40" y="668" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Plays only once chosen, muted, at most three loops, then holds on the last frame. Reduced motion: stills and the transcript.</text>
</svg>
<figcaption>Showreel at 1280 px in chapter 3, Design leadership, and at 360 px.</figcaption>
</figure>

## 1. The idea

A designer's reel shows in a minute and a half what a portfolio takes an hour to read. It's the one format that can carry pacing, emphasis and a sense of the person, and it makes a first impression no static page can. The usual reel fails a hiring manager, though: it's a video, so he can't skim it, link into it, read its words or find the work behind a frame. Showreel keeps the reel's impact and fixes those, by building the film out of the page itself.

### 1.1 What was researched

| Tool | What it is | What it's good for here |
|---|---|---|
| **Claude Motion** (Anthropic, beta since early October 2026, on Team and Enterprise plans) | Makes animated explainer videos and live dashboards from a prompt, and exports MP4 ([Anthropic help](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), [The Decoder](https://the-decoder.com/claude-can-now-generate-animated-explainer-videos-and-live-data-dashboards-from-text-prompts/)) | **Storyboards:** quick drafts of pacing and transitions from the shot list (§4.4), to agree on the feel before building. Not for the published reel: its output is a closed video, not the site's live, accessible content, and it's a beta on plans the site doesn't depend on |
| **HyperFrames** (HeyGen, open source, Apache-2.0) | Renders HTML compositions to deterministic MP4, frame by frame ([GitHub](https://github.com/heygen-com/hyperframes)) | **The MP4 cut:** the same HTML composition the page plays, rendered to a file for LinkedIn, email and talks (§10). Deterministic, so a re-render after a content change gives the same film with the new words |

The page itself uses neither at run time: the browser's own Web Animations API plays the timeline, with no third-party script (the site's [Content Security Policy](../access/spec.md) allows none).

## 2. Who it serves

| Persona | How Showreel serves them |
|---|---|
| Recruiter | The chapter bar names the six capabilities at once; a 90-second summary to forward; the MP4 to attach |
| Hiring manager | The impression of a person, fast; Open this on the chapter that matters to the role |
| Panel member | The transcript, and a link to a chapter (`#chapter-ai`) |
| General audience | The most engaging way in; it asks nothing but attention |
| Returning visitor | It changes as the content changes, because it's made of it |

## 3. The three levels

| Level | In Showreel | Revealed by |
|---|---|---|
| **L1, the map** | The chapter bar: Intro, Range and the six capabilities, labelled; on a phone, the "In this reel" line | Nothing: on screen before it plays |
| **L2, the signal** | Each chapter: the capability, its proof, a picture in motion, a colleague's words | Watching, or pressing a chapter |
| **L3, the detail** | Open this: the chapter's three to five evidence items, in a sheet over the stage's lower half, with Resume | Pressing Open this, which pauses the reel |
| **Beyond** | The article, the résumé | Links in the sheet and the transcript |

## 4. Layout and composition

### 4.1 Wide screen (1280 px)

| Row | Content | Columns |
|---|---|---|
| Strip | The name; Read résumé, Contact me, Change view | 12 |
| Stage | The reel, 16:9 (about 1060 by 600 at the full width; 628 by 300 in the figure's scale): the chapter label and time, the headline, the proof, the visual, the voice, Open this | 12 |
| Chapter bar | Eight segments, each labelled, filling as the reel plays; the current one in the spot colour | 12 |
| Controls | Pause, Previous, Next, Speed (1×, 0.75×, 0.5×); "Loop 1 of 3" | 12 |
| Transcript | The whole reel as text, chapter by chapter, the current chapter marked; each chapter's links | 12 |
| Below | The site's sections; Other ways to explore | 12 |

The stage, the chapter bar and the controls fit in the first 800 px.

### 4.2 Tablet (768 px)

The stage keeps 16:9 at full width; the chapter bar's labels shorten to the short names; the controls sit in one row under it.

### 4.3 Phone (360 px)

| Order | Content | Height (about) |
|---|---|---|
| 1 | The strip: name and Menu | 40 px |
| 2 | The stage, 4:5: the chapter, the headline, a line, the visual; Open this | 410 px |
| 3 | The chapter bar: eight segments, without labels; a progress display, not targets (Back and Next move between chapters) | 16 px |
| 4 | Pause, Back, Next, each 44 px | 56 px |
| 5 | In this reel: the six capabilities in a still line | 84 px |
| 6 | The transcript, then the sections | |

The still line keeps all six capability names on the first screen while the stage is busy with one.

### 4.4 The shot list

Made from the spine: each capability's chapter uses its proof line, its voice, its picture and its evidence. Only the order, the timings and the visual's template are the reel's own.

| # | Chapter | Time | On screen | Visual | Voice |
|---|---|---|---|---|---|
| 1 | Intro | 0:00 to 0:08 | "Prabin Pebam"; Principal Design Manager, Microsoft; the positioning | The name writes itself in Fraunces; an ink sketch character looks up | None |
| 2 | Range | 0:08 to 0:18 | "18 years, from TVS Motor to Windows" | A line draws through 2008 TVS Motor, 2013 Projectplace, 2015 Belong, 2019 Microsoft; DesignUp joins it in 2016 | None |
| 3 | Design leadership | 0:18 to 0:30 | "Built Belong's design org from scratch; leads teams of 5 to 9 designers at Microsoft" | The team's own rebrand art (Do what makes you proud), in motion | March Roger: "one of the most complete design leaders I know" |
| 4 | Product strategy | 0:30 to 0:42 | "From Family Safety to Microsoft Family"; launched July 2020, a Windows commitment to families in 2026 | The Family app's screens from the case study, sliding into place | Prabu Ambravaneswaran: "can challenge the strongest product thinkers on their own turf" |
| 5 | AI transformation | 0:42 to 0:54 | "Handoff is now code": designers hand engineering working code, not specs | A spec frame turns into a running prototype, drawn in ink | Diego Baca: "He stays at the cutting edge of AI" |
| 6 | Hands-on making | 0:54 to 1:06 | "Eight things built and published"; Cloner Pro: 3,530 people use it | A montage of the eight side projects' pictures, settling into a grid | Diego Baca: "hands-on technical ability" |
| 7 | Craft and storytelling | 1:06 to 1:16 | "Led Craft in Windows"; DesignUp's core team since 2016 | DesignUp's photos and the generative explorations, panning slowly | March Roger: "He pairs this thinking with real craft" |
| 8 | Systems and operating models | 1:16 to 1:26 | "Built the Belong Design System from scratch" | Components assembling into a page; Slate and Atiya after it | None |
| End | The end frame | 1:26 to 1:30, then held | The six capabilities; Read résumé, Contact me, Watch again | Still | None |

Each line follows the [copy rules](foundation.md): facts, word-for-word quotes, under 12 words on screen at a time. A chapter's template is one of a handful (a title that writes itself, a line that draws, a quote that reveals, a picture that pans, a counter, a montage), so a new capability or a changed proof line needs no new animation.

## 5. Interaction

| Action | Result |
|---|---|
| Arrive by choosing Showreel (Change view, or the stored choice) | It plays from chapter 1, muted |
| Arrive by a link someone sent (`/views/showreel/`) | It shows chapter 1's first frame with a large Play: someone else chose the view, so it waits for the visitor |
| Pause / Play | Holds or resumes the reel; Space and K with the stage focused |
| Previous, Next | The start of the previous or next chapter; Left and Right with the stage focused |
| Press a chapter in the bar | Jumps to its start |
| Speed | 1×, 0.75×, 0.5×: slower for slower readers |
| Open this | Pauses, and opens the chapter's evidence over the stage's lower half; Resume closes it and plays on |
| Hover the stage | Holds the current shot while the pointer is on it; it plays on when the pointer leaves |
| Focus moves into the stage | Pauses until Play |
| The tab is hidden, or the stage scrolls out of view | Pauses; it doesn't resume by itself |
| The end of a loop | Holds the end frame for 5 seconds, then loops; after the third loop it stays on the end frame |
| Open `/views/showreel/#chapter-<id>` | Opens paused at that chapter |

## 6. Task flows

**Recruiter** (about 30 seconds)
1. Picks Showreel from Change view. Reads the chapter bar: the six capabilities.
2. Watches the intro and range; presses Read résumé in the strip.
3. Later, forwards the MP4 cut to the hiring manager.

**Hiring manager** (2 to 3 minutes)
1. Opens the view; watches chapters 1 to 4.
2. At AI transformation, presses Open this: the AI program (Ask me about it), Cloner Pro, The best AI model won't win, Diego Baca's words.
3. Opens the essay; comes back; presses Resume. Watches to the end frame; presses Contact me.

**Panel member**
1. Opens `/views/showreel/#chapter-strategy`, paused at Product strategy. Reads the transcript instead of watching.

**A visitor with reduced motion**
1. Sees chapter 1 as a still, with the chapter bar and Next. Steps through the eight stills, or reads the transcript.

## 7. Visual direction

- **Cinematic, but the site's own:** paper and ink, the indigo spot, Fraunces headlines large enough to read from across a room, Newsreader for the lines, the ink sketch characters as the recurring cast.
- **One move at a time:** each shot has one main motion (a line drawing, a picture panning, a quote revealing) and holds still long enough to read: at least 1 second per three words on screen at 1×.
- **Real pictures, gently moved:** pans and slow zooms on the work's own pictures, never stock footage or invented screens.
- **A dark stage:** the reel plays on the brand fill with paper text, like a screening room, in both themes; it's the one place a view's surface differs, and it stays within the site's tokens.

## 8. Motion

| Motion | When | Reduced motion |
|---|---|---|
| The reel plays | Once the visitor chose the view; at most three loops | Never plays: one still per chapter, stepped with Previous and Next |
| A chapter's own animation (draw, pan, reveal) | During its chapter | The chapter's still: its final frame |
| The chapter bar fills | While playing | Shows the current chapter only |
| The evidence sheet rises | Open this | Instant |

**The rule this needs.** The site's [visual language §6](../site-ui/visual-language.md) says nothing moves on its own. The reel is motion that runs by itself, so it needs an amendment, scoped tightly (open decision H4 in [Home page views](README.md)): motion may run on its own only in a view the visitor chose, muted, always with a visible pause, never longer than three loops, and never under reduced motion. WCAG 2.2.2 (Pause, Stop, Hide) is met by the always-visible Pause and by stopping after three loops.

## 9. Accessibility

- The stage is a region named "Showreel"; its text is real text, in the page's HTML, and only the visible chapter is exposed (`inert` on the others).
- The chapter's heading is announced when a chapter starts, through a polite live region, only when the visitor pressed Previous, Next or a chapter (never while it plays by itself, which would talk over the visitor).
- Pause is the first control after the stage in the tab order, and is never hidden; all controls are at least 44 px.
- The transcript is a full text equivalent: every chapter, its words, its quotes with their names, and its links. A screen reader user can read it instead of the reel.
- Nothing flashes more than three times a second; no motion crosses more than a third of the stage in under half a second.
- Open this has the chapter in its name ("Open this: Design leadership").

## 10. What it needs

| Need | Detail |
|---|---|
| Content | The spine (capabilities, voices, pictures, facts), plus a `reel` block in `showcase.json`: chapter order, timings and each chapter's template |
| Pictures | The pictures each chapter moves, in their dark versions where they have one (the stage is always dark); at least 1600 px wide for pans |
| Components | A Showreel layout; a reel player (Web Animations API, under 40 KB gzip, the budget in [foundation §10](foundation.md)); a handful of shot templates; the evidence sheet (Bento's drawer, as a sheet) |
| The MP4 cut | Rendered with HyperFrames from the same composition, at 1920 by 1080 and 1080 by 1350, with the words burned in; published as a video in content media (under 100 MB, with a poster frame; [media](../content/media.md)) and offered as "Download the film" under the transcript. Re-rendered when the spine changes |
| Storyboards | Claude Motion drafts from the shot list, to agree the feel before building; not published |
| Rules | The visual language amendment (H4) |
| Tests | Coverage at 1280 and 360 (the chapter bar, the still line); no play under reduced motion; no play on a link visit; Pause reachable and working; stops after three loops; axe; screenshots of chapter stills |
| Telemetry | `reel_chapter` (`index`, `how`: play, seek, next, link), plus the shared events (Open this sends `capability_l3_open`) |

## 11. Risks

| Risk | Mitigation |
|---|---|
| A visitor watches chapter 1 and leaves before the capability that matters | The chapter bar names every chapter and seeks to it; Open this on every frame |
| Motion annoys, or distracts from reading | It runs only once chosen, pauses on hover and focus, stops after three loops, and has a speed control |
| The reel goes stale | It's made of the spine, so it changes with it; the MP4 is re-rendered |
| The cost: it's the largest single piece of work | Phase 3, after the spine and the highlights exist; the templates are reused by Spotlight's transitions |
| It's too heavy on a phone | One chapter's pictures load at a time, the next one ahead; the first frame is plain HTML |

## 12. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| R1 | Length | 60 s; 90 s; 120 s | About 90 s: long enough for eight chapters at a readable pace, short enough to watch whole |
| R2 | Sound | None; music; his voiceover | None on the page: it must work muted, and a recorded voice goes stale when the spine changes. A voiceover for the MP4 cut, which is fixed |
| R3 | Play on a link visit | Play; wait for Play | Wait: only the visitor's own choice starts motion |
| R4 | Publish the MP4 | Yes, linked from the view; only on request | Yes: it's the one form of the profile a recruiter can attach |
