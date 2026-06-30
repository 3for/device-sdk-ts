import { type EthereumPayloadOverrides } from "@/modules/ethereum/model/EthereumClearSignContext";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type SolanaPayloadOverrides } from "@/modules/solana/model/SolanaClearSignContext";
import { type TronPayloadOverrides } from "@/modules/tron/model/TronClearSignContext";

export enum ClearSignContextType {
  ERROR = "error",
  CONCORDIUM_ACCOUNT_OWNERSHIP = "concordiumAccountOwnership",
  ETHEREUM_TOKEN = "ethereumToken",
  ETHEREUM_NFT = "ethereumNft",
  ETHEREUM_TRUSTED_NAME = "ethereumTrustedName",
  ETHEREUM_PLUGIN = "ethereumPlugin",
  ETHEREUM_EXTERNAL_PLUGIN = "ethereumExternalPlugin",
  ETHEREUM_TRANSACTION_INFO = "ethereumTransactionInfo",
  ETHEREUM_PROXY_INFO = "ethereumProxyInfo",
  ETHEREUM_ENUM = "ethereumEnum",
  ETHEREUM_TRANSACTION_FIELD_DESCRIPTION = "ethereumTransactionFieldDescription",
  ETHEREUM_TRANSACTION_CHECK = "ethereumTransactionCheck",
  ETHEREUM_DYNAMIC_NETWORK = "ethereumDynamicNetwork",
  ETHEREUM_DYNAMIC_NETWORK_ICON = "ethereumDynamicNetworkIcon",
  ETHEREUM_SAFE = "ethereumSafe",
  ETHEREUM_SIGNER = "ethereumSigner",
  ETHEREUM_GATED_SIGNING = "ethereumGatedSigning",
  SOLANA_TOKEN = "solanaToken",
  SOLANA_LIFI = "solanaLifi",
  SOLANA_TRUSTED_NAME = "solanaTrustedName",
  SOLANA_TRANSACTION_CHECK = "solanaTransactionCheck",
  SOLANA_INSTRUCTION_INFO = "solanaInstructionInfo",
  SOLANA_ENUM_VARIANT = "solanaEnumVariant",
  SOLANA_TOKEN_INFO = "solanaTokenInfo",
  SOLANA_TOKEN_ACCOUNT_STATE = "solanaTokenAccountState",
  SOLANA_ALT_RESOLUTION = "solanaAltResolution",
  TRON_TRC10_TOKEN = "tronTrc10Token",
  TRON_TRC20_TOKEN = "tronTrc20Token",
  TRON_NFT = "tronNft",
  TRON_TRUSTED_NAME = "tronTrustedName",
  TRON_ENUM = "tronEnum",
  TRON_TRANSACTION_INFO = "tronTransactionInfo",
  TRON_TRANSACTION_FIELD_DESCRIPTION = "tronTransactionFieldDescription",
  TRON_PROXY_INFO = "tronProxyInfo",
  TRON_GATED_SIGNING = "tronGatedSigning",
}

export type ClearSignContextSuccessType = Exclude<
  ClearSignContextType,
  ClearSignContextType.ERROR
>;

/**
 * Base payload shape shared by every success context. Chain modules extend
 * this via PayloadOverrides for variants that carry typed payloads.
 */
export type ClearSignContextSuccessBase = {
  payload: string;
  certificate?: PkiCertificate;
};

type ClearSignContextSuccessPayloadsBase = {
  [K in ClearSignContextSuccessType]: ClearSignContextSuccessBase;
};

// Chain modules contribute typed-payload overrides. This file is the
// integration boundary that assembles them into the cross-chain union.
type ClearSignContextSuccessPayloadOverrides = EthereumPayloadOverrides &
  SolanaPayloadOverrides &
  TronPayloadOverrides;

type ClearSignContextSuccessPayloads = Omit<
  ClearSignContextSuccessPayloadsBase,
  keyof ClearSignContextSuccessPayloadOverrides
> &
  ClearSignContextSuccessPayloadOverrides;

export type ClearSignContextSuccess<
  T extends ClearSignContextSuccessType = ClearSignContextSuccessType,
> = T extends ClearSignContextSuccessType
  ? { type: T } & ClearSignContextSuccessPayloads[T]
  : never;

export type ClearSignContextError = {
  type: ClearSignContextType.ERROR;
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
