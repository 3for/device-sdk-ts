import { Just, Nothing } from "purify-ts";

import { PrimitiveType, StructType } from "@internal/typed-data/model/Types";

import {
  SendTIP712StructDefinitionCommand,
  StructDefinitionCommand,
} from "./SendTIP712StructDefinitionCommand";

describe("SendTIP712StructDefinitionCommand", () => {
  it("should encode a struct name (P2=0x00)", () => {
    const raw = new SendTIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Name,
      name: "Mail",
    })
      .getApdu()
      .getRawApdu();
    // cla, ins, p1, p2=Name(0x00)
    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x1a, 0x00, 0x00]);
    // data = "Mail"
    expect(Buffer.from(raw.slice(5)).toString("ascii")).toBe("Mail");
  });

  it("should encode a uint256 field (P2=0xFF) with type descriptor + size + name", () => {
    const raw = new SendTIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Field,
      name: "amount",
      // uint256 -> name "uint", size 32 bytes
      type: new PrimitiveType("uint256", "uint", Just(32)),
    })
      .getApdu()
      .getRawApdu();
    expect(Array.from(raw.slice(0, 4))).toStrictEqual([0xe0, 0x1a, 0x00, 0xff]);
    // type descriptor: hasTypeSize(bit6)=1 | Uint(2) = 0x42
    const data = raw.slice(5);
    expect(data[0]).toBe(0x42);
    // size byte = 32
    expect(data[1]).toBe(32);
    // LV-encoded field name "amount" (len 6 then ascii)
    expect(data[2]).toBe(6);
    expect(Buffer.from(data.slice(3, 9)).toString("ascii")).toBe("amount");
  });

  it("should encode a custom struct field (P2=0xFF) with custom name", () => {
    const raw = new SendTIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Field,
      name: "from",
      type: new StructType("Person"),
    })
      .getApdu()
      .getRawApdu();
    const data = raw.slice(5);
    // type descriptor: Custom(0) with no size/array = 0x00
    expect(data[0]).toBe(0x00);
    // LV custom type name "Person"
    expect(data[1]).toBe(6);
    expect(Buffer.from(data.slice(2, 8)).toString("ascii")).toBe("Person");
  });

  it("should not carry a size for dynamic bytes", () => {
    const raw = new SendTIP712StructDefinitionCommand({
      command: StructDefinitionCommand.Field,
      name: "data",
      type: new PrimitiveType("bytes", "bytes", Nothing),
    })
      .getApdu()
      .getRawApdu();
    const data = raw.slice(5);
    // DynamicSizedBytes(7), no size bit -> 0x07
    expect(data[0]).toBe(0x07);
    // next is LV field name (len 4)
    expect(data[1]).toBe(4);
  });
});
