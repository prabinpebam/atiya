# Bento, the default

Bento puts the whole profile on one screen: a lead tile with who he is and the two main actions, a tile of colleagues' words, and a tile for each of the six capabilities, each with its proof. Pressing a tile opens its evidence in place. It's the recommended default because it's the only option that is strong on coverage, scan speed and first impression at once. It's part of [Home page views](README.md) and reads the [capability spine](foundation.md).

> **TL;DR.**
> - **One screen, everything:** the identity, the positioning, Read résumé and Contact me, three colleagues' voices, and six capability tiles, each with a proof line and its evidence count. Nothing needs a click to be seen (L1).
> - **A tile is the signal (L2):** the capability, a picture, a fact-like proof line; hovering or focusing it adds a short quote and draws its ink sketch.
> - **The detail opens in place (L3):** a drawer under the tile's row with three to five evidence items, each a page, a résumé line or a recommendation. Its address (`/#cap-ai`) can be shared.
> - **On a phone:** the lead, then an index of the six capabilities, then the tiles one under another. The first screen still names all six.
> - **The role lens** puts the role's capability first and gives it the large tile.
> - **As built:** offered at `/views/bento/` while the classic hub stays the default. The tray is as wide as the header, packed whole from feature, tall, wide and single tiles; pictures are big, shown whole and square-cornered, and the words flow round a picture's drawn shape, not its box ([§13](#13-as-built-stage-2a), [§13.1](#131-as-built-the-big-tiles)).

