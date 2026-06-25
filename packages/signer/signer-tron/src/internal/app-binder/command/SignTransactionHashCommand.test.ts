import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionHashCommand } from "./SignTransactionHashCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const HASH = Uint8Array.from(new Array(32).fill(0x07));
const SIGNATURE_DATA = Uint8Array.from([
  ...new Array(32).fill(0x01),
  ...new Array(32).fill(0x02),
  0x00,
]);

describe("SignTransactionHashCommand", () => {
  const command = new SignTransactionHashCommand({
    derivationPath: "44'/195'/0'/0/0",
    hash: HASH,
  });

  it("should build the INS_SIGN_TXN_HASH apdu with path + 32-byte hash", () => {
    const raw = command.getApdu().getRawApdu();
    // header: cla, ins, p1, p2, lc
    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x05, 0x00, 0x00]);
    // 1 (count) + 5*4 (path) + 32 (hash) = 53 bytes of data
    expect(raw[4]).toBe(53);
    expect(raw).toHaveLength(5 + 53);
    expect(Array.from(raw.slice(-32))).toStrictEqual(Array.from(HASH));
  });

  it("should parse the signature", () => {
    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: SIGNATURE_DATA }),
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual({
        r: `0x${"01".repeat(32)}`,
        s: `0x${"02".repeat(32)}`,
        v: 0,
      });
    }
  });

  it("should surface the sign-by-hash-disabled error (0x6a8c)", () => {
    const result = command.parseResponse(
      new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x8c]),
        data: new Uint8Array(),
      }),
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
