/**
 * AI's words in edit mode (documentation/editor/ai-editing.md §4.4, §10): the prompt's status and service
 * lines, and what each note and failure says. Pure: the prompt's script and its story read them from here.
 */

export type AiStep = 'deciding' | 'writing' | 'checking';
export type AiFailureCode = 'key-refused' | 'no-credit' | 'busy' | 'unreachable' | 'not-running' | 'stalled' | 'stopped' | 'rejected' | 'no-service' | 'private' | 'refused';
export type AiNeeds = 'research' | 'outside' | 'unclear';
export type AiOutside = 'address' | 'access' | 'status' | 'picture';
/** What a note offers. */
export type AiChoice = 'retry' | 'setup' | 'copy' | 'anyway' | 'settings' | 'cancel';

export interface AiNote {
  /** The first sentence: what happened. Announced. */
  title: string;
  /** What to do, if more than the choices say. */
  detail?: string;
  choices: AiChoice[];
  /** The label of the choice that opens the AI screen, when it isn't "Set up AI". */
  setup?: string;
}

/** Each choice's label; the prompt draws them in this order. */
export const CHOICES: Record<Exclude<AiChoice, 'settings'>, string> = {
  copy: 'Copy for your agent',
  anyway: 'Ask anyway',
  retry: 'Try again',
  setup: 'Set up AI',
  cancel: 'Cancel',
};

export const PLACEHOLDER = 'Tell AI what to change';
export const WORKING = 'AI is working on this article.';
export const STOPPED = 'The request stopped.';
export const COPIED = 'Copied. Paste it into your agent.';
/** The proposal's head after Ask anyway (§10.1). */
export const UNRESEARCHED = 'Written without research: check every number';

/** The status line: the step, with the time once it's past 3 seconds. */
export function statusLine(step: AiStep, service = 'AI', seconds = 0): string {
  const words = step === 'deciding' ? 'Deciding…' : step === 'checking' ? 'Checking…' : `Writing with ${service}…`;
  return step === 'writing' && seconds >= 3 ? `${words} ${Math.floor(seconds)} s` : words;
}

/** The service line under the field: where the article goes. */
export function serviceLine(writer: { name: string; model: string } | null, isPrivate = false): string {
  if (!writer) return 'Set up an AI service to use this.';
  return isPrivate ? `Private page: sends it to ${writer.name}` : `Sends this article to ${writer.name}, ${writer.model}`;
}

const OUTSIDE: Record<AiOutside, string> = {
  address: "AI can't change a page's address. Change it in Page settings.",
  access: "AI can't change a page's access. Change it in Page settings.",
  status: "AI can't change a page's status. Change it in Page settings.",
  picture: "AI can't change a picture's file. Replace it in the block's settings.",
};

/** A note in place of the result bar, when AI stopped before writing or asked something back (§10.1–10.3). */
export function needsNote(needs: AiNeeds, outside?: AiOutside, reason?: string): AiNote {
  if (needs === 'research')
    return { title: 'This needs research from the web.', detail: "AI here can only use what's in the article. Your own agent can search, then propose the changes for you to review.", choices: ['copy', 'anyway', 'cancel'] };
  if (needs === 'outside') return { title: OUTSIDE[outside ?? 'address'], choices: ['settings'] };
  return { title: reason?.trim() || 'What should change? Say a little more.', choices: [] };
}

/** What a failure says and offers (§10.4): what happened, then what to do; never a code. */
export function failureNote(code: AiFailureCode, service = 'The service', reason?: string): AiNote {
  switch (code) {
    case 'no-service':
      return { title: 'Set up an AI service to use this.', choices: ['setup'] };
    case 'private':
      return { title: 'This page is private, and no service is set to get private pages.', choices: ['setup'], setup: 'Change on the AI screen' };
    case 'key-refused':
      return { title: `${service} refused the key.`, detail: 'Check it on the AI screen.', choices: ['setup'], setup: 'Open AI screen' };
    case 'no-credit':
      return { title: `${service} says the account is out of credit.`, choices: ['setup'], setup: 'Open AI screen' };
    case 'busy':
      return { title: `${service} is busy.`, detail: 'Try again in a minute.', choices: ['retry'] };
    case 'not-running':
      return { title: `${service} isn't running on this computer.`, detail: 'Start it, then try again.', choices: ['retry'] };
    case 'stalled':
      return { title: `${service} stopped answering.`, choices: ['retry'] };
    case 'stopped':
      return { title: STOPPED, choices: ['retry'] };
    case 'refused':
      return { title: reason ? `The answer didn't fit the site: ${reason}.` : "The answer didn't fit the site.", detail: 'Nothing changed.', choices: ['retry'] };
    case 'rejected':
      return { title: `${service} turned the request down.`, detail: 'Try other words, or another service.', choices: ['retry', 'setup'], setup: 'Open AI screen' };
    default:
      return { title: `Couldn't reach ${service}.`, detail: 'Check your connection.', choices: ['retry'] };
  }
}

type AgentArticle = { title: string; body: { type: string; key?: string; text?: string }[] };

/**
 * What Copy for your agent copies (§10.1): a prompt naming edit mode's MCP server, the article, the section the
 * block is in (its heading and key) and your words, asking the agent to research with its own tools, cite its
 * sources in a comment and send the changes with `propose_changes`.
 */
export function agentPrompt(p: { mcp: string; id: string; article: AgentArticle; key: string; instruction: string }): string {
  const at = p.article.body.findIndex((b) => b.key === p.key);
  const heading = p.article.body
    .slice(0, Math.max(at, 0))
    .reverse()
    .find((b) => b.type === 'heading');
  return [
    `Use edit mode's MCP server (${p.mcp}) to research a change to an article on my site, then propose it.`,
    '',
    `Article: "${p.article.title}" (ID ${p.id})`,
    heading ? `Section: "${heading.text}" (key ${heading.key})` : 'Section: the start of the article, before the first heading',
    `Block: key ${p.key}`,
    `Request: ${p.instruction}`,
    '',
    'Read the article with get_article. Research the request with your own tools, and use only what you can cite.',
    'Cite your sources in a comment on the block with add_comment, then send the changes with propose_changes.',
    'Nothing changes until I review them in edit mode.',
  ].join('\n');
}

/** The announcement once a proposal is ready. */
export const readyLine = (summary: string): string => `Proposal ready: ${summary}`;
/** The announcement after Keep. */
export const keptLine = (summary: string): string => `Kept: ${summary}`;
