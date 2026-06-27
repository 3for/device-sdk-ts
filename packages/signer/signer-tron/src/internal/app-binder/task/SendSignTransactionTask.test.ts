import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { TronClearSignContextType } from "@api/model/TronClearSignContext";

import { SendSignTransactionTask } from "./SendSignTransactionTask";

const SIGNATURE: Signature = {
  r: "0x01",
  s: "0x02",
  v: 0,
};

describe("SendSignTransactionTask", () => {
  it("uses the normal terminating sign chunk when no TRC10 context is provided", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignTransactionTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x0a, 0x01, 0xaa]),
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    const command = vi.mocked(api.sendCommand).mock.calls[0]![0];
    expect(command.getApdu().getRawApdu()[2]).toBe(0x10);
  });

  it("uses TRC10 token-name contexts as the terminating signing APDU", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing }))
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignTransactionTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x0a, 0x01, 0xaa]),
      contexts: [
        {
          type: TronClearSignContextType.TRC10_TOKEN,
          payload: "0a04555344541000",
        },
      ],
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toBe(SIGNATURE);
    }
    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const rawCommand = vi.mocked(api.sendCommand).mock.calls[0]![0];
    const tokenNameCommand = vi.mocked(api.sendCommand).mock.calls[1]![0];
    expect(rawCommand.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(tokenNameCommand.getApdu().getRawApdu()).toStrictEqual(
      Uint8Array.from([
        0xe0, 0x04, 0xa8, 0x00, 0x08, 0x0a, 0x04, 0x55, 0x53, 0x44, 0x54, 0x10,
        0x00,
      ]),
    );
  });
});
