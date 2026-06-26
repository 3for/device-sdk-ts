import { ContainerModule } from "inversify";

import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { SignTypedDataHashUseCase } from "@internal/typed-data/use-case/SignTypedDataHashUseCase";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(typedDataTypes.SignTypedDataHashUseCase).to(SignTypedDataHashUseCase);
  });
