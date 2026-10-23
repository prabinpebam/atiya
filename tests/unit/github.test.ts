import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshGitHub } from '../../scripts/refresh-github.mjs';
import { contributionStats, GitHubDataError, parsePublicCalendar, validateGitHubSnapshot, type GitHubDay, type GitHubSnapshot } from '../../src/site/content/github';

const disk = vi.hoisted(() => ({
  mkdir: vi.fn(), open: vi.fn(), readFile: vi.fn(), rename: vi.fn(), rm: vi.fn(),
}));
vi.mock('node:fs/promises', () => disk);

const DAY = 86_400_000;
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function days(through = '2026-10-23', count = 0, length = 365): GitHubDay[] {
  const end = Date.parse(`${through}T00:00:00Z`);
  return Array.from({ length }, (_, i) => ({
    date: new Date(end - (length - 1 - i) * DAY).toISOString().slice(0, 10),
    count,
    level: count ? 1 : 0,
  }));
}

function snapshot(over: Partial<GitHubSnapshot> = {}): GitHubSnapshot {
  return { login: 'made-up-user', fetchedAt: '2026-10-23T12:00:00.000Z', through: '2026-10-23', days: days(), ...over };
}

function html(input = days()): string {
  const cells = input.map((day, i) => `<td class="ContributionCalendar-day" data-date="${day.date}" id="contribution-day-component-${i % 7}-${Math.floor(i / 7)}" data-level="${day.level}"></td>`);
  const tooltips = input.map((day, i) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const n = date.getUTCDate();
    const suffix = n >= 11 && n <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    const count = day.count === 0 ? 'No contributions' : `${day.count.toLocaleString('en-US')} contribution${day.count === 1 ? '' : 's'}`;
    return `<tool-tip for="contribution-day-component-${i % 7}-${Math.floor(i / 7)}">${count} on ${months[date.getUTCMonth()]} ${n}${suffix}.</tool-tip>`;
  });
  // Deliberately row-major cells and independently reversed tooltip order.
  return `<table>${[...cells.filter((_, i) => i % 2), ...cells.filter((_, i) => !(i % 2))].join('')}</table>${tooltips.reverse().join('')}`;
}

