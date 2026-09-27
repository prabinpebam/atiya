/**
 * Web Audio playback for the planet: two ambience loops (stream, wind), bird calls, footsteps and
 * the landmark cues, all from the CC0 sprites built by scripts/build-audio.py. Nothing is fetched
 * or created until the player starts (a user gesture) with sound on.
 */
import { AUDIO } from './audioManifest';
import { MUSIC } from './musicManifest';
import { CHORDS, birdsSing, cricketLevel, frogLevel, nextBirdDelay, nextCroakDelay, nightSoon, pickVariant, strumSamples, windMix, type Surface } from './audioLogic';
import { withBase } from '../platform/base';

type BufferKey = keyof typeof AUDIO;
type SpriteKey = 'steps' | 'birds' | 'ui' | 'dog' | 'croaks';

export interface SoundEvent {
  /** performance.now() when it was asked for. */
  t: number;
  kind: 'step' | 'bird' | 'croak' | 'chime' | 'doorOpen' | 'doorClose' | 'curtain' | 'sparkle' | 'pickup' | 'hit' | 'rustle' | 'bark' | 'sniff' | 'whistle' | 'strum';
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
  /** How far (u) the player is from the nearest water's edge (the stream or the pond; < 0 in it). */
  water: number;
}

/** Overall mix: subtle under the visuals, the ambience a bed and the cues a little forward. */
const MIX = {
  master: 0.9,
  stream: 0.55,
  wind: 0.3,
  birds: 0.32,
  /** The night: the crickets a soft bed, the frogs' chorus and their croaks by the water. */
  crickets: 0.3,
  frogs: 0.32,
  croak: 0.3,
  duck: 0.3,
  steps: { grass: 0.34, wood: 0.4, stone: 0.3, water: 0.36 } satisfies Record<Surface, number>,
  chime: 0.36,
  sparkle: 0.3,
  doorOpen: 0.42,
  doorClose: 0.38,
  curtain: 0.4,
  /** Chopper (chopper.md §6): barks a little forward, sniffs and panting only up close. */
  bark: 0.34,
  sniff: 0.3,
  whistle: 0.3,
  pant: 0.22,
  /** Prabin's guitar, from where he sits. */
  strum: 0.32,
  /** Background music: slightly subtle, a bed under the ambience; a little lower under dialogs. */
  music: 0.2,
  musicDuck: 0.65,
} as const;
/** Slots start this much early and end this much late, so an MP3 decoder's priming offset never clips a sound. */
const SLOT_SLACK = 0.02;
const KEYS = Object.keys(AUDIO) as BufferKey[];
/** Fetched on unlock; the night set (`lazy`) only once night first falls. */
const lazy = (k: BufferKey) => 'lazy' in AUDIO[k];

type Ctor = typeof AudioContext;

export class SoundEngine {
  enabled: boolean;
  /** Most recent cues (newest last) — for the test hook and debugging. */
  readonly events: SoundEvent[] = [];
  private readonly strums: Array<AudioBuffer | undefined> = [];
  /** Current ambience targets (0…1 before the mix), for the test hook. */
  readonly levels = { stream: 0, streamPan: 0, wind: 0, windCutoff: 0, birds: false, crickets: 0, frogs: 0 };
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private fx: GainNode | null = null;
  private stream: { gain: GainNode; pan: StereoPannerNode } | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private pantLoop: { gain: GainNode; pan: StereoPannerNode } | null = null;
  private readonly night = new Map<'crickets' | 'frogs', GainNode>();
  private nightLoading = false;
  private croakTimer = 2;
  private readonly buffers = new Map<BufferKey, AudioBuffer>();
  private loading = false;
  private readonly last = new Map<string, number>();
  private birdTimer = 3;
  private ducked = false;
  private hidden = false;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;
  /** Background music: streamed from an <audio> element through its own gain (not decoded whole). */
  private music: { el: HTMLAudioElement; gain: GainNode; track: number } | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | undefined;
  musicOn: boolean;

  constructor(enabled: boolean, private readonly rand: () => number = Math.random, musicOn = true) {
    this.enabled = enabled;
    this.musicOn = musicOn;
  }

  /** Music state, for the test hook: on/off, whether it's playing, and the track. */
  get musicState(): { on: boolean; playing: boolean; track: number; url: string | null } {
    const m = this.music;
    return { on: this.musicOn, playing: !!m && !m.el.paused, track: m?.track ?? -1, url: m ? MUSIC[m.track].url : null };
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
    this.startMusic();
  }

