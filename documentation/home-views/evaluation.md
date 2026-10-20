# How we'll know

These are the checks that tell whether the home page does its job. A hiring manager should leave knowing all six capabilities, and confident enough to shortlist. The checks come in three parts:

- **Tests with people,** before and after launch, decide between views.
- **Automated checks** hold the coverage rule on every build.
- **Telemetry** watches the live site.

A personal site gets few hiring visits, so the people tests decide and telemetry gives direction. This page is part of [Home page views](README.md) and measures the goals in [README §3](README.md).

> **TL;DR.**
> - **The one question that catches the failure case:** "Is there anything you expected to find but didn't?", asked after the visitor has seen a view, then checked against what the site actually shows.
> - **Five tests with people, about 30 minutes a session, in rounds of 5 to 8 hiring managers and recruiters:**
>   - a 5-second test;
>   - capability recall after 60 seconds (target: 4 of 6);
>   - a first-click test (target: 80%);
>   - the missed-capability question;
>   - a preference test.
> - **Automated checks on every build:** the coverage rule, axe, the budgets, reading without script, reduced motion.
> - **Telemetry targets:**
>   - all six capabilities seen in at least 90% of home visits;
>   - under 10% of visits leave within 10 seconds;
>   - résumé and contact conversion compared with today's home page over a matching period, not an A/B test.
> - **Decision rules:** a capability missed in every view is a content problem (a proof page), not a layout problem.
> - **Site owners are tested too,** on their own work: finishing the first run, whether the suggested strengths and proof are the ones they'd choose, and whether their own visitors miss a strength (§6).

## 1. What each goal is measured by

| Goal ([README §3](README.md)) | Before launch | On every build | After launch |
|---|---|---|---|
| Every capability is seen | 5-second test | The coverage rule | `capability_l1_seen`: all six per visit |
| Every capability is remembered | Recall after 60 seconds | | |
| No strong capability is missed | The missed-capability question | | `capability_l2_open` per capability, per view |
| The visitor knows whether to dig deeper | First-click test | | `capability_l3_open` |
| The shortlist happens | Would you shortlist, and why | | `resume_open`, `resume_download`, `contact_open` |
| The first impression holds | Preference test; first words | LCP and layout shift budgets | Visits that leave within 10 seconds |

## 2. Tests with people

### 2.1 Who

| Group | Per round | Why |
|---|---|---|
| Recruiters (in-house and agency, design and tech) | 2 to 3 | The first filter; the 10-second visit |
| Hiring managers (design directors and VPs, product leaders who hire design) | 3 to 4 | The shortlist decision |
| Panel peers (a product or engineering lead) | 1 | The longer visit before a loop |

- **Not people who know his work well:** they recall what they already know. Colleagues can help recruit, but not take part.
- **Rounds of 5 to 8.** Small rounds find most of a design's problems. Run more rounds rather than larger ones.
- **Each person sees at most three views,** in a varied order, so tiredness and order don't decide the preference.

### 2.2 The session (about 30 minutes, moderated, remote)

| Step | Prompt | Measures | Time |
|---|---|---|---|
| 1. Set the role | "You're hiring a [role from the participant's own work]. A colleague sent you this link." | | 1 min |
| 2. 5-second test | Show the view for 5 seconds, then hide it. "What does this person do? What level?" | First impression; the positioning | 2 min |
| 3. Free look | "Take a minute, as you would at work." Then hide it | | 1 min |
| 4. Recall | "What can this person do? Name everything you remember." | Capability recall (target: 4 of 6) | 2 min |
| 5. Missed capability | "Is there anything you expected to find but didn't?" | **The failure case.** Each answer is checked against the spine: if the site shows it, it was missed | 2 min |
| 6. Recognition | Show the six capability names: "Which of these do you think he has?" | Separates *missed* from *not convinced* | 1 min |
| 7. First click | "Where would you click to see evidence of his AI work?" (then strategy, then leadership) | First-click success (target: 80%) | 3 min |
| 8. Dig | "Find what convinces you most about one of them." | Whether L3 answers the question | 5 min |
| 9. Decide | "Would you shortlist him? What would make it a yes?" | The shortlist; what's still missing | 3 min |
| 10. Compare | Repeat 2 to 5 on a second (and third) view; then "Which would you rather receive?" | Preference test, with reasons | 10 min |

