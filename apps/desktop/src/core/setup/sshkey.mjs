// @ts-check
/**
 * The read-only deploy key that lets the site's build fetch its private pages (documentation/desktop/
 * spec.md §4.4): an ed25519 key pair made in memory, the private half written in OpenSSH's own format
 * (what `ssh -i` reads; PROTOCOL.key), the public half as an authorized_keys line. Neither is ever
 * written to a file by the app.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';

/** @param {Buffer} b */
const str = (b) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(b.length);
  return Buffer.concat([len, b]);
};
const u32 = (/** @type {number} */ n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};

/**
 * A new ed25519 key pair.
 * @param {string} comment
 * @returns {{ privateKey: string, publicKey: string }}
 */
export function ed25519KeyPair(comment) {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const seed = Buffer.from(String(jwk.d), 'base64url');
  const pub = Buffer.from(String(jwk.x), 'base64url');
  const type = Buffer.from('ssh-ed25519');
  const blob = Buffer.concat([str(type), str(pub)]);
  const check = randomBytes(4).readUInt32BE(0);
  let secret = Buffer.concat([u32(check), u32(check), str(type), str(pub), str(Buffer.concat([seed, pub])), str(Buffer.from(comment))]);
  const pad = [];
  for (let i = 1; (secret.length + pad.length) % 8 !== 0; i++) pad.push(i);
  secret = Buffer.concat([secret, Buffer.from(pad)]);
  const body = Buffer.concat([Buffer.from('openssh-key-v1\0'), str(Buffer.from('none')), str(Buffer.from('none')), str(Buffer.alloc(0)), u32(1), str(blob), str(secret)]);
  const lines = body.toString('base64').match(/.{1,70}/g) ?? [];
  return {
    privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----\n${lines.join('\n')}\n-----END OPENSSH PRIVATE KEY-----\n`,
    publicKey: `ssh-ed25519 ${blob.toString('base64')} ${comment}`,
  };
}
