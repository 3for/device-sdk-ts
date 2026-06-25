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

export type SignTransactionCommandArgs = {
  /** A pre-built chunk (the first chunk includes the BIP32 path). */
  readonly chunk: Uint8Array;
  /** P1: FIRST (0x00) / MORE (0x80) / LAST (0x90) / SIGN (0x10, single). */
  readonly p1: number;
};

export type SignTransactionCommandResponse = Maybe<Signature>;

/**
 * INS_SIGN (0x04). Streams a Tron `raw_data` payload in field-aligned chunks;
 * the LAST/SIGN chunk returns the 65-byte signature.
 */
export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "SignTransaction";
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: SignTransactionCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN,
      p1: this.args.p1,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).addBufferToData(this.args.chunk).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, TronErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) {
      return error;
    }

    // Intermediate chunks return an empty body; only the last chunk signs.
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
