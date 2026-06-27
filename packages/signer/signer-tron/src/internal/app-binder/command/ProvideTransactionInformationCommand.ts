import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type ProvideTransactionInformationCommandArgs = {
  readonly data: Uint8Array;
  readonly isFirstChunk: boolean;
};

export class ProvideTransactionInformationCommand
  implements
    Command<void, ProvideTransactionInformationCommandArgs, TronErrorCodes>
{
  readonly name = "ProvideTransactionInformation";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(
    private readonly args: ProvideTransactionInformationCommandArgs,
  ) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GTP_TRANSACTION_INFO,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).addBufferToData(this.args.data).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