describe('GitHub public calendar parser', () => {
  it('joins IDs independently of order, parses comma-separated counts and keeps exactly the rolling boundary', () => {
    const input = days('2026-10-24', 0, 372);
    input.find((day) => day.date === '2026-10-20')!.count = 1234;
    input.find((day) => day.date === '2026-10-20')!.level = 4;
    input.find((day) => day.date === '2026-10-23')!.count = 1;
    input.find((day) => day.date === '2026-10-23')!.level = 1;
    const result = parsePublicCalendar(html(input), '2026-10-23');
    expect(result).toHaveLength(365);
    expect(result[0]!.date).toBe('2025-10-24');
    expect(result.at(-1)).toEqual({ date: '2026-10-23', count: 1, level: 1 });
    expect(result.find((day) => day.date === '2026-10-20')!.count).toBe(1234);
  });

  it.each(['2024-03-01', '2024-12-30', '2024-12-31', '2000-03-01', '2100-03-01', '2026-03-09', '2026-11-02'])('uses UTC contiguous dates at leap/DST boundaries through %s', (through) => {
    expect(parsePublicCalendar(html(days(through)), through)).toEqual(days(through));
  });

  it('keeps the needed side of a leap-year calendar when the CLI joins yearly responses', () => {
    const leap = days('2024-12-31', 0, 366);
    expect(parsePublicCalendar(html(leap), '2024-12-30')[0]!.date).toBe('2024-01-01');
    expect(parsePublicCalendar(html(leap), '2024-12-31')[0]!.date).toBe('2024-01-02');
    const previous = parsePublicCalendar(html(days('2023-12-31')), '2023-12-31');
    const current = parsePublicCalendar(html(leap), '2024-12-30');
    const through = '2024-03-01';
    const expected = days(through);
    const joined = [...previous, ...current].filter((day) => day.date >= expected[0]!.date && day.date <= through);
    expect(validateGitHubSnapshot(snapshot({ through, days: joined })).days).toEqual(expected);
  });

  const calendar = html();
  it.each([
    ['missing date', () => html(days().slice(1))],
    ['duplicate date', () => calendar.replace('data-date="2025-10-25"', 'data-date="2025-10-24"')],
    ['duplicate cell ID', () => calendar.replace('id="contribution-day-component-1-0"', 'id="contribution-day-component-0-0"')],
    ['duplicate tooltip', () => `${calendar}<tool-tip for="contribution-day-component-0-0">No contributions on October 24th.</tool-tip>`],
    ['missing tooltip', () => calendar.replace(/<tool-tip\b[^>]*>[\s\S]*?<\/tool-tip>/, '')],
    ['mismatched ID', () => calendar.replace('for="contribution-day-component-0-0"', 'for="contribution-day-component-0-999"')],
    ['missing ID', () => calendar.replace('id="contribution-day-component-0-0"', '')],
    ['missing cell date', () => calendar.replace('data-date="2025-10-24"', '')],
    ['invalid date', () => calendar.replace('2025-10-24', '2025-02-29')],
    ['invalid level', () => calendar.replace('data-level="0"', 'data-level="5"')],
    ['fractional level', () => calendar.replace('data-level="0"', 'data-level="1.5"')],
    ['padded level', () => calendar.replace('data-level="0"', 'data-level="00"')],
    ['duplicate attribute', () => calendar.replace('data-level="0"', 'data-level="0" data-level="0"')],
    ['changed element', () => calendar.replaceAll('<td ', '<div ')],
    ['changed tooltip element', () => calendar.replaceAll('tool-tip', 'tooltip')],
    ['changed tooltip text', () => calendar.replace('No contributions', 'No activity')],
    ['wrong tooltip date', () => calendar.replace('October 24th.', 'October 25th.')],
    ['wrong tooltip year', () => calendar.replace('October 24th.', 'October 24th, 2026.')],
    ['wrong ordinal', () => calendar.replace('October 24th.', 'October 24st.')],
    ['negative count', () => calendar.replace('No contributions', '-1 contributions')],
    ['fractional count', () => calendar.replace('No contributions', '1.5 contributions')],
    ['bad comma grouping', () => calendar.replace('No contributions', '1,23 contributions')],
    ['unsafe count', () => calendar.replace('No contributions', '9,007,199,254,740,992 contributions')],
    ['level/count disagreement', () => calendar.replace('No contributions', '1 contribution')],
    ['inert markup', () => `<!--${calendar}-->`],
    ['script markup', () => `<script>${calendar}</script>`],
  ])('rejects %s', (_, mutate) => {
    expect(() => parsePublicCalendar(mutate(), '2026-10-23')).toThrow(GitHubDataError);
  });

  it('accepts single-quoted/reordered attributes and tooltip years without depending on tooltip ID', () => {
    const input = calendar.replaceAll('data-level="0"', "data-level='0'").replaceAll('<tool-tip for=', '<tool-tip id="unrelated-tooltip-id" for=').replace('October 24th.', 'October 24th, 2025.');
    expect(parsePublicCalendar(input, '2026-10-23')).toEqual(days());
  });

  it('validates extra leading cells instead of hiding corruption outside the retained window', () => {
    const extra = days('2026-10-23', 0, 370);
    extra[0]!.level = 4;
    expect(() => parsePublicCalendar(html(extra), '2026-10-23')).toThrow(/disagree/);
  });

  it('bounds HTML and cell counts', () => {
    expect(() => parsePublicCalendar('', '2026-10-23')).toThrow(/HTML/);
    expect(() => parsePublicCalendar('x'.repeat(2_000_001), '2026-10-23')).toThrow(/bounded/);
    expect(() => parsePublicCalendar(html(days('2026-10-23', 0, 733)), '2026-10-23')).toThrow(/too many/);
  });
});

