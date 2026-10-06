/**
 * The Access screen (documentation/access/spec.md §8.1): the list of access codes and magic links (Find,
 * Show and Kind; the arrow keys between them; choosing one shows it on the right without a reload, kept in
 * the address so Back works, and asks first if the details have unsaved changes), and the details (Copy,
 * one Save for who it's for, why, notes, what it opens and its last day, Discard, Withdraw now, Delete, and
 * the form that makes a new one). What it opens is a list of sections with their pages: a section's own
 * choice covers its pages (shown checked, and kept as they were underneath, for when it's cleared), Find
 * narrows it, and the line over it says what's chosen. Every write is one call to the editor API; the list
 * and the details are then drawn again from the server (`swapRegions`).
 */
import { announce, api, describeIssue, saveStatus, swapRegions, type Issue } from './client';
import { scopeLine } from '../model/access';

const DETAIL = 'access-detail';
const LIST = 'access-list';
const LIVE = new Set(['active', 'expiring']);
const shown = (n: number, of: number) => (n === of ? `${of} ${of === 1 ? 'code or link' : 'codes and links'}` : `${n} of ${of} shown`);

/** The details, if they hold changes not saved yet. */
const unsavedDetail = () => document.querySelector<HTMLElement>(`[data-region="${DETAIL}"] [data-grant-form][data-unsaved]`);

/** The address for a grant (`new` for the form, empty for the screen's own choice). */
function urlFor(grant: string): URL {
  const url = new URL(location.href);
  if (grant) url.searchParams.set('grant', grant);
  else url.searchParams.delete('grant');
  for (const k of ['made', 'page', 'section']) url.searchParams.delete(k);
  return url;
}

/** Draws the list and the details again from the server at `url`. Until then the details can't be used, so nothing is typed into what's about to go. */
async function redraw(url: string, regions = [LIST, DETAIL]) {
  const region = () => document.querySelector<HTMLElement>(`[data-region="${DETAIL}"]`);
  const detail = region();
  if (detail) {
    detail.setAttribute('aria-busy', 'true');
    detail.inert = true;
  }
  try {
    await swapRegions(regions, url);
  } finally {
    const now = region();
    now?.removeAttribute('aria-busy');
    if (now) now.inert = false;
  }
}

