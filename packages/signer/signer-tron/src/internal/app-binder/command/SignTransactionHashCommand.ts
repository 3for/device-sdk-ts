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
import { INS, LEDGER_CLA } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type SignTransactionHashCommandArgs = {
  readonly derivationPath: string;
  /** The 32-byte transaction id (sha256 of raw_data). */
  readonly hash: Uint8Array;
};

export type SignTransactionHashCommandResponse = Signature;

/**
 * INS_SIGN_TXN_HASH (0x05). Unsafe blind hash signing — requires the
 * "sign by hash" device setting to be enabled.
 */
export class SignTransactionHashCommand
  implements
    Command<
      SignTransactionHashCommandResponse,
      SignTransactionHashCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "SignTransactionHash";
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionHashCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: SignTransactionHashCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_TXN_HASH,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .addBufferToData(this.args.hash)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionHashCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => parseSignature(new ApduParser(response)));
  }
}
