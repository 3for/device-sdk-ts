import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerTron {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  getAppConfiguration: () => GetAppConfigurationDAReturnType;

  /**
   * Sign a Tron transaction.
   *
   * @param rawData The protobuf serialization of the transaction's `raw_data`
   *   (i.e. `Transaction.raw`), NOT the full `Transaction`. This matches what
   *   the Tron node returns as `raw_data_hex` and what the device signs
   *   (`sha256(raw_data)`).
   */
  signTransaction: (
    derivationPath: string,
    rawData: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  /** Sign a TIP-191 personal message. */
  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ) => SignPersonalMessageDAReturnType;
}
