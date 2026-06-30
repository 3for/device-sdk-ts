import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { ecdhModuleFactory } from "@internal/ecdh/di/ecdhModule";
import { externalTypes } from "@internal/externalTypes";
import { messageModuleFactory } from "@internal/message/di/messageModule";
import { transactionModuleFactory } from "@internal/transaction/di/transactionModule";
import { typedDataModuleFactory } from "@internal/typed-data/di/typedDataModule";
import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";
import { appConfigModuleFactory } from "@internal/use-cases/app-config/di/appConfigModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export const makeContainer = ({
  dmk,
  sessionId,
  contextModule,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);

  container.loadSync(
    appBindingModuleFactory(),
    addressModuleFactory(),
    appConfigModuleFactory(),
    ecdhModuleFactory(),
    transactionModuleFactory(),
    messageModuleFactory(),
    typedDataModuleFactory(),
  );

  return container;
};
