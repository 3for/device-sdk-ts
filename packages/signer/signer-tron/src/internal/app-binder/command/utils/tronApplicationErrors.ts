import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

// Status words returned by app-tron's src/app_errors.h and Ledger SDK
// status_words.h (mirrored by app-tron's fuzzing headers).
export type TronErrorCodes =
  | "6700"
  | "6980"
  | "6982"
  | "6984"
  | "6985"
  | "6a00"
  | "6a80"
  | "6a84"
  | "6a87"
  | "6a88"
  | "6a8a"
  | "6a8b"
  | "6a8c"
  | "6a8d"
  | "6a8e"
  | "6b00"
  | "6d00"
  | "6e00";

export const TRON_APP_ERRORS: CommandErrors<TronErrorCodes> = {
  "6700": { message: "Incorrect length" },
  "6980": { message: "Command not allowed" },
  "6982": { message: "Security status not satisfied (Canceled by user)" },
  "6984": { message: "Plugin not found" },
  "6985": { message: "Condition of use not satisfied" },
  "6a00": { message: "Parameter error without information" },
  "6a80": { message: "Incorrect data" },
  "6a84": { message: "Insufficient memory" },
  "6a87": { message: "Wrong data length" },
  "6a88": { message: "Referenced data not found" },
  "6a8a": { message: "Incorrect BIP32 path" },
  "6a8b": { message: "Missing setting: data not allowed" },
  "6a8c": { message: "Missing setting: sign by hash not allowed" },
  "6a8d": { message: "Missing setting: custom contract not allowed" },
  "6a8e": { message: "Swap checking failed" },
  "6b00": { message: "Incorrect parameter P1 or P2" },
  "6d00": { message: "Incorrect parameter INS" },
  "6e00": { message: "Incorrect parameter CLA" },
};

export class TronAppCommandError extends DeviceExchangeError<TronErrorCodes> {
  constructor(args: CommandErrorArgs<TronErrorCodes>) {
    super({ tag: "TronAppCommandError", ...args });
  }
}

export const TronAppCommandErrorFactory = (
  args: CommandErrorArgs<TronErrorCodes>,
) => new TronAppCommandError(args);
