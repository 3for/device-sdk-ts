import { ContainerModule } from "inversify";

import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";
import { SignTypedDataHashUseCase } from "@internal/typed-data/use-case/SignTypedDataHashUseCase";
import { SignTypedDataUseCase } from "@internal/typed-data/use-case/SignTypedDataUseCase";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(typedDataTypes.SignTypedDataHashUseCase).to(SignTypedDataHashUseCase);
    bind(typedDataTypes.SignTypedDataUseCase).to(SignTypedDataUseCase);
    bind<TypedDataParserService>(typedDataTypes.TypedDataParserService).to(
      DefaultTypedDataParserService,
    );
  });
