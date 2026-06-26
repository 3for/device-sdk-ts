import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SignTypedDataDAOutput = Signature;

export type SignTypedDataDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

type SignTypedDataDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTypedData;

export type SignTypedDataDAIntermediateValue = {
  requiredUserInteraction: SignTypedDataDARequiredInteraction;
};

export type SignTypedDataDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;
