/**
 * The result of a `getAddress` call.
 *
 * `address` is a 34-character Base58Check Tron address (e.g. "T...").
 */
export type Address = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};
