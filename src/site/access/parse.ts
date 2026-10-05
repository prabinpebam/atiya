/**
 * What a visitor types as an access code (documentation/access/spec.md §4.2), read without the word list:
 * case and the separators between words don't matter; five words or more, letters only. The first word
 * is the code's name (which keyring to try), the rest its secret.
 */
export function parseCode(input: string): { name: string; secret: string } | null {
  const parts = input
    .trim()
    .toLowerCase()
    .split(/[\s\-_.,]+/)
    .filter(Boolean);
  if (parts.length < 5 || parts.some((part) => !/^[a-z]+$/.test(part))) return null;
  return { name: parts[0], secret: parts.slice(1).join('-') };
}