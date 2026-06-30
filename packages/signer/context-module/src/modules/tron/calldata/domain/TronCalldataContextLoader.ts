import {
  type LoggerPublisherService,
  noopLoggerFactory,
} from "@ledgerhq/device-management-kit";
import { inject, injectable, optional } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type TronCalldataDescriptorDataSource } from "@/modules/tron/calldata/data/TronCalldataDescriptorDataSource";
import { tronCalldataTypes } from "@/modules/tron/calldata/di/tronCalldataTypes";
import {
  TronContractType,
  type TronTransactionContext,
} from "@/modules/tron/model/TronTransactionContext";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRON_TRANSACTION_INFO,
  ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
  ClearSignContextType.TRON_ENUM,
];

function hasContracts(input: unknown): input is TronTransactionContext {
  return (
    typeof input === "object" &&
    input !== null &&
    "contracts" in input &&
    Array.isArray(input.contracts)
  );
}

@injectable()
export class TronCalldataContextLoader
  implements ContextLoader<TronTransactionContext>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(tronCalldataTypes.TronCalldataDescriptorDataSource)
    private readonly dataSource: TronCalldataDescriptorDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    @optional()
    loggerFactory: (tag: string) => LoggerPublisherService = noopLoggerFactory,
  ) {
    this.logger = loggerFactory("TronCalldataContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TronTransactionContext {
    return (
      hasContracts(input) &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      input.contracts.some(
        (contract) =>
          contract.type === TronContractType.TriggerSmartContract &&
          contract.contractAddress !== undefined &&
          contract.data !== undefined &&
          contract.data.length >= 8,
      )
    );
  }

  async load(input: TronTransactionContext): Promise<ClearSignContext[]> {
    const contracts = input.contracts.filter(
      (contract) =>
        contract.type === TronContractType.TriggerSmartContract &&
        contract.contractAddress !== undefined &&
        contract.data !== undefined &&
        contract.data.length >= 8,
    );

    const contextLists = await Promise.all(
      contracts.map(async (contract) => {
        const result = await this.dataSource.getCalldataDescriptors({
          contractAddress: contract.contractAddress!,
          selector: contract.data!.slice(0, 8),
          ...(input.deviceModelId !== undefined && {
            deviceModelId: input.deviceModelId,
          }),
        });

        return result.caseOf<ClearSignContext[]>({
          Left: () => [],
          Right: (contexts) => contexts,
        });
      }),
    );

    const result = contextLists.flat();
    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
