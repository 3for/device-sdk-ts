import { decodeBase58Check, encodeBase58Check } from "./Base58Check";

// 0x41-prefixed 21-byte address payload and its Base58Check form,
// cross-checked against the hw-app-trx test vectors.
const PAYLOAD = Uint8Array.from(
  Buffer.from("41c8599111f29c1e1e061265b4af93ea1f274ad78a", "hex"),
);
const ADDRESS = "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH";

describe("Base58Check", () => {
  it("should encode a 21-byte payload to a 34-char Tron address", () => {
    const encoded = encodeBase58Check(PAYLOAD);
    expect(encoded).toBe(ADDRESS);
    expect(encoded.startsWith("T")).toBe(true);
    expect(encoded).toHaveLength(34);
  });

  it("should decode a Tron address back to its payload", () => {
    expect(decodeBase58Check(ADDRESS)).toStrictEqual(PAYLOAD);
  });

  it("should round-trip", () => {
    expect(decodeBase58Check(encodeBase58Check(PAYLOAD))).toStrictEqual(
      PAYLOAD,
    );
  });

  it("should throw on an invalid checksum", () => {
    const tampered = ADDRESS.slice(0, -1) + (ADDRESS.endsWith("a") ? "b" : "a");
    expect(() => decodeBase58Check(tampered)).toThrow();
  });
});
