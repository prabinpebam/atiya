/**
 * PostHog, set up as documentation/access/spec.md §9 says (fetched on idle by scripts/telemetry.ts, its own
 * chunk): its build that loads no other script, no cookies (the session's storage), profiles for signed-in
 * grants only, no replay, surveys, heatmaps or flags; its own page views off (the site sends them, so a
 * protected page's is allowlisted), autocapture only on open pages; and every event through `sanitize`.
 */
import posthog from 'posthog-js/dist/module.no-external';
import { linkKind, mediaId, sanitize, type CaptureEvent } from './telemetrySanitize';
import type { PageFacts, Queued } from './telemetryRules';

export function connect(o: { test: boolean; testHost: string; base: string; page: () => PageFacts }): { run: (q: Queued) => void } {
  const open = o.page().mode === 'open';
  posthog.init(o.test ? 'phc_test' : (import.meta.env.PUBLIC_POSTHOG_KEY ?? ''), {
    api_host: o.test ? o.testHost : import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    persistence: 'sessionStorage',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: open,
    autocapture: open,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    save_referrer: open,
    // the test build sends at once and uncompressed, so a test sees and reads every event before it leaves the
    // page, and from headless Chromium too (PostHog drops bots' events)
    ...(o.test ? { request_batching: false, disable_compression: true, opt_out_useragent_filter: true } : {}),
    before_send: (e) => sanitize(e as CaptureEvent | null, o.page()) as typeof e,
  });
  // signed out since this tab's identity was set (a session that ran out): anonymous again
  if (document.documentElement.dataset.signedIn === undefined && posthog.get_property('$user_state') === 'identified') posthog.reset();
  return {
    run(q) {
      if (q.kind === 'pageview') posthog.capture('$pageview');
      else if (q.kind === 'identify') {
        if (posthog.get_distinct_id() !== q.grant) posthog.identify(q.grant);
      } else if (q.kind === 'reset') posthog.reset();
      else if (q.kind === 'allowlist') posthog.set_config({ autocapture: false, capture_pageleave: false });
      else if (q.kind === 'link') {
        const k = linkKind(q.href, q.here, o.base);
        if (k) posthog.capture('access_link', k, { transport: 'sendBeacon' });
      } else if (q.kind === 'video') {
        const id = q.open ? mediaId(q.src, o.base) : null;
        posthog.capture('video_played', id ? { media: id } : { place: q.place });
      } else posthog.capture(q.event, q.props, q.beacon ? { transport: 'sendBeacon' } : undefined);
    },
  };
}
