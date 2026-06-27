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

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export type ProvideNFTInformationCommandArgs = {
  readonly payload: string;
};

export class ProvideNFTInformationCommand
  implements Command<void, ProvideNFTInformationCommandArgs, TronErrorCodes>
{
  readonly name = "ProvideNFTInformation";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideNFTInformationCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.PROVIDE_NFT_INFORMATION,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
