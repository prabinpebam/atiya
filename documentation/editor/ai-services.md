# Edit mode: AI services (spec)

Which AI services edit mode uses, how each is connected and set up, and how your own agent reaches edit mode. It's the service half of [AI editing and comments](ai-editing.md), which has the features, the review and the shared phase plan. Each finding about a service names its source, read on 20 October 2026; what couldn't be checked says so.

> **TL;DR.**
> - **Two directions.** Edit mode *calls* a service: a cloud API with your key, or a model on this computer with none. Or your own agent (Claude Code, Codex, Copilot CLI, OpenClaw, Hermes Agent), signed in its own way, *calls edit mode* through an MCP server and proposes changes for you to review.
> - **A connector, not an agent harness.** For the first direction, edit mode's dev server holds a thin connector: one request, one answer, no tools. It decides (by rules, or with Jev when it's on), writes through one of three adapters (OpenAI-compatible, Anthropic, Gemini), then checks. Anything agentic, like research on the web, runs in your agent, which brings its own harness.
> - **Subscriptions are the catch.** Anthropic forbids third-party apps from using a Claude Pro or Max sign-in, and Google has banned accounts for it. GitHub's Copilot SDK is the exception. So a subscription is used by running the vendor's own agent yourself, through the MCP server.
> - **Set up on one screen, AI,** in about a minute: add a service, accept its disclaimer, test it. Ollama on this computer is found by itself. Keys never reach edit mode's pages. Atiya Studio keeps them encrypted by the operating system, and plain `npm run dev` reads them from Windows Credential Manager.
> - **Jev is the optional decider,** off by default, with a disclaimer like any cloud service. Edit mode works the same without it.
> - **Status:** specified, not built. The phases are AI editing's ([§15](ai-editing.md#15-phases-and-definition-of-done)).

<figure class="slate-figure" data-diagram="ai-services">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" role="img" aria-labelledby="ed-ai-services__title ed-ai-services__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-ai-services__title">AI services: a connector for APIs, an MCP server for agents</title>
<desc id="ed-ai-services__desc">The article editor sends edit requests to an AI connector in the dev server, where the keys stay. The connector isn't an agent: it sends one request and gets one answer, with no tools, no files and no loop. It works in three steps. Decide: rules in code, or Jev when it's on, say whether the request can be done here at all (a request that needs research goes to your agent instead) and which block types fit. Write: one adapter per kind of API, for cloud APIs (OpenAI, Claude, Gemini, Azure), models on this computer (Ollama, LM Studio), and later agent SDKs such as GitHub's Copilot SDK, whose own harness runs the agent. Check: every answer is held to the content contract. The other way in runs the opposite direction: edit mode is an MCP server, and the owner's own agent (Claude Code, Codex, Copilot CLI, OpenClaw, Hermes Agent), signed in its own way and run in Atiya Studio's terminal, calls its tools; what it proposes comes back to the editor for review like any other answer.</desc>
<g id="ed-ai-services__editor" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-1" x="40" y="40" width="220" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Article editor</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">edit mode</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Edit requests</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Review and apply</text>
</g>
<g id="ed-ai-services__connector" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-2" x="340" y="40" width="240" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="360" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">AI connector</text>
<text x="360" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">dev server, keys stay here</text>
<text x="360" y="122" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">Decide: rules or Jev</text>
<text x="360" y="146" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">Write: an adapter per API</text>
<text x="360" y="170" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">Check every answer</text>
</g>
<g id="ed-ai-services__apis" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-3" x="660" y="40" width="300" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="70" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-3" data-slate-fit-padding="16">Cloud APIs</text>
<text x="680" y="92" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-3" data-slate-fit-padding="16">OpenAI, Claude, Gemini, Azure</text>
<rect id="ed-ai-services__body-4" x="660" y="130" width="300" height="70" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-4" data-slate-fit-padding="16">On this computer</text>
<text x="680" y="182" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-4" data-slate-fit-padding="16">Ollama, LM Studio</text>
<rect id="ed-ai-services__body-5" x="660" y="220" width="300" height="70" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="680" y="250" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-5" data-slate-fit-padding="16">Agent SDKs</text>
<text x="680" y="272" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-5" data-slate-fit-padding="16">GitHub's Copilot SDK, later</text>
</g>
<g id="ed-ai-services__mcp" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-6" x="340" y="350" width="240" height="110" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="360" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-6" data-slate-fit-padding="16">MCP server</text>
<text x="360" y="404" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-6" data-slate-fit-padding="16">edit mode's own tools</text>
<text x="360" y="436" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-6" data-slate-fit-padding="16">get_article, propose</text>
</g>
<g id="ed-ai-services__agent" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-7" x="660" y="350" width="300" height="110" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="680" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-7" data-slate-fit-padding="16">Your own agent</text>
<text x="680" y="404" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-7" data-slate-fit-padding="16">signed in its own way</text>
<text x="680" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-7" data-slate-fit-padding="16">Claude Code, Codex, Copilot CLI</text>
<text x="680" y="452" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-7" data-slate-fit-padding="16">OpenClaw, Hermes Agent</text>
</g>
<text x="270" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">request</text>
<text x="592" y="66" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">key</text>
<text x="592" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">no key</text>
<text x="592" y="372" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">calls tools</text>
<text x="160" y="300" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">proposals come back for review</text>
<text x="40" y="500" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Either way, an answer is a proposal, checked against the content contract, and nothing changes until you accept it.</text>
<g id="ed-ai-services__flow-1" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M260 115 L330 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="339,115 330,120 330,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-services__flow-2" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M580 80 L650 80" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,80 650,85 650,75" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-services__flow-3" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M580 165 L650 165" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,165 650,170 650,160" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-services__flow-4" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M560 190 L560 255 L650 255" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="659,255 650,260 650,250" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-services__flow-5" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M660 405 L590 405" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="581,405 590,410 590,400" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-ai-services__flow-6" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M340 405 L150 405 L150 200" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="150,191 155,200 145,200" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Two ways in: edit mode calls an API or a local model through its connector, or your own agent calls edit mode's MCP server. Both end in the same review.</figcaption>
</figure>

