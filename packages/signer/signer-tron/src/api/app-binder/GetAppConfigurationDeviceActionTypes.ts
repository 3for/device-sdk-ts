import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAppConfigurationCommandResponse } from "@api/app-binder/GetAppConfigurationCommandTypes";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type GetAppConfigurationDAOutput =
  SendCommandInAppDAOutput<GetAppConfigurationCommandResponse>;

export type GetAppConfigurationDAError =
  | OpenAppDAError
  | CommandErrorResult<TronErrorCodes>["error"];

export type GetAppConfigurationDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<UserInteractionRequired.None>;

export type GetAppConfigurationDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigurationDAOutput,
  GetAppConfigurationDAError,
  GetAppConfigurationDAIntermediateValue
>;
