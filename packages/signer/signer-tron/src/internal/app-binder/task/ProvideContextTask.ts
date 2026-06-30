import {
  type TronClearSignContext,
  TronClearSignContextType,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { ProvideEnumValueCommand } from "@internal/app-binder/command/ProvideEnumValueCommand";
import { ProvideGatedSigningCommand } from "@internal/app-binder/command/ProvideGatedSigningCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "@internal/app-binder/command/ProvideProxyInfoCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrc20TokenInformationCommand } from "@internal/app-binder/command/ProvideTrc20TokenInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type ProvideContextTaskArgs = {
  readonly context: TronClearSignContext;
};

export class ProvideContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideContextTaskArgs,
  ) {}

  async run(): Promise<CommandResult<unknown, TronErrorCodes>> {
    const { type, payload } = this.args.context;

    switch (type) {
      case TronClearSignContextType.TRC10_TOKEN:
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "TRC10 token context must be provided through the legacy sign transaction flow",
          ),
        });
      case TronClearSignContextType.TRC20_TOKEN:
        return this.api.sendCommand(
          new ProvideTrc20TokenInformationCommand({ payload }),
        );
      case TronClearSignContextType.NFT:
        return this.api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      case TronClearSignContextType.TRANSACTION_INFO:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideTransactionInformationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case TronClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case TronClearSignContextType.TRUSTED_NAME:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case TronClearSignContextType.ENUM:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideEnumValueCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case TronClearSignContextType.PROXY_INFO:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideProxyInfoCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case TronClearSignContextType.GATED_SIGNING:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideGatedSigningCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      default: {
        const uncoveredType: never = type;
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `The Tron context type [${uncoveredType}] is not covered`,
          ),
        });
      }
    }
  }
}
