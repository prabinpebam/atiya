/**
 * The gallery's views, in order (./Gallery.tsx draws each; tests/e2e/visual-game.spec.ts screenshots each, on paper and
 * wood at three widths). Data only, so the screenshot test can read it without React.
 */
export const GALLERY_VIEWS = [
  { id: 'controls', title: 'Controls' },
  { id: 'hud', title: 'The HUD' },
  { id: 'seated', title: 'Seated: two choices' },
  { id: 'preview', title: 'Preview card' },
  { id: 'talk', title: 'Talk box' },
  { id: 'site', title: 'Site card' },
  { id: 'hotbar', title: 'Hotbar and view controls' },
  { id: 'dialog', title: 'Dialog' },
  { id: 'panel', title: 'Panel' },
  { id: 'menu', title: 'Menu' },
  { id: 'help', title: 'How to play' },
  { id: 'travel', title: 'Fast travel' },
  { id: 'backpack', title: 'Backpack' },
  { id: 'chest', title: 'Chest' },
  { id: 'craft', title: 'Crafting table' },
  { id: 'furnace', title: 'Furnace' },
  { id: 'paint', title: 'Paint' },
  { id: 'reading', title: 'Reading overlay' },
  { id: 'lost', title: 'Lost view' },
  { id: 'chopper', title: 'Chopper’s card', residents: true },
] as const;

/** A view's name. */
export type GalleryView = (typeof GALLERY_VIEWS)[number]['id'];
