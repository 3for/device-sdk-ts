import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { messageModuleFactory } from "@internal/message/di/messageModule";
import { transactionModuleFactory } from "@internal/transaction/di/transactionModule";
import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";
import { appConfigModuleFactory } from "@internal/use-cases/app-config/di/appConfigModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export const makeContainer = ({ dmk, sessionId }: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  container.loadSync(
    appBindingModuleFactory(),
    addressModuleFactory(),
    appConfigModuleFactory(),
    transactionModuleFactory(),
    messageModuleFactory(),
  );

  return container;
};
