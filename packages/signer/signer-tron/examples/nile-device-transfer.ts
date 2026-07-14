import "reflect-metadata";

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import {
  type Signature,
  SignerTronBuilder,
} from "@ledgerhq/device-signer-kit-tron";
import {
  nodeHidIdentifier,
  nodeHidTransportFactory,
} from "@ledgerhq/device-transport-kit-node-hid";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";
import { filter, firstValueFrom, timeout } from "rxjs";

const NILE_URL = "https://nile.trongrid.io";
const DEFAULT_PATH = "44'/195'/0'/0/0";
const DEFAULT_TIMEOUT_MS = 120_000;
const CLEANUP_TIMEOUT_MS = 2_000;

type TransactionKind = "trx" | "trc20";

type Args = {
  type: TransactionKind;
  to: string;
  amount: string;
  contract?: string;
  decimals: number;
  feeLimit: number;
  path: string;
  apiUrl: string;
  apiKey?: string;
  originToken?: string;
  broadcast: boolean;
};

type TronTransaction = {
  txID: string;
  raw_data_hex: string;
  raw_data: unknown;
  signature?: string[];
  visible?: boolean;
};

type TriggerResponse = {
  result?: { result?: boolean; message?: string };
  transaction?: TronTransaction;
};

function usage(): never {
  console.log(`Usage:
  pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --type trx --to <Nile address> --amount 1 --broadcast
  pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --type trc20 --to <Nile address> --amount 1.5 \\
    --contract <Nile TRC20 contract> --decimals 6 --broadcast

Options:
  --type trx|trc20       Transaction type (default: trx)
  --to <address>         Recipient Nile Base58Check address (required)
  --amount <decimal>     Human-readable amount, for example 0.1 (required)
  --contract <address>   TRC20 contract address (required for trc20)
  --decimals <number>    TRC20 decimals (default: 6)
  --fee-limit <sun>      TRC20 fee limit (default: 100000000)
  --path <path>          Derivation path (default: ${DEFAULT_PATH})
  --api-url <url>        Tron HTTP API (default: ${NILE_URL})
  --api-key <key>        TronGrid API key (or TRON_PRO_API_KEY env)
  --origin-token <token> CAL origin token (or LEDGER_ORIGIN_TOKEN env)
  --broadcast            Broadcast after device signing; omitted means dry-run
  --help                 Show this message
`);
  process.exit(0);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  let broadcast = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--") continue;
    if (token === "--help" || token === "-h") usage();
    if (token === "--broadcast") {
      broadcast = true;
      continue;
    }
    if (!token.startsWith("--")) throw new Error(`Unknown argument: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    values.set(token.slice(2), value);
    index += 1;
  }

  const type = (values.get("type") ?? "trx") as TransactionKind;
  if (type !== "trx" && type !== "trc20") {
    throw new Error("--type must be trx or trc20");
  }
  const to = values.get("to");
  const amount = values.get("amount");
  if (!to || !amount) throw new Error("--to and --amount are required");
  validateAddress(to, "recipient");

  const contract = values.get("contract");
  if (type === "trc20" && !contract) {
    throw new Error("--contract is required for a trc20 transfer");
  }
  if (contract) validateAddress(contract, "contract");

  return {
    type,
    to,
    amount,
    contract,
    decimals: parseInteger(values.get("decimals") ?? "6", "decimals"),
    feeLimit: parseInteger(values.get("fee-limit") ?? "100000000", "fee-limit"),
    path: values.get("path") ?? DEFAULT_PATH,
    apiUrl: (values.get("api-url") ?? NILE_URL).replace(/\/$/, ""),
    apiKey: values.get("api-key") ?? process.env["TRON_PRO_API_KEY"],
    originToken:
      values.get("origin-token") ?? process.env["LEDGER_ORIGIN_TOKEN"],
    broadcast,
  };
}

function parseInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative safe integer`);
  }
  return parsed;
}

function decimalToUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places`);
  }
  const units = `${whole}${fraction.padEnd(decimals, "0")}`.replace(
    /^0+(?=\d)/,
    "",
  );
  const result = BigInt(units);
  if (result <= 0n) throw new Error("Amount must be greater than zero");
  return result;
}

function decodeAddress(address: string): Uint8Array {
  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(address);
  } catch {
    throw new Error(`Invalid Base58Check address: ${address}`);
  }
  if (decoded.length !== 25 || decoded[0] !== 0x41) {
    throw new Error(`Invalid Tron address payload: ${address}`);
  }
  const payload = decoded.slice(0, 21);
  const expected = sha256(sha256(payload)).slice(0, 4);
  if (!expected.every((byte, index) => byte === decoded[21 + index])) {
    throw new Error(`Invalid Tron address checksum: ${address}`);
  }
  return payload;
}

function validateAddress(address: string, label: string): void {
  try {
    decodeAddress(address);
  } catch (error) {
    throw new Error(`Invalid ${label} address`, { cause: error });
  }
}

function encodeTrc20TransferParameter(to: string, amount: bigint): string {
  // ABI address is the final 20 bytes; omit Tron's 0x41 network prefix.
  const addressHex = Buffer.from(decodeAddress(to).slice(1)).toString("hex");
  return addressHex.padStart(64, "0") + amount.toString(16).padStart(64, "0");
}

function apiErrorMessage(value: unknown): string {
  if (typeof value !== "string") return JSON.stringify(value);
  try {
    return Buffer.from(value, "base64").toString("utf8") || value;
  } catch {
    return value;
  }
}

async function nilePost<T>(
  args: Args,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${args.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(args.apiKey ? { "TRON-PRO-API-KEY": args.apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned HTTP ${response.status}: ${text}`);
  }
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text}`);
  }
  return json as T;
}

async function createTransaction(
  args: Args,
  ownerAddress: string,
): Promise<TronTransaction> {
  if (args.type === "trx") {
    const amount = decimalToUnits(args.amount, 6);
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("TRX amount exceeds the node API's safe JSON range");
    }
    const transaction = await nilePost<TronTransaction>(
      args,
      "/wallet/createtransaction",
      {
        owner_address: ownerAddress,
        to_address: args.to,
        amount: Number(amount),
        visible: true,
      },
    );
    assertTransaction(transaction);
    return transaction;
  }

  const amount = decimalToUnits(args.amount, args.decimals);
  const response = await nilePost<TriggerResponse>(
    args,
    "/wallet/triggersmartcontract",
    {
      owner_address: ownerAddress,
      contract_address: args.contract,
      function_selector: "transfer(address,uint256)",
      parameter: encodeTrc20TransferParameter(args.to, amount),
      fee_limit: args.feeLimit,
      call_value: 0,
      visible: true,
    },
  );
  if (!response.result?.result || !response.transaction) {
    throw new Error(
      `TRC20 transaction creation failed: ${apiErrorMessage(response.result?.message)}`,
    );
  }
  assertTransaction(response.transaction);
  return response.transaction;
}

function assertTransaction(
  transaction: Partial<TronTransaction>,
): asserts transaction is TronTransaction {
  if (!transaction.txID || !transaction.raw_data_hex || !transaction.raw_data) {
    throw new Error(
      `Node did not return a complete transaction: ${JSON.stringify(transaction)}`,
    );
  }
}

async function waitForDeviceAction<Output, Error, Intermediate>(
  action: ExecuteDeviceActionReturnType<Output, Error, Intermediate>,
  label: string,
): Promise<Output> {
  const state = await firstValueFrom(
    action.observable.pipe(
      filter(
        (value) =>
          value.status === DeviceActionStatus.Completed ||
          value.status === DeviceActionStatus.Error ||
          value.status === DeviceActionStatus.Stopped,
      ),
      timeout(DEFAULT_TIMEOUT_MS),
    ),
  );

  if (state.status === DeviceActionStatus.Completed) return state.output;
  if (state.status === DeviceActionStatus.Error) {
    throw new Error(`${label} failed: ${formatError(state.error)}`);
  }
  throw new Error(`${label} was stopped`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function signatureToHex(signature: Signature): string {
  const r = signature.r.replace(/^0x/, "");
  const s = signature.s.replace(/^0x/, "");
  const v = signature.v.toString(16).padStart(2, "0");
  const result = `${r}${s}${v}`;
  if (!/^[0-9a-fA-F]{130}$/.test(result)) {
    throw new Error("Device returned a malformed signature");
  }
  return result;
}

async function waitForReceipt(args: Args, txID: string): Promise<unknown> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const receipt = await nilePost<Record<string, unknown>>(
      args,
      "/wallet/gettransactioninfobyid",
      { value: txID },
    );
    if (Object.keys(receipt).length > 0) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return undefined;
}

async function cleanupWithTimeout(
  label: string,
  cleanup: () => void | Promise<void>,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(cleanup),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          CLEANUP_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    console.warn(`Cleanup warning: ${formatError(error)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dmk = new DeviceManagementKitBuilder()
    .addTransport(nodeHidTransportFactory)
    .build();
  let sessionId: string | undefined;

  try {
    console.log(
      "Connect and unlock one Ledger device. Discovering via Node HID...",
    );
    const device = await firstValueFrom(
      dmk
        .startDiscovering({ transport: nodeHidIdentifier })
        .pipe(timeout(30_000)),
    );
    await dmk.stopDiscovering();

    sessionId = await dmk.connect({
      device,
      sessionRefresherOptions: { isRefresherDisabled: true },
    });
    const signer = new SignerTronBuilder({
      dmk,
      sessionId,
      originToken: args.originToken,
    }).build();

    console.log("Confirm the sender address on the Ledger device...");
    const address = await waitForDeviceAction(
      signer.getAddress(args.path, { checkOnDevice: true }),
      "Get address",
    );
    console.log(`Sender: ${address.address}`);
    console.log(`Network: Nile (${args.apiUrl})`);

    const transaction = await createTransaction(args, address.address);
    console.log(`Created ${args.type} transaction: ${transaction.txID}`);
    console.log("Review and approve the transaction on the Ledger device...");

    const rawData = Uint8Array.from(
      Buffer.from(transaction.raw_data_hex.replace(/^0x/, ""), "hex"),
    );
    const signature = await waitForDeviceAction(
      signer.signTransaction(args.path, rawData, {
        clearSigningMode: "auto",
      }),
      "Sign transaction",
    );
    transaction.signature = [signatureToHex(signature)];
    transaction.visible = true;
    console.log("Device signature added successfully.");

    if (!args.broadcast) {
      console.log("Dry-run complete; transaction was NOT broadcast.");
      console.log("Re-run with --broadcast to submit it to Nile.");
      return;
    }

    const broadcast = await nilePost<{
      result?: boolean;
      code?: string;
      message?: string;
    }>(args, "/wallet/broadcasttransaction", transaction);
    if (!broadcast.result) {
      throw new Error(
        `Broadcast failed (${broadcast.code ?? "unknown"}): ${apiErrorMessage(broadcast.message)}`,
      );
    }

    console.log(
      `Broadcast accepted: https://nile.tronscan.org/#/transaction/${transaction.txID}`,
    );
    console.log("Waiting for confirmation...");
    const receipt = await waitForReceipt(args, transaction.txID);
    if (receipt) console.log(`Receipt: ${JSON.stringify(receipt, null, 2)}`);
    else console.log("No receipt after 60 seconds; check the explorer URL.");
  } finally {
    await cleanupWithTimeout("Stop discovery", () => dmk.stopDiscovering());
    if (sessionId) {
      const connectedSessionId = sessionId;
      await cleanupWithTimeout("Disconnect device", () =>
        dmk.disconnect({ sessionId: connectedSessionId }),
      );
    }
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  },
);
