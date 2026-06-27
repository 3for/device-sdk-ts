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

export enum TIP712FilterType {
  Activation = "activation",
  DiscardedPath = "discarded_path",
  MessageInfo = "message_info",
  Datetime = "datetime",
  Raw = "raw",
  Amount = "amount",
  Token = "token",
  TrustedName = "trusted-name",
  CalldataInfo = "calldata-info",
  CalldataValue = "calldata-value",
  CalldataCallee = "calldata-callee",
  CalldataChainId = "calldata-chain-id",
  CalldataSelector = "calldata-selector",
  CalldataAmount = "calldata-amount",
  CalldataSpender = "calldata-spender",
}

export enum CalldataParamPresence {
  None = 0x0,
  Present = 0x1,
  VerifyingContract = 0x2,
}

export type SendTIP712FilteringCommandArgs =
  | { readonly type: TIP712FilterType.Activation }
  | { readonly type: TIP712FilterType.DiscardedPath; readonly path: string }
  | {
      readonly type: TIP712FilterType.MessageInfo;
      readonly displayName: string;
      readonly filtersCount: number;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.Datetime;
      readonly discarded: boolean;
      readonly displayName: string;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.TrustedName;
      readonly discarded: boolean;
      readonly displayName: string;
      readonly typesAndSourcesPayload: string;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.Token;
      readonly discarded: boolean;
      readonly tokenIndex: number;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.Raw;
      readonly discarded: boolean;
      readonly displayName: string;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.Amount;
      readonly discarded: boolean;
      readonly displayName: string;
      readonly tokenIndex: number;
      readonly signature: string;
    }
  | {
      readonly type: TIP712FilterType.CalldataInfo;
      readonly discarded: boolean;
      readonly calldataIndex: number;
      readonly valueFlag: boolean;
      readonly calleeFlag: CalldataParamPresence;
      readonly chainIdFlag: boolean;
      readonly selectorFlag: boolean;
      readonly amountFlag: boolean;
      readonly spenderFlag: CalldataParamPresence;
      readonly signature: string;
    }
  | {
      readonly type:
        | TIP712FilterType.CalldataValue
        | TIP712FilterType.CalldataCallee
        | TIP712FilterType.CalldataChainId
        | TIP712FilterType.CalldataSelector
        | TIP712FilterType.CalldataAmount
        | TIP712FilterType.CalldataSpender;
      readonly discarded: boolean;
      readonly calldataIndex: number;
      readonly signature: string;
    };

const FILTER_TO_P2: Record<TIP712FilterType, number> = {
  [TIP712FilterType.Activation]: 0x00,
  [TIP712FilterType.DiscardedPath]: 0x01,
  [TIP712FilterType.MessageInfo]: 0x0f,
  [TIP712FilterType.CalldataSpender]: 0xf4,
  [TIP712FilterType.CalldataAmount]: 0xf5,
  [TIP712FilterType.CalldataSelector]: 0xf6,
  [TIP712FilterType.CalldataChainId]: 0xf7,
  [TIP712FilterType.CalldataCallee]: 0xf8,
  [TIP712FilterType.CalldataValue]: 0xf9,
  [TIP712FilterType.CalldataInfo]: 0xfa,
  [TIP712FilterType.TrustedName]: 0xfb,
  [TIP712FilterType.Datetime]: 0xfc,
  [TIP712FilterType.Token]: 0xfd,
  [TIP712FilterType.Amount]: 0xfe,
  [TIP712FilterType.Raw]: 0xff,
};

export class SendTIP712FilteringCommand
  implements Command<void, SendTIP712FilteringCommandArgs, TronErrorCodes>
{
  readonly name = "SendTIP712Filtering";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(private readonly args: SendTIP712FilteringCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.TIP712_FILTERING,
      p1: "discarded" in this.args && this.args.discarded ? 0x01 : 0x00,
      p2: FILTER_TO_P2[this.args.type],
    };
    const builder = new ApduBuilder(apduArgs);

    switch (this.args.type) {
      case TIP712FilterType.MessageInfo:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .add8BitUIntToData(this.args.filtersCount)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case TIP712FilterType.DiscardedPath:
        builder.encodeInLVFromAscii(this.args.path);
        break;
      case TIP712FilterType.Datetime:
      case TIP712FilterType.Raw:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case TIP712FilterType.TrustedName:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .addHexaStringToData(this.args.typesAndSourcesPayload)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case TIP712FilterType.Token:
      case TIP712FilterType.Amount:
        if (this.args.type === TIP712FilterType.Amount) {
          builder.encodeInLVFromAscii(this.args.displayName);
        }
        builder
          .add8BitUIntToData(this.args.tokenIndex)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case TIP712FilterType.CalldataInfo:
        builder
          .add8BitUIntToData(this.args.calldataIndex)
          .add8BitUIntToData(this.args.valueFlag ? 1 : 0)
          .add8BitUIntToData(this.args.calleeFlag)
          .add8BitUIntToData(this.args.chainIdFlag ? 1 : 0)
          .add8BitUIntToData(this.args.selectorFlag ? 1 : 0)
          .add8BitUIntToData(this.args.amountFlag ? 1 : 0)
          .add8BitUIntToData(this.args.spenderFlag)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case TIP712FilterType.CalldataValue:
      case TIP712FilterType.CalldataCallee:
      case TIP712FilterType.CalldataChainId:
      case TIP712FilterType.CalldataSelector:
      case TIP712FilterType.CalldataAmount:
      case TIP712FilterType.CalldataSpender:
        builder
          .add8BitUIntToData(this.args.calldataIndex)
          .encodeInLVFromHexa(this.args.signature);
        break;
    }

    return builder.build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
