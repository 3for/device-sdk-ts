// Full-mode TIP-712 signing (INS 0x0C, P2=0x01): signs after the struct
// definitions and implementations have been streamed. The legacy/hashed mode
// (P2=0x00) lives in SignTIP712HashCommand.
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
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type SignTIP712CommandArgs = {
  readonly derivationPath: string;
};

export type SignTIP712CommandResponse = Signature;

export class SignTIP712Command
  implements
    Command<SignTIP712CommandResponse, SignTIP712CommandArgs, TronErrorCodes>
{
  readonly name = "signTIP712";
  private readonly errorHelper = new CommandErrorHelper<
    SignTIP712CommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: SignTIP712CommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_TIP_712_MESSAGE,
      p1: P1.TIP712_SIGN,
      p2: P2.TIP712_FULL_IMPLEM,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTIP712CommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => parseSignature(new ApduParser(response)));
  }
}
