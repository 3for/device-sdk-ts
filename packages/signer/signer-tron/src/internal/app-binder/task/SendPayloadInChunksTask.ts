import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

export type SendPayloadInChunksTaskArgs<T> = {
  readonly payload: string;
  readonly commandFactory: SendCommandInChunksTaskArgs<T>["commandFactory"];
  readonly withPayloadLength?: boolean;
};

const PAYLOAD_LENGTH_BYTES = 2;

function getBufferFromPayload(payload: string): Uint8Array | null {
  const buffer = hexaStringToBuffer(payload);
  if (buffer === null || buffer.length === 0) {
    return null;
  }

  return new ByteArrayBuilder(buffer.length + PAYLOAD_LENGTH_BYTES)
    .add16BitUIntToData(buffer.length)
    .addBufferToData(buffer)
    .build();
}

export class SendPayloadInChunksTask<T> {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendPayloadInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, TronErrorCodes>> {
    const { payload, withPayloadLength = true } = this.args;
    const data = withPayloadLength
      ? getBufferFromPayload(payload)
      : hexaStringToBuffer(payload);

    if (!data) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid payload"),
      });
    }

    return new SendCommandInChunksTask(this.api, {
      data,
      commandFactory: this.args.commandFactory,
    }).run();
  }
}
