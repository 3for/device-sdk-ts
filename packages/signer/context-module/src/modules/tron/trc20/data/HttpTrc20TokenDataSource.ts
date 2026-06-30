import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  type GetTrc20TokenPayloadParams,
  type Trc20TokenDataSource,
} from "./Trc20TokenDataSource";
import { type Trc20TokenDto } from "./Trc20TokenDto";

const TRC20_CONTRACT_ADDRESS_LENGTH = 34;
const UINT32_LENGTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTokenDto(value: unknown): Trc20TokenDto | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const descriptorValue = value["descriptor"];
  const signaturesValue = isRecord(descriptorValue)
    ? descriptorValue["signatures"]
    : undefined;

  return {
    contract_address: asString(value["contract_address"]),
    standard: asString(value["standard"]),
    live_signature: asString(value["live_signature"]),
    descriptor: isRecord(descriptorValue)
      ? {
          data: asString(descriptorValue["data"]),
          signatures: isRecord(signaturesValue)
            ? {
                prod: asString(signaturesValue["prod"]),
                test: asString(signaturesValue["test"]),
              }
            : undefined,
        }
      : undefined,
  };
}

function getSignature(
  token: Trc20TokenDto,
  mode: ContextModuleServiceConfig["cal"]["mode"],
): string | undefined {
  return (
    token.descriptor?.signatures?.[mode] ??
    token.live_signature ??
    token.descriptor?.signatures?.prod ??
    token.descriptor?.signatures?.test
  );
}

function getTickerLength(data: string): string | undefined {
  const dataLength = data.length / 2;
  const tickerLength =
    dataLength - TRC20_CONTRACT_ADDRESS_LENGTH - UINT32_LENGTH - UINT32_LENGTH;

  if (
    !Number.isInteger(tickerLength) ||
    tickerLength < 0 ||
    tickerLength > 255
  ) {
    return undefined;
  }

  return tickerLength.toString(16).padStart(2, "0");
}

@injectable()
export class HttpTrc20TokenDataSource implements Trc20TokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  async getTokenPayload({
    contractAddress,
  }: GetTrc20TokenPayloadParams): Promise<Either<Error, string>> {
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          network: "tron",
          standard: "trc20",
          contract_address: contractAddress,
          output:
            "ticker,contract_address,decimals,standard,descriptor,live_signature",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc20TokenDataSource: Failed to fetch token ${contractAddress}: ${error}`,
        ),
      );
    }

    if (!Array.isArray(data)) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc20TokenDataSource: Response is not an array for token ${contractAddress}`,
        ),
      );
    }

    const token = data
      .map(parseTokenDto)
      .find(
        (candidate): candidate is Trc20TokenDto =>
          candidate !== undefined &&
          candidate.contract_address === contractAddress &&
          candidate.standard === "trc20",
      );

    const descriptorData = token?.descriptor?.data;
    const signature =
      token === undefined
        ? undefined
        : getSignature(token, this.config.cal.mode);
    if (descriptorData === undefined || signature === undefined) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc20TokenDataSource: No signed descriptor for token ${contractAddress}`,
        ),
      );
    }

    const tickerLength = getTickerLength(descriptorData);
    if (tickerLength === undefined) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc20TokenDataSource: Invalid descriptor data for token ${contractAddress}`,
        ),
      );
    }

    return Right([tickerLength, descriptorData, signature].join(""));
  }
}
