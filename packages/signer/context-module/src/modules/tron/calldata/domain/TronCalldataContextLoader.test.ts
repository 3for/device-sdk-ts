import { Right } from "purify-ts";

import { type TronCalldataDescriptorDataSource } from "@/modules/tron/calldata/data/TronCalldataDescriptorDataSource";
import {
  TronContractType,
  type TronTransactionContext,
} from "@/modules/tron/model/TronTransactionContext";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { TronCalldataContextLoader } from "./TronCalldataContextLoader";

const CONTEXTS = [
  {
    type: ClearSignContextType.TRON_TRANSACTION_INFO,
    payload: "010281ff01aa",
  },
];

describe("TronCalldataContextLoader", () => {
  it("loads contexts for TriggerSmartContract calldata", async () => {
    const dataSource: TronCalldataDescriptorDataSource = {
      getCalldataDescriptors: vi.fn().mockResolvedValue(Right(CONTEXTS)),
    };
    const loader = new TronCalldataContextLoader(dataSource);
    const input: TronTransactionContext = {
      contracts: [
        {
          type: TronContractType.TriggerSmartContract,
          typeName: "TriggerSmartContract",
          contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          data: "a9059cbb00000000",
          raw: new Uint8Array(),
        },
      ],
    };

    const result = await loader.load(input);

    expect(result).toStrictEqual(CONTEXTS);
    expect(dataSource.getCalldataDescriptors).toHaveBeenCalledWith({
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      selector: "a9059cbb",
    });
  });

  it("ignores non TriggerSmartContract contracts", () => {
    const dataSource: TronCalldataDescriptorDataSource = {
      getCalldataDescriptors: vi.fn().mockResolvedValue(Right(CONTEXTS)),
    };
    const loader = new TronCalldataContextLoader(dataSource);

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
    expect(dataSource.getCalldataDescriptors).not.toHaveBeenCalled();
  });

  it("loads contexts for every supported TriggerSmartContract call", async () => {
    const dataSource: TronCalldataDescriptorDataSource = {
      getCalldataDescriptors: vi
        .fn()
        .mockResolvedValueOnce(Right(CONTEXTS))
        .mockResolvedValueOnce(
          Right([
            {
              type: ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
              payload: "0304",
            },
          ]),
        ),
    };
    const loader = new TronCalldataContextLoader(dataSource);
    const input: TronTransactionContext = {
      contracts: [
        {
          type: TronContractType.TriggerSmartContract,
          typeName: "TriggerSmartContract",
          contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          data: "a9059cbb00000000",
          raw: new Uint8Array(),
        },
        {
          type: TronContractType.TriggerSmartContract,
          typeName: "TriggerSmartContract",
          contractAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
          data: "095ea7b300000000",
          raw: new Uint8Array(),
        },
      ],
    };

    const result = await loader.load(input);

    expect(result).toStrictEqual([
      ...CONTEXTS,
      {
        type: ClearSignContextType.TRON_TRANSACTION_FIELD_DESCRIPTION,
        payload: "0304",
      },
    ]);
    expect(dataSource.getCalldataDescriptors).toHaveBeenNthCalledWith(1, {
      contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      selector: "a9059cbb",
    });
    expect(dataSource.getCalldataDescriptors).toHaveBeenNthCalledWith(2, {
      contractAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
      selector: "095ea7b3",
    });
  });
});
