// Ported from signer-eth SendEIP712StructImplemCommand — app-tron's
// INS_TIP712_STRUCT_IMPL (0x1C) reuses app-ethereum's struct-impl protocol.
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

export enum StructImplemType {
  ROOT = 0x00,
  ARRAY = 0x0f,
  FIELD = 0xff,
}

export type SendTIP712StructImplemCommandArgs =
  | {
      type: StructImplemType.ROOT;
      value: string;
    }
  | {
      type: StructImplemType.ARRAY;
      value: number;
    }
  | {
      type: StructImplemType.FIELD;
      value: {
        /**
         * The chunk of the data ready to send, prefixed by its length in two
         * bytes. Eg. 01020304 => [0x00, 0x04, 0x01, 0x02, 0x03, 0x04].
         */
        data: Uint8Array;
        isLastChunk: boolean;
      };
    };

export class SendTIP712StructImplemCommand
  implements Command<void, SendTIP712StructImplemCommandArgs, TronErrorCodes>
{
  readonly name = "sendTIP712StructImplem";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );
  constructor(private readonly args: SendTIP712StructImplemCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.TIP712_STRUCT_IMPL,
      p1:
        this.args.type != StructImplemType.FIELD || this.args.value.isLastChunk
          ? 0x00
          : 0x01,
      p2: this.args.type,
    };
    switch (this.args.type) {
      case StructImplemType.ROOT:
        return new ApduBuilder(apduBuilderArgs)
          .addAsciiStringToData(this.args.value)
          .build();
      case StructImplemType.ARRAY:
        return new ApduBuilder(apduBuilderArgs)
          .add8BitUIntToData(this.args.value)
          .build();
      case StructImplemType.FIELD:
        return new ApduBuilder(apduBuilderArgs)
          .addBufferToData(this.args.value.data)
          .build();
    }
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
