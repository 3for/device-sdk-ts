import { Right } from "purify-ts";

import {
  TronContractType,
  type TronTransactionContext,
} from "@/modules/tron/model/TronTransactionContext";
import { type Trc10TokenDataSource } from "@/modules/tron/trc10/data/Trc10TokenDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { Trc10TokenContextLoader } from "./Trc10TokenContextLoader";

describe("Trc10TokenContextLoader", () => {
  it("loads contexts for TransferAssetContract assets", async () => {
    const dataSource: Trc10TokenDataSource = {
      getTokenPayload: vi.fn().mockResolvedValue(Right("0102")),
    };
    const loader = new Trc10TokenContextLoader(dataSource);
    const input: TronTransactionContext = {
      contracts: [
        {
          type: TronContractType.TransferAssetContract,
          typeName: "TransferAssetContract",
          assetName: "1000259",
          raw: new Uint8Array(),
        },
      ],
    };

    const result = await loader.load(input);

    expect(result).toStrictEqual([
      {
        type: ClearSignContextType.TRON_TRC10_TOKEN,
        payload: "0102",
        tokenIndex: 0,
      },
    ]);
    expect(dataSource.getTokenPayload).toHaveBeenCalledWith({
      tokenId: "1000259",
    });
  });

  it("ignores transactions without TRC10 asset transfers", () => {
    const dataSource: Trc10TokenDataSource = {
      getTokenPayload: vi.fn().mockResolvedValue(Right("0102")),
    };
    const loader = new Trc10TokenContextLoader(dataSource);

    expect(
      loader.canHandle(
        {
          contracts: [
            {
              type: TronContractType.TransferContract,
              typeName: "TransferContract",
              raw: new Uint8Array(),
            },
          ],
        },
        Object.values(ClearSignContextType),
      ),
    ).toBe(false);
    expect(dataSource.getTokenPayload).not.toHaveBeenCalled();
  });
});
