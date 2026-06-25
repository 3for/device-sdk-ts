/**
 * A Tron signature, as returned by the device: 65 raw bytes split into
 * r (32 bytes), s (32 bytes) and v (1-byte recovery id).
 */
export type Signature = {
  readonly r: `0x${string}`;
  readonly s: `0x${string}`;
  readonly v: number;
};
