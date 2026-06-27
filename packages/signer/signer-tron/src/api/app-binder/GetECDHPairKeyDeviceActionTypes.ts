import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ECDHPairKey } from "@api/model/ECDHPairKey";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type GetECDHPairKeyDAOutput = SendCommandInAppDAOutput<ECDHPairKey>;

export type GetECDHPairKeyDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

export type GetECDHPairKeyDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<UserInteractionRequired.SignTransaction>;

export type GetECDHPairKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetECDHPairKeyDAOutput,
  GetECDHPairKeyDAError,
  GetECDHPairKeyDAIntermediateValue
>;
