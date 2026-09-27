import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { compassPoint, viewBearingDeg, type CompassPoint } from '../math/compass';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';

/**
 * Run a view action. After a mouse/touch click, hand focus back to the planet so WASD keeps
 * working; keyboard activation (detail 0) keeps focus on the button so it can be repeated.
 */
const act = (controller: GameController, fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
  fn();
  if (e.detail > 0) controller.focusRegion();
};

/**
 * Map-style view controls (spec §4.9): a compass that always points to map north (activate it
 * to face north again) and a reset button that returns to the plaza facing north. Dragging the
 * planet (or the keys) turns and tilts the view; the single-pointer alternative to that drag
 * (WCAG 2.5.7) is in the menu's View group (crafting-screen.md §4.2).
 */
export function ViewControls({ controller }: { controller: GameController }) {
  const visible = useStore(controller.store, (s) => s.phase === 'playing');
  const rose = useRef<SVGSVGElement>(null);
  const [facing, setFacing] = useState<CompassPoint>('north');

  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const a = controller.northAngle();
      if (rose.current) rose.current.style.transform = `rotate(${a}rad)`;
      const point = compassPoint(viewBearingDeg(a));
      if (point !== last) {
        last = point;
        setFacing(point);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controller]);

  if (!visible) return null;
  return (
    <div className="view-controls" role="group" aria-label="View" data-testid="view-controls">
      <button
        type="button"
        className="compass"
        data-testid="compass"
        aria-label={`Compass: facing ${facing}. Face north (N)`}
        title={`Facing ${facing} — click to face north (N)`}
        onClick={act(controller, () => controller.faceNorth())}
      >
        <svg ref={rose} viewBox="-32 -32 64 64" aria-hidden="true" className="compass-rose">
          <circle r="30" className="rose-ring" />
          {[45, 135, 225, 315].map((d) => (
            <line key={d} x1="0" y1="-24" x2="0" y2="-19" transform={`rotate(${d})`} className="rose-tick" />
          ))}
          <path d="M0 -22 L6 0 L0 3 L-6 0 Z" className="needle-north" />
          <path d="M0 22 L6 0 L0 -3 L-6 0 Z" className="needle-south" />
          <text y="-24" className="rose-n">
            N
          </text>
          <text x="24" className="rose-l" transform="rotate(90 24 0)">
            E
          </text>
          <text y="24" className="rose-l" transform="rotate(180 0 24)">
            S
          </text>
          <text x="-24" className="rose-l" transform="rotate(-90 -24 0)">
            W
          </text>
        </svg>
      </button>
      <button
        type="button"
        className="btn view-home"
        data-testid="view-home"
        aria-label="Reset position and direction: back to the plaza, facing north (H)"
        title="Back to the plaza, facing north (H)"
        onClick={() => controller.returnHome()}
      >
        <HomeIcon /> Reset
      </button>
    </div>
  );
}

function HomeIcon() {
  return <Icon icon={faHouse} />;
}
