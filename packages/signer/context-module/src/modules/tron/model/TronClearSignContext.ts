import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  type ClearSignContextSuccessBase,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

/**
 * Tron-specific payload overrides — contributed to the shared
 * ClearSignContextSuccessPayloads map at the integration boundary.
 */
export type TronPayloadOverrides = {
  [ClearSignContextType.TRON_TRC10_TOKEN]: ClearSignContextSuccessBase & {
    tokenIndex?: number;
  };
};

export const TronClearSignContextType = {
  TRC10_TOKEN: ClearSignContextType.TRON_TRC10_TOKEN,
  TRC20_TOKEN: ClearSignContextType.TRON_TRC20_TOKEN,
  NFT: ClearSignContextType.TRON_NFT,
  TRUSTED_NAME: ClearSignContextType.TRON_TRUSTED_NAME,
  ENUM: ClearSignContextType.TRON_ENUM,
  TRANSACTION_INFO: ClearSignContextType.TRON_TRANSACTION_INFO,
  TRANSACTION_FIELD_DESCRIPTION:
    ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
  PROXY_INFO: ClearSignContextType.TRON_PROXY_INFO,
  GATED_SIGNING: ClearSignContextType.TRON_GATED_SIGNING,
} as const;

export type TronClearSignContextSuccessType =
  (typeof TronClearSignContextType)[keyof typeof TronClearSignContextType];

export type TronClearSignContextSuccess =
  ClearSignContextSuccess<TronClearSignContextSuccessType>;

export type TronTrc10TokenContext =
  ClearSignContextSuccess<ClearSignContextType.TRON_TRC10_TOKEN>;

/**
 * Public Tron context union consumed by signer-tron.
 */
export type TronClearSignContext = TronClearSignContextSuccess;

export const TRON_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES =
  new Set<ClearSignContextType>(Object.values(TronClearSignContextType));

export function isTronClearSignContextSuccess(
  ctx: ClearSignContext,
): ctx is TronClearSignContextSuccess {
  return TRON_CLEAR_SIGN_CONTEXT_SUCCESS_TYPES.has(ctx.type);
}
