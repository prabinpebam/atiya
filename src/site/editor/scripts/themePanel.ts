/**
 * The themes panel's behaviour (documentation/site-ui/theming.md §8): browse themes, change one as a draft (kept per
 * theme for the session), see every change on the live site at once (theme/draft.ts: the draft goes to the site's
 * pages through localStorage), and save, apply, revert, reset, rename or delete through the editor API.
 */
import { contrastIssues, fixContrast, autoHighlight } from '../../theme/palette';
import { resolveTheme, themeCss, type ResolvedTheme } from '../../theme/css';
import { DRAFT_KEY, HEARTBEAT_MS, draftCss } from '../../theme/draft';
import { extractColors, seedFromSwatches, type Swatch } from '../../theme/extract';
import { COLOR_GROUPS, DEFAULT_THEME, PAIRINGS, PALETTES, TYPE_SCALES, copyTheme, isPreset, pairingOf, presetById, typeScaleOf, type ColorRole, type Colors, type FontRole, type Neutral, type Theme, type TypeSettings } from '../../theme/model';
import type { ThemeBase } from '../../theme/base';
import type { FontFile } from '../../theme/fonts';
import { api, describeIssue, editorUrl, saveStatus } from './client';
import { TYPE_SLIDERS, contrastWords, copyName, fromPercent, offers, roleContrast, sameTheme, startingTheme, statusLine, swatchesOf, toPercent, type ThemeEntry } from '../model/theme';

interface State {
  base: ThemeBase;
  entries: ThemeEntry[];
  fonts: FontFile[];
  active: string;
  siteVersion: string | null;
}

const DRAFTS = 'atiya.themeDrafts';
const CHOSEN = 'atiya.themeChosen';
const NOTE = 'atiya.themeNote';
const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '');
const fontUrl = (file: string) => `${BASE_URL}/fonts/${file}`;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Atiya Studio's dock (desktop spec §7.2): the app closes the dock; a browser goes back to edit mode. */
declare global {
  interface Window {
    atiyaDock?: { close(): void };
  }
}

