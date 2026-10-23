/**
 * The gallery's setup (documentation/gallery/spec.md §9.1): its title, description and order of albums saved
 * together; the Section choice (with more than one gallery) shows another gallery's setup and albums.
 */
import { api, describeIssue, saveStatus, startTask, swapRegions } from './client';

/** Wires one gallery setup (`root`, the GallerySetup part). */
export function initGallerySetup(root: HTMLElement, signal: AbortSignal) {
  const form = root.querySelector<HTMLFormElement>('form[data-gallery-form]');
  const id = root.dataset.gallerySetup;
  if (!form || !id) return;

  root.querySelector('[data-gallery-section]')?.addEventListener(
    'select-change',
    (e) => {
      const url = new URL(location.href);
      url.searchParams.set('gallery', (e as CustomEvent<{ value: string }>).detail.value);
      location.href = url.href;
    },
    { signal },
  );

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const settings = { title: String(data.get('title') ?? ''), summary: String(data.get('summary') ?? ''), order: String(data.get('order') ?? 'newest'), rounded: data.get('rounded') === 'on' };
      saveStatus.saving();
      const task = startTask('Saving the gallery…', { el: root.querySelector('[data-gallery-save]') });
      const r = await api('PUT', `gallery/${id}`, { settings, version: root.dataset.version || null });
      if (!r.ok) {
        task.failed();
        saveStatus.failed(r.data.issues?.map(describeIssue).join(' ') || "Couldn't save the gallery");
        return;
      }
      void task.done();
      saveStatus.saved('Gallery saved');
      await swapRegions(['album-list', 'gallery-setup']);
    },
    { signal },
  );
}
