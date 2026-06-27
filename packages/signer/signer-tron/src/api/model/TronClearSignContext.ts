export enum TronClearSignContextType {
  TRC20_TOKEN = "tronTrc20Token",
  NFT = "tronNft",
  TRUSTED_NAME = "tronTrustedName",
  ENUM = "tronEnum",
  TRANSACTION_INFO = "tronTransactionInfo",
  TRANSACTION_FIELD_DESCRIPTION = "tronTransactionFieldDescription",
  PROXY_INFO = "tronProxyInfo",
  GATED_SIGNING = "tronGatedSigning",
}

export type TronClearSignContext = {
  readonly type: TronClearSignContextType;
  /**
   * Hex payload as expected by the target command. Chunked GTP/TLV contexts
   * are automatically prefixed with their 2-byte payload length by
   * SendPayloadInChunksTask.
   */
  readonly payload: string;
};
