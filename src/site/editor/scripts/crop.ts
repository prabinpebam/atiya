/**
 * The crop dialog (documentation/editor/spec.md §6.1): opened by a screen with openCrop, it loads what the
 * picture is cut from (a cropped copy's original, so a copy can grow back), shows the box where the crop
 * is (or the largest of the use's shape), and moves and resizes it: dragging the box or a handle, a press
 * elsewhere on the picture (the box centres there), the arrow keys, + and −, Home, Shape and Size. Save asks
 * the server to cut (never the original) and hands the picture that now shows the crop to the screen.
 */
import { api, announce, describeIssue } from './client';
import { centreOn, largest, move, ratioLabel, ratioOfShape, resize, resizeTo, sizeOf, whole, withRatio, type Bounds, type Handle, type Rect } from '../model/crop';
import { specTip, type PictureSpec } from '../../design/pictures';

export interface CropRequest {
  /** The picture to crop. */
  id: string;
  /** What it's cropped for: its shape comes first, and its tip and size show. */
  use?: PictureSpec;
  /** Always a new copy, even of a cropped copy (another use, another shape). */
  copy?: boolean;
  /** Called with the picture that now shows the crop: a new copy's ID, or the same one, updated. */
  onSaved: (id: string) => void;
}

/** A picture not uploaded yet (the upload form's): the crop is only chosen here, and goes with the upload. */
export interface LocalCropRequest {
  /** The chosen file, shown (an object URL), and its size as the browser shows it. */
  local: { src: string; width: number; height: number };
  /** The crop chosen before, to start from. */
  rect?: Rect | null;
  /** Called with the crop, in the picture's pixels as shown. */
  onCrop: (rect: Rect) => void;
}

let opener: ((r: CropRequest | LocalCropRequest) => void) | null = null;

/** Opens the screen's crop dialog on a picture, or on a file about to be uploaded. */
export const openCrop = (r: CropRequest | LocalCropRequest) => opener?.(r);

/** Whether the screen has a crop dialog. */
export const canCrop = () => opener !== null;

interface Source {
  id: string;
  src: string;
  srcset: string;
  width: number;
  height: number;
}

