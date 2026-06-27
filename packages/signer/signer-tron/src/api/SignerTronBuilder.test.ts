import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { type TronContextModule } from "@api/model/TronContextModule";
import { SignerTronBuilder } from "@api/SignerTronBuilder";
import { DefaultTronContextModule } from "@internal/context/DefaultTronContextModule";
import { DefaultSignerTron } from "@internal/DefaultSignerTron";
import { externalTypes } from "@internal/externalTypes";

describe("SignerTronBuilder", () => {
  const dmk: DeviceManagementKit = {} as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerTronBuilder", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);

    builder.build();

    expect(builder).toBeInstanceOf(SignerTronBuilder);
  });

  test("should instantiate with default context module", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);

    const signer = builder.build();
    const contextModule = signer["_container"].get<TronContextModule>(
      externalTypes.ContextModule,
    );

    expect(signer).toBeInstanceOf(DefaultSignerTron);
    expect(contextModule).toBeInstanceOf(DefaultTronContextModule);
  });

  test("should instantiate with custom context module", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);
    const contextModule: TronContextModule = {
      getContexts: vi.fn(),
    };

    const signer = builder.withContextModule(contextModule).build();

    expect(signer).toBeInstanceOf(DefaultSignerTron);
    expect(
      signer["_container"].get<TronContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });
});
