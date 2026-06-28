import {
  type Command,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrc20TokenInformationCommand } from "@internal/app-binder/command/ProvideTrc20TokenInformationCommand";
import { TronClearSignContextType } from "@internal/app-binder/model/TronClearSignContext";

import { ProvideContextTask } from "./ProvideContextTask";

describe("ProvideContextTask", () => {
  let sent: Command<unknown, unknown, unknown>[];
  let api: InternalApi;

  beforeEach(() => {
    sent = [];
    const sendCommand = vi.fn(
      async (command: Command<unknown, unknown, unknown>) => {
        sent.push(command);
        return CommandResultFactory({ data: undefined });
      },
    );
    api = { sendCommand } as unknown as InternalApi;
  });

  it("rejects TRC10 contexts (must use the legacy sign-transaction flow)", async () => {
    const result = await new ProvideContextTask(api, {
      context: { type: TronClearSignContextType.TRC10_TOKEN, payload: "0102" },
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sent).toHaveLength(0); // nothing sent to the device
  });

  it("sends NFT info as a single raw APDU with no length prefix (not chunked)", async () => {
    await new ProvideContextTask(api, {
      context: { type: TronClearSignContextType.NFT, payload: "010203" },
    }).run();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(ProvideNFTInformationCommand);
    // [e0, 14, 00, 00, Lc=03, 01, 02, 03] — payload sent verbatim, no 0x00 0x03 prefix
    expect(
      (sent[0] as ProvideNFTInformationCommand).getApdu().getRawApdu(),
    ).toStrictEqual(
      Uint8Array.from([0xe0, 0x14, 0x00, 0x00, 0x03, 0x01, 0x02, 0x03]),
    );
  });

  it("sends TRC20 token info as a single command", async () => {
    await new ProvideContextTask(api, {
      context: {
        type: TronClearSignContextType.TRC20_TOKEN,
        payload: "0455534454",
      },
    }).run();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(ProvideTrc20TokenInformationCommand);
  });

  it("routes TRANSACTION_INFO through the length-prefixed chunked path", async () => {
    await new ProvideContextTask(api, {
      context: {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: "0102",
      },
    }).run();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(ProvideTransactionInformationCommand);
    // [e0, 26, 01(first), 00, Lc=04, 00, 02(len prefix), 01, 02]
    expect(
      (sent[0] as ProvideTransactionInformationCommand).getApdu().getRawApdu(),
    ).toStrictEqual(
      Uint8Array.from([0xe0, 0x26, 0x01, 0x00, 0x04, 0x00, 0x02, 0x01, 0x02]),
    );
  });

  it("propagates a device error", async () => {
    const error = new InvalidStatusWordError("rejected");
    const sendCommand = vi.fn(async () => CommandResultFactory({ error }));
    api = { sendCommand } as unknown as InternalApi;

    const result = await new ProvideContextTask(api, {
      context: { type: TronClearSignContextType.NFT, payload: "010203" },
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
