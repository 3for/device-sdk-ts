import { type TronClearSignContext } from "@ledgerhq/context-module";

export type TronClearSigningMode = "auto" | "gcs" | "blind";

export type TransactionOptions = {
  readonly skipOpenApp?: boolean;
  readonly clearSigningMode?: TronClearSigningMode;
  readonly contexts?: TronClearSignContext[];
};
