import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256 } from "@noble/hashes/sha256";

import {
  type Args,
  attachSignature,
  normalizeTransactionResponse,
  prepareTransaction,
  resolveParamsFile,
  type TronTransaction,
  validateBuilderEndpoint,
} from "./nile-device-transfer";

function makeRawFileArgs(transactionFile: string): Args {
  return {
    type: "raw",
    transactionFile,
    clearSigningMode: "auto",
    decimals: 6,
    feeLimit: 100_000_000,
    path: "44'/195'/0'/0/0",
    apiUrl: "https://nile.trongrid.io",
    broadcast: true,
  };
}

function makeTransaction(
  overrides: Partial<TronTransaction> = {},
): TronTransaction {
  const rawDataHex = "0a00";
  return {
    txID: Buffer.from(sha256(Buffer.from(rawDataHex, "hex"))).toString("hex"),
    raw_data_hex: rawDataHex,
    raw_data: { contract: [] },
    ...overrides,
  };
}

describe("Nile raw transaction files", () => {
  it("preserves visible=false after loading and attaching a signature", async () => {
    const directory = await mkdtemp(join(tmpdir(), "signer-tron-nile-"));
    const transactionFile = join(directory, "transaction.json");
    const transaction = {
      ...makeTransaction(),
      visible: false as const,
    };

    try {
      await writeFile(transactionFile, JSON.stringify(transaction), "utf8");

      const prepared = await prepareTransaction(
        makeRawFileArgs(transactionFile),
        "unused-owner-address",
      );
      expect(prepared.transaction?.visible).toBe(false);

      attachSignature(prepared, "ab".repeat(65));

      expect(prepared.transaction).toMatchObject({
        visible: false,
        signature: ["ab".repeat(65)],
      });
      expect(JSON.parse(await readFile(transactionFile, "utf8"))).toEqual(
        transaction,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a transaction file that already contains a signature", async () => {
    const directory = await mkdtemp(join(tmpdir(), "signer-tron-nile-"));
    const transactionFile = join(directory, "transaction.json");
    const transaction = makeTransaction({ signature: ["ab".repeat(65)] });

    try {
      await writeFile(transactionFile, JSON.stringify(transaction), "utf8");

      await expect(
        prepareTransaction(
          makeRawFileArgs(transactionFile),
          "unused-owner-address",
        ),
      ).rejects.toThrow("Transaction already contains a signature");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("Nile build params files", () => {
  it.each([
    "freeze-v2.json",
    "unfreeze-v2.json",
    "cancel-all-unfreeze-v2.json",
  ])("resolves the bundled sample from a bare filename: %s", async (name) => {
    const resolved = await resolveParamsFile(name);

    expect(resolved.endsWith(join("samples", name))).toBe(true);
    await expect(readFile(resolved, "utf8")).resolves.toContain(
      '"$OWNER_ADDRESS_BASE58"',
    );
  });

  it("keeps an existing explicit params path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "signer-tron-params-"));
    const paramsFile = join(directory, "freeze-v2.json");

    try {
      await writeFile(paramsFile, "{}", "utf8");
      await expect(resolveParamsFile(paramsFile)).resolves.toBe(paramsFile);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("Nile build transaction responses", () => {
  it.each([
    ["response root", (transaction: TronTransaction) => transaction],
    ["transaction field", (transaction: TronTransaction) => ({ transaction })],
  ])("accepts a transaction at the %s", (_description, wrapResponse) => {
    const transaction = makeTransaction();

    expect(normalizeTransactionResponse(wrapResponse(transaction))).toBe(
      transaction,
    );
  });
});

describe("Nile build endpoint restrictions", () => {
  it("accepts a relative wallet transaction-builder endpoint", () => {
    expect(() =>
      validateBuilderEndpoint("/wallet/freezebalancev2"),
    ).not.toThrow();
  });

  it.each([
    "https://nile.trongrid.io/wallet/freezebalancev2",
    "/walletsolidity/freezebalancev2",
    "/wallet/freezebalancev2?visible=true",
    "/wallet/freezebalancev2#fragment",
    "/wallet/../wallet/freezebalancev2",
  ])("rejects a non-relative or unsafe endpoint: %s", (endpoint) => {
    expect(() => validateBuilderEndpoint(endpoint)).toThrow(
      "--endpoint must be a relative /wallet/* path",
    );
  });

  it.each([
    "/wallet/broadcasttransaction",
    "/wallet/broadcasthex",
    "/wallet/gettransactionsign",
    "/wallet/gettransactionsign2/",
    "/wallet/BROADCASTTRANSACTION/",
  ])("rejects a broadcast or node-signing endpoint: %s", (endpoint) => {
    expect(() => validateBuilderEndpoint(endpoint)).toThrow(
      "--endpoint must be a transaction builder endpoint",
    );
  });
});
