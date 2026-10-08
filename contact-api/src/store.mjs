// @ts-check
/**
 * What the contact service remembers (documentation/contact/spec.md §4.2, §6), in Table Storage: each used
 * challenge (so it can't be used twice) and the counters behind the rate limits. No message, no address:
 * a visitor is a salted hash of their IP, and every row says when it stops mattering.
 */
import { TableClient } from '@azure/data-tables';

/** @type {Map<string, Promise<TableClient>>} */
const clients = new Map();

/** A table, made the first time it's needed. */
function table(/** @type {string} */ name) {
  let c = clients.get(name);
  if (!c) {
    c = (async () => {
      const t = TableClient.fromConnectionString(process.env.RATE_TABLE_CONNECTION ?? '', name);
      await t.createTable().catch((e) => {
        if (e?.statusCode !== 409) throw e;
      });
      return t;
    })();
    clients.set(name, c);
  }
  return c;
}

const status = (/** @type {unknown} */ e) => (e && typeof e === 'object' && 'statusCode' in e ? e.statusCode : undefined);

/**
 * Records a challenge as used. False if it was used before.
 * @param {string} id the challenge's salt
 * @param {number} expires when it stops being valid (ms)
 */
export async function claim(id, expires) {
  const t = await table('contactchallenges');
  try {
    await t.createEntity({ partitionKey: new Date(expires).toISOString().slice(0, 10), rowKey: id, expires });
    return true;
  } catch (e) {
    if (status(e) === 409) return false;
    throw e;
  }
}

/**
 * Takes one from a limit: true (and counted) if it's under `limit`, false if it's reached.
 * @param {string} key the counter (a visitor's hour, or the day)
 * @param {number} limit
 */
export async function take(key, limit) {
  const t = await table('contactlimits');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const row = await t.getEntity('limit', key);
      const count = Number(row.count ?? 0);
      if (count >= limit) return false;
      await t.updateEntity({ partitionKey: 'limit', rowKey: key, count: count + 1 }, 'Replace', { etag: row.etag });
      return true;
    } catch (e) {
      if (status(e) === 404) {
        try {
          await t.createEntity({ partitionKey: 'limit', rowKey: key, count: 1 });
          return true;
        } catch (e2) {
          if (status(e2) !== 409) throw e2;
        }
      } else if (status(e) !== 412) throw e;
    }
  }
  return false;
}

// ---------- access agreements: one row each, kept as it arrived (documentation/contact/spec.md §4.5) ----------

/** @typedef {import('./handle.mjs').AgreementRow} AgreementRow */

const AGREEMENTS = 'accessagreements';

/** A kept row as the handler's record. @param {Record<string, unknown>} e */
function rowOf(e) {
  const s = (/** @type {string} */ k) => (typeof e[k] === 'string' ? /** @type {string} */ (e[k]) : '');
  return /** @type {AgreementRow} */ ({
    id: s('rowKey'),
    grant: s('partitionKey'),
    via: s('via') === 'link' ? 'link' : 'code',
    version: s('version'),
    statement: s('statement'),
    ...(s('who') ? { who: s('who') } : {}),
    ...(s('why') ? { why: s('why') } : {}),
    digest: s('digest'),
    page: s('page'),
    agreedAt: s('agreedAt'),
    receivedAt: s('receivedAt'),
    ip: s('ip'),
    userAgent: s('userAgent'),
  });
}

/**
 * Keeps an agreement, once: a row by its grant and its ID. One sent again (a retry) isn't written over; the
 * answer says whether it's new and whether its email went, with the row as first kept.
 * @param {AgreementRow} row
 */
export async function keepAgreement(row) {
  const t = await table(AGREEMENTS);
  const { grant, id, who, why, ...rest } = row;
  try {
    await t.createEntity({ partitionKey: grant, rowKey: id, ...rest, ...(who ? { who } : {}), ...(why ? { why } : {}), notified: false });
    return { created: true, notified: false, row };
  } catch (e) {
    if (status(e) !== 409) throw e;
    const old = await t.getEntity(grant, id);
    return { created: false, notified: old.notified === true, row: rowOf(/** @type {Record<string, unknown>} */ (old)) };
  }
}

/** Marks an agreement's email as sent (the one change a kept row ever has). @param {AgreementRow} row */
export async function agreementNotified(row) {
  const t = await table(AGREEMENTS);
  await t.updateEntity({ partitionKey: row.grant, rowKey: row.id, notified: true, notifiedAt: new Date().toISOString() }, 'Merge');
}