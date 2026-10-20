# Curating with AI

Atiya is getting AI services for writing ([AI services](../editor/ai-services.md), [AI editing](../editor/ai-editing.md)). The same services can help a person make their home page: find their strengths, place a new page, write a line, tailor the home for one job. This page specifies that help. It adds to [Curating the home page](curation.md), never replaces it: every job here has a rule-based twin, so a site without AI works fully. It's part of [Home page views](README.md).

> **TL;DR.**
> - **AI works when the person is editing, never when a visitor is reading.** The site stays static on GitHub Pages, with no server of ours (promise P3). A visitor never reads words a model wrote that the person didn't accept.
> - **One contract:** the curation request extends AI editing's edit request with home scopes (the whole home, a strength, a page's place, a lens, the answers, a job). The answer is a list of proposed changes, checked and reviewed like any other.
> - **Grounded or refused:**
>   - every proposed line, answer or caption cites the published, open text it comes from, word for word;
>   - every number in it appears in a cited quote;
>   - a line is at most 6 words, with no empty praise.
>   - A proposal that fails is sent back once, then dropped.
> - **Ten jobs,** each with a rule-based twin: find my strengths, place a new page, write a line, choose a voice, tag topics, tailor to a job description, turn a gap into a page, draft answers, find what's out of date, write the Showreel's captions.
> - **Private stays private:** only published, open content is ever sent. A pasted job description goes only to the chosen service and is never written to the public repository.
> - **Agents get the same:** MCP tools and `atiya home` commands, with the same check.

## 1. Where AI runs

| Option | How | For | Against | Verdict |
|---|---|---|---|---|
| **A. When the person edits** | Edit mode calls the person's chosen service through the AI connector ([AI services §4](../editor/ai-services.md#4-five-ways-to-build-it)); accepted proposals become content | Checked, reviewed, free to read, works on a static site, the person's own key and provider | The home page is only as current as the last accepted proposal | **Recommended** |
| B. When a visitor reads, on a server | An "Ask about me" chat or live tailoring, answered by a model on a server | Feels personal to each visitor | Needs a server and a paid key (against P3); the visitor reads unchecked words about the person; a visitor can steer it with their own text (prompt injection) | Rejected |
| C. When a visitor reads, in their browser | A small model downloaded to the visitor's browser | No server | A large download on a first visit, uneven support across browsers, and still unchecked words | Set aside |

What a visitor wants from B, the Keywords and Questions views already give, with words the person has checked ([keywords](keywords.md), [questions](questions.md)), and a tailored link (§6) gives a hiring manager a home made for their role without any AI at visit time.

## 2. The curation request

