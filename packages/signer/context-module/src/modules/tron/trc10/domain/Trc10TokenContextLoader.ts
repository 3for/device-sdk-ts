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
import { type Trc10TokenDataSource } from "@/modules/tron/trc10/data/Trc10TokenDataSource";
import { trc10TokenTypes } from "@/modules/tron/trc10/di/trc10TokenTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRON_TRC10_TOKEN,
];

function getTrc10TokenIds(input: TronTransactionContext): string[] {
  return [
    ...new Set(
      input.contracts
        .filter(
          (contract) =>
            contract.type === TronContractType.TransferAssetContract,
        )
        .map((contract) => contract.assetName)
        .filter((assetName): assetName is string => assetName !== undefined),
    ),
  ];
}

@injectable()
export class Trc10TokenContextLoader
  implements ContextLoader<TronTransactionContext>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(trc10TokenTypes.Trc10TokenDataSource)
    private readonly dataSource: Trc10TokenDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    @optional()
    loggerFactory: (tag: string) => LoggerPublisherService = noopLoggerFactory,
  ) {
    this.logger = loggerFactory("Trc10TokenContextLoader");
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
      getTrc10TokenIds(input as TronTransactionContext).length > 0
    );
  }

  async load(input: TronTransactionContext): Promise<ClearSignContext[]> {
    const tokenIds = getTrc10TokenIds(input);
    const contexts = await Promise.all(
      tokenIds.map(async (tokenId, tokenIndex) => {
        const result = await this.dataSource.getTokenPayload({ tokenId });
        return result.caseOf<ClearSignContext | undefined>({
          Left: () => undefined,
          Right: (payload) => ({
            type: ClearSignContextType.TRON_TRC10_TOKEN,
            payload,
            tokenIndex,
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
