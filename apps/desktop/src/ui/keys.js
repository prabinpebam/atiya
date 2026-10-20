// An AI service's key (documentation/editor/ai-services.md §6.1): edit mode asks for one, the main process raises
// the frame and opens this dialog over edit mode, and what's typed goes to the main process alone, which keeps it
// encrypted. Edit mode hears only whether a key was saved.

export function initKeys() {
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const dialog = $('keys');
  const title = $('keys-title');
  const input = /** @type {HTMLInputElement} */ ($('keys-input'));
  const error = $('keys-error');
  const save = /** @type {HTMLButtonElement} */ ($('keys-save'));
  const cancel = /** @type {HTMLButtonElement} */ ($('keys-cancel'));
  const k = window.atiya.keys;
  let busy = false;

  const say = (text) => {
    error.textContent = text;
    error.hidden = !text;
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const shut = () => {
    dialog.hidden = true;
    input.value = '';
    say('');
  };

  k.onOpen((/** @type {{ name: string }} */ ask) => {
    input.value = '';
    say('');
    title.textContent = `${ask.name}'s key`;
    dialog.hidden = false;
    input.focus();
  });

  /** @param {string | null} key the key, or null for Cancel */
  async function answer(key) {
    if (busy) return;
    if (key !== null && !key.trim()) {
      say('Paste its key first.');
      return input.focus();
    }
    busy = true;
    save.disabled = cancel.disabled = true;
    try {
      const r = await k.answer(key);
      if (key !== null && !r?.ok) {
        say(r?.error ?? "That key wasn't saved. Try again.");
        return input.focus();
      }
      shut();
    } finally {
      busy = false;
      save.disabled = cancel.disabled = false;
    }
  }

  save.addEventListener('click', () => answer(input.value));
  cancel.addEventListener('click', () => answer(null));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      answer(null);
    } else if (e.key === 'Enter' && e.target === input) {
      e.preventDefault();
      answer(input.value);
    } else if (e.key === 'Tab') {
      // modal: the keys stay in the dialog
      const stops = [input, cancel, save];
      const at = stops.indexOf(/** @type {any} */ (document.activeElement));
      const next = stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
      e.preventDefault();
      next.focus();
    }
  });
}
