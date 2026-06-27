import {
  TronClearSignContextType,
  type TronTrc10TokenContext,
} from "@api/model/TronClearSignContext";
import {
  type TronContextModule,
  type TronContextModuleInput,
} from "@api/model/TronContextModule";
import {
  type TransactionSubset,
  TronContractType,
} from "@internal/transaction/model/TransactionSubset";
import { DefaultTronTransactionMapperService } from "@internal/transaction/service/DefaultTronTransactionMapperService";
import { type TronTransactionMapperService } from "@internal/transaction/service/TronTransactionMapperService";

const DEFAULT_CAL_BASE_URL = "https://crypto-assets-service.api.ledger.com/v1";

type JsonResponse = {
  readonly ok: boolean;
  readonly json: () => Promise<unknown>;
};

export type TronContextModuleFetch = (
  input: string,
  init?: {
    readonly headers?: Record<string, string>;
  },
) => Promise<JsonResponse>;

export type DefaultTronContextModuleArgs = {
  readonly originToken?: string;
  readonly calBaseUrl?: string;
  readonly fetchImpl?: TronContextModuleFetch;
  readonly transactionMapper?: TronTransactionMapperService;
};

type TronTokenDto = {
  readonly id?: string;
  readonly standard?: string;
  readonly descriptor?: {
    readonly signatures?: {
      readonly prod?: string;
      readonly test?: string;
    };
  };
  readonly live_signature?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTokenDto(value: unknown): TronTokenDto | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const descriptorValue = value["descriptor"];
  const signaturesValue = isRecord(descriptorValue)
    ? descriptorValue["signatures"]
    : undefined;

  return {
    id: asString(value["id"]),
    standard: asString(value["standard"]),
    live_signature: asString(value["live_signature"]),
    descriptor: isRecord(signaturesValue)
      ? {
          signatures: {
            prod: asString(signaturesValue["prod"]),
            test: asString(signaturesValue["test"]),
          },
        }
      : undefined,
  };
}

function getSignaturePayload(token: TronTokenDto): string | undefined {
  return (
    token.live_signature ??
    token.descriptor?.signatures?.prod ??
    token.descriptor?.signatures?.test
  );
}

function getTrc10TokenIds(transaction: TransactionSubset): string[] {
  return [
    ...new Set(
      transaction.contracts
        .filter(
          (contract) =>
            contract.type === TronContractType.TransferAssetContract,
        )
        .map((contract) => contract.assetName)
        .filter((assetName): assetName is string => assetName !== undefined),
    ),
  ];
}

/**
 * Default CAL-backed Tron context module.
 *
 * At this stage it auto-loads TRC10 token-name descriptors for
 * TransferAssetContract. TRC20/GCS contexts can still be supplied by a custom
 * context module or explicit TransactionOptions.contexts.
 */
export class DefaultTronContextModule implements TronContextModule {
  private readonly calBaseUrl: string;
  private readonly fetchImpl: TronContextModuleFetch;
  private readonly transactionMapper: TronTransactionMapperService;
  private readonly originToken?: string;

  constructor(args: DefaultTronContextModuleArgs = {}) {
    this.calBaseUrl = args.calBaseUrl ?? DEFAULT_CAL_BASE_URL;
    this.fetchImpl =
      args.fetchImpl ??
      ((input, init) => globalThis.fetch(input, init) as Promise<JsonResponse>);
    this.transactionMapper =
      args.transactionMapper ?? new DefaultTronTransactionMapperService();
    this.originToken = args.originToken;
  }

  async getContexts({
    rawData,
  }: TronContextModuleInput): Promise<TronTrc10TokenContext[]> {
    const transaction = this.transactionMapper.map(rawData);
    const tokenIds = getTrc10TokenIds(transaction);

    const contexts = await Promise.all(
      tokenIds.map(async (tokenId, tokenIndex) => {
        const payload = await this.getTrc10TokenPayload(tokenId);
        if (payload === undefined) {
          return undefined;
        }
        const context: TronTrc10TokenContext = {
          type: TronClearSignContextType.TRC10_TOKEN,
          payload,
          tokenIndex,
        };
        return context;
      }),
    );

    return contexts.filter(
      (context): context is TronTrc10TokenContext => context !== undefined,
    );
  }

  private async getTrc10TokenPayload(
    tokenId: string,
  ): Promise<string | undefined> {
    const query = [
      ["network", "tron"],
      ["standard", "trc10"],
      ["id", `tron/trc10/${tokenId}`],
      ["output", "id,standard,descriptor,live_signature"],
    ] satisfies Array<readonly [string, string]>;
    const queryString = query
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    const url = `${this.calBaseUrl}/tokens?${queryString}`;

    const headers =
      this.originToken === undefined
        ? undefined
        : { "Origin-Token": this.originToken };

    try {
      const response = await this.fetchImpl(url, { headers });
      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        return undefined;
      }

      const token = data
        .map(parseTokenDto)
        .find(
          (candidate): candidate is TronTokenDto =>
            candidate !== undefined &&
            candidate.id === `tron/trc10/${tokenId}` &&
            candidate.standard === "trc10",
        );

      return token === undefined ? undefined : getSignaturePayload(token);
    } catch {
      return undefined;
    }
  }
}
