# Edit mode: AI services (proposal)

Which AI services edit mode's AI editing could use, how each can really be connected, and five ways to build the connection, with pros and cons and a recommendation. It's the provider half of [AI editing and comments](ai-editing.md), for the owner to review; nothing here is built yet. Each finding names its source, read on 20 October 2026; what couldn't be checked says so.

> **TL;DR.**
> - **Most of the wishlist can be supported, but not all of it the way it sounds.** Every API (OpenAI, Claude, Gemini, Azure) and every local runner (Ollama, LM Studio) can return answers held to a JSON schema, which is what safe editing needs.
> - **Subscriptions are the catch.** Anthropic forbids third-party apps from using a Claude Pro or Max sign-in; Google has banned accounts for connecting tools to a Gemini sign-in; OpenAI's position on a ChatGPT sign-in in Codex is unstated. GitHub is the exception: its Copilot SDK is documented for apps that use a person's Copilot subscription.
> - **So there are two directions.** Edit mode *calls* a service with a key (or a local model with none), or your own agent, signed in its own way, *calls edit mode* through an MCP server. The second is how Claude Code, Codex, Copilot CLI, OpenClaw and Hermes Agent fit, within their terms.
> - **Recommended:** a thin harness of our own (three adapters, no new dependency) for the APIs and local models first; then edit mode as an MCP server, with a terminal in Atiya Studio to run your agent beside the article; then the Copilot SDK.
> - **Two items need you:** "Jev API" is a real but tiny pre-release product that decides rather than writes (did you mean Google's Jules?), and "Hermes" is both a model and an agent.

<figure class="slate-figure" data-diagram="ai-services">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" role="img" aria-labelledby="ed-ai-services__title ed-ai-services__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-ai-services__title">AI services: a harness for APIs, an MCP server for agents</title>
<desc id="ed-ai-services__desc">The article editor sends edit requests to an AI harness in the dev server, where the keys stay. The harness has one adapter per kind of API: cloud APIs (OpenAI, Claude, Gemini, Azure), models on this computer (Ollama, LM Studio), and later agent SDKs such as GitHub's Copilot SDK. It checks every answer. The other way in runs the opposite direction: edit mode is an MCP server, and the owner's own agent (Claude Code, Codex, Copilot CLI, OpenClaw, Hermes Agent), signed in its own way and run in Atiya Studio's terminal, calls its tools; what it proposes comes back to the editor for review like any other answer.</desc>
<g id="ed-ai-services__editor" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-1" x="40" y="40" width="220" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Article editor</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">edit mode</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Edit requests</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-1" data-slate-fit-padding="16">Review and apply</text>
</g>
<g id="ed-ai-services__harness" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-ai-services__body-2" x="340" y="40" width="240" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="360" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">AI harness</text>
<text x="360" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">dev server, keys stay here</text>
<text x="360" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">One adapter per API</text>
<text x="360" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-ai-services__body-2" data-slate-fit-padding="16">Checks every answer</text>
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
<figcaption>Two ways in: edit mode calls an API or a local model through its harness, or your own agent calls edit mode's MCP server. Both end in the same review.</figcaption>
</figure>

## 1. What a service must do here

AI editing ([AI editing §2](ai-editing.md#2-the-edit-request-one-contract-under-every-feature)) sends one edit request and needs back a JSON answer it can check. So a service is judged on:

- **Structured output:** can it be held to a JSON schema (enforced while it writes), or only asked nicely?
- **Streaming and stopping:** can a long answer be shown as it comes and stopped?
- **Sign-in:** an API key, nothing (local), or a personal subscription, and do its terms allow an app like this to use it?
- **Where it runs:** on this computer, or someone's cloud (which matters for private pages).

## 2. The wishlist, one by one

| Service | How it's reached | Sign-in | Held to a schema | Verdict |
|---|---|---|---|---|
| **Ollama** | Its own API, or its OpenAI-compatible `/v1` | None (local) | Yes: `format` takes a JSON Schema since v0.5.0; the `/v1` endpoint honours `json_schema` too | **Supported directly.** Local, free, MIT. Not for its hosted cloud models, which don't do structured output |
| **Claude API** | The Messages API | API key | Yes: native structured outputs (`output_config.format`) | **Supported directly** |
| **OpenAI API** | The Responses or Chat Completions API | API key, billed apart from ChatGPT | Yes, `strict` | **Supported directly** |
| **Gemini API** | `generateContent` or the Interactions API | API key | Shape only: valid JSON, no strict guarantee | **Supported directly**, with our own check doing the rest |
| **Models on Azure** | Azure OpenAI's v1 API (OpenAI-compatible); Foundry's other models through the same surface | API key or Entra ID | Yes for Azure OpenAI; per model for Foundry's others | **Supported directly** for Azure OpenAI; check each Foundry model |
| **Claude Code** | `claude -p --json-schema`, or the Claude Agent SDK | **API key only** | Yes, with retries | **Supported, with an API key.** A Pro or Max sign-in can't be used by another app. Runs unsandboxed on native Windows |
| **Codex CLI** | `codex exec --output-schema`, or the Codex SDK | API key (a ChatGPT sign-in is a grey area) | Yes | **Supported, with an API key.** It can also run on Ollama or LM Studio, offline |
| **Copilot CLI** | `copilot -p`, ACP, or GitHub's Copilot SDK | Your Copilot subscription, or your own key | No: our check must do it | **Supported directly through the Copilot SDK**, which GitHub documents for apps like this |
| **Terminal** | Either a command that reads the request and prints the answer, or a real terminal in Atiya Studio | Whatever the command uses | Our check | **Supported.** A command provider for anything scriptable; a terminal for running your own agent beside the article (§4, option E) |
| **Jev API** | A REST call, `/v1/systemone` | API key | Typed decisions, not text | **Needs you.** Jev (TypeSafe AI, early access since 15 September 2026) answers typed questions about a context; it doesn't write. If you meant Google's Jules, that's a coding agent for GitHub repositories |
| **OpenClaw** | Its gateway's HTTP API, or MCP in both directions | Its own | Through its tools | **Supported as an agent over MCP** (option D). Its shell runs unsandboxed by default |
| **Hermes** | The model: OpenRouter or Ollama. Hermes Agent: an agent, like OpenClaw | Key, or none | The model: yes (OpenRouter) | **Supported both ways;** which did you mean? |

Sources, by row: Ollama's [structured outputs](https://ollama.com/blog/structured-outputs), [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) and [cloud](https://docs.ollama.com/cloud); Anthropic's [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs); OpenAI's [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [billing](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform); Google's [structured output](https://ai.google.dev/gemini-api/docs/structured-output); Microsoft's [API lifecycle](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle), [structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) and [Foundry's migration](https://learn.microsoft.com/en-us/azure/foundry/how-to/model-inference-to-openai-migration); Claude Code's [headless mode](https://code.claude.com/docs/en/headless), [legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) and [sandboxing](https://code.claude.com/docs/en/sandboxing); Codex's [non-interactive mode](https://developers.openai.com/codex/noninteractive) and [authentication](https://developers.openai.com/codex/auth); GitHub's [Copilot CLI programmatically](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically), [Copilot SDK](https://github.com/github/copilot-sdk) and [multi-tenancy](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy); [Jev](https://jevapi.dev/); OpenClaw's [gateway](https://docs.openclaw.ai/gateway), [MCP](https://docs.openclaw.ai/tools/mcp) and [why OpenClaw](https://docs.openclaw.ai/start/why-openclaw); [Hermes 4](https://huggingface.co/NousResearch/Hermes-4-405B) on [OpenRouter](https://openrouter.ai/nousresearch/hermes-4-405b/llms.txt).

### 2.1 What else

| Service | Verdict |
|---|---|
| **LM Studio** | **Supported directly:** a local OpenAI-compatible server with strict JSON schemas. Free to use through its published interfaces; the app may not be bundled ([structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output), [terms](https://lmstudio.ai/app-terms)) |
| **OpenRouter** | **Supported** through the OpenAI-compatible adapter; one key for many models, including open ones. Structured output depends on the serving endpoint, so requests set `require_parameters` ([structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)) |
| **Mistral, Groq** | **Supported** through the same adapter; Groq's `strict` only on some models |
| **opencode** | **Supported as an agent:** its server and SDK take a JSON schema, it speaks ACP, and it reaches 75+ providers. Its docs say it removed Claude subscription relaying because Anthropic prohibits it ([SDK](https://opencode.ai/docs/sdk/), [providers](https://opencode.ai/docs/providers/)) |
| **Cursor CLI** | Possible through its SDK; no schema flag |
| **AWS Bedrock** | Possible, but its own API and IAM sign-in: not worth it for a personal site |
| **GitHub Models** | **Gone:** retired on 30 July 2026 ([GitHub](https://docs.github.com/en/github-models)) |

### 2.2 Subscriptions, plainly

Using a subscription you already pay for is the appealing part of the wishlist, and the part with real limits:

- **Claude Pro and Max:** "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users" ([legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). Press reports say it's enforced (not checked independently).
- **Gemini sign-in:** Gemini CLI's terms forbid using third-party software to reach its services with that sign-in, and accounts were banned in February 2026 for it (press-reported). Gemini CLI is also being replaced by Antigravity CLI for individual subscribers ([Google](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/), [terms](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md)).
- **ChatGPT sign-in in Codex:** no document allows or forbids an app driving it; OpenAI's docs point automation at API keys.
- **GitHub Copilot:** the Copilot SDK is documented for exactly this, including products that embed it for many users.

The way to use any of them within its terms is to run **the vendor's own tool, yourself**, and let it reach edit mode (option D): Claude Code signed in with your Max plan, in a terminal, editing through edit mode's MCP tools, is Claude Code being Claude Code.

## 3. Where the AI is called from

Edit mode's server already runs only on your computer and only for edit mode's own pages (the dev server's editor middleware, loopback and same origin). The harness lives there too:

- **Keys never reach the browser:** the editor's page asks its own server, which calls the service.
- **The same code serves Atiya Studio and plain `npm run dev`;** only where the key comes from differs (§6).
- **Nothing of it is built into the site:** like the rest of edit mode, it's dev-only and `verify:prod` keeps it out.

## 4. Five ways to build it

### A. Our own thin harness (recommended first)

Three adapters behind one interface (`propose(request, signal) → stream of text, then an answer`): an **OpenAI-compatible** one (OpenAI, Azure OpenAI, Ollama, LM Studio, OpenRouter, Mistral, Groq: a base URL and a key), **Anthropic Messages**, and **Gemini**'s own API (its OpenAI-compatible mode wasn't confirmed to honour schemas). Each sends the schema in its own way; our Zod check is the final word for all.

- **Pros:** No new dependency (plain `fetch`, the Zod we have), so nothing to pin through the package feed and no churn. Full control of streaming, stopping and retrying. Covers every API and local model on the wishlist. Easy to test against a stand-in server.
- **Cons:** We keep three adapters current; each API's schema rules differ a little (OpenAI wants every field required, Anthropic doesn't allow recursive schemas), so the request schema is written to the strictest of them.

### B. A unified SDK (Vercel's AI SDK)

One library with official packages for OpenAI, Anthropic, Google, Azure, Bedrock, Mistral, Groq and more, `streamText` with `Output.object(schema)`, and its own MCP client ([structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [MCP](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)).

- **Pros:** More providers for less code; maintained by others.
- **Cons:** Several new dependencies to pin; its object helpers (`generateObject`, `streamObject`) are already deprecated, to be removed in v7, so it moves fast; partial answers aren't checked until the end anyway, so our check stays. It doesn't reach the agent tools at all.

### C. Agent tools as providers

Edit mode starts an agent and reads its answer: Claude Code (`claude -p --json-schema`), Codex (`codex exec --output-schema`), GitHub's Copilot SDK, opencode's server, or any of them over ACP (the Agent Client Protocol, which Copilot CLI, Gemini CLI and opencode speak natively and Claude Code and Codex through adapters) ([ACP agents](https://agentclientprotocol.com/get-started/agents.md)).

- **Pros:** Uses the tools you already have; the Copilot SDK can use your Copilot subscription within its terms.
- **Cons:** Subscriptions other than Copilot's can't be used this way (§2.2), so most need an API key, which option A already uses more simply. Agents are built to run commands and edit files: they must be told not to (tool lists, read-only modes), and Claude Code has no sandbox on native Windows. On Windows, starting `.cmd` shims and stopping process trees need care ([Node's 2024 advisory](https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2)).

### D. Edit mode as an MCP server

Turn it around: edit mode offers tools (`list_articles`, `get_article`, `propose_changes`, `add_comment`, `list_comments`), and any agent that speaks MCP uses them: Claude Code, Codex, Copilot CLI, Gemini CLI, Cursor, opencode, OpenClaw, Hermes Agent. A proposal goes to the same review in the editor, so the agent can't change an article you haven't accepted ([MCP in Claude Code](https://code.claude.com/docs/en/mcp), [OpenClaw](https://docs.openclaw.ai/tools/mcp)).

- **Pros:** Every agent you use, signed in its own way, within its own terms: your subscriptions work. No keys in edit mode. The agent can do longer work (draft from your notes folder, then propose), and the review stays ours.
- **Cons:** You run the agent; edit mode doesn't control its loop, speed or cost. ChatGPT reaches only public HTTPS MCP servers, so it's out ([ChatGPT developer mode](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)). The server must answer only local agents, with a token, like the editor's API.

### E. A terminal

Two different things under one name:

- **A command provider:** a command you name, given the request on standard input and printing the answer on standard output. Anything scriptable plugs in: your own script, `llm`, a CLI with a schema flag. Same check, same review.
- **A terminal in Atiya Studio:** a real shell in a panel beside the article (xterm.js on node-pty, the pair VS Code uses), where you start Claude Code or Codex and point it at edit mode's MCP server (option D). It's for you to type in, never for the AI to drive: an open shell for a model is OWASP's "excessive agency" ([node-pty](https://github.com/microsoft/node-pty), [OWASP LLM Top 10 2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/)). node-pty is native: it must be rebuilt for Electron and signed with the app.

### Side by side

| | A. Own harness | B. Unified SDK | C. Agents as providers | D. MCP server | E. Terminal |
|---|---|---|---|---|---|
| Wishlist covered | APIs, Azure, Ollama, Hermes model | The same, more APIs | Claude Code, Codex, Copilot (SDK) | Every agent | Anything scriptable; your agents |
| Uses your subscriptions | No | No | Copilot only | **Yes** | Yes, with D |
| New dependencies | None | Several | Per agent | The MCP SDK | xterm.js, node-pty (native) |
| Control of the experience | Full | Full | Partial | The agent's | The agent's |
| Risk | Low | Low | Agents run commands | Low: proposals only | A shell, for you only |
| Effort | Small | Small | Medium, per agent | Medium | Medium (native module) |

## 5. Recommendation and phases

1. **A, our own harness,** with the OpenAI-compatible adapter first: one adapter reaches OpenAI, Azure OpenAI, Ollama, LM Studio and OpenRouter. Then Anthropic and Gemini. Settings: a provider, a model and a key per service, and which is used for public and for private articles.
2. **D, edit mode as an MCP server,** so Claude Code, Codex, Copilot CLI, OpenClaw and Hermes Agent work with your own sign-ins.
3. **E, a terminal in Atiya Studio,** to run those agents beside the article; and the command provider for anything else.
4. **C, GitHub's Copilot SDK,** if you want Copilot inside the editor's own prompt rather than in a terminal.

B is the fallback if the adapters turn out to cost more than expected; it can replace A behind the same interface.

## 6. Keys, privacy and cost

- **Keys in Atiya Studio** are kept with Electron's `safeStorage` (encrypted by the operating system) in the app's data, never in the site's folder, and handed to its dev server per request, the way the app already hands it the GitHub token.
- **Keys with plain `npm run dev`** come from the environment (`ATIYA_AI_<SERVICE>_KEY`) or Windows Credential Manager; never a file in the repository, `content/`, a log or the browser. A test fails on any key-shaped string in `content/`.
- **Private pages** go only to providers on this computer unless you allow a cloud one for that article ([AI editing §9](ai-editing.md#9-safety-and-privacy)).
- **Training on your words:** OpenAI's API doesn't train on it by default ([business terms](https://openai.com/policies/business-terms/)); Gemini's free tier may, its paid tier doesn't; Ollama "doesn't see your prompts or data" locally ([Ollama privacy](https://ollama.com/privacy)). Settings says which applies to each service.
- **Cost:** your own key, your own bill. A whole-article request says its size first, and every request can be stopped.
- **Tests never call a real service:** a stand-in server answers the adapters, as the contact form's tests do.

## 7. Decisions for you

1. **Order:** A first, then D and E, then C?
2. **A or B:** our own three adapters, or Vercel's SDK?
3. **Your services:** which do you use today (keys you have, subscriptions you pay for)? The first adapter and the first test follow that.
4. **Jev API:** Jev by TypeSafe AI, or Google's Jules, or something else?
5. **Hermes:** the model, or Hermes Agent?
6. **The terminal in Atiya Studio:** worth a native module?
