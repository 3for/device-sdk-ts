import { Right } from "purify-ts";

import {
  TronContractType,
  type TronTransactionContext,
} from "@/modules/tron/model/TronTransactionContext";
import { type Trc20TokenDataSource } from "@/modules/tron/trc20/data/Trc20TokenDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { Trc20TokenContextLoader } from "./Trc20TokenContextLoader";

const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

describe("Trc20TokenContextLoader", () => {
  it("loads contexts for TriggerSmartContract TRC20 transfers", async () => {
    const dataSource: Trc20TokenDataSource = {
      getTokenPayload: vi.fn().mockResolvedValue(Right("0102")),
    };
    const loader = new Trc20TokenContextLoader(dataSource);
    const input: TronTransactionContext = {
      contracts: [
        {
          type: TronContractType.TriggerSmartContract,
          typeName: "TriggerSmartContract",
          contractAddress: USDT_CONTRACT_ADDRESS,
          data: "a9059cbb00000000",
          raw: new Uint8Array(),
        },
      ],
    };

    const result = await loader.load(input);

    expect(result).toStrictEqual([
      {
        type: ClearSignContextType.TRON_TRC20_TOKEN,
        payload: "0102",
      },
    ]);
    expect(dataSource.getTokenPayload).toHaveBeenCalledWith({
      contractAddress: USDT_CONTRACT_ADDRESS,
    });
  });

  it("loads contexts for TriggerSmartContract TRC20 approvals", () => {
    const dataSource: Trc20TokenDataSource = {
      getTokenPayload: vi.fn().mockResolvedValue(Right("0102")),
    };
    const loader = new Trc20TokenContextLoader(dataSource);

    expect(
      loader.canHandle(
        {
          contracts: [
            {
              type: TronContractType.TriggerSmartContract,
              typeName: "TriggerSmartContract",
              contractAddress: USDT_CONTRACT_ADDRESS,
              data: "095ea7b300000000",
              raw: new Uint8Array(),
            },
          ],
        },
        Object.values(ClearSignContextType),
      ),
    ).toBe(true);
  });

  it("ignores non TRC20 TriggerSmartContract selectors", () => {
    const dataSource: Trc20TokenDataSource = {
      getTokenPayload: vi.fn().mockResolvedValue(Right("0102")),
    };
    const loader = new Trc20TokenContextLoader(dataSource);

    expect(
      loader.canHandle(
        {
          contracts: [
            {
              type: TronContractType.TriggerSmartContract,
              typeName: "TriggerSmartContract",
              contractAddress: USDT_CONTRACT_ADDRESS,
              data: "70a0823100000000",
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