<figure class="slate-figure" data-diagram="home-bento">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="hv-bento__title hv-bento__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-bento__title">Bento, the default view: every capability on one screen</title>
<desc id="hv-bento__desc">On a wide screen, the identity strip sits above a lead tile with the role, the positioning, the range and the two main actions, beside a tile of words from colleagues. Below are six capability tiles, each with a proof line and a count of its evidence. Pressing a tile opens its evidence drawer in place, here for AI transformation. On a phone, the lead tile comes first, then an index of the six capabilities, then the tiles one under another.</desc>
<text x="40" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Wide screen, 1280 px</text>
<text x="740" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Phone, 360 px</text>
<g id="hv-bento__wide" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-1" x="40" y="56" width="660" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-bento__strip" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-2" x="56" y="72" width="628" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-bento__body-2" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="452" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-2" data-slate-fit-padding="16">Résumé · Contact · Change view</text>
</g>
<g id="hv-bento__lead" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-3" x="56" y="128" width="400" height="164" rx="16" fill="var(--color-brand-bg)" />
<text x="76" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-3" data-slate-fit-padding="16">Principal Design Manager, Microsoft</text>
<text x="76" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-bento__body-3" data-slate-fit-padding="16">Design leader · Product strategy · AI transformation</text>
<text x="76" y="208" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-bento__body-3" data-slate-fit-padding="16">18 years, from TVS Motor to Windows</text>
<rect id="hv-bento__body-4" x="76" y="240" width="120" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="92" y="263" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-4" data-slate-fit-padding="16">Read résumé</text>
<rect id="hv-bento__body-5" x="206" y="240" width="116" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="222" y="263" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-5" data-slate-fit-padding="16">Contact me</text>
</g>
<g id="hv-bento__voices" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-6" x="468" y="128" width="216" height="164" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="484" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">In their words</text>
<text x="484" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">“a rare combination of</text>
<text x="484" y="204" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">strong leadership, design</text>
<text x="484" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">craft, and hands-on</text>
<text x="484" y="240" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">technical ability”</text>
<text x="484" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-6" data-slate-fit-padding="16">Diego Baca, VP, Windows</text>
</g>
<g id="hv-bento__leadership" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-7" x="56" y="304" width="204" height="110" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="336" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-7" data-slate-fit-padding="16">Leadership</text>
<text x="72" y="358" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-7" data-slate-fit-padding="16">Built Belong's design org</text>
<text x="72" y="394" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-7" data-slate-fit-padding="16">Evidence 10 · voices 2</text>
</g>
<g id="hv-bento__strategy" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-8" x="272" y="304" width="196" height="110" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="288" y="336" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-8" data-slate-fit-padding="16">Strategy</text>
<text x="288" y="358" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-8" data-slate-fit-padding="16">Family Safety to Family</text>
<text x="288" y="394" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-8" data-slate-fit-padding="16">Evidence 9 · a case study</text>
</g>
<g id="hv-bento__ai" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-9" x="480" y="304" width="204" height="110" rx="14" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="496" y="336" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-9" data-slate-fit-padding="16">AI transformation</text>
<text x="496" y="358" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-bento__body-9" data-slate-fit-padding="16">Handoff is now code</text>
<text x="496" y="394" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="hv-bento__body-9" data-slate-fit-padding="16">Open: the evidence below</text>
</g>
<g id="hv-bento__drawer" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-10" x="56" y="426" width="628" height="90" rx="14" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="72" y="454" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-10" data-slate-fit-padding="16">AI transformation, in detail</text>
<rect id="hv-bento__body-11" x="72" y="468" width="140" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="88" y="491" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-11" data-slate-fit-padding="16">The AI program</text>
<rect id="hv-bento__body-12" x="222" y="468" width="120" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="238" y="491" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-12" data-slate-fit-padding="16">Cloner Pro</text>
<rect id="hv-bento__body-13" x="352" y="468" width="160" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="368" y="491" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-13" data-slate-fit-padding="16">The learning loop</text>
<rect id="hv-bento__body-14" x="522" y="468" width="146" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="538" y="491" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-14" data-slate-fit-padding="16">Diego's words</text>
</g>
<g id="hv-bento__making" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-15" x="56" y="528" width="196" height="92" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-15" data-slate-fit-padding="16">Making</text>
<text x="72" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-15" data-slate-fit-padding="16">Cloner Pro: 3,530 people</text>
<text x="72" y="604" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-15" data-slate-fit-padding="16">8 things built</text>
</g>
<g id="hv-bento__craft" data-slate-svg-step="10" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-16" x="264" y="528" width="228" height="92" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="280" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-16" data-slate-fit-padding="16">Craft</text>
<text x="280" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-16" data-slate-fit-padding="16">Led Craft in Windows</text>
<text x="280" y="604" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-16" data-slate-fit-padding="16">Evidence 7</text>
</g>
<g id="hv-bento__systems" data-slate-svg-step="11" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-17" x="504" y="528" width="180" height="92" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="520" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-17" data-slate-fit-padding="16">Systems</text>
<text x="520" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-17" data-slate-fit-padding="16">Belong Design System</text>
<text x="520" y="604" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-17" data-slate-fit-padding="16">Evidence 5</text>
</g>
<g id="hv-bento__phone" data-slate-svg-step="12" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-18" x="740" y="56" width="220" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-bento__phone-strip" data-slate-svg-step="13" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-19" x="752" y="72" width="196" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-bento__body-19" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="896" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-19" data-slate-fit-padding="16">Menu</text>
</g>
<g id="hv-bento__phone-lead" data-slate-svg-step="14" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-20" x="752" y="124" width="196" height="150" rx="14" fill="var(--color-brand-bg)" />
<text x="768" y="154" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-20" data-slate-fit-padding="16">Design leader</text>
<text x="768" y="176" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-bento__body-20" data-slate-fit-padding="16">Product strategy · AI</text>
<text x="768" y="196" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-bento__body-20" data-slate-fit-padding="16">Principal Design Manager</text>
<text x="768" y="216" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-bento__body-20" data-slate-fit-padding="16">Microsoft · 18 years</text>
<rect id="hv-bento__body-21" x="768" y="232" width="78" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="253" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-21" data-slate-fit-padding="16">Résumé</text>
<rect id="hv-bento__body-22" x="854" y="232" width="80" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="870" y="253" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-22" data-slate-fit-padding="16">Contact</text>
</g>
<g id="hv-bento__phone-index" data-slate-svg-step="15" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-23" x="752" y="286" width="196" height="110" rx="14" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="768" y="314" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-23" data-slate-fit-padding="16">Six capabilities</text>
<text x="768" y="340" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-23" data-slate-fit-padding="16">Leadership · Strategy</text>
<text x="768" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-23" data-slate-fit-padding="16">AI · Making · Craft</text>
<text x="768" y="384" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-bento__body-23" data-slate-fit-padding="16">Systems</text>
</g>
<g id="hv-bento__phone-tiles" data-slate-svg-step="16" data-slate-svg-effect="fade-rise">
<rect id="hv-bento__body-24" x="752" y="408" width="196" height="70" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="436" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-24" data-slate-fit-padding="16">Leadership</text>
<text x="768" y="458" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-24" data-slate-fit-padding="16">Head of Design, Belong</text>
<rect id="hv-bento__body-25" x="752" y="490" width="196" height="70" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="518" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-bento__body-25" data-slate-fit-padding="16">Strategy</text>
<text x="768" y="540" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-bento__body-25" data-slate-fit-padding="16">Family Safety to Family</text>
<rect id="hv-bento__body-26" x="752" y="572" width="196" height="48" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="768" y="600" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-bento__body-26" data-slate-fit-padding="16">AI, Making, Craft, Systems</text>
</g>
<text x="40" y="668" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Every capability is visible without a click. A tile opens its evidence in place (L3); the full page is one step further.</text>
</svg>
<figcaption>Bento at 1280 px, with the AI transformation tile's evidence open, and at 360 px.</figcaption>
</figure>