## 1. Promises, setup jobs and what you can do

### 1.1 Promises

| ID | Promise | Held by |
|---|---|---|
| S-P1 | **Use what you have:** a key, a model on this computer, or your own agent signed in its own way, always within its terms | §2, §10 |
| S-P2 | **Clear about where your words go:** every service says where it runs and what it does with your words, before you use it | §6, §8 |
| S-P3 | **Keys stay secret:** never in the site's files, a log, an answer or a page | §6 |
| S-P4 | **Set up in a minute, and checked:** a service is tested before it's used, and a problem says what to do | §7 |
| S-P5 | **Nothing depends on AI:** edit mode and comments work fully with no service set up | [AI editing §7](ai-editing.md#7-comments-u5-u6-u7) |

### 1.2 Setup jobs

| When I… | I want to… | So I can… |
|---|---|---|
| have an OpenAI, Anthropic, Gemini or Azure key | add it once and be told it works | use AI in the editor straight away |
| would rather keep everything on my computer | use Ollama or LM Studio with no key | write with AI offline and for free |
| pay for Claude Max, ChatGPT or Copilot | use it within its terms | not pay twice |
| want smarter routing for research and block types | turn on Jev | get "needs research" and the right block more often |
| worry a key has leaked | replace or remove it at once | stop anyone else using it |
| want my agent to work on an article | connect it to edit mode in a step or two | review its changes like any other |

### 1.3 What you can do

| ID | As the owner, I can… | Section |
|---|---|---|
| S1 | Add a cloud service with a key, in Atiya Studio or plain `npm run dev` | §7.2, §7.3 |
| S2 | Use a model on this computer, found by itself when it's running | §7.4 |
| S3 | Choose the writer: the service and model every AI request uses | §8 |
| S4 | Turn on Jev as the decider | §7.5 |
| S5 | Set a service, or agents, not to get private pages | §8 |
| S6 | Test a service | §7.7 |
| S7 | Replace a key, or remove a service | §7.7 |
| S8 | Let my own agent propose changes through MCP, and copy its setup | §7.6 |
| S9 | Make a new agent token, so the old one stops working | §7.6 |
| S10 | See open proposals from agents, and open their review | §8 |

## 2. The wishlist, one by one

A service is judged on four things. Can it be held to a JSON schema while it writes, or only asked nicely? Can a long answer be streamed and stopped? How do you sign in, and do its terms allow an app like this? Does it run on this computer or in someone's cloud?

| Service | How it's reached | Sign-in | Held to a schema | Verdict |
|---|---|---|---|---|
| **Ollama** | Its OpenAI-compatible `/v1` | None (local) | Yes: JSON Schema since v0.5.0, and `/v1` honours `json_schema` | **Supported directly** (phase 1). Local, free, MIT. Not its hosted cloud models, which don't do structured output |
| **Claude API** | The Messages API | API key | Yes: native structured outputs | **Supported directly** (phase 2) |
| **OpenAI API** | Chat Completions, OpenAI-compatible | API key, billed apart from ChatGPT | Yes, `strict` | **Supported directly** (phase 1) |
| **Gemini API** | `generateContent` | API key | Shape only: valid JSON, no strict guarantee | **Supported directly** (phase 2), with our check doing the rest |
| **Models on Azure** | Azure OpenAI's v1 API (OpenAI-compatible) | API key | Yes for Azure OpenAI; per model for Foundry's others | **Supported directly** (phase 1) for Azure OpenAI. Each Foundry model is checked before it's offered |
| **Claude Code** | As an agent, through MCP | Its own, including Pro or Max | Through the proposal check | **Supported as an agent** (phase 6). A Pro or Max sign-in can't be used by another app, but Claude Code using it is fine. It runs unsandboxed on native Windows |
| **Codex CLI** | As an agent, through MCP | Its own | Through the proposal check | **Supported as an agent** (phase 6). It can also run on Ollama or LM Studio, offline |
| **Copilot CLI** | As an agent, through MCP; or GitHub's Copilot SDK as a writer | Your Copilot subscription | Our check | **Supported both ways:** as an agent (phase 6), and through the Copilot SDK (phase 8), which GitHub documents for apps like this |
| **Terminal** | A real terminal in Atiya Studio, and a command provider | Whatever the command uses | Our check | **Supported** (phase 7): a terminal to run your agent beside the article; a command provider for anything scriptable |
| **Jev API** | REST, `/v1/systemone` | API key | Typed decisions, not text | **Supported as the optional decider** (phase 2): it answers typed questions about a request (§9.1). It never writes |
| **OpenClaw** | As an agent, through MCP | Its own | Through the proposal check | **Supported as an agent** (phase 6). Its shell runs unsandboxed by default |
| **Hermes** | The model: OpenRouter or Ollama. Hermes Agent: an agent, like OpenClaw | Key, or none | The model: yes (OpenRouter) | **Supported both ways:** the model as a writer through the OpenAI-compatible adapter (phase 1); Hermes Agent through MCP (phase 6) |

Sources, by row: Ollama's [structured outputs](https://ollama.com/blog/structured-outputs), [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) and [cloud](https://docs.ollama.com/cloud); Anthropic's [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs); OpenAI's [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform); Google's [structured output](https://ai.google.dev/gemini-api/docs/structured-output); Microsoft's [API lifecycle](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle), [structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) and [Foundry's migration](https://learn.microsoft.com/en-us/azure/foundry/how-to/model-inference-to-openai-migration); Claude Code's [headless mode](https://code.claude.com/docs/en/headless), [legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) and [sandboxing](https://code.claude.com/docs/en/sandboxing); Codex's [non-interactive mode](https://developers.openai.com/codex/noninteractive) and [authentication](https://developers.openai.com/codex/auth); GitHub's [Copilot CLI programmatically](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically), [Copilot SDK](https://github.com/github/copilot-sdk) and [multi-tenancy](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy); [Jev](https://jevapi.dev/); OpenClaw's [gateway](https://docs.openclaw.ai/gateway), [MCP](https://docs.openclaw.ai/tools/mcp) and [why OpenClaw](https://docs.openclaw.ai/start/why-openclaw); [Hermes 4](https://huggingface.co/NousResearch/Hermes-4-405B) on [OpenRouter](https://openrouter.ai/nousresearch/hermes-4-405b/llms.txt).

### 2.1 What else

| Service | Verdict |
|---|---|
| **LM Studio** | **Supported directly** (phase 1): a local OpenAI-compatible server with strict JSON schemas. Free to use through its published interfaces; the app may not be bundled ([structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output), [terms](https://lmstudio.ai/app-terms)) |
| **OpenRouter** | **Supported** (phase 1) through the OpenAI-compatible adapter: one key for many models, including open ones. Structured output depends on the serving endpoint, so requests set `require_parameters` ([structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)) |
| **Mistral, Groq** | **Supported** through the same adapter, as "Other OpenAI-compatible". Groq's `strict` works only on some models |
| **opencode** | **Supported as an agent** through MCP. Its docs say it removed Claude subscription relaying because Anthropic prohibits it ([SDK](https://opencode.ai/docs/sdk/), [providers](https://opencode.ai/docs/providers/)) |
| **Gemini CLI, Cursor** | **Supported as agents** through MCP |
| **AWS Bedrock** | Not supported: its own API and IAM sign-in aren't worth it for a personal site |
| **GitHub Models** | **Gone:** retired on 30 July 2026 ([GitHub](https://docs.github.com/en/github-models)) |
| **ChatGPT** | Not as an agent: it reaches only public HTTPS MCP servers ([developer mode](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)) |

### 2.2 Subscriptions, plainly

- **Claude Pro and Max:** "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users" ([legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). Press reports say it's enforced (not checked independently).
- **Gemini sign-in:** Gemini CLI's terms forbid using third-party software to reach its services with that sign-in, and accounts were banned in February 2026 for it (press-reported). Gemini CLI is also being replaced by Antigravity CLI for individual subscribers ([Google](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/), [terms](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md)).
- **ChatGPT sign-in in Codex:** no document allows or forbids an app driving it. OpenAI's docs point automation at API keys.
- **GitHub Copilot:** the Copilot SDK is documented for exactly this, including products that embed it for many users.

So edit mode never signs in to a subscription. You run **the vendor's own tool, yourself**, and it reaches edit mode through MCP. Claude Code signed in with your Max plan, in a terminal, proposing through edit mode's tools, is Claude Code being Claude Code.

## 3. Where the AI is called from

Edit mode's server runs only on your computer and answers only edit mode's own pages (loopback, the Host, same origin). The connector lives there too:

- **Keys never reach the browser.** The editor's page asks its own server, which calls the service.
- **The same code serves Atiya Studio and plain `npm run dev`.** Only where the key comes from differs (§6.1).
- **Nothing of it is built into the site.** Like the rest of edit mode, it's dev-only, and `verify:prod` keeps it out.
- **The MCP server** is a route of the same dev server, with its own guard (§10).

## 4. Five ways to build it

All five were weighed. Four are used, in the order in §5. B is the fallback.

- **A. Our own thin connector.** Decided, phase 1. One request, one answer: no agent loop, and the model gets no tools, no files and no memory. Three adapters behind one interface: OpenAI-compatible (OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter, Mistral, Groq: a base URL and a key), Anthropic Messages, and Gemini's own API (its OpenAI-compatible mode wasn't confirmed to honour schemas). It needs no new dependency, since it uses plain `fetch` and the Zod we have. We keep three adapters current, and the answer's schema is written to the strictest of their rules: OpenAI wants every field required, and Anthropic doesn't allow recursive schemas.
- **B. A unified SDK (Vercel's AI SDK).** Not used; it's the fallback if the adapters cost more than expected, behind the same interface. It covers more providers for less code, but adds several dependencies to pin. Its object helpers are already deprecated, to be removed in v7, and it doesn't reach agents ([structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [MCP](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)).
- **C. Agent tools as providers.** Only GitHub's Copilot SDK, in phase 8. Other agents can't use their subscriptions this way (§2.2). With an API key, A is simpler. Agents are built to run commands and edit files, and on Windows, starting `.cmd` shims and stopping process trees need care ([Node's 2024 advisory](https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2)). ACP, the Agent Client Protocol, was considered for driving them ([ACP agents](https://agentclientprotocol.com/get-started/agents.md)).
- **D. Edit mode as an MCP server.** Decided, phase 6 (it can move earlier). Every agent you use, signed in its own way and within its own terms, proposes changes to the same review. It can do longer work, like research or drafting from your notes folder, and the review stays ours. You run the agent, so its loop, speed and cost are its own ([MCP in Claude Code](https://code.claude.com/docs/en/mcp), [OpenClaw](https://docs.openclaw.ai/tools/mcp)). Specified in §10.
- **E. A terminal.** Decided, phase 7. A real shell in a panel of Atiya Studio beside the article (xterm.js on node-pty, the pair VS Code uses), where you start your agent. It's for you to type in, never for AI to drive: an open shell for a model is OWASP's "excessive agency." node-pty is native, so it's rebuilt for Electron and signed with the app ([node-pty](https://github.com/microsoft/node-pty), [OWASP LLM Top 10 2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/)). Beside it, a **command provider**: a command you name, given the request on standard input and printing the answer, for anything scriptable.

| | A. Own connector | B. Unified SDK | C. Agents as providers | D. MCP server | E. Terminal |
|---|---|---|---|---|---|
| Wishlist covered | APIs, Azure, Ollama, LM Studio, the Hermes model | The same, more APIs | Copilot (SDK) | Every agent | Anything scriptable; your agents |
| Uses your subscriptions | No | No | Copilot only | **Yes** | Yes, with D |
| New dependencies | None | Several | The Copilot SDK | The MCP SDK | xterm.js, node-pty (native) |
| Control of the experience | Full | Full | Partial | The agent's | The agent's |
| Risk | Low | Low | Agents run commands | Low: proposals only | A shell, for you only |
| Effort | Small | Small | Medium | Medium | Medium (native module) |
| Status | **Phase 1** | Fallback | **Phase 8** | **Phase 6** | **Phase 7** |

## 5. Recommendation and phases

The order is decided, and it's AI editing's phase plan ([AI editing §15](ai-editing.md#15-phases-and-definition-of-done)), seen from the services' side:

1. **Phase 1:** the connector (A) with the OpenAI-compatible adapter, which reaches OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter and the Hermes model. Rules-only Decide. The AI screen.
2. **Phase 2:** the Anthropic and Gemini adapters. Jev as the decider.
3. **Phase 6:** edit mode as an MCP server (D), so Claude Code, Codex, Copilot CLI, OpenClaw, Hermes Agent and the rest work with their own sign-ins. It needs only phase 1, so it can move earlier.
4. **Phase 7:** the terminal in Atiya Studio (E), with **Open in terminal** for a request that needs research, and the command provider.
5. **Phase 8:** GitHub's Copilot SDK (C), as a writer inside the editor's own prompt.

## 6. Keys, privacy and cost

### 6.1 Keys

- **In Atiya Studio,** you type a key into the app's own dialog, drawn by the app over edit mode, so the key never enters edit mode's page. The app keeps it encrypted with Electron's `safeStorage` (the operating system's protection) in its own data, never in the site's folder. It hands keys to the site's dev server through its environment at start (`ATIYA_AI_<ID>_KEY`, where `<ID>` is the service's short ID). A key added or changed later is passed to the running server in a write-only call that carries the app's launch header, so nothing restarts.
- **With plain `npm run dev`,** the connector reads the same environment variables. `scripts/serve.ps1` fills them from Windows Credential Manager entries named `atiya-ai-<id>` when it starts the dev server. The AI screen says which entry to add, and a restart picks it up. A key is never typed into a page here.
- **Everywhere:**
  - no endpoint returns a key, or any part of one;
  - a key is never in `content/`, `private-pages/`, `.atiya/`, a log, an answer or a commit;
  - a test scans every edit-mode response and the content folders for key-shaped strings.

### 6.2 Where your words go

Each service's disclaimer is shown when you add it, and you accept it once. The AI screen keeps it on the service's card, and the prompt always names the service.

| Service | Where it runs | What it does with your words |
|---|---|---|
| Ollama, LM Studio | This computer | Nothing leaves it ([Ollama privacy](https://ollama.com/privacy)) |
| OpenAI API | OpenAI's cloud | Not used for training by default ([business terms](https://openai.com/policies/business-terms/)) |
| Gemini API | Google's cloud | The free tier may be used to improve Google's products; the paid tier isn't ([Gemini API terms](https://ai.google.dev/gemini-api/terms)) |
| Claude API, Azure OpenAI, OpenRouter | Their cloud | Confirmed from each one's terms when its adapter is built, and written here then |
| Jev | TypeSafe AI's cloud | Doesn't train on requests. Zero data retention only on enterprise plans ([Jev](https://jevapi.dev/)) |
| Your agent through MCP | Wherever the agent sends it | The agent's own terms. Edit mode can't see or limit what it does after reading |

**Private pages** may go to any service whose disclaimer you've accepted. Each service, and agents as a whole, has a switch, **Don't send private pages**, off by default ([AI editing §9](ai-editing.md#9-safety-and-privacy)). The disclaimer's last line says so: "Private pages are sent too, unless you turn that off below." Grants, access codes and reader agreements are never sent anywhere.

### 6.3 Cost

Your own key, your own bill. An article-sized request says its size before it's sent, and any request can be stopped. Jev's decisions cost little: $0.042 per million input tokens, and a decision sends only the instruction and the scoped block ([Jev](https://jevapi.dev/)). Edit mode doesn't track spending; each service's own dashboard does.

## 7. Setting up: task flows

### 7.1 First use, with no service

1. You choose Ask AI, or the AI menu, on any article. The prompt says "Set up an AI service to use this," with **Set up AI**.
2. **Set up AI** opens the AI screen with **Add a service** open. If Ollama or LM Studio is running on this computer, it's offered first: "Ollama is running on this computer, with 3 models. Use it?"
3. Once a service is saved and tested, it becomes the writer, and the article you came from is one link away: "Back to {article}."

### 7.2 A cloud service, in Atiya Studio

1. **Add a service.** Choose its kind: OpenAI, Anthropic, Gemini, Azure OpenAI, OpenRouter, or Other OpenAI-compatible.
2. **Its fields.** Azure OpenAI and Other ask for the base URL. Every kind has a name, prefilled with the kind ("OpenAI"), and a short ID made from it.
3. **Enter key** opens the app's key dialog: one hidden field, **Save key** and **Cancel**, and a line saying where it's kept ("Kept encrypted on this computer by Atiya Studio"). Edit mode learns only that a key was saved.
4. **The model.** Edit mode asks the service for its models with the key, and offers them in a Select. A service that doesn't list them gets a text field.
5. **The disclaimer** (§6.2) is shown in full, with **Don't send private pages** below it, off. **I understand** is needed to go on.
6. **Test** sends a tiny request that needs a JSON answer, and shows the result: "Works: answered in 1.2 s," or the error (§7.7).
7. **Save.** The service is added. The first one becomes the writer.

### 7.3 A cloud service, with plain `npm run dev`

Steps 1, 2, 4, 5 and 6 are the same. Step 3 is different, because a key is never typed into a page here:

- The screen says: "Add the key to Windows Credential Manager as `atiya-ai-openai`, then restart the site." It has a **Copy name** button and, beside it, how to do it from PowerShell or Credential Manager.
- After a restart, the card shows "Key found." Until then it shows "Key missing," and the service can be saved but not tested.
- Any other way of setting `ATIYA_AI_OPENAI_KEY` in the dev server's environment works too.

### 7.4 A model on this computer

1. **Found by itself.** While the AI screen is open, edit mode's server asks Ollama (`localhost:11434`) and LM Studio (`localhost:1234`) for their models. A runner that answers is offered at the top: "Ollama is running, with 3 models. **Add Ollama**."
2. **Add** fills the base URL, needs no key, offers the models in a Select, and shows the local disclaimer ("Nothing leaves this computer"). Then Test and Save, as in §7.2.
3. **Not running:** "Ollama isn't running. Start it, then choose **Look again**." A different address can be typed instead.
4. **A model that can't follow a schema** fails Test with "This model didn't return the shape edit mode needs. Try a larger model." Our check would refuse its answers anyway.

### 7.5 Turning on Jev

1. In the AI screen's **Decider** section, choose **Jev** instead of **Rules**.
2. Its key is added as in §7.2 or §7.3, with the ID `jev`.
3. Its disclaimer (§6.2) is accepted. **Don't send private pages** applies to it too; with it on, private pages are decided by rules.
4. **Test** asks Jev one known question, and shows "Works: answered in 180 ms."
5. From then on, the section shows its last result: "Jev decided the last request in 160 ms," or "Jev didn't answer; rules decided."

### 7.6 Connecting your agent

1. In the **Agents** section, turn on **Let agents propose changes**. It's off by default.
2. The section shows the server's address (`http://localhost:4321/_edit/mcp`) and the token, hidden, with **Copy**. The token is made when the switch first turns on.
3. **Set up for** is a Select of the agents edit mode knows: Claude Code, Codex, Copilot CLI, Gemini CLI, opencode, OpenClaw, Hermes Agent and Other. Each shows the exact line or settings to add, with the address and token filled in, and **Copy**. Those lines follow each agent's own MCP docs, written when the screen is built.
4. **Test** waits for the agent's first call: "Waiting for an agent… Ask it to list your articles." Then it shows "Claude Code connected."
5. **Make a new token** replaces it at once. Every agent using the old one must be set up again.
6. **Don't send private pages** for agents hides private pages from every tool (§10).

### 7.7 Testing, changing and removing

- **Test** is on every card. Its results use AI editing's error copy ([§10.4](ai-editing.md#104-errors-and-edge-cases)): key refused, out of credit, busy, unreachable, not running, can't follow the shape.
- **Replace key** opens the key dialog (Studio) or names the Credential Manager entry (plain dev). The old key is gone once the new one is saved.
- **Change model** is the card's Select. It takes effect on the next request.
- **Remove** asks first ("Remove OpenAI? Its key is deleted from this computer."). It deletes the key (Studio) and the settings. In plain dev, it also says the Credential Manager entry stays until you delete it. Removing the writer makes the next service the writer, or none.
- **When a key is suspected leaked,** the card's help popover says: revoke it in the service's own dashboard first, then Replace key.

## 8. The AI screen

A screen of its own, **AI** (`/_edit/ai/`), listed in edit mode's `SCREENS`, so both the side navigation and the action center find it. They find it under its name and the words AI, services, models, keys, Ollama, Jev, agents and MCP. It's made of the kit's panels and fundamentals, like the Contact and Visitor counts cards.

### 8.1 Anatomy

| Section | What it holds |
|---|---|
| Intro | One line: "AI sends your words only when you ask, to the service named in the prompt." |
| Writer | A Select of the services set up, and the model. Under it: "Used for every AI request." Empty, it says "No service yet," with **Add a service** |
| Found on this computer | Shown only when Ollama or LM Studio answers and isn't added yet (§7.4) |
| Services | A card per service, then **Add a service** |
| Decider | Two radio cards: **Rules** ("Built in. Free, and decides from words in your request") and **Jev** ("Better at spotting research and the right block. A cloud service"). With Jev chosen, its key state, Test and the last result |
| Agents | The switch, the address, the token, **Set up for**, Test, **Make a new token**, **Don't send private pages**, and the open proposals (§8.3) |

### 8.2 A service's card

| Part | What it is |
|---|---|
| Head | Its name, its kind's icon, and a tag: **This computer** or **Cloud** |
| State | A status tag: Ready, Untested, Key missing, Key refused, Out of credit, Not running, Unreachable, Can't follow the shape |
| Model | A Select, or a text field |
| Private pages | **Don't send private pages**, a switch |
| Disclaimer | One line from §6.2, and **Read the disclaimer** |
| Actions | **Test**, **Replace key** (cloud only), **Remove** |
| Last test | "Works: answered in 1.2 s, 2 minutes ago," or the error |

### 8.3 Open proposals

Under Agents, a list of proposals not yet applied or discarded, from any source: an agent, or a request you left open. Each row shows the article's title, who proposed it, how many changes and how long ago, and links to its review. Empty, it says "No open proposals." A proposal untouched for 30 days is deleted. The list says so when it removes one: "Removed 1 proposal over 30 days old."

### 8.4 States

| State | What you see |
|---|---|
| Nothing set up | Intro, an empty Writer, Found on this computer (if any), **Add a service** |
| Checking a service | The card's Test button is busy, then the result. Other cards stay usable |
| A key missing (plain dev) | The card shows Key missing and the Credential Manager name, with **Copy name** |
| Jev not answering | The Decider shows "Jev didn't answer; rules decided," with the time |
| Agents on, none connected yet | "Waiting for an agent…" |

### 8.5 Keyboard and screen readers

- The screen is a plain form: Tab order follows the sections, and each card is a labelled group named after its service.
- Test results are announced through edit mode's live region.
- Copy buttons say what was copied ("Copied the token").
- The token is never read aloud. Its field reads "Token, hidden."
- Saving follows edit mode's save status, like every settings card: each change saves on its own, with no Save button for the screen.

## 9. The connector: decide, write, check

The connector is a part of edit mode's server. Every request from the editor goes through its three steps, in this order. An agent's proposal skips the first two and goes straight to Check.

### 9.1 Decide

Decide answers a few questions about the request before anything is written. **Rules** is built in and always available. **Jev** is chosen on the AI screen (§7.5), and answers the same questions better.

| Question | What it changes | Rules' answer |
|---|---|---|
| Does it need outside facts (latest numbers, research, sources)? | Nothing is sent to a writer. The prompt offers **Copy for your agent**, **Ask anyway** or **Cancel**, and later **Open in terminal** ([AI editing §10.1](ai-editing.md#101-it-needs-research-u12)) | Yes when it names a word on a short list: research, latest, current, this year, statistics, numbers, sources, cite, look up |
| What kind of change is it: rewrite, shorten, lengthen, retype, restructure, fix? | Which instruction the writer gets | From the button pressed; typed requests are "rewrite" |
| Does it fit the scope chosen (a block, a section, the article)? | A request bigger than its scope asks first: "This asks for more than one block. Use the whole article?" | Always yes |
| Does it ask for something AI can never change (the address, access, status, a picture's file)? | The prompt says what can't change, and stops | Yes when it names one of those fields |
| Which block types fit the content best? | The writer is offered the allowed types in that order | The allowed types, in their usual order |
| For each comment: can AI address it, or does it need you? | Comments that need you aren't ticked for **Address comments** | Every comment ticked |

- **Code decides what's allowed, Jev only ranks.** The block types offered come from the content contract, filtered for the scope. Jev orders them, and can never add one.
- **What Jev is sent:** the instruction, the scope's kind, the allowed block types and the scope's text. Never the whole article for a one-block request, and never grants, codes or agreements.
- **When Jev acts:** an answer counts only at a confidence of 0.8 or more. Below that, rules answer that question. The threshold is tuned in phase 2 on about 100 requests labelled by hand, and written here then.
- **When Jev fails:** after 1 second without an answer, or on an error, rules decide, and the AI screen shows it (§8.4). A request never waits longer on Jev.
- **The model is pinned:** `jev-1.14.0`, never an alias, since aliases move to new versions. Changing the version is a change to this spec, after re-running the labelled set.

Facts about Jev used here, from its site ([Jev](https://jevapi.dev/)):
- it answers in 70 to 500 ms, at $0.042 per million input tokens, with a 64k-token context;
- it works best in English;
- it's been in early access since 15 September 2026.

### 9.2 Write

The writer is the service chosen on the AI screen. One adapter per kind of API turns the edit request ([AI editing §2](ai-editing.md#2-the-edit-request-one-contract-under-every-feature)) into that API's call, and its answer back into the edit answer.

| Adapter | Services | Notes |
|---|---|---|
| OpenAI-compatible | OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter, Mistral, Groq, Other | Structured output with a strict JSON schema. OpenRouter is asked to use only providers that honour the schema |
| Anthropic | Claude API | Structured output through its tool-use or schema mode, whichever is current when built |
| Gemini | Gemini API | Its own response schema |

- **One schema, the strictest rules:** every field is required (OpenAI's rule), and nothing is recursive (Anthropic's). Optional fields are required and allowed to be empty.
- **Streaming:** for a one-block rewrite, the block's text is read out of the partial answer as it arrives, so the preview fills in ([AI editing §11](ai-editing.md#11-accessibility-feedback-and-performance)). Other requests show progress until the whole answer is in.
- **Stop** aborts the request at once. What's kept follows AI editing: a block's text so far, as a try ([§4.2](ai-editing.md#42-task-flow)); a draft's finished sections ([§5.1](ai-editing.md#51-task-flow)); nothing of a whole rewrite ([§6.2](ai-editing.md#62-task-flow)).
- **Time limits:** an answer must start within 30 seconds (120 for a model on this computer, which may be loading), and never stall for more than 30. Otherwise the request ends, keeping what arrived as a try.

The prompt's words for each failure are AI editing's ([§10.4](ai-editing.md#104-errors-and-edge-cases)). The AI screen shows the same failures as the card's state:

| What the service says | The card's state |
|---|---|
| 401 or 403 | Key refused |
| 402, or a quota error | Out of credit |
| 429 | Unchanged. Retried once by itself when the service asks for a wait of 10 seconds or less |
| 5xx, or no network | Unreachable |
| Connection refused, on this computer | Not running |
| An answer that isn't the shape, or is cut off at the model's limit | Unchanged: the check refuses it and the request is sent once more with the reasons. A Test that fails this way shows Can't follow the shape |

### 9.3 Check

Every answer, from a writer or an agent, goes through the same check before it reaches review: the shape, the scope, the block types, the fields AI may never change, and the content contract. It's specified once, in [AI editing §2.4](ai-editing.md#24-decide-write-check). A check that fails twice ends the request with its reasons, and nothing is shown for review.

## 10. Edit mode as an MCP server

Your agent connects to edit mode as an MCP server. It reads articles and proposes changes. It never writes: every proposal goes to the same review as the editor's own requests.

### 10.1 The server

- **Transport:** Streamable HTTP at `/_edit/mcp`, on the dev server only, like the rest of edit mode. It's never in a build (`verify:prod` already fails on `/_edit`).
- **Off by default.** It answers only while **Let agents propose changes** is on.
- **The guard:**
  - loopback only, and a `Host` of `localhost` or `127.0.0.1` with the dev server's port;
  - any request carrying an `Origin` header is refused, since agents don't send one and a web page always does;
  - a bearer token, kept in `.atiya/mcp.json` and checked in constant time;
  - in Atiya Studio, this one path skips the app's launch token (an agent doesn't have it) and is held by the token above instead.
- **Who's asking:** the agent's name comes from the client information it sends when it connects ("Claude Code"). It's shown on its proposals and comments, marked as the agent's own claim.

### 10.2 Tools

| Tool | What it does |
|---|---|
| `list_articles` | Every article's ID, title, section, status and last change. Private ones are left out when agents can't have them |
| `get_article` | One article's blocks, with their stable names ([AI editing §3](ai-editing.md#3-blocks-need-a-stable-name)), or one section of it |
| `describe_blocks` | The block types, their fields and what each is for, from the content contract |
| `list_media` | The pictures and videos an article may use: ID, alt text, size |
| `list_comments` | An article's open comments |
| `add_comment` | Adds a comment, from the agent |
| `propose_changes` | Sends an edit answer. Returns the proposal's ID and its review link, or the check's reasons. Never applies anything |
| `get_proposal_status` | Open, Applied, Partly applied or Discarded |

- **No direct writes,** and an agent can't make an article. It can propose changes to an empty one (AI editing §5).
- **Private pages:** with agents' **Don't send private pages** on, every tool acts as if they didn't exist.
- **Limits:** one proposal per article at a time from the same agent (a new one replaces it, and says so), and answers sized like the editor's own.
- **Built with** the MCP TypeScript SDK, pinned to an exact version and installed through the package feed. It's the one new dependency, in phase 6.

## 11. What's stored

| What | Where | Committed | Kept until |
|---|---|---|---|
| Services, the writer, the decider, agents' settings, each service's last test | `.atiya/ai.json` in the site's folder | Never | Removed |
| Keys, in Atiya Studio | The app's own data, encrypted with `safeStorage` | Never | The service is removed |
| Keys, with plain `npm run dev` | Windows Credential Manager (`atiya-ai-<id>`), or the dev server's environment | Never | You delete them |
| The MCP token | `.atiya/mcp.json` | Never | A new token is made |
| Proposals | `.atiya/proposals/` ([AI editing §12](ai-editing.md#12-whats-stored)) | Never | Applied or discarded, or 30 days untouched |
| Logs | The dev server's output: the service, size, time and outcome of each request | Never | The server stops |

- **`.atiya/ai.json` holds,** for each service: its ID, kind, name, base URL, model, whether it may get private pages, when its disclaimer was accepted, and its last test's result. Then the writer's ID, the decider (rules or Jev) with Jev's pinned model, and agents' switches. Never a key, or any part of one.
- **Per computer.** A second computer, or a fresh clone, sets AI up again. Settings that aren't committed can't leak through the public repository.
- **Ignored by git:** a managed site's `.gitignore` already has `.atiya/`. The owner's repository adds it in phase 1.

## 12. How it's built

Where each piece goes. The names of files and functions are the implementer's.

- **The connector** is in edit mode's server (`src/site/editor/server/`). It calls services from Node, never from the page, so keys stay on the server and no service needs to allow the browser. Phase 1 needs no new dependency: plain `fetch`, and Zod for the answer's schema.
- **Pure logic in `src/site/editor/model/`, unit-tested:** Decide's rules and how Jev's answers are combined with them; each adapter's request and answer mapping; the error mapping; the settings file's shape; the setup lines for each agent.
- **Settings** are read and written by one module, a temp file then a rename, like the store. They aren't content, so they don't go through the content check.
- **The AI screen:** its route in `integrations/editor.mjs` (a running dev server needs a restart to serve it), its entry in `SCREENS` with the words it's found by, and parts made of the kit and fundamentals, each with a story and samples.
- **Detecting local runners** happens on the server, only while the AI screen is open, with a short time limit. The addresses it tries are settings the test server overrides, so a test never reaches a real Ollama.
- **Atiya Studio:**
  - the key dialog is the app's own, drawn over edit mode like its other dialogs;
  - one bridge request opens it and answers only whether a key was saved;
  - keys are kept with `safeStorage` and handed to the managed server's environment at start;
  - a key added or changed later reaches the running server through one write-only call carrying the app's launch header.
- **Plain dev:** `scripts/serve.ps1` reads the `atiya-ai-*` entries from Windows Credential Manager and sets them in the dev server's environment, without printing them.
- **The MCP server** (phase 6) is a route under `/_edit/mcp` in the same integration, with its own guard (§10.1). Studio's launch-token check leaves that one path to it.
- **Icons:** one for each kind of service and for agents, imported one at a time with the site's icon script, each checked by eye.

## 13. Tests

| Kind | What it covers |
|---|---|
| Unit | Each adapter against recorded stand-in answers, streaming included. The error mapping. Decide's rules; Jev's threshold, its time limit and the fall back to rules. The settings file: written atomically, never with a key. The MCP guard against a hostile `Origin`, a wrong `Host`, a missing or wrong token, and agents turned off. Tools leaving private pages out when they're not allowed |
| Editor E2E (`--project=editor`, the fixture server) | Against a stand-in AI service with scripted answers, and a stand-in local runner. Adding a cloud service and a local one; Test with each failure; the private-pages switch; switching the decider to a stand-in Jev and back, and Jev timing out; turning agents on, copying and making a new token; a scripted MCP client listing, reading and proposing |
| Studio E2E | The key dialog. The key is never in edit mode's page, its requests, its answers or the site's folder. A key changed while the site runs works without a restart |
| Keys | A scan of every edit-mode answer in the E2E runs, and of `content/`, `private-pages/` and `.atiya/`, for key-shaped strings |
| Accessibility and visual | axe on the AI screen in both themes, a keyboard-only setup, and the new parts' stories at the three widths |

Tests never call a real service. Each phase's real tries are listed in [AI editing §15](ai-editing.md#15-phases-and-definition-of-done).

## 14. Decisions

| Decision | Chosen | Why, and what was rejected |
|---|---|---|
| How to reach services | Our own thin connector, with adapters (§4, A) | No dependencies, full control. A unified SDK is the fallback; its object helpers are being removed |
| Gemini | Its own adapter | Its OpenAI-compatible mode wasn't confirmed to honour schemas |
| Your subscriptions | Through your agent, by MCP (§10) | Their terms don't allow their sign-in in other apps (§2.2) |
| Where keys live | Studio's encrypted store, or Credential Manager and the environment (§6.1) | A key typed into edit mode's page could be read by anything in that page |
| Private pages | Sent to a service whose disclaimer you've accepted; each service and agents can refuse them, off by default (§6.2) | Private here means "not for browsing," not secret |
| The decider | Rules by default; Jev when you choose it, pinned, acting at 0.8 or more, rules after 1 second (§9.1) | Rules alone miss typed requests that need research. Jev alone would make a cloud call required |
| Block types | Code says which are allowed; Jev only ranks them (§9.1) | A model must never add a type the site doesn't have |
| Agents | Proposals only, off by default, a token, no `Origin` (§10) | An agent that writes directly skips review. A web page must never reach the server |
| The terminal | For you to type in, never for AI to drive (§4, E) | OWASP's "excessive agency" |
| Settings | Per computer, in `.atiya/` (§11) | Never committed, so nothing leaks. The owner may revisit this: committing them to the private repository would carry them to a second computer |
| Spending | Not tracked (§6.3) | Each service's dashboard does it, exactly |

## 15. Later, and what it won't do

**Later:**
- Amazon Bedrock and Google's Vertex AI, which sign requests their own way.
- Showing what each request cost, from the size each service reports.
- Settings shared between your computers, through the private repository.

**Won't do:**
- AI on the published site, for readers.
- Any change made without your review.
- An agent loop of our own, with tools, web search or files. That's your agent's job, through MCP.
- Sign in with a chat subscription (ChatGPT, Claude, Gemini) inside edit mode.

## 16. As built

Each phase records here what differs from this page, with its evidence. Stage by stage evidence is in the [plan's status](ai-plan.md#5-status).

### The connector (phase 1, stage S3)

- **Where it lives.** `src/site/editor/server/aiConnector.ts` runs Decide (rules), Write and Check for each request. The adapter for every OpenAI-compatible service, local or cloud, is `server/aiOpenAI.ts`; finding Ollama and LM Studio on this computer is `server/aiLocal.ts`; the settings are `server/aiSettings.ts`.
- **Routes.** `GET /_edit/api/ai/status` names the writer (never a key); `POST /_edit/api/ai/propose` answers as server-sent events: `status` (the step), `words` (a block's words so far), `proposal`, `note` and `error`. Closing the request stops the writer. Both are behind edit mode's guard, like every `/_edit/api/` route.
- **Settings and keys.** The settings are `.atiya/ai.json` in the site's folder, written atomically and never holding a key (on Windows a rename refused while another process reads the file is retried a few times). A key comes from the environment, `ATIYA_AI_<ID>_KEY`, else, in plain dev on Windows, from the Credential Manager entry `atiya-ai-<id>`, which the server reads itself on the first request that needs it (`keyFor`); `scripts/serve.ps1` fills nothing. `ATIYA_AI_CREDENTIALS=off` turns the Credential Manager read off (the tests do). Not built yet: Atiya Studio's key dialog (S6).
- **Local runners' addresses** can be moved with `ATIYA_AI_OLLAMA_URL` and `ATIYA_AI_LMSTUDIO_URL` (by default `http://localhost:11434` and `http://localhost:1234`).
- **The tests' stand-in.** `scripts/lib/ai-stand-in.mjs` is an OpenAI-compatible service that answers every request by cutting the block to its first sentence, streamed ("slowly" in the request streams it at 400 ms a piece). The editor's fixture server (`scripts/editor-test-server.mjs`) starts it on port 4338, points `ATIYA_AI_OLLAMA_URL` at it and writes a settings file that makes it the writer, so the editor E2E never reaches a real model.
- **Tried for real** on Ollama on this computer (qwen3.8:27b): shorten, rewrite and a table retype, each in 5 to 9.5 s.

### The AI screen (phase 1, stage S4)

- **Where it lives.** `/_edit/ai/` (`pages/ai.astro`), made of the parts AiWriter (the writer and Found on this computer), AiServiceList, AiServiceCard and AiAddService; the words and the choices are pure in `model/aiServices.ts`, the routes in `server/aiServices.ts`, the script in `scripts/aiServices.ts`. It's in the side navigation and the action center as AI.
- **Routes.** `PUT /_edit/api/ai/writer` chooses the writer; `POST /_edit/api/ai/services` adds one (a runner found on this computer, or a cloud service, which needs its disclaimer accepted); `PUT` and `DELETE /_edit/api/ai/services/<id>` change its model or private pages, or remove it; `POST …/<id>/test` runs a test and keeps its result. A refusal is a 422 that says why. A new model clears the last test.
- **What differs from §8.** Only the OpenAI-compatible kinds can be added so far (Ollama, LM Studio, OpenAI, Azure OpenAI, OpenRouter, Other). A cloud service's model is typed, not chosen from a list. The Azure OpenAI and OpenRouter disclaimers are neutral words with no link. Remove asks with the browser's own confirm. Keys: see Settings and keys above (the server reads Credential Manager; `serve.ps1` doesn't, as §6.1 says).
- **Tests.** The stand-in also scripts failures by model name (a refused key, no credit, busy, no answer in the shape), so the editor E2E "editor: AI screen" shows each one's state and words.
