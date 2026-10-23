import type { GitHubDay, GitHubSnapshot } from '../content/github';

/** The public calendar and its precomputed, visible-profile statistics. */
export interface ContributionData extends GitHubSnapshot {
  stats: { total: number; thisWeek: number; activeDays: number; average: number; bestDay: GitHubDay; longestStreak: number; currentStreak: number };
}

export interface Point { x: number; y: number }
export interface ContributionMonth extends Point { label: string; date: string }
export interface Orientation { yaw: number; pitch: number }
export interface ContributionColumn {
  index: number;
  level: number;
  faces: Point[][];
  depth: number;
}
export interface ContributionScene { columns: ContributionColumn[]; months: ContributionMonth[]; width: number; height: number }

/** Orthographic isometric: equal foreshortening of the three world axes. */
export const ISOMETRIC: Orientation = { yaw: Math.PI / 4, pitch: Math.atan(1 / Math.sqrt(2)) };
export const TUMBLE = { yaw: Math.PI / 9, pitch: Math.PI / 12 };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** A restrained look around the calendar, never upside down or behind it. */
export function tumble(dx: number, dy: number, width: number): Orientation {
  const scale = Math.max(1, width);
  return {
    yaw: ISOMETRIC.yaw + clamp(dx / scale * 2, -TUMBLE.yaw, TUMBLE.yaw),
    pitch: ISOMETRIC.pitch + clamp(dy / scale * 2, -TUMBLE.pitch, TUMBLE.pitch),
  };
}

/** Ease back to the exact resting view; no residual animation or floating-point drift. */
export function returnOrientation(from: Orientation, progress: number): Orientation {
  const p = clamp(progress, 0, 1);
  if (p === 1) return { ...ISOMETRIC };
  const t = 1 - (1 - p) ** 3;
  return { yaw: from.yaw + (ISOMETRIC.yaw - from.yaw) * t, pitch: from.pitch + (ISOMETRIC.pitch - from.pitch) * t };
}

/** A count is height, not its colour level; very busy days stay legible without hiding the rest. */
export const columnHeight = (count: number, maximum: number) => count === 0 ? 0.05 : 0.18 + Math.sqrt(count / Math.max(1, maximum)) * 5;

/** Projects actual cuboids, depth-sorted, with the same date grid in both representations. */
export function contributionScene(days: readonly GitHubDay[], width: number, height: number, mode: '2d' | '3d', view = ISOMETRIC): ContributionScene {
  if (!days.length || width <= 0 || height <= 0) return { columns: [], months: [], width, height };
  const start = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const weeks = Math.ceil((start + days.length) / 7);
  const maximum = Math.max(1, ...days.map((d) => d.count));
  const project = (x: number, y: number, z: number): Point => {
    if (mode === '2d') return { x, y: z };
    const horizontal = x * Math.cos(view.yaw) - z * Math.sin(view.yaw);
    const depth = x * Math.sin(view.yaw) + z * Math.cos(view.yaw);
    return { x: horizontal, y: depth * Math.sin(view.pitch) - y * Math.cos(view.pitch) };
  };
  const columns = days.map((day, index): ContributionColumn => {
    const cell = index + start;
    const x = Math.floor(cell / 7) - weeks / 2;
    const z = cell % 7 - 3.5;
    const size = 0.86;
    const h = mode === '2d' ? 0 : columnHeight(day.count, maximum);
    const base = [project(x, 0, z), project(x + size, 0, z), project(x + size, 0, z + size), project(x, 0, z + size)];
    const top = [project(x, h, z), project(x + size, h, z), project(x + size, h, z + size), project(x, h, z + size)];
    return {
      index,
      level: day.level,
      faces: mode === '2d' ? [top] : [[base[2], base[3], top[3], top[2]], [base[1], base[2], top[2], top[1]], top],
      depth: x * Math.sin(view.yaw) + z * Math.cos(view.yaw),
    };
  });
  const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
  const months = days.flatMap((day, index): ContributionMonth[] => {
    if (!day.date.endsWith('-01')) return [];
    const x = Math.floor((index + start) / 7) - weeks / 2 + 0.43;
    return [{ ...project(x, 0, mode === '2d' ? -4.75 : 4.5), date: day.date, label: monthFormat.format(new Date(`${day.date}T00:00:00Z`)) }];
  });
  const points = [...columns.flatMap((c) => c.faces.flat()), ...months];
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const margin = Math.min(width, height) * 0.055;
  const scale = Math.min((width - margin * 2) / (maxX - minX), (height - margin * 2) / (maxY - minY));
  const ox = (width - (maxX - minX) * scale) / 2;
  const oy = (height - (maxY - minY) * scale) / 2;
  for (const p of new Set(points)) {
    p.x = ox + (p.x - minX) * scale;
    p.y = oy + (p.y - minY) * scale;
  }
  columns.sort((a, b) => a.depth - b.depth || a.index - b.index);
  return { columns, months, width, height };
}

/** Hit testing uses the rendered faces, back to front, including a tall column's sides. */
export function columnAt(scene: ContributionScene, point: Point): number | null {
  for (let i = scene.columns.length - 1; i >= 0; i--) {
    const col = scene.columns[i];
    for (const face of col.faces) {
      let inside = false;
      for (let j = 0, k = face.length - 1; j < face.length; k = j++) {
        const a = face[j], b = face[k];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      if (inside) return col.index;
    }
  }
  return null;
}

/** Keep month names readable on small canvases, without changing their true calendar positions. */
export function readableMonths(months: readonly ContributionMonth[], width: number, height: number, gap: number): ContributionMonth[] {
  const shown: ContributionMonth[] = [];
  for (const month of months) {
    const previous = shown.at(-1);
    if (previous && Math.abs(month.x - previous.x) < width + gap && Math.abs(month.y - previous.y) < height + gap) continue;
    shown.push(month);
  }
  return shown;
}

/** Calendar-key navigation: a week horizontally, a day vertically. */
export function calendarKey(index: number, key: string, length: number): number | null {
  const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, Home: -length, End: length };
  return key in step ? clamp(index + step[key], 0, length - 1) : null;
}
