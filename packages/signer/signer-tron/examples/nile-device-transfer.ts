import "reflect-metadata";

import { access, readFile } from "node:fs/promises";
import { basename, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import {
  type Signature,
  SignerTronBuilder,
  type TronClearSignContext,
  TronClearSignContextType,
  type TronClearSigningMode,
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
const SAMPLES_DIRECTORY = fileURLToPath(new URL("./samples/", import.meta.url));

type TransactionKind = "trx" | "trc20" | "build" | "raw";

export type Args = {
  type: TransactionKind;
  to?: string;
  amount?: string;
  contract?: string;
  transactionFile?: string;
  rawDataHex?: string;
  endpoint?: string;
  paramsFile?: string;
  clearSigningMode: TronClearSigningMode;
  contextsFile?: string;
  decimals: number;
  feeLimit: number;
  path: string;
  apiUrl: string;
  apiKey?: string;
  originToken?: string;
  broadcast: boolean;
};

export type TronTransaction = {
  txID: string;
  raw_data_hex: string;
  raw_data: unknown;
  signature?: string[];
  visible?: boolean;
};

/**
 * Normalized input consumed by the shared signing pipeline.
 *
 * `transaction` is optional because a future raw-data-only source can still be
 * signed and reviewed on-device, but cannot be broadcast without the complete
 * Tron transaction JSON.
 */
export type PreparedTransaction = {
  source: TransactionKind;
  rawDataHex: string;
  transaction?: TronTransaction;
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
  pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --type raw \\
    --transaction-file <transaction.json> --broadcast
  pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --type raw \\
    --raw-data-hex <protobuf-raw-data-hex>
  pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --type build \\
    --endpoint /wallet/freezebalancev2 --params <params.json> --broadcast

Options:
  --type <source>        trx, trc20, build, or raw (default: trx)
  --to <address>         Recipient Nile Base58Check address (trx/trc20)
  --amount <decimal>     Human-readable amount, for example 0.1 (trx/trc20)
  --contract <address>   TRC20 contract address (required for trc20)
  --transaction-file     Complete Tron transaction JSON (raw; supports broadcast)
  --raw-data-hex <hex>   Transaction.raw protobuf hex (raw; signing/UI only)
  --endpoint <path>      Relative /wallet/* transaction-builder endpoint
  --params <file>        JSON request body for the build endpoint
                         Owner values may use $OWNER_ADDRESS_BASE58 or $OWNER_ADDRESS_HEX
  --clear-signing <mode> auto, blind, or gcs (default: auto)
  --contexts-file <file> Tron clear-signing contexts JSON array
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
  if (
    type !== "trx" &&
    type !== "trc20" &&
    type !== "build" &&
    type !== "raw"
  ) {
    throw new Error("--type must be trx, trc20, build, or raw");
  }
  const to = values.get("to");
  const amount = values.get("amount");
  const transactionFile = values.get("transaction-file");
  const rawDataHexInput = values.get("raw-data-hex");
  const endpoint = values.get("endpoint");
  const paramsFile = values.get("params");
  const clearSigningMode = (values.get("clear-signing") ??
    "auto") as TronClearSigningMode;
  const contextsFile = values.get("contexts-file");
  if (
    clearSigningMode !== "auto" &&
    clearSigningMode !== "blind" &&
    clearSigningMode !== "gcs"
  ) {
    throw new Error("--clear-signing must be auto, blind, or gcs");
  }
  if (clearSigningMode === "blind" && contextsFile) {
    throw new Error(
      "--contexts-file cannot be used with --clear-signing blind because blind mode ignores contexts",
    );
  }
  let rawDataHex: string | undefined;
  if (type === "raw") {
    const rawSourceCount =
      Number(Boolean(transactionFile)) + Number(Boolean(rawDataHexInput));
    if (rawSourceCount !== 1) {
      throw new Error(
        "--type raw requires exactly one of --transaction-file or --raw-data-hex",
      );
    }
    if (rawDataHexInput) {
      rawDataHex = normalizeHex(rawDataHexInput, "--raw-data-hex");
      if (broadcast) {
        throw new Error(
          "--raw-data-hex supports signing/UI testing only; --broadcast requires a complete transaction JSON",
        );
      }
    }
  } else if (type === "build") {
    if (!endpoint || !paramsFile) {
      throw new Error("--endpoint and --params are required for --type build");
    }
    validateBuilderEndpoint(endpoint);
  } else {
    if (!to || !amount) {
      throw new Error("--to and --amount are required for trx/trc20");
    }
    validateAddress(to, "recipient");
  }

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
    transactionFile,
    rawDataHex,
    endpoint,
    paramsFile,
    clearSigningMode,
    contextsFile,
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

function normalizeHex(value: string, label: string): string {
  const normalized = value.replace(/^0x/i, "");
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(normalized)) {
    throw new Error(`${label} must be a non-empty, even-length hex string`);
  }
  return normalized.toLowerCase();
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

export async function prepareTransaction(
  args: Args,
  ownerAddress: string,
): Promise<PreparedTransaction> {
  if (args.type === "raw") {
    if (args.rawDataHex) {
      return {
        source: "raw",
        rawDataHex: args.rawDataHex,
      };
    }
    if (!args.transactionFile) {
      throw new Error("Missing transaction input for raw source");
    }
    const transaction = await loadTransactionFile(args.transactionFile);
    assertUnsignedTransaction(transaction);
    return {
      source: "raw",
      rawDataHex: transaction.raw_data_hex,
      transaction,
    };
  }

  if (args.type === "build") {
    if (!args.endpoint || !args.paramsFile) {
      throw new Error("Missing endpoint or params file for build source");
    }
    const paramsFile = await resolveParamsFile(args.paramsFile);
    const rawParams = await loadJsonObject(paramsFile, "params");
    const params = replaceOwnerAddressPlaceholders(rawParams, ownerAddress);
    const response = await nilePost<unknown>(args, args.endpoint, params);
    const transaction = normalizeTransactionResponse(response);
    if (
      transaction.visible === undefined &&
      typeof params["visible"] === "boolean"
    ) {
      transaction.visible = params["visible"];
    }
    assertUnsignedTransaction(transaction);
    validateTransactionIntegrity(transaction);
    warnIfTransactionExpiresSoon(transaction);
    return {
      source: "build",
      rawDataHex: transaction.raw_data_hex,
      transaction,
    };
  }

  if (!args.to || !args.amount) {
    throw new Error("Missing recipient or amount for transaction builder");
  }
  const { to, amount: amountValue } = args;

  if (args.type === "trx") {
    const amount = decimalToUnits(amountValue, 6);
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("TRX amount exceeds the node API's safe JSON range");
    }
    const transaction = await nilePost<TronTransaction>(
      args,
      "/wallet/createtransaction",
      {
        owner_address: ownerAddress,
        to_address: to,
        amount: Number(amount),
        visible: true,
      },
    );
    assertTransaction(transaction);
    // This branch creates the transaction with Base58 addresses.
    transaction.visible = true;
    assertUnsignedTransaction(transaction);
    validateTransactionIntegrity(transaction);
    warnIfTransactionExpiresSoon(transaction);
    return {
      source: "trx",
      rawDataHex: transaction.raw_data_hex,
      transaction,
    };
  }

  if (!args.contract) {
    throw new Error("Missing contract address for TRC20 transaction builder");
  }
  const amount = decimalToUnits(amountValue, args.decimals);
  const response = await nilePost<TriggerResponse>(
    args,
    "/wallet/triggersmartcontract",
    {
      owner_address: ownerAddress,
      contract_address: args.contract,
      function_selector: "transfer(address,uint256)",
      parameter: encodeTrc20TransferParameter(to, amount),
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
  // This branch creates the transaction with Base58 addresses.
  response.transaction.visible = true;
  assertUnsignedTransaction(response.transaction);
  validateTransactionIntegrity(response.transaction);
  warnIfTransactionExpiresSoon(response.transaction);
  return {
    source: "trc20",
    rawDataHex: response.transaction.raw_data_hex,
    transaction: response.transaction,
  };
}

function replaceOwnerAddressPlaceholders(
  params: Record<string, unknown>,
  ownerAddressBase58: string,
): Record<string, unknown> {
  if (
    params["visible"] === true &&
    containsExactValue(params, "$OWNER_ADDRESS_HEX")
  ) {
    throw new Error(
      "$OWNER_ADDRESS_HEX cannot be used when params.visible is true",
    );
  }
  if (
    params["visible"] === false &&
    containsExactValue(params, "$OWNER_ADDRESS_BASE58")
  ) {
    throw new Error(
      "$OWNER_ADDRESS_BASE58 cannot be used when params.visible is false",
    );
  }

  const ownerAddressHex = Buffer.from(
    decodeAddress(ownerAddressBase58),
  ).toString("hex");

  const replace = (value: unknown): unknown => {
    if (value === "$OWNER_ADDRESS_BASE58") return ownerAddressBase58;
    if (value === "$OWNER_ADDRESS_HEX") return ownerAddressHex;
    if (Array.isArray(value)) return value.map(replace);
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          replace(nestedValue),
        ]),
      );
    }
    return value;
  };

  return replace(params) as Record<string, unknown>;
}

function containsExactValue(value: unknown, expected: string): boolean {
  if (value === expected) return true;
  if (Array.isArray(value)) {
    return value.some((nestedValue) =>
      containsExactValue(nestedValue, expected),
    );
  }
  if (isRecord(value)) {
    return Object.values(value).some((nestedValue) =>
      containsExactValue(nestedValue, expected),
    );
  }
  return false;
}

async function loadTransactionFile(filename: string): Promise<TronTransaction> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read transaction file: ${filename}`, {
      cause: error,
    });
  }

  assertTransaction(parsed);
  validateTransactionIntegrity(parsed);
  warnIfTransactionExpiresSoon(parsed);
  return parsed;
}

async function loadJsonObject(
  filename: string,
  label: string,
): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} file: ${filename}`, {
      cause: error,
    });
  }
  if (!isRecord(parsed)) {
    throw new Error(`--${label} must contain a JSON object`);
  }
  return parsed;
}

/**
 * Resolve a builder params file without making package-script callers know
 * that pnpm executes the command from the signer-tron package directory.
 *
 * Explicit paths always win. A missing bare filename falls back to the
 * package's samples directory; paths containing directories do not fall back.
 */
export async function resolveParamsFile(filename: string): Promise<string> {
  try {
    await access(filename);
    return filename;
  } catch {
    // Try the bundled samples directory only for a bare relative filename.
  }

  if (!isAbsolute(filename) && basename(filename) === filename) {
    const sampleFile = resolvePath(SAMPLES_DIRECTORY, filename);
    try {
      await access(sampleFile);
      return sampleFile;
    } catch {
      // Preserve the original filename in the eventual user-facing error.
    }
  }

  return filename;
}

export function validateBuilderEndpoint(endpoint: string): void {
  const normalized = endpoint.toLowerCase();
  if (
    !endpoint.startsWith("/wallet/") ||
    endpoint.includes("://") ||
    endpoint.includes("?") ||
    endpoint.includes("#") ||
    endpoint.includes("..")
  ) {
    throw new Error(
      "--endpoint must be a relative /wallet/* path without a URL, query, fragment, or parent traversal",
    );
  }

  const forbidden = new Set([
    "/wallet/broadcasttransaction",
    "/wallet/broadcasthex",
    "/wallet/gettransactionsign",
    "/wallet/gettransactionsign2",
  ]);
  if (forbidden.has(normalized.replace(/\/$/, ""))) {
    throw new Error("--endpoint must be a transaction builder endpoint");
  }
}

export function normalizeTransactionResponse(
  response: unknown,
): TronTransaction {
  if (!isRecord(response)) {
    throw new Error("Nile builder returned a non-object response");
  }

  const result = response["result"];
  if (result === false) {
    throw new Error(
      `Nile builder failed: ${apiErrorMessage(response["message"])}`,
    );
  }
  if (isRecord(result) && result["result"] === false) {
    throw new Error(
      `Nile builder failed: ${apiErrorMessage(result["message"])}`,
    );
  }
  if (typeof response["Error"] === "string") {
    throw new Error(`Nile builder failed: ${response["Error"]}`);
  }

  const candidate = isRecord(response["transaction"])
    ? response["transaction"]
    : response;
  assertTransaction(candidate);
  return candidate;
}

async function loadContextsFile(
  filename: string | undefined,
): Promise<TronClearSignContext[] | undefined> {
  if (!filename) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read contexts file: ${filename}`, {
      cause: error,
    });
  }

  const tronContextTypes = new Set<string>(
    Object.values(TronClearSignContextType),
  );
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (context) =>
        isRecord(context) &&
        typeof context["type"] === "string" &&
        tronContextTypes.has(context["type"]) &&
        typeof context["payload"] === "string",
    )
  ) {
    throw new Error(
      "--contexts-file must contain a JSON array of Tron contexts with valid type and payload fields",
    );
  }

  return parsed as TronClearSignContext[];
}

function assertTransaction(
  transaction: unknown,
): asserts transaction is TronTransaction {
  if (
    !isRecord(transaction) ||
    typeof transaction["txID"] !== "string" ||
    transaction["txID"].length === 0 ||
    typeof transaction["raw_data_hex"] !== "string" ||
    !isHex(transaction["raw_data_hex"]) ||
    !isRecord(transaction["raw_data"])
  ) {
    throw new Error(
      `Node did not return a complete transaction: ${JSON.stringify(transaction)}`,
    );
  }
}

function assertUnsignedTransaction(transaction: TronTransaction): void {
  if (
    transaction.signature !== undefined &&
    (!Array.isArray(transaction.signature) || transaction.signature.length > 0)
  ) {
    // Tron multisig flows append signatures. This single-signer example
    // intentionally refuses to overwrite or append to an existing signature.
    throw new Error(
      "Transaction already contains a signature; multisig signing is not supported by this example",
    );
  }
}

function isHex(value: string): boolean {
  return /^(?:[0-9a-fA-F]{2})+$/.test(value.replace(/^0x/i, ""));
}

function validateTransactionIntegrity(transaction: TronTransaction): void {
  const rawData = Uint8Array.from(
    Buffer.from(transaction.raw_data_hex.replace(/^0x/i, ""), "hex"),
  );
  const calculatedTxID = Buffer.from(sha256(rawData)).toString("hex");
  const declaredTxID = transaction.txID.replace(/^0x/i, "").toLowerCase();

  if (calculatedTxID !== declaredTxID) {
    throw new Error(
      `Transaction integrity check failed: txID ${transaction.txID} does not match sha256(raw_data_hex) ${calculatedTxID}`,
    );
  }
}

function warnIfTransactionExpiresSoon(transaction: TronTransaction): void {
  if (!isRecord(transaction.raw_data)) return;
  const expiration = parseEpochMilliseconds(transaction.raw_data["expiration"]);
  if (expiration === undefined) return;

  const remainingMs = expiration - Date.now();
  if (remainingMs <= 0) {
    console.warn(
      `Warning: transaction ${transaction.txID} expired at ${new Date(expiration).toISOString()}. It can still be used for signing/UI testing but cannot be broadcast.`,
    );
  } else if (remainingMs <= 60_000) {
    console.warn(
      `Warning: transaction ${transaction.txID} expires in ${Math.ceil(remainingMs / 1_000)} seconds.`,
    );
  }
}

function parseEpochMilliseconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function attachSignature(
  prepared: PreparedTransaction,
  signatureHex: string,
): void {
  if (prepared.transaction) {
    assertUnsignedTransaction(prepared.transaction);
    prepared.transaction.signature = [signatureHex];
  }
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
  const contexts = await loadContextsFile(args.contextsFile);
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

    const prepared = await prepareTransaction(args, address.address);
    console.log(
      `Created ${prepared.source} transaction: ${prepared.transaction?.txID ?? "offline raw data"}`,
    );
    console.log("Review and approve the transaction on the Ledger device...");

    const rawData = Uint8Array.from(
      Buffer.from(prepared.rawDataHex.replace(/^0x/, ""), "hex"),
    );
    const signature = await waitForDeviceAction(
      signer.signTransaction(args.path, rawData, {
        clearSigningMode: args.clearSigningMode,
        contexts,
      }),
      "Sign transaction",
    );
    const signatureHex = signatureToHex(signature);
    attachSignature(prepared, signatureHex);
    console.log("Device signature added successfully.");

    if (!args.broadcast) {
      console.log("Dry-run complete; transaction was NOT broadcast.");
      console.log("Re-run with --broadcast to submit it to Nile.");
      return;
    }

    const transaction = prepared.transaction;
    if (!transaction) {
      throw new Error(
        "Broadcasting requires a complete Tron transaction JSON; raw_data_hex alone is insufficient.",
      );
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

const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  fileURLToPath(import.meta.url) === resolvePath(entryPoint)
) {
  main().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(formatError(error));
      process.exit(1);
    },
  );
}
