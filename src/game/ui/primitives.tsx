/**
 * The game UI's controls (design-system.md §4.1): every button and key cap in the game is one of these,
 * so its anatomy (the `.btn` family in components.css), its accessible name and its states live in one
 * place. The containers the on-demand screens use (`Dialog`, `Panel`, `ScrollArea`) are in `overlays.tsx`.
 * These sit in the initial bundle, a few bytes under its 450 KB budget (scripts/size-report.mjs): keep
 * them tiny, and import nothing but React's runtime and `Icon`.
 */
import type { ComponentPropsWithRef } from 'react';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  /** `default` (the soft surface), `primary` (the accent: one per view) or `bare` (no `.btn`: a slot, a tile, the compass, a swatch, which bring their own anatomy in `className`). */
  variant?: 'default' | 'primary' | 'bare';
};

export type IconButtonProps = Omit<ButtonProps, 'aria-label' | 'variant' | 'children'> & {
  /** Its accessible name (`aria-label`): required, as the icon says nothing to assistive tech. */
  label: string;
  /** The Font Awesome Free solid icon it shows (through `Icon`, `aria-hidden`). */
  icon: IconDefinition;
  /** A pill (a panel's head buttons, the quantity steppers) rather than the square `.icon-btn`. */
  pill?: boolean;
};

/**
 * A button: a verb-first label, an optional `Icon` and an optional `KeyCap` (design-system.md §4, §7).
 * `type="button"` unless told otherwise. States are the native ones: `disabled` (can't be used),
 * `aria-disabled` (unavailable or busy, but focusable, so a click can say why: the crafting button),
 * `aria-pressed` (a toggle), `aria-expanded` (a popover's button).
 */
export function Button({ variant, className, ...rest }: ButtonProps) {
  return <button type="button" {...rest} className={variant === 'bare' ? className : `btn${variant === 'primary' ? ' primary' : ''}${className ? ` ${className}` : ''}`} />;
}

/**
 * A button whose face is only an icon: named by `label`, square (`.icon-btn`) unless `pill`. One that
 * also shows its key (an icon and a `KeyCap`: Stop talking, Close the palette) is a `Button` with an
 * `aria-label`.
 */
export function IconButton({ label, icon, pill, className, ...rest }: IconButtonProps) {
  return (
    <Button {...rest} aria-label={label} className={pill ? className : `icon-btn${className ? ` ${className}` : ''}`}>
      <Icon icon={icon} />
    </Button>
  );
}

/** A key cap: the `kbd` element, a key the player can press, after the action it does. Never the only label. */
export const KeyCap = 'kbd';
