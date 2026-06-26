import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTIP712Command } from "./SignTIP712Command";

const OK = Uint8Array.from([0x90, 0x00]);
const SIGNATURE_DATA = Uint8Array.from([
  ...new Array(32).fill(0x01),
  ...new Array(32).fill(0x02),
  0x01,
]);

describe("SignTIP712Command", () => {
  const command = new SignTIP712Command({ derivationPath: "44'/195'/0'/0/0" });

  it("should build the full-mode apdu (INS 0x0C, P2=0x01) with path only", () => {
    const raw = command.getApdu().getRawApdu();
    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x0c, 0x00, 0x01]);
    // 1 (count) + 5*4 (path) = 21 bytes of data
    expect(raw[4]).toBe(21);
    expect(raw).toHaveLength(5 + 21);
  });

  it("should parse r/s/v from the response", () => {
    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: SIGNATURE_DATA }),
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual({
        r: `0x${"01".repeat(32)}`,
        s: `0x${"02".repeat(32)}`,
        v: 1,
      });
    }
  });
});
