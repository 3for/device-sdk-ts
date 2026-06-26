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
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type SignTIP712HashCommandArgs = {
  readonly derivationPath: string;
  /** EIP-712 domain separator hash (32 bytes). */
  readonly domainHash: Uint8Array;
  /** EIP-712 hashStruct(message) (32 bytes). */
  readonly messageHash: Uint8Array;
};

export type SignTIP712HashCommandResponse = Signature;

/**
 * INS_SIGN_TIP_712_MESSAGE (0x0C), legacy/hashed mode (P2=0x00).
 * Signs domainHash || messageHash directly. Requires the "sign by hash"
 * device setting to be enabled.
 */
export class SignTIP712HashCommand
  implements
    Command<
      SignTIP712HashCommandResponse,
      SignTIP712HashCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "SignTIP712Hash";
  private readonly errorHelper = new CommandErrorHelper<
    SignTIP712HashCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: SignTIP712HashCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN_TIP_712_MESSAGE,
      p1: 0x00,
      p2: P2.TIP712_LEGACY_IMPLEM,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .addBufferToData(this.args.domainHash)
      .addBufferToData(this.args.messageHash)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTIP712HashCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => parseSignature(new ApduParser(response)));
  }
}
