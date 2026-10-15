// @ts-check
/**
 * Edit mode's header, as the app's one title bar row draws it (documentation/desktop/spec.md §7.2, plan stage
 * 7B). Edit mode describes its hidden header (src/site/editor/scripts/studio.ts) and the main process passes the
 * description to the frame's page, and the row's commands back. Both come from a page the dev server serves, so
 * both are checked here, field by field: plain words of a bounded length, an icon's name, a few known states.
 * Pure.
 */

const KINDS = new Set(['text', 'tag', 'link', 'button', 'status', 'select']);
const MAX_ITEMS = 40;
const MAX_OPTIONS = 12;
const ID = /^s\d{1,6}$/;
const NAME = /^[a-z0-9-]{1,60}$/;

/** @param {unknown} v @param {number} [max] */
const str = (v, max = 160) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** @param {unknown} v */
const name = (v) => (typeof v === 'string' && NAME.test(v) ? v : undefined);

/**
 * @typedef {{ kind: string, id?: string, text?: string, label?: string, icon?: string, variant?: string, tone?: string, state?: string, strong?: boolean, busy?: boolean, pressed?: boolean, disabled?: boolean, value?: string, options?: { value: string, label: string, icon?: string }[] }} HeaderItem
 * @typedef {{ context: HeaderItem[], controls: HeaderItem[], theme: 'light' | 'dark' | 'system', busy: boolean }} StudioHeader
 */

/** @param {any} it @returns {HeaderItem | null} */
function item(it) {
  if (!it || typeof it !== 'object' || !KINDS.has(it.kind)) return null;
  /** @type {HeaderItem} */
  const out = { kind: it.kind };
  if (it.kind === 'link' || it.kind === 'button' || it.kind === 'select') {
    if (typeof it.id !== 'string' || !ID.test(it.id)) return null;
    out.id = it.id;
    out.label = str(it.label);
    if (!out.label) return null;
  }
  if (it.kind === 'text' || it.kind === 'tag' || it.kind === 'status') {
    out.text = str(it.text);
    if (!out.text && it.kind !== 'status') return null;
  } else if (str(it.text)) out.text = str(it.text);
  for (const k of /** @type {const} */ (['icon', 'variant', 'tone', 'state'])) {
    const v = name(it[k]);
    if (v) out[k] = v;
  }
  for (const k of /** @type {const} */ (['strong', 'busy', 'pressed', 'disabled'])) if (typeof it[k] === 'boolean') out[k] = it[k];
  if (it.kind === 'select') {
    const raw = Array.isArray(it.options) ? it.options.slice(0, MAX_OPTIONS) : [];
    const options = raw
      .map((/** @type {any} */ o) => ({ value: name(o?.value) ?? '', label: str(o?.label, 60), ...(name(o?.icon) ? { icon: /** @type {string} */ (name(o.icon)) } : {}) }))
      .filter((/** @type {{ value: string, label: string }} */ o) => o.value && o.label);
    if (!options.length) return null;
    out.options = options;
    out.value = name(it.value) ?? options[0].value;
  }
  return out;
}

/**
 * Edit mode's header description, kept to what the row can draw; null when it isn't one.
 * @param {unknown} h @returns {StudioHeader | null}
 */
export function sanitizeHeader(h) {
  if (!h || typeof h !== 'object') return null;
  const o = /** @type {any} */ (h);
  const list = (/** @type {unknown} */ l) => (Array.isArray(l) ? l.slice(0, MAX_ITEMS).map(item).filter((x) => x !== null) : []);
  return {
    context: /** @type {HeaderItem[]} */ (list(o.context)),
    controls: /** @type {HeaderItem[]} */ (list(o.controls)),
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'system',
    busy: o.busy === true,
  };
}

/**
 * A command from the row for edit mode: press a control, or choose an option; null when it isn't one.
 * @param {unknown} c @returns {{ id: string, action: 'click' | 'select', value?: string } | null}
 */
export function sanitizeCommand(c) {
  if (!c || typeof c !== 'object') return null;
  const o = /** @type {any} */ (c);
  if (typeof o.id !== 'string' || !ID.test(o.id)) return null;
  if (o.action === 'click') return { id: o.id, action: 'click' };
  if (o.action === 'select' && name(o.value)) return { id: o.id, action: 'select', value: o.value };
  return null;
}

/** Is this address edit mode, on the dev server the app runs? @param {string} url @param {string} devOrigin */
export function isEditMode(url, devOrigin) {
  try {
    const u = new URL(url);
    return u.origin === devOrigin && u.pathname.startsWith('/_edit/');
  } catch {
    return false;
  }
}
