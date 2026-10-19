/**
 * The game UI's gallery (documentation/game-ui/design-system.md §9.1; review DS2-05): the primitives and the
 * panels, drawn by the real components from sample data (./samples), one view at a time, on the paper or the
 * wood surface. Its own page, /play/gallery/, in development and test builds only (integrations/game-gallery.mjs):
 * never in production (scripts/size-report.mjs fails if it reaches dist/). Every exported game UI component has an
 * entry here (tests/unit/designSystem.test.ts, "the gallery").
 */
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { faArrowRight, faHammer, faHouse, faXmark } from '@fortawesome/free-solid-svg-icons';
import './gallery.css';
import { Button, IconButton, KeyCap } from '../ui/primitives';
import { Dialog, Panel, ScrollArea } from '../ui/overlays';
import { Icon } from '../ui/Icon';
import { Hud } from '../ui/Hud';
import { Hotbar, InventoryScreen, ItemIcon, SlotFace } from '../ui/Inventory';
import { ViewControls } from '../ui/ViewControls';
import InventoryPanel from '../ui/InventoryPanel';
import MenuDialog from '../ui/MenuDialog';
import LandmarkDialog, { ContextLost, PreviewCard } from '../ui/Dialogs';
import { CraftScreens } from '../world/craft/ui';
import { TalkBox } from '../world/home/TalkBox';
import { RESIDENTS } from '../platform/residents';
import type { GameState } from '../state/store';
import { sampleController, sampleCrafting } from './samples';
import { GALLERY_VIEWS, type GalleryView } from './views';

// his card brings its own little 3D canvas, and lives only where he does (plan M3a)
const ChopperCard = RESIDENTS ? lazy(() => import('../ui/ChopperCard')) : null;

const noop = () => undefined;

/** The sky the HUD and panels sit over in the game, with the HUD's own layout (the stage is `.play`, like the page's body). */
function Stage({ children, header = false, state }: { children: (c: ReturnType<typeof sampleController>) => ReactNode; header?: boolean; state?: Partial<GameState> }) {
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [controller] = useState(() => sampleController(state));
  // the HUD portals its clock, Sound, Fast travel and Menu into the top bar's actions (a sample's own field)
  if (header) (controller as unknown as { hudActions: HTMLElement | null }).hudActions = actions;
  return (
    <div className="gallery-stage play">
      {header && (
        <header className="play-header">
          <a className="brand" href="#top">
            Sample site
          </a>
          <div className="play-actions">
            <a className="btn" href="#classic">
              Classic site
            </a>
            <div className="hud-actions" ref={setActions} />
          </div>
        </header>
      )}
      {(!header || actions) && children(controller)}
    </div>
  );
}

const TALK: Partial<GameState> = {
  talk: { id: 'prabin', name: 'Prabin', lines: ['Hello, and welcome to the little planet! Walk up to a building to see what it holds.', 'Bye for now.'], index: 0, reveal: 0 },
  reducedMotionUser: true,
};

/** Each view: its name, and what it draws. */
const VIEWS: Partial<Record<GalleryView, { render: () => ReactNode }>> = {
  controls: { render: () => <Controls /> },
  hud: {
    render: () => (
      <Stage header state={{ target: { kind: 'tree', key: 'tree-1', label: 'Shake the tree' }, toast: 'You picked up 3 apples.' }}>
        {(c) => <Hud controller={c} />}
      </Stage>
    ),
  },
  seated: {
    render: () => <Stage header state={{ seated: true, canFeed: true }}>{(c) => <Hud controller={c} />}</Stage>,
  },
  preview: { render: () => <Stage state={{ nearbyId: 'library' }}>{(c) => <PreviewCard controller={c} />}</Stage> },
  talk: { render: () => <Stage state={TALK}>{(c) => <TalkBox controller={c} />}</Stage> },
  site: { render: () => <Stage state={{ siteNear: true }}>{(c) => <CraftScreens controller={c} crafting={sampleCrafting('house')} />}</Stage> },
  hotbar: {
    render: () => (
      <Stage>
        {(c) => (
          <>
            <Hotbar controller={c} />
            <ViewControls controller={c} />
          </>
        )}
      </Stage>
    ),
  },
  dialog: {
    render: () => (
      <Dialog open onDismiss={noop} aria-labelledby="sample-dialog-title">
        <div className="dialog-body">
          <h2 id="sample-dialog-title">A sample dialog</h2>
          <p>A modal sheet over the planet: a title, a body and actions, the primary action first.</p>
          <h3>A section</h3>
          <ul>
            <li>A list item</li>
            <li>Another list item</li>
          </ul>
          <div className="actions">
            <Button variant="primary">
              Close <KeyCap>Space</KeyCap>
            </Button>
            <Button>Show controls</Button>
          </div>
        </div>
      </Dialog>
    ),
  },
  panel: {
    render: () => (
      <Panel aria-label="A sample panel" backdrop={{ 'data-testid': 'sample-panel' }}>
        <div className="inv-head">
          <h2>
            <Icon icon={faHammer} /> A sample panel
          </h2>
          <IconButton pill label="Close" icon={faXmark} />
        </div>
        <p className="inv-help">A wood panel on the overlay layer, at a fixed size: a head and its sections.</p>
      </Panel>
    ),
  },
  menu: { render: () => <Stage state={{ menuOpen: true }}>{(c) => <MenuDialog controller={c} />}</Stage> },
  help: { render: () => <Stage state={{ menuOpen: 'help' }}>{(c) => <MenuDialog controller={c} />}</Stage> },
  travel: { render: () => <Stage state={{ menuOpen: 'travel', nearbyId: 'library' }}>{(c) => <MenuDialog controller={c} />}</Stage> },
  backpack: {
    render: () => (
      <Stage state={{ invScreen: 'backpack' }}>
        {(c) => <InventoryScreen controller={c} />}
      </Stage>
    ),
  },
  chest: { render: () => <Stage state={{ invScreen: 'chest' }}>{(c) => <InventoryPanel controller={c} screen="chest" />}</Stage> },
  craft: { render: () => <Stage state={{ craftScreen: 'table' }}>{(c) => <CraftScreens controller={c} crafting={sampleCrafting()} />}</Stage> },
  furnace: { render: () => <Stage state={{ craftScreen: 'furnace' }}>{(c) => <CraftScreens controller={c} crafting={sampleCrafting()} />}</Stage> },
  paint: { render: () => <Stage state={{ craftScreen: 'paint' }}>{(c) => <CraftScreens controller={c} crafting={sampleCrafting()} />}</Stage> },
  reading: { render: () => <Stage state={{ openId: 'library' }}>{(c) => <LandmarkDialog controller={c} />}</Stage> },
  lost: { render: () => <Stage state={{ contextLost: true }}>{(c) => <ContextLost controller={c} />}</Stage> },
  ...(ChopperCard
    ? {
        chopper: {
          render: () => (
            <Stage state={{ chopperOpen: true }}>
              {(c) => (
                <Suspense fallback={null}>
                  <ChopperCard controller={c} />
                </Suspense>
              )}
            </Stage>
          ),
        },
      }
    : {}),
};

