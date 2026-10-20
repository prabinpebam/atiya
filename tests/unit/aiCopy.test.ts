import { describe, expect, it } from 'vitest';
import { failureNote, needsNote, serviceLine, statusLine, type AiFailureCode } from '../../src/site/editor/model/aiCopy';

describe("AI's words (ai-editing.md §4.4, §10)", () => {
  it('shows the step, and the time only past 3 seconds of writing', () => {
    expect(statusLine('deciding')).toBe('Deciding…');
    expect(statusLine('writing', 'Ollama', 2.9)).toBe('Writing with Ollama…');
    expect(statusLine('writing', 'Ollama', 12.4)).toBe('Writing with Ollama… 12 s');
    expect(statusLine('checking', 'Ollama', 12)).toBe('Checking…');
  });

  it('names where the article goes, and says when a page is private', () => {
    expect(serviceLine({ name: 'OpenAI', model: 'gpt-5' })).toBe('Sends this article to OpenAI, gpt-5');
    expect(serviceLine({ name: 'OpenAI', model: 'gpt-5' }, true)).toBe('Private page: sends it to OpenAI');
    expect(serviceLine(null)).toBe('Set up an AI service to use this.');
  });

  it('says what happened and what to do for every failure, never a code or "Error"', () => {
    const codes: AiFailureCode[] = ['key-refused', 'no-credit', 'busy', 'unreachable', 'not-running', 'stalled', 'stopped', 'rejected', 'no-service', 'private', 'refused'];
    for (const c of codes) {
      const n = failureNote(c, 'Ollama', 'a reference to a missing page');
      expect(n.title).not.toMatch(/error|key-refused|no-credit|not-running|\b\d{3}\b/i);
      expect(n.title).toMatch(/[.:]$|\.$/);
      expect(n.choices.length).toBeGreaterThan(0);
    }
    expect(failureNote('not-running', 'Ollama')).toMatchObject({ title: "Ollama isn't running on this computer.", choices: ['retry'] });
    expect(failureNote('refused', 'Ollama', 'a reference to a missing page').title).toBe("The answer didn't fit the site: a reference to a missing page.");
  });

  it('offers research its own way forward, names what AI can’t change, and asks back in the writer’s words', () => {
    expect(needsNote('research')).toMatchObject({ title: 'This needs research from the web.', choices: ['copy', 'anyway'] });
    expect(needsNote('outside', 'access').title).toBe("AI can't change a page's access. Change it in Page settings.");
    expect(needsNote('unclear', undefined, 'Shorter for whom?').title).toBe('Shorter for whom?');
  });
});
