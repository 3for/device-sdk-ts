import {
  TronClearSignContextType,
  type TronTrc10TokenContext,
} from "@api/model/TronClearSignContext";

import {
  DefaultTronContextModule,
  type TronContextModuleFetch,
} from "./DefaultTronContextModule";

const TRC10_USDT_PAYLOAD =
  "0a045553445410001a46304402205170f03cc9c5987f873c74df9e3dd79ce3639071eb227377172d7b4960c82b0a022002e76314c9aa88d654e8918f9e5dafa53672d1f1370be04dcf90164879398eee";

const TRANSFER_ASSET_RAW_DATA = Uint8Array.from(
  Buffer.from(
    "0a023dce220895da42177db0050740d8e0a5feed2d5a75080212710a32747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e736665724173736574436f6e7472616374123b0a0731303030323539121541c8599111f29c1e1e061265b4af93ea1f274ad78a1a1541c8599111f29c1e1e061265b4af93ea1f274ad78a20c0843d709d94a2feed2d",
    "hex",
  ),
);

describe("DefaultTronContextModule", () => {
  it("loads TRC10 token-name context from CAL for TransferAssetContract", async () => {
    const fetchImpl = vi.fn<TronContextModuleFetch>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "tron/trc10/1000259",
            standard: "trc10",
            live_signature: TRC10_USDT_PAYLOAD,
          },
        ]),
    });
    const contextModule = new DefaultTronContextModule({
      fetchImpl,
      originToken: "origin-token",
    });

    const result = await contextModule.getContexts({
      derivationPath: "44'/195'/0'/0/0",
      rawData: TRANSFER_ASSET_RAW_DATA,
    });

    expect(result).toStrictEqual<TronTrc10TokenContext[]>([
      {
        type: TronClearSignContextType.TRC10_TOKEN,
        payload: TRC10_USDT_PAYLOAD,
        tokenIndex: 0,
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe("/v1/tokens");
    expect(parsedUrl.searchParams.get("network")).toBe("tron");
    expect(parsedUrl.searchParams.get("standard")).toBe("trc10");
    expect(parsedUrl.searchParams.get("id")).toBe("tron/trc10/1000259");
    expect(init?.headers).toStrictEqual({ "Origin-Token": "origin-token" });
  });

  it("returns no context when no TRC10 token is present", async () => {
    const fetchImpl = vi.fn<TronContextModuleFetch>();
    const contextModule = new DefaultTronContextModule({ fetchImpl });

    const result = await contextModule.getContexts({
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x01]),
    });

    expect(result).toStrictEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to no context when CAL does not return a matching descriptor", async () => {
    const fetchImpl = vi.fn<TronContextModuleFetch>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const contextModule = new DefaultTronContextModule({ fetchImpl });

    const result = await contextModule.getContexts({
      derivationPath: "44'/195'/0'/0/0",
      rawData: TRANSFER_ASSET_RAW_DATA,
    });

    expect(result).toStrictEqual([]);
  });
});