## 1. The idea

A bento box holds several different things in one tray, each in its own compartment, all visible when the lid comes off. The home page works the same way: the visitor sees every compartment at once, reads the ones that matter to them, and opens one to look closer. It turns the owner's range from a list to scroll into a single picture to take in.

## 2. Who it serves

| Persona | How Bento serves them |
|---|---|
| Recruiter | Title, years, positioning, résumé and contact in the lead tile; the six capability names to match against the role |
| Hiring manager | All six capabilities at once, so none is missed; a proof line and a count to decide where to dig; the evidence in one press |
| Panel member | The drawers list exactly what's behind each claim, with links to the pages |
| General audience | Pictures and short lines; the sections index at the foot for browsing |
| Returning visitor | A stable layout: the same tile in the same place, and a link straight to an open drawer |

## 3. The three levels

| Level | In Bento | Revealed by |
|---|---|---|
| **L1, the map** | The lead tile (name, role, positioning, years) and the six tile names | Nothing: the first screen |
| **L2, the signal** | Each tile's picture, proof line and evidence count; on hover or focus, a short quote | A glance; hover or focus for the quote |
| **L3, the detail** | The tile's drawer: three to five evidence items, each with its kind (shipped, led, built, wrote, said) and a link, or Ask me about it | Pressing the tile |
| **Beyond** | The article, the résumé, the section | A link in the drawer |

## 4. Layout and composition

### 4.1 Wide screen (1280 px)

A 12-column grid inside the site's page width, about 1200 px:

| Row | Content | Columns |
|---|---|---|
| Strip | The name (left); Read résumé, Contact me, Change view (right) | 12 |
| 1 | **Lead tile**: "Principal Design Manager, Microsoft", the positioning, "18 years, from TVS Motor to Windows", Read résumé and Contact me as buttons, and a way in to Little planet as a quiet link | 7 |
| 1 | **In their words**: one quote at a time from the three recommendations, with the person's name and title; Next quote | 5 |
| 2 | Leadership, Strategy, AI transformation tiles | 4 each (widths vary slightly by picture: 4, 4, 4 or 5, 3, 4) |
| Drawer | When a tile is open: its evidence, full width, under the tile's row | 12 |
| 3 | Making, Craft, Systems tiles | 4 each (as above) |
| Foot | **The site**: the sections as a row of links (Work, About, Leadership, Writing, Gallery, Side projects, Contact), and Other ways to explore | 12 |

Rows 1 to 3 fit in the first 800 px of height at 1280 px wide. The tiles in a row share their height; their widths vary a little, picture first, so the grid reads as a tray of different things rather than a table.

**A tile's anatomy**, top to bottom:
1. A picture area, about 40% of the tile: the capability's ink sketch (or its lead article's picture), light and dark versions.
2. The capability's name, in Fraunces.
3. The proof line, in Newsreader: a fact, about five words ("Handoff is now code").
4. A label line, in Figtree: the evidence count and its strongest kind ("Evidence 9 · a case study"); with the drawer open, "Open: the evidence below".
5. On hover or focus: the quote replaces the label line ("He stays at the cutting edge of AI", Diego Baca).

**The drawer**: a heading ("AI transformation, in detail"), then three to five evidence chips in a row, each with its title and its kind as a small label, then a close button. Items that are résumé lines show the line and Ask me about it, which opens the contact form with the capability filled in.

### 4.2 Tablet (768 px)

