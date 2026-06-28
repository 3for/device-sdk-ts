import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendTIP712StructImplemCommand,
  StructImplemType,
} from "./SendTIP712StructImplemCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const ERROR = Uint8Array.from([0x6b, 0x00]); // wrong P1/P2

describe("SendTIP712StructImplemCommand", () => {
  describe("getApdu", () => {
    it("builds the ROOT apdu (P1=0x00, P2=0x00) with the struct name as ASCII", () => {
      const apdu = new SendTIP712StructImplemCommand({
        type: StructImplemType.ROOT,
        value: "abc",
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x1c, 0x00, 0x00, 0x03, 0x61, 0x62, 0x63]),
      );
    });

    it("builds the ARRAY apdu (P1=0x00, P2=0x0f) with the count as a single byte", () => {
      const apdu = new SendTIP712StructImplemCommand({
        type: StructImplemType.ARRAY,
        value: 3,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x1c, 0x00, 0x0f, 0x01, 0x03]),
      );
    });

    it("builds a final FIELD apdu (P1=0x00, P2=0xff) passing the length-prefixed data verbatim", () => {
      const apdu = new SendTIP712StructImplemCommand({
        type: StructImplemType.FIELD,
        value: {
          data: Uint8Array.from([0x00, 0x04, 0x01, 0x02, 0x03, 0x04]),
          isLastChunk: true,
        },
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xe0, 0x1c, 0x00, 0xff, 0x06, 0x00, 0x04, 0x01, 0x02, 0x03, 0x04,
        ]),
      );
    });

    it("sets P1=0x01 for a non-final FIELD chunk", () => {
      const apdu = new SendTIP712StructImplemCommand({
        type: StructImplemType.FIELD,
        value: {
          data: Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]),
          isLastChunk: false,
        },
      }).getApdu();

      expect(apdu.getRawApdu()[2]).toBe(0x01);
      expect(apdu.getRawApdu()[3]).toBe(0xff);
    });
  });

  describe("parseResponse", () => {
    it("succeeds on a 0x9000 status word", () => {
      const result = new SendTIP712StructImplemCommand({
        type: StructImplemType.ROOT,
        value: "abc",
      }).parseResponse(
        new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("returns an error on a non-success status word", () => {
      const result = new SendTIP712StructImplemCommand({
        type: StructImplemType.ROOT,
        value: "abc",
      }).parseResponse(
        new ApduResponse({ statusCode: ERROR, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
