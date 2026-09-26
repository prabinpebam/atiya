import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { faBriefcase, faDog } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../controller';
import { HOTBAR, type Slot } from '../inventory/inventory';
import { itemDef, stackLabel, type ItemId } from '../inventory/items';
import { ICONS } from '../inventory/iconManifest';
import { Icon } from './Icon';
import { withBase } from '../platform/base';

/** Minecraft-style hotbar and inventory / chest screens (docs: collection-inventory.md §4). */

const iconUrl = (id: ItemId) => {
  const url = ICONS[itemDef(id).icon]?.url;
  return url ? withBase(url) : undefined;
};

export function ItemIcon({ id }: { id: ItemId }) {
  const url = iconUrl(id);
  return url ? <img className="item-icon" src={url} alt="" width={40} height={40} draggable={false} decoding="async" /> : <span className="item-icon" />;
}

export function SlotFace({ stack }: { stack: Slot }) {
  if (!stack) return null;
  return (
    <>
      <ItemIcon id={stack.id} />
      {stack.n > 1 && <span className="slot-count">{stack.n}</span>}
    </>
  );
}

/** The always-on hotbar: 9 slots, the selection frame, the item name after a change, and the backpack button. */
export function Hotbar({ controller }: { controller: GameController }) {
  useStore(controller.store, (s) => s.invVersion);
  const visible = useStore(controller.store, (s) => s.phase === 'playing' && !s.invScreen);
  const inv = controller.inventory;
  const sel = inv.selected;
  const [label, setLabel] = useState<string | null>(null);
  const first = useRef(true);
  const selStack = inv.backpack[sel];
  const selKey = `${sel}:${selStack?.id ?? ''}`;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Minecraft shows the held item's name above the hotbar for a moment
    const st = controller.inventory.backpack[controller.inventory.selected];
    setLabel(st ? itemDef(st.id).name : null);
    const t = window.setTimeout(() => setLabel(null), 2000);
    return () => window.clearTimeout(t);
  }, [selKey, controller]);
  if (!visible) return null;
  return (
    <div className="hotbar-wrap surface-wood" data-testid="hotbar-wrap">
      {label && (
        <div className="hotbar-label" aria-hidden="true">
          {label}
        </div>
      )}
      <div className="hotbar" role="toolbar" aria-label="Hotbar" data-testid="hotbar" onWheel={(e) => controller.onWheel(e)}>
        {inv.backpack.slice(0, HOTBAR).map((st, i) => (
          <button
            key={i}
            type="button"
            className={`slot${i === sel ? ' selected' : ''}`}
            aria-pressed={i === sel}
            aria-label={`Hotbar slot ${i + 1}: ${st ? stackLabel(st.id, st.n) : 'empty'}`}
            data-slot={i}
            onClick={() => {
              controller.selectSlot(i);
              controller.focusRegion();
            }}
          >
            <SlotFace stack={st} />
            <span className="slot-key" aria-hidden="true">
              {i + 1}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="slot backpack-btn"
          aria-label="Open backpack (I)"
          data-testid="backpack-button"
          onClick={() => controller.openInventory('backpack')}
        >
          <Icon icon={faBriefcase} />
        </button>
        <button
          type="button"
          className="slot whistle-btn"
          aria-label="Whistle for Chopper (F)"
          title="Whistle for Chopper (F)"
          data-testid="whistle-button"
          onClick={() => {
            controller.whistle();
            controller.focusRegion();
          }}
        >
          <Icon icon={faDog} />
        </button>
      </div>
    </div>
  );
}

// the screen itself (slots, drag, keys) loads on demand, and is fetched in the background soon after the game starts
const InventoryPanel = lazy(() => import('./InventoryPanel'));
const loadPanel = () => import('./InventoryPanel');

/** The backpack screen, or the chest screen (chest above, backpack below). */
export function InventoryScreen({ controller }: { controller: GameController }) {
  const screen = useStore(controller.store, (s) => s.invScreen);
  useStore(controller.store, (s) => s.invVersion);
  useEffect(() => {
    const t = window.setTimeout(() => void loadPanel().catch(() => undefined), 1500);
    return () => window.clearTimeout(t);
  }, []);
  if (!screen) return null;
  return (
    <Suspense fallback={null}>
      <InventoryPanel controller={controller} screen={screen} />
    </Suspense>
  );
}
