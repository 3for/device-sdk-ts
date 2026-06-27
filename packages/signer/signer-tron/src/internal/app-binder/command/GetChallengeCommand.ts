import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

const CHALLENGE_LENGTH = 4;

export type GetChallengeCommandResponse = {
  readonly challenge: string;
};

export class GetChallengeCommand
  implements Command<GetChallengeCommandResponse, void, TronErrorCodes>
{
  readonly name = "GetChallenge";
  private readonly errorHelper = new CommandErrorHelper<
    GetChallengeCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GET_CHALLENGE,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetChallengeCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      if (parser.testMinimalLength(CHALLENGE_LENGTH) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Challenge is missing"),
        });
      }

      const challenge = parser.encodeToHexaString(
        parser.extractFieldByLength(CHALLENGE_LENGTH),
      );

      return CommandResultFactory({
        data: {
          challenge,
        },
      });
    });
  }
}
