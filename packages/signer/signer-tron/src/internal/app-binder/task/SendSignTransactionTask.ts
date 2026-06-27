import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  TronClearSignContextType,
  type TronTrc10TokenContext,
} from "@api/model/TronClearSignContext";
import { ProvideTrc10TokenNameCommand } from "@internal/app-binder/command/ProvideTrc10TokenNameCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { P1 } from "@internal/app-binder/constants";
import { buildTransactionChunks } from "@internal/transaction/service/chunking";

export type SendSignTransactionTaskArgs = {
  readonly derivationPath: string;
  /** The `raw_data` protobuf bytes (`Transaction.raw`). */
  readonly rawData: Uint8Array;
  readonly contexts?: readonly TronTrc10TokenContext[];
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
    const trc10Contexts = (this.args.contexts ?? []).filter(
      (context) => context.type === TronClearSignContextType.TRC10_TOKEN,
    );

    let signature: Maybe<Signature> = Nothing;
    for (const [index, { chunk, p1 }] of chunks.entries()) {
      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          chunk,
          p1:
            trc10Contexts.length === 0 ? p1 : index === 0 ? P1.FIRST : P1.MORE,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return result;
      }
      signature = result.data;
    }

    for (const [index, context] of trc10Contexts.entries()) {
      const result = await this.api.sendCommand(
        new ProvideTrc10TokenNameCommand({
          payload: context.payload,
          tokenIndex: context.tokenIndex ?? index,
          isLast: index === trc10Contexts.length - 1,
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
            "Device did not return a signature for the transaction",
          ),
        }),
    });
  }
}
