import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import { compassPoint, viewBearingDeg, type CompassPoint } from '../math/compass';
import { faChevronDown, faChevronUp, faHouse, faRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons';
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
 * to face north again), rotate and tilt buttons around it, and a reset button that returns to
 * the plaza facing north. Everything also has a keyboard shortcut; dragging the planet tumbles
 * the view. Buttons are single-pointer alternatives to dragging (WCAG 2.5.7).
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
      <div className="view-pad">
        <button type="button" className="view-btn pad-up" aria-label="Tilt to a top view (Page Up)" title="Tilt to a top view (Page Up)" onClick={act(controller, () => controller.tiltViewStep(1))}>
          <Chevron dir="up" />
        </button>
        <button type="button" className="view-btn pad-left" aria-label="Rotate view counter-clockwise (,)" title="Rotate view counter-clockwise (,)" onClick={act(controller, () => controller.rotateViewStep(1))}>
          <Turn dir="ccw" />
        </button>
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
        <button type="button" className="view-btn pad-right" aria-label="Rotate view clockwise (.)" title="Rotate view clockwise (.)" onClick={act(controller, () => controller.rotateViewStep(-1))}>
          <Turn dir="cw" />
        </button>
        <button type="button" className="view-btn pad-down" aria-label="Tilt to a side view (Page Down)" title="Tilt to a side view (Page Down)" onClick={act(controller, () => controller.tiltViewStep(-1))}>
          <Chevron dir="down" />
        </button>
      </div>
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

function Chevron({ dir }: { dir: 'up' | 'down' }) {
  return <Icon icon={dir === 'up' ? faChevronUp : faChevronDown} />;
}

function Turn({ dir }: { dir: 'cw' | 'ccw' }) {
  return <Icon icon={dir === 'cw' ? faRotateRight : faRotateLeft} />;
}

function HomeIcon() {
  return <Icon icon={faHouse} />;
}
