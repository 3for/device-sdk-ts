import { ContainerModule } from "inversify";

import { appConfigTypes } from "@internal/use-cases/app-config/di/appConfigTypes";
import { GetAppConfigurationUseCase } from "@internal/use-cases/app-config/GetAppConfigurationUseCase";

export const appConfigModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appConfigTypes.GetAppConfigurationUseCase).to(
      GetAppConfigurationUseCase,
    );
  });
