import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { SignPersonalMessageCommand } from "@internal/app-binder/command/SignPersonalMessageCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { P1 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

const CHUNK_SIZE = 250;

export type SendSignPersonalMessageTaskArgs = {
  readonly derivationPath: string;
  readonly message: Uint8Array;
  readonly fullDisplay: boolean;
};

export class SendSignPersonalMessageTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendSignPersonalMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronErrorCodes>> {
    const { message, fullDisplay } = this.args;

    // First chunk: path || uint32BE(messageLength) || message bytes.
    const prefix = new ByteArrayBuilder()
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .add32BitUIntToData(message.length)
      .build();

    const chunks: Uint8Array[] = [];
    const firstMessageBytes = Math.min(
      message.length,
      CHUNK_SIZE - prefix.length,
    );
    chunks.push(
      new ByteArrayBuilder()
        .addBufferToData(prefix)
        .addBufferToData(message.subarray(0, firstMessageBytes))
        .build(),
    );

    let offset = firstMessageBytes;
    while (offset < message.length) {
      const end = Math.min(offset + CHUNK_SIZE, message.length);
      chunks.push(message.subarray(offset, end));
      offset = end;
    }

    let signature: Maybe<Signature> = Nothing;
    for (let i = 0; i < chunks.length; i++) {
      const result = await this.api.sendCommand(
        new SignPersonalMessageCommand({
          chunk: chunks[i]!,
          p1: chunks.length === 1 ? P1.SIGN : i === 0 ? P1.FIRST : P1.MORE,
          fullDisplay,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return result;
      }
      signature = result.data;
    }

    return signature.caseOf({
      Just: (data) => CommandResultFactory({ data }),
      Nothing: () =>
        CommandResultFactory({
          error: new InvalidStatusWordError(
            "Device did not return a signature for the message",
          ),
        }),
    });
  }
}
