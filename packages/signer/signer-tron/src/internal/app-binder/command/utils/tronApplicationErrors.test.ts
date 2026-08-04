import { TRON_APP_ERRORS, type TronErrorCodes } from "./tronApplicationErrors";

const EXPECTED_STATUS_WORDS = [
  "6700",
  "6980",
  "6982",
  "6984",
  "6985",
  "6a00",
  "6a80",
  "6a84",
  "6a87",
  "6a88",
  "6a8a",
  "6a8b",
  "6a8c",
  "6a8d",
  "6a8e",
  "6b00",
  "6d00",
  "6e00",
] as const satisfies readonly TronErrorCodes[];

describe("TRON_APP_ERRORS", () => {
  it("covers every status word returned by app-tron", () => {
    expect(Object.keys(TRON_APP_ERRORS).sort()).toStrictEqual(
      [...EXPECTED_STATUS_WORDS].sort(),
    );
  });

  it.each([
    ["6980", "Command not allowed"],
    ["6a00", "Parameter error without information"],
    ["6a84", "Insufficient memory"],
    ["6a88", "Referenced data not found"],
  ] as const)("maps %s to its app-tron meaning", (statusWord, message) => {
    expect(TRON_APP_ERRORS[statusWord]).toStrictEqual({ message });
  });
});
