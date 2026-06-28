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
import { type GetECDHPairKeyDAReturnType } from "@api/app-binder/GetECDHPairKeyDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type SignTypedDataHashDAReturnType } from "@api/app-binder/SignTypedDataHashDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TronContextModule } from "@api/model/TronContextModule";
import { type TypedData } from "@api/model/TypedData";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { GetECDHSecretCommand } from "@internal/app-binder/command/GetECDHSecretCommand";
import { SignTIP712HashCommand } from "@internal/app-binder/command/SignTIP712HashCommand";
import { SignTransactionHashCommand } from "@internal/app-binder/command/SignTransactionHashCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { SendSignPersonalMessageTask } from "@internal/app-binder/task/SendSignPersonalMessageTask";
import { externalTypes } from "@internal/externalTypes";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

@injectable()
export class TronAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.ContextModule)
    private contextModule: TronContextModule,
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
    options: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          rawData: args.rawData,
          options: args.options,
          contextModule: this.contextModule,
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

  getECDHPairKey(args: {
    derivationPath: string;
    publicKey: Uint8Array;
    skipOpenApp: boolean;
  }): GetECDHPairKeyDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetECDHSecretCommand({
            derivationPath: args.derivationPath,
            publicKey: args.publicKey,
          }),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  signTypedData(args: {
    derivationPath: string;
    data: TypedData;
    parser: TypedDataParserService;
    skipOpenApp: boolean;
  }): SignTypedDataDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTypedDataDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          data: args.data,
          parser: args.parser,
          skipOpenApp: args.skipOpenApp,
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
