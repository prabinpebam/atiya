/**
 * Web Audio playback for the planet: two ambience loops (stream, wind), bird calls, footsteps and
 * the landmark cues, all from the CC0 sprites built by scripts/build-audio.py. Nothing is fetched
 * or created until the player starts (a user gesture) with sound on.
 */
import { AUDIO } from './audioManifest';
import { birdsSing, nextBirdDelay, pickVariant, windMix, type Surface } from './audioLogic';

type BufferKey = keyof typeof AUDIO;
type SpriteKey = 'steps' | 'birds' | 'ui';

export interface SoundEvent {
  /** performance.now() when it was asked for. */
  t: number;
  kind: 'step' | 'bird' | 'chime' | 'doorOpen' | 'doorClose' | 'curtain' | 'sparkle';
  detail?: string;
  /** Whether it was actually scheduled (false while muted, locked or still loading). */
  played: boolean;
}

export interface SoundFrame {
  /** WindFx strength (0.3…1) and gust (0…1). */
  strength: number;
  gust: number;
  /** Stream loudness 0…1 and its stereo position −1 (left) … 1 (right). */
  stream: number;
  streamPan: number;
  /** 0 = day … 1 = night. */
  night: number;
}

/** Overall mix: subtle under the visuals, the ambience a bed and the cues a little forward. */
const MIX = {
  master: 0.9,
  stream: 0.55,
  wind: 0.3,
  birds: 0.32,
  duck: 0.3,
  steps: { grass: 0.34, wood: 0.4, stone: 0.3, water: 0.36 } satisfies Record<Surface, number>,
  chime: 0.36,
  sparkle: 0.3,
  doorOpen: 0.42,
  doorClose: 0.38,
  curtain: 0.4,
} as const;
/** Slots start this much early and end this much late, so an MP3 decoder's priming offset never clips a sound. */
const SLOT_SLACK = 0.02;
const KEYS = Object.keys(AUDIO) as BufferKey[];

type Ctor = typeof AudioContext;

export class SoundEngine {
  enabled: boolean;
  /** Most recent cues (newest last) — for the test hook and debugging. */
  readonly events: SoundEvent[] = [];
  /** Current ambience targets (0…1 before the mix), for the test hook. */
  readonly levels = { stream: 0, streamPan: 0, wind: 0, windCutoff: 0, birds: false };
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private fx: GainNode | null = null;
  private stream: { gain: GainNode; pan: StereoPannerNode } | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private readonly buffers = new Map<BufferKey, AudioBuffer>();
  private loading = false;
  private readonly last = new Map<string, number>();
  private birdTimer = 3;
  private ducked = false;
  private hidden = false;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(enabled: boolean, private readonly rand: () => number = Math.random) {
    this.enabled = enabled;
  }

  get state(): AudioContextState | 'none' {
    return this.ctx?.state ?? 'none';
  }

  get loaded(): number {
    return this.buffers.size;
  }

  get total(): number {
    return KEYS.length;
  }

  /** Call from a user gesture: creates or resumes the audio context and starts loading. */
  unlock(): void {
    if (!this.enabled || typeof window === 'undefined') return;
    const Ctx: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      try {
        this.ctx = new Ctx();
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = MIX.master;
      this.master.connect(ctx.destination);
      this.ambience = ctx.createGain();
      this.ambience.gain.value = this.ducked ? MIX.duck : 1;
      this.ambience.connect(this.master);
      this.fx = ctx.createGain();
      this.fx.connect(this.master);
    }
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume().catch(() => undefined);
    this.load();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    clearTimeout(this.suspendTimer);
    if (on) {
      this.unlock();
      this.master?.gain.setTargetAtTime(MIX.master, this.ctx!.currentTime, 0.05);
      return;
    }
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    // let the fade finish, then stop the audio thread entirely
    this.suspendTimer = setTimeout(() => {
      if (!this.enabled) void this.ctx?.suspend().catch(() => undefined);
    }, 300);
  }

  /** Page hidden: stop the audio thread; visible again: carry on (if sound is on). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend().catch(() => undefined);
    else if (this.enabled) void this.ctx.resume().catch(() => undefined);
  }

  /** Dialog or menu open: the ambience steps back. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (this.ctx && this.ambience) this.ambience.gain.setTargetAtTime(ducked ? MIX.duck : 1, this.ctx.currentTime, 0.2);
  }

  /** Per-frame: follow the wind and the player's distance to the stream; schedule birds. */
  update(dt: number, f: SoundFrame): void {
    const w = windMix(f.strength, f.gust);
    const L = this.levels;
    L.stream = f.stream;
    L.streamPan = f.streamPan;
    L.wind = w.level;
    L.windCutoff = w.cutoff;
    L.birds = birdsSing(f.night);
    const ctx = this.ctx;
    if (ctx && ctx.state === 'running') {
      const t = ctx.currentTime;
      if (this.stream) {
        this.stream.gain.gain.setTargetAtTime(MIX.stream * f.stream, t, 0.3);
        this.stream.pan.pan.setTargetAtTime(f.streamPan, t, 0.3);
      }
      if (this.wind) {
        this.wind.gain.gain.setTargetAtTime(MIX.wind * w.level, t, 0.4);
        this.wind.filter.frequency.setTargetAtTime(w.cutoff, t, 0.4);
      }
    }
    this.birdTimer -= Math.min(Math.max(dt, 0), 0.25);
    if (this.birdTimer <= 0) {
      this.birdTimer = nextBirdDelay(this.rand);
      if (L.birds && !this.ducked) this.bird();
    }
  }

