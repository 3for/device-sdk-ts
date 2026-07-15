# Nile hardware-device transfer example

This example performs the complete Nile testnet flow with a physical Ledger:

1. discover and connect through Node HID;
2. derive and verify the sender address on-device;
3. ask a Nile node to create a TRX or TRC20 transaction;
4. sign the returned `raw_data_hex` with `signer-tron`;
5. attach the 65-byte signature;
6. optionally broadcast and poll for a receipt.

The `raw` source loads any complete Tron transaction JSON containing `txID`,
`raw_data`, and `raw_data_hex`, so signing is not limited to the two convenience
builders below.

## Prerequisites

- Node.js 20+ and repository dependencies installed;
- one unlocked Ledger connected over USB;
- the Tron app installed on the device;
- Nile TRX in the derived account for the transfer and network fees;
- Ledger Live and other applications that may hold the HID device closed.

The default derivation path is `44'/195'/0'/0/0`. The example displays the
derived address on the device before creating a transaction. Fund that exact
address using a Nile faucet.

## TRX transfer

The default is a dry-run: it creates and signs the transaction but does not
broadcast it.

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type trx \
  --to <NILE_RECIPIENT_ADDRESS> \
  --amount 0.1
```

After checking the dry-run, explicitly enable broadcasting:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type trx \
  --to <NILE_RECIPIENT_ADDRESS> \
  --amount 0.1 \
  --broadcast
```

## TRC20 transfer

Pass the token's **Nile** contract address and its actual decimals. Do not use a
mainnet contract address.

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type trc20 \
  --to <NILE_RECIPIENT_ADDRESS> \
  --amount 1.5 \
  --contract <NILE_TRC20_CONTRACT_ADDRESS> \
  --decimals 6 \
  --fee-limit 100000000 \
  --broadcast
```

`--amount` is expressed in TRX/token units; the example converts it to sun or
the token's integer units without using floating-point arithmetic.

## Any transaction from a JSON file

Use a complete transaction returned by a Tron node. The file's `visible` value
is preserved exactly: use Base58 addresses when it is `true` and hex addresses
when it is `false`.

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type raw \
  --transaction-file ./transaction.json
```

Add `--broadcast` only when the transaction targets Nile and has not expired:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type raw \
  --transaction-file ./transaction.json \
  --broadcast
```

For offline, malformed-transaction, APDU, or device-UI testing, pass only the
protobuf serialization of `Transaction.raw`:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type raw \
  --raw-data-hex 0a02...
```

`--transaction-file` and `--raw-data-hex` are mutually exclusive. A raw hex
input can be signed but cannot be broadcast: TronGrid broadcasting requires a
complete transaction JSON containing the decoded `raw_data` object. The CLI
rejects `--raw-data-hex --broadcast` before connecting to the device.

For every complete transaction, the CLI verifies that `txID` exactly matches
`sha256(raw_data_hex)`. A mismatch is a hard error because it means the displayed
transaction identifier is not the payload sent to the device. An expired
transaction, or one expiring within 60 seconds, produces a warning rather than
an error so expired fixtures remain usable for signing and UI tests.

## Build with any Nile transaction endpoint

Use a relative `/wallet/*` endpoint and a JSON request body to construct
transactions not covered by the TRX/TRC20 convenience builders:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type build \
  --endpoint /wallet/freezebalancev2 \
  --params ./params/freeze-balance-v2.json \
  --broadcast
```

The example includes Stake 2.0 request templates in `examples/samples/`. A bare
`--params` filename is resolved from that directory when it does not exist in
the current working directory. For example:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type build \
  --endpoint /wallet/cancelallunfreezev2 \
  --params cancel-all-unfreeze-v2.json \
  --clear-signing blind
```

Available templates are `freeze-v2.json`, `unfreeze-v2.json`, and
`cancel-all-unfreeze-v2.json`. Explicit relative and absolute paths continue to
take precedence over the bundled samples.

Except for owner-address placeholder replacement, the params file is posted
unchanged. It must use the address encoding matching its `visible` setting. Use
an owner placeholder so the request is bound to the address confirmed on the
Ledger device.

