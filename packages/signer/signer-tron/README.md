# Tron Signer Kit

`@ledgerhq/device-signer-kit-tron` — Device Management Kit signer for the Ledger
Tron application ([app-tron](https://github.com/LedgerHQ/app-tron)).

> **Status: scaffolding (Phase 0).** `getAddress` and `getAppConfiguration` are
> implemented; `signTransaction` and `signMessage` are stubbed pending Phase 1.

## Roadmap

| Phase | Scope                                                                                                                                                          | Backend dep                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 0     | Package skeleton, DI, `getAddress` (0x02), `getAppConfiguration` (0x06), Base58Check                                                                           | none                         |
| 1     | `signTransaction` blind (0x04, protobuf `raw_data`), `signMessage` (0x08/0xC8), `signTransactionHash` (0x05)                                                   | none                         |
| 2     | TIP-712 bare signing (0x0C / 0x1A / 0x1C)                                                                                                                      | none                         |
| 3     | Clear-signing transfers: TRC20 (0xCA), NFT (0x14), trusted name (0x22), enum (0x24), challenge (0x20), TRC10 inline, TIP-712 filtering (0x1E), PKI certificate | context-module + CAL backend |
| 4     | GCS smart contracts (0xD4 + 0x26/0x28/0x2A/0x38)                                                                                                               | context-module + CAL backend |
| 5     | ECDH (0x0A)                                                                                                                                                    | none                         |

## Key design notes

- **`signTransaction` takes the `raw_data` protobuf bytes** (`Transaction.raw`),
  not the full `Transaction`. This matches the Tron node's `raw_data_hex` and
  what the device signs (`sha256(raw_data)`).
- Transaction parsing uses **protobuf** (not RLP). The canonical schema lives in
  app-tron's `proto/core/{Tron,Contract}.proto` (package `protocol`). Contract
  dispatch is by the `Contract.type` enum; `google.protobuf.Any.type_url`
  (`type.googleapis.com/protocol.<Msg>`) is passed through untouched.
- Addresses are 34-char **Base58Check** ("T...").

See `spike/decode-rawdata.mjs` for a zero-dependency proof of the protobuf
`raw_data` decode + Base58Check derivation (run with `node`).
