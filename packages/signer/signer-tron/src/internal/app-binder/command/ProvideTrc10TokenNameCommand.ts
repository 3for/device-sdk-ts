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
import { INS, LEDGER_CLA, P1 } from "@internal/app-binder/constants";

import { parseSignature } from "./utils/parseSignature";
import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

const SIGNATURE_LENGTH = 65;
const TRC10_LAST_TOKEN_NAME = 0x08;
const MAX_TRC10_TOKEN_INDEX = 1;

export type ProvideTrc10TokenNameCommandArgs = {
  /**
   * Hex payload expected by app-tron's INS_SIGN/P1_TRC10_NAME branch:
   * protobuf TokenDetails { name, precision, signature }.
   */
  readonly payload: string;
  readonly tokenIndex: number;
  readonly isLast: boolean;
};

export type ProvideTrc10TokenNameCommandResponse = Maybe<Signature>;

export class ProvideTrc10TokenNameCommand
  implements
    Command<
      ProvideTrc10TokenNameCommandResponse,
      ProvideTrc10TokenNameCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "ProvideTrc10TokenName";
  private readonly errorHelper = new CommandErrorHelper<
    ProvideTrc10TokenNameCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: ProvideTrc10TokenNameCommandArgs) {
    if (
      !Number.isInteger(args.tokenIndex) ||
      args.tokenIndex < 0 ||
      args.tokenIndex > MAX_TRC10_TOKEN_INDEX
    ) {
      throw new RangeError("TRC10 token index must be 0 or 1");
    }
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.SIGN,
      p1:
        P1.TRC10_NAME |
        this.args.tokenIndex |
        (this.args.isLast ? TRC10_LAST_TOKEN_NAME : 0x00),
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideTrc10TokenNameCommandResponse, TronErrorCodes> {
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
