import { ContainerModule } from "inversify";

import { HttpTrc10TokenDataSource } from "@/modules/tron/trc10/data/HttpTrc10TokenDataSource";
import { trc10TokenTypes } from "@/modules/tron/trc10/di/trc10TokenTypes";
import { Trc10TokenContextLoader } from "@/modules/tron/trc10/domain/Trc10TokenContextLoader";

export const trc10TokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(trc10TokenTypes.Trc10TokenDataSource).to(HttpTrc10TokenDataSource);
    bind(trc10TokenTypes.Trc10TokenContextLoader).to(Trc10TokenContextLoader);
  });