export function initAccessList(root: HTMLElement, signal: AbortSignal) {
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => el.addEventListener(type, fn, { signal });
  const list = root.querySelector<HTMLElement>('[data-access-list]')!;
  const filters = { q: '', show: 'all', kind: 'all' };
  const items = () => [...root.querySelectorAll<HTMLElement>('[data-access-item]')];
  const links = () => items().filter((i) => !i.hidden).map((i) => i.querySelector<HTMLAnchorElement>('[data-access-go]')!);

  // ---------- Find, Show and Kind ----------
  const filter = () => {
    const all = items();
    for (const i of all) {
      const state = i.dataset.state ?? '';
      const fits = filters.show === 'all' || (filters.show === 'live' ? LIVE.has(state) : state === filters.show);
      i.hidden = !fits || (filters.kind !== 'all' && i.dataset.kind !== filters.kind) || (!!filters.q && !(i.dataset.find ?? '').includes(filters.q));
    }
    for (const g of root.querySelectorAll<HTMLElement>('[data-access-group]')) {
      const visible = [...g.querySelectorAll<HTMLElement>('[data-access-item]')].filter((i) => !i.hidden).length;
      g.hidden = visible === 0;
      const count = g.querySelector('[data-access-group-count]');
      if (count) count.textContent = ` (${visible})`;
    }
    const n = all.filter((i) => !i.hidden).length;
    const none = root.querySelector<HTMLElement>('[data-access-nomatch]');
    if (none) none.hidden = !(all.length > 0 && n === 0);
    const count = root.querySelector('[data-access-count]')?.firstElementChild;
    if (count) count.textContent = shown(n, all.length);
  };
  on(root, 'input', (e) => {
    const field = (e.target as Element).closest('[data-access-find]');
    if (!field) return;
    filters.q = ((e.target as HTMLInputElement).value ?? '').trim().toLowerCase();
    filter();
  });
  on(root, 'select-change', (e) => {
    const t = e.target as Element;
    const value = (e as CustomEvent<{ value: string }>).detail.value;
    if (t.closest('[data-access-show]')) filters.show = value;
    else if (t.closest('[data-access-kind]')) filters.kind = value;
    else return;
    filter();
  });

  // ---------- the chosen one ----------
  const shownNow = () => document.querySelector<HTMLElement>(`[data-region="${DETAIL}"] [data-grant-details]`)?.dataset.grantDetails ?? '';
  /** Marks the one the details show (the server may have chosen it) as current in the list. */
  const mark = () => {
    const shownId = shownNow();
    for (const a of root.querySelectorAll<HTMLAnchorElement>('[data-access-item] [data-access-go]')) {
      if (a.dataset.accessGo === shownId) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    const add = root.querySelector<HTMLElement>('.list-head [data-access-go="new"]');
    if (add) add.toggleAttribute('data-chosen', shownId === 'new');
  };
  const choose = async (grant: string, push: boolean) => {
    const form = unsavedDetail();
    if (form) {
      const name = form.closest<HTMLElement>('[data-grant-details]')?.dataset.name || 'the new code or link';
      if (!confirm(`Leave without saving? Your changes to ${name} will be lost.`)) {
        // Back or Forward already moved the address: put it back where the details are
        if (!push) history.pushState(history.state, '', urlFor(shownNow() === 'none' ? '' : shownNow()));
        return false;
      }
      delete form.dataset.unsaved;
    }
    const url = urlFor(grant);
    if (push) history.pushState(history.state, '', url);
    await redraw(url.href, [DETAIL]);
    mark();
    // one column (a phone): the list is above, so bring the details into view
    if (push && getComputedStyle(list).position !== 'sticky') root.querySelector<HTMLElement>('[data-access-detail]')?.scrollIntoView({ block: 'start' });
    const name = document.querySelector<HTMLElement>(`[data-region="${DETAIL}"] [data-grant-details]`)?.dataset.name;
    if (push && name) announce(`Showing ${name}`);
    return true;
  };
  // the list's links and Share with someone, and the details' own (Cancel, the empty state's button)
  on(document, 'click', (e) => {
    const me = e as MouseEvent;
    const a = (me.target as Element).closest<HTMLAnchorElement>('a[data-access-go]');
    if (!a || me.button !== 0 || me.ctrlKey || me.metaKey || me.shiftKey || me.altKey) return;
    if (!root.contains(a)) return;
    me.preventDefault();
    void choose(a.dataset.accessGo ?? '', true);
  });
  on(window, 'popstate', () => void choose(new URL(location.href).searchParams.get('grant') ?? '', false));

  // ---------- the keys: up and down the list ----------
  on(list, 'keydown', (e) => {
    const k = e as KeyboardEvent;
    const a = (k.target as Element).closest<HTMLAnchorElement>('[data-access-item] [data-access-go]');
    if (!a || k.altKey || k.ctrlKey || k.metaKey || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(k.key)) return;
    const all = links();
    const at = all.indexOf(a);
    const to = k.key === 'Home' ? 0 : k.key === 'End' ? all.length - 1 : at + (k.key === 'ArrowDown' ? 1 : -1);
    if (to < 0 || to >= all.length) return;
    k.preventDefault();
    all[to].focus();
  });

  // the list drawn again (after a save) keeps what Find, Show and Kind leave out, and the current one
  on(document, 'astro:page-load', () => {
    filter();
    mark();
  });
  filter();
  mark();
}

// ---------- the details ----------

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    announce(`${what} copied`);
  } catch {
    announce('Couldn’t copy: select the text and copy it.', 'negative');
  }
}

/** What a scope picker's checkboxes say: the sections chosen, and the pages chosen that no chosen section covers. */
function scopeOf(form: HTMLFormElement) {
  const boxes = (name: string) => [...form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)];
  const sections = boxes('sections').filter((b) => b.checked);
  const pages = boxes('pages').filter((b) => b.checked && !b.disabled);
  return { sections, pages };
}

