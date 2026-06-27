import { GetECDHPairKeyUseCase } from "@internal/ecdh/use-case/GetECDHPairKeyUseCase";

const PUBLIC_KEY =
  "04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83";

type GetECDHPairKeyArgs = {
  derivationPath: string;
  publicKey: Uint8Array;
  skipOpenApp: boolean;
};

describe("GetECDHPairKeyUseCase", () => {
  it("should validate and forward the ECDH public key to the app binder", () => {
    let capturedArgs: GetECDHPairKeyArgs | undefined;
    const getECDHPairKey = vi.fn((args: GetECDHPairKeyArgs) => {
      capturedArgs = args;
      return { observable: {} };
    });
    const useCase = new GetECDHPairKeyUseCase({
      getECDHPairKey,
    } as never);

    const result = useCase.execute("44'/195'/0'/0/0", PUBLIC_KEY, {
      skipOpenApp: true,
    });

    expect(result).toStrictEqual({ observable: {} });
    expect(capturedArgs).toBeDefined();
    if (capturedArgs === undefined) {
      throw new Error("Expected ECDH pair key args to be captured");
    }
    expect(capturedArgs.derivationPath).toBe("44'/195'/0'/0/0");
    expect(capturedArgs.publicKey).toBeInstanceOf(Uint8Array);
    expect(capturedArgs.publicKey).toHaveLength(65);
    expect(capturedArgs.skipOpenApp).toBe(true);
  });

  it("should reject a malformed ECDH public key", () => {
    const useCase = new GetECDHPairKeyUseCase({
      getECDHPairKey: vi.fn(),
    } as never);

    expect(() => useCase.execute("44'/195'/0'/0/0", "0x1234")).toThrow(
      "ECDH public key must be a 65-byte uncompressed secp256k1 public key",
    );
    expect(() =>
      useCase.execute("44'/195'/0'/0/0", Uint8Array.from([0x02])),
    ).toThrow(
      "ECDH public key must be a 65-byte uncompressed secp256k1 public key",
    );
  });
});
