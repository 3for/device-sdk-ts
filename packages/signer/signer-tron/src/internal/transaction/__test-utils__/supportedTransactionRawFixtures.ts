import { TronContractType } from "@internal/transaction/model/TransactionSubset";

export type SupportedTransactionRawFixture = {
  readonly contractType: TronContractType;
  readonly contractName: string;
  readonly rawDataHex: string;
};

const OWNER = fromHex("41c8599111f29c1e1e061265b4af93ea1f274ad78a");
const RECIPIENT = fromHex("41364b03e0815687edaf90b81ff58e496dea7383d7");
const REF_BLOCK_BYTES = fromHex("3dce");
const REF_BLOCK_HASH = fromHex("95da42177db00507");
const textEncoder = new TextEncoder();

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function encodeVarint(value: number | bigint): Uint8Array {
  let remaining = BigInt(value);
  if (remaining < 0n) throw new Error("Fixture varints must be non-negative");

  const bytes: number[] = [];
  do {
    const byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    bytes.push(remaining === 0n ? byte : byte | 0x80);
  } while (remaining !== 0n);
  return Uint8Array.from(bytes);
}

function fieldKey(field: number, wireType: 0 | 2): Uint8Array {
  return encodeVarint(field * 8 + wireType);
}

function varintField(field: number, value: number | bigint): Uint8Array {
  return concatBytes(fieldKey(field, 0), encodeVarint(value));
}

function bytesField(field: number, value: Uint8Array): Uint8Array {
  return concatBytes(fieldKey(field, 2), encodeVarint(value.length), value);
}

function stringField(field: number, value: string): Uint8Array {
  return bytesField(field, textEncoder.encode(value));
}

function messageField(field: number, value: Uint8Array): Uint8Array {
  return bytesField(field, value);
}