function initScope(form: HTMLFormElement, signal: AbortSignal) {
  const scope = form.querySelector<HTMLElement>('[data-scope]');
  if (!scope) return () => {};
  const groups = () => [...scope.querySelectorAll<HTMLDetailsElement>('[data-scope-group]')];
  const hintOf = (box: HTMLInputElement) => (box.id ? document.getElementById(`${box.id}-hint`) : null);
  let finding = false;

  /** A section's own choice covers its pages: checked, can't be changed, and kept as they were underneath. */
  const sync = () => {
    for (const g of groups()) {
      const section = g.querySelector<HTMLInputElement>('[data-scope-section] input');
      const name = g.querySelector('[data-scope-name]')?.textContent?.trim() ?? '';
      let chosen = 0;
      for (const li of g.querySelectorAll<HTMLElement>('[data-scope-page]')) {
        const label = li.querySelector<HTMLElement>('[data-checkbox]');
        const box = li.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!box || !label || !section) {
          if (box?.checked) chosen++;
          continue;
        }
        if (section.checked && !box.disabled) {
          label.dataset.own = String(box.checked);
          box.checked = true;
          box.disabled = true;
          label.toggleAttribute('data-disabled', true);
          const hint = hintOf(box);
          if (hint) hint.textContent = `Opened by ${name}`;
        } else if (!section.checked && box.disabled) {
          box.checked = label.dataset.own === 'true';
          box.disabled = false;
          label.toggleAttribute('data-disabled', false);
          const hint = hintOf(box);
          if (hint) hint.textContent = li.dataset.hint ?? '';
        }
        if (box.checked && !box.disabled) chosen++;
      }
      const tally = g.querySelector('[data-scope-chosen]');
      if (tally) tally.textContent = section?.checked ? ' · All, now and later' : chosen ? ` · ${chosen} chosen` : '';
    }
    const { sections, pages } = scopeOf(form);
    const titleOf = (b: HTMLInputElement) => b.closest('[data-scope-page]')?.getAttribute('data-name') ?? b.closest('[data-scope-group]')?.querySelector('[data-scope-name]')?.textContent?.trim() ?? b.value;
    const line = scope.querySelector('[data-scope-line]');
    if (line) line.textContent = scopeLine(sections.map(titleOf), pages.map(titleOf));
  };

  /** Find: a section that matches shows whole; otherwise only its pages that match. Groups open while finding. */
  const find = (q: string) => {
    finding = !!q;
    let any = false;
    for (const g of groups()) {
      const whole = !q || (g.dataset.title ?? '').includes(q);
      let pages = 0;
      for (const li of g.querySelectorAll<HTMLElement>('[data-scope-page]')) {
        li.hidden = !whole && !(li.dataset.title ?? '').includes(q);
        if (!li.hidden) pages++;
      }
      g.hidden = !whole && pages === 0;
      g.open = q ? !g.hidden : g.hasAttribute('data-open');
      if (!g.hidden) any = true;
    }
    const none = scope.querySelector<HTMLElement>('[data-scope-nomatch]');
    if (none) none.hidden = any;
  };

  form.addEventListener(
    'input',
    (e) => {
      const t = e.target as HTMLInputElement;
      if (t.closest('[data-scope-find]')) find(t.value.trim().toLowerCase());
    },
    { signal },
  );
  form.addEventListener(
    'change',
    (e) => {
      if ((e.target as HTMLInputElement).type === 'checkbox') sync();
    },
    { signal },
  );
  // a group opened or closed by hand stays so once Find is cleared
  for (const g of groups()) g.addEventListener('toggle', () => !finding && g.toggleAttribute('data-open', g.open), { signal });
  sync();
  return sync;
}

