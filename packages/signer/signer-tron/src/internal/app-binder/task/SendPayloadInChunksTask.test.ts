import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

vi.mock("./SendCommandInChunksTask");

describe("SendPayloadInChunksTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
      CommandResultFactory({ data: "0x5678" }),
    );
  });

  it("prepends a 2-byte big-endian length by default", async () => {
    const commandFactory = vi.fn();

    const result = await new SendPayloadInChunksTask({} as InternalApi, {
      payload: "010203",
      commandFactory,
    }).run();

    expect(result).toEqual(CommandResultFactory({ data: "0x5678" }));
    expect(SendCommandInChunksTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: new Uint8Array([0x00, 0x03, 0x01, 0x02, 0x03]),
        commandFactory,
      }),
    );
  });

  it("sends the raw buffer with no length prefix when withPayloadLength is false", async () => {
    const commandFactory = vi.fn();

    await new SendPayloadInChunksTask({} as InternalApi, {
      payload: "010203",
      commandFactory,
      withPayloadLength: false,
    }).run();

    expect(SendCommandInChunksTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: new Uint8Array([0x01, 0x02, 0x03]),
        commandFactory,
      }),
    );
  });

  it("returns an error for an invalid payload", async () => {
    const result = await new SendPayloadInChunksTask({} as InternalApi, {
      payload: "not-hexa",
      commandFactory: vi.fn(),
    }).run();

    expect(result).toEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Invalid payload"),
      }),
    );
  });

  it("returns an error for an empty payload", async () => {
    const result = await new SendPayloadInChunksTask({} as InternalApi, {
      payload: "",
      commandFactory: vi.fn(),
    }).run();

    expect(result).toEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Invalid payload"),
      }),
    );
  });
});
