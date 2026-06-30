import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpTrc10TokenDataSource } from "./HttpTrc10TokenDataSource";

const TRC10_USDT_PAYLOAD =
  "0a045553445410001a46304402205170f03cc9c5987f873c74df9e3dd79ce3639071eb227377172d7b4960c82b0a022002e76314c9aa88d654e8918f9e5dafa53672d1f1370be04dcf90164879398eee";

describe("HttpTrc10TokenDataSource", () => {
  it("fetches a TRC10 signed token descriptor", async () => {
    const httpMock = {
      get: vi.fn().mockResolvedValue([
        {
          id: "tron/trc10/1000259",
          standard: "trc10",
          live_signature: TRC10_USDT_PAYLOAD,
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
    const dataSource = new HttpTrc10TokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getTokenPayload({ tokenId: "1000259" });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/tokens",
      {
        params: {
          network: "tron",
          standard: "trc10",
          id: "tron/trc10/1000259",
          output: "id,standard,descriptor,live_signature",
          ref: "branch:main",
        },
      },
    );
    expect(result.extract()).toBe(TRC10_USDT_PAYLOAD);
  });

  it("returns an error when CAL has no matching descriptor", async () => {
    const httpMock = { get: vi.fn().mockResolvedValue([]) };
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleServiceConfig;
    const dataSource = new HttpTrc10TokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );

    const result = await dataSource.getTokenPayload({ tokenId: "1000259" });

    expect(result.isLeft()).toBe(true);
  });
});
