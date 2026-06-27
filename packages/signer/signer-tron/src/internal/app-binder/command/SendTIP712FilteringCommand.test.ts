import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendTIP712FilteringCommand,
  TIP712FilterType,
} from "./SendTIP712FilteringCommand";

const OK = Uint8Array.from([0x90, 0x00]);

describe("SendTIP712FilteringCommand", () => {
  it("should build the activation APDU", () => {
    const command = new SendTIP712FilteringCommand({
      type: TIP712FilterType.Activation,
    });

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([0xe0, 0x1e, 0x00, 0x00, 0x00]),
    );
  });

  it("should build a discarded raw filter APDU", () => {
    const command = new SendTIP712FilteringCommand({
      type: TIP712FilterType.Raw,
      discarded: true,
      displayName: "Memo",
      signature: "0102",
    });

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([
        0xe0, 0x1e, 0x01, 0xff, 0x08, 0x04, 0x4d, 0x65, 0x6d, 0x6f, 0x02, 0x01,
        0x02,
      ]),
    );
  });

  it("should parse a success response", () => {
    const command = new SendTIP712FilteringCommand({
      type: TIP712FilterType.Activation,
    });

    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
    );

    expect(isSuccessCommandResult(result)).toBe(true);
  });
});
