/**
 * The lightbox's stage, by kind (tier 0; docs: documentation/gallery/spec.md §8.2): a picture, a drawing
 * as large as the stage allows (on the paper panel in the dark when it has no dark version), an animated
 * picture with Pause and Play over its corner (paused at first under reduced motion), a video file's player
 * with its caption tracks, and an embed's poster with Play, its player made only after a press. A player
 * is removed when the reader moves on. `lightbox.ts` drives it; the rules are pure in `lightboxRules.ts`.
 */
import { posterOf, stageKind, stageOf, stillOf, type LightboxItem } from './lightboxRules';

export interface StageParts {
  stage: HTMLElement;
  image: HTMLImageElement;
  /** Where a video's player or an embed's frame goes. */
  player: HTMLElement;
  /** An embed's Play, over its poster. */
  facade: HTMLElement;
  facadePlay: HTMLButtonElement;
  /** An animated picture's Pause and Play. */
  motion: HTMLElement;
  pause: HTMLButtonElement;
  play: HTMLButtonElement;
}

export interface Stage {
  /** Shows an item; `pressed`: the reader opened the lightbox by pressing this item (a video plays, an embed's Play takes the focus). */
  show(item: LightboxItem, dark: boolean, pressed: boolean): void;
  /** Follows the theme without restarting a player. */
  retheme(item: LightboxItem, dark: boolean): void;
  /** Removes any player (the lightbox closing). */
  clear(): void;
  /** Sizes a drawing to the stage again (it changed size). */
  fit(): void;
}

export function createStage(p: StageParts, reduce: boolean): Stage {
  let item: LightboxItem | null = null;
  let dark = false;
  let paused = reduce;

  const clear = () => {
    p.player.querySelectorAll('video').forEach((v) => v.pause());
    p.player.textContent = '';
    p.player.hidden = true;
    p.facade.hidden = true;
    p.motion.hidden = true;
    p.image.hidden = false;
  };

  // a drawing is as large as the stage allows (it's sharp at any size), and so is an embed's player once
  // it's made: each its own shape (an embed's from its provider, else 16:9), scaled to fit
  const fit = () => {
    if (!item) return;
    const kind = stageKind(item);
    const frame = kind === 'embed' ? p.player.querySelector('iframe') : null;
    const target = kind === 'drawing' ? p.image : frame;
    if (!target) return;
    const w = item.width || (frame ? 16 : p.image.naturalWidth);
    const h = item.height || (frame ? 9 : p.image.naturalHeight);
    const room = p.stage.getBoundingClientRect();
    if (!w || !h || !room.width || !room.height) return;
    const r = Math.min(room.width / w, room.height / h);
    target.style.setProperty('--fit-w', `${Math.floor(w * r)}px`);
    target.style.setProperty('--fit-h', `${Math.floor(h * r)}px`);
  };

  const picture = () => {
    if (!item) return;
    const kind = stageKind(item);
    if (kind === 'animated') {
      const still = stillOf(item, dark);
      p.image.src = paused && still ? still : stageOf(item, dark);
      // each button sits in its own wrapper, which is what hides (a fundamental's display beats [hidden])
      p.pause.parentElement!.hidden = paused;
      p.play.parentElement!.hidden = !paused;
    } else if (kind === 'video' || kind === 'embed') {
      const poster = posterOf(item, dark);
      if (poster) p.image.src = poster;
      else p.image.removeAttribute('src');
      p.image.hidden = !poster || kind === 'video';
    } else if (kind === 'pending') {
      p.image.removeAttribute('src');
      p.image.hidden = true;
    } else {
      p.image.src = stageOf(item, dark);
    }
  };

  const video = (it: LightboxItem, pressed: boolean) => {
    const v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.loop = !!it.loop;
    const poster = posterOf(it, dark);
    if (poster) v.poster = poster;
    if (it.alt) v.setAttribute('aria-label', it.alt);
    const source = document.createElement('source');
    source.src = it.href;
    if (it.videoType) source.type = it.videoType;
    v.append(source);
    for (const t of it.tracks ?? []) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.src = t.src;
      track.srclang = t.srclang;
      track.label = t.label;
      track.default = !!t.default;
      v.append(track);
    }
    p.player.append(v);
    p.player.hidden = false;
    p.image.hidden = true;
    // it plays when the lightbox was opened by pressing it; reached by moving, it waits
    if (pressed) void v.play().catch(() => undefined);
  };

  const embed = (it: LightboxItem) => {
    const frame = document.createElement('iframe');
    frame.src = it.embedSrc!;
    frame.title = it.alt || 'Video';
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    p.player.append(frame);
    p.player.hidden = false;
    p.facade.hidden = true;
    p.image.hidden = true;
    fit();
    frame.focus();
  };

  p.facadePlay.addEventListener('click', () => item && stageKind(item) === 'embed' && embed(item));
  const toggle = (pause: boolean) => {
    paused = pause;
    picture();
    (pause ? p.play : p.pause).focus();
  };
  p.pause.addEventListener('click', () => toggle(true));
  p.play.addEventListener('click', () => toggle(false));
  p.image.addEventListener('load', fit);

  return {
    show(next, isDark, pressed) {
      clear();
      item = next;
      dark = isDark;
      paused = reduce;
      const kind = stageKind(next);
      p.stage.dataset.kind = kind;
      p.stage.toggleAttribute('data-paper', kind === 'drawing' && !next.hrefDark);
      p.image.alt = kind === 'video' || kind === 'embed' ? '' : next.alt;
      picture();
      if (kind === 'animated') p.motion.hidden = !stillOf(next, dark);
      if (kind === 'video') video(next, pressed);
      if (kind === 'embed') {
        p.facade.hidden = false;
        if (pressed) p.facadePlay.focus();
      }
      fit();
    },
    retheme(next, isDark) {
      dark = isDark;
      if (item === next && p.player.hidden) picture();
      const v = p.player.querySelector('video');
      const poster = posterOf(next, dark);
      if (v && poster) v.poster = poster;
    },
    clear() {
      clear();
      item = null;
    },
    fit,
  };
}
