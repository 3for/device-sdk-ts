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
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

const PUBLIC_KEY_LENGTH = 65;

export type GetECDHSecretCommandArgs = {
  readonly derivationPath: string;
  readonly publicKey: Uint8Array;
};

export type GetECDHSecretCommandResponse = {
  readonly secret: string;
};

export class GetECDHSecretCommand
  implements
    Command<
      GetECDHSecretCommandResponse,
      GetECDHSecretCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "GetECDHSecret";
  private readonly errorHelper = new CommandErrorHelper<
    GetECDHSecretCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: GetECDHSecretCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GET_ECDH_SECRET,
      p1: 0x00,
      p2: 0x01,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(encodeDerivationPath(this.args.derivationPath))
      .addBufferToData(this.args.publicKey)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetECDHSecretCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      if (parser.testMinimalLength(PUBLIC_KEY_LENGTH) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("ECDH secret is missing"),
        });
      }

      const secret = parser.encodeToHexaString(
        parser.extractFieldByLength(PUBLIC_KEY_LENGTH),
        true,
      );

      return CommandResultFactory({ data: { secret } });
    });
  }
}
