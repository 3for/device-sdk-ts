import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import { SendSignPersonalMessageTask } from "./SendSignPersonalMessageTask";

const SIGNATURE: Signature = {
  r: "0x01",
  s: "0x02",
  v: 0,
};

describe("SendSignPersonalMessageTask", () => {
  it("uses P1_SIGN for a single-chunk personal message", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      message: Uint8Array.from([0xaa]),
      fullDisplay: false,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    const command = vi.mocked(api.sendCommand).mock.calls[0]![0];
    expect(command.getApdu().getRawApdu()[2]).toBe(0x10);
  });

  it("uses FIRST then MORE for a multi-chunk personal message", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing }))
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      message: Uint8Array.from(new Array(260).fill(0xaa)),
      fullDisplay: true,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const firstCommand = vi.mocked(api.sendCommand).mock.calls[0]![0];
    const secondCommand = vi.mocked(api.sendCommand).mock.calls[1]![0];
    expect(firstCommand.getApdu().getRawApdu()[1]).toBe(0xc8);
    expect(firstCommand.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(secondCommand.getApdu().getRawApdu()[1]).toBe(0xc8);
    expect(secondCommand.getApdu().getRawApdu()[2]).toBe(0x80);
  });
});
