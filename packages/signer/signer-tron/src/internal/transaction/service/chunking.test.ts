import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import { buildTransactionChunks } from "./chunking";

const PATH = "44'/195'/0'/0/0";

const TRANSFER_RAW_DATA = Uint8Array.from(
  Buffer.from(
    "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d",
    "hex",
  ),
);

/** Build a top-level length-delimited field (tag=10, wire=2) of `size` bytes. */
function memoField(size: number, fill: number): Uint8Array {
  const lenLo = size & 0x7f;
  const lenHi = size >> 7;
  const header = Uint8Array.from([
    0x52, // field 10, wire type 2
    lenLo | 0x80,
    lenHi,
  ]);
  const field = new Uint8Array(header.length + size);
  field.set(header);
  field.fill(fill, header.length);
  return field;
}

function reassembleRawData(
  chunks: readonly { chunk: Uint8Array }[],
): Uint8Array {
  const headerLength = encodeDerivationPath(PATH).length;
  const rawLength = chunks.reduce(
    (length, { chunk }, index) =>
      length + chunk.length - (index === 0 ? headerLength : 0),
    0,
  );
  const rawData = new Uint8Array(rawLength);
  let offset = 0;

  chunks.forEach(({ chunk }, index) => {
    const rawChunk = index === 0 ? chunk.slice(headerLength) : chunk;
    rawData.set(rawChunk, offset);
    offset += rawChunk.length;
  });

  return rawData;
}

describe("buildTransactionChunks", () => {
  it("should produce a single SIGN chunk for a small transaction", () => {
    const chunks = buildTransactionChunks(PATH, TRANSFER_RAW_DATA);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.p1).toBe(0x10);

    const header = encodeDerivationPath(PATH);
    expect(chunks[0]!.chunk.slice(0, header.length)).toStrictEqual(header);
    expect(chunks[0]!.chunk.slice(header.length)).toStrictEqual(
      TRANSFER_RAW_DATA,
    );
  });

  it("should split a single large protobuf field across APDUs", () => {
    const raw = memoField(320, 0xaa);
    const chunks = buildTransactionChunks(PATH, raw);

    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.p1)).toStrictEqual([0x00, 0x90]);
    expect(chunks.every(({ chunk }) => chunk.length <= APDU_MAX_PAYLOAD)).toBe(
      true,
    );
    expect(reassembleRawData(chunks)).toStrictEqual(raw);
  });

  it("should use MORE chunks and preserve a 3 KiB transaction exactly", () => {
    const raw = Uint8Array.from(
      { length: 3 * 1024 },
      (_value, index) => index % 256,
    );
    const chunks = buildTransactionChunks(PATH, raw);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]!.p1).toBe(0x00);
    expect(chunks.at(-1)!.p1).toBe(0x90);
    expect(chunks.slice(1, -1).every(({ p1 }) => p1 === 0x80)).toBe(true);
    expect(chunks.every(({ chunk }) => chunk.length <= APDU_MAX_PAYLOAD)).toBe(
      true,
    );
    expect(reassembleRawData(chunks)).toStrictEqual(raw);
  });

  it("should stream arbitrary bytes without parsing protobuf on the host", () => {
    const raw = new Uint8Array(APDU_MAX_PAYLOAD * 2 + 1).fill(0xff);

    const chunks = buildTransactionChunks(PATH, raw);

    expect(reassembleRawData(chunks)).toStrictEqual(raw);
  });
});
