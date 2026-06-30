import {
  type ContextModule,
  isTronClearSignContextSuccess,
  type TronClearSignContext,
  type TronContractType as ContextModuleTronContractType,
  type TronTransactionContext,
} from "@ledgerhq/context-module";
import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import {
  type TransactionSubset,
  type TronContractType,
} from "@internal/transaction/model/TransactionSubset";
import { DefaultTronTransactionMapperService } from "@internal/transaction/service/DefaultTronTransactionMapperService";
import { type TronTransactionMapperService } from "@internal/transaction/service/TronTransactionMapperService";

export type BuildTronContextsTaskArgs = {
  readonly contextModule: ContextModule;
  readonly rawData: Uint8Array;
  readonly options: TransactionOptions;
  readonly deviceModelId?: DeviceModelId;
  readonly transactionMapper?: TronTransactionMapperService;
};

function toContextModuleTransaction(
  transaction: TransactionSubset,
  deviceModelId?: DeviceModelId,
): TronTransactionContext {
  return {
    ...transaction,
    ...(deviceModelId !== undefined && { deviceModelId }),
    contracts: transaction.contracts.map((contract) => ({
      ...contract,
      type: toContextModuleContractType(contract.type),
    })),
  };
}

function toContextModuleContractType(
  type: TronContractType,
): ContextModuleTronContractType {
  return type as number as ContextModuleTronContractType;
}

export class BuildTronContextsTask {
  private readonly transactionMapper: TronTransactionMapperService;

  constructor(private readonly args: BuildTronContextsTaskArgs) {
    this.transactionMapper =
      args.transactionMapper ?? new DefaultTronTransactionMapperService();
  }

  async run(): Promise<TronClearSignContext[]> {
    if (this.args.options.clearSigningMode === "blind") {
      return [];
    }

    if (this.args.options.contexts !== undefined) {
      return this.args.options.contexts;
    }

    try {
      const transaction = this.transactionMapper.map(this.args.rawData);
      const contexts = await this.args.contextModule.getContexts(
        toContextModuleTransaction(transaction, this.args.deviceModelId),
      );

      return contexts.filter(isTronClearSignContextSuccess);
    } catch {
      return [];
    }
  }
}
