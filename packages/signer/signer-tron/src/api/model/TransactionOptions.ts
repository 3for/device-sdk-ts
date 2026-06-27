import { type TronClearSignContext } from "@api/model/TronClearSignContext";

export type TronClearSigningMode = "auto" | "gcs" | "blind";

export type TransactionOptions = {
  readonly skipOpenApp?: boolean;
  readonly clearSigningMode?: TronClearSigningMode;
  readonly contexts?: TronClearSignContext[];
};
