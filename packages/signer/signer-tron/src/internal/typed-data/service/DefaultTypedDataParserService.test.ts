import { Nothing } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import {
  ArrayType,
  PrimitiveType,
  TypedDataValueArray,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import { DefaultTypedDataParserService } from "./DefaultTypedDataParserService";

// Canonical EIP-712 "Mail" example (reused by TIP-712).
const MAIL: TypedData = {
  domain: {
    name: "Ether Mail",
    version: "1",
    chainId: 1,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  },
  types: {
    Person: [
      { name: "name", type: "string" },
      { name: "wallets", type: "address[]" },
    ],
    Mail: [
      { name: "from", type: "Person" },
      { name: "to", type: "Person" },
      { name: "contents", type: "string" },
    ],
  },
  primaryType: "Mail",
  message: {
    from: {
      name: "Cow",
      wallets: ["0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"],
    },
    to: {
      name: "Bob",
      wallets: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"],
    },
    contents: "Hello, Bob!",
  },
};

describe("DefaultTypedDataParserService", () => {
  const parser = new DefaultTypedDataParserService();

  it("should parse the EIP-712 Mail example", () => {
    const result = parser.parse(MAIL);
    expect(result.isRight()).toBe(true);
    const { types, domain, message } = result.unsafeCoerce();

    // EIP712Domain is appended automatically from the present domain fields.
    expect(Object.keys(types).sort()).toStrictEqual([
      "EIP712Domain",
      "Mail",
      "Person",
    ]);

    // Each parsed message starts with a root value.
    expect(domain[0]!.value).toBeInstanceOf(TypedDataValueRoot);
    expect((domain[0]!.value as TypedDataValueRoot).root).toBe("EIP712Domain");
    expect(message[0]!.value).toBeInstanceOf(TypedDataValueRoot);
    expect((message[0]!.value as TypedDataValueRoot).root).toBe("Mail");

    // The message includes an array value (wallets) and encoded fields.
    expect(message.some((v) => v.value instanceof TypedDataValueArray)).toBe(
      true,
    );
    expect(message.some((v) => v.value instanceof TypedDataValueField)).toBe(
      true,
    );
  });

  it("should fail on a malformed message", () => {
    const broken = { ...MAIL, message: { from: { name: "Cow" } } };
    expect(parser.parse(broken).isLeft()).toBe(true);
  });

  it("should parse Tron trcToken fields as uint256 values", () => {
    const typedData: TypedData = {
      domain: {
        name: "TRON Mail",
        version: "1",
        chainId: 728126428,
      },
      types: {
        Asset: [
          { name: "trcTokenId", type: "trcToken" },
          { name: "trcTokenArr", type: "trcToken[]" },
        ],
      },
      primaryType: "Asset",
      message: {
        trcTokenId: "1002000",
        trcTokenArr: ["1002000", "1002001"],
      },
    };

    const result = parser.parse(typedData);

    expect(result.isRight()).toBe(true);
    const { types, message } = result.unsafeCoerce();
    expect(types["Asset"]?.["trcTokenId"]).toStrictEqual(
      new PrimitiveType("trcToken", "trcToken", Nothing),
    );
    expect(types["Asset"]?.["trcTokenArr"]).toStrictEqual(
      new ArrayType(
        "trcToken[]",
        new PrimitiveType("trcToken", "trcToken", Nothing),
        "trcToken",
        Nothing,
        [Nothing],
      ),
    );
    expect(
      message
        .filter((value) => value.value instanceof TypedDataValueField)
        .map((value) => Array.from((value.value as TypedDataValueField).data)),
    ).toStrictEqual([
      [0x0f, 0x4a, 0x10],
      [0x0f, 0x4a, 0x10],
      [0x0f, 0x4a, 0x11],
    ]);
  });
});
