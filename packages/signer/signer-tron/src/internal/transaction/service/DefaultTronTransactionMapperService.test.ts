import { TronContractType } from "@internal/transaction/model/TransactionSubset";

import { DefaultTronTransactionMapperService } from "./DefaultTronTransactionMapperService";

// Real TransferContract raw_data from hw-app-trx's signTransaction test.
const TRANSFER_RAW_DATA = Uint8Array.from(
  Buffer.from(
    "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d",
    "hex",
  ),
);

describe("DefaultTronTransactionMapperService", () => {
  const mapper = new DefaultTronTransactionMapperService();

  it("should decode a TransferContract raw_data into the subset", () => {
    const subset = mapper.map(TRANSFER_RAW_DATA);

    expect(subset.memo).toBe("CryptoChain-TronSR Ledger Transactions Tests");
    expect(subset.refBlockBytes).toBe("3dce");
    expect(subset.expiration).toBe(1575712551000n);
    expect(subset.contracts).toHaveLength(1);

    const contract = subset.contracts[0]!;
    expect(contract.type).toBe(TronContractType.TransferContract);
    expect(contract.typeName).toBe("TransferContract");
    expect(contract.typeUrl).toBe(
      "type.googleapis.com/protocol.TransferContract",
    );
    expect(contract.ownerAddress).toBe("TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH");
    expect(contract.toAddress).toBe("TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH");
    expect(contract.amount).toBe(100000000n);
  });

  it("should expose undecoded contracts via raw bytes", () => {
    const subset = mapper.map(TRANSFER_RAW_DATA);
    expect(subset.contracts[0]!.raw.length).toBeGreaterThan(0);
  });
});
