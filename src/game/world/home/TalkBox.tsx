import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { faCaretDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { GameController } from '../../controller';
import { selectReducedMotion } from '../../state/store';
import { Icon } from '../../ui/Icon';

/** Characters per second of the dialog's typewriter reveal. */
const TALK_CPS = 45;

/**
 * Talking with one of the family (family.md §6): the name plate, the line typing out, and a "more"
 * marker. E / Enter / Space (or the button) completes the line, then goes on; Escape closes.
 * Non-modal: the keys stay with the planet, and each line is announced in the live region.
 */
export function TalkBox({ controller }: { controller: GameController }) {
  const talk = useStore(controller.store, (s) => s.talk);
  const reduced = useStore(controller.store, selectReducedMotion);
  const line = talk ? talk.lines[talk.index] : '';
  const [shown, setShown] = useState(0);
  const reveal = useRef(0);
  useEffect(() => {
    setShown(reduced ? line.length : 0);
  }, [talk?.id, talk?.index, line, reduced]);
  useEffect(() => {
    if (talk && talk.reveal !== reveal.current) {
      reveal.current = talk.reveal;
      setShown(line.length);
    }
  }, [talk, line]);
  useEffect(() => {
    const typing = Boolean(talk) && shown < line.length;
    controller.talkTyping = typing;
    if (!typing) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(line.length, n + 1)), 1000 / TALK_CPS);
    return () => window.clearTimeout(id);
  }, [shown, line, talk, controller]);
  if (!talk) return null;
  const done = shown >= line.length;
  const last = talk.index === talk.lines.length - 1;
  return (
    <section className="card talk-box lane" role="dialog" aria-label={`Talking with ${talk.name}`} data-testid="talk-box">
      <p className="talk-name">{talk.name}</p>
      <p className="sr-only">{line}</p>
      <p className="talk-line" aria-hidden="true" data-testid="talk-line">
        {line.slice(0, shown)}
        <span className="talk-rest">{line.slice(shown)}</span>
      </p>
      <div className="talk-actions">
        <button
          type="button"
          className="btn primary talk-next"
          data-testid="talk-next"
          onClick={() => {
            controller.advanceTalk();
            controller.focusRegion();
          }}
        >
          {done && last ? 'Bye' : 'Next'} <Icon icon={faCaretDown} className={done ? 'talk-more' : undefined} /> <kbd>E</kbd>
        </button>
        <button type="button" className="btn talk-close" aria-label="Stop talking" onClick={() => controller.endTalk()}>
          <Icon icon={faXmark} />
        </button>
      </div>
    </section>
  );
}

