import { DerivationPathUtils } from "@ledgerhq/signer-utils";

/**
 * Encode a BIP32 derivation path for the device: a 1-byte element count
 * followed by each element as a 32-bit big-endian integer.
 */
export function encodeDerivationPath(derivationPath: string): Uint8Array {
  const path = DerivationPathUtils.splitPath(derivationPath);
  const out = new Uint8Array(1 + path.length * 4);
  out[0] = path.length;
  const view = new DataView(out.buffer);
  path.forEach((element, index) => {
    view.setUint32(1 + index * 4, element >>> 0, false);
  });
  return out;
}
