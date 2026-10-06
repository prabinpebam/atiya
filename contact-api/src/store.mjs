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