It's AI editing's edit request ([AI editing §2](../editor/ai-editing.md#2-the-edit-request-one-contract-under-every-feature)) with home scopes. The connector, the providers, the keys, the stop button and the size shown before sending are all the same.

```json
{
  "scope": { "kind": "strength", "id": "ai" },
  "instruction": "Suggest a line for this strength",
  "goal": "hired",
  "showcase": { "…": "the current decisions" },
  "evidence": [
    {
      "ref": "ref:article/cloner-pro",
      "title": "…", "summary": "…", "kind": "built", "topics": ["ai", "figma-plugin"],
      "section": "projects", "headings": ["…"], "date": "2026-…",
      "sentences": ["…the five sentences with the most numbers and named outcomes…"]
    }
  ],
  "allowed": ["line"]
}
```

| `scope.kind` | Means | `allowed` |
|---|---|---|
| `showcase` | The whole home: strengths, lines, matches, highlights | `addCapability`, `line`, `match`, `pin`, `highlight` |
| `strength` | One strength | `line`, `match`, `pin`, `hide`, `voice` |
| `placement` | One page: which strengths it proves, its kind, its topics | `match`, `contribution`, `topics` |
| `lens` | A lens's order and lead voice | `lens` |
| `answers` | The Questions view's answers | `answer` |
| `job` | A pasted job description (§6) | `lens`, `keywords` |

**The evidence is a digest,** not the pages: about 150 tokens a page (title, summary, kind, topics, section, headings, date, and the five sentences with the most numbers and named outcomes). For a big site, **two passes:** the rules shortlist the best 30 candidates per strength ([curation §9](curation.md)), and only those go to the model. A request is held under about 20,000 tokens, and its size is shown before it's sent.

**The answer:**

```json
{
  "changes": [
    {
      "op": "line", "capability": "ai", "text": "Coded prototypes replaced specs",
      "because": [ { "ref": "ref:article/…", "quote": "…the sentence it rests on…" } ]
    }
  ],
  "summary": "Three lines, each from a sentence on your pages."
}
```

## 3. Grounded or refused

The answer goes through the same check as a save (the content contract's Zod schemas and the store's check), plus a **grounding check** for anything a visitor would read:

1. **Cited:** every line, answer, caption or keyword carries `because`: at least one `{ref, quote}`.
2. **Word for word:** each quote is found in its source, which must be published and open. The same rule as voices and résumé fragments ([foundation §2](foundation.md)).
3. **Numbers:** every number in the proposed text appears in a cited quote.
4. **Short:** a line is at most 6 words; an answer at most 40; a caption at most 12.
5. **No empty praise:** words like "passionate", "innovative", "visionary", "world-class" and "results-driven" are refused in lines (a list in the engine's catalogue).
6. **Inside `allowed`:** a request for a line can't add a strength.

A refused answer goes back once with the reasons; refused again, the person sees "AI couldn't ground this suggestion in your pages" and nothing changes. A grounding refusal is useful information: it usually means the proof isn't on the site yet (§5).

## 4. Ten jobs, each with its twin

| # | Job | Where it's offered | What AI proposes | Without AI |
|---|---|---|---|---|
| 1 | **Find my strengths** | The Home screen's first run | 3 to 6 strengths with names, lines and the pages behind each | Clusters of topics and sections, largest first, named after their topic; the person renames them |
| 2 | **Place a new page** | The card after Publish | Which strengths it proves, its part (Your part), its topics | Matching ([curation §4](curation.md)) and the kind's default |
| 3 | **Write a line** | A strength's Line field: Suggest | Up to 3 lines of 6 words or fewer, each cited | The best proof's title, for the person to shorten |
| 4 | **Choose a voice** | A strength's Voice: Suggest | Up to 3 sentences from recommendations that speak to this strength | **Select to quote:** the person selects a sentence in a recommendation |
| 5 | **Tag topics** | Pages with no topics (a health opportunity) | Topics from the vocabulary, or a new one, per page | Topics suggested on save by matching labels and synonyms |
| 6 | **Tailor to a job** | Links: New link from a job description | A lens (the order, the lead voice), keywords to bring forward, and a match report (§6) | Keyword matching in edit mode, against the keywords and the topic vocabulary |
| 7 | **Turn a gap into a page** | A warning: "AI rests only on résumé lines" | An outline for a proof page, handed to AI editing's empty page ([AI editing §5](../editor/ai-editing.md#5-starting-from-an-empty-page-u3)) | A page made from the template for its kind, with the résumé lines as prompts |
| 8 | **Draft answers** | The Questions view's settings | An answer per question, each cited | The person writes them; each answer's evidence is filled in by the rules |
| 9 | **Find what's out of date** | Health: Review with AI | Lines, answers and highlights whose proof has changed or aged, with a new version of each | Dates, the stale status and the quote check |
| 10 | **Write the Showreel's captions** | The Showreel's settings | A caption per chapter, each cited | The highlights' titles and the strengths' lines |

## 5. Gaps become pages

The most useful thing AI can say about a home page is often "there's nothing to cite". When a strength rests only on résumé lines, or a job asks for something the site doesn't show:

1. The health report's warning offers **Outline a page**.
2. The curation request (scope `strength`) asks for an outline built from the résumé lines and the related pages, with headings and what each section should prove.
3. The outline opens as a new draft page through AI editing's empty-page flow, with the strength's topic set, so once it's published, curation places it by itself.

This is the owner's case ([foundation §4](foundation.md)): the proof pages for AI transformation and product strategy are the content work no layout can replace.

## 6. Tailoring to a job

A person applying for a role pastes the job description and gets a link made for it ([owner flows §5](owner-flows.md)).

**The match report**, shown before anything is made:

| Requirement (from the description) | Status | Evidence |
|---|---|---|
| Leads design teams of 10 or more | Covered | Two pages, a résumé line, a voice |
| Agentic AI experiences | Covered | One page, two résumé lines |
| B2B payments | Thin | One résumé line, no page |
| Manages managers | Not shown | Nothing on the site |

- **It never invents:** a requirement the site doesn't show stays "Not shown". The fix is a page (§5) or a conversation, never a sentence.
- **What it proposes** is a lens: the strengths' order, the lead voice and up to 6 keywords brought forward. Nothing is hidden: the coverage rule holds under every lens.
- **Without AI,** edit mode matches the description's words against the keywords, the topic vocabulary and the proof's titles, in the person's browser, and shows the same table with "Covered" and "Not shown" only.

## 7. Review

The proposal opens in AI editing's review component ([AI editing §8](../editor/ai-editing.md#8-review-one-component-for-every-proposal)) on the Home screen:
- **A row per change** with Accept and Reject, and under it its citations: the quote, its page, **Open source**.
- **The preview updates as rows are accepted,** with the coverage meter, so the person sees the home page they're agreeing to.
- **Accept all** is offered only when every row passed the grounding check; it's one undo step, and a version is kept first.
- **Marking AI's words:** accepted lines are tinted in edit mode until the person edits them, as in articles (the same decision: [AI editing §8](../editor/ai-editing.md#8-review-one-component-for-every-proposal), "Marking AI's words").

## 8. Agents

An agent working for a person (job J7) uses the same contract, through edit mode as an MCP server ([AI services §5](../editor/ai-services.md#5-recommendation-and-phases)) or the CLI:

| Tool or command | Does |
|---|---|
| `get_showcase` | The decisions in `showcase.json` |
| `get_evidence_index` | The digest of §2, for every open page |
| `get_home_health` / `atiya home check` | The health report as JSON; the command exits non-zero on a blocking item |
| `propose_showcase` | Sends a proposal: checked and grounded exactly as above, then waiting in the Home screen's review for the person |
| `atiya home apply <file>` | Applies a proposal the person has approved, after the same check; refuses one that isn't grounded |

An agent with its own model needs no AI service in edit mode: it reads the index, writes a proposal and edit mode checks it. That's the cheapest way in for a person who already uses an agent.

## 9. Privacy and safety

- **Only published, open content is sent.** The evidence index has no private page, draft or redacted page in it (curation §3), so nothing private can reach a model through home curation, whatever the provider.
- **A job description** goes only to the chosen service, for that one request. It's never written to `content/`. If the person keeps it for later, it's kept with the link's label: in the private repository when private pages are set up, otherwise on this computer.
- **Prompt injection:** pages, recommendations and job descriptions go as data, marked as such; the model gets no tools and can only return a proposal, which the check limits. A hostile sentence in a pasted job description can, at worst, make a proposal the person rejects.
- **Keys** stay where AI services keeps them ([AI services §6](../editor/ai-services.md#6-keys-privacy-and-cost)).
- **Tests never call a real service:** the editor E2E uses the stand-in provider, as AI editing does.

## 10. How we'll know

Measured in tests with site owners ([evaluation §6](evaluation.md)) and counted only on the person's computer, never sent anywhere:

| Measure | Target |
|---|---|
| Time to a first home page with Find my strengths | Under 5 minutes, against about 10 without AI |
| Proposals accepted, per job | Watched: a job under a third accepted needs a better prompt or isn't worth offering |
| Grounding refusals | Under 1 in 10 requests on a site with 10 or more pages |
| Lines rewritten after accepting | Watched: high means the lines don't sound like the person |

## 11. Phases

| Phase | What | Needs |
|---|---|---|
| 1 | None: rule-based curation ships first | [Curation](curation.md) |
| 2 | The curation request, the grounding check, review on the Home screen; jobs 2, 3 and 5 | AI editing phase 1 (the edit request, the review, one provider) |
| 3 | Jobs 1, 6 and 7: the first run, tailoring, gaps to pages | 2 |
| 4 | Jobs 4, 8, 9 and 10; the MCP tools and `atiya home` | 3, AI services' MCP |

## 12. Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| AI1 | When AI runs | When the person edits; also when a visitor reads | Only when the person edits (§1) |
| AI2 | A visitor-facing "Ask about me" chat | Never; later, if a static answer set proves too narrow | Never in these phases: Questions and Keywords cover it with checked words |
| AI3 | Grounding strictness | Every line cited word for word; cited loosely; not cited | Word for word: the same rule as voices |
| AI4 | Job descriptions | Sent only to the chosen service, kept privately if at all; stored with the link | Kept privately or not at all |
| AI5 | Accept all | Always; only when every row is grounded | Only when every row is grounded |
| AI6 | Agents applying proposals | Review in the app always; `atiya home apply` after the check | Both: the CLI is for an agent the person asked to do it |
