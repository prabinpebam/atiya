import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { classicHrefFor } from '../platform/url';
import { prefs } from '../platform/prefs';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';

const toClassic = () => prefs.setMode('classic');

/** A landmark's dialog: loaded on demand (the first time one opens, or soon after the game starts), like the menu. */
export default function LandmarkDialog({ controller }: { controller: GameController }) {
  const openId = useStore(controller.store, (s) => s.openId);
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<LandmarkData | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (openId) {
      setShown(controller.dataById.get(openId) ?? null);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [openId, controller]);

  return (
    <dialog
      ref={ref}
      className="dialog landmark-dialog"
      aria-labelledby="landmark-dialog-title"
      data-testid="landmark-dialog"
      style={shown ? { ['--accent' as string]: shown.accent } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        controller.requestCloseLandmark();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) controller.requestCloseLandmark();
      }}
    >
      {shown && (
        <article className="dialog-body">
          <p className="kicker">{shown.kicker}</p>
          <h2 id="landmark-dialog-title">{shown.title}</h2>
          <p>{shown.dialog.intro}</p>
          {shown.dialog.highlights.length > 0 && (
            <ul>
              {shown.dialog.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          <div className="actions">
            <a className="btn primary" href={classicHrefFor(shown.id)} onClick={toClassic}>
              Classic page <Icon icon={faArrowUpRightFromSquare} />
            </a>
            <button className="btn" type="button" onClick={() => controller.requestCloseLandmark()}>
              Close
            </button>
          </div>
        </article>
      )}
    </dialog>
  );
}
