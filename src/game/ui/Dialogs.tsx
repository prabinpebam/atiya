import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameController } from '../controller';
import type { LandmarkData } from '../types';
import { prefs } from '../platform/prefs';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { Icon } from './Icon';
import { spaceBack } from '../input/keyboard';

const toClassic = () => prefs.setMode('classic');

/**
 * A building's dialog: its words, then its published pages (documentation/sections/spec.md §5.4), each a
 * link to its page on the site, or a line saying it's still being fitted out. Loaded on demand (the first
 * time one opens, or soon after the game starts), like the menu.
 */
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
      onKeyDown={(e) => {
        if (!spaceBack(e)) return;
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
          <p>{shown.summary}</p>
          {shown.pages.length > 0 ? (
            <ul>
              {shown.pages.map((p) => (
                <li key={p.id}>
                  <a href={p.href} onClick={toClassic}>
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>It’s still being fitted out: its pages are on their way.</p>
          )}
          <div className="actions">
            <a className="btn primary" href={shown.siteHref} onClick={toClassic}>
              Open classic page <Icon icon={faArrowUpRightFromSquare} />
            </a>
            <button className="btn" type="button" onClick={() => controller.requestCloseLandmark()}>
              Close <kbd>Space</kbd>
            </button>
          </div>
        </article>
      )}
    </dialog>
  );
}
