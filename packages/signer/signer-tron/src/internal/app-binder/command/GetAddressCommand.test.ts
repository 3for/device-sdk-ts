import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "./GetAddressCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const ERROR = Uint8Array.from([0x69, 0x85]); // conditions not satisfied

const DERIVATION_PATH = "44'/195'/0'/0/0";
// 1-byte element count + 5 × 32-bit big-endian.
const PATH_DATA = [
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0xc3, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

const PUBLIC_KEY = Uint8Array.from([0x04, ...new Array(64).fill(0xab)]);
const ADDRESS = "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC"; // 34-char Base58Check
const ADDRESS_BYTES = Uint8Array.from(
  ADDRESS.split("").map((c) => c.charCodeAt(0)),
);
const CHAIN_CODE = Uint8Array.from(new Array(32).fill(0xcd));

const responseData = (withChainCode = false) =>
  Uint8Array.from([
    PUBLIC_KEY.length,
    ...PUBLIC_KEY,
    ADDRESS_BYTES.length,
    ...ADDRESS_BYTES,
    ...(withChainCode ? CHAIN_CODE : []),
  ]);

describe("GetAddressCommand", () => {
  describe("getApdu", () => {
    it("builds the GET_PUBLIC_KEY apdu without confirmation or chain code", () => {
      const apdu = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xe0,
          0x02,
          0x00,
          0x00,
          PATH_DATA.length,
          ...PATH_DATA,
        ]),
      );
    });

    it("sets P1=0x01 when checkOnDevice is true", () => {
      const apdu = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
      }).getApdu();

      expect(apdu.getRawApdu()[2]).toBe(0x01);
    });

    it("sets P2=0x01 when returnChainCode is true", () => {
      const apdu = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        returnChainCode: true,
      }).getApdu();

      expect(apdu.getRawApdu()[3]).toBe(0x01);
    });
  });

  describe("parseResponse", () => {
    it("parses public key and Base58Check address", () => {
      const result = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      }).parseResponse(
        new ApduResponse({ statusCode: OK, data: responseData() }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          publicKey: `04${"ab".repeat(64)}`,
          address: ADDRESS,
          chainCode: undefined,
        });
      }
    });

    it("parses the chain code when requested", () => {
      const result = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        returnChainCode: true,
      }).parseResponse(
        new ApduResponse({ statusCode: OK, data: responseData(true) }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.chainCode).toBe("cd".repeat(32));
      }
    });

    it("returns an error on a non-success status word", () => {
      const result = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      }).parseResponse(
        new ApduResponse({ statusCode: ERROR, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("returns an error when the response is truncated", () => {
      const result = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
      }).parseResponse(
        new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("returns an error when the chain code is requested but missing", () => {
      const result = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        returnChainCode: true,
      }).parseResponse(
        new ApduResponse({ statusCode: OK, data: responseData(false) }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
