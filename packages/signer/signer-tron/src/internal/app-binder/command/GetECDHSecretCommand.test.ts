import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetECDHSecretCommand } from "./GetECDHSecretCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const PUBLIC_KEY = Uint8Array.from(new Array(65).fill(0x04));

describe("GetECDHSecretCommand", () => {
  const command = new GetECDHSecretCommand({
    derivationPath: "44'/195'/0'/0/0",
    publicKey: PUBLIC_KEY,
  });

  it("should build the INS_GET_ECDH_SECRET APDU with path and public key", () => {
    const raw = command.getApdu().getRawApdu();

    expect(Array.from(raw.slice(0, 5))).toStrictEqual([
      0xe0, 0x0a, 0x00, 0x01, 0x56,
    ]);
    expect(raw).toHaveLength(5 + 86);
    expect(Array.from(raw.slice(-65))).toStrictEqual(Array.from(PUBLIC_KEY));
  });

  it("should parse the returned ECDH point", () => {
    const secret = Uint8Array.from(new Array(65).fill(0x03));
    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: secret }),
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual({ secret: `0x${"03".repeat(65)}` });
    }
  });
});
