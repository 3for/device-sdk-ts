// Ported from signer-eth SendEIP712StructImplemTask — prepends the 2-byte
// length to FIELD values and chunks them across APDUs.
import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendTIP712StructImplemCommand,
  StructImplemType,
} from "@internal/app-binder/command/SendTIP712StructImplemCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SendTIP712StructImplemTaskArgs =
  | {
      type: StructImplemType.ROOT;
      value: string;
    }
  | {
      type: StructImplemType.ARRAY;
      value: number;
    }
  | {
      type: StructImplemType.FIELD;
      value: Uint8Array;
    };

export class SendTIP712StructImplemTask {
  constructor(
    private api: InternalApi,
    private args: SendTIP712StructImplemTaskArgs,
  ) {}

  async run(): Promise<CommandResult<void, TronErrorCodes>> {
    // No particular operation to perform on root and array implementations.
    if (this.args.type !== StructImplemType.FIELD) {
      return await this.api.sendCommand(
        new SendTIP712StructImplemCommand(this.args),
      );
    }

    // If the value is a field, prepend its size and chunk it if necessary.
    let result: CommandResult<void, TronErrorCodes> = CommandResultFactory<
      void,
      TronErrorCodes
    >({ data: undefined });
    // Prepend the length to the array, in uint16 big endian encoding
    const buffer = new ByteArrayBuilder(this.args.value.length + 2)
      .add16BitUIntToData(this.args.value.length)
      .addBufferToData(this.args.value)
      .build();

    // Split the buffer into chunks if necessary
    for (let i = 0; i < buffer.length; i += APDU_MAX_PAYLOAD) {
      result = await this.api.sendCommand(
        new SendTIP712StructImplemCommand({
          type: StructImplemType.FIELD,
          value: {
            data: buffer.slice(i, i + APDU_MAX_PAYLOAD),
            isLastChunk: i >= buffer.length - APDU_MAX_PAYLOAD,
          },
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }
    return result;
  }
}