  step(surface: Surface, run: boolean): void {
    const r = this.rand;
    this.play('steps', surface, 'step', { gain: MIX.steps[surface] * (run ? 1.15 : 1) * (0.85 + 0.3 * r()), rate: 0.93 + 0.14 * r(), bus: 'fx' });
  }

  /** Walked up to a landmark: a chime, then its door swings open (or the curtain rises). */
  approach(door: 'door' | 'curtain' | null): void {
    this.play('ui', 'chime', 'chime', { gain: MIX.chime });
    if (door === 'curtain') this.play('ui', 'curtain', 'curtain', { gain: MIX.curtain, delay: 0.08 });
    else if (door === 'door') this.play('ui', 'doorOpen', 'doorOpen', { gain: MIX.doorOpen, delay: 0.1 });
  }

  /** Walked away: the door swings shut (the thud lands as it closes) or the curtain drops. */
  leave(door: 'door' | 'curtain' | null): void {
    if (door === 'curtain') this.play('ui', 'curtain', 'curtain', { gain: MIX.curtain * 0.8, rate: 0.9, delay: 0.05 });
    else if (door === 'door') this.play('ui', 'doorClose', 'doorClose', { gain: MIX.doorClose, delay: 0.38 });
  }

  /** Opened a landmark's details. */
  open(): void {
    this.play('ui', 'sparkle', 'sparkle', { gain: MIX.sparkle });
  }

  private bird(): void {
    const r = this.rand;
    const pan = (r() * 2 - 1) * 0.75;
    const rate = 0.92 + 0.2 * r();
    const gain = MIX.birds * (0.6 + 0.4 * r());
    this.play('birds', 'song', 'bird', { gain, rate, pan, bus: 'ambience' });
    // now and then the same bird answers itself
    if (r() < 0.25) this.play('birds', 'song', 'bird', { gain: gain * 0.8, rate: rate * 1.03, pan, bus: 'ambience', delay: 1.4 + r() * 0.8, log: false });
  }

  private play(
    key: SpriteKey,
    group: string,
    kind: SoundEvent['kind'],
    o: { gain: number; rate?: number; pan?: number; delay?: number; bus?: 'fx' | 'ambience'; log?: boolean },
  ): void {
    const slots = (AUDIO[key].slots as Record<string, ReadonlyArray<readonly [number, number]>>)[group];
    const buf = this.buffers.get(key);
    const ctx = this.ctx;
    const ok = !!(slots && buf && ctx && this.enabled && ctx.state === 'running' && !this.hidden);
    if (o.log !== false) {
      this.events.push({ t: performance.now(), kind, detail: kind === 'step' ? group : undefined, played: ok });
      if (this.events.length > 40) this.events.shift();
    }
    if (!ok) return;
    const id = `${key}:${group}`;
    const i = pickVariant(slots.length, this.last.get(id) ?? -1, this.rand);
    this.last.set(id, i);
    const [start, dur] = slots[i];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = o.gain;
    let node: AudioNode = src.connect(g);
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node = node.connect(p);
    }
    node.connect(o.bus === 'ambience' ? this.ambience! : this.fx!);
    const offset = Math.max(0, start - SLOT_SLACK);
    src.start(ctx.currentTime + (o.delay ?? 0), offset, dur + (start - offset) + SLOT_SLACK);
  }

  private load(): void {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    const ctx = this.ctx;
    for (const key of KEYS) {
      fetch(AUDIO[key].url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${AUDIO[key].url}`))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          this.buffers.set(key, buf);
          if (key === 'stream' || key === 'wind') this.startLoop(key, buf);
        })
        .catch((err) => console.warn('Sound failed to load:', err));
    }
  }

  private startLoop(key: 'stream' | 'wind', buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const m = AUDIO[key];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = m.loopStart;
    src.loopEnd = m.loopEnd;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    if (key === 'stream') {
      const pan = ctx.createStereoPanner();
      src.connect(gain).connect(pan).connect(this.ambience!);
      this.stream = { gain, pan };
    } else {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.5;
      src.connect(filter).connect(gain).connect(this.ambience!);
      this.wind = { gain, filter };
    }
    // start somewhere inside the loop so a revisit doesn't always open the same way
    src.start(0, m.loopStart + this.rand() * (m.loopEnd - m.loopStart));
  }

  dispose(): void {
    clearTimeout(this.suspendTimer);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
