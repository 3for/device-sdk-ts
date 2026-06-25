import { type TransactionSubset } from "@internal/transaction/model/TransactionSubset";

/**
 * Decodes a Tron `raw_data` protobuf payload (i.e. `Transaction.raw`, what the
 * host passes to `signTransaction`) into a {@link TransactionSubset}.
 */
export interface TronTransactionMapperService {
  map(rawData: Uint8Array): TransactionSubset;
}
