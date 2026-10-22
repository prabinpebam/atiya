/**
 * The choices an upload form offers for the file chosen (gallery spec §4, §4.1), in the media library's
 * upload and a picture's Replace: an SVG kept as a drawing or turned into a picture (`[data-upload-svg]`,
 * radios named `svgAs`), Keep it large for a still picture past 2560 px (`[data-upload-large]`, a checkbox
 * named `large`), and a note before saving (`[data-upload-note]`: an animated PNG kept as a still). A choice
 * not offered is hidden and its inputs disabled, so the form never sends it.
 */
import { uploadOptions } from '../model/upload';

/** What's known of the file chosen, or null when there's none (every choice hidden). */
export type ChosenFacts = Parameters<typeof uploadOptions>[0];

const inputsOf = (el: Element | null) => [...(el?.querySelectorAll<HTMLInputElement>('input') ?? [])];

/** Shows the choices this file offers, each at its default, and hides the rest. */
export function showUploadOptions(form: HTMLElement, facts: ChosenFacts | null) {
  const o = facts ? uploadOptions(facts) : { svg: null, large: false };
  const svgBox = form.querySelector<HTMLElement>('[data-upload-svg]');
  if (svgBox) {
    svgBox.hidden = !o.svg;
    for (const r of inputsOf(svgBox)) {
      r.disabled = !o.svg || (r.value === 'drawing' && !o.svg.drawing);
      r.checked = !!o.svg && r.value === o.svg.default;
    }
    const why = svgBox.querySelector<HTMLElement>('[data-upload-svg-why]');
    if (why) why.hidden = !o.svg || o.svg.drawing;
  }
  const largeBox = form.querySelector<HTMLElement>('[data-upload-large]');
  if (largeBox) {
    const was = largeBox.hidden;
    largeBox.hidden = !o.large;
    for (const c of inputsOf(largeBox)) {
      c.disabled = !o.large;
      // offered again: it starts as drawn (a picture kept large keeps the choice when it's replaced)
      if (!o.large) c.checked = false;
      else if (was) c.checked = c.defaultChecked;
    }
  }
}

/** The SVG is to be kept as a drawing (offered and chosen). */
export const keptAsDrawing = (form: HTMLElement) => !!form.querySelector<HTMLInputElement>('[data-upload-svg]:not([hidden]) input[value="drawing"]:checked:not(:disabled)');

/** Says something about the file before it's saved (or nothing, with ''). */
export function uploadNote(form: HTMLElement, text: string) {
  const note = form.querySelector<HTMLElement>('[data-upload-note]');
  if (!note) return;
  note.textContent = text;
  note.hidden = !text;
}

/** A picture file's size, as this browser reads it (0 × 0 when it can't: an SVG without a size, a TIFF). */
export async function sizeOf(file: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
