import { ContainerModule } from "inversify";

import { ecdhTypes } from "@internal/ecdh/di/ecdhTypes";
import { GetECDHPairKeyUseCase } from "@internal/ecdh/use-case/GetECDHPairKeyUseCase";

export const ecdhModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ecdhTypes.GetECDHPairKeyUseCase).to(GetECDHPairKeyUseCase);
  });
