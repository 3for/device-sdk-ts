import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type SignTypedDataHashDAReturnType } from "@api/app-binder/SignTypedDataHashDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerTron } from "@api/SignerTron";
import { makeContainer } from "@internal/di";
import { messageTypes } from "@internal/message/di/messageTypes";
import { type SignMessageUseCase } from "@internal/message/use-case/SignMessageUseCase";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { type SignTransactionHashUseCase } from "@internal/transaction/use-case/SignTransactionHashUseCase";
import { type SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { type SignTypedDataHashUseCase } from "@internal/typed-data/use-case/SignTypedDataHashUseCase";
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

  signTransaction(
    derivationPath: string,
    rawData: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, rawData, options);
  }

  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message, options);
  }

  signTransactionHash(
    derivationPath: string,
    hash: Uint8Array,
  ): SignTransactionHashDAReturnType {
    return this._container
      .get<SignTransactionHashUseCase>(
        transactionTypes.SignTransactionHashUseCase,
      )
      .execute(derivationPath, hash);
  }

  signTypedDataHash(
    derivationPath: string,
    domainHash: Uint8Array,
    messageHash: Uint8Array,
  ): SignTypedDataHashDAReturnType {
    return this._container
      .get<SignTypedDataHashUseCase>(typedDataTypes.SignTypedDataHashUseCase)
      .execute(derivationPath, domainHash, messageHash);
  }
}
