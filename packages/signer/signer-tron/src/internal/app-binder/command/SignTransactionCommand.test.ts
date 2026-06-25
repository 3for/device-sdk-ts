import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionCommand } from "./SignTransactionCommand";

const OK = Uint8Array.from([0x90, 0x00]);

const SIGNATURE_DATA = Uint8Array.from([
  ...new Array(32).fill(0x01), // r
  ...new Array(32).fill(0x02), // s
  0x01, // v
]);

describe("SignTransactionCommand", () => {
  describe("getApdu", () => {
    it("should build the INS_SIGN apdu with the given chunk and p1", () => {
      const chunk = Uint8Array.from([0xaa, 0xbb, 0xcc]);
      const apdu = new SignTransactionCommand({ chunk, p1: 0x00 }).getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x04, 0x00, 0x00, 0x03, 0xaa, 0xbb, 0xcc]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return Nothing for an intermediate (empty) chunk", () => {
      const command = new SignTransactionCommand({
        chunk: new Uint8Array(),
        p1: 0x80,
      });
      const result = command.parseResponse(
        new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.isNothing()).toBe(true);
      }
    });

    it("should parse r/s/v from the final chunk", () => {
      const command = new SignTransactionCommand({
        chunk: new Uint8Array(),
        p1: 0x90,
      });
      const result = command.parseResponse(
        new ApduResponse({ statusCode: OK, data: SIGNATURE_DATA }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        const signature = result.data.unsafeCoerce();
        expect(signature).toStrictEqual({
          r: `0x${"01".repeat(32)}`,
          s: `0x${"02".repeat(32)}`,
          v: 1,
        });
      }
    });

    it("should return an error for a device error status", () => {
      const command = new SignTransactionCommand({
        chunk: new Uint8Array(),
        p1: 0x90,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x69, 0x85]),
          data: new Uint8Array(),
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
