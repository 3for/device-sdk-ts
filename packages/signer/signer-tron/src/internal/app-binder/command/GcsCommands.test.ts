import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { StartGcsFlowCommand } from "./StartGcsFlowCommand";
import { StoreGcsTransactionCommand } from "./StoreGcsTransactionCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const SIGNATURE_DATA = Uint8Array.from([
  ...new Array(32).fill(0x01),
  ...new Array(32).fill(0x02),
  0x00,
]);

describe("GCS commands", () => {
  it("should build the SIGN_GCS store APDU", () => {
    const command = new StoreGcsTransactionCommand({
      chunk: Uint8Array.from([0xaa, 0xbb]),
      p1: 0x10,
    });

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([0xe0, 0xd4, 0x10, 0x10, 0x02, 0xaa, 0xbb]),
    );
  });

  it("should build the SIGN_GCS start-flow APDU and parse the signature", () => {
    const command = new StartGcsFlowCommand();

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([0xe0, 0xd4, 0x00, 0x11, 0x00]),
    );

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
});
