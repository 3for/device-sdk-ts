import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type SignTypedDataHashDAReturnType } from "@api/app-binder/SignTypedDataHashDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataOptions } from "@api/model/TypedDataOptions";

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

  /**
   * Unsafe: sign a pre-computed 32-byte transaction hash (`sha256(raw_data)`).
   * Requires the "sign by hash" device setting to be enabled.
   */
  signTransactionHash: (
    derivationPath: string,
    hash: Uint8Array,
  ) => SignTransactionHashDAReturnType;

  /**
   * Sign a TIP-712 typed message from its pre-computed hashes
   * (domain separator + hashStruct(message)). Requires the "sign by hash"
   * device setting to be enabled.
   */
  signTypedDataHash: (
    derivationPath: string,
    domainHash: Uint8Array,
    messageHash: Uint8Array,
  ) => SignTypedDataHashDAReturnType;

  /**
   * Sign a TIP-712 typed message (full flow): streams the struct definitions
   * and implementations so the device can render and hash the message itself.
   */
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
    options?: TypedDataOptions,
  ) => SignTypedDataDAReturnType;
}