describe('GitHub snapshot validation', () => {
  it('identifies expected data errors without hiding unrelated programmer errors', () => {
    expect(() => validateGitHubSnapshot(null)).toThrow(GitHubDataError);
    expect(() => parsePublicCalendar('', '2026-10-23')).toThrow(GitHubDataError);
    const broken = Object.defineProperty({}, 'login', { get() { throw new TypeError('programmer error'); } });
    expect(() => validateGitHubSnapshot(broken)).toThrow(TypeError);
  });

  it('returns the bounded public interface and accepts a timestamp without fractional seconds', () => {
    expect(validateGitHubSnapshot({ ...snapshot(), repository: 'not retained' })).toEqual(snapshot());
    expect(validateGitHubSnapshot(snapshot({ fetchedAt: '2026-10-23T12:00:00Z' })).fetchedAt).toBe('2026-10-23T12:00:00Z');
  });

  it.each(['a', 'A9', 'a-b', 'x'.repeat(39)])('accepts valid login %s', (login) => {
    expect(validateGitHubSnapshot(snapshot({ login })).login).toBe(login);
  });

  it.each(['', '-a', 'a-', 'a--b', 'a_b', '../a', 'a/b', 'x'.repeat(40)])('rejects invalid login %s', (login) => {
    expect(() => validateGitHubSnapshot(snapshot({ login }))).toThrow(/login/);
  });

  it.each([null, [], 'value', 0])('rejects a non-object snapshot (%s)', (value) => {
    expect(() => validateGitHubSnapshot(value)).toThrow(/object/);
  });

  it.each(['2025-02-29', '2024-02-30', '2026-13-01', '2026-1-01', '2026-10-23T00:00:00Z', 'not a date'])('rejects invalid through %s', (through) => {
    expect(() => validateGitHubSnapshot(snapshot({ through }))).toThrow(/through/);
    expect(() => parsePublicCalendar(html(), through)).toThrow(/through/);
  });

  it.each(['2026-02-30T12:00:00.000Z', '2026-10-23T25:00:00.000Z', '2026-10-23', '2026-10-23T12:00:00+00:00', 'no'])('rejects invalid fetchedAt %s', (fetchedAt) => {
    expect(() => validateGitHubSnapshot(snapshot({ fetchedAt }))).toThrow(/fetchedAt/);
  });

  it.each([-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null])('rejects invalid count %s', (count) => {
    const data = snapshot();
    Object.assign(data.days[0]!, { count });
    expect(() => validateGitHubSnapshot(data)).toThrow(/count/);
  });

  it.each([-1, 5, 1.1, NaN, '1', null])('rejects invalid level %s', (level) => {
    const data = snapshot();
    Object.assign(data.days[0]!, { level });
    expect(() => validateGitHubSnapshot(data)).toThrow(/level/);
  });

  it('rejects missing, duplicate, unordered, noncontiguous, non-array and malformed days', () => {
    for (const list of [days().slice(1), [...days(), days()[0]!], days().reverse(), [...days().slice(0, -1), days()[0]!], days('2026-10-24')]) {
      expect(() => validateGitHubSnapshot(snapshot({ days: list }))).toThrow(/365|contiguous/);
    }
    expect(() => validateGitHubSnapshot({ ...snapshot(), days: {} })).toThrow(/array/);
    expect(() => validateGitHubSnapshot({ ...snapshot(), days: Array(365).fill(null) })).toThrow(/object/);
    expect(() => validateGitHubSnapshot({ ...snapshot(), days: Array(365) })).toThrow(GitHubDataError);
    const data = snapshot();
    data.days[0]!.date = '2026-02-29';
    expect(() => validateGitHubSnapshot(data)).toThrow(/date/);
  });

  it('accepts the largest safe total, rejects overflow in validation, parsing and aggregation', () => {
    const data = snapshot();
    data.days[0] = { ...data.days[0]!, count: Number.MAX_SAFE_INTEGER, level: 4 };
    expect(contributionStats(data).total).toBe(Number.MAX_SAFE_INTEGER);
    data.days[1] = { ...data.days[1]!, count: 1, level: 1 };
    expect(() => validateGitHubSnapshot(data)).toThrow(/total.*safe/);
    expect(() => contributionStats(data)).toThrow(/total.*safe/);
    expect(() => parsePublicCalendar(html(data.days), data.through)).toThrow(/total.*safe/);
  });
});

