import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { HttpTronCalldataDescriptorDataSource } from "@/modules/tron/calldata/data/HttpTronCalldataDescriptorDataSource";
import { tronCalldataTypes } from "@/modules/tron/calldata/di/tronCalldataTypes";
import { TronCalldataContextLoader } from "@/modules/tron/calldata/domain/TronCalldataContextLoader";
import { networkTypes } from "@/shared/network/di/networkTypes";

export const tronCalldataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tronCalldataTypes.TronCalldataDescriptorDataSource).toDynamicValue(
      (context) =>
        new HttpTronCalldataDescriptorDataSource(
          context.get(configTypes.Config),
          context.get(pkiTypes.PkiCertificateLoader),
          context.get(networkTypes.NetworkClient),
        ),
    );
    bind(tronCalldataTypes.TronCalldataContextLoader).to(
      TronCalldataContextLoader,
    );
  });
