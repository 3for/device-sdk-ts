import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideEnumValueCommand } from "./ProvideEnumValueCommand";
import { ProvideGatedSigningCommand } from "./ProvideGatedSigningCommand";
import { ProvideNFTInformationCommand } from "./ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "./ProvideProxyInfoCommand";
import { ProvideTransactionFieldDescriptionCommand } from "./ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "./ProvideTransactionInformationCommand";
import { ProvideTrc20TokenInformationCommand } from "./ProvideTrc20TokenInformationCommand";
import { ProvideTrustedNameCommand } from "./ProvideTrustedNameCommand";

const OK = Uint8Array.from([0x90, 0x00]);
const DATA = Uint8Array.from([0xaa, 0xbb]);

describe("provide context commands", () => {
  it.each([
    [
      "ProvideTransactionInformationCommand",
      new ProvideTransactionInformationCommand({
        data: DATA,
        isFirstChunk: true,
      }),
      [0xe0, 0x26, 0x01, 0x00, 0x02, 0xaa, 0xbb],
    ],
    [
      "ProvideTransactionFieldDescriptionCommand",
      new ProvideTransactionFieldDescriptionCommand({
        data: DATA,
        isFirstChunk: false,
      }),
      [0xe0, 0x28, 0x00, 0x00, 0x02, 0xaa, 0xbb],
    ],
    [
      "ProvideTrustedNameCommand",
      new ProvideTrustedNameCommand({ data: DATA, isFirstChunk: true }),
      [0xe0, 0x22, 0x01, 0x00, 0x02, 0xaa, 0xbb],
    ],
    [
      "ProvideEnumValueCommand",
      new ProvideEnumValueCommand({ data: DATA, isFirstChunk: true }),
      [0xe0, 0x24, 0x01, 0x00, 0x02, 0xaa, 0xbb],
    ],
    [
      "ProvideProxyInfoCommand",
      new ProvideProxyInfoCommand({ data: DATA, isFirstChunk: true }),
      [0xe0, 0x2a, 0x01, 0x00, 0x02, 0xaa, 0xbb],
    ],
    [
      "ProvideGatedSigningCommand",
      new ProvideGatedSigningCommand({ data: DATA, isFirstChunk: true }),
      [0xe0, 0x38, 0x01, 0x00, 0x02, 0xaa, 0xbb],
    ],
  ])("should build %s", (_name, command, expected) => {
    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from(expected),
    );
    expect(
      isSuccessCommandResult(
        command.parseResponse(
          new ApduResponse({ statusCode: OK, data: new Uint8Array() }),
        ),
      ),
    ).toBe(true);
  });

  it("should build the TRC20 token information APDU and parse the asset index", () => {
    const command = new ProvideTrc20TokenInformationCommand({
      payload: "0455534454",
    });

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([
        0xe0, 0xca, 0x00, 0x00, 0x05, 0x04, 0x55, 0x53, 0x44, 0x54,
      ]),
    );

    const result = command.parseResponse(
      new ApduResponse({ statusCode: OK, data: Uint8Array.from([0x07]) }),
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual({ tokenIndex: 7 });
    }
  });

  it("should build the NFT information APDU", () => {
    const command = new ProvideNFTInformationCommand({ payload: "010203" });

    expect(command.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([0xe0, 0x14, 0x00, 0x00, 0x03, 0x01, 0x02, 0x03]),
    );
  });
});
