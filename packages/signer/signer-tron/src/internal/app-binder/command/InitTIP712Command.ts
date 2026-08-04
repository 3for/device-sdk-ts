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

import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type InitTIP712CommandArgs = {
  readonly derivationPath: string;
};

/**
 * Starts a full TIP-712 session and locks its signing path before any schema,
 * implementation, or filtering APDUs are uploaded.
 */
export class InitTIP712Command
  implements Command<void, InitTIP712CommandArgs, TronErrorCodes>
{
  readonly name = "initTIP712";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(private readonly args: InitTIP712CommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_TIP_712_MESSAGE,
      p1: P1.TIP712_INIT,
      p2: P2.TIP712_FULL_IMPLEM,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
