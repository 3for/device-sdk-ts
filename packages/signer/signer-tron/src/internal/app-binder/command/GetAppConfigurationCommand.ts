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

import { type GetAppConfigurationCommandResponse } from "@api/app-binder/GetAppConfigurationCommandTypes";
import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

// APP_FLAG_* bits — app-tron/src/apdu_constants.h
const FLAG_DATA_ALLOWED = 0x01;
const FLAG_CUSTOM_CONTRACT = 0x02;
const FLAG_TRUNCATE_ADDRESS = 0x04;
const FLAG_SIGN_BY_HASH = 0x08;
const FLAG_VERBOSE_TIP712 = 0x10;
const FLAG_DISPLAY_HASH = 0x20;

/**
 * INS_GET_APP_CONFIGURATION (0x06).
 * Response: [flags, major, minor, patch].
 */
export class GetAppConfigurationCommand
  implements Command<GetAppConfigurationCommandResponse, void, TronErrorCodes>
{
  readonly name = "GetAppConfiguration";
  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigurationCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GET_APP_CONFIGURATION,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const flags = parser.extract8BitUInt();
      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (
        flags === undefined ||
        major === undefined ||
        minor === undefined ||
        patch === undefined
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("App configuration is malformed"),
        });
      }

      return CommandResultFactory({
        data: {
          version: `${major}.${minor}.${patch}`,
          allowData: (flags & FLAG_DATA_ALLOWED) !== 0,
          allowCustomContract: (flags & FLAG_CUSTOM_CONTRACT) !== 0,
          truncateAddress: (flags & FLAG_TRUNCATE_ADDRESS) !== 0,
          signByHash: (flags & FLAG_SIGN_BY_HASH) !== 0,
          verboseTip712: (flags & FLAG_VERBOSE_TIP712) !== 0,
          displayHash: (flags & FLAG_DISPLAY_HASH) !== 0,
        },
      });
    });
  }
}
