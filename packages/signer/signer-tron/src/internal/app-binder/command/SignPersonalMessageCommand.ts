import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Just, type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

const SIGNATURE_LENGTH = 65;

export type SignPersonalMessageCommandArgs = {
  /**
   * A pre-built chunk. The first chunk is `path || uint32BE(messageLength) ||
   * messageBytes`; continuation chunks carry the remaining message bytes.
   */
  readonly chunk: Uint8Array;
  /** P1: SIGN (0x10) for a single chunk, FIRST (0x00) / MORE (0x80) otherwise. */
  readonly p1: number;
  /** Use INS 0xC8 (full on-device display) instead of 0x08. */
  readonly fullDisplay: boolean;
};

export type SignPersonalMessageCommandResponse = Maybe<Signature>;

/** INS_SIGN_PERSONAL_MESSAGE (0x08) / _FULL_DISPLAY (0xC8) — TIP-191. */
export class SignPersonalMessageCommand
  implements
    Command<
      SignPersonalMessageCommandResponse,
      SignPersonalMessageCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "SignPersonalMessage";
  private readonly errorHelper = new CommandErrorHelper<
    SignPersonalMessageCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: SignPersonalMessageCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: this.args.fullDisplay
        ? INS.SIGN_PERSONAL_MESSAGE_FULL_DISPLAY
        : INS.SIGN_PERSONAL_MESSAGE,
      p1: this.args.p1,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).addBufferToData(this.args.chunk).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse, TronErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) {
      return error;
    }

    if (response.data.length < SIGNATURE_LENGTH) {
      return CommandResultFactory({ data: Nothing });
    }

    const parser = new ApduParser(response);
    const signatureResult = parseSignature(parser);
    if (!isSuccessCommandResult(signatureResult)) {
      return signatureResult;
    }
    return CommandResultFactory({ data: Just(signatureResult.data) });
  }
}
