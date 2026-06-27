import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignPersonalMessageCommand } from "./SignPersonalMessageCommand";

const OK = Uint8Array.from([0x90, 0x00]);

const SIGNATURE_DATA = Uint8Array.from([
  ...Array.from({ length: 32 }, () => 0x01),
  ...Array.from({ length: 32 }, () => 0x02),
  0x01,
]);

describe("SignPersonalMessageCommand", () => {
  describe("getApdu", () => {
    it("should build the standard personal message APDU with the provided p1", () => {
      const apdu = new SignPersonalMessageCommand({
        chunk: Uint8Array.from([0xaa, 0xbb]),
        p1: 0x10,
        fullDisplay: false,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x08, 0x10, 0x00, 0x02, 0xaa, 0xbb]),
      );
    });

    it("should build the full-display personal message APDU", () => {
      const apdu = new SignPersonalMessageCommand({
        chunk: Uint8Array.from([0xaa]),
        p1: 0x00,
        fullDisplay: true,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0xc8, 0x00, 0x00, 0x01, 0xaa]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return Nothing for an intermediate empty response", () => {
      const command = new SignPersonalMessageCommand({
        chunk: new Uint8Array(),
        p1: 0x80,
        fullDisplay: false,
      });

      const result = command.parseResponse(
        new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.isNothing()).toBe(true);
      }
    });

    it("should parse the signature from the final response", () => {
      const command = new SignPersonalMessageCommand({
        chunk: new Uint8Array(),
        p1: 0x10,
        fullDisplay: false,
      });

      const result = command.parseResponse(
        new ApduResponse({ statusCode: OK, data: SIGNATURE_DATA }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.unsafeCoerce()).toStrictEqual({
          r: `0x${"01".repeat(32)}`,
          s: `0x${"02".repeat(32)}`,
          v: 1,
        });
      }
    });
  });
});