- The lead tile spans the width; In their words becomes a single line of quote under it.
- The tiles go two to a row, in three rows, compact: the picture shrinks to a band at the tile's top.
- The drawer opens under the tile's row, full width.

### 4.3 Phone (360 px)

| Order | Content | Height (about) |
|---|---|---|
| 1 | The strip: name and Menu | 40 px |
| 2 | **Lead tile**: "Design leader", the positioning, the role and years, Résumé and Contact buttons | 150 px |
| 3 | **Index tile**: "Six capabilities", the six short names as links that jump to their tiles | 110 px |
| 4 | The six tiles, one under another: name, proof line, a small picture at the side | 70 px each |
| 5 | In their words | 160 px |
| 6 | The site's sections; Change view; Other ways to explore | |

The first screen, about 740 px tall, shows the lead and the index, so all six names are seen before any scroll. A tile's drawer opens under that tile, as an accordion.

## 5. Interaction

| Action | Result |
|---|---|
| Press a tile (click, tap, Enter or Space on it) | Its drawer opens under its row; any other drawer closes; the page scrolls only if the drawer would be off screen |
| Press the open tile again, its close button, or Esc | The drawer closes; focus returns to the tile |
| Hover or focus a tile | It lifts slightly, its quote shows, and its ink sketch draws itself once (§7) |
| Open `/#cap-<id>` | The page opens with that tile's drawer open and in view |
| Press an index link (phone) | Jumps to the tile and focuses it |
| Next quote, in In their words | Shows the next of the three recommendations; nothing rotates on its own |

## 6. Task flows

**Recruiter matching a design leader role** (about 30 seconds)
1. Lands on `/`. Reads the lead tile: Principal Design Manager, Microsoft; design leader, product strategy, AI transformation; 18 years.
2. Scans the six tile names, and the proof lines under Leadership and AI.
3. Presses Read résumé, then Download PDF on the résumé page. Two actions to the file.

**Hiring manager deciding whether to shortlist** (2 to 5 minutes)
1. Lands from the recruiter's email. Scans the lead and the six tiles.
2. Presses Leadership: the drawer shows Belong's design org, teams of 5 to 9 at Microsoft, Do what makes you proud and March Roger's words.
3. Opens Do what makes you proud, reads it, comes back: the drawer is still open where it was.
4. Presses Strategy, opens Defining Microsoft Family.
5. Presses Contact me in the strip.

**Hiring manager from a lensed link** (`/?for=ai`)
1. Lands with the chip "Showing: for an AI design role · Change". AI transformation is the first and largest tile; the other five follow.
2. Presses it: the AI program (Ask me about it), Cloner Pro, The best AI model won't win, Diego Baca's words.
3. Presses Ask me about it on the AI program: the contact form opens with "AI transformation" as the topic.

**Panel member before the loop**
1. Opens the link the hiring manager forwarded, `/#cap-strategy`: the Strategy drawer is open.
2. Reads the case study, then opens Change view and picks Proof grid to see every claim at once.

**General visitor**
1. Takes in the pictures, opens Making, opens Cloner Pro.
2. Scrolls to the site's sections at the foot and opens Side projects.

## 7. Visual direction

- **Paper and ink, one spot.** Tiles are paper cards on the page's paper, with the site's card border; the lead tile is filled in the indigo spot with paper text, the one strong colour on the screen.
- **One picture language.** Each capability has an ink sketch in the owner's style (the big-eyed creatures at work: one leading a small team, one building a plugin), so six different subjects still read as one set. Where a capability's lead article has a strong picture, it can replace the sketch.
- **Type does the hierarchy.** The capability name in Fraunces at the card-title size, the proof line in Newsreader, the count in Figtree's label style. No line is longer than about 12 words.
- **Calm, then rich on contact.** At rest the page is still; the richness comes when the visitor moves over it: tiles lift, sketches draw, quotes appear.

## 8. Motion

| Motion | When | Duration | Reduced motion |
|---|---|---|---|
| Tile lift (`c.bento.lift`, pressed `c.bento.press`): every edge moves the same distance whatever the tile's size, through a scale worked out per tile (`scripts/liftRules.ts`); the risen tile paints over its neighbours until it has settled | Hover or focus | The site's short duration | No lift; the border darkens instead |
| Ink sketch draws its strokes | First hover or focus of a tile, once per visit | About 600 ms | The finished sketch, no drawing |
| Drawer opens (height and fade) | Pressing a tile | About 250 ms | Instant |
| Capability morph to another view | Change view | About 300 ms | Instant |

