/**
 * The nightly deploy's activity guard (scripts/activity-guard.mjs; documentation/access/spec.md §4.5):
 * it fails at 50 days without a commit, before GitHub turns the schedule off at 60.
 */
import { describe, expect, it } from 'vitest';
import { daysSince, guard, WARN_DAYS } from '../../scripts/activity-guard.mjs';

describe('the activity guard', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  it('counts whole days since the last commit', () => {
    expect(daysSince('2026-11-30T12:00:00Z', now)).toBe(0);
    expect(daysSince('2026-11-01T00:00:00+05:30', now)).toBe(30);
  });
  it('passes under 50 days, and fails from 50 with a message saying what to do', () => {
    expect(WARN_DAYS).toBe(50);
    expect(guard('2026-10-13T00:00:00Z', now)).toMatchObject({ ok: true, days: 49 });
    const r = guard('2026-10-12T00:00:00Z', now);
    expect(r).toMatchObject({ ok: false, days: 50 });
    expect(r.message).toMatch(/make any commit/);
  });
});
