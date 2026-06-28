import {
  type Command,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const marker = (args: unknown) =>
  ({ name: "chunk", args }) as unknown as Command<string, never, never>;

describe("SendCommandInChunksTask", () => {
  let sendCommand: ReturnType<typeof vi.fn>;
  let api: InternalApi;

  beforeEach(() => {
    sendCommand = vi.fn(async () => CommandResultFactory({ data: "OK" }));
    api = { sendCommand } as unknown as InternalApi;
  });

  it("sends a sub-255-byte payload as a single first chunk", async () => {
    const commandFactory = vi.fn(marker);
    const data = Uint8Array.from({ length: 10 }, (_, i) => i);

    const result = await new SendCommandInChunksTask(api, {
      data,
      commandFactory,
    }).run();

    expect(commandFactory).toHaveBeenCalledTimes(1);
    expect(commandFactory).toHaveBeenCalledWith({
      chunkedData: data,
      isFirstChunk: true,
    });
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toBe("OK");
    }
  });

  it("splits a larger payload into 255-byte chunks, flagging only the first", async () => {
    const commandFactory = vi.fn(marker);
    const data = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);

    await new SendCommandInChunksTask(api, { data, commandFactory }).run();

    expect(commandFactory).toHaveBeenCalledTimes(2);
    expect(commandFactory.mock.calls[0]![0]).toEqual({
      chunkedData: data.slice(0, 255),
      isFirstChunk: true,
    });
    expect(commandFactory.mock.calls[1]![0]).toEqual({
      chunkedData: data.slice(255, 300),
      isFirstChunk: false,
    });
  });

  it("short-circuits and returns the error from a failing chunk", async () => {
    const error = new InvalidStatusWordError("boom");
    sendCommand.mockResolvedValueOnce(CommandResultFactory({ error }));
    const commandFactory = vi.fn(marker);
    const data = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);

    const result = await new SendCommandInChunksTask(api, {
      data,
      commandFactory,
    }).run();

    expect(result).toStrictEqual(CommandResultFactory({ error }));
    expect(sendCommand).toHaveBeenCalledTimes(1); // second chunk never sent
  });

  it("throws when there is no data to send", async () => {
    await expect(
      new SendCommandInChunksTask(api, {
        data: new Uint8Array(),
        commandFactory: vi.fn(marker),
      }).run(),
    ).rejects.toThrow(InvalidStatusWordError);
  });
});
