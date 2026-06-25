import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerTron } from "@api/SignerTron";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { appConfigTypes } from "@internal/use-cases/app-config/di/appConfigTypes";
import { type GetAppConfigurationUseCase } from "@internal/use-cases/app-config/GetAppConfigurationUseCase";

type DefaultSignerTronConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerTron implements SignerTron {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerTronConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(
        appConfigTypes.GetAppConfigurationUseCase,
      )
      .execute();
  }

  // TODO(Phase 1): wire to SignTransactionUseCase (INS_SIGN 0x04 / INS_SIGN_GCS 0xD4)
  signTransaction(
    _derivationPath: string,
    _rawData: Uint8Array,
    _options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    throw new Error("signTransaction is not implemented yet (Phase 1)");
  }

  // TODO(Phase 1): wire to SignMessageUseCase (INS_SIGN_PERSONAL_MESSAGE 0x08 / 0xC8)
  signMessage(
    _derivationPath: string,
    _message: string | Uint8Array,
    _options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    throw new Error("signMessage is not implemented yet (Phase 1)");
  }
}
