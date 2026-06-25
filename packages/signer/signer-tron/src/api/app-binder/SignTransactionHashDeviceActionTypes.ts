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

export type SignTransactionHashDAOutput = SendCommandInAppDAOutput<Signature>;

export type SignTransactionHashDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

export type SignTransactionHashDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<UserInteractionRequired.SignTransaction>;

export type SignTransactionHashDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionHashDAOutput,
  SignTransactionHashDAError,
  SignTransactionHashDAIntermediateValue
>;
