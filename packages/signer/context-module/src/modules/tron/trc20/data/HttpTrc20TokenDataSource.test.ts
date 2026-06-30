import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpTrc20TokenDataSource } from "./HttpTrc20TokenDataSource";

const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DESCRIPTOR_DATA =
  "55534454" +
  "5452374e48716a654b5178475443693871385a5934704c386f74537a676a4c6a3674" +
  "00000006" +
  "00000001";

describe("HttpTrc20TokenDataSource", () => {
  it("fetches and maps a TRC20 signed token descriptor", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([
        {
          contract_address: USDT_CONTRACT_ADDRESS,
          standard: "trc20",
          descriptor: {
            data: USDT_DESCRIPTOR_DATA,
            signatures: { prod: "3044" },
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
    const dataSource = new HttpTrc20TokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getTokenPayload({
      contractAddress: USDT_CONTRACT_ADDRESS,
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/tokens",
      {
        params: {
          network: "tron",
          standard: "trc20",
          contract_address: USDT_CONTRACT_ADDRESS,
          output:
            "ticker,contract_address,decimals,standard,descriptor,live_signature",
          ref: "branch:main",
        },
      },
    );
    expect(result.extract()).toBe(`04${USDT_DESCRIPTOR_DATA}3044`);
  });

  it("uses live_signature when descriptor signatures are absent", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([
        {
          contract_address: USDT_CONTRACT_ADDRESS,
          standard: "trc20",
          descriptor: {
            data: USDT_DESCRIPTOR_DATA,
          },
          live_signature: "3045",
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
    const dataSource = new HttpTrc20TokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getTokenPayload({
      contractAddress: USDT_CONTRACT_ADDRESS,
    });

    expect(result.extract()).toBe(`04${USDT_DESCRIPTOR_DATA}3045`);
  });

  it("returns an error when CAL has no signed descriptor", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([
        {
          contract_address: USDT_CONTRACT_ADDRESS,
          standard: "trc20",
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
    const dataSource = new HttpTrc20TokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getTokenPayload({
      contractAddress: USDT_CONTRACT_ADDRESS,
    });

    expect(result.isLeft()).toBe(true);
  });
});
