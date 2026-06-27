import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type StartGcsFlowCommandResponse = Signature;

export class StartGcsFlowCommand
  implements Command<StartGcsFlowCommandResponse, void, TronErrorCodes>
{
  readonly name = "StartGcsFlow";
  private readonly errorHelper = new CommandErrorHelper<
    StartGcsFlowCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_GCS,
      p1: P1.FIRST,
      p2: P2.GCS_START_FLOW,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<StartGcsFlowCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => parseSignature(new ApduParser(response)));
  }
}
