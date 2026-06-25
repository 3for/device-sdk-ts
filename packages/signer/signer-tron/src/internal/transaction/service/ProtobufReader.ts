/**
 * Minimal, decode-only protobuf reader for Tron `raw_data`.
 *
 * Tron transactions are protobuf (not RLP). We only need to *decode* a small,
 * stable subset of fields (the host passes already-serialized bytes that the
 * device signs verbatim), so a hand-rolled reader keeps the dependency surface
 * minimal — mirroring how signer-eth relies only on ethers. The wire format was
 * validated end-to-end by `spike/decode-rawdata.mjs`.
 */
export const WireType = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  FIXED32: 5,
} as const;

export type ProtobufTag = {
  readonly field: number;
  readonly wire: number;
};

export class ProtobufReader {
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {}

  get position(): number {
    return this.pos;
  }

  get eof(): boolean {
    return this.pos >= this.buf.length;
  }

  /** Read a base-128 varint as a bigint (handles 64-bit fields). */
  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (this.pos >= this.buf.length) {
        throw new Error("ProtobufReader: unexpected end of buffer in varint");
      }
      const b = this.buf[this.pos++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
    }
    return result;
  }

  /** Read a field tag (field number + wire type). */
  tag(): ProtobufTag {
    const t = this.varint();
    return { field: Number(t >> 3n), wire: Number(t & 0x7n) };
  }

  /** Read a length-delimited byte field (returns a view into the buffer). */
  bytes(): Uint8Array {
    const len = Number(this.varint());
    if (this.pos + len > this.buf.length) {
      throw new Error("ProtobufReader: length-delimited field exceeds buffer");
    }
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  /** Skip a field of the given wire type. */
  skip(wire: number): void {
    switch (wire) {
      case WireType.VARINT:
        this.varint();
        break;
      case WireType.LENGTH_DELIMITED:
        this.bytes();
        break;
      case WireType.FIXED32:
        this.pos += 4;
        break;
      case WireType.FIXED64:
        this.pos += 8;
        break;
      default:
        throw new Error(`ProtobufReader: unsupported wire type ${wire}`);
    }
  }
}