export function initThemePanel(panel: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(panel.querySelector('[data-theme-json]')?.textContent ?? '{}') as State;
  const entries = new Map(state.entries.map((e) => [e.theme.id, e]));
  const fonts = new Map(state.fonts.map((f) => [f.id, f]));
  let active = state.active;
  let siteVersion = state.siteVersion;
  let drafts: Record<string, Theme> = {};
  try {
    drafts = JSON.parse(sessionStorage.getItem(DRAFTS) ?? '{}');
  } catch {
    drafts = {};
  }
  for (const id of Object.keys(drafts)) if (!entries.has(id)) delete drafts[id];
  let chosen = startingTheme(sessionStorage.getItem(CHOSEN) ?? active, [...entries.keys()]);
  let scheme: 'light' | 'dark' | null = null;
  let resolved: ResolvedTheme;
  let syncing = false;
  const $ = <T extends Element = HTMLElement>(sel: string) => panel.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...panel.querySelectorAll<T>(sel)];
  const on = (el: EventTarget | null, type: string, fn: (e: Event) => void) => el?.addEventListener(type, fn, { signal });
  const saved = (id = chosen) => entries.get(id)!.theme;
  const current = () => drafts[chosen] ?? saved();
  const changed = (id = chosen) => !!drafts[id] && !sameTheme(drafts[id], saved(id));
  const say = (text: string) => {
    const n = $('[data-theme-note]');
    if (n) n.textContent = text;
  };

  // ---------- the live preview ----------
  const writeDraft = () => {
    const css = draftCss(themeCss(resolved, state.base, fontUrl, { all: true }), scheme);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ css, at: Date.now() }));
    } catch {
      say("The preview couldn't be shown: this browser's storage is full or off.");
    }
  };
  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);
  const beat = window.setInterval(writeDraft, HEARTBEAT_MS);
  signal.addEventListener('abort', () => {
    clearInterval(beat);
    clearDraft();
  });
  on(window, 'pagehide', clearDraft);

  // ---------- drawing ----------
  const persist = () => {
    sessionStorage.setItem(DRAFTS, JSON.stringify(drafts));
    sessionStorage.setItem(CHOSEN, chosen);
  };

  const drawList = () => {
    const list = $('[data-theme-list]')!;
    const tpl = $<HTMLTemplateElement>('template[data-theme-item]')!;
    const ids = [...entries.keys()];
    list.replaceChildren(
      ...ids.map((id) => {
        const t = drafts[id] ?? saved(id);
        const node = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        const input = node.querySelector('input')!;
        input.value = id;
        input.checked = id === chosen;
        const r = resolveTheme(t, state.base, fonts);
        node.querySelectorAll<HTMLElement>('.chip').forEach((c, i) => c.style.setProperty('--chip', swatchesOf(r)[i]));
        node.querySelector('.item-name')!.textContent = t.name;
        node.querySelector('.item-tags')!.textContent = [isPreset(id) ? 'Preset' : 'Yours', id === active ? 'In use' : '', changed(id) ? 'Unsaved' : ''].filter(Boolean).join(' · ');
        return node;
      }),
    );
  };

  const setRadio = (name: string, value: string | null) => {
    for (const r of $$<HTMLInputElement>(`input[name="${name}"]`)) r.checked = r.value === value;
  };

  const drawRoles = () => {
    const box = $('[data-theme-roles]')!;
    const tpl = $<HTMLTemplateElement>('template[data-theme-role]')!;
    if (!box.childElementCount) {
      for (const g of COLOR_GROUPS) {
        const h = fromTemplate('template[data-theme-role-group]');
        h.textContent = g.name;
        box.append(h);
        for (const { role, label } of g.roles) {
          const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
          row.dataset.role = role;
          row.querySelector('.role-name')!.textContent = label;
          row.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input, i) => input.setAttribute('aria-label', `${label}, ${i ? 'dark' : 'light'} page`));
          box.append(row);
        }
      }
    }
    for (const row of box.querySelectorAll<HTMLElement>('[data-role]')) {
      const role = row.dataset.role as ColorRole;
      const words: string[] = [];
      let fails = false;
      for (const mode of ['light', 'dark'] as const) {
        const input = row.querySelector<HTMLInputElement>(`input[data-mode="${mode}"]`)!;
        const v = resolved.palette[mode][role];
        if (/^#[0-9A-F]{6}$/i.test(v)) input.value = v.toLowerCase();
        const c = roleContrast(resolved, mode, role);
        if (c) {
          words.push(`${mode === 'light' ? 'Light' : 'Dark'}: ${contrastWords(c)}`);
          fails ||= c.ratio < c.min;
        }
      }
      const cell = row.querySelector<HTMLElement>('.role-contrast')!;
      cell.textContent = words.join(' · ');
      cell.toggleAttribute('data-fails', fails);
    }
  };

  const draw = () => {
    syncing = true;
    const t = current();
    resolved = resolveTheme(t, state.base, fonts);
    writeDraft();
    const isChanged = changed();
    $('[data-theme-name]')!.textContent = t.name;
    $('[data-theme-state]')!.textContent = statusLine(t, isChanged, active);
    const o = offers(chosen, isChanged, active);
    const show = (action: string, yes: boolean) => {
      const b = $<HTMLButtonElement>(`[data-theme-action="${action}"]`);
      if (b) b.hidden = !yes;
    };
    show('save', !isPreset(chosen));
    $<HTMLButtonElement>('[data-theme-action="save"]')!.disabled = !o.save;
    show('apply', true);
    $<HTMLButtonElement>('[data-theme-action="apply"]')!.disabled = !o.apply;
    show('revert', o.revert);
    show('reset', o.reset && !!t.basedOn);
    show('rename', o.rename);
    show('delete', o.remove);
    drawList();
    // colour
    const seed = t.colors.seed;
    const palette = PALETTES.find((p) => (p.seed === null ? !seed : JSON.stringify(p.seed) === JSON.stringify(seed)));
    setRadio('palette', !t.colors.light && !t.colors.dark && palette ? palette.id : null);
    $<HTMLInputElement>('[data-theme-seed="accent"]')!.value = (seed?.accent ?? resolved.palette.light.accent).toLowerCase();
    $<HTMLInputElement>('[data-theme-seed="highlight"]')!.value = (seed?.highlight ?? resolved.palette.light.highlight).toLowerCase();
    const auto = $<HTMLInputElement>('input[name="auto-highlight"]');
    if (auto) auto.checked = !!seed && !seed.highlight;
    setRadio('neutral', seed?.neutral ?? 'warm');
    $('[data-theme-adjusted]')!.textContent = resolved.palette.adjusted.includes('light:accent') ? 'Your accent was darkened a little on the light page, so links read on it.' : '';
    drawRoles();
    const issues = contrastIssues(resolved.palette);
    const issueBox = $('[data-theme-issues]')!;
    issueBox.hidden = !issues.length;
    issueBox.textContent = issues.length ? `${issues.length} colour pair${issues.length === 1 ? ' is' : 's are'} under WCAG AA. Open Every colour and press Fix contrast.` : '';
    // type
    setRadio('pairing', pairingOf(t.fonts)?.id ?? null);
    for (const sel of $$('[data-theme-font]')) sel.dispatchEvent(new CustomEvent('select-set', { detail: { value: t.fonts[sel.dataset.themeFont as FontRole] } }));
    setRadio('scale', typeScaleOf(t.type)?.id ?? null);
    for (const s of $$('[data-theme-type]')) {
      const input = s.querySelector<HTMLInputElement>('input[type="range"]')!;
      const v = String(toPercent(s.dataset.themeType as keyof TypeSettings, t.type[s.dataset.themeType as keyof TypeSettings]));
      if (input.value !== v) {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    const warn = $('[data-theme-type-warnings]')!;
    warn.hidden = !resolved.warnings.length;
    warn.textContent = resolved.warnings.join(' ');
    // spacing and corners
    setRadio('spacing', t.spacing);
    setRadio('corners', t.corners);
    persist();
    syncing = false;
  };

  /** Changes the chosen theme's draft (a draft equal to the saved theme is dropped). */
  const edit = (fn: (t: Theme) => void) => {
    if (syncing) return;
    const before = current();
    const t = clone(before);
    fn(t);
    // a control set to what it already shows (a select told its value) changes nothing
    if (JSON.stringify(t) === JSON.stringify(before)) return;
    if (sameTheme(t, saved())) delete drafts[chosen];
    else drafts[chosen] = t;
    draw();
  };
  const seedOf = (t: Theme) => t.colors.seed ?? { accent: resolved.palette.light.accent, highlight: resolved.palette.light.highlight, neutral: 'warm' as const };

  // ---------- controls ----------
  on($('[data-theme-list]'), 'change', (e) => {
    const id = (e.target as HTMLInputElement).value;
    if (!entries.has(id)) return;
    chosen = id;
    say('');
    draw();
  });
  on(panel, 'change', (e) => {
    if (syncing) return;
    const el = e.target as HTMLInputElement;
    const value = el.value;
    if (el.name === 'palette') {
      const p = PALETTES.find((x) => x.id === value);
      if (p) edit((t) => (t.colors = p.seed ? { seed: clone(p.seed) } : {}));
    }     else if (el.name === 'neutral') edit((t) => (t.colors = { ...t.colors, seed: { ...seedOf(t), neutral: value as Neutral } }));
    else if (el.name === 'auto-highlight')
      edit((t) => {
        const s = { ...seedOf(t) };
        if (el.checked) delete s.highlight;
        else s.highlight = autoHighlight(s.accent, state.base);
        t.colors = { ...t.colors, seed: s };
      });
    else if (el.name === 'pairing') {
      const p = PAIRINGS.find((x) => x.id === value);
      if (p) edit((t) => (t.fonts = { ...p.fonts }));
    } else if (el.name === 'scale') {
      const s = TYPE_SCALES.find((x) => x.id === value);
      if (s) edit((t) => (t.type = { ...s.settings }));
    } else if (el.name === 'spacing') edit((t) => (t.spacing = value as Theme['spacing']));
    else if (el.name === 'corners') edit((t) => (t.corners = value as Theme['corners']));
    else if (el.name === 'preview-scheme') {
      scheme = value === 'light' || value === 'dark' ? value : null;
      writeDraft();
    } else if (el.name === 'picture-file' && el.files?.[0]) fromPicture(URL.createObjectURL(el.files[0]));
  });
  on(panel, 'input', (e) => {
    if (syncing) return;
    const el = e.target as HTMLInputElement;
    const seed = el.dataset.themeSeed;
    if (seed === 'accent') edit((t) => (t.colors = { ...t.colors, seed: { ...seedOf(t), accent: el.value.toUpperCase() } }));
    else if (seed === 'highlight') edit((t) => (t.colors = { ...t.colors, seed: { ...seedOf(t), highlight: el.value.toUpperCase() } }));
    else if (el.dataset.mode) {
      const role = el.closest<HTMLElement>('[data-role]')?.dataset.role as ColorRole;
      const mode = el.dataset.mode as 'light' | 'dark';
      edit((t) => (t.colors = { ...t.colors, [mode]: { ...(t.colors[mode] ?? {}), [role]: el.value.toUpperCase() } }));
    } else if (el.type === 'range') {
      const key = el.closest<HTMLElement>('[data-theme-type]')?.dataset.themeType as keyof TypeSettings | undefined;
      if (key) edit((t) => (t.type = { ...t.type, [key]: fromPercent(key, Number(el.value)) }));
    }
  });
  on(panel, 'select-change', (e) => {
    const role = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-font]')?.dataset.themeFont as FontRole | undefined;
    const value = (e as CustomEvent<{ value: string }>).detail.value;
    if (role && value) edit((t) => (t.fonts = { ...t.fonts, [role]: value }));
  });

  // ---------- colours from a picture ----------
  const fromTemplate = (sel: string) => $<HTMLTemplateElement>(sel)!.content.firstElementChild!.cloneNode(true) as HTMLElement;
  const showSwatches = (swatches: Swatch[]) => {
    const box = $('[data-theme-swatches]')!;
    box.hidden = false;
    const seed = seedFromSwatches(swatches);
    const button = (words: string, colour: string | null, act: () => void) => {
      const b = fromTemplate('template[data-theme-swatch]');
      b.querySelector('.swatch-words')!.textContent = words;
      const chip = b.querySelector<HTMLElement>('.chip')!;
      if (colour) chip.style.setProperty('--chip', colour);
      else chip.remove();
      b.addEventListener('click', act, { signal });
      return b;
    };
    box.replaceChildren(
      ...(seed ? [button('Use these colours', null, () => edit((t) => (t.colors = { seed })))] : []),
      ...swatches.map((s) => button(`Use ${s.hex} as the accent`, s.hex, () => edit((t) => (t.colors = { seed: { ...seedOf(t), accent: s.hex } })))),
    );
    say(swatches.length ? `Found ${swatches.length} colours in the picture.` : 'No colours were found in that picture.');
  };
  const fromPicture = (src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 96;
      const c = document.createElement('canvas');
      const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      showSwatches(extractColors(ctx.getImageData(0, 0, c.width, c.height).data));
    };
    img.onerror = () => say("That picture couldn't be read. Try another, or a JPEG, PNG or WebP file.");
    img.src = src;
  };

  // ---------- actions ----------
  const replaceEntry = (t: Theme, version: string | null) => entries.set(t.id, { theme: t, version });
  const save = async (t: Theme, version: string | null): Promise<string | null> => {
    saveStatus.saving();
    const key = `/content/themes/${t.id}.json`;
    const r = await api<{ versions: Record<string, string | null> }>('PUT', `themes/${t.id}`, { theme: t, ifMatch: { [key]: version } });
    if (!r.ok) {
      saveStatus.failed(r.data.issues?.map(describeIssue).join(' ') ?? 'Not saved');
      say(r.data.issues?.map(describeIssue).join(' ') ?? "The theme wasn't saved.");
      return null;
    }
    saveStatus.saved(`Theme: ${t.name}`);
    return r.data.versions?.[key] ?? null;
  };
  const apply = async (id: string) => {
    const r = await api<{ versions: Record<string, string | null> }>('PUT', 'themes/active', { id, ifMatch: { '/content/site.json': siteVersion } });
    if (!r.ok) return say(r.data.issues?.map(describeIssue).join(' ') ?? "The theme wasn't applied.");
    siteVersion = r.data.versions?.['/content/site.json'] ?? siteVersion;
    active = id;
    say(`${saved(id).name} is the site's theme now.`);
    draw();
  };
  /** After the name dialog: what to do with the name (save as new, or rename). */
  let naming: 'save-as' | 'rename' | 'save-as-apply' = 'save-as';
  const nameDialog = document.getElementById('theme-name') as HTMLDialogElement | null;
  const askName = (why: typeof naming) => {
    naming = why;
    const input = nameDialog?.querySelector<HTMLInputElement>('input[name="name"]');
    if (!nameDialog || !input) return;
    nameDialog.querySelector('h2')!.textContent = why === 'rename' ? 'Rename this theme' : 'Save as a new theme';
    input.value = why === 'rename' ? current().name : copyName(current().name, [...entries.values()].map((e) => e.theme.name));
    nameDialog.showModal();
    input.select();
  };
  on(nameDialog?.querySelector('[data-theme-name-form]') ?? null, 'submit', async (e) => {
    e.preventDefault();
    const name = (nameDialog!.querySelector<HTMLInputElement>('input[name="name"]')!.value ?? '').trim();
    if (!name) return say('Give the theme a name.');
    nameDialog!.close();
    if (naming === 'rename') {
      const t = { ...clone(current()), name };
      const v = await save(t, entries.get(chosen)!.version);
      if (v === null) return;
      replaceEntry(t, v);
      delete drafts[chosen];
      return draw();
    }
    const t = copyTheme(current(), name, entries.keys());
    const v = await save(t, null);
    if (v === null) return;
    replaceEntry(t, v);
    delete drafts[chosen];
    chosen = t.id;
    draw();
    if (naming === 'save-as-apply') await apply(t.id);
    else say(`Saved as ${t.name}.`);
  });
  const deleteDialog = document.getElementById('theme-delete') as HTMLDialogElement | null;
  on(deleteDialog?.querySelector('[data-theme-action="delete-yes"]') ?? null, 'click', async () => {
    deleteDialog!.close();
    const id = chosen;
    const r = await api<{ versions: Record<string, string | null> }>('DELETE', `themes/${id}`, { ifMatch: { [`/content/themes/${id}.json`]: entries.get(id)!.version } });
    if (!r.ok) return say(r.data.issues?.map(describeIssue).join(' ') ?? "The theme wasn't deleted.");
    const name = saved(id).name;
    entries.delete(id);
    delete drafts[id];
    if (active === id) active = DEFAULT_THEME;
    siteVersion = r.data.versions?.['/content/site.json'] ?? siteVersion;
    chosen = active;
    say(`${name} is deleted.`);
    draw();
  });
  on(panel, 'click', async (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-action]')?.dataset.themeAction;
    if (!action) return;
    if (action === 'apply') {
      if (!changed()) return apply(chosen);
      if (isPreset(chosen)) return askName('save-as-apply');
      const t = current();
      const v = await save(t, entries.get(chosen)!.version);
      if (v === null) return;
      replaceEntry(t, v);
      delete drafts[chosen];
      return apply(chosen);
    }
    if (action === 'save') {
      if (isPreset(chosen) || !changed()) return;
      const t = current();
      const v = await save(t, entries.get(chosen)!.version);
      if (v === null) return;
      replaceEntry(t, v);
      delete drafts[chosen];
      say(`${t.name} is saved.`);
      return draw();
    }
    if (action === 'save-as') return askName('save-as');
    if (action === 'rename') return askName('rename');
    if (action === 'revert') {
      delete drafts[chosen];
      say('Back to the saved theme.');
      return draw();
    }
    if (action === 'reset') {
      const from = presetById(current().basedOn ?? '');
      if (!from) return;
      edit((t) => Object.assign(t, { spacing: from.spacing, corners: from.corners, fonts: clone(from.fonts), type: clone(from.type), colors: clone(from.colors) } satisfies Partial<Theme>));
      return say(`Back to ${from.name}'s settings. Save to keep them.`);
    }
    if (action === 'delete') {
      const words = deleteDialog?.querySelector('[data-theme-delete-words]');
      if (words) words.textContent = `${saved().name} is deleted from the site's content.${chosen === active ? ' The site uses it, so the site goes back to Atiya.' : ''}`;
      return deleteDialog?.showModal();
    }
    if (action === 'fix-contrast') {
      edit((t) => (t.colors = fixContrast(state.base, t.colors) as Colors));
      return say('Colours moved until every pair passes WCAG AA.');
    }
    if (action === 'site-pictures') {
      const box = $('[data-theme-pictures]')!;
      const r = await api<{ media: { id: string; thumb: string; alt: string }[] }>('GET', 'media');
      if (!r.ok) return say("Your site's pictures couldn't be listed.");
      box.hidden = false;
      box.replaceChildren(
        ...r.data.media.slice(0, 24).map((m) => {
          const b = fromTemplate('template[data-theme-thumb]');
          b.setAttribute('aria-label', `Take colours from ${m.alt || m.id}`);
          b.querySelector('img')!.src = m.thumb;
          b.addEventListener('click', () => fromPicture(m.thumb), { signal });
          return b;
        }),
      );
      return;
    }
    if (action === 'close') {
      clearDraft();
      if (window.atiyaDock) window.atiyaDock.close();
      else location.assign(editorUrl(''));
    }
  });

  // ---------- importing a font ----------
  on($('[data-theme-import]'), 'submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const url = (form.querySelector<HTMLInputElement>('input[name="url"]')?.value ?? '').trim();
    const category = form.querySelector<HTMLElement>('[data-theme-import-category] [aria-selected="true"]')?.dataset.value ?? 'sans-serif';
    say('Importing the font…');
    const r = await api<{ font?: FontFile; message?: string }>('POST', 'themes/fonts', { url, category });
    if (!r.ok || !r.data.font) return say(r.data.message ?? r.data.issues?.map(describeIssue).join(' ') ?? "The font wasn't imported.");
    const f = r.data.font;
    // the browser must read it too, else it's no use: a font that won't parse is said so, and the fallback stays
    try {
      for (const face of f.faces) await new FontFace(f.family, `url(${fontUrl(face.file)})`, { style: face.style }).load();
    } catch {
      return say(`${f.family} was imported, but this browser can't read it: the site will use its fallback. Try another address.`);
    }
    sessionStorage.setItem(NOTE, `Imported ${f.family}. Choose it for Headlines, Reading text or Interface.`);
    persist();
    location.reload();
  });

  const note = sessionStorage.getItem(NOTE);
  if (note) {
    sessionStorage.removeItem(NOTE);
    say(note);
  }
  draw();
}
