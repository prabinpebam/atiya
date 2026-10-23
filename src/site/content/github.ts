/**
 * An anonymous public-profile calendar, not a record of public repositories: GitHub can include the
 * anonymised private contribution counts a person has chosen to display. No repository data is kept.
 */
export interface GitHubDay {
  /** A UTC calendar date, YYYY-MM-DD. */
  date: string;
  /** The public profile's contribution count, including any publicly displayed anonymised counts. */
  count: number;
  /** GitHub's own relative intensity, not a locally calculated threshold. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Exactly 365 ascending, contiguous UTC dates ending at `through`. */
export interface GitHubSnapshot {
  login: string;
  fetchedAt: string;
  through: string;
  days: GitHubDay[];
}

const DAY = 86_400_000;
const DAYS = 365;
const MAX_HTML = 2_000_000;
const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Expected invalid snapshot or changed-calendar failures; callers must not swallow other errors. */
export class GitHubDataError extends Error {
  constructor(message: string) {
    super(`GitHub calendar: ${message}`);
    this.name = 'GitHubDataError';
  }
}

function fail(message: string): never {
  throw new GitHubDataError(message);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function dateTime(value: unknown, name: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${name} must be YYYY-MM-DD`);
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) fail(`${name} is not a real UTC date`);
  return time;
}

function dateAt(time: number): string {
  const date = new Date(time).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('date window is outside the supported four-digit years');
  return date;
}

function checkedDay(value: unknown, name: string): GitHubDay {
  const day = record(value, name);
  dateTime(day.date, `${name}.date`);
  if (typeof day.count !== 'number' || !Number.isSafeInteger(day.count) || day.count < 0) fail(`${name}.count must be a non-negative safe integer`);
  if (typeof day.level !== 'number' || !Number.isInteger(day.level) || day.level < 0 || day.level > 4) fail(`${name}.level must be an integer from 0 to 4`);
  if ((day.count === 0) !== (day.level === 0)) fail(`${name}.count and level disagree about zero activity`);
  return { date: day.date as string, count: day.count, level: day.level as GitHubDay['level'] };
}

function checkedWindow(days: GitHubDay[], through: string): GitHubDay[] {
  const end = dateTime(through, 'through');
  if (days.length !== DAYS) fail(`expected exactly ${DAYS} days, received ${days.length}`);
  let total = 0;
  for (let i = 0; i < DAYS; i++) {
    const expected = dateAt(end - (DAYS - 1 - i) * DAY);
    if (days[i]!.date !== expected) fail(`days must be ascending and contiguous: expected ${expected} at index ${i}`);
    total += days[i]!.count;
    if (!Number.isSafeInteger(total)) fail('total contribution count exceeds the safe integer limit');
  }
  return days;
}

/** Validates untrusted JSON and returns only the public snapshot fields. Never repairs bad data. */
export function validateGitHubSnapshot(value: unknown): GitHubSnapshot {
  const snapshot = record(value, 'snapshot');
  if (typeof snapshot.login !== 'string' || !LOGIN.test(snapshot.login)) fail('login must be a valid GitHub username (1–39 letters, digits or single internal hyphens)');
  dateTime(snapshot.through, 'through');
  if (typeof snapshot.fetchedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(snapshot.fetchedAt)) fail('fetchedAt must be an ISO UTC timestamp');
  const fetched = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(fetched) || new Date(fetched).toISOString() !== snapshot.fetchedAt.replace(/Z$/, snapshot.fetchedAt.includes('.') ? 'Z' : '.000Z')) fail('fetchedAt is not a real ISO UTC timestamp');
  if (!Array.isArray(snapshot.days)) fail('days must be an array');
  if (snapshot.days.length !== DAYS) fail(`expected exactly ${DAYS} days, received ${snapshot.days.length}`);
  const days = Array.from(snapshot.days, (day, i) => checkedDay(day, `days[${i}]`));
  return {
    login: snapshot.login,
    fetchedAt: snapshot.fetchedAt,
    through: snapshot.through as string,
    days: checkedWindow(days, snapshot.through as string),
  };
}

function attributes(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const attr = /\s+([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy;
  let offset = 0;
  while (offset < source.length) {
    if (/^\s*\/?\s*$/.test(source.slice(offset))) break;
    attr.lastIndex = offset;
    const match = attr.exec(source);
    if (!match) fail('malformed HTML attributes; GitHub markup may have changed');
    const name = match[1]!.toLowerCase();
    if (found.has(name)) fail(`duplicate HTML attribute ${name}`);
    found.set(name, match[2] ?? match[3] ?? match[4] ?? '');
    offset = attr.lastIndex;
  }
  return found;
}

function tooltipCount(text: string, date: string): number {
  const match = /^(No contributions|1 contribution|(?:[2-9]|[1-9]\d+) contributions|[1-9]\d{0,2}(?:,\d{3})+ contributions) on ([A-Za-z]+) (\d{1,2})(st|nd|rd|th)(?:, (\d{4}))?\.$/.exec(text.trim());
  if (!match) fail('unrecognised contribution tooltip; GitHub markup may have changed');
  const dayNumber = Number(date.slice(8));
  const suffix = dayNumber % 100 >= 11 && dayNumber % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][dayNumber % 10] ?? 'th');
  if (match[2] !== MONTHS[Number(date.slice(5, 7)) - 1] || Number(match[3]) !== dayNumber || match[4] !== suffix || (match[5] && match[5] !== date.slice(0, 4))) fail('tooltip date does not match its calendar cell');
  const count = match[1] === 'No contributions' ? 0 : Number(match[1]!.split(' ')[0]!.replaceAll(',', ''));
  if (!Number.isSafeInteger(count) || count < 0) fail('tooltip contribution count must be a non-negative safe integer');
  return count;
}

/**
 * Parses GitHub's public HTML, joining cells and separate English tooltips by ID before sorting.
 * Validates all observed cells, including leading/out-of-window dates, then keeps exactly 365 days.
 */
export function parsePublicCalendar(html: string, through: string): GitHubDay[] {
  const end = dateTime(through, 'through');
  const start = dateAt(end - (DAYS - 1) * DAY);
  if (typeof html !== 'string' || html.length === 0 || html.length > MAX_HTML) fail('HTML is empty or exceeds the bounded response size');
  const cells = new Map<string, { date: string; level: string }>();
  const dates = new Set<string>();
  // Ignore inert markup rather than accidentally accepting a stale calendar in a comment or script.
  const markup = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const match of markup.matchAll(/<td\b([^>]*)>/gi)) {
    const attr = attributes(match[1]!);
    if (!attr.has('data-date') && !attr.get('id')?.startsWith('contribution-day-component-') && !attr.get('class')?.split(/\s+/).includes('ContributionCalendar-day')) continue;
    const date = attr.get('data-date');
    dateTime(date, 'cell date');
    const id = attr.get('id');
    if (!id || !/^contribution-day-component-\d+-\d+$/.test(id)) fail('missing or unrecognised contribution cell ID');
    if (cells.has(id)) fail('duplicate contribution cell ID');
    if (dates.has(date!)) fail('duplicate contribution date');
    const level = attr.get('data-level');
    if (!level || !/^[0-4]$/.test(level)) fail('cell level must be 0, 1, 2, 3 or 4');
    cells.set(id, { date: date!, level });
    dates.add(date!);
    if (cells.size > 732) fail('too many calendar cells');
  }
  if (!cells.size) fail('no contribution cells found; GitHub markup may have changed');
  const joined = new Map<string, GitHubDay>();
  for (const match of markup.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip\s*>/gi)) {
    const attr = attributes(match[1]!);
    const id = attr.get('for');
    if (!id || !cells.has(id)) fail('tooltip ID does not match a contribution cell');
    if (joined.has(id)) fail('duplicate tooltip for a contribution cell');
    const cell = cells.get(id)!;
    const count = tooltipCount(match[2]!, cell.date);
    joined.set(id, checkedDay({ date: cell.date, count, level: Number(cell.level) }, 'calendar day'));
  }
  if (joined.size !== cells.size) fail('missing contribution tooltips; GitHub markup may have changed');
  const days = [...joined.values()].filter((day) => day.date >= start && day.date <= through).sort((a, b) => a.date.localeCompare(b.date));
  return checkedWindow(days, through);
}

/** Seven trailing UTC dates; mean per calendar day; ties for best day choose the earliest date. */
export function contributionStats(snapshot: GitHubSnapshot): {
  total: number;
  thisWeek: number;
  activeDays: number;
  average: number;
  bestDay: GitHubDay;
  longestStreak: number;
  currentStreak: number;
} {
  const { days } = validateGitHubSnapshot(snapshot);
  let total = 0;
  let activeDays = 0;
  let longestStreak = 0;
  let streak = 0;
  let bestDay = days[0]!;
  for (const day of days) {
    total += day.count;
    if (day.count > bestDay.count) bestDay = day;
    if (day.count > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }
  let currentStreak = 0;
  let i = days.length - 1;
  if (days[i]!.count === 0) i--;
  for (; i >= 0 && days[i]!.count > 0; i--) currentStreak++;
  return {
    total,
    thisWeek: days.slice(-7).reduce((sum, day) => sum + day.count, 0),
    activeDays,
    average: total / DAYS,
    bestDay,
    longestStreak,
    currentStreak,
  };
}
