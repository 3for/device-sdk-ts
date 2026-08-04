import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { InitTIP712Command } from "./InitTIP712Command";

const OK = Uint8Array.from([0x90, 0x00]);

describe("InitTIP712Command", () => {
  const command = new InitTIP712Command({
    derivationPath: "44'/195'/0'/0/0",
  });

  it("builds the full-mode INIT APDU with the signing path", () => {
    const raw = command.getApdu().getRawApdu();

    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x0c, 0x01, 0x01]);
    // 1 (count) + 5*4 (path) = 21 bytes of data
    expect(raw[4]).toBe(21);
    expect(raw).toHaveLength(5 + 21);
  });

  it("accepts a successful response", () => {
    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
    );

    expect(isSuccessCommandResult(result)).toBe(true);
  });
});