/** The views this site's gallery has, in order (Chopper's card only where he lives). */
const SHOWN = GALLERY_VIEWS.filter((v) => VIEWS[v.id]);

/** The primitives on the page's surface: every Button variant and state, IconButton, KeyCap, Icon, a slot, ScrollArea. */
function Controls() {
  return (
    <div className="gallery-sections">
      <section className="gallery-section" aria-labelledby="g-button">
        <h2 id="g-button">Button</h2>
        <div className="gallery-row">
          <Button>Default</Button>
          <Button variant="primary">
            Primary <KeyCap>E</KeyCap>
          </Button>
          <Button>
            <Icon icon={faHouse} /> With an icon
          </Button>
          <Button disabled>Disabled</Button>
          <Button aria-disabled="true">Unavailable</Button>
          <Button aria-pressed="true">Pressed</Button>
          <a className="btn" href="#classic">
            A link <Icon icon={faArrowRight} />
          </a>
        </div>
      </section>
      <section className="gallery-section" aria-labelledby="g-icon-button">
        <h2 id="g-icon-button">IconButton</h2>
        <div className="gallery-row">
          <IconButton label="Close" icon={faXmark} />
          <IconButton label="Back to the plaza" icon={faHouse} pill />
        </div>
      </section>
      <section className="gallery-section" aria-labelledby="g-key-cap">
        <h2 id="g-key-cap">KeyCap and Icon</h2>
        <p className="gallery-row">
          <span>
            Press <KeyCap>E</KeyCap> to use, <KeyCap>Space</KeyCap> to go back
          </span>
          <Icon icon={faHammer} title="A hammer" />
        </p>
      </section>
      <section className="gallery-section" aria-labelledby="g-slot">
        <h2 id="g-slot">Slots</h2>
        <div className="gallery-row">
          <Button variant="bare" className="slot" aria-label="Empty slot" />
          <Button variant="bare" className="slot" aria-label="Logs">
            <SlotFace stack={{ id: 'log', n: 12 }} />
          </Button>
          <Button variant="bare" className="slot selected" aria-label="Apples, selected">
            <SlotFace stack={{ id: 'apple', n: 3 }} />
          </Button>
          <span className="slot" aria-hidden="true">
            <ItemIcon id="lantern" />
          </span>
        </div>
      </section>
      <section className="gallery-section" aria-labelledby="g-scroll">
        <h2 id="g-scroll">ScrollArea</h2>
        <div className="gallery-row">
          <ScrollArea className="gallery-scroll" tabIndex={0} aria-label="A scrolling area">
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i}>A line of text to scroll through, number {i + 1}.</p>
            ))}
          </ScrollArea>
          <ScrollArea as="ul" className="gallery-scroll" tabIndex={0} aria-label="A scrolling list">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i}>List item {i + 1}</li>
            ))}
          </ScrollArea>
        </div>
      </section>
    </div>
  );
}

/** The gallery: an index of the views, or one view (`?view=`), on the surface the page was asked for. */
export function Gallery({ view, surface }: { view: string | null; surface: string }) {
  const shown = view ? VIEWS[view as GalleryView] : undefined;
  return (
    <div className="gallery" data-view={view ?? 'index'} data-surface={surface}>
      {!shown && (
        <header className="gallery-head">
          <h1>Game UI gallery</h1>
          <p>The game’s primitives and panels, drawn by its own components from sample data. Development and test builds only.</p>
          <nav aria-label="Views">
            <ul className="gallery-nav">
              {SHOWN.map((v) => (
                <li key={v.id}>
                  <a href={`?view=${v.id}&surface=${surface}`} data-view-link={v.id}>
                    {v.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
      )}
      {shown ? shown.render() : <Controls />}
    </div>
  );
}
