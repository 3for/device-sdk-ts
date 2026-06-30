import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";

import {
  type TronClearSignContext,
  TronClearSignContextType,
} from "@api/model/TronClearSignContext";
import { type TransactionSubset } from "@internal/transaction/model/TransactionSubset";
import { type TronTransactionMapperService } from "@internal/transaction/service/TronTransactionMapperService";

import { BuildTronContextsTask } from "./BuildTronContextsTask";

const CONTEXTS: TronClearSignContext[] = [
  {
    type: TronClearSignContextType.TRANSACTION_INFO,
    payload: "0102",
  },
];

const TRANSACTION: TransactionSubset = {
  contracts: [
    {
      type: 2,
      typeName: "TransferAssetContract",
      assetName: "1000259",
      raw: new Uint8Array(),
    },
  ],
};

function makeContextModule(
  getContexts: ContextModule["getContexts"] = vi.fn(),
): ContextModule {
  return {
    getContexts,
    getFieldContext: vi.fn(),
    getTypedDataFilters: vi.fn(),
    report: vi.fn(),
  };
}

function makeTransactionMapper(
  map: TronTransactionMapperService["map"] = vi
    .fn()
    .mockReturnValue(TRANSACTION),
): TronTransactionMapperService {
  return { map };
}

describe("BuildTronContextsTask", () => {
  it("returns manually provided contexts before calling the context module", async () => {
    const contextModule = makeContextModule();
    const transactionMapper = makeTransactionMapper();

    const result = await new BuildTronContextsTask({
      contextModule,
      transactionMapper,
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "auto",
        contexts: CONTEXTS,
      },
    }).run();

    expect(result).toBe(CONTEXTS);
    expect(contextModule.getContexts).not.toHaveBeenCalled();
    expect(transactionMapper.map).not.toHaveBeenCalled();
  });

  it("returns no contexts in blind mode", async () => {
    const contextModule = makeContextModule(
      vi.fn().mockResolvedValue(CONTEXTS),
    );
    const transactionMapper = makeTransactionMapper();

    const result = await new BuildTronContextsTask({
      contextModule,
      transactionMapper,
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "blind",
      },
    }).run();

    expect(result).toEqual([]);
    expect(contextModule.getContexts).not.toHaveBeenCalled();
    expect(transactionMapper.map).not.toHaveBeenCalled();
  });

  it("adapts Tron contexts from the context module", async () => {
    const rawData = Uint8Array.from([0x01]);
    const contextModule = makeContextModule(
      vi.fn().mockResolvedValue([
        {
          type: ClearSignContextType.TRON_TRANSACTION_INFO,
          payload: "0102",
        },
        {
          type: ClearSignContextType.TRON_TRC10_TOKEN,
          payload: "0304",
          tokenIndex: 1,
        },
        {
          type: ClearSignContextType.ETHEREUM_TOKEN,
          payload: "ignored",
        },
      ]),
    );
    const transactionMapper = makeTransactionMapper();

    const result = await new BuildTronContextsTask({
      contextModule,
      transactionMapper,
      rawData,
      options: {
        clearSigningMode: "auto",
      },
    }).run();

    expect(result).toEqual([
      {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: "0102",
      },
      {
        type: TronClearSignContextType.TRC10_TOKEN,
        payload: "0304",
        tokenIndex: 1,
      },
    ]);
    expect(transactionMapper.map).toHaveBeenCalledWith(rawData);
    expect(contextModule.getContexts).toHaveBeenCalledWith(TRANSACTION);
  });

  it("falls back to no contexts when the context module fails", async () => {
    const contextModule = makeContextModule(
      vi.fn().mockRejectedValue(new Error("CAL unavailable")),
    );

    const result = await new BuildTronContextsTask({
      contextModule,
      transactionMapper: makeTransactionMapper(),
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "auto",
      },
    }).run();

    expect(result).toEqual([]);
  });
});
