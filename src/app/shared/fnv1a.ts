/**
 * A fast 32-bit checksum of some bytes (FNV-1a), as 8 hex digits. It must stay identical to the one in
 * tools/make-asset-manifest.mjs, which writes the expected checksums at build time.
 * (The browser's own crypto.subtle is not used: it does not exist on a page served over plain http.)
 */
export function fnv1aHex(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