Notes are coded by capability. A capability counts as **missed** when the participant expected it, didn't find it, and the view shows it on its first screen. That's the number that must reach zero.

### 2.3 On what

| Round | When | On what | Views |
|---|---|---|---|
| **0** | Before any code | Static mockups of the wireframes, with real content | Bento, Cover, Proof grid, Two sides (steps 2 to 7, 10) |
| **1** | Phase 1 is built | The built Bento, on the participant's own device | Bento, with the role lens from a link |
| **2** | Phase 2 is built | The built views | Bento against Cover and Proof grid; The short version as something to forward |
| **3** | Phase 3 is built | The built views | Showreel and Spotlight against Bento |

Round 0 needs no code, so it can run as soon as the owner signs off the spine's words.

## 3. Automated checks

These run on every build and hold the design to its rules. They're described with each view, gathered here:

| Check | What it holds | Where it's specified |
|---|---|---|
| The coverage rule | All six `data-capability` elements visible on the first screen of every offered view, at 1280 by 800 and 360 by 740 | [Foundation §5](foundation.md) |
| Accessibility | axe in light and dark; keyboard paths; reading without script; reduced motion | Each view's §9 |
| Budgets | LCP under 2.5 s on a mid-range phone; a view's JS under 15 KB gzip (Showreel's player under 40 KB); layout shift under 0.05 | [Foundation §10](foundation.md) |
| Screenshots | Each view at 360, 768 and 1280, light and dark | Each view's §10 |
| Addresses | `/views/<id>/`, a lens, and each view's own anchors open the right state | [Choosing a view](switcher.md) and each view |

## 4. Telemetry

Telemetry runs only on the published site. It respects GPC, Do Not Track and `?telemetry=off`. Each new event goes into the allowlist only if it carries nothing a visitor typed ([access spec](../access/spec.md)).

### 4.1 Targets

| Measure | From | Target |
|---|---|---|
| All six capabilities seen | `capability_l1_seen`, six per `home_view` | At least 90% of home visits |
| Visits that leave within 10 seconds | `home_view` and page exit | Under 10% |
| Capabilities dug into | `capability_l2_open`, `capability_l3_open` per capability | No capability under half the average; if one is, look at its proof line first |
| Conversion | `resume_open`, `resume_download`, `contact_open` per home visit | Above today's home page over a matching period |
| Switching | `view_switch`, `view_default` | Watched, no target: a high rate from the default means it isn't serving someone |
| Lenses | `home_view` with `lens` | Which roles visitors arrive for |

### 4.2 Per view

| View | Events | Tells us |
|---|---|---|
| Spotlight | `highlight_view` (`id`, `how`) | Which highlights are seen, and how far visitors go |
| Showreel | `reel_chapter` (`index`, `how`) | Where viewers drop off; which chapters lead to Open this |
| Keywords | `keyword_pick` (`id`, `on`), `skill_typed` (`matched` only) | What visitors hire for; which typed skills find nothing |
| Proof grid | `capability_l3_open` with `kind` | Which kind of evidence convinces |
| Questions | `question_open` (`id`), `question_asked` (`matched` only) | Which questions matter; whether the nine are the right ones |
| The short version | `brief_open`, `brief_print`, `brief_copy` | Whether recruiters forward it |

### 4.3 Reading it honestly

- **Volume is small.** A few hiring visits a week can't power an A/B test, so the default isn't randomised. A new default is compared with the old one over a matching period, with the role lenses and sources split out.
- **Telemetry says what, people say why.** A low number starts a question for the next round of tests; it doesn't decide by itself.
- **Not every visitor is hiring.** The lens, the source (a shared link or a stored view) and the résumé opens tell the hiring visits apart from the general audience's.

## 5. What would change the plan

| If | Then |
|---|---|
| A capability is missed in **every** view | It's a content problem: write or strengthen its proof (foundation §4), not a new layout |
| A capability is missed in **one** view | That view's L1 treatment of it changes (its size, position or words), and the coverage test gets a case for it |
| Bento's recall is under 4 of 6 | Shorten the proof lines; test the index tile's place on a phone; re-run round 1 |
| Cover or Two sides wins the preference test clearly, with equal recall | Make it the default (README H2) |
| Showreel is rarely watched past chapter 2 | Shorten it, and lead with the chapter that does get watched |
| Visitors who switch views mostly go to the same one | Offer it more prominently, or make it the default |
| Recruiters don't forward The short version | Move it into the résumé page, where they already go |

