import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type TronClearSignContextSuccess } from "@/modules/tron/model/TronClearSignContext";

export type GetTronCalldataDescriptorsParams = {
  readonly contractAddress: string;
  readonly selector: string;
  readonly deviceModelId?: DeviceModelId;
};

export interface TronCalldataDescriptorDataSource {
  getCalldataDescriptors(
    params: GetTronCalldataDescriptorsParams,
  ): Promise<Either<Error, TronClearSignContextSuccess[]>>;
}
