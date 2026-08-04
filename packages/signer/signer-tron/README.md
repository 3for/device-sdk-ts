# Tron Signer Kit

`@ledgerhq/device-signer-kit-tron` provides Tron signing support for Ledger
devices through the Device Management Kit (DMK) and the
[Ledger Tron application](https://github.com/LedgerHQ/app-tron).

The signer currently implements address derivation, application configuration,
transaction and transaction-hash signing, TIP-191 personal-message signing,
full TIP-712 signing, typed-data hash signing, ECDH key agreement, and Tron
clear-signing contexts. The package is currently private and is consumed from
this monorepo workspace.

## Create a signer

Create the signer from an open DMK device session:

```ts
import { SignerTronBuilder } from "@ledgerhq/device-signer-kit-tron";

const signer = new SignerTronBuilder({
  dmk,
  sessionId,
  originToken, // Optional; forwarded to the default context module.
}).build();
```

`withContextModule(contextModule)` can be used on the builder to provide a
custom context module, for example in tests or when supplying local
clear-signing fixtures.

Signer methods return a DMK device action with an `observable` and a `cancel`
function. Consume the observable until it reaches `Completed`, `Error`, or
`Stopped`:

```ts
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";

const action = signer.getAddress("44'/195'/0'/0/0", {
  checkOnDevice: true,
});

const subscription = action.observable.subscribe((state) => {
  if (state.status === DeviceActionStatus.Completed) {
    console.log(state.output.address);
  }
});

function cleanup() {
  subscription.unsubscribe();
  action.cancel(); // Stops the device action if it is still running.
}
```

## Public API

| Method                | Description                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `getAddress`          | Derives a Tron Base58Check address and public key, with optional on-device verification and chain code.        |
| `getAppConfiguration` | Reads the app version and settings such as data, custom-contract, sign-by-hash, and TIP-712 flags.             |
| `getECDHPairKey`      | Derives an ECDH secret from an uncompressed secp256k1 peer public key after device confirmation.               |
| `signTransaction`     | Signs protobuf-encoded `Transaction.raw` bytes and optionally loads clear-signing contexts.                    |
| `signMessage`         | Signs a string or byte array using TIP-191, with optional full-message display.                                |
| `signTransactionHash` | Signs a precomputed 32-byte transaction hash. Requires the app's sign-by-hash setting.                         |
| `signTypedDataHash`   | Signs precomputed TIP-712 domain and message hashes. Requires the sign-by-hash setting.                        |
| `signTypedData`       | Executes the full TIP-712 flow by streaming type definitions and values for device-side rendering and hashing. |

Signing methods return a `Signature` containing hexadecimal `r` and `s` values
and the recovery identifier `v`.

Most methods accept `skipOpenApp` when the caller already controls application
selection. Address derivation also supports `checkOnDevice` and
`returnChainCode`; personal-message signing supports `fullDisplay`.

## Transaction input

`signTransaction` takes the protobuf serialization of the transaction's
`raw_data` field (`Transaction.raw`), not the full `Transaction` envelope. This
matches a Tron node's `raw_data_hex` value and the bytes hashed by the device:
`sha256(raw_data)`.

```ts
const action = signer.signTransaction("44'/195'/0'/0/0", rawData, {
  clearSigningMode: "auto",
});
```

Transaction parsing uses protobuf rather than RLP. Contract dispatch is based
on the `Contract.type` enum, while the `google.protobuf.Any.type_url` is kept
unchanged.

### Clear-signing modes

| Mode    | Behaviour                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `auto`  | Default. Loads available contexts, selects the GCS flow for non-TRC10 contexts, and otherwise uses the legacy transaction-signing flow. |
| `gcs`   | Forces the GCS transaction-signing flow, including when no context is available.                                                        |
| `blind` | Skips context lookup and uses the legacy transaction-signing flow. Recognized native contracts may still be rendered by the app.        |

The `contexts` option supplies `TronClearSignContext[]` directly and takes
precedence over context-module lookup, including when an empty array is passed.
TRC10 token-name contexts are sent through the legacy flow. Other supported
context types are sent through the GCS flow: TRC20 token, NFT, transaction
information, transaction-field description, trusted name, enum, proxy, and
gated-signing. A context's attached PKI certificate is loaded before its
payload.

## Supported transaction contracts

The SDK compatibility fixtures and APDU streaming tests cover all 35 contract
types currently recognized by the app's legacy transaction stream:

1. `AccountCreateContract`
2. `TransferContract`
3. `TransferAssetContract`
4. `VoteWitnessContract`
5. `WitnessCreateContract`
6. `AssetIssueContract`
7. `WitnessUpdateContract`
8. `ParticipateAssetIssueContract`
9. `AccountUpdateContract`
10. `FreezeBalanceContract`
11. `UnfreezeBalanceContract`
12. `WithdrawBalanceContract`
13. `UnfreezeAssetContract`
14. `UpdateAssetContract`
15. `ProposalCreateContract`
16. `ProposalApproveContract`
17. `ProposalDeleteContract`
18. `SetAccountIdContract`
19. `CreateSmartContract`
20. `TriggerSmartContract`
21. `UpdateSettingContract`
22. `ExchangeCreateContract`
23. `ExchangeInjectContract`
24. `ExchangeWithdrawContract`
25. `ExchangeTransactionContract`
26. `UpdateEnergyLimitContract`
27. `AccountPermissionUpdateContract`
28. `ClearABIContract`
29. `UpdateBrokerageContract`
30. `FreezeBalanceV2Contract`
31. `UnfreezeBalanceV2Contract`
32. `WithdrawExpireUnfreezeContract`
33. `DelegateResourceContract`
34. `UnDelegateResourceContract`
35. `CancelAllUnfreezeV2Contract`

The host only decodes fields needed to request contexts. Other contract payloads
remain raw protobuf bytes and are streamed to the app, which owns transaction
validation, parsing, and device display. Large payloads, including smart-contract
bytecode spanning arbitrary APDU boundaries, are covered by the compatibility
tests.

## TIP-712

`signTypedData` accepts data structurally equivalent to EIP-712: a domain, type
definitions, a primary type, and the message values. It runs the complete
TIP-712 protocol so the device receives the derivation path, type definitions,
and implementations before producing the signature.

```ts
const action = signer.signTypedData("44'/195'/0'/0/0", {
  domain: {
    name: "Example",
    version: "1",
    chainId: 1,
  },
  types: {
    Person: [
      { name: "name", type: "string" },
      { name: "wallet", type: "address" },
    ],
  },
  primaryType: "Person",
  message: {
    name: "Alice",
    wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
  },
});
```

Use `signTypedDataHash` only when the application deliberately signs trusted,
precomputed domain and message hashes and the device's sign-by-hash setting is
enabled.

## Physical-device example

The [Nile hardware-device example](./examples/README.md) covers TRX and TRC20
transfers, raw transaction JSON or hex, generic `/wallet/*` contract-building
endpoints, clear-signing modes, explicit context fixtures, optional broadcast,
and sample Freeze V2 transactions.

From the repository root:

```bash
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --help
```

## Development

```bash
pnpm --filter @ledgerhq/device-signer-kit-tron build
pnpm --filter @ledgerhq/device-signer-kit-tron typecheck
pnpm --filter @ledgerhq/device-signer-kit-tron test
```

Always verify the transaction, typed data, message, or ECDH request on the
Ledger device before approving it. Hash-signing APIs cannot provide the same
on-device review as structured signing and are intentionally marked unsafe.
