// @ts-check
/**
 * The contact service's HTTP functions (documentation/contact/spec.md §4.1, §4.5): the challenge, the message,
 * and an access agreement. What each does is handle.mjs; this file wires it to the Functions runtime and its settings.
 * CORS is the platform's (allowed origins only); the handlers check the origin again.
 */
import { app } from '@azure/functions';
import { AGREE_MAX_BYTES, agreement, challenge, contact } from '../handle.mjs';
import { agreementNotified, claim, keepAgreement, take } from '../store.mjs';
import { notifyAgreement, send } from '../send.mjs';

const settings = () => ({
  secret: process.env.CONTACT_SECRET ?? '',
  origins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});

/** @param {{ status: number; body: Record<string, unknown> }} a */
const answer = (a) => ({ status: a.status, jsonBody: a.body, headers: { 'Cache-Control': 'no-store' } });

app.http('contactChallenge', {
  route: 'contact/challenge',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (req) => answer(challenge({ origin: req.headers.get('origin') }, settings())),
});

app.http('contact', {
  route: 'contact',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    // never read more than the limit: a larger body is refused by its length before it's read
    const length = Number(req.headers.get('content-length') ?? 0);
    const text = length > 16 * 1024 ? 'x'.repeat(16 * 1024 + 1) : await req.text();
    const a = await contact(
      { origin: req.headers.get('origin'), contentType: req.headers.get('content-type'), forwarded: req.headers.get('x-forwarded-for'), text },
      { ...settings(), claim, take, send, log: (m) => ctx.log(m) },
    );
    return answer(a);
  },
});

app.http('accessAgreement', {
  route: 'access/agreement',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (req, ctx) => {
    const length = Number(req.headers.get('content-length') ?? 0);
    const text = length > AGREE_MAX_BYTES ? 'x'.repeat(AGREE_MAX_BYTES + 1) : await req.text();
    const a = await agreement(
      { origin: req.headers.get('origin'), contentType: req.headers.get('content-type'), forwarded: req.headers.get('x-forwarded-for'), userAgent: req.headers.get('user-agent'), text },
      { ...settings(), take, keep: keepAgreement, notified: agreementNotified, notify: notifyAgreement, log: (m) => ctx.log(m) },
    );
    return answer(a);
  },
});