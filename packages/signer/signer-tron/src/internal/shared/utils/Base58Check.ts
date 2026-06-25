import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";

/**
 * Base58Check encode/decode for Tron addresses.
 *
 * A Tron address is a 21-byte payload (0x41 prefix + 20-byte body) encoded as
 * Base58 of `payload || sha256(sha256(payload))[0..4]`, producing a 34-char
 * "T..." string. Validated by the Phase 1 protobuf spike.
 */
export function encodeBase58Check(payload: Uint8Array): string {
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return bs58.encode(full);
}

export function decodeBase58Check(address: string): Uint8Array {
  const full = bs58.decode(address);
  if (full.length < 4) {
    throw new Error("Invalid Base58Check string: too short");
  }
  const payload = full.slice(0, full.length - 4);
  const checksum = full.slice(full.length - 4);
  const expected = sha256(sha256(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expected[i]) {
      throw new Error("Invalid Base58Check checksum");
    }
  }
  return payload;
}
