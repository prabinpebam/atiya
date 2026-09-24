const KEYS = {
  mode: 'site.mode',
  reduceMotion: 'site.reduceMotion',
  pauseAmbient: 'site.pauseAmbient',
  onboardingSeen: 'site.onboardingSeen',
  timeMode: 'site.timeMode',
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
};
