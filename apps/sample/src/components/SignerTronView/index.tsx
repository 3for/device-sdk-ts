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
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Tron" deviceActions={deviceActions} />
  );
};