For Base58 input (`visible: true`):

```json
{
  "owner_address": "$OWNER_ADDRESS_BASE58",
  "frozen_balance": 1000000,
  "resource": "ENERGY",
  "visible": true
}
```

For 41-prefixed hex input (`visible: false`):

```json
{
  "owner_address": "$OWNER_ADDRESS_HEX",
  "frozen_balance": 1000000,
  "resource": "ENERGY",
  "visible": false
}
```

Placeholders are replaced recursively when they are the complete JSON string
value. `$OWNER_ADDRESS_HEX` includes the Tron `41` network prefix. Builder
responses are accepted whether the transaction is at the response root or in a
`transaction` field. If the node omits `visible`, the CLI copies the boolean
value from the request params; otherwise the node's response is preserved.
The CLI rejects a hex placeholder with `visible: true` and a Base58 placeholder
with `visible: false`.

For safety, `--endpoint` only accepts relative `/wallet/*` paths. Broadcast and
node-side private-key signing endpoints are rejected because signing and
broadcasting must pass through the example's shared hardware-device pipeline.

## API credentials and clear signing

Public Nile calls may work without an API key. If TronGrid rate-limits the
request, use:

```sh
export TRON_PRO_API_KEY=<your-key>
```

The signer uses `clearSigningMode: "auto"`. If your environment requires a CAL
origin token for clear-signing context lookup, set:

```sh
export LEDGER_ORIGIN_TOKEN=<your-origin-token>
```

Select the signing path explicitly when testing firmware flows:

```sh
--clear-signing auto|blind|gcs
```

The exact decision process is:

| `--clear-signing` | `--contexts-file`    | Context source                                                      | Signing path                                                                                                | Contexts sent to the selected path                                                     |
| ----------------- | -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `blind`           | Rejected by this CLI | None; context loading is skipped                                    | Traditional `INS.SIGN` (`0x04`)                                                                             | None                                                                                   |
| `gcs`             | Present              | The file, including an empty array; CAL is not queried              | `INS.SIGN_GCS` (`0xd4`), even with no usable contexts                                                       | Only non-TRC10 contexts                                                                |
| `gcs`             | Absent               | CAL; a lookup or transaction-mapping failure becomes an empty array | `INS.SIGN_GCS` (`0xd4`), even with no usable contexts                                                       | Only non-TRC10 contexts                                                                |
| `auto`            | Present              | The file, including an empty array; CAL is not queried              | `INS.SIGN_GCS` (`0xd4`) if at least one non-TRC10 context exists; otherwise traditional `INS.SIGN` (`0x04`) | GCS receives only non-TRC10 contexts; traditional signing receives only TRC10 contexts |
| `auto`            | Absent               | CAL; a lookup or transaction-mapping failure becomes an empty array | `INS.SIGN_GCS` (`0xd4`) if at least one non-TRC10 context exists; otherwise traditional `INS.SIGN` (`0x04`) | GCS receives only non-TRC10 contexts; traditional signing receives only TRC10 contexts |

Here, a "GCS context" means any supported Tron clear-signing context whose
type is not `TRC10_TOKEN`. Consequently, a mixed list containing TRC10 and GCS
contexts selects the GCS path and only the non-TRC10 contexts are provided to
that path. With `auto`, an empty list or a TRC10-only list selects the
traditional path.

Pass explicit contexts as a JSON array:

```sh
pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- \
  --type raw \
  --transaction-file ./transaction.json \
  --clear-signing gcs \
  --contexts-file ./contexts.json
```

An explicit contexts file replaces CAL lookup, including when the file contains
an empty array. `--contexts-file` is rejected with `--clear-signing blind`
because the signer library would otherwise silently ignore it. Context payloads
used on physical devices must still carry metadata/signatures trusted by the
Tron application.

Run
`pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --help` for all
options, including a custom Nile-compatible API URL and derivation path.

## Safety notes

- Broadcasting is opt-in through `--broadcast`.
- Verify the recipient, amount, and token contract on the device.
- This is testnet-only sample code. It intentionally defaults to the Nile URL.
- A transaction created by a Tron node expires, so sign and broadcast it without
  a long delay.