  /** Start the music (once unlocked, with sound and music on): a random track, fading in gently. */
  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled || !this.musicOn || typeof Audio === 'undefined') return;
    if (this.music) {
      this.resumeMusic();
      return;
    }
    const track = MUSIC.length > 1 ? Math.floor(this.rand() * MUSIC.length) % MUSIC.length : 0;
    const el = new Audio();
    el.preload = 'auto';
    el.src = withBase(MUSIC[track].url);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    try {
      ctx.createMediaElementSource(el).connect(gain).connect(this.master);
    } catch {
      return;
    }
    this.music = { el, gain, track };
    // one track after the other, round the playlist
    el.addEventListener('ended', () => this.nextTrack());
    this.resumeMusic(1.5);
  }

  private musicLevel(): number {
    return MIX.music * (this.ducked ? MIX.musicDuck : 1);
  }

  /** Play (or keep playing) and fade up to the music level after `delay` s. */
  private resumeMusic(delay = 0): void {
    const m = this.music;
    const ctx = this.ctx;
    if (!m || !ctx || !this.enabled || !this.musicOn || this.hidden) return;
    clearTimeout(this.musicTimer);
    void m.el.play().catch(() => undefined);
    m.gain.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.gain.setTargetAtTime(this.musicLevel(), ctx.currentTime + delay, 1.4);
  }

  /** Fade the music out, then pause it (so it doesn't stream or play on while it can't be heard). */
  private pauseMusic(fade = 0.25): void {
    const m = this.music;
    if (!m) return;
    clearTimeout(this.musicTimer);
    if (this.ctx) {
      m.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      m.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    }
    this.musicTimer = setTimeout(() => m.el.pause(), fade * 1000);
  }

  private nextTrack(): void {
    const m = this.music;
    if (!m) return;
    m.track = (m.track + 1) % MUSIC.length;
    m.el.src = withBase(MUSIC[m.track].url);
    if (this.ctx) m.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.resumeMusic(0.6);
  }

  /** Music on/off (remembered by the controller); only audible with sound on. */
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.pauseMusic(0.6);
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
    this.pauseMusic();
    // let the fade finish, then stop the audio thread entirely
    this.suspendTimer = setTimeout(() => {
      if (!this.enabled) void this.ctx?.suspend().catch(() => undefined);
    }, 300);
  }

  /** Page hidden: stop the audio thread; visible again: carry on (if sound is on). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) {
      void this.ctx.suspend().catch(() => undefined);
      this.music?.el.pause();
    } else if (this.enabled) {
      void this.ctx.resume().catch(() => undefined);
      this.resumeMusic();
    }
  }

  /** Dialog or menu open: the ambience steps back. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (this.ctx && this.ambience) this.ambience.gain.setTargetAtTime(ducked ? MIX.duck : 1, this.ctx.currentTime, 0.2);
    if (this.ctx && this.music && !this.music.el.paused) this.music.gain.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 0.4);
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
    L.crickets = cricketLevel(f.night);
    L.frogs = frogLevel(f.night, f.water);
    if (nightSoon(f.night)) this.loadNight();
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
      this.night.get('crickets')?.gain.setTargetAtTime(MIX.crickets * L.crickets, t, 0.8);
      this.night.get('frogs')?.gain.setTargetAtTime(MIX.frogs * L.frogs, t, 0.6);
    }
    this.croakTimer -= Math.min(Math.max(dt, 0), 0.25);
    if (this.croakTimer <= 0) {
      this.croakTimer = nextCroakDelay(this.rand);
      if (L.frogs > 0.15 && !this.ducked) this.play('croaks', 'croak', 'croak', { gain: MIX.croak * L.frogs * (0.7 + 0.3 * this.rand()), rate: 0.9 + 0.2 * this.rand(), pan: (this.rand() * 2 - 1) * 0.7, bus: 'ambience' });
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

  /** An item reached the backpack: a quick bright pop (the sparkle, pitched up and short). */
  pickup(): void {
    this.play('ui', 'sparkle', 'pickup', { gain: MIX.sparkle * 0.45, rate: 1.65 + 0.25 * this.rand() });
  }

  /** A strum of Prabin's guitar (chord 0–3: G, C, D, Em), from where the guitar is (`pan` −1…1, `near` 0…1 by distance). */
  strum(chord: number, pan: number, near: number): void {
    const ctx = this.ctx;
    const ok = !!(ctx && this.enabled && ctx.state === 'running' && !this.hidden && near > 0.02);
    this.events.push({ t: performance.now(), kind: 'strum', detail: String(chord), played: ok });
    if (this.events.length > 40) this.events.shift();
    if (!ok || !ctx) return;
    const i = ((chord % CHORDS.length) + CHORDS.length) % CHORDS.length;
    let buf = this.strums[i];
    if (!buf) {
      // synthesised once per chord, the first time it's played
      const data = strumSamples(CHORDS[i], ctx.sampleRate, 2.2, this.rand);
      buf = this.strums[i] = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.getChannelData(0).set(data);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = MIX.strum * near * (0.85 + 0.3 * this.rand());
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan * 0.8));
    src.connect(g).connect(p).connect(this.fx!);
    src.start();
  }

  /** The pickaxe strikes a boulder: a low stone knock (`k` scales it: quieter further off). */
  hit(k = 1): void {
    this.play('steps', 'stone', 'hit', { gain: MIX.steps.stone * 1.9 * k, rate: 0.7 + 0.1 * this.rand(), bus: 'fx' });
  }

  /**
   * Chopper barks, sniffs (with `pan` −1…1 from where he is on screen and `near` 0…1 by distance),
   * and the character's come-here whistle.
   */
  dog(kind: 'bark' | 'sniff', pan: number, near: number): void {
    const r = this.rand;
    const n = Math.max(0, Math.min(1, near));
    if (kind === 'bark') this.play('dog', 'bark', 'bark', { gain: MIX.bark * (0.35 + 0.65 * n) * (0.85 + 0.3 * r()), rate: 1.08 + 0.14 * r(), pan: pan * 0.8, bus: 'fx' });
    else if (n > 0.05) this.play('dog', 'sniff', 'sniff', { gain: MIX.sniff * n * (0.8 + 0.3 * r()), rate: 0.95 + 0.15 * r(), pan: pan * 0.8, bus: 'fx' });
  }

  whistle(): void {
    this.play('dog', 'whistle', 'whistle', { gain: MIX.whistle, rate: 0.97 + 0.06 * this.rand() });
  }

  /** Chopper's panting (0 = none … 1 = close by and panting), placed where he is. */
  setPant(level: number, pan: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.pantLoop || ctx.state !== 'running') return;
    this.pantLoop.gain.gain.setTargetAtTime(MIX.pant * Math.max(0, Math.min(1, level)), ctx.currentTime, 0.25);
    this.pantLoop.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)) * 0.8, ctx.currentTime, 0.2);
  }

  /** A shaken tree's leaves rustle (the cloth swish, brighter and softer). */
  rustle(): void {
    this.play('ui', 'curtain', 'rustle', { gain: MIX.curtain * 0.5, rate: 1.2 + 0.15 * this.rand() });
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
    this.fetchKeys(KEYS.filter((k) => !lazy(k)));
  }

  /** The night set, the first time night falls with the sound on. */
  private loadNight(): void {
    if (this.nightLoading || !this.ctx || !this.enabled) return;
    this.nightLoading = true;
    this.fetchKeys(KEYS.filter(lazy));
  }

  private fetchKeys(keys: readonly BufferKey[]): void {
    const ctx = this.ctx!;
    for (const key of keys) {
      fetch(withBase(AUDIO[key].url))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${AUDIO[key].url}`))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          this.buffers.set(key, buf);
          if (key === 'stream' || key === 'wind' || key === 'pant' || key === 'crickets' || key === 'frogs') this.startLoop(key, buf);
        })
        .catch((err) => console.warn('Sound failed to load:', err));
    }
  }

  private startLoop(key: 'stream' | 'wind' | 'pant' | 'crickets' | 'frogs', buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const m = AUDIO[key];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = m.loopStart;
    src.loopEnd = m.loopEnd;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    if (key === 'crickets' || key === 'frogs') {
      src.connect(gain).connect(this.ambience!);
      this.night.set(key, gain);
    } else if (key === 'stream' || key === 'pant') {
      const pan = ctx.createStereoPanner();
      src.connect(gain).connect(pan).connect(key === 'pant' ? this.fx! : this.ambience!);
      if (key === 'pant') this.pantLoop = { gain, pan };
      else this.stream = { gain, pan };
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
    clearTimeout(this.musicTimer);
    if (this.music) {
      this.music.el.pause();
      this.music.el.removeAttribute('src');
      this.music = null;
    }
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
