import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { HttpTronCalldataDescriptorDataSource } from "./HttpTronCalldataDescriptorDataSource";

describe("HttpTronCalldataDescriptorDataSource", () => {
  it("fetches and maps Tron calldata descriptors", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([
        {
          descriptors_calldata: {
            TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: {
              a9059cbb: {
                type: "calldata",
                version: "v1",
                transaction_info: {
                  descriptor: {
                    data: "0102",
                    signatures: { prod: "bb" },
                  },
                },
                enums: {
                  "1": {
                    "2": {
                      data: "0a0b",
                      signatures: { prod: "cc" },
                    },
                  },
                },
                fields: [{ descriptor: "0x1122" }, { descriptor: "3344" }],
              },
            },
          },
        },
      ]),
    };
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleServiceConfig;
    const dataSource = new HttpTronCalldataDescriptorDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getCalldataDescriptors({
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      selector: "a9059cbb",
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/dapps",
      {
        params: {
          network: "tron",
          contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          contracts: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          output: "descriptors_calldata",
          ref: "branch:main",
        },
      },
    );
    expect(result.extract()).toStrictEqual([
      {
        type: ClearSignContextType.TRON_TRANSACTION_INFO,
        payload: "010281ff01bb",
      },
      {
        type: ClearSignContextType.TRON_ENUM,
        payload: "0a0b81ff01cc",
      },
      {
        type: ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
        payload: "1122",
      },
      {
        type: ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
        payload: "3344",
      },
    ]);
  });

  it("returns an error when selector is not found", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([{ descriptors_calldata: {} }]),
    };
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleServiceConfig;
    const dataSource = new HttpTronCalldataDescriptorDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getCalldataDescriptors({
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      selector: "a9059cbb",
    });

    expect(result.isLeft()).toBe(true);
  });
});
