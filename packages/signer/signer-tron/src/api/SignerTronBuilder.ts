import {
  type ContextModule,
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerTron } from "@internal/DefaultSignerTron";

type SignerTronBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  originToken?: string;
};

/**
 * Builder for the `SignerTron` class.
 */
export class SignerTronBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private readonly _originToken: string | undefined;
  private _customContextModule: ContextModule | undefined;

  constructor({
    dmk,
    sessionId,
    originToken,
  }: SignerTronBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._originToken = originToken;
  }

  /**
   * Override the default context module.
   *
   * This is the development hook for fixture/mock clear-signing contexts until
   * Tron contexts are available from the official context module.
   */
  withContextModule(contextModule: ContextModule) {
    this._customContextModule = contextModule;
    return this;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    const contextModule =
      this._customContextModule ??
      new ContextModuleBuilder({
        originToken: this._originToken,
        loggerFactory: (tag: string) =>
          this._dmk.getLoggerFactory()(["ContextModule", tag]),
      })
        .setChain(ContextModuleChainID.Tron)
        .build();

    return new DefaultSignerTron({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule,
    });
  }
}
