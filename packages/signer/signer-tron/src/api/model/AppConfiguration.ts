/**
 * Decoded response of INS_GET_APP_CONFIGURATION (0x06).
 *
 * The flags mirror app-tron's APP_FLAG_* byte (resp[0]).
 */
export type AppConfiguration = {
  readonly version: string;
  readonly allowData: boolean;
  readonly allowCustomContract: boolean;
  readonly truncateAddress: boolean;
  readonly signByHash: boolean;
  readonly verboseTip712: boolean;
  readonly displayHash: boolean;
};
