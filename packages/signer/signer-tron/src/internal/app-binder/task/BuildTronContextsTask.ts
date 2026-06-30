import {
  type ContextModule,
  isTronClearSignContextSuccess,
  type TronClearSignContextSuccess,
  TronClearSignContextType as ContextModuleTronClearSignContextType,
  type TronContractType as ContextModuleTronContractType,
  type TronTransactionContext,
} from "@ledgerhq/context-module";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import {
  type TronClearSignContext,
  TronClearSignContextType,
} from "@api/model/TronClearSignContext";
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
  readonly transactionMapper?: TronTransactionMapperService;
};

function toContextModuleTransaction(
  transaction: TransactionSubset,
): TronTransactionContext {
  return {
    ...transaction,
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

function toSignerTronContext(
  context: TronClearSignContextSuccess,
): TronClearSignContext {
  switch (context.type) {
    case ContextModuleTronClearSignContextType.TRC10_TOKEN:
      return {
        type: TronClearSignContextType.TRC10_TOKEN,
        payload: context.payload,
        tokenIndex: context.tokenIndex,
      };
    case ContextModuleTronClearSignContextType.TRC20_TOKEN:
      return {
        type: TronClearSignContextType.TRC20_TOKEN,
        payload: context.payload,
      };
    case ContextModuleTronClearSignContextType.NFT:
      return { type: TronClearSignContextType.NFT, payload: context.payload };
    case ContextModuleTronClearSignContextType.TRUSTED_NAME:
      return {
        type: TronClearSignContextType.TRUSTED_NAME,
        payload: context.payload,
      };
    case ContextModuleTronClearSignContextType.ENUM:
      return { type: TronClearSignContextType.ENUM, payload: context.payload };
    case ContextModuleTronClearSignContextType.TRANSACTION_INFO:
      return {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: context.payload,
      };
    case ContextModuleTronClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
      return {
        type: TronClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        payload: context.payload,
      };
    case ContextModuleTronClearSignContextType.PROXY_INFO:
      return {
        type: TronClearSignContextType.PROXY_INFO,
        payload: context.payload,
      };
    case ContextModuleTronClearSignContextType.GATED_SIGNING:
      return {
        type: TronClearSignContextType.GATED_SIGNING,
        payload: context.payload,
      };
  }
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
        toContextModuleTransaction(transaction),
      );

      return contexts
        .filter(isTronClearSignContextSuccess)
        .map(toSignerTronContext);
    } catch {
      return [];
    }
  }
}
