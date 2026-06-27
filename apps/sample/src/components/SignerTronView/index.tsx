import React, { useMemo } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
  type GetECDHPairKeyDAError,
  type GetECDHPairKeyDAIntermediateValue,
  type GetECDHPairKeyDAOutput,
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
  type TronClearSignContext,
  TronClearSignContextType,
  type TronClearSigningMode,
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

// TransferAssetContract raw_data for TRC10 USDT (token id 1000259).
const SAMPLE_TRC10_USDT_RAW_DATA =
  "0a023dce220895da42177db0050740d8e0a5feed2d5a75080212710a32747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e736665724173736574436f6e7472616374123b0a0731303030323539121541c8599111f29c1e1e061265b4af93ea1f274ad78a1a1541c8599111f29c1e1e061265b4af93ea1f274ad78a20c0843d709d94a2feed2d";

const SAMPLE_ECDH_PUBLIC_KEY =
  "04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83";

// Arbitrary 32-byte hashes for the "sign by hash" smoke tests.
const SAMPLE_HASH = `0x${"11".repeat(32)}`;
const SAMPLE_DOMAIN_HASH = `0x${"22".repeat(32)}`;
const SAMPLE_MESSAGE_HASH = `0x${"33".repeat(32)}`;

const CLEAR_SIGNING_MODE_OPTIONS = [
  { label: "auto", value: "auto" },
  { label: "gcs", value: "gcs" },
  { label: "blind", value: "blind" },
];

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

function parseContextsJson(contextsJson: string): TronClearSignContext[] {
  const trimmed = contextsJson.trim();
  if (trimmed === "") {
    return [];
  }

  const contexts = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(contexts)) {
    throw new Error("contextsJson must be an array");
  }

  const allowedTypes = new Set<string>(Object.values(TronClearSignContextType));
  return contexts.map((context, index) => {
    const record =
      typeof context === "object" && context !== null
        ? (context as Record<string, unknown>)
        : null;

    if (
      record === null ||
      typeof record.type !== "string" ||
      typeof record.payload !== "string" ||
      !allowedTypes.has(record.type)
    ) {
      throw new Error(`Invalid context at index ${index}`);
    }

    const parsedContext: TronClearSignContext = {
      type: record.type as TronClearSignContextType,
      payload: record.payload,
    };

    if (
      record.type === TronClearSignContextType.TRC10_TOKEN &&
      record.tokenIndex !== undefined
    ) {
      if (
        typeof record.tokenIndex !== "number" ||
        !Number.isInteger(record.tokenIndex)
      ) {
        throw new Error(`Invalid TRC10 tokenIndex at index ${index}`);
      }

      return {
        ...parsedContext,
        tokenIndex: record.tokenIndex,
      };
    }

    return parsedContext;
  });
}

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
        title: "Get ECDH Pair Key",
        description:
          "Derive a Tron ECDH pair key with a remote uncompressed secp256k1 public key",
        executeDeviceAction: ({ derivationPath, publicKey, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getECDHPairKey(derivationPath, publicKey, {
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          publicKey: SAMPLE_ECDH_PUBLIC_KEY,
          skipOpenApp: false,
        },
        validateValues: ({ publicKey }) => {
          const bytes = hexaStringToBuffer(publicKey);
          return bytes?.length === 65 && bytes[0] === 0x04;
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetECDHPairKeyDAOutput,
        {
          derivationPath: string;
          publicKey: string;
          skipOpenApp?: boolean;
        },
        GetECDHPairKeyDAError,
        GetECDHPairKeyDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description:
          "Sign a Tron raw_data transaction with blind signing or GCS clear-signing contexts",
        executeDeviceAction: ({
          derivationPath,
          rawData,
          clearSigningMode,
          contextsJson,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const bytes = hexaStringToBuffer(rawData) ?? new Uint8Array();
          const contexts = parseContextsJson(contextsJson);
          return signer.signTransaction(derivationPath, bytes, {
            skipOpenApp,
            clearSigningMode: clearSigningMode as TronClearSigningMode,
            contexts: contexts.length > 0 ? contexts : undefined,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          rawData: SAMPLE_RAW_DATA,
          clearSigningMode: "auto",
          contextsJson: "",
          skipOpenApp: false,
        },
        validateValues: ({ rawData, contextsJson }) => {
          try {
            if (!hexaStringToBuffer(rawData)) {
              return false;
            }
            parseContextsJson(contextsJson);
          } catch {
            return false;
          }
          return true;
        },
        valueSelector: {
          clearSigningMode: CLEAR_SIGNING_MODE_OPTIONS,
        },
        labelSelector: {
          contextsJson: "contexts JSON",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          rawData: string;
          clearSigningMode: string;
          contextsJson: string;
          skipOpenApp?: boolean;
        },
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign TRC10 Transfer",
        description:
          "Sign a TRC10 USDT TransferAssetContract with CAL token-name context",
        executeDeviceAction: ({
          derivationPath,
          rawData,
          clearSigningMode,
          contextsJson,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const bytes = hexaStringToBuffer(rawData) ?? new Uint8Array();
          const contexts = parseContextsJson(contextsJson);
          return signer.signTransaction(derivationPath, bytes, {
            skipOpenApp,
            clearSigningMode: clearSigningMode as TronClearSigningMode,
            contexts: contexts.length > 0 ? contexts : undefined,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          rawData: SAMPLE_TRC10_USDT_RAW_DATA,
          clearSigningMode: "auto",
          contextsJson: "",
          skipOpenApp: false,
        },
        validateValues: ({ rawData, contextsJson }) => {
          try {
            if (!hexaStringToBuffer(rawData)) {
              return false;
            }
            parseContextsJson(contextsJson);
          } catch {
            return false;
          }
          return true;
        },
        valueSelector: {
          clearSigningMode: CLEAR_SIGNING_MODE_OPTIONS,
        },
        labelSelector: {
          contextsJson: "TRC10 contexts JSON",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        {
          derivationPath: string;
          rawData: string;
          clearSigningMode: string;
          contextsJson: string;
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
