import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "./GetChallengeCommand";

const OK = Uint8Array.from([0x90, 0x00]);

describe("GetChallengeCommand", () => {
  const command = new GetChallengeCommand();

  it("should build the INS_GET_CHALLENGE apdu", () => {
    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([0xe0, 0x20, 0x00, 0x00, 0x00]),
    );
  });

  it("should parse the 4-byte challenge", () => {
    const result = command.parseResponse(
      new ApduResponse({
        statusCode: OK,
        data: Uint8Array.from([0x12, 0x34, 0x56, 0x78]),
      }),
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual({ challenge: "12345678" });
    }
  });
});