## 6. Tests with site owners

The same failure has a cause one step earlier: a strength the person never named, or whose proof the rules didn't find, can't be shown to anyone. So the curation and the Home screen are tested with the people who make home pages ([for every site §1](for-every-site.md)), on their own work.

**Who:** 5 to 8 per round, at least one of each of O1 to O4 (a newcomer, an experienced job hunter, a freelancer, a maker or writer). Never the owner, and never someone who helped design it.

**On what:** a copy of their own site, or their own work imported into a fresh one, with their consent, on the editor's fixture setup so nothing is published. Judging whether proof is right needs one's own work; made-up content tests only the screen.

**The session** (about 45 minutes, moderated, remote):

| Step | Prompt | Measures | Scenario |
|---|---|---|---|
| 1. Before anything | "What are you best at? Name three to six things." Written down, not shown again | Their own strengths, to compare with the result | |
| 2. First run | "Make your home page. Think aloud." No help unless stuck for 2 minutes | Completion, time, where they stop | [H-S1](owner-flows.md) |
| 3. Strengths | "Are these yours? What's missing?" | **Strength agreement:** step 1's strengths found among the final ones | |
| 4. Proof | "For each strength, is this the work you'd show first?" | **Proof agreement:** of each strength's top 3 Auto picks, how many they keep | |
| 5. A new page | Publish a page prepared from their work. "Where did it go? Is that right?" | Whether the placement and its note make sense | [H-S3](owner-flows.md) |
| 6. Controls | Three tasks: put a strength first; keep one page off the home; make a link for a job they'd apply to | Task success without help; which layer they look in first ([controls](controls.md)) | [H-S4](owner-flows.md), [H-S5](owner-flows.md) |
| 7. With AI | When the round has it: the first run again on a second copy, with Suggest | Time, and proposals accepted ([AI curation §10](ai-curation.md)) | [H-S2](owner-flows.md) |
| 8. Their visitor | Afterwards, one of their likely visitors does steps 2 to 5 of §2.2 on the home they made | Whether a strength is missed | |

**Targets:**

| Measure | Target |
|---|---|
| First run finished without help | At least 4 in 5 |
| Time to a first home page | Under 10 minutes; under 5 with AI |
| Strength agreement | At least 80% of step 1's strengths among the final ones; none lost that the person says matters most |
| Proof agreement | At least 2 of each strength's top 3 kept |
| Control tasks without help | At least 80%, and nobody opens More options for a task Tune covers |
| Strengths missed by their visitor | Zero, the same rule as §2.2 |

Edit mode sends nothing anywhere: these are measured in sessions, and the AI measures are counted on the person's own computer ([AI curation §10](ai-curation.md)).

**What would change the plan:**

| If | Then |
|---|---|
| Strength agreement is low | The suggestions or the common strengths change ([for every site §3.1](for-every-site.md)), not the person's words |
| Proof agreement is low | Matching and the score change ([curation §4](curation.md), [§5](curation.md)), first the topic vocabulary, then the weights |
| People stop at step 2 of the first run | Lead with Common strengths, or with Suggest where AI is set up |
| People open More options for ordinary tasks | That control moves into Tune |
| A strength is missed by their visitor but was found by the rules | It's a view's L1 problem, as in §5 |

## 7. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| E1 | Who runs the sessions | The owner; a researcher he knows; an unmoderated testing service | A researcher he knows: the owner moderating his own profile biases every answer |
| E2 | Recruiting participants | The owner's network (second degree); a panel service | Second-degree network for hiring managers; a panel for recruiters |
| E3 | Round 0 on mockups | Yes; wait for built pages | Yes: it's cheap, and it tests the spine's words before anything is built |
| E4 | Recording sessions | Video with consent; notes only | Notes, plus video only with written consent, kept off the repository |
| E5 | What site owners are tested on | Their own work, copied with consent; the starter's samples | Their own work: only the person can judge whether the proof is right |