describe('GitHub contribution summaries', () => {
  it('summarises all days, the trailing seven dates, per-calendar-day average and earliest best-day tie', () => {
    const data = snapshot();
    for (const i of [0, 1, 2, 3, 100, 358, 359, 360, 361, 362, 363, 364]) data.days[i] = { ...data.days[i]!, count: 2, level: 1 };
    data.days[357] = { ...data.days[357]!, count: 10, level: 2 };
    data.days[358] = { ...data.days[358]!, count: 10, level: 2 };
    expect(contributionStats(data)).toEqual({
      total: 42, thisWeek: 22, activeDays: 13, average: 42 / 365,
      bestDay: data.days[357], longestStreak: 8, currentStreak: 8,
    });
  });

  describe('GitHub refresh CLI', () => {
    let stored: string;
    let staged: string;
    let fetchCalendar: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      for (const mock of Object.values(disk)) mock.mockReset();
      stored = `${JSON.stringify(snapshot({ login: 'another-person' }), null, 2)}\n`;
      staged = '';
      disk.readFile.mockImplementation(async () => stored);
      disk.open.mockResolvedValue({
        writeFile: vi.fn(async (value: string) => { staged = value; }),
        sync: vi.fn(),
        close: vi.fn(),
      });
      disk.rename.mockImplementation(async () => { stored = staged; });
      fetchCalendar = vi.fn(async (url: URL) => {
        const year = Number(url.searchParams.get('to')!.slice(0, 4));
        const end = `${year}-12-31`;
        const length = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${year}-01-01T00:00:00Z`)) / DAY + 1;
        return new Response(html(days(end, 0, length)), { headers: { 'content-type': 'text/html' } });
      });
      vi.stubGlobal('fetch', fetchCalendar);
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('runs without arguments using only the validated existing login and the current UTC date', async () => {
      const through = new Date().toISOString().slice(0, 10);
      await refreshGitHub([]);
      expect(disk.readFile).toHaveBeenCalledWith(resolve('content/github.json'), 'utf8');
      expect(fetchCalendar).toHaveBeenCalled();
      for (const [url] of fetchCalendar.mock.calls) expect(url.pathname).toBe('/users/another-person/contributions');
      expect(validateGitHubSnapshot(JSON.parse(stored))).toMatchObject({ login: 'another-person', through });
      expect(disk.rename).toHaveBeenCalledTimes(1);
    });

    it('derives login from the selected output, not another file or an owner constant', async () => {
      await refreshGitHub(['--out', 'content/another-github.json', '--date', '2026-10-23']);
      expect(disk.readFile).toHaveBeenCalledWith(resolve('content/another-github.json'), 'utf8');
      expect(validateGitHubSnapshot(JSON.parse(stored)).login).toBe('another-person');
      expect(disk.rename.mock.calls[0]![1]).toBe(resolve('content/another-github.json'));
    });

    it('still creates a first snapshot with an explicit login without reading existing content', async () => {
      await refreshGitHub(['--login', 'new-person', '--date', '2026-10-23']);
      expect(disk.readFile).not.toHaveBeenCalled();
      expect(validateGitHubSnapshot(JSON.parse(stored)).login).toBe('new-person');
    });

    it('requires an explicit login for first creation', async () => {
      disk.readFile.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }));
      await expect(refreshGitHub([])).rejects.toThrow('--login is required when creating the first snapshot');
      expect(fetchCalendar).not.toHaveBeenCalled();
      expect(disk.open).not.toHaveBeenCalled();
    });

    it('does not treat other read errors as a missing first snapshot', async () => {
      const error = Object.assign(new Error('access denied'), { code: 'EACCES' });
      disk.readFile.mockRejectedValue(error);
      await expect(refreshGitHub([])).rejects.toBe(error);
      expect(fetchCalendar).not.toHaveBeenCalled();
      expect(disk.open).not.toHaveBeenCalled();
    });

    it.each(['invalid JSON', 'invalid snapshot', 'network failure', 'invalid calendar'])('preserves the exact existing snapshot on %s', async (failure) => {
      if (failure === 'invalid JSON') stored = '{"login":';
      if (failure === 'invalid snapshot') stored = JSON.stringify({ ...snapshot(), days: [] });
      if (failure === 'network failure') fetchCalendar.mockRejectedValue(new Error('network failed'));
      if (failure === 'invalid calendar') fetchCalendar.mockResolvedValue(new Response('<html>changed</html>', { headers: { 'content-type': 'text/html' } }));
      const before = stored;
      await expect(refreshGitHub(['--date', '2026-10-23'])).rejects.toThrow();
      expect(stored).toBe(before);
      expect(disk.open).not.toHaveBeenCalled();
      expect(disk.rename).not.toHaveBeenCalled();
      if (failure.startsWith('invalid ') && failure !== 'invalid calendar') expect(fetchCalendar).not.toHaveBeenCalled();
    });
  });

  it('allows a streak to end yesterday when the final date has no contributions', () => {
    const data = snapshot();
    for (const i of [360, 361, 362, 363]) data.days[i] = { ...data.days[i]!, count: 1, level: 1 };
    expect(contributionStats(data).currentStreak).toBe(4);
    data.days[363] = { ...data.days[363]!, count: 0, level: 0 };
    expect(contributionStats(data).currentStreak).toBe(0);
  });

  it('handles entirely inactive and entirely active calendars and bounds streaks to the snapshot', () => {
    expect(contributionStats(snapshot())).toEqual({
      total: 0, thisWeek: 0, activeDays: 0, average: 0,
      bestDay: days()[0], longestStreak: 0, currentStreak: 0,
    });
    expect(contributionStats(snapshot({ days: days('2026-10-23', 1) }))).toMatchObject({
      total: 365, thisWeek: 7, activeDays: 365, average: 1, longestStreak: 365, currentStreak: 365,
    });
  });
});
