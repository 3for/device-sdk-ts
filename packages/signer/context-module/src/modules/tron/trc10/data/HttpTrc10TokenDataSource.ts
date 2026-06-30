import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  type GetTrc10TokenPayloadParams,
  type Trc10TokenDataSource,
} from "./Trc10TokenDataSource";

type Trc10TokenDto = {
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

function parseTokenDto(value: unknown): Trc10TokenDto | undefined {
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

function getSignaturePayload(token: Trc10TokenDto): string | undefined {
  return (
    token.live_signature ??
    token.descriptor?.signatures?.prod ??
    token.descriptor?.signatures?.test
  );
}

@injectable()
export class HttpTrc10TokenDataSource implements Trc10TokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  async getTokenPayload({
    tokenId,
  }: GetTrc10TokenPayloadParams): Promise<Either<Error, string>> {
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          network: "tron",
          standard: "trc10",
          id: `tron/trc10/${tokenId}`,
          output: "id,standard,descriptor,live_signature",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc10TokenDataSource: Failed to fetch token ${tokenId}: ${error}`,
        ),
      );
    }

    if (!Array.isArray(data)) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc10TokenDataSource: Response is not an array for token ${tokenId}`,
        ),
      );
    }

    const token = data
      .map(parseTokenDto)
      .find(
        (candidate): candidate is Trc10TokenDto =>
          candidate !== undefined &&
          candidate.id === `tron/trc10/${tokenId}` &&
          candidate.standard === "trc10",
      );

    const payload =
      token === undefined ? undefined : getSignaturePayload(token);
    if (payload === undefined) {
      return Left(
        new Error(
          `[ContextModule] HttpTrc10TokenDataSource: No signed descriptor for token ${tokenId}`,
        ),
      );
    }

    return Right(payload);
  }
}
