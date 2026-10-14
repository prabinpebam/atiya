// @ts-check
/**
 * Seals a value for a GitHub Actions secret: libsodium's sealed box against the repository's public key,
 * as GitHub's REST documentation asks (documentation/desktop/spec.md §4.4).
 */
import sodium from 'libsodium-wrappers';

/**
 * @param {string} publicKey the repository's key, base64
 * @param {string} value
 * @returns {Promise<string>} the sealed value, base64
 */
export async function sealSecret(publicKey, value) {
  await sodium.ready;
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL));
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}

/** A key pair and an opener, for the fake GitHub. */
export async function secretKeyPair() {
  await sodium.ready;
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL),
    /** @param {string} sealed base64 */
    open: (sealed) => sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL), kp.publicKey, kp.privateKey)),
  };
}
