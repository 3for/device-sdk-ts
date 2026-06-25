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
  return Uint8Array.from([
    0x52, // field 10, wire type 2
    lenLo | 0x80,
    lenHi,
    ...new Array(size).fill(fill),
  ]);
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

  it("should split on field boundaries with FIRST/LAST p1 for a large transaction", () => {
    const raw = Uint8Array.from([
      ...memoField(200, 0xaa),
      ...memoField(200, 0xbb),
    ]);
    const chunks = buildTransactionChunks(PATH, raw);

    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.p1)).toStrictEqual([0x00, 0x90]);

    // Reassembling the chunks (minus the path header in chunk 0) yields raw_data.
    const header = encodeDerivationPath(PATH);
    const reassembled = Uint8Array.from([
      ...chunks[0]!.chunk.slice(header.length),
      ...chunks[1]!.chunk,
    ]);
    expect(reassembled).toStrictEqual(raw);
  });

  it("should throw when a single field exceeds the chunk size", () => {
    const raw = memoField(300, 0xcc);
    expect(() => buildTransactionChunks(PATH, raw)).toThrow();
  });
});
