import {
  type Command,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Left, Right } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import { InitTIP712Command } from "@internal/app-binder/command/InitTIP712Command";
import { SignTIP712Command } from "@internal/app-binder/command/SignTIP712Command";
import {
  PrimitiveType,
  TypedDataValueArray,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";
import {
  type ParsedTypedData,
  type TypedDataParserService,
} from "@internal/typed-data/service/TypedDataParserService";

import { SignTypedDataTask } from "./SignTypedDataTask";

const SIGNATURE = {
  r: `0x${"01".repeat(32)}`,
  s: `0x${"02".repeat(32)}`,
  v: 0,
};

const DERIVATION_PATH = "44'/195'/0'/0/0";
const fieldType = new PrimitiveType("uint256", "uint", Just(256));

// types intentionally unsorted to prove the task sorts struct names.
const PARSED: ParsedTypedData = {
  types: {
    Zeta: { a: fieldType },
    Alpha: { b: fieldType },
  },
  domain: [{ path: "", type: "", value: new TypedDataValueRoot("Mail") }],
  message: [
    { path: "", type: "", value: new TypedDataValueArray(2) },
    {
      path: "",
      type: "",
      value: new TypedDataValueField(Uint8Array.from([0xde, 0xad])),
    },
  ],
};

const makeApi = (sent: Command<unknown, unknown, unknown>[]): InternalApi =>
  ({
    sendCommand: vi.fn((command: Command<unknown, unknown, unknown>) => {
      sent.push(command);
      if (command instanceof SignTIP712Command) {
        return Promise.resolve(CommandResultFactory({ data: SIGNATURE }));
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    }),
  }) as unknown as InternalApi;

const parserReturning = (
  value: ReturnType<TypedDataParserService["parse"]>,
): TypedDataParserService => ({ parse: vi.fn(() => value) });

describe("SignTypedDataTask", () => {
  it("initializes, streams sorted struct defs and implementations, then signs", async () => {
    const sent: Command<unknown, unknown, unknown>[] = [];
    const api = makeApi(sent);

    const result = await new SignTypedDataTask(api, {
      derivationPath: DERIVATION_PATH,
      data: {} as TypedData,
      parser: parserReturning(Right(PARSED)),
    }).run();

    // INIT locks the signing path first. Struct defs follow (Alpha before Zeta),
    // each name followed by its fields; then implementations and the final sign.
    expect(sent.map((c) => c.constructor.name)).toStrictEqual([
      "InitTIP712Command",
      "SendTIP712StructDefinitionCommand", // Alpha (name)
      "SendTIP712StructDefinitionCommand", // Alpha.b (field)
      "SendTIP712StructDefinitionCommand", // Zeta (name)
      "SendTIP712StructDefinitionCommand", // Zeta.a (field)
      "SendTIP712StructImplemCommand", // domain root
      "SendTIP712StructImplemCommand", // message array
      "SendTIP712StructImplemCommand", // message field
      "SignTIP712Command",
    ]);
    expect(sent[0]!.getApdu().getRawApdu().slice(5)).toStrictEqual(
      sent.at(-1)!.getApdu().getRawApdu().slice(5),
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(SIGNATURE);
    }
  });

  it("short-circuits when session initialization is rejected", async () => {
    const sent: Command<unknown, unknown, unknown>[] = [];
    const api = {
      sendCommand: vi.fn((command: Command<unknown, unknown, unknown>) => {
        sent.push(command);
        return Promise.resolve(
          CommandResultFactory({
            error: new Error("rejected") as never,
          }),
        );
      }),
    } as unknown as InternalApi;

    const result = await new SignTypedDataTask(api, {
      derivationPath: DERIVATION_PATH,
      data: {} as TypedData,
      parser: parserReturning(Right(PARSED)),
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(InitTIP712Command);
  });

  it("returns an error and sends nothing when parsing fails", async () => {
    const sent: Command<unknown, unknown, unknown>[] = [];
    const api = makeApi(sent);

    const result = await new SignTypedDataTask(api, {
      derivationPath: DERIVATION_PATH,
      data: {} as TypedData,
      parser: parserReturning(Left(new Error("cannot parse"))),
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("short-circuits when a struct definition is rejected", async () => {
    const sent: Command<unknown, unknown, unknown>[] = [];
    const api = {
      sendCommand: vi.fn((command: Command<unknown, unknown, unknown>) => {
        sent.push(command);
        if (command instanceof InitTIP712Command) {
          return Promise.resolve(CommandResultFactory({ data: undefined }));
        }
        return Promise.resolve(
          CommandResultFactory({
            error: new Error("rejected") as never,
          }),
        );
      }),
    } as unknown as InternalApi;

    const result = await new SignTypedDataTask(api, {
      derivationPath: DERIVATION_PATH,
      data: {} as TypedData,
      parser: parserReturning(Right(PARSED)),
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sent).toHaveLength(2); // INIT, then the first failing struct def
  });
});
