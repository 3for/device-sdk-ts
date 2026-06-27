import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type Command,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type ChunkableCommandArgs = {
  readonly chunkedData: Uint8Array;
  readonly isFirstChunk: boolean;
};

export type SendCommandInChunksTaskArgs<T> = {
  readonly data: Uint8Array;
  readonly commandFactory: <V extends ChunkableCommandArgs>(
    args: ChunkableCommandArgs,
  ) => Command<T, V, TronErrorCodes>;
};

export class SendCommandInChunksTask<T> {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendCommandInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, TronErrorCodes>> {
    const data = new ByteArrayBuilder(this.args.data.length)
      .addBufferToData(this.args.data)
      .build();

    for (let i = 0; i < data.length; i += APDU_MAX_PAYLOAD) {
      const isLastChunk = i + APDU_MAX_PAYLOAD >= data.length;
      const result = await this.api.sendCommand(
        this.args.commandFactory({
          chunkedData: data.slice(i, i + APDU_MAX_PAYLOAD),
          isFirstChunk: i === 0,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }

      if (isLastChunk) {
        return CommandResultFactory({ data: result.data });
      }
    }

    throw new InvalidStatusWordError("No result");
  }
}
