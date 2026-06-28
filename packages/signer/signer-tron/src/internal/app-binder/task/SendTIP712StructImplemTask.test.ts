import {
  type Command,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendTIP712StructImplemCommand,
  StructImplemType,
} from "@internal/app-binder/command/SendTIP712StructImplemCommand";

import { SendTIP712StructImplemTask } from "./SendTIP712StructImplemTask";

const rawApdu = (cmd: Command<unknown, unknown, unknown>) =>
  (cmd as SendTIP712StructImplemCommand).getApdu().getRawApdu();

describe("SendTIP712StructImplemTask", () => {
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

  it("sends a single command for a ROOT implementation, unchanged", async () => {
    await new SendTIP712StructImplemTask(api, {
      type: StructImplemType.ROOT,
      value: "abc",
    }).run();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(SendTIP712StructImplemCommand);
    // [cla, ins, p1=0x00, p2=ROOT(0x00), Lc, ...ascii]
    expect(rawApdu(sent[0]!)).toStrictEqual(
      Uint8Array.from([0xe0, 0x1c, 0x00, 0x00, 0x03, 0x61, 0x62, 0x63]),
    );
  });

  it("sends a single command for an ARRAY implementation", async () => {
    await new SendTIP712StructImplemTask(api, {
      type: StructImplemType.ARRAY,
      value: 5,
    }).run();

    expect(sent).toHaveLength(1);
    expect(rawApdu(sent[0]!)).toStrictEqual(
      Uint8Array.from([0xe0, 0x1c, 0x00, 0x0f, 0x01, 0x05]),
    );
  });

  it("prepends a 2-byte length to a FIELD value sent in one chunk", async () => {
    await new SendTIP712StructImplemTask(api, {
      type: StructImplemType.FIELD,
      value: Uint8Array.from([0xaa, 0xbb]),
    }).run();

    expect(sent).toHaveLength(1);
    // P1=0x00 (last), P2=FIELD(0xff), data=[len16BE=0x0002, aa, bb]
    expect(rawApdu(sent[0]!)).toStrictEqual(
      Uint8Array.from([0xe0, 0x1c, 0x00, 0xff, 0x04, 0x00, 0x02, 0xaa, 0xbb]),
    );
  });

  it("chunks a large FIELD value, marking only the final chunk as last", async () => {
    const value = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);

    await new SendTIP712StructImplemTask(api, {
      type: StructImplemType.FIELD,
      value,
    }).run();

    // buffer = 2-byte length + 300 = 302 bytes → chunks of 255 + 47
    expect(sent).toHaveLength(2);
    // P1: first chunk not last (0x01), final chunk last (0x00)
    expect(rawApdu(sent[0]!)[2]).toBe(0x01);
    expect(rawApdu(sent[1]!)[2]).toBe(0x00);

    // reassembling the chunk bodies yields [len16BE, ...value]
    const body0 = rawApdu(sent[0]!).slice(5);
    const body1 = rawApdu(sent[1]!).slice(5);
    const reassembled = Uint8Array.from([...body0, ...body1]);
    expect(reassembled).toStrictEqual(
      Uint8Array.from([0x01, 0x2c, ...value]), // 0x012c = 300 = value.length
    );
  });

  it("short-circuits when a FIELD chunk fails", async () => {
    const error = new InvalidStatusWordError("field failed");
    const sendCommand = vi.fn(
      async (command: Command<unknown, unknown, unknown>) => {
        sent.push(command);
        return CommandResultFactory({ error });
      },
    );
    api = { sendCommand } as unknown as InternalApi;
    const value = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);

    const result = await new SendTIP712StructImplemTask(api, {
      type: StructImplemType.FIELD,
      value,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sent).toHaveLength(1); // second chunk never sent
  });
});
