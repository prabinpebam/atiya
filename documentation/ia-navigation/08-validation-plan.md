# Validation plan

## What must be validated

The IA succeeds when visitors can:

- describe the portfolio owner's professional positioning;
- find relevant evidence without scanning a long skill list;
- distinguish work evidence from capability explanation;
- recognize leadership as a central part of the practice;
- move between related disciplines without losing orientation;
- understand personal contribution and team context;
- reach all core content without using an experimental interface.

## Round 1: Tree test

Test the text-only hierarchy before visual design.

Suggested participants:

- two design leaders or hiring managers;
- one product or engineering leader;
- one senior designer;
- one person unfamiliar with the portfolio owner.

Tasks:

1. Find evidence of building a healthy design team.
2. Find work involving production-ready frontend code.
3. Find examples of motion or 3D work.
4. Find how AI is applied to research or documentation.
5. Find a case that shows end-to-end product design.
6. Find the portfolio owner's approach to hiring.
7. Find the strongest examples of shipped outcomes.

Target:

- At least 80% direct or eventual success for each core task.
- No core task should depend on participants guessing that a software name contains the answer.

## Round 2: First-click test

Show the Home page structure without interactions and ask where participants would go first for each task.

Track:

- first choice;
- confidence;
- expectation of what will be found;
- labels participants interpret differently.

The expected first choices should usually be:

| Task | Expected destination |
|---|---|
| Assess quality and impact | Work |
| Understand breadth | Expertise |
| Assess management and culture | Leadership |
| Review career context | About or Resume |

## Round 3: Five-second comprehension

Show the Home page for five seconds, then ask:

- What does this person do?
- What level do they operate at?
- What is distinctive about their practice?
- What would you click next?

Success target: most participants mention design leadership plus at least one of craft, technology, product delivery, or strategic influence.

## Round 4: Case-study scan

Give participants 60 seconds on a case study, then ask:

- What was the problem?
- What was this person's role?
- Who else was involved?
- What changed?
- What evidence supports the claim?

If these answers are unclear, fix the scan layer before adding more narrative.

## Accessibility and resilience checks

Before approving the navigation concept, verify:

- all destinations are reachable with keyboard only;
- focus order follows information order;
- active location is not communicated by color alone;
- link text makes sense out of context;
- reduced-motion users receive an equivalent experience;
- zoom and reflow do not hide navigation;
- content remains navigable without WebGL or optional enhancements;
- every core destination has a stable URL;
- back, forward, refresh, and deep linking behave predictably.

## Analytics questions

If privacy-appropriate analytics are later used, collect only what answers a decision:

- Which Home-page routes are used?
- Do visitors move from Expertise or Leadership to evidence?
- Which case studies lead to About, Resume, or Contact?
- Are filters used enough to justify their complexity?
- Where do visitors encounter broken or dead-end paths?

Do not optimize for page views alone. Useful signals include progression from positioning to evidence and from evidence to contact or resume.

## IA definition of done

- [ ] Every listed capability maps to a canonical practice area.
- [ ] Three to five launch case studies have been selected.
- [ ] Every selected case study has a primary area, contribution, outcome, and visibility status.
- [ ] Primary and local navigation labels have passed a tree or first-click test.
- [ ] Expertise, Leadership, and Work have distinct content jobs.
- [ ] No core journey depends on search, filters, animation, 3D, or hover.
- [ ] Confidentiality and permissions have been reviewed.
- [ ] Deep pages provide orientation and onward paths.
- [ ] Navigation has keyboard, reduced-motion, and no-enhancement equivalents.
- [ ] Content ownership and review cadence are agreed.
