import { DEFAULT_CHARACTER, isCharacterId, type CharacterId } from '../player/characters';

const KEYS = {
  mode: 'site.mode',
  reduceMotion: 'site.reduceMotion',
  pauseAmbient: 'site.pauseAmbient',
  onboardingSeen: 'site.onboardingSeen',
  timeMode: 'site.timeMode',
  sound: 'site.sound',
  music: 'site.music',
  character: 'site.character',
} as const;

type Mode = 'play' | 'classic';
type TimeMode = 'cycle' | 'local' | 'day';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (privacy mode); preferences simply won't persist.
  }
}

export const prefs = {
  getMode: (): Mode | null => {
    const v = read(KEYS.mode);
    return v === 'play' || v === 'classic' ? v : null;
  },
  setMode: (m: Mode) => write(KEYS.mode, m),
  getReduceMotion: () => read(KEYS.reduceMotion) === '1',
  setReduceMotion: (v: boolean) => write(KEYS.reduceMotion, v ? '1' : '0'),
  getPauseAmbient: () => read(KEYS.pauseAmbient) === '1',
  setPauseAmbient: (v: boolean) => write(KEYS.pauseAmbient, v ? '1' : '0'),
  getOnboardingSeen: () => read(KEYS.onboardingSeen) === '1',
  setOnboardingSeen: () => write(KEYS.onboardingSeen, '1'),
  getTimeMode: (): TimeMode => {
    const v = read(KEYS.timeMode);
    return v === 'local' || v === 'day' ? v : 'cycle';
  },
  setTimeMode: (m: TimeMode) => write(KEYS.timeMode, m),
  /** Sound is on unless the visitor turned it off. */
  getSound: () => read(KEYS.sound) !== '0',
  setSound: (v: boolean) => write(KEYS.sound, v ? '1' : '0'),
  /** Background music is on unless the visitor turned it off (it only plays with sound on). */
  getMusic: () => read(KEYS.music) !== '0',
  setMusic: (v: boolean) => write(KEYS.music, v ? '1' : '0'),
  getCharacter: (): CharacterId => {
    const v = read(KEYS.character);
    return isCharacterId(v) ? v : DEFAULT_CHARACTER;
  },
  setCharacter: (id: CharacterId) => write(KEYS.character, id),
};
