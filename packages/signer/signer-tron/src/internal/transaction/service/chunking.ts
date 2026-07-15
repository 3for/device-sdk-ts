import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
} from "@ledgerhq/device-management-kit";

import { P1 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

export type TransactionChunk = {
  readonly chunk: Uint8Array;
  readonly p1: number;
};

/**
 * Split a Tron `raw_data` payload at arbitrary byte boundaries, matching the
 * current app-tron client. The firmware accumulates all raw transaction chunks
 * before protobuf decoding, so a single field may span multiple APDUs. P1 is:
 *   - 0x10 (SIGN) for a single chunk
 *   - 0x00 (FIRST) / 0x80 (MORE) / 0x90 (LAST) otherwise
 */
export function buildTransactionChunks(
  derivationPath: string,
  rawData: Uint8Array,
): TransactionChunk[] {
  const path = encodeDerivationPath(derivationPath);
  const firstChunkCapacity = APDU_MAX_PAYLOAD - path.length;
  if (firstChunkCapacity < 0) {
    throw new Error("Tron derivation path exceeds the APDU payload capacity");
  }

  const firstRawData = rawData.slice(0, firstChunkCapacity);
  const chunks: Uint8Array[] = [
    new ByteArrayBuilder(path.length + firstRawData.length)
      .addBufferToData(path)
      .addBufferToData(firstRawData)
      .build(),
  ];

  for (
    let offset = firstRawData.length;
    offset < rawData.length;
    offset += APDU_MAX_PAYLOAD
  ) {
    chunks.push(rawData.slice(offset, offset + APDU_MAX_PAYLOAD));
  }

  if (chunks.length === 1) {
    return [{ chunk: chunks[0]!, p1: P1.SIGN }];
  }
  return chunks.map((chunk, index) => ({
    chunk,
    p1:
      index === 0 ? P1.FIRST : index === chunks.length - 1 ? P1.LAST : P1.MORE,
  }));
}
