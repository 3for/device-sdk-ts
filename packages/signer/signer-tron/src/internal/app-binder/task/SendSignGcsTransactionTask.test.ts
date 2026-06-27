import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type TronClearSignContext,
  TronClearSignContextType,
} from "@internal/app-binder/model/TronClearSignContext";

import { SendSignGcsTransactionTask } from "./SendSignGcsTransactionTask";

const SIGNATURE = {
  r: `0x${"01".repeat(32)}`,
  s: `0x${"02".repeat(32)}`,
  v: 0,
};

describe("SendSignGcsTransactionTask", () => {
  it("should store the raw_data then start the GCS flow", async () => {
    const sent: string[] = [];
    const sendCommand = vi.fn(async (command: { name: string }) => {
      sent.push(command.name);
      if (command.name === "StartGcsFlow") {
        return CommandResultFactory({ data: SIGNATURE });
      }
      return CommandResultFactory({ data: undefined });
    });

    const task = new SendSignGcsTransactionTask({ sendCommand } as never, {
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0xaa, 0xbb]),
    });

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(SIGNATURE);
    }
    expect(sent).toStrictEqual(["StoreGcsTransaction", "StartGcsFlow"]);
  });

  it("should provide contexts between store and start-flow", async () => {
    const sent: string[] = [];
    const sendCommand = vi.fn(async (command: { name: string }) => {
      sent.push(command.name);
      if (command.name === "StartGcsFlow") {
        return CommandResultFactory({ data: SIGNATURE });
      }
      return CommandResultFactory({ data: undefined });
    });
    const contexts: TronClearSignContext[] = [
      {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: "0102",
      },
      {
        type: TronClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: "0304",
      },
    ];

    const task = new SendSignGcsTransactionTask({ sendCommand } as never, {
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0xaa, 0xbb]),
      contexts,
    });

    await task.run();

    expect(sent).toStrictEqual([
      "StoreGcsTransaction",
      "ProvideTransactionInformation",
      "ProvideTransactionFieldDescription",
      "StartGcsFlow",
    ]);
  });
});
