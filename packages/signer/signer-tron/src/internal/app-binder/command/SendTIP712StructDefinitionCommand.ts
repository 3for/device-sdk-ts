// Ported from signer-eth SendEIP712StructDefinitionCommand — app-tron's
// INS_TIP712_STRUCT_DEF (0x1A) reuses app-ethereum's struct-definition protocol.
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
import { Just, Maybe, Nothing } from "purify-ts";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";
import {
  ArrayType,
  type FieldName,
  type FieldType,
  PrimitiveType,
  StructType,
} from "@internal/typed-data/model/Types";

import {
  TRON_APP_ERRORS,
  TronAppCommandErrorFactory,
  type TronErrorCodes,
} from "./utils/tronApplicationErrors";

export enum StructDefinitionCommand {
  Name = 0,
  Field = 255,
}

export type SendTIP712StructDefinitionCommandArgs =
  | { command: StructDefinitionCommand.Name; name: string }
  | {
      command: StructDefinitionCommand.Field;
      name: FieldName;
      type: FieldType;
    };

enum ArraySize {
  Dynamic,
  Fixed,
}

enum Type {
  Custom,
  Int,
  Uint,
  Address,
  Bool,
  String,
  FixedSizedBytes,
  DynamicSizedBytes,
  TrcToken,
}

export class SendTIP712StructDefinitionCommand
  implements
    Command<void, SendTIP712StructDefinitionCommandArgs, TronErrorCodes>
{
  readonly name = "sendTIP712StructDefinition";
  private readonly errorHelper = new CommandErrorHelper<void, TronErrorCodes>(
    TRON_APP_ERRORS,
    TronAppCommandErrorFactory,
  );

  constructor(private args: SendTIP712StructDefinitionCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: LEDGER_CLA,
      ins: INS.TIP712_STRUCT_DEF,
      p1: 0x00,
      p2: this.args.command,
    };

    // Struct name
    if (this.args.command === StructDefinitionCommand.Name) {
      return new ApduBuilder(apduArgs)
        .addAsciiStringToData(this.args.name)
        .build();
    }

    // Struct field
    const builder = new ApduBuilder(apduArgs);

    const typeDesc = this.constructTypeDescByte(this.args.type);

    // Add type descriptor
    builder.add8BitUIntToData(typeDesc);

    // Add struct name if this is a custom type
    this.getTypeCustomName(this.args.type).ifJust((customName) => {
      builder.encodeInLVFromAscii(customName);
    });

    // Add type size, if applicable
    this.getTypeSize(this.args.type).ifJust((size) => {
      builder.add8BitUIntToData(size);
    });

    // Add array levels, if it is an array
    if (this.args.type instanceof ArrayType) {
      builder.add8BitUIntToData(this.args.type.levels.length);
      for (const level of this.args.type.levels) {
        level.caseOf({
          Just: (l) => {
            builder.add8BitUIntToData(ArraySize.Fixed).add8BitUIntToData(l);
          },
          Nothing: () => {
            builder.add8BitUIntToData(ArraySize.Dynamic);
          },
        });
      }
    }

    // Add field name
    return builder.encodeInLVFromAscii(this.args.name).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, TronErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }

  private constructTypeDescByte(type: FieldType): number {
    const isArrayBit = type instanceof ArrayType ? 1 : 0;
    const hasTypeSize = this.getTypeSize(type).isJust() ? 1 : 0;
    const typeBits = this.getType(type);

    // Combine the bits using bitwise operations
    return (isArrayBit << 7) | (hasTypeSize << 6) | typeBits;
  }

  private getTypeSize(type: FieldType): Maybe<number> {
    if (type instanceof ArrayType) {
      return this.getTypeSize(type.rootType);
    }
    return type instanceof PrimitiveType ? type.size : Nothing;
  }

  private getTypeCustomName(type: FieldType): Maybe<string> {
    if (type instanceof ArrayType) {
      return this.getTypeCustomName(type.rootType);
    }
    return type instanceof StructType ? Just(type.typeName) : Nothing;
  }

  private getType(type: FieldType): Type {
    if (type instanceof ArrayType) {
      return this.getType(type.rootType);
    } else if (type instanceof StructType) {
      return Type.Custom;
    }
    switch (type.name) {
      case "int":
        return Type.Int;
      case "uint":
        return Type.Uint;
      case "trcToken":
        return Type.TrcToken;
      case "address":
        return Type.Address;
      case "bool":
        return Type.Bool;
      case "string":
        return Type.String;
      case "bytes":
        return type.size.isJust()
          ? Type.FixedSizedBytes
          : Type.DynamicSizedBytes;
    }
  }
}
