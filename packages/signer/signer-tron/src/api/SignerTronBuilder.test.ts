import {
  type ContextModule,
  DefaultContextModule,
} from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerTronBuilder } from "@api/SignerTronBuilder";
import { DefaultSignerTron } from "@internal/DefaultSignerTron";
import { externalTypes } from "@internal/externalTypes";

describe("SignerTronBuilder", () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  };
  const dmk: DeviceManagementKit = {
    getLoggerFactory: () => () => logger,
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerTronBuilder", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);

    builder.build();

    expect(builder).toBeInstanceOf(SignerTronBuilder);
  });

  test("should instantiate with default context module", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);

    const signer = builder.build();
    const contextModule = signer["_container"].get<ContextModule>(
      externalTypes.ContextModule,
    );

    expect(signer).toBeInstanceOf(DefaultSignerTron);
    expect(contextModule).toBeInstanceOf(DefaultContextModule);
  });

  test("should instantiate with custom context module", () => {
    const builder = new SignerTronBuilder(defaultConstructorArgs);
    const contextModule: ContextModule = {
      getContexts: vi.fn(),
      getFieldContext: vi.fn(),
      getTypedDataFilters: vi.fn(),
      report: vi.fn(),
    };

    const signer = builder.withContextModule(contextModule).build();

    expect(signer).toBeInstanceOf(DefaultSignerTron);
    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });
});
