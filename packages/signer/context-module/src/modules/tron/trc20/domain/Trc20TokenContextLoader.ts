import {
  type LoggerPublisherService,
  noopLoggerFactory,
} from "@ledgerhq/device-management-kit";
import { inject, injectable, optional } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import {
  TronContractType,
  type TronTransactionContext,
} from "@/modules/tron/model/TronTransactionContext";
import { type Trc20TokenDataSource } from "@/modules/tron/trc20/data/Trc20TokenDataSource";
import { trc20TokenTypes } from "@/modules/tron/trc20/di/trc20TokenTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const TRC20_SUPPORTED_SELECTORS = new Set([
  "a9059cbb", // transfer(address,uint256)
  "095ea7b3", // approve(address,uint256)
]);

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRON_TRC20_TOKEN,
];

function getTrc20ContractAddresses(input: TronTransactionContext): string[] {
  return [
    ...new Set(
      input.contracts
        .filter(
          (contract) =>
            contract.type === TronContractType.TriggerSmartContract &&
            contract.contractAddress !== undefined &&
            contract.data !== undefined &&
            TRC20_SUPPORTED_SELECTORS.has(
              contract.data.slice(0, 8).toLowerCase(),
            ),
        )
        .map((contract) => contract.contractAddress)
        .filter(
          (contractAddress): contractAddress is string =>
            contractAddress !== undefined,
        ),
    ),
  ];
}

@injectable()
export class Trc20TokenContextLoader
  implements ContextLoader<TronTransactionContext>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(trc20TokenTypes.Trc20TokenDataSource)
    private readonly dataSource: Trc20TokenDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    @optional()
    loggerFactory: (tag: string) => LoggerPublisherService = noopLoggerFactory,
  ) {
    this.logger = loggerFactory("Trc20TokenContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TronTransactionContext {
    return (
      typeof input === "object" &&
      input !== null &&
      "contracts" in input &&
      Array.isArray(input.contracts) &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      getTrc20ContractAddresses(input as TronTransactionContext).length > 0
    );
  }

  async load(input: TronTransactionContext): Promise<ClearSignContext[]> {
    const contractAddresses = getTrc20ContractAddresses(input);
    const contexts = await Promise.all(
      contractAddresses.map(async (contractAddress) => {
        const result = await this.dataSource.getTokenPayload({
          contractAddress,
        });
        return result.caseOf<ClearSignContext | undefined>({
          Left: () => undefined,
          Right: (payload) => ({
            type: ClearSignContextType.TRON_TRC20_TOKEN,
            payload,
          }),
        });
      }),
    );

    const result = contexts.filter(
      (context): context is ClearSignContext => context !== undefined,
    );
    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
