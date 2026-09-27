import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { useStore } from 'zustand';
import { faArrowsUpDownLeftRight, faXmark, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../controller';
import { BACKPACK_SLOTS, CHEST_SLOTS, HOTBAR, type ContainerId, type Screen, type SlotRef } from '../inventory/inventory';
import { itemDef, stackLabel, type ItemId } from '../inventory/items';
import { doubleClick, dropHeld, leftClick, moveAllOf, numberSwap, planSpread, rightClick, shiftClick, sortSection, spread, storeAll, takeAll, wheelMove } from '../inventory/screenOps';
import { Icon } from './Icon';
import { SlotFace } from './Inventory';

/**
 * The inventory / chest screen (docs: collection-inventory.md §4.3), loaded on demand by `InventoryScreen`.
 * The crafting table uses it too (crafting-screen.md §4.3): its recipes and detail are the `top`, over
 * the backpack and the hotbar, with its own title and close.
 */

type Section = { title: string; c: ContainerId; from: number; to: number; id: string };
/**
 * A press on a slot that may become a drag: `spread` (a stack held: spread it on release), `quick`
 * (Shift or Move: quick-move every slot passed over), `touch` (a finger: a tap, a long-press, or a drag
 * that carries the stack to where it lifts).
 */
type Drag = { mode: 'spread' | 'quick' | 'touch'; button: 0 | 2; refs: SlotRef[]; start: SlotRef; pressed: boolean };

const LONG_PRESS_MS = 450;
const DOUBLE_MS = 300;
/** Wheel travel (px) per item moved: one notch of a mouse wheel. */
const WHEEL_STEP = 100;

const keyOf = (r: SlotRef) => `${r.c}:${r.i}`;
const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

export default function InventoryPanel({
  controller,
  screen,
  top,
  title = screen === 'chest' ? 'Chest' : 'Backpack',
  icon,
  onClose = () => controller.closeInventory(),
  kind = 'inventory',
}: {
  controller: GameController;
  screen: Screen;
  top?: ReactNode;
  title?: string;
  icon?: IconDefinition;
  onClose?: () => void;
  kind?: 'inventory' | 'craft';
}) {
  const inv = controller.inventory;
  const touch = useStore(controller.store, (s) => s.input === 'touch');
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
  const drag = useRef<Drag | null>(null);
  /** The drag being previewed (Minecraft shows where a spread will land before you let go). */
  const [preview, setPreview] = useState<{ refs: SlotRef[]; even: boolean } | null>(null);
  const lastClick = useRef<{ key: string; t: number } | null>(null);
  const lastQuick = useRef<{ key: string; id: ItemId; t: number } | null>(null);
  const press = useRef<number | undefined>(undefined);
  const wheel = useRef(0);
  const cursor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const slotEls = useRef<Array<HTMLButtonElement | null>>([]);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const changed = (announceHeld = true) => {
    controller.invChanged();
    if (announceHeld) {
      const h = inv.held;
      controller.announce(h ? `Holding ${stackLabel(h.id, h.n)}.` : 'Hand empty.');
    }
  };

  // focus the first slot when the screen opens (a top part takes the focus itself)
  useEffect(() => {
    if (!top) slotEls.current[0]?.focus({ preventScroll: true });
  }, []);

  /** Shift+click; a second one on the same slot straight after moves every stack of that item (Minecraft's Shift+double-click). */
  const quick = (r: SlotRef) => {
    const key = keyOf(r);
    const now = performance.now();
    const q = lastQuick.current;
    if (q && q.key === key && now - q.t < DOUBLE_MS) {
      lastQuick.current = null;
      const n = moveAllOf(inv, r, q.id, screen);
      changed(false);
      if (n) controller.announce(`Moved every stack of ${itemDef(q.id).name.toLowerCase()}.`);
      return;
    }
    const st = inv.get(r);
    lastQuick.current = st ? { key, id: st.id, t: now } : null;
    shiftClick(inv, r, screen);
    changed(false);
  };

  const click = (r: SlotRef, button: 0 | 2, shift: boolean) => {
    if (shift || moveMode) return quick(r);
    const key = keyOf(r);
    const now = performance.now();
    if (button === 0 && inv.held && lastClick.current && lastClick.current.key === key && now - lastClick.current.t < DOUBLE_MS) {
      doubleClick(inv, screen);
      lastClick.current = null;
      return changed();
    }
    lastClick.current = button === 0 ? { key, t: now } : null;
    if (button === 0) leftClick(inv, r);
    else rightClick(inv, r);
    changed();
  };

  const sectionOf = (r: SlotRef) => sections.find((s) => s.c === r.c && r.i >= s.from && r.i < s.to)!;

  /** Sort a section (the hotbar keeps its order: sorting from it sorts the backpack above). */
  const sort = (sec: Section) => {
    const s = sec.id === 'inv-hotbar' ? sections.find((x) => x.id === 'inv-main')! : sec;
    const did = sortSection(inv, s.c, s.from, s.to);
    changed(false);
    controller.announce(did ? `${s.title} sorted.` : `${s.title} is already in order.`);
  };

  const onTake = () => {
    const n = takeAll(inv);
    changed(false);
    controller.announce(n ? `Took ${items(n)} from the chest.` : inv.chest.some(Boolean) ? 'Your backpack is full: store or drop something first.' : 'The chest is empty.');
  };

  const onStore = (matching: boolean) => {
    const n = storeAll(inv, matching);
    changed(false);
    const empty = !inv.backpack.some(Boolean);
    controller.announce(
      n
        ? `Stored ${items(n)} in the chest.`
        : matching
          ? 'Nothing in your backpack matches the chest.'
          : empty
            ? 'Your backpack is empty.'
            : 'The chest is full: take something out first.',
    );
  };

  const onSlotDown = (r: SlotRef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button === 1) {
      // middle-click sorts the section (as Inventory Tweaks does; vanilla uses it only in Creative)
      e.preventDefault();
      return sort(sectionOf(r));
    }
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    const button = e.button as 0 | 2;
    const d: Drag = { mode: 'spread', button, refs: [r], start: r, pressed: true };
    if (e.shiftKey || moveMode) {
      // Shift-drag (Mouse Tweaks): the first slot now, each slot passed over after it
      click(r, button, true);
      drag.current = { ...d, mode: 'quick' };
      return;
    }
    if (e.pointerType === 'touch' && button === 0) {
      // touch: tap = left-click, long-press = right-click, a drag carries the stack (or spreads a held one)
      window.clearTimeout(press.current);
      press.current = window.setTimeout(() => {
        press.current = undefined;
        const t = drag.current;
        if (t?.refs.length !== 1) return;
        click(r, 2, false);
        // a long-press then a drag puts one in each slot passed over (Minecraft's right-drag)
        t.button = 2;
        t.refs = [];
      }, LONG_PRESS_MS);
      drag.current = { ...d, mode: 'touch' };
      return;
    }
    if (inv.held) {
      // holding a stack: a press starts a possible drag-to-spread; the release decides
      drag.current = d;
      return;
    }
    click(r, button, false);
  };

  /** The pointer is over another slot while pressed. */
  const dragOver = (r: SlotRef) => {
    const d = drag.current;
    if (!d || d.refs.some((x) => keyOf(x) === keyOf(r))) return;
    d.refs.push(r);
    if (d.mode === 'quick') {
      shiftClick(inv, r, screen);
      changed(false);
      return;
    }
    if (press.current !== undefined) {
      // a finger that moves on is dragging, not long-pressing
      window.clearTimeout(press.current);
      press.current = undefined;
    }
    if (inv.held && (d.mode === 'spread' || d.mode === 'touch')) setPreview({ refs: [...d.refs], even: d.button === 0 });
  };

  const onSlotEnter = (r: SlotRef) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    hovered.current = r;
    const st = inv.get(r);
    const rect = e.currentTarget.getBoundingClientRect();
    setTip(st ? { text: itemDef(st.id).name, x: rect.left + rect.width / 2, y: rect.top } : null);
    dragOver(r);
  };

  useEffect(() => {
    // follow a drag under the pointer (a finger's pointer stays captured by the slot it pressed)
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-slot]');
      const [c, i] = el?.dataset.slot?.split(':') ?? [];
      if (c === 'backpack' || c === 'chest') dragOver({ c, i: Number(i) });
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      setPreview(null);
      if (!d) return;
      if (press.current !== undefined) {
        // a short touch: a left-click
        window.clearTimeout(press.current);
        press.current = undefined;
        click(d.start, 0, false);
        return;
      }
      if (d.mode === 'quick') return;
      const last = d.refs[d.refs.length - 1];
      if (d.mode === 'touch' && d.refs.length > 1 && !inv.held && inv.get(d.start)) {
        // a finger dragged a stack from one slot to another: put it there (merge or swap), and anything swapped back where it came from
        leftClick(inv, d.start);
        leftClick(inv, last);
        if (inv.held && !inv.get(d.start)) leftClick(inv, d.start);
        return changed();
      }
      if (inv.held && (d.refs.length > 1 || (d.mode === 'touch' && d.button === 2 && d.refs.length))) {
        spread(inv, d.refs, d.button === 0);
        changed();
      } else if (d.mode === 'spread' && inv.held) click(d.start, d.button, false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  // the wheel over a slot moves one at a time (Mouse Tweaks): down sends one over, up pulls one back
  const onSlotWheel = (r: SlotRef) => (e: ReactWheelEvent<HTMLButtonElement>) => {
    if (inv.held || !inv.get(r)) return;
    // (a wheel that reports lines or pages moves one per notch)
    wheel.current += e.deltaMode ? Math.sign(e.deltaY) * WHEEL_STEP : e.deltaY;
    let moved = false;
    while (Math.abs(wheel.current) >= WHEEL_STEP) {
      const dir = Math.sign(wheel.current);
      wheel.current -= dir * WHEEL_STEP;
      moved = wheelMove(inv, r, dir, screen) || moved;
    }
    if (moved) changed(false);
  };

  // the cursor stack follows the pointer
  const onMove = (e: ReactPointerEvent) => {
    if (cursor.current) cursor.current.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
  };

  // click outside the panel with a stack held: throw it (left: all, right: one)
  const onBackdrop = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!inv.held) return;
    const st = dropHeld(inv, e.button === 0);
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
    // (the tool buttons keep their own Enter and Space; slot keys act on the hovered slot, else the focused one)
    const onSlot = (e.target as HTMLElement).dataset.slot !== undefined;
    const r = hovered.current ?? (onSlot ? order[focusIdx] : null);
    if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'KeyI') {
      e.preventDefault();
      onClose();
      return;
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      e.preventDefault();
      if (r) {
        numberSwap(inv, r, Number(e.code.slice(5)) - 1);
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
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const at = r ?? order[focusIdx];
      if (at) sort(sectionOf(at));
      return;
    }
    if (!onSlot) return;
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

  const plan = preview && preview.refs.length > 1 ? planSpread(inv, preview.refs, preview.even) : null;
  const held = plan && inv.held ? (plan.left > 0 ? { id: inv.held.id, n: plan.left } : null) : inv.held;
  let flat = 0;
  return (
    <div className="inv-backdrop surface-wood" data-testid={`${kind}-screen`} onPointerMove={onMove} onPointerDown={onBackdrop} onContextMenu={(e) => e.preventDefault()}>
      <div ref={panel} className={`inv-panel ${kind}-panel`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey}>
        <div className="inv-head">
          <h2>
            {icon && <Icon icon={icon} />} {title}
          </h2>
          <button type="button" className={`btn inv-move${moveMode ? ' on' : ''}`} aria-pressed={moveMode} onClick={() => setMoveMode((m) => !m)} title="Taps move stacks between sections (like Shift+click)">
            <Icon icon={faArrowsUpDownLeftRight} /> Move
          </button>
          <button type="button" className="btn inv-close" aria-label="Close" onClick={onClose}>
            <Icon icon={faXmark} />
          </button>
        </div>
        {top}
        {sections.map((sec) => (
          <section key={sec.id} className={`inv-section ${sec.id}`} aria-label={sec.title}>
            {sec.id !== 'inv-hotbar' && (
              <div className="inv-sec-head">
                <h3>{sec.title}</h3>
                <div className="inv-tools" role="group" aria-label={`${sec.title} tools`}>
                  {sec.id === 'inv-chest' && (
                    <button type="button" className="btn" onClick={onTake} title="Move everything in the chest into your backpack">
                      Take all
                    </button>
                  )}
                  {sec.id === 'inv-main' && screen === 'chest' && (
                    <>
                      <button type="button" className="btn" onClick={() => onStore(true)} title="Store the items the chest already holds">
                        Store matching
                      </button>
                      <button type="button" className="btn" onClick={() => onStore(false)} title="Move everything in your backpack into the chest">
                        Store all
                      </button>
                    </>
                  )}
                  <button type="button" className="btn" aria-label={`Sort ${sec.title.toLowerCase()}`} onClick={() => sort(sec)} title="Merge stacks and put them in order (R)">
                    Sort
                  </button>
                </div>
              </div>
            )}
            <div className="inv-grid">
              {Array.from({ length: sec.to - sec.from }, (_, k) => {
                const r: SlotRef = { c: sec.c, i: sec.from + k };
                const st = inv.get(r);
                const ghost = plan?.slots.get(keyOf(r));
                const idx = flat++;
                const name = `${sec.c === 'chest' ? 'Chest' : sec.id === 'inv-hotbar' ? 'Hotbar' : 'Backpack'} slot ${sec.id === 'inv-hotbar' ? r.i + 1 : sec.c === 'chest' ? r.i + 1 : r.i - HOTBAR + 1}`;
                return (
                  <button
                    key={keyOf(r)}
                    ref={(el) => {
                      slotEls.current[idx] = el;
                    }}
                    type="button"
                    className={`slot${sec.id === 'inv-hotbar' && r.i === inv.selected ? ' selected' : ''}${ghost ? ' spread' : ''}`}
                    tabIndex={idx === focusIdx ? 0 : -1}
                    aria-label={`${name}: ${st ? stackLabel(st.id, st.n) : 'empty'}`}
                    data-slot={keyOf(r)}
                    onPointerDown={onSlotDown(r)}
                    onPointerEnter={onSlotEnter(r)}
                    onPointerLeave={() => {
                      hovered.current = null;
                      setTip(null);
                    }}
                    onWheel={onSlotWheel(r)}
                    onMouseDown={(e) => e.button === 1 && e.preventDefault()}
                    onFocus={(e) => {
                      setFocusIdx(idx);
                      hovered.current = r;
                      // keyboard: the held stack sits by the focused slot
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (cursor.current) cursor.current.style.transform = `translate(${rect.right - 26}px, ${rect.top - 18}px)`;
                    }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <SlotFace stack={ghost ?? st} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <p className="inv-help" aria-hidden="true">
          {touch
            ? 'Tap: take / place · Hold: half / one · Drag a stack: put it there · Tap, then drag: spread · Hold, then drag: one each · Double-tap: gather · Move on: taps and drags move stacks (tap twice: every stack of it)'
            : 'Click: take / place · Right-click: half / one · Drag: spread · Double-click: gather · Shift+click: move (twice: every stack of it) · Shift+drag: move each · Wheel: move one · 1–9: to hotbar · Q: drop · R: sort'}
        </p>
      </div>
      {tip && !inv.held && (
        <div className="inv-tip" style={{ left: tip.x, top: tip.y } as CSSProperties} aria-hidden="true">
          {tip.text}
        </div>
      )}
      <div ref={cursor} className="inv-cursor" aria-hidden="true" data-testid="inventory-cursor">
        {held && <SlotFace stack={held} />}
      </div>
    </div>
  );
}
