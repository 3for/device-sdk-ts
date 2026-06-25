/**
 * Tron contract types — from app-tron `proto/core/Tron.proto`
 * (`Transaction.Contract.ContractType`).
 */
export enum TronContractType {
  AccountCreateContract = 0,
  TransferContract = 1,
  TransferAssetContract = 2,
  VoteAssetContract = 3,
  VoteWitnessContract = 4,
  WitnessCreateContract = 5,
  AssetIssueContract = 6,
  WitnessUpdateContract = 8,
  ParticipateAssetIssueContract = 9,
  AccountUpdateContract = 10,
  FreezeBalanceContract = 11,
  UnfreezeBalanceContract = 12,
  WithdrawBalanceContract = 13,
  UnfreezeAssetContract = 14,
  UpdateAssetContract = 15,
  ProposalCreateContract = 16,
  ProposalApproveContract = 17,
  ProposalDeleteContract = 18,
  SetAccountIdContract = 19,
  CustomContract = 20,
  CreateSmartContract = 30,
  TriggerSmartContract = 31,
  GetContract = 32,
  UpdateSettingContract = 33,
  ExchangeCreateContract = 41,
  ExchangeInjectContract = 42,
  ExchangeWithdrawContract = 43,
  ExchangeTransactionContract = 44,
  UpdateEnergyLimitContract = 45,
  AccountPermissionUpdateContract = 46,
  ClearABIContract = 48,
  UpdateBrokerageContract = 49,
  FreezeBalanceV2Contract = 54,
  UnfreezeBalanceV2Contract = 55,
  WithdrawExpireUnfreezeContract = 56,
  DelegateResourceContract = 57,
  UnDelegateResourceContract = 58,
}

/**
 * A decoded Tron contract from `raw_data.contract[]`.
 *
 * `typeUrl` is the wrapped `google.protobuf.Any.type_url`
 * (`type.googleapis.com/protocol.<Msg>`), passed through untouched.
 * Well-known fields are surfaced for the common contracts; addresses are
 * 34-char Base58Check ("T..."). `raw` is the undecoded contract message bytes.
 */
export type TronContract = {
  readonly type: TronContractType;
  readonly typeName: string;
  readonly typeUrl?: string;
  readonly ownerAddress?: string;
  readonly toAddress?: string;
  readonly contractAddress?: string;
  readonly amount?: bigint;
  readonly callValue?: bigint;
  /** EVM calldata for TriggerSmartContract (4-byte selector + ABI args), hex. */
  readonly data?: string;
  readonly raw: Uint8Array;
};

/**
 * The decoded subset of a Tron `raw_data` payload, used for clear-signing
 * context building (Phase 3+) and inspection.
 */
export type TransactionSubset = {
  readonly contracts: readonly TronContract[];
  readonly refBlockBytes?: string;
  readonly refBlockHash?: string;
  readonly expiration?: bigint;
  readonly timestamp?: bigint;
  readonly feeLimit?: bigint;
  /** Optional memo/data field on the transaction. */
  readonly memo?: string;
};