export function initGrantDetails(root: HTMLElement, signal: AbortSignal) {
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => el.addEventListener(type, fn, { signal });
  const id = root.dataset.grantDetails ?? '';
  if (id === 'none') return;
  const form = root.querySelector<HTMLFormElement>('[data-grant-form]');
  const issue = root.querySelector<HTMLElement>('[data-grant-issue]');
  const save = root.querySelector<HTMLButtonElement>('[data-grant-save]');
  const discard = root.querySelector<HTMLButtonElement>('[data-grant-discard]');
  const name = root.dataset.name ?? '';
  const sync = form ? initScope(form, signal) : () => {};

  const say = (text: string, focus?: HTMLElement | null) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
    focus?.focus();
  };
  const failed = (issues: Issue[] | undefined, fallback: string) => {
    const text = (issues ?? []).map(describeIssue).join('; ') || fallback;
    saveStatus.failed(`Not saved: ${text}`);
    say(text);
    const field = (issues ?? []).map((i) => i.path).find(Boolean);
    const where = field === 'recipient.name' ? 'name' : field === 'expires' ? 'expires' : '';
    if (where) form?.querySelector<HTMLElement>(`[name="${where}"]`)?.focus();
  };

  // ---------- Copy ----------
  on(root, 'click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-grant-copy]');
    if (!b) return;
    const what = b.dataset.grantCopy!;
    const text = root.querySelector(`[data-grant-text="${what}"]`)?.textContent?.trim() ?? '';
    void copy(text, what === 'message' ? 'Message' : root.dataset.kind === 'link' ? 'Link' : 'Code');
  });

  // ---------- Save, Discard, Share it ----------
  if (form) {
    const dirty = (e: Event) => {
      if ((e.target as HTMLInputElement).type === 'search') return;
      if (save) save.disabled = false;
      if (discard) discard.disabled = false;
    };
    on(form, 'input', dirty);
    on(form, 'change', dirty);
    on(form, 'reset', () =>
      // the browser puts the fields back after this event: then the covered pages, the buttons and the status
      window.setTimeout(() => {
        sync();
        if (save) save.disabled = true;
        if (discard) discard.disabled = true;
        delete form.dataset.unsaved;
        say('');
        saveStatus.clean();
      }, 0),
    );
    on(form, 'submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const s = (k: string) => String(f.get(k) ?? '').trim();
      const withdrawn = root.hasAttribute('data-withdrawn');
      const { sections, pages } = scopeOf(form);
      const scope = { sections: sections.map((b) => b.value), pages: pages.map((b) => b.value) };
      if (!withdrawn && !s('name')) return say('Say who it’s for: their name.', form.querySelector<HTMLElement>('[name="name"]'));
      if (!withdrawn && !scope.sections.length && !scope.pages.length) return say('Choose what it opens: a section or a page.', form.querySelector<HTMLElement>('[data-scope-find] input'));
      say('');
      const recipient = { name: s('name'), organisation: s('organisation'), role: s('role'), email: s('email') };
      saveStatus.saving();

      if (id === 'new') {
        const kind = s('kind') === 'link' ? 'link' : 'code';
        const r = await api<{ grant?: { id: string } }>('POST', 'access/grants', { kind, recipient, purpose: s('purpose'), scope, expires: s('expires') || null, notes: s('notes') });
        if (!r.ok || !r.data.grant) return failed(r.data.issues, 'It wasn’t made: try again.');
        delete form.dataset.unsaved;
        saveStatus.saved(kind === 'code' ? 'Access code made' : 'Magic link made');
        history.pushState(history.state, '', urlFor(r.data.grant.id));
        // drawn once with its message ready to copy; the address stays an ordinary one
        const made = urlFor(r.data.grant.id);
        made.searchParams.set('made', '1');
        await redraw(made.href);
        document.getElementById('grant-copy-message')?.focus();
        return;
      }

      const body = withdrawn ? { purpose: s('purpose'), notes: s('notes') } : { recipient, purpose: s('purpose'), notes: s('notes'), scope, expires: s('expires') || null };
      const r = await api('PUT', `access/grants/${id}`, body);
      if (!r.ok) return failed(r.data.issues, 'The changes weren’t saved: try again.');
      delete form.dataset.unsaved;
      saveStatus.saved(`Saved ${s('name') || name}`);
      await redraw(location.href);
      document.getElementById('grant-save')?.focus({ preventScroll: true });
    });
  }

  // ---------- Withdraw now, Delete ----------
  on(root, 'click', async (e) => {
    const t = e.target as Element;
    const withdraw = t.closest('[data-grant-withdraw]');
    const remove = t.closest('[data-grant-delete]');
    if (!withdraw && !remove) return;
    t.closest('dialog')?.close();
    saveStatus.saving();
    if (withdraw) {
      const r = await api('POST', `access/grants/${id}/withdraw`);
      if (!r.ok) return failed(r.data.issues, 'It wasn’t withdrawn: try again.');
      saveStatus.saved('Withdrawn: save to remote to make it take effect');
      await redraw(location.href);
      return;
    }
    const r = await api('DELETE', `access/grants/${id}`);
    if (!r.ok) return failed(r.data.issues, 'It wasn’t deleted: try again.');
    saveStatus.saved(`Deleted ${name}’s access: save to remote to make it take effect`);
    // the screen then shows the first one left (or what to do with none)
    const url = urlFor('');
    history.replaceState(history.state, '', url);
    await redraw(url.href);
    document.querySelector<HTMLElement>('[data-access-item] [aria-current="true"], .list-head [data-access-go="new"]')?.focus();
  });
}
