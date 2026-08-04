import {
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { InitTIP712Command } from "@internal/app-binder/command/InitTIP712Command";
import {
  SendTIP712StructDefinitionCommand,
  StructDefinitionCommand,
} from "@internal/app-binder/command/SendTIP712StructDefinitionCommand";
import { StructImplemType } from "@internal/app-binder/command/SendTIP712StructImplemCommand";
import { SignTIP712Command } from "@internal/app-binder/command/SignTIP712Command";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { SendTIP712StructImplemTask } from "@internal/app-binder/task/SendTIP712StructImplemTask";
import {
  type TypedDataValue,
  TypedDataValueArray,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export type SignTypedDataTaskArgs = {
  readonly derivationPath: string;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
};

/**
 * Full TIP-712 signing flow (no clear-signing filters): parse the typed data,
 * lock the signing path (0x0C P1=0x01), stream struct definitions (0x1A),
 * then domain + message implementations (0x1C), then sign (0x0C P1=0x00,
 * P2=0x01).
 */
export class SignTypedDataTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SignTypedDataTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronErrorCodes>> {
    const parsed = this.args.parser.parse(this.args.data);
    if (parsed.isLeft()) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(parsed.extract().message),
      });
    }
    const { types, domain, message } = parsed.unsafeCoerce();

    // 1. Initialize the full-mode session and lock the signing path before
    // uploading any schema or implementation data.
    const initResult = await this.api.sendCommand(
      new InitTIP712Command({ derivationPath: this.args.derivationPath }),
    );
    if (!isSuccessCommandResult(initResult)) {
      return initResult;
    }

    // 2. Struct definitions, sorted by name for determinism.
    const sortedTypes = Object.entries(types).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [structName, fields] of sortedTypes) {
      const nameResult = await this.api.sendCommand(
        new SendTIP712StructDefinitionCommand({
          command: StructDefinitionCommand.Name,
          name: structName,
        }),
      );
      if (!isSuccessCommandResult(nameResult)) {
        return nameResult;
      }
      for (const [fieldName, fieldType] of Object.entries(fields)) {
        const fieldResult = await this.api.sendCommand(
          new SendTIP712StructDefinitionCommand({
            command: StructDefinitionCommand.Field,
            name: fieldName,
            type: fieldType,
          }),
        );
        if (!isSuccessCommandResult(fieldResult)) {
          return fieldResult;
        }
      }
    }

    // 3. Domain implementation, then 4. message implementation.
    for (const value of [...domain, ...message]) {
      const implResult = await this.getImplementationTask(value).run();
      if (!isSuccessCommandResult(implResult)) {
        return implResult;
      }
    }

    // 5. Sign with the same derivation path locked during initialization.
    return this.api.sendCommand(
      new SignTIP712Command({ derivationPath: this.args.derivationPath }),
    );
  }

  private getImplementationTask(
    value: TypedDataValue,
  ): SendTIP712StructImplemTask {
    if (value.value instanceof TypedDataValueRoot) {
      return new SendTIP712StructImplemTask(this.api, {
        type: StructImplemType.ROOT,
        value: value.value.root,
      });
    } else if (value.value instanceof TypedDataValueArray) {
      return new SendTIP712StructImplemTask(this.api, {
        type: StructImplemType.ARRAY,
        value: value.value.length,
      });
    }
    return new SendTIP712StructImplemTask(this.api, {
      type: StructImplemType.FIELD,
      value: value.value.data,
    });
  }
}
