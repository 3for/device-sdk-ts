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
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

const CHAIN_CODE_LENGTH = 32;

/**
 * INS_GET_PUBLIC_KEY (0x02).
 *
 * Response layout (see app-tron helpers.c helper_send_response_pubkey):
 *   [1] publicKeyLength | [publicKeyLength] publicKey
 *   [1] addressLength   | [addressLength] Base58Check address (ASCII)
 *   [32] chainCode (optional, when P2 = CHAINCODE)
 */
export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, TronErrorCodes>
{
  readonly name = "GetAddress";
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    TronErrorCodes
  >(TRON_APP_ERRORS, TronAppCommandErrorFactory);

  constructor(private readonly args: GetAddressCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.GET_PUBLIC_KEY,
      p1: this.args.checkOnDevice ? P1.CONFIRM : P1.NON_CONFIRM,
      p2: this.args.returnChainCode ? P2.CHAINCODE : P2.NO_CHAINCODE,
    };
    const builder = new ApduBuilder(apduArgs);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, TronErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const publicKeyLength = parser.extract8BitUInt();
      if (publicKeyLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key length is missing"),
        });
      }
      if (parser.testMinimalLength(publicKeyLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }
      const publicKey = parser.encodeToHexaString(
        parser.extractFieldByLength(publicKeyLength),
      );

      const addressLength = parser.extract8BitUInt();
      if (addressLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address length is missing"),
        });
      }
      if (parser.testMinimalLength(addressLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Address is missing"),
        });
      }
      // The Tron address is already a Base58Check ASCII string ("T...").
      const address = parser.encodeToString(
        parser.extractFieldByLength(addressLength),
      );

      let chainCode: string | undefined = undefined;
      if (this.args.returnChainCode) {
        if (parser.testMinimalLength(CHAIN_CODE_LENGTH) === false) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Invalid chain code"),
          });
        }
        chainCode = parser.encodeToHexaString(
          parser.extractFieldByLength(CHAIN_CODE_LENGTH),
        );
      }

      return CommandResultFactory({
        data: { publicKey, address, chainCode },
      });
    });
  }
}
