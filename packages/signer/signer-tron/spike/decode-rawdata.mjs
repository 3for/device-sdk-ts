// Phase 1 protobuf spike — zero-dependency proof that we can decode a Tron
// `raw_data` payload (what the host passes to signTransaction) into the subset
// signer-tron needs. Validates: wire format, Any dispatch by Contract.type,
// type_url namespace, and Base58Check address derivation.
//
// Run: node packages/signer/signer-tron/spike/decode-rawdata.mjs
import { createHash } from "node:crypto";
import assert from "node:assert";

// --- minimal protobuf reader (length-delimited message) -------------------
class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  get eof() {
    return this.pos >= this.buf.length;
  }
  varint() {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const b = this.buf[this.pos++];
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
    }
    return result;
  }
  // returns { field, wire }
  tag() {
    const t = this.varint();
    return { field: Number(t >> 3n), wire: Number(t & 0x7n) };
  }
  bytes() {
    const len = Number(this.varint());
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  // skip an unknown field by wire type
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 2) this.bytes();
    else if (wire === 5) this.pos += 4;
    else if (wire === 1) this.pos += 8;
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

// --- Base58Check (Tron T... address) --------------------------------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58check(payload21) {
  // payload21 = 0x41-prefixed 21 bytes; append 4-byte double-sha256 checksum
  const h1 = createHash("sha256").update(payload21).digest();
  const h2 = createHash("sha256").update(h1).digest();
  const full = Buffer.concat([payload21, h2.subarray(0, 4)]);
  // base58 encode
  let num = BigInt("0x" + full.toString("hex"));
  let out = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    out = B58[rem] + out;
  }
  for (const b of full) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

// --- ContractType enum (from proto/core/Tron.proto) -----------------------
const ContractType = {
  1: "TransferContract",
  2: "TransferAssetContract",
  31: "TriggerSmartContract",
};

// --- decoders for the contract messages we need in the subset -------------
function decodeTransferContract(buf) {
  const r = new Reader(buf);
  const out = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === 2)
      out.ownerAddress = Buffer.from(r.bytes()).toString("hex");
    else if (field === 2 && wire === 2)
      out.toAddress = Buffer.from(r.bytes()).toString("hex");
    else if (field === 3 && wire === 0) out.amount = r.varint().toString();
    else r.skip(wire);
  }
  return out;
}
function decodeTriggerSmartContract(buf) {
  const r = new Reader(buf);
  const out = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === 2)
      out.ownerAddress = Buffer.from(r.bytes()).toString("hex");
    else if (field === 2 && wire === 2)
      out.contractAddress = Buffer.from(r.bytes()).toString("hex");
    else if (field === 3 && wire === 0) out.callValue = r.varint().toString();
    else if (field === 4 && wire === 2)
      out.data = Buffer.from(r.bytes()).toString("hex"); // EVM calldata
    else r.skip(wire);
  }
  return out;
}

// --- decode google.protobuf.Any -> { typeUrl, value } ---------------------
function decodeAny(buf) {
  const r = new Reader(buf);
  const any = {};
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === 2)
      any.typeUrl = Buffer.from(r.bytes()).toString("utf8");
    else if (field === 2 && wire === 2) any.value = Buffer.from(r.bytes());
    else r.skip(wire);
  }
  return any;
}

// --- decode Transaction.raw (the raw_data the host passes) ----------------
function decodeRawData(hex) {
  const r = new Reader(Buffer.from(hex, "hex"));
  const tx = { contracts: [] };
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1:
        tx.refBlockBytes = Buffer.from(r.bytes()).toString("hex");
        break; // ref_block_bytes
      case 4:
        tx.refBlockHash = Buffer.from(r.bytes()).toString("hex");
        break; // ref_block_hash
      case 8:
        tx.expiration = r.varint().toString();
        break;
      case 10:
        tx.data = Buffer.from(r.bytes()).toString("utf8");
        break; // memo/data
      case 11: {
        // contract (repeated Contract)
        const c = new Reader(r.bytes());
        const contract = {};
        while (!c.eof) {
          const { field: cf, wire: cw } = c.tag();
          if (cf === 1 && cw === 0) contract.type = Number(c.varint());
          else if (cf === 2 && cw === 2)
            contract.parameter = decodeAny(c.bytes());
          else c.skip(cw);
        }
        tx.contracts.push(contract);
        break;
      }
      case 14:
        tx.timestamp = r.varint().toString();
        break;
      case 18:
        tx.feeLimit = r.varint().toString();
        break;
      default:
        r.skip(wire);
    }
  }
  return tx;
}

// --- mapper: raw_data hex -> subset (what TronTransactionMapperService does) -
function toSubset(hex) {
  const raw = decodeRawData(hex);
  const subset = { contracts: [] };
  for (const c of raw.contracts) {
    const typeName = ContractType[c.type] ?? `Unknown(${c.type})`;
    const entry = { type: typeName, typeUrl: c.parameter?.typeUrl };
    if (typeName === "TransferContract") {
      const t = decodeTransferContract(c.parameter.value);
      entry.from = base58check(Buffer.from(t.ownerAddress, "hex"));
      entry.to = base58check(Buffer.from(t.toAddress, "hex"));
      entry.amount = t.amount;
    } else if (typeName === "TriggerSmartContract") {
      const t = decodeTriggerSmartContract(c.parameter.value);
      entry.from = base58check(Buffer.from(t.ownerAddress, "hex"));
      entry.contractAddress = base58check(
        Buffer.from(t.contractAddress, "hex"),
      );
      entry.callValue = t.callValue;
      entry.calldata = t.data; // 4-byte selector + ABI args (EVM calldata for GCS)
    }
    subset.contracts.push(entry);
  }
  return { raw, subset };
}

// === run against the real vector (hw-app-trx Trx.test.ts signTransaction) ===
const VECTOR =
  "0a023dce220895da42177db0050740d8e0a5feed2d522c43727970746f436861696e2d54726f6e5352204c6564676572205472616e73616374696f6e732054657374735a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541c8599111f29c1e1e061265b4af93ea1f274ad78a1880c2d72f709d94a2feed2d";

const { raw, subset } = toSubset(VECTOR);
console.log("=== decoded raw_data ===");
console.log(JSON.stringify(raw, null, 2));
console.log("=== mapped subset ===");
console.log(JSON.stringify(subset, null, 2));

// === assertions: prove our understanding is correct ===
const c0 = subset.contracts[0];
assert.equal(subset.contracts.length, 1, "one contract");
assert.equal(c0.type, "TransferContract", "dispatched by Contract.type enum");
assert.equal(
  c0.typeUrl,
  "type.googleapis.com/protocol.TransferContract",
  "type_url namespace = type.googleapis.com/protocol.<Msg>",
);
assert.ok(
  c0.from.startsWith("T") && c0.from.length === 34,
  "from is 34-char Base58Check",
);
assert.ok(
  c0.to.startsWith("T") && c0.to.length === 34,
  "to is 34-char Base58Check",
);
assert.equal(
  raw.data,
  "CryptoChain-TronSR Ledger Transactions Tests",
  "memo decoded",
);
console.log(
  "\n✅ ALL ASSERTIONS PASSED — wire format, Any dispatch, type_url & Base58Check confirmed",
);
