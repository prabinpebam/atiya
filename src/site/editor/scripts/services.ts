/**
 * Edit mode's Contact and Visitor counts cards (desktop spec §9.5, plan stage 11.6): choosing an option shows
 * its steps and field, a value is checked as it's typed, and Save writes content/site.json's `services`
 * through the store (model/services.ts makes the settings).
 */
import { api, refused, saveStatus, swapRegions } from './client';
import { dashboardOf, valueIssue, withContact, withCounts, type ServiceChoice } from '../model/services';
import { fits, shapeText } from '../../services/services';
import type { SiteSettings } from '../../content/schema';

interface State {
  site: SiteSettings;
  siteVersion: string;
  address: string;
  choices: { contact: ServiceChoice[]; counts: ServiceChoice[] };
}

export function initServices(root: HTMLElement, signal: AbortSignal) {
  const state = JSON.parse(root.querySelector('[data-services-state]')?.textContent ?? '{}') as State;
  const groupOf = (form: HTMLFormElement) => form.dataset.servicesForm as 'contact' | 'counts';
  const choiceOf = (form: HTMLFormElement, id: string) => state.choices[groupOf(form)].find((c) => c.id === id);
  const chosen = (form: HTMLFormElement) => (form.querySelector<HTMLInputElement>('input[name="option"]:checked')?.value ?? '');
  const say = (form: HTMLFormElement, text: string) => {
    const p = form.querySelector<HTMLElement>('[data-editor-form-issue]')!;
    p.textContent = text;
    p.hidden = !text;
  };
  const fieldError = (input: HTMLInputElement, text: string | null) => {
    const err = input.closest('[data-services-value], [data-services-clarity]')?.querySelector<HTMLElement>('[data-field-error]');
    const words = err?.querySelector<HTMLElement>('[data-field-error-text]');
    if (!err || !words) return;
    words.textContent = text ?? '';
    err.hidden = !text;
    if (text) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), err.id].filter(Boolean).join(' '));
    } else {
      input.removeAttribute('aria-invalid');
      const rest = (input.getAttribute('aria-describedby') ?? '').split(' ').filter((t) => t && t !== err.id);
      if (rest.length) input.setAttribute('aria-describedby', rest.join(' '));
      else input.removeAttribute('aria-describedby');
    }
  };
  const valueInput = (form: HTMLFormElement, id: string) => form.querySelector<HTMLInputElement>(`input[name="value-${CSS.escape(id)}"]`);

  root.addEventListener(
    'change',
    (e) => {
      const input = e.target as HTMLInputElement;
      const form = input.closest<HTMLFormElement>('form[data-services-form]');
      if (!form || input.name !== 'option') return;
      for (const el of form.querySelectorAll<HTMLElement>('[data-services-option]')) el.hidden = el.dataset.servicesOption !== input.value;
      const extra = form.querySelector<HTMLElement>('[data-services-extra]');
      if (extra) extra.hidden = input.value === 'none';
      form.dataset.unsaved = '';
      saveStatus.dirty(`${form.dataset.servicesForm === 'contact' ? 'Contact' : 'Visitor counts'} changed: save to keep it`);
    },
    { signal },
  );

  // a value is checked as it's typed, once it has something to check
  root.addEventListener(
    'input',
    (e) => {
      const input = e.target as HTMLInputElement;
      const form = input.closest<HTMLFormElement>('form[data-services-form]');
      if (!form) return;
      form.dataset.unsaved = '';
      saveStatus.dirty('Not saved yet');
      const id = input.name.startsWith('value-') ? input.name.slice(6) : null;
      const v = input.value.trim();
      if (id) {
        const c = choiceOf(form, id);
        fieldError(input, c && v ? valueIssue(c, v) : null);
        // the dashboard's address follows a GoatCounter code
        const dash = input.closest('[data-services-option]')?.querySelector<HTMLAnchorElement>('[data-services-dashboard]');
        if (c && dash) dash.href = dashboardOf(c, v) ?? dash.href;
      } else if (input.name === 'clarity') fieldError(input, v && !fits('clarity', v) ? `That doesn't look right: ${shapeText('clarity')}` : null);
    },
    { signal },
  );

  root.addEventListener(
    'submit',
    async (e) => {
      const form = e.target as HTMLFormElement;
      if (!form.matches('[data-services-form]')) return;
      e.preventDefault();
      say(form, '');
      const id = chosen(form);
      const value = valueInput(form, id)?.value ?? '';
      const d = new FormData(form);
      const r = groupOf(form) === 'contact' ? withContact(state.site, id, value) : withCounts(state.site, id, value, String(d.get('address') ?? ''), String(d.get('clarity') ?? ''));
      if ('issue' in r) {
        say(form, r.issue);
        (valueInput(form, id) ?? form.querySelector<HTMLInputElement>('input[name="option"]:checked'))?.focus();
        return;
      }
      saveStatus.saving();
      const res = await api('PUT', 'site', { site: r.site, ifMatch: { '/content/site.json': state.siteVersion } });
      if (!res.ok) {
        const why = refused(res, "The settings weren't saved.");
        saveStatus.failed(`Not saved: ${why}`);
        return say(form, res.status === 409 ? 'This file changed elsewhere since you opened it. Reload the page to see it, then make your change again.' : why);
      }
      await swapRegions(['services', 'settings']);
      saveStatus.saved(groupOf(form) === 'contact' ? 'Saved contact' : 'Saved visitor counts');
    },
    { signal },
  );
}
