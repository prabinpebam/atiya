import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from 'zustand';
import { faArrowsUpDownLeftRight, faBriefcase, faDog, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../controller';
import { BACKPACK_SLOTS, CHEST_SLOTS, HOTBAR, type Screen, type Slot, type SlotRef } from '../inventory/inventory';
import { itemDef, stackLabel, type ItemId } from '../inventory/items';
import { ICONS } from '../inventory/iconManifest';
import { Icon } from './Icon';

/** Minecraft-style hotbar and inventory / chest screens (docs: collection-inventory.md §4). */

const iconUrl = (id: ItemId) => ICONS[itemDef(id).icon]?.url;

export function ItemIcon({ id }: { id: ItemId }) {
  const url = iconUrl(id);
  return url ? <img className="item-icon" src={url} alt="" width={40} height={40} draggable={false} decoding="async" /> : <span className="item-icon" />;
}

function SlotFace({ stack }: { stack: Slot }) {
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
    <div className="hotbar-wrap" data-testid="hotbar-wrap">
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

type Section = { title: string; c: 'backpack' | 'chest'; from: number; to: number; id: string };

const LONG_PRESS_MS = 450;
const DOUBLE_MS = 300;

/** The backpack screen, or the chest screen (chest above, backpack below). */
export function InventoryScreen({ controller }: { controller: GameController }) {
  const screen = useStore(controller.store, (s) => s.invScreen);
  useStore(controller.store, (s) => s.invVersion);
  if (!screen) return null;
  return <InventoryPanel controller={controller} screen={screen} />;
}

function InventoryPanel({ controller, screen }: { controller: GameController; screen: Screen }) {
  const inv = controller.inventory;
  const sections = useMemo<Section[]>(
    () => [
      ...(screen === 'chest' ? [{ title: 'Chest', c: 'chest' as const, from: 0, to: CHEST_SLOTS, id: 'inv-chest' }] : []),
      { title: 'Backpack', c: 'backpack', from: HOTBAR, to: BACKPACK_SLOTS, id: 'inv-main' },
      { title: 'Hotbar', c: 'backpack', from: 0, to: HOTBAR, id: 'inv-hotbar' },
    ],
    [screen],
  );
  /** Every slot in reading order (for arrow keys). */
  const order = useMemo(() => sections.flatMap((s) => Array.from({ length: s.to - s.from }, (_, k) => ({ c: s.c, i: s.from + k }) as SlotRef)), [sections]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [moveMode, setMoveMode] = useState(false);
  const hovered = useRef<SlotRef | null>(null);
  const drag = useRef<{ button: number; refs: SlotRef[]; start: SlotRef } | null>(null);
  const lastClick = useRef<{ key: string; t: number } | null>(null);
  const press = useRef<number | undefined>(undefined);
  const cursor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const slotEls = useRef<Array<HTMLButtonElement | null>>([]);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const keyOf = (r: SlotRef) => `${r.c}:${r.i}`;

  const changed = (announceHeld = true) => {
    controller.invChanged();
    if (announceHeld) {
      const h = inv.held;
      controller.announce(h ? `Holding ${stackLabel(h.id, h.n)}.` : 'Hand empty.');
    }
  };

  // focus the first slot when the screen opens
  useEffect(() => {
    slotEls.current[0]?.focus({ preventScroll: true });
  }, []);

  const click = (r: SlotRef, button: 0 | 2, shift: boolean) => {
    if (shift || moveMode) {
      inv.shiftClick(r, screen);
      return changed(false);
    }
    const key = keyOf(r);
    const now = performance.now();
    if (button === 0 && inv.held && lastClick.current && lastClick.current.key === key && now - lastClick.current.t < DOUBLE_MS) {
      inv.doubleClick(screen);
      lastClick.current = null;
      return changed();
    }
    lastClick.current = button === 0 ? { key, t: now } : null;
    if (button === 0) inv.leftClick(r);
    else inv.rightClick(r);
    changed();
  };

  const onSlotDown = (r: SlotRef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    const button = e.button as 0 | 2;
    if (e.pointerType === 'touch' && button === 0 && !moveMode) {
      // touch: tap = left-click, long-press = right-click
      window.clearTimeout(press.current);
      press.current = window.setTimeout(() => {
        press.current = undefined;
        click(r, 2, false);
      }, LONG_PRESS_MS);
      drag.current = { button: 0, refs: [r], start: r };
      return;
    }
    if (inv.held && !e.shiftKey && !moveMode) {
      // holding a stack: a press starts a possible drag-to-spread; the release decides
      drag.current = { button, refs: [r], start: r };
      return;
    }
    click(r, button, e.shiftKey);
  };

  const onSlotEnter = (r: SlotRef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    hovered.current = r;
    const st = inv.get(r);
    const rect = e.currentTarget.getBoundingClientRect();
    setTip(st ? { text: itemDef(st.id).name, x: rect.left + rect.width / 2, y: rect.top } : null);
    const d = drag.current;
    if (d && !d.refs.some((x) => keyOf(x) === keyOf(r))) d.refs.push(r);
  };

  useEffect(() => {
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (press.current !== undefined) {
        // a short touch: a left-click
        window.clearTimeout(press.current);
        press.current = undefined;
        click(d.start, 0, false);
        return;
      }
      if (d.refs.length > 1) {
        inv.distribute(d.refs, d.button === 0);
        changed();
      } else if (inv.held) click(d.start, d.button as 0 | 2, false);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });

  // the cursor stack follows the pointer
  const onMove = (e: ReactPointerEvent) => {
    if (cursor.current) cursor.current.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
  };

  // click outside the panel with a stack held: throw it (left: all, right: one)
  const onBackdrop = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!inv.held) return;
    const st = inv.dropHeld(e.button === 0);
    if (st) controller.throwStack(st, true);
    changed();
  };

  const focusSlot = (idx: number) => {
    const k = Math.max(0, Math.min(order.length - 1, idx));
    setFocusIdx(k);
    slotEls.current[k]?.focus({ preventScroll: true });
    hovered.current = order[k];
  };

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const r = hovered.current ?? order[focusIdx];
    if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') {
      e.preventDefault();
      controller.closeInventory();
      return;
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      if (r) {
        inv.numberSwap(r, Number(e.code.slice(5)) - 1);
        changed(false);
      }
      return;
    }
    if (e.code === 'KeyQ') {
      e.preventDefault();
      if (r) {
        const st = inv.takeFrom(r, e.ctrlKey || e.metaKey ? Infinity : 1);
        if (st) controller.throwStack(st, true);
        changed(false);
      }
      return;
    }
    const idx = order.findIndex((x) => r && keyOf(x) === keyOf(r));
    if (e.code === 'ArrowRight') return (e.preventDefault(), focusSlot(idx + 1));
    if (e.code === 'ArrowLeft') return (e.preventDefault(), focusSlot(idx - 1));
    if (e.code === 'ArrowDown') return (e.preventDefault(), focusSlot(idx + 9));
    if (e.code === 'ArrowUp') return (e.preventDefault(), focusSlot(idx - 9));
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && r) {
      e.preventDefault();
      click(r, 0, e.shiftKey);
      return;
    }
    if (e.code === 'Space' && r) {
      e.preventDefault();
      click(r, 2, false);
    }
  };

  let flat = 0;
  const title = screen === 'chest' ? 'Chest' : 'Backpack';
  return (
    <div className="inv-backdrop" data-testid="inventory-screen" onPointerMove={onMove} onPointerDown={onBackdrop} onContextMenu={(e) => e.preventDefault()}>
      <div ref={panel} className="inv-panel" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey}>
        <div className="inv-head">
          <h2>{title}</h2>
          <button type="button" className={`btn inv-move${moveMode ? ' on' : ''}`} aria-pressed={moveMode} onClick={() => setMoveMode((m) => !m)} title="Taps move stacks between sections (like Shift+click)">
            <Icon icon={faArrowsUpDownLeftRight} /> Move
          </button>
          <button type="button" className="btn inv-close" aria-label="Close" onClick={() => controller.closeInventory()}>
            <Icon icon={faXmark} />
          </button>
        </div>
        {sections.map((sec) => (
          <section key={sec.id} className={`inv-section ${sec.id}`} aria-label={sec.title}>
            {sec.id !== 'inv-hotbar' && <h3>{sec.title}</h3>}
            <div className="inv-grid">
              {Array.from({ length: sec.to - sec.from }, (_, k) => {
                const r: SlotRef = { c: sec.c, i: sec.from + k };
                const st = inv.get(r);
                const idx = flat++;
                const name = `${sec.c === 'chest' ? 'Chest' : sec.id === 'inv-hotbar' ? 'Hotbar' : 'Backpack'} slot ${sec.id === 'inv-hotbar' ? r.i + 1 : sec.c === 'chest' ? r.i + 1 : r.i - HOTBAR + 1}`;
                return (
                  <button
                    key={keyOf(r)}
                    ref={(el) => {
                      slotEls.current[idx] = el;
                    }}
                    type="button"
                    className={`slot${sec.id === 'inv-hotbar' && r.i === inv.selected ? ' selected' : ''}`}
                    tabIndex={idx === focusIdx ? 0 : -1}
                    aria-label={`${name}: ${st ? stackLabel(st.id, st.n) : 'empty'}`}
                    data-slot={`${r.c}:${r.i}`}
                    onPointerDown={onSlotDown(r)}
                    onPointerEnter={onSlotEnter(r)}
                    onPointerLeave={() => {
                      hovered.current = null;
                      setTip(null);
                    }}
                    onFocus={(e) => {
                      setFocusIdx(idx);
                      hovered.current = r;
                      // keyboard: the held stack sits by the focused slot
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (cursor.current) cursor.current.style.transform = `translate(${rect.right - 26}px, ${rect.top - 18}px)`;
                    }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <SlotFace stack={st} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <p className="inv-help" aria-hidden="true">
          Click: take / place · Right-click: half / one · Shift+click: move · Double-click: gather · Drag: spread · 1–9: to hotbar · Q: drop
        </p>
      </div>
      {tip && !inv.held && (
        <div className="inv-tip" style={{ left: tip.x, top: tip.y } as CSSProperties} aria-hidden="true">
          {tip.text}
        </div>
      )}
      <div ref={cursor} className="inv-cursor" aria-hidden="true" data-testid="inventory-cursor">
        {inv.held && <SlotFace stack={inv.held} />}
      </div>
    </div>
  );
}
