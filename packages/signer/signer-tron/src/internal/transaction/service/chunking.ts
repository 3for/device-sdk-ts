import { P1 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";
import { ProtobufReader } from "@internal/transaction/service/ProtobufReader";

// Matches hw-app-trx: the device hashes incrementally but parses the protobuf
// per chunk, so chunks are split on top-level field boundaries and never exceed
// CHUNK_SIZE. The first chunk is seeded with the BIP32 path.
const CHUNK_SIZE = 250;

export type TransactionChunk = {
  readonly chunk: Uint8Array;
  readonly p1: number;
};

/** Byte length of the next top-level protobuf field (tag + payload). */
function nextFieldLength(buf: Uint8Array): number {
  const reader = new ProtobufReader(buf);
  const tag = reader.varint();
  const wire = Number(tag & 0x7n);
  const valueOrLength = reader.varint();
  if (wire === 0) {
    // varint field: tag varint + value varint
    return reader.position;
  }
  // length-delimited: tag varint + length varint + payload
  return reader.position + Number(valueOrLength);
}

/**
 * Split a Tron `raw_data` payload into signing chunks, replicating the
 * field-aligned chunking of the legacy hw-app-trx client. P1 is:
 *   - 0x10 (SIGN) for a single chunk
 *   - 0x00 (FIRST) / 0x80 (MORE) / 0x90 (LAST) otherwise
 */
export function buildTransactionChunks(
  derivationPath: string,
  rawData: Uint8Array,
): TransactionChunk[] {
  const chunks: Uint8Array[] = [];
  let current: number[] = Array.from(encodeDerivationPath(derivationPath));
  let remaining = rawData;

  while (remaining.length > 0) {
    const length = nextFieldLength(remaining);
    if (length > CHUNK_SIZE) {
      throw new Error(
        "Tron transaction field too large to fit in a single APDU chunk",
      );
    }
    if (current.length + length > CHUNK_SIZE) {
      chunks.push(Uint8Array.from(current));
      current = [];
      continue;
    }
    for (let i = 0; i < length; i++) {
      current.push(remaining[i]!);
    }
    remaining = remaining.subarray(length);
  }
  chunks.push(Uint8Array.from(current));

  if (chunks.length === 1) {
    return [{ chunk: chunks[0]!, p1: P1.SIGN }];
  }
  return chunks.map((chunk, index) => ({
    chunk,
    p1:
      index === 0 ? P1.FIRST : index === chunks.length - 1 ? P1.LAST : P1.MORE,
  }));
}
