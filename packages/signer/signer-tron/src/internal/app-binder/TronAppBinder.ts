import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class TronAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    returnChainCode: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand({
            derivationPath: args.derivationPath,
            checkOnDevice: args.checkOnDevice,
            returnChainCode: args.returnChainCode,
          }),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getAppConfiguration(args: {
    skipOpenApp: boolean;
  }): GetAppConfigurationDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAppConfigurationCommand(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }
}
