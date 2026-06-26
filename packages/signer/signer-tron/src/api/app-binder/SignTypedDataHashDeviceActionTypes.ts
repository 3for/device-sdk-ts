import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SignTypedDataHashDAOutput = SendCommandInAppDAOutput<Signature>;

export type SignTypedDataHashDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

export type SignTypedDataHashDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<UserInteractionRequired.SignTypedData>;

export type SignTypedDataHashDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataHashDAOutput,
  SignTypedDataHashDAError,
  SignTypedDataHashDAIntermediateValue
>;