Nothing moves on its own, in keeping with [visual language §6](../site-ui/visual-language.md).

## 9. Accessibility

- The view is a `<main>` with a visually hidden H1 (the name); each tile is an `<article>` with an H2 (the capability) and one button covering the card (the site's `data-card-link` recipe) whose name is "Show the details: AI transformation", with `aria-expanded` and `aria-controls`.
- The drawer is a region named by its heading and follows its tile in the reading order; the grid uses `grid-auto-flow: dense` so the other tiles of the row stay in the row while the drawer comes next for a screen reader.
- The quote shown on hover is also in the tile's accessible description, so it isn't hover-only.
- Targets at least 44 px; no sideways scroll from 320 px; the index tile's links are a list of anchor links.
- Every picture has its alt text from its sidecar, or `alt=""` where the tile's text already says it.

## 10. What it needs

| Need | Detail |
|---|---|
| Content | The spine: six capabilities with lines, proof, voices; the positioning; the years fact |
| Pictures | Six capability pictures, light and dark (ink sketches via the illustration pipeline, or lead pictures) |
| Components | A Bento grid compound (a container, with its own `c.bento` size queries), a capability tile and an evidence drawer, both made of existing fundamentals; In their words reuses the recommendations' quote |
| Tests | The coverage test (all six `data-capability` in view at 1280 and 360); the drawer's keyboard and `#cap-` address; axe; screenshots in light and dark at 360, 768 and 1280 |
| Telemetry | `capability_l2_open` (hover or focus held over 1 s), `capability_l3_open` (drawer), plus the shared events |
| On every site | 3 to 6 tiles: one row of three tall tiles, two by two, two wide then three, or two rows of three ([for every site §4](for-every-site.md)). Offered once there are 3 strengths, each with proof ([§5](for-every-site.md)). Settings: Lead, Density, Pictures, Order and In their words ([controls §3](controls.md)) |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Six equal tiles, so nothing stands out | The lead tile carries the positioning; the lens gives the role's capability the large tile; proof lines are facts, not adjectives |
| A capability with thin evidence looks weak next to Making's eight | Show the strongest kind of evidence, not just a count ("a case study", "3 voices"); write the proof pages in [foundation §4](foundation.md) |
| Too many words on the first screen | The copy rules: about 80 words in all, about 12 per line |
| The phone page becomes a long stack | The index tile keeps all six on the first screen; tiles are short |
| A drawer opened by mistake pushes the page around | It opens only on a press, never on hover; the page scrolls only when the drawer would be off screen |

## 12. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| B1 | Pictures on every tile | Every tile; only the lead and the lens's tile | Every tile: the pictures are what make the first impression |
| B2 | Show evidence counts | Counts; the strongest kind only; both | Both, but the kind first ("a case study · 9 in all") |
| B3 | The In their words tile | Beside the lead; at the foot | Beside the lead on wide screens: a colleague's words are the strongest L2 signal there is |
| B4 | The drawer | Under the row; a side panel; a dialog | Under the row: it keeps the map in view and doesn't trap focus |

## 13. As built (stage 2a)

Bento is built and offered at `/views/bento/`. The classic hub stays at `/` until the owner names the strengths and picks the default (decisions H1, H2 and H9 in the [plan](plan.md)); making Bento the default is then one line of `content/structures/ways.json`. The view is drawn from the spine by [curation](curation.md)'s rules, so it shows whatever strengths a site has, 3 to 6.

| Part | Where |
|---|---|
| The view | [`Bento.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Bento.astro), with [`HomeLead.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/HomeLead.astro) and [`Voices.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Voices.astro) in its slots; their stories are in the design library |
| The page | [`HomeLayout.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/layouts/HomeLayout.astro) (the header, the view, the sections at the foot) and [`views/[view].astro`](https://github.com/prabinpebam/atiya/blob/main/src/pages/views/%5Bview%5D.astro), one page per offered view but the hub, with `/` as its canonical address |
| From the spine to the tiles | [`present.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/home/present.ts) and [`bento.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/home/bento.ts) (pure, unit-tested), joined to the site's pages and pictures by [`homeView.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/homeView.ts) |
| Its behaviour | [`scripts/bento.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/bento.ts): the drawers, Esc, the phone's index and the `#cap-<id>` address |
| Its sizes | The `c.bento` tokens: the picture band, the phone's side picture, the evidence cards and its two container queries (50 and 36 rem) |

Where the build differs from the design above:

- **The tile reads top down:** its name (the button), its line, its evidence label, then its picture, shown whole in a band at the foot that takes what the row leaves. The design put the picture first; with it at the foot, all six names are in view at 1280 by 800 with the lead and In their words above them.
- **The quote takes the picture's place:** at the calm density it fades in over the picture on hover and focus; a tile without a picture shows its quote at rest, and the full density shows both. On a phone the picture sits beside the words and the quote isn't shown; it stays in the button's description.
- **The lead is tinted, not filled:** the accent's soft tint, so the name, the facts and the two actions keep the site's own colours. Its H1, the name, is visible.
- **The button's name is the strength's,** not "Show the details: …"; its line, its label and its quote are its description.
- **The phone's index entries** carry `data-capability` too: on a phone they are what's in view, so the coverage test counts them.
- **Below 50 rem In their words follows the tiles,** and on every width the keyboard reaches it after them.
- **Not built yet:** the identity strip (the site's header is used), the ink sketch drawing itself on hover, the lead's Highlight and Voice settings (Lead is Who you are only; the others come with the Home screen, stage 3). The role lens came in stage 2c: its first strength takes the large first tile ([foundation §6, as built](foundation.md#as-built-stage-2c)).

Evidence: the E2E group "home views" (coverage at 1280 by 800 and 360 by 740 in both modes, the three levels, the drawer's keys and address, axe with a drawer open in both modes, no sideways scroll and 44 px targets from 320 px), the design system's unit tests, and the screenshots of the stories and `/views/bento/` in the `visual` project.

### 13.1 As built: the big tiles

The owner's review replaced the even, centred tray with one the pictures carry. This supersedes the first two bullets above (the picture at the foot and the quote over it).

- **As wide as the header,** not the reading column (`HomeLayout`'s wide frame), at four columns, two below 64 rem of its own width, and one below 36 rem (its container queries).
- **Four roles, packed whole:** feature (2 by 2), tall (1 by 2), wide (2 by 1) and single. [`bento.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/home/bento.ts) picks them so the tray is a whole rectangle at four and at two columns without holes, in the person's order where it can (`pack` follows CSS grid's dense placement exactly; unit-tested for every count from 1 to 6). A strength with a picture and more proof gets the bigger place, and the role lens's first strength the feature.
- **Pictures big and whole:** each tile draws the shape its frame takes at each layout (the 3:2 thumbnail, the square for a tall tile, the wide one for a wide tile), else its thumbnail, shown whole (`display: fit`), square-cornered unless the Bento setting `corners` is Rounded or the picture asks. The choice is pure in [`bentoPictures.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/design/bentoPictures.ts).
- **A significant heading and more words:** the name at heading size (larger on the feature), the line, up to four keywords, and on feature and tall tiles the quote at rest; a single or wide tile shows its quote on hover and focus.
- **The whole tile is one press** (the `data-card` recipe); the evidence label sits at its foot.
- **The words flow round the picture's drawn shape** ([`alphaWrap.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/alphaWrap.ts), rules pure in [`alphaWrapRules.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/alphaWrapRules.ts)). The picture is a float with `shape-outside: polygon(…)`, so the browser breaks the lines natively. In the browser, the script reads the picture's alpha once per file (at most 192 columns) and takes each row's profile from the words' side, which is the outline a float needs: holes and separate pieces fall out of it. `shape-margin` pads it like a die-cut sticker's edge (`c.bento.wrap-gap`). Two rules keep it readable: a gap narrower than `c.bento.wrap-measure` is closed, and an open run shorter than `c.bento.wrap-band` is closed, except at the foot. The words take the side with more room. A photo or a screenshot (no transparency) gets no shape, and neither does a browser without `shape-outside` support or a picture it can't read: the words then sit under the picture, as before the script runs. It re-maps on resize and when the theme swaps the picture.

Evidence: `tests/unit/homeBento.test.ts` (the roles, the packing, the pictures), `tests/unit/alphaWrap.test.ts` (the silhouette, the outline, the measure and band rules, the padding, the side, the letterbox), the design system's unit tests, and the E2E groups "home views" coverage and Bento.
