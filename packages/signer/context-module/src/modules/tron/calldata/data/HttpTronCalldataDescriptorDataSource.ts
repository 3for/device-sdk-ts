import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleCalMode,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type TronClearSignContextSuccess } from "@/modules/tron/model/TronClearSignContext";
import { normalizeHex } from "@/modules/tron/shared/TronHexStringUtils";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { INFO_SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

import {
  type GetTronCalldataDescriptorsParams,
  type TronCalldataDescriptorDataSource,
} from "./TronCalldataDescriptorDataSource";
import {
  type TronCalldataDescriptorV1,
  type TronCalldataDto,
  type TronCalldataSignatures,
  type TronCalldataTransactionDescriptor,
} from "./TronCalldataDto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getDescriptorMapForAddress(
  descriptors: Record<string, unknown>,
  address: string,
): Record<string, unknown> | undefined {
  const [, value] =
    Object.entries(descriptors).find(
      ([key]) => key.toLowerCase() === address.toLowerCase(),
    ) ?? [];
  return isRecord(value) ? value : undefined;
}

function getDescriptorForSelector(
  selectorMap: Record<string, unknown>,
  selector: string,
): unknown {
  const normalizedSelector = normalizeHex(selector).toLowerCase();
  const [, value] =
    Object.entries(selectorMap).find(
      ([key]) => normalizeHex(key).toLowerCase() === normalizedSelector,
    ) ?? [];
  return value;
}

function getSignature(
  signatures: TronCalldataSignatures,
  mode: ContextModuleCalMode,
): string | undefined {
  return signatures[mode] ?? signatures.prod ?? signatures.test;
}

@injectable()
export class HttpTronCalldataDescriptorDataSource
  implements TronCalldataDescriptorDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  async getCalldataDescriptors({
    contractAddress,
    selector,
    deviceModelId,
  }: GetTronCalldataDescriptorsParams): Promise<
    Either<Error, TronClearSignContextSuccess[]>
  > {
    let dto: unknown;
    try {
      dto = await this.http.get(`${this.config.cal.url}/dapps`, {
        params: {
          network: "tron",
          contract_address: contractAddress,
          contracts: contractAddress,
          output: "descriptors_calldata",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpTronCalldataDescriptorDataSource: Failed to fetch calldata descriptors: ${error}`,
        ),
      );
    }

    if (!Array.isArray(dto)) {
      return Left(
        new Error(
          "[ContextModule] HttpTronCalldataDescriptorDataSource: Response is not an array",
        ),
      );
    }

    for (const item of dto as TronCalldataDto[]) {
      if (!isRecord(item) || !isRecord(item["descriptors_calldata"])) {
        continue;
      }

      const selectorMap = getDescriptorMapForAddress(
        item["descriptors_calldata"],
        contractAddress,
      );
      if (selectorMap === undefined) {
        continue;
      }

      const descriptor = getDescriptorForSelector(selectorMap, selector);
      if (this.isCalldataDescriptorV1(descriptor)) {
        const certificate =
          deviceModelId === undefined
            ? undefined
            : await this.certificateLoader.loadCertificate({
                targetDevice: deviceModelId,
                keyUsage: KeyUsage.Calldata,
                keyId: KeyId.CalCalldataKey,
              });
        return Right(this.mapDescriptorToContexts(descriptor, certificate));
      }
    }

    return Left(
      new Error(
        `[ContextModule] HttpTronCalldataDescriptorDataSource: No calldata contexts found for contract ${contractAddress} and selector ${selector}`,
      ),
    );
  }

  private mapDescriptorToContexts(
    descriptor: TronCalldataDescriptorV1,
    certificate?: PkiCertificate,
  ): TronClearSignContextSuccess[] {
    const info = this.mapTransactionInfo(descriptor, certificate);
    if (info === undefined) {
      return [];
    }

    const enums = Object.values(descriptor.enums).flatMap((values) =>
      Object.values(values)
        .map((enumDescriptor) =>
          this.mapSignedDescriptor(
            ClearSignContextType.TRON_ENUM,
            enumDescriptor,
            certificate,
          ),
        )
        .filter(
          (context): context is TronClearSignContextSuccess =>
            context !== undefined,
        ),
    );

    const fields: TronClearSignContextSuccess[] = descriptor.fields.map(
      (field) => ({
        type: ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
        payload: normalizeHex(field.descriptor),
      }),
    );

    return [info, ...enums, ...fields];
  }

  private mapTransactionInfo(
    descriptor: TronCalldataDescriptorV1,
    certificate?: PkiCertificate,
  ): TronClearSignContextSuccess | undefined {
    return this.mapSignedDescriptor(
      ClearSignContextType.TRON_TRANSACTION_INFO,
      descriptor.transaction_info.descriptor,
      certificate,
    );
  }

  private mapSignedDescriptor(
    type:
      | ClearSignContextType.TRON_TRANSACTION_INFO
      | ClearSignContextType.TRON_ENUM,
    descriptor: TronCalldataTransactionDescriptor,
    certificate?: PkiCertificate,
  ): TronClearSignContextSuccess | undefined {
    const signature = getSignature(
      descriptor.signatures,
      this.config.cal.mode ?? "prod",
    );
    if (signature === undefined) {
      return undefined;
    }

    return {
      type,
      payload: HexStringUtils.appendSignatureToPayload(
        normalizeHex(descriptor.data),
        normalizeHex(signature),
        INFO_SIGNATURE_TAG,
      ),
      ...(certificate !== undefined && { certificate }),
    } as ClearSignContextSuccess<typeof type> as TronClearSignContextSuccess;
  }

  private isCalldataDescriptorV1(
    data: unknown,
  ): data is TronCalldataDescriptorV1 {
    if (
      !isRecord(data) ||
      data["type"] !== "calldata" ||
      data["version"] !== "v1" ||
      !this.isTransactionInfoV1(data["transaction_info"]) ||
      !this.isEnumV1(data["enums"]) ||
      !Array.isArray(data["fields"]) ||
      !data["fields"].every((field) => this.isFieldV1(field))
    ) {
      return false;
    }

    return true;
  }

  private isTransactionInfoV1(data: unknown): boolean {
    return (
      isRecord(data) &&
      isRecord(data["descriptor"]) &&
      this.isTransactionDescriptor(data["descriptor"])
    );
  }

  private isEnumV1(data: unknown): boolean {
    return (
      isRecord(data) &&
      Object.values(data).every(
        (values) =>
          isRecord(values) &&
          Object.values(values).every((descriptor) =>
            this.isTransactionDescriptor(descriptor),
          ),
      )
    );
  }

  private isFieldV1(data: unknown): boolean {
    return isRecord(data) && typeof data["descriptor"] === "string";
  }

  private isTransactionDescriptor(
    data: unknown,
  ): data is TronCalldataTransactionDescriptor {
    return (
      isRecord(data) &&
      typeof data["data"] === "string" &&
      this.isCalldataSignatures(data["signatures"])
    );
  }

  private isCalldataSignatures(data: unknown): data is TronCalldataSignatures {
    return (
      isRecord(data) &&
      (asString(data[this.config.cal.mode ?? "prod"]) !== undefined ||
        asString(data["prod"]) !== undefined ||
        asString(data["test"]) !== undefined)
    );
  }
}
