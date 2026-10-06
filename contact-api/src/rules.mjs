// @ts-check
/**
 * The contact form's rules (documentation/contact/spec.md §2.2, §5.3), written once for both sides: the
 * site's form imports them to check as the visitor types, and the service checks the same before it sends.
 * Pure: no Node or browser API, so it runs in both.
 */

export const LIMITS = Object.freeze({
  /** The most characters a name takes. */
  name: 100,
  /** The most characters an email address takes (RFC 5321's path limit). */
  email: 254,
  /** The fewest characters a message takes, once trimmed. */
  messageMin: 10,
  /** The most characters a message takes. */
  messageMax: 5000,
  /** From this length, the message's hint counts what's left. */
  countFrom: 4000,
  /** The most links a message may carry. */
  links: 3,
  /** The most characters the section an access request is about takes. */
  about: 80,
  /** The fewest milliseconds between the form's first focus and Send: faster is a bot. */
  minElapsed: 3000,
});

/** @typedef {'name' | 'email' | 'message'} Field */
/** @typedef {'required' | 'long' | 'short' | 'format' | 'links' | 'lines'} Problem */
/** @typedef {{ name: string; email: string; message: string }} Fields */

// control characters other than a tab and a line break: never part of a message
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const LINK = /\b(?:https?:\/\/|www\.)/gi;
// one @, something either side, a dot in the domain, no spaces
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How many links a message carries (http://, https://, www.). */
export const countLinks = (/** @type {string} */ text) => (text.match(LINK) ?? []).length;

/**
 * The fields as they're checked and sent: trimmed, line endings as \n, control characters dropped.
 * @param {Partial<Record<Field, unknown>>} f
 * @returns {Fields}
 */
export function cleanFields(f) {
  const clean = (/** @type {unknown} */ v) =>
    String(v ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL, '')
      .trim();
  return { name: clean(f.name), email: clean(f.email), message: clean(f.message) };
}

/**
 * What's wrong with one field's (clean) value, or null.
 * @param {Field} field
 * @param {string} value
 * @returns {Problem | null}
 */
export function checkField(field, value) {
  if (!value) return 'required';
  if (field === 'name') {
    if (/\n/.test(value)) return 'lines';
    return value.length > LIMITS.name ? 'long' : null;
  }
  if (field === 'email') {
    if (/\n/.test(value)) return 'lines';
    if (value.length > LIMITS.email) return 'long';
    return EMAIL.test(value) ? null : 'format';
  }
  if (value.length < LIMITS.messageMin) return 'short';
  if (value.length > LIMITS.messageMax) return 'long';
  return countLinks(value) > LIMITS.links ? 'links' : null;
}

/**
 * Every field's problem (only the fields that have one).
 * @param {Fields} f clean fields
 * @returns {Partial<Record<Field, Problem>>}
 */
export function checkFields(f) {
  /** @type {Partial<Record<Field, Problem>>} */
  const out = {};
  for (const k of /** @type {Field[]} */ (['name', 'email', 'message'])) {
    const p = checkField(k, f[k]);
    if (p) out[k] = p;
  }
  return out;
}

/**
 * What a problem says to the visitor: what happened, and how to fix it.
 * @param {Field} field
 * @param {Problem} problem
 * @param {string} [value] the field's value (a message's length is counted)
 */
export function errorText(field, problem, value = '') {
  if (field === 'name') return problem === 'required' ? 'Enter your name.' : problem === 'lines' ? 'Write your name on one line.' : `Keep your name under ${LIMITS.name} characters.`;
  if (field === 'email') return problem === 'required' ? 'Enter your email so I can reply.' : 'Enter an email address like name@example.com.';
  if (problem === 'required') return 'Write your message.';
  if (problem === 'short') return `Write a little more: at least ${LIMITS.messageMin} characters.`;
  if (problem === 'links') return `Take out some links: up to ${LIMITS.links} are allowed.`;
  return `Keep it under ${LIMITS.messageMax.toLocaleString('en')} characters: it's ${value.length.toLocaleString('en')} now.`;
}

/**
 * The message an access request starts with (Ask for access, Get in touch).
 * @param {string} section the section's title, or '' for the shared work in general
 */
export const accessRequest = (section) =>
  section ? `Hello Prabin, I'd like an access code to read the work in ${section}.` : "Hello Prabin, I'd like an access code to read your shared work.";

/** A name's first word, for the thanks. */
export const firstName = (/** @type {string} */ name) => name.trim().split(/\s+/)[0] ?? '';
