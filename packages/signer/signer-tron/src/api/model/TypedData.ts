// TIP-712 typed data — structurally identical to EIP-712
// (https://eips.ethereum.org/EIPS/eip-712); the Tron app reuses the same
// struct-definition / struct-implementation protocol.

export interface TypedData {
  domain: TypedDataDomain;
  types: Record<string, Array<TypedDataField>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
}

export interface TypedDataField {
  name: string;
  type: string;
}
