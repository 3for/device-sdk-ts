import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export enum SignTypedDataDAStep {
  OPEN_APP = "signer.tron.steps.openApp",
  SIGN_TYPED_DATA = "signer.tron.steps.signTypedData",
}

export type SignTypedDataDAOutput = Signature;

export type SignTypedDataDAInput = {
  readonly derivationPath: string;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
  readonly skipOpenApp: boolean;
};

export type SignTypedDataDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

type SignTypedDataDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTypedData;

export type SignTypedDataDAIntermediateValue = {
  readonly requiredUserInteraction: SignTypedDataDARequiredInteraction;
  readonly step: SignTypedDataDAStep;
};

export type SignTypedDataDAInternalState = {
  readonly error: SignTypedDataDAError | null;
  readonly signature: Signature | null;
};

export type SignTypedDataDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;
