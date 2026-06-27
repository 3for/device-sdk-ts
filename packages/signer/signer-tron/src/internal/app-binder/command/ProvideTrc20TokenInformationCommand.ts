import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
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

export type ProvideTrc20TokenInformationCommandArgs = {
  /**
   * Hex payload expected by app-tron's INS_PROVIDE_TRC20_TOKEN_INFORMATION:
   * tickerLen || ticker || 34-byte Base58 contract address || decimals4 ||
   * chainId4 || DER signature.
   */
  readonly payload: string;
};

export type ProvideTrc20TokenInformationCommandResponse = {
  readonly tokenIndex: number;
};

export class ProvideTrc20TokenInformationCommand
  implements
    Command<
      ProvideTrc20TokenInformationCommandResponse,
      ProvideTrc20TokenInformationCommandArgs,
      TronErrorCodes
    >
{
  readonly name = "ProvideTrc20TokenInformation";
  private readonly errorHelper = new CommandErrorHelper<
    ProvideTrc20TokenInformationCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: ProvideTrc20TokenInformationCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.PROVIDE_TRC20_TOKEN_INFORMATION,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<
    ProvideTrc20TokenInformationCommandResponse,
    TronErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const tokenIndex = parser.extract8BitUInt() ?? 0;
      return CommandResultFactory({ data: { tokenIndex } });
    });
  }
}
