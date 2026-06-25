import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

import { encodeBase58Check } from "@internal/shared/utils/Base58Check";
import {
  type TransactionSubset,
  type TronContract,
  TronContractType,
} from "@internal/transaction/model/TransactionSubset";
import {
  ProtobufReader,
  WireType,
} from "@internal/transaction/service/ProtobufReader";
import { type TronTransactionMapperService } from "@internal/transaction/service/TronTransactionMapperService";

// raw_data field numbers (proto/core/Tron.proto -> Transaction.raw)
const RAW_REF_BLOCK_BYTES = 1;
const RAW_REF_BLOCK_HASH = 4;
const RAW_EXPIRATION = 8;
const RAW_DATA_MEMO = 10;
const RAW_CONTRACT = 11;
const RAW_TIMESTAMP = 14;
const RAW_FEE_LIMIT = 18;

// Transaction.Contract field numbers
const CONTRACT_TYPE = 1;
const CONTRACT_PARAMETER = 2;

// google.protobuf.Any field numbers
const ANY_TYPE_URL = 1;
const ANY_VALUE = 2;

function toHex(bytes: Uint8Array): string {
  return bufferToHexaString(bytes).slice(2); // strip "0x"
}

function toBase58(addressBytes: Uint8Array): string {
  return encodeBase58Check(addressBytes);
}

@injectable()
export class DefaultTronTransactionMapperService
  implements TronTransactionMapperService
{
  map(rawData: Uint8Array): TransactionSubset {
    const reader = new ProtobufReader(rawData);
    const contracts: TronContract[] = [];
    let refBlockBytes: string | undefined;
    let refBlockHash: string | undefined;
    let expiration: bigint | undefined;
    let timestamp: bigint | undefined;
    let feeLimit: bigint | undefined;
    let memo: string | undefined;

    while (!reader.eof) {
      const { field, wire } = reader.tag();
      switch (field) {
        case RAW_REF_BLOCK_BYTES:
          refBlockBytes = toHex(reader.bytes());
          break;
        case RAW_REF_BLOCK_HASH:
          refBlockHash = toHex(reader.bytes());
          break;
        case RAW_EXPIRATION:
          expiration = reader.varint();
          break;
        case RAW_DATA_MEMO:
          memo = new TextDecoder().decode(reader.bytes());
          break;
        case RAW_CONTRACT:
          contracts.push(this.decodeContract(reader.bytes()));
          break;
        case RAW_TIMESTAMP:
          timestamp = reader.varint();
          break;
        case RAW_FEE_LIMIT:
          feeLimit = reader.varint();
          break;
        default:
          reader.skip(wire);
      }
    }

    return {
      contracts,
      refBlockBytes,
      refBlockHash,
      expiration,
      timestamp,
      feeLimit,
      memo,
    };
  }

  private decodeContract(buf: Uint8Array): TronContract {
    const reader = new ProtobufReader(buf);
    let type = TronContractType.AccountCreateContract;
    let typeUrl: string | undefined;
    let value: Uint8Array = new Uint8Array(0);

    while (!reader.eof) {
      const { field, wire } = reader.tag();
      if (field === CONTRACT_TYPE && wire === WireType.VARINT) {
        type = Number(reader.varint()) as TronContractType;
      } else if (
        field === CONTRACT_PARAMETER &&
        wire === WireType.LENGTH_DELIMITED
      ) {
        const any = this.decodeAny(reader.bytes());
        typeUrl = any.typeUrl;
        value = any.value;
      } else {
        reader.skip(wire);
      }
    }

    return {
      type,
      typeName: TronContractType[type] ?? `Unknown(${type})`,
      typeUrl,
      raw: value,
      ...this.decodeContractFields(type, value),
    };
  }

  private decodeAny(buf: Uint8Array): {
    typeUrl?: string;
    value: Uint8Array;
  } {
    const reader = new ProtobufReader(buf);
    let typeUrl: string | undefined;
    let value: Uint8Array = new Uint8Array(0);
    while (!reader.eof) {
      const { field, wire } = reader.tag();
      if (field === ANY_TYPE_URL && wire === WireType.LENGTH_DELIMITED) {
        typeUrl = new TextDecoder().decode(reader.bytes());
      } else if (field === ANY_VALUE && wire === WireType.LENGTH_DELIMITED) {
        value = reader.bytes();
      } else {
        reader.skip(wire);
      }
    }
    return { typeUrl, value };
  }

  /** Surface well-known fields for the common contracts. */
  private decodeContractFields(
    type: TronContractType,
    value: Uint8Array,
  ): Partial<TronContract> {
    switch (type) {
      case TronContractType.TransferContract:
        // owner_address=1, to_address=2, amount=3
        return this.decodeTransfer(value);
      case TronContractType.TriggerSmartContract:
        return this.decodeTriggerSmartContract(value);
      default:
        // Other contracts (incl. TransferAssetContract, which uses a different
        // field layout) are exposed via `raw` for now; decoders are added per
        // contract as later phases need them.
        return {};
    }
  }

  private decodeTransfer(buf: Uint8Array): Partial<TronContract> {
    const reader = new ProtobufReader(buf);
    const out: { ownerAddress?: string; toAddress?: string; amount?: bigint } =
      {};
    while (!reader.eof) {
      const { field, wire } = reader.tag();
      // TransferContract: owner_address=1, to_address=2, amount=3
      // TransferAssetContract: asset_name=1, owner_address=2, to_address=3, amount=4
      if (field === 1 && wire === WireType.LENGTH_DELIMITED) {
        out.ownerAddress = toBase58(reader.bytes());
      } else if (field === 2 && wire === WireType.LENGTH_DELIMITED) {
        out.toAddress = toBase58(reader.bytes());
      } else if (field === 3 && wire === WireType.VARINT) {
        out.amount = reader.varint();
      } else {
        reader.skip(wire);
      }
    }
    return out;
  }

  private decodeTriggerSmartContract(buf: Uint8Array): Partial<TronContract> {
    const reader = new ProtobufReader(buf);
    const out: {
      ownerAddress?: string;
      contractAddress?: string;
      callValue?: bigint;
      data?: string;
    } = {};
    while (!reader.eof) {
      const { field, wire } = reader.tag();
      // owner_address=1, contract_address=2, call_value=3, data=4
      if (field === 1 && wire === WireType.LENGTH_DELIMITED) {
        out.ownerAddress = toBase58(reader.bytes());
      } else if (field === 2 && wire === WireType.LENGTH_DELIMITED) {
        out.contractAddress = toBase58(reader.bytes());
      } else if (field === 3 && wire === WireType.VARINT) {
        out.callValue = reader.varint();
      } else if (field === 4 && wire === WireType.LENGTH_DELIMITED) {
        out.data = toHex(reader.bytes());
      } else {
        reader.skip(wire);
      }
    }
    return out;
  }
}
