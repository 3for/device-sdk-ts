import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
  type SignPersonalMessageDAError,
  type SignPersonalMessageDAIntermediateValue,
  type SignPersonalMessageDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type SignTransactionHashDAError,
  type SignTransactionHashDAIntermediateValue,
  type SignTransactionHashDAOutput,
  type SignTypedDataDAError,
  type SignTypedDataDAIntermediateValue,
  type SignTypedDataDAOutput,
  type SignTypedDataHashDAError,
  type SignTypedDataHashDAIntermediateValue,
  type SignTypedDataHashDAOutput,
  type TypedData,
} from "@ledgerhq/device-signer-kit-tron";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerTron } from "@/providers/SignerTronProvider";

const DEFAULT_DERIVATION_PATH = "44'/195'/0'/0/0";

// A real TransferContract raw_data (Transaction.raw) payload, from the
// hw-app-trx signTransaction test vector.
const SAMPLE_RAW_DATA =
  "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

// Arbitrary 32-byte hashes for the "sign by hash" smoke tests.
const SAMPLE_HASH = `0x${"11".repeat(32)}`;
const SAMPLE_DOMAIN_HASH = `0x${"22".repeat(32)}`;
const SAMPLE_MESSAGE_HASH = `0x${"33".repeat(32)}`;

// Canonical EIP-712 "Mail" example (TIP-712 reuses the same structure).
const SAMPLE_TYPED_DATA = JSON.stringify(
  {
    domain: {
      name: "Ether Mail",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
    },
    types: {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    },
    primaryType: "Mail",
    message: {
      from: {
        name: "Cow",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
      },
      to: { name: "Bob", wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" },
      contents: "Hello, Bob!",
    },
  },
  null,
  2,
);

export const SignerTronView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const signer = useSignerTron();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get Address",
        description: "Get a Tron (Base58Check) address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          returnChainCode,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            returnChainCode,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          checkOnDevice: false,
          returnChainCode: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          returnChainCode?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Get App Configuration",
        description: "Get the Tron app version and settings flags",
        executeDeviceAction: () => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAppConfiguration();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigurationDAOutput,
        Record<string, never>,
        GetAppConfigurationDAError,
        GetAppConfigurationDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description: "Blind-sign a Tron raw_data (protobuf) transaction",
        executeDeviceAction: ({ derivationPath, rawData, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const bytes = hexaStringToBuffer(rawData) ?? new Uint8Array();
          return signer.signTransaction(derivationPath, bytes, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          rawData: SAMPLE_RAW_DATA,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          rawData: string;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign Message",
        description: "Sign a TIP-191 personal message",
        executeDeviceAction: ({
          derivationPath,
          message,
          fullDisplay,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message, {
            fullDisplay,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message: "Hello Tron",
          fullDisplay: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPersonalMessageDAOutput,
        {
          derivationPath: string;
          message: string;
          fullDisplay?: boolean;
          skipOpenApp?: boolean;
        },
        SignPersonalMessageDAError,
        SignPersonalMessageDAIntermediateValue
      >,
      {
        title: "Sign Transaction Hash",
        description:
          "Unsafe: sign a 32-byte tx hash (requires 'sign by hash' setting)",
        executeDeviceAction: ({ derivationPath, hash }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const bytes = hexaStringToBuffer(hash) ?? new Uint8Array();
          return signer.signTransactionHash(derivationPath, bytes);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          hash: SAMPLE_HASH,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionHashDAOutput,
        { derivationPath: string; hash: string },
        SignTransactionHashDAError,
        SignTransactionHashDAIntermediateValue
      >,
      {
        title: "Sign Typed Data (hashed)",
        description:
          "Sign TIP-712 from domain + message hashes (requires 'sign by hash')",
        executeDeviceAction: ({ derivationPath, domainHash, messageHash }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const domain = hexaStringToBuffer(domainHash) ?? new Uint8Array();
          const message = hexaStringToBuffer(messageHash) ?? new Uint8Array();
          return signer.signTypedDataHash(derivationPath, domain, message);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          domainHash: SAMPLE_DOMAIN_HASH,
          messageHash: SAMPLE_MESSAGE_HASH,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTypedDataHashDAOutput,
        {
          derivationPath: string;
          domainHash: string;
          messageHash: string;
        },
        SignTypedDataHashDAError,
        SignTypedDataHashDAIntermediateValue
      >,
      {
        title: "Sign Typed Data",
        description: "Sign TIP-712 typed data (full struct-def/impl flow)",
        executeDeviceAction: ({ derivationPath, typedData, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const parsed = JSON.parse(typedData) as TypedData;
          return signer.signTypedData(derivationPath, parsed, { skipOpenApp });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          typedData: SAMPLE_TYPED_DATA,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTypedDataDAOutput,
        {
          derivationPath: string;
          typedData: string;
          skipOpenApp?: boolean;
        },
        SignTypedDataDAError,
        SignTypedDataDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Tron" deviceActions={deviceActions} />
  );
};
