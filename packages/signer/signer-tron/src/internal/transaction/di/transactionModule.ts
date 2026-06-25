import { ContainerModule } from "inversify";

import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { DefaultTronTransactionMapperService } from "@internal/transaction/service/DefaultTronTransactionMapperService";
import { type TronTransactionMapperService } from "@internal/transaction/service/TronTransactionMapperService";
import { SignTransactionHashUseCase } from "@internal/transaction/use-case/SignTransactionHashUseCase";
import { SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";

export const transactionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(transactionTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(transactionTypes.SignTransactionHashUseCase).to(
      SignTransactionHashUseCase,
    );
    bind<TronTransactionMapperService>(
      transactionTypes.TronTransactionMapperService,
    ).to(DefaultTronTransactionMapperService);
  });
