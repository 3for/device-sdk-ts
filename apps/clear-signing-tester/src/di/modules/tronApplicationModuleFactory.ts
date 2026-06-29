import { ContainerModule } from "inversify";

import { TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { TestTronTransactionUseCase } from "@root/src/application/usecases/TestTronTransactionUseCase";
import { TYPES } from "@root/src/di/types";

export const tronApplicationModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(TYPES.TestTronTransactionUseCase).to(TestTronTransactionUseCase);
    bind(TYPES.TestBatchTronTransactionFromFileUseCase).to(
      TestBatchTransactionFromFileUseCase,
    );
  });
