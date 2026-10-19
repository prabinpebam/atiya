/**
 * The game UI's containers (design-system.md §4.1): the modal dialog, the wood panel and the thin
 * scroller. Only the screens that load on demand use them (the menu, the reading overlay, Chopper's card,
 * the backpack, the crafting chunk), so they live apart from `primitives.tsx` and stay out of the initial
 * bundle: never import this module from it.
 */
import { createElement, useEffect, useRef, type ComponentPropsWithRef, type ReactNode, type Ref } from 'react';
import { spaceBack } from '../input/keyboard';
import './styles/dialog.css';
import './styles/panel.css';
import './styles/scroll-area.css';

const cx = (...c: unknown[]) => c.filter(Boolean).join(' ');

type DataProps = { [k: `data-${string}`]: string | number | boolean | undefined };

export type DialogProps = Omit<ComponentPropsWithRef<'dialog'>, 'open' | 'ref'> & {
  /** Whether it's showing: the native dialog is opened modally (`showModal`: focus trapped, then given back) and closed in step. */
  open: boolean;
  /** Asked to close: by Esc (the `cancel` event), Space (the `back` key, §6.7) or, unless `bare`, a press on the backdrop. */
  onDismiss: () => void;
  /** No `.dialog` sheet: the caller's `className` is its whole anatomy (the reading overlay). */
  bare?: boolean;
};

/**
 * A modal dialog over the planet (native `<dialog>`, the browser's top layer). Name it with
 * `aria-labelledby` or `aria-label`. A caller's own `onKeyDown` runs first: if it handles a key
 * (`preventDefault`), Space doesn't close.
 */
export function Dialog({ open, onDismiss, bare, className, onCancel, onKeyDown, onClick, ...rest }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      {...rest}
      ref={ref}
      className={cx(!bare && 'dialog', className)}
      onCancel={(e) => {
        onCancel?.(e);
        e.preventDefault();
        onDismiss();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || !spaceBack(e)) return;
        e.preventDefault();
        onDismiss();
      }}
      onClick={(e) => {
        onClick?.(e);
        if (!bare && e.target === e.currentTarget) onDismiss();
      }}
    />
  );
}

export type PanelProps = ComponentPropsWithRef<'div'> & {
  /** The wood backdrop's own props: its test id, and the handlers that catch a press outside the panel. */
  backdrop?: Omit<ComponentPropsWithRef<'div'>, 'className'> & DataProps;
  /** What floats over the backdrop beside the panel (a tooltip, the held stack). */
  outside?: ReactNode;
};

/**
 * A wood panel on the overlay layer (the backpack, the chest, the crafting table, the palette): a modal
 * `role="dialog"` on its `.surface-wood` backdrop, at a fixed size. Name it with `aria-label` or
 * `aria-labelledby`; its keys go in `onKeyDown`.
 */
export function Panel({ backdrop, outside, className, children, ...rest }: PanelProps) {
  return (
    <div {...backdrop} className="inv-backdrop surface-wood">
      <div {...rest} className={cx('inv-panel', className)} role="dialog" aria-modal="true">
        {children}
      </div>
      {outside}
    </div>
  );
}

export type ScrollAreaProps = Omit<ComponentPropsWithRef<'div'>, 'ref'> & {
  /** The element it is (a list scrolls as a `ul`). */
  as?: 'div' | 'ul';
  /** Its element, for the caller to focus or measure (a `ul` or a `div`, as `as` says). */
  ref?: Ref<HTMLElement>;
};

/** A scroller with the thin scrollbar that reads on wood and paper (`.scroll-thin`, `--c-scrollbar`). */
export function ScrollArea({ as = 'div', className, ...rest }: ScrollAreaProps) {
  return createElement(as, { ...rest, className: cx(className, 'scroll-thin') });
}
