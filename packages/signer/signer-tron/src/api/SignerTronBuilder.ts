import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type TronContextModule } from "@api/model/TronContextModule";
import { EmptyTronContextModule } from "@internal/context/EmptyTronContextModule";
import { DefaultSignerTron } from "@internal/DefaultSignerTron";

type SignerTronBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerTron` class.
 */
export class SignerTronBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private _customContextModule: TronContextModule | undefined;

  constructor({ dmk, sessionId }: SignerTronBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Override the default context module.
   *
   * This is the development hook for fixture/mock clear-signing contexts until
   * Tron contexts are available from the official context module.
   */
  withContextModule(contextModule: TronContextModule) {
    this._customContextModule = contextModule;
    return this;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerTron({
      dmk: this._dmk,
      sessionId: this._sessionId,
      contextModule: this._customContextModule ?? new EmptyTronContextModule(),
    });
  }
}
