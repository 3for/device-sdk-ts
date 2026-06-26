import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTIP712HashCommand } from "./SignTIP712HashCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const DOMAIN_HASH = Uint8Array.from(new Array(32).fill(0xaa));
const MESSAGE_HASH = Uint8Array.from(new Array(32).fill(0xbb));
const SIGNATURE_DATA = Uint8Array.from([
  ...new Array(32).fill(0x01),
  ...new Array(32).fill(0x02),
  0x01,
]);

describe("SignTIP712HashCommand", () => {
  const command = new SignTIP712HashCommand({
    derivationPath: "44'/195'/0'/0/0",
    domainHash: DOMAIN_HASH,
    messageHash: MESSAGE_HASH,
  });

  it("should build the INS_SIGN_TIP_712_MESSAGE apdu (legacy P2=0x00)", () => {
    const raw = command.getApdu().getRawApdu();
    // cla, ins, p1, p2
    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x0c, 0x00, 0x00]);
    // 1 (count) + 5*4 (path) + 32 (domain) + 32 (message) = 85 bytes
    expect(raw[4]).toBe(85);
    expect(raw).toHaveLength(5 + 85);
    expect(Array.from(raw.slice(5 + 21, 5 + 21 + 32))).toStrictEqual(
      Array.from(DOMAIN_HASH),
    );
    expect(Array.from(raw.slice(-32))).toStrictEqual(Array.from(MESSAGE_HASH));
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
        v: 1,
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
