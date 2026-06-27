export enum TronClearSignContextType {
  TRC10_TOKEN = "tronTrc10Token",
  TRC20_TOKEN = "tronTrc20Token",
  NFT = "tronNft",
  TRUSTED_NAME = "tronTrustedName",
  ENUM = "tronEnum",
  TRANSACTION_INFO = "tronTransactionInfo",
  TRANSACTION_FIELD_DESCRIPTION = "tronTransactionFieldDescription",
  PROXY_INFO = "tronProxyInfo",
  GATED_SIGNING = "tronGatedSigning",
}

type TronPayloadContextType = Exclude<
  TronClearSignContextType,
  TronClearSignContextType.TRC10_TOKEN
>;

type TronPayloadContext = {
  readonly type: TronPayloadContextType;
  /**
   * Hex payload as expected by the target command. Chunked GTP/TLV contexts
   * are automatically prefixed with their 2-byte payload length by
   * SendPayloadInChunksTask.
   */
  readonly payload: string;
};

export type TronTrc10TokenContext = {
  readonly type: TronClearSignContextType.TRC10_TOKEN;
  /**
   * CAL `live_signature` / `descriptor.signatures[mode]` payload containing
   * the protobuf-encoded app-tron TokenDetails message.
   */
  readonly payload: string;
  /**
   * Token slot in app-tron's legacy transaction parser. Defaults to the
   * context order when omitted.
   */
  readonly tokenIndex?: number;
};

export type TronClearSignContext = TronTrc10TokenContext | TronPayloadContext;
