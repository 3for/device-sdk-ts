import { type TronClearSignContext } from "@ledgerhq/context-module";
import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { StartGcsFlowCommand } from "@internal/app-binder/command/StartGcsFlowCommand";
import { StoreGcsTransactionCommand } from "@internal/app-binder/command/StoreGcsTransactionCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { P1 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import { ProvideContextTask } from "./ProvideContextTask";

export type SendSignGcsTransactionTaskArgs = {
  readonly derivationPath: string;
  readonly rawData: Uint8Array;
  readonly contexts?: TronClearSignContext[];
};

type GcsTransactionChunk = {
  readonly chunk: Uint8Array;
  readonly p1: number;
};

function buildGcsTransactionChunks({
  derivationPath,
  rawData,
}: SendSignGcsTransactionTaskArgs): GcsTransactionChunk[] {
  const firstChunkPrefix = new ByteArrayBuilder(
    encodeDerivationPath(derivationPath).length + 4,
  )
    .addBufferToData(encodeDerivationPath(derivationPath))
    .add32BitUIntToData(rawData.length)
    .build();

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const firstChunkCapacity = APDU_MAX_PAYLOAD - firstChunkPrefix.length;
  chunks.push(
    new ByteArrayBuilder(
      firstChunkPrefix.length + Math.min(firstChunkCapacity, rawData.length),
    )
      .addBufferToData(firstChunkPrefix)
      .addBufferToData(rawData.slice(0, firstChunkCapacity))
      .build(),
  );
  offset = firstChunkCapacity;

  while (offset < rawData.length) {
    chunks.push(rawData.slice(offset, offset + APDU_MAX_PAYLOAD));
    offset += APDU_MAX_PAYLOAD;
  }

  if (chunks.length === 1) {
    return [{ chunk: chunks[0]!, p1: P1.SIGN }];
  }

  return chunks.map((chunk, index) => ({
    chunk,
    p1:
      index === 0 ? P1.FIRST : index === chunks.length - 1 ? P1.LAST : P1.MORE,
  }));
}

export class SendSignGcsTransactionTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendSignGcsTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronErrorCodes>> {
    const chunks = buildGcsTransactionChunks(this.args);

    for (const { chunk, p1 } of chunks) {
      const result = await this.api.sendCommand(
        new StoreGcsTransactionCommand({ chunk, p1 }),
      );
      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    for (const context of this.args.contexts ?? []) {
      const result = await new ProvideContextTask(this.api, { context }).run();
      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    const result = await this.api.sendCommand(new StartGcsFlowCommand());
    if (!isSuccessCommandResult(result)) {
      return result;
    }
    return CommandResultFactory({ data: result.data });
  }
}
