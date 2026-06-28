import {
  type Command,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { StartGcsFlowCommand } from "@internal/app-binder/command/StartGcsFlowCommand";
import { StoreGcsTransactionCommand } from "@internal/app-binder/command/StoreGcsTransactionCommand";
import { P1 } from "@internal/app-binder/constants";
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

// "44'/195'/0'/0/0" encoded as: 1-byte element count + 5 × 32-bit big-endian.
// Hardcoded (not via encodeDerivationPath) so the test independently pins the layout.
const PATH = "44'/195'/0'/0/0";
const PATH_BYTES = Uint8Array.from([
  0x05, // 5 elements
  0x80,
  0x00,
  0x00,
  0x2c, // 44'
  0x80,
  0x00,
  0x00,
  0xc3, // 195'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
  0x00,
  0x00,
  0x00,
  0x00, // 0
  0x00,
  0x00,
  0x00,
  0x00, // 0
]);
const PREFIX_LEN = PATH_BYTES.length + 4; // path + 4-byte length = 25
const APDU_HEADER_LEN = 5; // cla, ins, p1, p2, Lc

const u32be = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!) >>>
  0;

/** Body of a StoreGcs APDU, i.e. everything after the 5-byte header. */
const storeBody = (cmd: StoreGcsTransactionCommand): Uint8Array =>
  cmd.getApdu().getRawApdu().slice(APDU_HEADER_LEN);

/**
 * Run the task against an api that records every command object, so individual
 * tests can inspect the StoreGcs chunks (bytes, P1) rather than just names.
 */
const runRecording = async (
  args: ConstructorParameters<typeof SendSignGcsTransactionTask>[1],
) => {
  const sent: Command<unknown, unknown, unknown>[] = [];
  const sendCommand = vi.fn(
    async (command: Command<unknown, unknown, unknown>) => {
      sent.push(command);
      if (command instanceof StartGcsFlowCommand) {
        return CommandResultFactory({ data: SIGNATURE });
      }
      return CommandResultFactory({ data: undefined });
    },
  );
  const result = await new SendSignGcsTransactionTask(
    { sendCommand } as unknown as InternalApi,
    args,
  ).run();
  const stores = sent.filter(
    (c): c is StoreGcsTransactionCommand =>
      c instanceof StoreGcsTransactionCommand,
  );
  return { sent, stores, result };
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

  it("wraps a single-chunk transaction with path + 32-bit BE length prefix and signs with P1.SIGN", async () => {
    // GIVEN a transaction small enough to fit in one chunk
    const rawData = Uint8Array.from([0x0a, 0x0b, 0x0c, 0x0d]);

    // WHEN
    const { stores } = await runRecording({ derivationPath: PATH, rawData });

    // THEN — a single chunk is sent with P1.SIGN (device FIRST/SIGN init branch)
    expect(stores).toHaveLength(1);
    expect(stores[0]!.getApdu().getRawApdu().slice(0, 4)).toStrictEqual(
      Uint8Array.from([0xe0, 0xd4, P1.SIGN, 0x10]),
    );

    // body = [path bytes][rawData.length as 32-bit BE][rawData]
    const body = storeBody(stores[0]!);
    expect(body.slice(0, PATH_BYTES.length)).toStrictEqual(PATH_BYTES);
    expect(u32be(body, PATH_BYTES.length)).toBe(rawData.length);
    expect(body.slice(PREFIX_LEN)).toStrictEqual(rawData);
  });

  it("splits a large transaction into FIRST/MORE/LAST chunks, prefixing only the first", async () => {
    // GIVEN a transaction spanning three APDU chunks.
    // firstChunkCapacity = 255 - 25 = 230, subsequent chunks = 255.
    const rawData = Uint8Array.from({ length: 500 }, (_, i) => i & 0xff);

    // WHEN
    const { stores } = await runRecording({ derivationPath: PATH, rawData });

    // THEN
    expect(stores).toHaveLength(3);

    // P1 progression: FIRST, MORE, LAST
    expect(stores.map((c) => c.getApdu().getRawApdu()[2])).toStrictEqual([
      P1.FIRST,
      P1.MORE,
      P1.LAST,
    ]);

    // only the first chunk carries the prefix; its length field is the full rawData length
    const firstBody = storeBody(stores[0]!);
    expect(firstBody.slice(0, PATH_BYTES.length)).toStrictEqual(PATH_BYTES);
    expect(u32be(firstBody, PATH_BYTES.length)).toBe(rawData.length);

    // reassembling all chunk payloads reconstructs rawData exactly
    const reassembled = [
      firstBody.slice(PREFIX_LEN),
      storeBody(stores[1]!),
      storeBody(stores[2]!),
    ].reduce<number[]>((acc, c) => acc.concat(Array.from(c)), []);
    expect(Uint8Array.from(reassembled)).toStrictEqual(rawData);
  });

  it("short-circuits without starting the flow when a store chunk fails", async () => {
    // GIVEN the first store command fails
    const error = new InvalidStatusWordError("store failed");
    const sent: string[] = [];
    const sendCommand = vi.fn(async (command: { name: string }) => {
      sent.push(command.name);
      return CommandResultFactory({ error });
    });

    // WHEN
    const result = await new SendSignGcsTransactionTask(
      { sendCommand } as unknown as InternalApi,
      {
        derivationPath: PATH,
        rawData: Uint8Array.from([0x01]),
        contexts: [{ type: TronClearSignContextType.NFT, payload: "010203" }],
      },
    ).run();

    // THEN — neither contexts nor start-flow run
    expect(result).toStrictEqual(CommandResultFactory({ error }));
    expect(sent).toStrictEqual(["StoreGcsTransaction"]);
  });

  it("short-circuits without starting the flow when a context fails", async () => {
    // GIVEN a context provision fails (NFT command returns an error)
    const error = new InvalidStatusWordError("context failed");
    const sent: string[] = [];
    const sendCommand = vi.fn(async (command: { name: string }) => {
      sent.push(command.name);
      if (command.name === "ProvideNFTInformation") {
        return CommandResultFactory({ error });
      }
      return CommandResultFactory({ data: undefined });
    });

    // WHEN
    const result = await new SendSignGcsTransactionTask(
      { sendCommand } as unknown as InternalApi,
      {
        derivationPath: PATH,
        rawData: Uint8Array.from([0x01]),
        contexts: [{ type: TronClearSignContextType.NFT, payload: "010203" }],
      },
    ).run();

    // THEN — start-flow never runs
    expect(result).toStrictEqual(CommandResultFactory({ error }));
    expect(sent).not.toContain("StartGcsFlow");
  });

  it("propagates the error when starting the flow fails", async () => {
    // GIVEN the start-flow command fails
    const error = new InvalidStatusWordError("start failed");
    const sendCommand = vi.fn(async (command: { name: string }) => {
      if (command.name === "StartGcsFlow") {
        return CommandResultFactory({ error });
      }
      return CommandResultFactory({ data: undefined });
    });

    // WHEN
    const result = await new SendSignGcsTransactionTask(
      { sendCommand } as unknown as InternalApi,
      { derivationPath: PATH, rawData: Uint8Array.from([0x01]) },
    ).run();

    // THEN
    expect(result).toStrictEqual(CommandResultFactory({ error }));
  });
});
