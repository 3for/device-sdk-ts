import { ContainerModule } from "inversify";

import { HttpTrc20TokenDataSource } from "@/modules/tron/trc20/data/HttpTrc20TokenDataSource";
import { trc20TokenTypes } from "@/modules/tron/trc20/di/trc20TokenTypes";
import { Trc20TokenContextLoader } from "@/modules/tron/trc20/domain/Trc20TokenContextLoader";

export const trc20TokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(trc20TokenTypes.Trc20TokenDataSource).to(HttpTrc20TokenDataSource);
    bind(trc20TokenTypes.Trc20TokenContextLoader).to(Trc20TokenContextLoader);
  });
