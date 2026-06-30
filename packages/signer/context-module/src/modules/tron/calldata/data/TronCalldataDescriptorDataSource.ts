import { type Either } from "purify-ts";

import { type TronClearSignContextSuccess } from "@/modules/tron/model/TronClearSignContext";

export type GetTronCalldataDescriptorsParams = {
  readonly contractAddress: string;
  readonly selector: string;
};

export interface TronCalldataDescriptorDataSource {
  getCalldataDescriptors(
    params: GetTronCalldataDescriptorsParams,
  ): Promise<Either<Error, TronClearSignContextSuccess[]>>;
}