function fromHex(value: string): Uint8Array {
  const bytes = value.match(/.{2}/g);
  if (!bytes || bytes.join("") !== value)
    throw new Error("Invalid fixture hex");
  return Uint8Array.from(bytes, (byte) => Number.parseInt(byte, 16));
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function addressAmountPayload(amountField: number, amount: number): Uint8Array {
  return concatBytes(bytesField(1, OWNER), varintField(amountField, amount));
}

function ownerOnlyPayload(): Uint8Array {
  return bytesField(1, OWNER);
}

function exchangePayload(includeExpected: boolean): Uint8Array {
  return concatBytes(
    bytesField(1, OWNER),
    varintField(2, 6),
    stringField(3, "1000166"),
    varintField(4, 1_000_000),
    ...(includeExpected ? [varintField(5, 100)] : []),
  );
}

function permissionPayload(): Uint8Array {
  const key = (address: Uint8Array) =>
    concatBytes(bytesField(1, address), varintField(2, 1));
  const owner = concatBytes(
    stringField(3, "owner"),
    varintField(4, 1),
    messageField(7, key(OWNER)),
  );
  const witness = concatBytes(
    varintField(1, 1),
    stringField(3, "witness"),
    varintField(4, 1),
    messageField(7, key(OWNER)),
  );
  const active = concatBytes(
    varintField(1, 2),
    varintField(2, 2),
    stringField(3, "active"),
    varintField(4, 2),
    bytesField(6, new Uint8Array(32).fill(0xff)),
    messageField(7, key(OWNER)),
    messageField(7, key(RECIPIENT)),
  );
  return concatBytes(
    bytesField(1, OWNER),
    messageField(2, owner),
    messageField(3, witness),
    messageField(4, active),
  );
}

function proposalCreatePayload(): Uint8Array {
  const parameters = [
    [0, 81_000],
    [1, 100_000],
    [2, 400_000],
    [3, 10],
    [4, 1_024],
    [5, 16_000_000],
    [6, 115_200_000_000],
    [7, 0],
    [8, 1],
    [9, 1],
    [13, 400],
    [22, 1_000_000],
    [24, 0],
    [29, 10_000],
    [33, 1_000],
    [45, 0],
    [61, 100_000],
    [70, 365],
    [82, 10_000],
    [92, 31_536_002_999],
  ] as const;

  return concatBytes(
    bytesField(1, OWNER),
    ...parameters.map(([key, value]) =>
      messageField(2, concatBytes(varintField(1, key), varintField(2, value))),
    ),
  );
}

function assetIssuePayload(): Uint8Array {
  const frozenSupply = concatBytes(varintField(1, 100_000), varintField(2, 30));

  return concatBytes(
    bytesField(1, OWNER),
    stringField(2, "LedgerAsset"),
    stringField(3, "LAS"),
    varintField(4, 1_000_000),
    messageField(5, frozenSupply),
    varintField(6, 1),
    varintField(7, 6),
    varintField(8, 100),
    varintField(9, 2_000_000_000_000n),
    varintField(10, 2_000_086_400_000n),
    varintField(16, 1),
    stringField(20, "Ledger TRC10 asset"),
    stringField(21, "https://ledger.com/trc10"),
    varintField(22, 1_000),
    varintField(23, 10_000),
  );
}

function createSmartContractPayload(): Uint8Array {
  const newContract = concatBytes(
    bytesField(1, OWNER),
    bytesField(4, new Uint8Array(3_000).fill(0xff)),
    varintField(5, 1_000_000),
    varintField(6, 30),
    stringField(7, "LedgerContract"),
    varintField(8, 10_000_000),
  );

  return concatBytes(
    bytesField(1, OWNER),
    messageField(2, newContract),
    varintField(3, 123),
    varintField(4, 1_000_001),
  );
}

function trc20TransferData(): Uint8Array {
  const encodedAddress = new Uint8Array(32);
  encodedAddress.set(RECIPIENT.slice(1), 12);
  const encodedAmount = new Uint8Array(32);
  encodedAmount[31] = 1;
  return concatBytes(fromHex("a9059cbb"), encodedAddress, encodedAmount);
}

function buildRawData(
  contractType: TronContractType,
  contractName: string,
  contractValue: Uint8Array,
): string {
  const any = concatBytes(
    stringField(1, `type.googleapis.com/protocol.${contractName}`),
    bytesField(2, contractValue),
  );
  const contract = concatBytes(
    varintField(1, contractType),
    messageField(2, any),
  );
  const rawData = concatBytes(
    bytesField(1, REF_BLOCK_BYTES),
    bytesField(4, REF_BLOCK_HASH),
    varintField(8, 1_575_712_551_000n),
    messageField(11, contract),
    varintField(14, 1_575_712_492_061n),
    ...(contractType === TronContractType.TriggerSmartContract ||
    contractType === TronContractType.CreateSmartContract
      ? [varintField(18, 100_000_000)]
      : []),
  );
  return toHex(rawData);
}

function fixture(
  contractType: TronContractType,
  contractName: string,
  contractValue: Uint8Array,
): SupportedTransactionRawFixture {
  return {
    contractType,
    contractName,
    rawDataHex: buildRawData(contractType, contractName, contractValue),
  };
}

export const SUPPORTED_TRANSACTION_RAW_FIXTURES = [
  fixture(
    TronContractType.AccountCreateContract,
    "AccountCreateContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      varintField(3, 0),
    ),
  ),
  fixture(
    TronContractType.TransferContract,
    "TransferContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      varintField(3, 100_000_000),
    ),
  ),
  fixture(
    TronContractType.TransferAssetContract,
    "TransferAssetContract",
    concatBytes(
      stringField(1, "1002000"),
      bytesField(2, OWNER),
      bytesField(3, RECIPIENT),
      varintField(4, 1_000_000),
    ),
  ),
  fixture(
    TronContractType.VoteWitnessContract,
    "VoteWitnessContract",
    concatBytes(
      bytesField(1, OWNER),
      messageField(
        2,
        concatBytes(bytesField(1, RECIPIENT), varintField(2, 10)),
      ),
    ),
  ),
  fixture(
    TronContractType.WitnessCreateContract,
    "WitnessCreateContract",
    concatBytes(bytesField(1, OWNER), stringField(2, "a".repeat(256))),
  ),
  fixture(
    TronContractType.AssetIssueContract,
    "AssetIssueContract",
    assetIssuePayload(),
  ),
  fixture(
    TronContractType.WitnessUpdateContract,
    "WitnessUpdateContract",
    concatBytes(
      bytesField(1, OWNER),
      stringField(12, "https://ledger.com/witness"),
    ),
  ),
  fixture(
    TronContractType.ParticipateAssetIssueContract,
    "ParticipateAssetIssueContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      stringField(3, "1000001"),
      varintField(4, 1_000_000),
    ),
  ),
  fixture(
    TronContractType.AccountUpdateContract,
    "AccountUpdateContract",
    concatBytes(stringField(1, "Ledger"), bytesField(2, OWNER)),
  ),
  fixture(
    TronContractType.FreezeBalanceContract,
    "FreezeBalanceContract",
    concatBytes(
      addressAmountPayload(2, 100_000_000),
      varintField(3, 3),
      varintField(10, 1),
      bytesField(15, RECIPIENT),
    ),
  ),
  fixture(
    TronContractType.UnfreezeBalanceContract,
    "UnfreezeBalanceContract",
    concatBytes(
      bytesField(1, OWNER),
      varintField(10, 1),
      bytesField(15, RECIPIENT),
    ),
  ),
  fixture(
    TronContractType.WithdrawBalanceContract,
    "WithdrawBalanceContract",
    ownerOnlyPayload(),
  ),
  fixture(
    TronContractType.UnfreezeAssetContract,
    "UnfreezeAssetContract",
    ownerOnlyPayload(),
  ),
  fixture(
    TronContractType.UpdateAssetContract,
    "UpdateAssetContract",
    concatBytes(
      bytesField(1, OWNER),
      stringField(2, "Updated TRC10 asset"),
      stringField(3, "https://ledger.com/updated-trc10"),
      varintField(4, 1_000),
      varintField(5, 10_000),
    ),
  ),
  fixture(
    TronContractType.ProposalCreateContract,
    "ProposalCreateContract",
    proposalCreatePayload(),
  ),
  fixture(
    TronContractType.ProposalApproveContract,
    "ProposalApproveContract",
    concatBytes(bytesField(1, OWNER), varintField(2, 10), varintField(3, 1)),
  ),
  fixture(
    TronContractType.ProposalDeleteContract,
    "ProposalDeleteContract",
    concatBytes(bytesField(1, OWNER), varintField(2, 10)),
  ),
  fixture(
    TronContractType.SetAccountIdContract,
    "SetAccountIdContract",
    concatBytes(stringField(1, "account1"), bytesField(2, OWNER)),
  ),
  fixture(
    TronContractType.CreateSmartContract,
    "CreateSmartContract",
    createSmartContractPayload(),
  ),
  fixture(
    TronContractType.TriggerSmartContract,
    "TriggerSmartContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      bytesField(4, trc20TransferData()),
    ),
  ),
  fixture(
    TronContractType.UpdateSettingContract,
    "UpdateSettingContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      varintField(3, 50),
    ),
  ),
  fixture(
    TronContractType.ExchangeCreateContract,
    "ExchangeCreateContract",
    concatBytes(
      bytesField(1, OWNER),
      stringField(2, "_"),
      varintField(3, 10_000_000_000),
      stringField(4, "1000166"),
      varintField(5, 10_000_000),
    ),
  ),
  fixture(
    TronContractType.ExchangeInjectContract,
    "ExchangeInjectContract",
    exchangePayload(false),
  ),
  fixture(
    TronContractType.ExchangeWithdrawContract,
    "ExchangeWithdrawContract",
    exchangePayload(false),
  ),
  fixture(
    TronContractType.ExchangeTransactionContract,
    "ExchangeTransactionContract",
    exchangePayload(true),
  ),
  fixture(
    TronContractType.UpdateEnergyLimitContract,
    "UpdateEnergyLimitContract",
    concatBytes(
      bytesField(1, OWNER),
      bytesField(2, RECIPIENT),
      varintField(3, 10_000_000),
    ),
  ),
  fixture(
    TronContractType.AccountPermissionUpdateContract,
    "AccountPermissionUpdateContract",
    permissionPayload(),
  ),
  fixture(
    TronContractType.ClearABIContract,
    "ClearABIContract",
    concatBytes(bytesField(1, OWNER), bytesField(2, RECIPIENT)),
  ),
  fixture(
    TronContractType.UpdateBrokerageContract,
    "UpdateBrokerageContract",
    concatBytes(bytesField(1, OWNER), varintField(2, 20)),
  ),
  fixture(
    TronContractType.FreezeBalanceV2Contract,
    "FreezeBalanceV2Contract",
    concatBytes(addressAmountPayload(2, 100_000_000), varintField(3, 1)),
  ),
  fixture(
    TronContractType.UnfreezeBalanceV2Contract,
    "UnfreezeBalanceV2Contract",
    concatBytes(addressAmountPayload(2, 100_000_000), varintField(3, 1)),
  ),
  fixture(
    TronContractType.WithdrawExpireUnfreezeContract,
    "WithdrawExpireUnfreezeContract",
    ownerOnlyPayload(),
  ),
  fixture(
    TronContractType.DelegateResourceContract,
    "DelegateResourceContract",
    concatBytes(
      bytesField(1, OWNER),
      varintField(2, 1),
      varintField(3, 100_000_000),
      bytesField(4, RECIPIENT),
    ),
  ),
  fixture(
    TronContractType.UnDelegateResourceContract,
    "UnDelegateResourceContract",
    concatBytes(
      bytesField(1, OWNER),
      varintField(2, 1),
      varintField(3, 100_000_000),
      bytesField(4, RECIPIENT),
    ),
  ),
  fixture(
    TronContractType.CancelAllUnfreezeV2Contract,
    "CancelAllUnfreezeV2Contract",
    ownerOnlyPayload(),
  ),
] as const satisfies readonly SupportedTransactionRawFixture[];
