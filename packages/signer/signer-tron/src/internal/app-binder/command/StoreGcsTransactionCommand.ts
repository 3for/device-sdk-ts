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

import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type StoreGcsTransactionCommandArgs = {
  readonly chunk: Uint8Array;
  readonly p1: number;
};

export class StoreGcsTransactionCommand
  implements Command<void, StoreGcsTransactionCommandArgs, TronErrorCodes>
{
  readonly name = "StoreGcsTransaction";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(private readonly args: StoreGcsTransactionCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_GCS,
      p1: this.args.p1,
      p2: P2.GCS_STORE,
    };
    return new ApduBuilder(apduArgs).addBufferToData(this.args.chunk).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
