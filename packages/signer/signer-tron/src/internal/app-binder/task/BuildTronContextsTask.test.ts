import {
  type TronClearSignContext,
  TronClearSignContextType,
} from "@api/model/TronClearSignContext";

import { BuildTronContextsTask } from "./BuildTronContextsTask";

const CONTEXTS: TronClearSignContext[] = [
  {
    type: TronClearSignContextType.TRANSACTION_INFO,
    payload: "0102",
  },
];

describe("BuildTronContextsTask", () => {
  it("returns manually provided contexts before calling the context module", async () => {
    const contextModule = {
      getContexts: vi.fn(),
    };

    const result = await new BuildTronContextsTask({
      contextModule,
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "auto",
        contexts: CONTEXTS,
      },
    }).run();

    expect(result).toBe(CONTEXTS);
    expect(contextModule.getContexts).not.toHaveBeenCalled();
  });

  it("returns no contexts in blind mode", async () => {
    const contextModule = {
      getContexts: vi.fn().mockResolvedValue(CONTEXTS),
    };

    const result = await new BuildTronContextsTask({
      contextModule,
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "blind",
      },
    }).run();

    expect(result).toEqual([]);
    expect(contextModule.getContexts).not.toHaveBeenCalled();
  });

  it("returns contexts from the context module", async () => {
    const rawData = Uint8Array.from([0x01]);
    const contextModule = {
      getContexts: vi.fn().mockResolvedValue(CONTEXTS),
    };

    const result = await new BuildTronContextsTask({
      contextModule,
      derivationPath: "44'/195'/0'/0/0",
      rawData,
      options: {
        clearSigningMode: "auto",
      },
    }).run();

    expect(result).toEqual(CONTEXTS);
    expect(contextModule.getContexts).toHaveBeenCalledWith({
      derivationPath: "44'/195'/0'/0/0",
      rawData,
    });
  });

  it("falls back to no contexts when the context module fails", async () => {
    const contextModule = {
      getContexts: vi.fn().mockRejectedValue(new Error("CAL unavailable")),
    };

    const result = await new BuildTronContextsTask({
      contextModule,
      derivationPath: "44'/195'/0'/0/0",
      rawData: Uint8Array.from([0x01]),
      options: {
        clearSigningMode: "auto",
      },
    }).run();

    expect(result).toEqual([]);
  });
});
