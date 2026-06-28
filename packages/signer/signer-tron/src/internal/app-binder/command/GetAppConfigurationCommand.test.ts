import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigurationCommand } from "./GetAppConfigurationCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const ERROR = Uint8Array.from([0x6a, 0x80]); // invalid data

describe("GetAppConfigurationCommand", () => {
  describe("getApdu", () => {
    it("builds the GET_APP_CONFIGURATION apdu with no data", () => {
      expect(
        new GetAppConfigurationCommand().getApdu().getRawApdu(),
      ).toStrictEqual(Uint8Array.from([0xe0, 0x06, 0x00, 0x00, 0x00]));
    });
  });

  describe("parseResponse", () => {
    it("parses version and all flags cleared", () => {
      const result = new GetAppConfigurationCommand().parseResponse(
        new ApduResponse({
          statusCode: OK,
          data: Uint8Array.from([0x00, 0x01, 0x02, 0x03]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          version: "1.2.3",
          allowData: false,
          allowCustomContract: false,
          truncateAddress: false,
          signByHash: false,
          verboseTip712: false,
          displayHash: false,
        });
      }
    });

    it("decodes individual flag bits (data + signByHash)", () => {
      // 0x01 (data) | 0x08 (signByHash) = 0x09
      const result = new GetAppConfigurationCommand().parseResponse(
        new ApduResponse({
          statusCode: OK,
          data: Uint8Array.from([0x09, 0x02, 0x00, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          version: "2.0.0",
          allowData: true,
          allowCustomContract: false,
          truncateAddress: false,
          signByHash: true,
          verboseTip712: false,
          displayHash: false,
        });
      }
    });

    it("decodes all flags set", () => {
      const result = new GetAppConfigurationCommand().parseResponse(
        new ApduResponse({
          statusCode: OK,
          data: Uint8Array.from([0x3f, 0x01, 0x00, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toMatchObject({
          allowData: true,
          allowCustomContract: true,
          truncateAddress: true,
          signByHash: true,
          verboseTip712: true,
          displayHash: true,
        });
      }
    });

    it("returns an error on a non-success status word", () => {
      const result = new GetAppConfigurationCommand().parseResponse(
        new ApduResponse({ statusCode: ERROR, data: new Uint8Array() }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("returns an error when the response is truncated", () => {
      const result = new GetAppConfigurationCommand().parseResponse(
        new ApduResponse({
          statusCode: OK,
          data: Uint8Array.from([0x00, 0x01]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
