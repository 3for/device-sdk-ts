# Nile hardware-device transfer example

This example performs the complete Nile testnet flow with a physical Ledger:

1. discover and connect through Node HID;
2. derive and verify the sender address on-device;
3. ask a Nile node to create a TRX or TRC20 transaction;
4. sign the returned `raw_data_hex` with `signer-tron`;
5. attach the 65-byte signature;
6. optionally broadcast and poll for a receipt.

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

Run
`pnpm --filter @ledgerhq/device-signer-kit-tron example:nile -- --help` for all
options, including a custom Nile-compatible API URL and derivation path.

## Safety notes

- Broadcasting is opt-in through `--broadcast`.
- Verify the recipient, amount, and token contract on the device.
- This is testnet-only sample code. It intentionally defaults to the Nile URL.
- A transaction created by a Tron node expires, so sign and broadcast it without
  a long delay.
