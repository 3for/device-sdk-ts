import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { buildTransactionChunks } from "@internal/transaction/service/chunking";

export type SendSignTransactionTaskArgs = {
  readonly derivationPath: string;
  /** The `raw_data` protobuf bytes (`Transaction.raw`). */
  readonly rawData: Uint8Array;
};

export class SendSignTransactionTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendSignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronErrorCodes>> {
    const chunks = buildTransactionChunks(
      this.args.derivationPath,
      this.args.rawData,
    );

    let signature: Maybe<Signature> = Nothing;
    for (const { chunk, p1 } of chunks) {
      const result = await this.api.sendCommand(
        new SignTransactionCommand({ chunk, p1 }),
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
            "Device did not return a signature for the transaction",
          ),
        }),
    });
  }
}
