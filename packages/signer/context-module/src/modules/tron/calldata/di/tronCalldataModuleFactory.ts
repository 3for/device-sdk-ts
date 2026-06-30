import { ContainerModule } from "inversify";

import { HttpTronCalldataDescriptorDataSource } from "@/modules/tron/calldata/data/HttpTronCalldataDescriptorDataSource";
import { tronCalldataTypes } from "@/modules/tron/calldata/di/tronCalldataTypes";
import { TronCalldataContextLoader } from "@/modules/tron/calldata/domain/TronCalldataContextLoader";

export const tronCalldataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tronCalldataTypes.TronCalldataDescriptorDataSource).to(
      HttpTronCalldataDescriptorDataSource,
    );
    bind(tronCalldataTypes.TronCalldataContextLoader).to(
      TronCalldataContextLoader,
    );
  });
