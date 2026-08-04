import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import { P1 } from "@internal/app-binder/constants";
import { encodeDerivationPath } from "@internal/shared/utils/encodeDerivationPath";
import { SUPPORTED_TRANSACTION_RAW_FIXTURES } from "@internal/transaction/__test-utils__/supportedTransactionRawFixtures";
import { TronContractType } from "@internal/transaction/model/TransactionSubset";

import { buildTransactionChunks } from "./chunking";
import { DefaultTronTransactionMapperService } from "./DefaultTronTransactionMapperService";

const PATH = "44'/195'/0'/0/0";
const EXPECTED_SUPPORTED_TYPES = [
  TronContractType.AccountCreateContract,
  TronContractType.TransferContract,
  TronContractType.TransferAssetContract,
  TronContractType.VoteWitnessContract,
  TronContractType.WitnessCreateContract,
  TronContractType.AssetIssueContract,
  TronContractType.WitnessUpdateContract,
  TronContractType.ParticipateAssetIssueContract,
  TronContractType.AccountUpdateContract,
  TronContractType.FreezeBalanceContract,
  TronContractType.UnfreezeBalanceContract,
  TronContractType.WithdrawBalanceContract,
  TronContractType.UnfreezeAssetContract,
  TronContractType.UpdateAssetContract,
  TronContractType.ProposalCreateContract,
  TronContractType.ProposalApproveContract,
  TronContractType.ProposalDeleteContract,
  TronContractType.SetAccountIdContract,
  TronContractType.CreateSmartContract,
  TronContractType.TriggerSmartContract,
  TronContractType.UpdateSettingContract,
  TronContractType.ExchangeCreateContract,
  TronContractType.ExchangeInjectContract,
  TronContractType.ExchangeWithdrawContract,
  TronContractType.ExchangeTransactionContract,
  TronContractType.UpdateEnergyLimitContract,
  TronContractType.AccountPermissionUpdateContract,
  TronContractType.ClearABIContract,
  TronContractType.UpdateBrokerageContract,
  TronContractType.FreezeBalanceV2Contract,
  TronContractType.UnfreezeBalanceV2Contract,
  TronContractType.WithdrawExpireUnfreezeContract,
  TronContractType.DelegateResourceContract,
  TronContractType.UnDelegateResourceContract,
  TronContractType.CancelAllUnfreezeV2Contract,
] as const;

function rawDataFromHex(rawDataHex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(rawDataHex, "hex"));
}

function reassembleRawData(
  chunks: readonly { chunk: Uint8Array }[],
): Uint8Array {
  const pathLength = encodeDerivationPath(PATH).length;
  const rawLength = chunks.reduce(
    (length, { chunk }, index) =>
      length + chunk.length - (index === 0 ? pathLength : 0),
    0,
  );
  const rawData = new Uint8Array(rawLength);
  let offset = 0;

  chunks.forEach(({ chunk }, index) => {
    const rawChunk = index === 0 ? chunk.slice(pathLength) : chunk;
    rawData.set(rawChunk, offset);
    offset += rawChunk.length;
  });
  return rawData;
}

describe("app-tron supported transaction raw fixtures", () => {
  it("contains each of the 35 firmware-supported contract types exactly once", () => {
    const actualTypes = SUPPORTED_TRANSACTION_RAW_FIXTURES.map(
      ({ contractType }) => contractType,
    );

    expect(actualTypes).toStrictEqual(EXPECTED_SUPPORTED_TYPES);
    expect(new Set(actualTypes).size).toBe(35);
  });

  it.each(SUPPORTED_TRANSACTION_RAW_FIXTURES)(
    "maps $contractName and preserves its raw payload",
    ({ contractType, contractName, rawDataHex }) => {
      const rawData = rawDataFromHex(rawDataHex);
      const transaction = new DefaultTronTransactionMapperService().map(
        rawData,
      );

      expect(transaction.contracts).toHaveLength(1);
      expect(transaction.contracts[0]).toMatchObject({
        type: contractType,
        typeName: contractName,
        typeUrl: `type.googleapis.com/protocol.${contractName}`,
      });
      expect(transaction.contracts[0]!.raw.length).toBeGreaterThan(0);
    },
  );

  it.each(SUPPORTED_TRANSACTION_RAW_FIXTURES)(
    "chunks $contractName at arbitrary byte boundaries without data loss",
    ({ rawDataHex }) => {
      const rawData = rawDataFromHex(rawDataHex);
      const chunks = buildTransactionChunks(PATH, rawData);

      expect(
        chunks.every(({ chunk }) => chunk.length <= APDU_MAX_PAYLOAD),
      ).toBe(true);
      expect(chunks[0]!.p1).toBe(chunks.length === 1 ? P1.SIGN : P1.FIRST);
      expect(chunks.at(-1)!.p1).toBe(chunks.length === 1 ? P1.SIGN : P1.LAST);
      expect(chunks.slice(1, -1).every(({ p1 }) => p1 === P1.MORE)).toBe(true);
      expect(reassembleRawData(chunks)).toStrictEqual(rawData);
    },
  );

  it.each([
    "WitnessCreateContract",
    "ProposalCreateContract",
    "AccountPermissionUpdateContract",
    "CreateSmartContract",
  ])("keeps the large $contractName fixture above one APDU", (contractName) => {
    const fixture = SUPPORTED_TRANSACTION_RAW_FIXTURES.find(
      (candidate) => candidate.contractName === contractName,
    );
    expect(fixture).toBeDefined();

    const chunks = buildTransactionChunks(
      PATH,
      rawDataFromHex(fixture!.rawDataHex),
    );
    expect(chunks.length).toBeGreaterThan(1);
  });
});