export function initCrop(root: HTMLElement, signal: AbortSignal) {
  const dialog = root.closest('dialog');
  const frame = root.querySelector<HTMLElement>('[data-crop-frame]');
  const img = root.querySelector<HTMLImageElement>('[data-crop-img]');
  const box = root.querySelector<HTMLElement>('[data-crop-box]');
  const shapeSelect = root.querySelector<HTMLElement>('[data-crop-shape]');
  const sizeInput = root.querySelector<HTMLInputElement>('[data-crop-size] input');
  const readout = root.querySelector<HTMLElement>('[data-crop-readout]');
  const warn = root.querySelector<HTMLElement>('[data-crop-warn]');
  const note = root.querySelector<HTMLElement>('[data-crop-note]');
  const tip = root.querySelector<HTMLElement>('[data-crop-for]');
  const issue = root.querySelector<HTMLElement>('[data-crop-issue]');
  const save = dialog?.querySelector<HTMLButtonElement>('[data-crop-save]');
  const reset = dialog?.querySelector<HTMLButtonElement>('[data-crop-reset]');
  if (!dialog || !frame || !img || !box || !shapeSelect || !sizeInput || !readout || !save) return;
  const on = (el: EventTarget, type: string, fn: (e: Event) => void) => el.addEventListener(type, fn, { signal });

  let req: CropRequest | LocalCropRequest | null = null;
  let b: Bounds = { width: 1, height: 1 };
  let rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  let shape = 'free';
  let first = 'free';
  // a value set from here, not by the person: the controls' own events ignore it
  let quiet = false;
  const ratio = () => ratioOfShape(shape, b);

  const say = (text: string) => {
    if (!issue) return;
    issue.textContent = text;
    issue.hidden = !text;
  };

  const render = (fromSlider = false) => {
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    frame.style.setProperty('--l', pct(rect.x, b.width));
    frame.style.setProperty('--t', pct(rect.y, b.height));
    frame.style.setProperty('--r', pct(rect.x + rect.width, b.width));
    frame.style.setProperty('--b', pct(rect.y + rect.height, b.height));
    const w = whole(rect, b);
    readout.textContent = `${w.width} × ${w.height} px (${ratioLabel(w.width, w.height)}), from ${b.width} × ${b.height}`;
    if (warn) {
      const use = req && 'id' in req ? req.use : undefined;
      const small = !!use && w.width < use.width;
      warn.hidden = !small;
      warn.textContent = small ? `It may look soft: the ${use!.label.toLowerCase()} shows up to ${use!.width} px wide. A larger original helps.` : '';
    }
    if (!fromSlider) {
      quiet = true;
      sizeInput.value = String(Math.round(sizeOf(rect, b) * 100));
      sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
      quiet = false;
    }
  };

  const setShape = (next: string, reshape = true) => {
    shape = next;
    quiet = true;
    shapeSelect.dispatchEvent(new CustomEvent('select-set', { detail: { value: next } }));
    quiet = false;
    if (reshape) rect = withRatio(rect, b, ratio());
  };

  opener = async (r) => {
    req = r;
    say('');
    save.disabled = true;
    if ('local' in r) {
      b = { width: r.local.width, height: r.local.height };
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = r.local.src;
      if (tip) tip.hidden = true;
      if (note) note.textContent = 'The crop is cut when the picture is uploaded. The file on your computer stays as it is.';
      first = 'free';
      setShape('free', false);
      rect = r.rect ? withRatio(r.rect, b) : largest(b, ratio());
      render();
      if (!dialog.open) dialog.showModal();
      save.disabled = false;
      requestAnimationFrame(() => box.focus({ preventScroll: true }));
      return;
    }
    const got = await api<{ source: Source; rect: Rect | null; isCopy: boolean }>('GET', `media/${r.id}/crop`);
    if (!got.ok) {
      announce(`Can't crop it: ${(got.data.issues ?? []).map(describeIssue).join(' ') || 'the picture wasn\u2019t found.'}`, 'negative');
      return;
    }
    const { source, rect: saved, isCopy } = got.data;
    b = { width: source.width, height: source.height };
    img.srcset = source.srcset;
    // as wide as the dialog shows it, at most
    img.sizes = 'min(100vw, 64rem)';
    img.src = source.src;
    if (tip) {
      tip.hidden = !r.use;
      const t = r.use ? specTip(r.use) : '';
      tip.textContent = r.use ? `${r.use.label}: ${t[0].toLowerCase()}${t.slice(1)}` : '';
    }
    if (note) {
      note.textContent =
        isCopy && !r.copy
          ? 'Saving cuts this cropped copy again from its original, and every page that uses it shows the new crop. The original stays as it is.'
          : 'Saving makes a cropped copy beside the original, with its details. The original stays as it is.';
    }
    // a copy opens where it was cut, in its own shape; anything else at the use's shape, as large as it goes
    const own = saved && ['1/1', '4/5', '3/2', '4/3', '16/9', '21/9'].find((s) => Math.abs(saved.width / saved.height / ratioOfShape(s, b)! - 1) <= 0.01);
    first = r.use?.ratio ?? 'free';
    setShape(saved ? (r.use?.ratio ?? own ?? 'free') : first, false);
    rect = saved ? withRatio(saved, b, r.use ? ratio() : undefined) : largest(b, ratio());
    render();
    if (!dialog.open) dialog.showModal();
    save.disabled = false;
    // the crop area first, ready for the keys (after the dialog's own start in its first field)
    requestAnimationFrame(() => box.focus({ preventScroll: true }));
  };

  // ---------- the controls ----------
  on(shapeSelect, 'select-change', (e) => {
    if (quiet) return;
    shape = (e as CustomEvent<{ value: string }>).detail.value;
    rect = withRatio(rect, b, ratio());
    render();
  });
  on(sizeInput, 'input', () => {
    if (quiet) return;
    rect = resizeTo(rect, Number(sizeInput.value) / 100, b);
    render(true);
  });
  if (reset)
    on(reset, 'click', () => {
      setShape(first, false);
      rect = largest(b, ratio());
      render();
    });

  // ---------- the keys, on the box ----------
  on(box, 'keydown', (e) => {
    const k = e as KeyboardEvent;
    const step = k.shiftKey ? 0.1 : 0.01;
    const by: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (by[k.key]) rect = move(rect, by[k.key][0] * b.width * step, by[k.key][1] * b.height * step, b);
    else if (k.key === '+' || k.key === '=') rect = resizeTo(rect, sizeOf(rect, b) + 0.05, b);
    else if (k.key === '-' || k.key === '_') rect = resizeTo(rect, sizeOf(rect, b) - 0.05, b);
    else if (k.key === 'Home') rect = centreOn(rect, b.width / 2, b.height / 2, b);
    else return;
    k.preventDefault();
    render();
  });

  // ---------- the pointer: the box moves, a handle resizes, a press elsewhere centres it there ----------
  on(frame, 'pointerdown', (e) => {
    const pe = e as PointerEvent;
    if (pe.button !== 0) return;
    pe.preventDefault();
    const t = pe.target as Element;
    const handle = t.closest<HTMLElement>('[data-handle]')?.dataset.handle as Handle | undefined;
    const box0 = frame.getBoundingClientRect();
    const k = box0.width / b.width;
    if (!handle && !t.closest('[data-crop-box]')) {
      rect = centreOn(rect, (pe.clientX - box0.left) / k, (pe.clientY - box0.top) / k, b);
      render();
    }
    const start = rect;
    const sx = pe.clientX;
    const sy = pe.clientY;
    frame.setPointerCapture(pe.pointerId);
    box.dataset.active = '';
    box.focus({ preventScroll: true });
    const moveTo = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / k;
      const dy = (ev.clientY - sy) / k;
      rect = handle ? resize(start, handle, dx, dy, b, ratio()) : move(start, dx, dy, b);
      render();
    };
    const end = () => {
      frame.removeEventListener('pointermove', moveTo);
      frame.removeEventListener('pointerup', end);
      frame.removeEventListener('pointercancel', end);
      delete box.dataset.active;
    };
    frame.addEventListener('pointermove', moveTo, { signal });
    frame.addEventListener('pointerup', end, { signal });
    frame.addEventListener('pointercancel', end, { signal });
  });

  // ---------- Save: the server cuts; the screen uses what it made ----------
  on(save, 'click', async () => {
    if (!req) return;
    const r = req;
    if ('local' in r) {
      const cut = whole(rect, b);
      announce(`The crop is ${cut.width} × ${cut.height}`);
      dialog.close();
      return r.onCrop(cut);
    }
    save.disabled = true;
    say('');
    announce('Cropping\u2026');
    const res = await api<{ id: string; width: number; height: number }>('POST', `media/${r.id}/crop`, { rect: whole(rect, b), copy: !!r.copy });
    save.disabled = false;
    if (!res.ok) {
      const why = (res.data.issues ?? []).map(describeIssue).join(' ') || "The crop wasn't saved.";
      announce(`Not saved: ${why}`, 'negative');
      return say(why);
    }
    announce(`Cropped to ${res.data.width} × ${res.data.height}`);
    dialog.close();
    r.onSaved(res.data.id);
  });
  on(dialog, 'close', () => {
    req = null;
  });
}
