import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { faCheck, faHammer, faMinus, faPaintRoller, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../../controller';
import { itemDef } from '../../inventory/items';
import { Icon } from '../../ui/Icon';
import { asideLane } from '../../ui/lanes';
import { useCompact } from '../../ui/useCompact';
import { ItemIcon } from '../../ui/Inventory';
import InventoryPanel from '../../ui/InventoryPanel';
import { selectReducedMotion } from '../../state/store';
import type { Crafting } from './index';
import { BULK_MAX, CRAFT_S, HOUSE_HEX, HOUSE_NEEDS, MAX_NEEDS, RECIPES, byMaterials, colourName, haveOf, maxCraftable, paintOptions, type Recipe } from './recipes';

/** The crafting screen, the palette for Chopper's house, and the site card (crafting.md §4.2, §4.3). */
export function CraftScreens({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  const screen = useStore(controller.store, (s) => s.craftScreen);
  const near = useStore(crafting.store, (s) => s.near);
  // the aside shows one thing at a time (lanes.ts): the card, unless a conversation has the player's attention
  const compact = useCompact();
  const aside = useStore(controller.store, (s) => asideLane(s, compact));
  return (
    <>
      {screen === 'table' && <CraftScreen controller={controller} crafting={crafting} />}
      {screen === 'paint' && <PaintPicker controller={controller} crafting={crafting} />}
      {near && !screen && aside === 'site' && <SiteCard controller={controller} />}
    </>
  );
}

const plural = (id: Parameters<typeof itemDef>[0], n: number) => {
  const name = itemDef(id).name;
  return n === 1 || name.endsWith('s') ? name : `${name}s`;
};

/** "1 wood log", "3 red flowers (any kind)". */
const needText = (needs: Recipe['needs']) => needs.map((n) => `${n.n} ${n.any.length === 1 ? plural(n.any[0], n.n).toLowerCase() : n.label.toLowerCase()}`).join(' and ');

/**
 * The crafting table (crafting-screen.md §4.3): Minecraft's layout, with the recipes and the selected
 * one's detail over your backpack and hotbar (the inventory panel's own slots and gestures).
 */
function CraftScreen({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  useStore(controller.store, (s) => s.invVersion);
  return (
    <InventoryPanel
      controller={controller}
      screen="backpack"
      kind="craft"
      title="Crafting table"
      icon={faHammer}
      onClose={() => controller.closeCraft()}
      top={<CraftPane controller={controller} crafting={crafting} />}
    />
  );
}

/** How many columns the recipe grid shows (it reflows with the screen). */
const columns = (el: HTMLElement | null) => Math.max(1, el ? getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length : 5);

/**
 * The recipes as a grid of icons (the names are in the detail and the tooltips), and the selected one:
 * the result, a slot per material (have / need), how many, and Craft. ← → ↑ ↓ pick, − / + how many,
 * Enter crafts (Shift+Enter: as many as you can), Esc or E closes.
 */
function CraftPane({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  const busy = useStore(crafting.store, (s) => s.crafting);
  const landed = useStore(crafting.store, (s) => s.landed);
  const reduced = useStore(controller.store, selectReducedMotion);
  const touch = useStore(controller.store, (s) => s.input === 'touch');
  const inv = controller.inventory;
  const [sel, setSel] = useState(0);
  const [qty, setQty] = useState(1);
  const grid = useRef<HTMLUListElement>(null);
  const result = useRef<HTMLSpanElement>(null);
  const r = RECIPES[sel];
  const max = maxCraftable(inv, r);
  const q = Math.max(1, Math.min(qty, Math.max(1, max)));
  const short = byMaterials(inv, r) > 0 && max === 0;

  useEffect(() => {
    grid.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    grid.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [sel]);

  // the landing: the result flies from its slot into each slot it went to, which then pops
  useEffect(() => {
    if (!landed) return;
    const panel = grid.current?.closest('.inv-panel');
    const from = result.current?.getBoundingClientRect();
    const img = result.current?.querySelector('img');
    if (!panel || !from) return;
    const view = panel.getBoundingClientRect();
    const timers: number[] = [];
    for (const { i } of landed.slots) {
      const slot = panel.querySelector<HTMLElement>(`[data-slot="backpack:${i}"]`);
      if (!slot) continue;
      const to = slot.getBoundingClientRect();
      const shown = to.bottom > view.top && to.top < view.bottom;
      const pop = () => {
        slot.classList.remove('landed');
        void slot.offsetWidth;
        slot.classList.add('landed');
        timers.push(window.setTimeout(() => slot.classList.remove('landed'), 900));
      };
      if (reduced || !img || !shown) {
        pop();
        continue;
      }
      const fly = document.createElement('div');
      fly.className = 'craft-fly';
      fly.setAttribute('aria-hidden', 'true');
      fly.appendChild(img.cloneNode());
      fly.style.left = `${from.left + from.width / 2 - to.width / 2}px`;
      fly.style.top = `${from.top + from.height / 2 - to.height / 2}px`;
      fly.style.width = `${to.width}px`;
      fly.style.height = `${to.height}px`;
      fly.style.setProperty('--dx', `${to.left - (from.left + from.width / 2 - to.width / 2)}px`);
      fly.style.setProperty('--dy', `${to.top - (from.top + from.height / 2 - to.height / 2)}px`);
      document.body.appendChild(fly);
      fly.addEventListener('animationend', () => {
        fly.remove();
        pop();
      });
      timers.push(window.setTimeout(() => fly.isConnected && (fly.remove(), pop()), 1500));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [landed, reduced]);

  const pick = (i: number) => {
    const n = Math.max(0, Math.min(RECIPES.length - 1, i));
    if (n === sel) return;
    setSel(n);
    setQty(1);
    const rr = RECIPES[n];
    controller.announce(`${itemDef(rr.out).name}: you can make ${maxCraftable(inv, rr) * rr.yield}.`);
  };
  const step = (d: number) => {
    const next = Math.max(1, Math.min(Math.max(1, max), q + d));
    setQty(next);
    if (next !== q) controller.announce(`Make ${next * r.yield}.`);
  };
  const go = (all = false) => {
    if (busy || max < 1) {
      if (!busy) controller.announce(short ? 'Your backpack is too full for that.' : "You don't have enough for that yet.");
      return;
    }
    crafting.startCraft(r, all ? max : q);
  };
  const onKey = (e: KeyboardEvent) => {
    const cols = columns(grid.current);
    const move: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (e.target === grid.current && e.code in move) {
      e.preventDefault();
      e.stopPropagation();
      pick(sel + move[e.code]);
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      step(-1);
    } else if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'PageUp') {
      e.preventDefault();
      e.stopPropagation();
      step(1);
    } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && e.target === grid.current && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      go(e.shiftKey);
    }
  };

  return (
    <div className="craft-body" onKeyDown={onKey}>
      <ul
        ref={grid}
        className="craft-grid scroll-thin"
        role="listbox"
        aria-label="Recipes"
        aria-orientation="horizontal"
        tabIndex={0}
        aria-activedescendant={`recipe-${r.id}`}
      >
        {RECIPES.map((x, i) => {
          const can = maxCraftable(inv, x) * x.yield;
          const name = itemDef(x.out).name;
          return (
            <li
              key={x.id}
              id={`recipe-${x.id}`}
              role="option"
              aria-selected={i === sel}
              aria-label={`${name}: ${x.yield > 1 ? `${x.yield} from ${needText(x.needs)}` : needText(x.needs)}. You can make ${can}.`}
              title={name}
              data-index={i}
              data-testid={`recipe-${x.id}`}
              className={`slot craft-cell${i === sel ? ' on' : ''}${can ? '' : ' dim'}`}
              onPointerDown={(e) => {
                e.preventDefault();
                grid.current?.focus({ preventScroll: true });
                pick(i);
              }}
            >
              <ItemIcon id={x.out} />
              {can > 0 && <span className="slot-count craft-can">×{can}</span>}
            </li>
          );
        })}
      </ul>
      <section className="craft-detail" aria-labelledby="craft-detail-name" data-testid="craft-detail">
        <div className="craft-result">
          <span ref={result} className="slot craft-big" data-testid="craft-result">
            <ItemIcon id={r.out} />
            {r.yield > 1 && <span className="slot-count">{r.yield}</span>}
          </span>
          <div>
            <h3 id="craft-detail-name">{itemDef(r.out).name}</h3>
            <p className="craft-line">{r.line}</p>
          </div>
        </div>
        <ul className="craft-needs" aria-label="Materials">
          {r.needs.slice(0, MAX_NEEDS).map((n) => {
            const have = haveOf(inv, n);
            const need = n.n * q;
            const ok = have >= need;
            return (
              <li key={n.label} className={`craft-need ${ok ? 'ok' : 'short'}`} data-testid="craft-need" aria-label={`${n.label}: you have ${have}, it takes ${need}${ok ? '' : `, ${need - have} short`}`} title={n.label}>
                <span className="slot craft-icon" aria-hidden="true">
                  <ItemIcon id={n.icon} />
                  <span className="craft-mark">
                    <Icon icon={ok ? faCheck : faXmark} />
                  </span>
                </span>
                <span className="craft-have" aria-hidden="true">
                  {have} / {need}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="craft-go">
          <div className="craft-qty" role="group" aria-label="How many">
            <button type="button" className="btn" aria-label="Fewer" disabled={q <= 1} onClick={() => step(-1)}>
              <Icon icon={faMinus} />
            </button>
            <output data-testid="craft-qty" aria-label={`Make ${q * r.yield}`}>
              {q * r.yield}
            </output>
            <button type="button" className="btn" aria-label="More" disabled={q >= Math.min(BULK_MAX, max)} onClick={() => step(1)}>
              <Icon icon={faPlus} />
            </button>
          </div>
          <button
            type="button"
            className="btn primary craft-btn"
            data-testid="craft-go"
            aria-disabled={max < 1 || Boolean(busy)}
            title="Shift+click: make as many as you can"
            onClick={(e) => go(e.shiftKey)}
          >
            <Icon icon={faHammer} /> Craft <kbd>Enter</kbd>
          </button>
        </div>
        {busy && (
          <div className="craft-progress" aria-hidden="true" style={{ ['--craft-s' as string]: `${CRAFT_S}s` }}>
            <span />
          </div>
        )}
        <p className="craft-status" data-testid="craft-status">
          {max < 1 ? (short ? 'Your backpack is too full: make some room first.' : `Not enough yet: it takes ${needText(r.needs)}.`) : `You can make up to ${max * r.yield} ${plural(r.out, max * r.yield).toLowerCase()}.`}
        </p>
        <p className="inv-help" aria-hidden="true">
          {touch ? 'Tap a recipe, then Craft' : 'Arrows: pick · − +: how many · Enter: craft (Shift: as many as you can) · Esc: close'}
        </p>
      </section>
    </div>
  );
}

/** Paint Chopper's house: Original red (free) or a pot of any paint you've made. */
function PaintPicker({ controller, crafting }: { controller: GameController; crafting: Crafting }) {
  useStore(controller.store, (s) => s.invVersion);
  const colour = useStore(crafting.store, (s) => s.colour);
  const opts = paintOptions(controller.inventory);
  const btns = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    const i = Math.max(0, opts.findIndex((o) => o.colour === colour));
    btns.current[i]?.focus({ preventScroll: true });
    // (only on open)
  }, []);
  const close = () => controller.closeCraft();
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || (e.code === 'KeyE' && !e.repeat)) {
      e.preventDefault();
      close();
      return;
    }
    const d = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowDown' ? 4 : e.code === 'ArrowUp' ? -4 : 0;
    if (!d) return;
    e.preventDefault();
    const i = btns.current.findIndex((b) => b === document.activeElement);
    const next = Math.max(0, Math.min(opts.length - 1, (i < 0 ? 0 : i) + d));
    btns.current[next]?.focus();
  };
  return (
    <div className="inv-backdrop surface-wood" data-testid="paint-screen" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="inv-panel paint-panel" role="dialog" aria-modal="true" aria-labelledby="paint-title" onKeyDown={onKey}>
        <div className="inv-head">
          <h2 id="paint-title">
            <Icon icon={faPaintRoller} /> Paint Chopper&rsquo;s house
          </h2>
          <button type="button" className="btn" aria-label="Close the palette" onClick={close}>
            <Icon icon={faXmark} />
          </button>
        </div>
        <div className="paint-grid">
          {opts.map((o, i) => {
            const none = o.pots < 1;
            return (
              <button
                key={o.colour}
                ref={(el) => {
                  btns.current[i] = el;
                }}
                type="button"
                className={`paint-swatch${o.colour === colour ? ' on' : ''}`}
                data-testid={`paint-${o.colour}`}
                aria-pressed={o.colour === colour}
                disabled={none}
                onClick={() => crafting.paint(o.colour)}
              >
                <span className="paint-chip" style={{ background: HOUSE_HEX[o.colour] }} aria-hidden="true">
                  {o.colour === colour && <Icon icon={faCheck} />}
                </span>
                <span className="paint-name">{colourName(o.colour)}</span>
                <span className="paint-pots">{o.colour === 'original' ? 'Free' : `${o.pots} ${o.pots === 1 ? 'pot' : 'pots'}`}</span>
              </button>
            );
          })}
        </div>
        <p className="inv-help">Each coat uses one pot of paint. Make paint from three flowers of a colour at the crafting table. Esc closes.</p>
      </div>
    </div>
  );
}

/** Close to the site: what it's for, in Chopper's words, and what it needs (have / need). */
function SiteCard({ controller }: { controller: GameController }) {
  useStore(controller.store, (s) => s.invVersion);
  const inv = controller.inventory;
  const ready = HOUSE_NEEDS.every((x) => inv.count(x.id) >= x.n);
  const touch = useStore(controller.store, (s) => s.input === 'touch');
  return (
    <section className="card site-card aside" aria-labelledby="site-title" data-testid="site-card">
      <p className="kicker">A spot for Chopper</p>
      <h2 id="site-title">Chopper&rsquo;s house</h2>
      <p>Chopper has picked this sunny spot beside the house. A little house of his very own, right here, would be the best thing ever: somewhere to nap, guard his bowl and keep an eye on everyone. Paws crossed!</p>
      <ul className="site-needs">
        {HOUSE_NEEDS.map((x) => {
          const have = inv.count(x.id);
          const ok = have >= x.n;
          return (
            <li key={x.id} className={ok ? 'ok' : 'short'} data-testid="site-need">
              <span className="slot craft-icon">
                <ItemIcon id={x.id} />
              </span>
              <span className="craft-name">{plural(x.id, x.n)}</span>
              <span className="craft-have">
                {Math.min(have, x.n)} / {x.n} {ok && <Icon icon={faCheck} title="done" />}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="site-hint">{ready ? `Everything’s here. ${touch ? 'Tap the prompt' : 'Press E'} to build it!` : 'Craft them at the crafting table by the Workshop.'}</p>
    </section>
  );
}
