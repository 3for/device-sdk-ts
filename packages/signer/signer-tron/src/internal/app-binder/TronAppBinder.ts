import {
  CallTaskInAppDeviceAction,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type SignTypedDataHashDAReturnType } from "@api/app-binder/SignTypedDataHashDeviceActionTypes";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTIP712HashCommand } from "@internal/app-binder/command/SignTIP712HashCommand";
import { SignTransactionHashCommand } from "@internal/app-binder/command/SignTransactionHashCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignPersonalMessageTask } from "@internal/app-binder/task/SendSignPersonalMessageTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";
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

  signTransaction(args: {
    derivationPath: string;
    rawData: Uint8Array;
    skipOpenApp: boolean;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignTransactionTask(internalApi, {
              derivationPath: args.derivationPath,
              rawData: args.rawData,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signMessage(args: {
    derivationPath: string;
    message: Uint8Array;
    fullDisplay: boolean;
    skipOpenApp: boolean;
  }): SignPersonalMessageDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignPersonalMessageTask(internalApi, {
              derivationPath: args.derivationPath,
              message: args.message,
              fullDisplay: args.fullDisplay,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signTransactionHash(args: {
    derivationPath: string;
    hash: Uint8Array;
  }): SignTransactionHashDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignTransactionHashCommand({
            derivationPath: args.derivationPath,
            hash: args.hash,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: false,
        },
      }),
    });
  }

  signTypedDataHash(args: {
    derivationPath: string;
    domainHash: Uint8Array;
    messageHash: Uint8Array;
  }): SignTypedDataHashDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new SignTIP712HashCommand({
            derivationPath: args.derivationPath,
            domainHash: args.domainHash,
            messageHash: args.messageHash,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTypedData,
          skipOpenApp: false,
        },
      }),
    });
  }
}
