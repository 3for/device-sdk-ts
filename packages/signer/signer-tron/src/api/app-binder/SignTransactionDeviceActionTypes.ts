import { type ContextModule } from "@ledgerhq/context-module";
import { type TronClearSignContext } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export enum SignTransactionDAStep {
  OPEN_APP = "signer.tron.steps.openApp",
  BUILD_CONTEXTS = "signer.tron.steps.buildContexts",
  SIGN_TRANSACTION = "signer.tron.steps.signTransaction",
  SIGN_GCS_TRANSACTION = "signer.tron.steps.signGcsTransaction",
}

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly rawData: Uint8Array;
  readonly options: TransactionOptions;
  readonly contextModule: ContextModule;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignTransactionDAIntermediateValue = {
  readonly requiredUserInteraction: SignTransactionDARequiredInteraction;
  readonly step: SignTransactionDAStep;
};

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
  readonly contexts: TronClearSignContext[];
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
