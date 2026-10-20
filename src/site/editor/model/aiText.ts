/**
 * The words of an AI proposal (documentation/editor/ai-editing.md §4.2, ai-services.md §9.2): a block's text
 * read out of a partial answer while it streams, and the word diff the canvas draws as a tracked change.
 * Pure: the connector and the canvas both use it.
 */

/** The field that holds a block's words, for the types whose words stream; null for the rest. */
export const wordsField = (type: string): 'markdown' | 'text' | null =>
  type === 'text' ? 'markdown' : type === 'quote' || type === 'heading' || type === 'subheading' || type === 'marker' ? 'text' : null;

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };

/** The JSON string starting at `from` (just after its opening quote), decoded as far as it has arrived, and whether it's closed. */
function readString(raw: string, from: number): { value: string; closed: boolean } {
  let value = '';
  for (let i = from; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') return { value, closed: true };
    if (ch !== '\\') {
      value += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next === 'u') {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      value += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      value += ESCAPES[next] ?? next;
      i += 1;
    }
  }
  return { value, closed: false };
}

/** The first change's block words in a partial answer, as far as they've arrived: null until the field has started. */
export function partialWords(raw: string, field: 'markdown' | 'text'): string | null {
  const block = raw.indexOf('"block"');
  if (block < 0) return null;
  const m = new RegExp(`"${field}"\\s*:\\s*"`).exec(raw.slice(block));
  if (!m) return null;
  return readString(raw, block + m.index + m[0].length).value;
}

export interface DiffPart {
  kind: 'same' | 'add' | 'del';
  text: string;
}

/** Words and the spaces between them, each its own token. */
const tokens = (s: string) => s.split(/(\s+)/).filter(Boolean);

/** The word diff from `before` to `after` (longest common subsequence of words), with neighbouring parts of one kind joined. */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  const n = a.length;
  const m = b.length;
  // lcs[i][j]: the longest common run of a[i..] and b[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last?.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', a[i++]);
    else push('add', b[j++]);
  }
  while (i < n) push('del', a[i++]);
  while (j < m) push('add', b[j++]);
  return out;
}
