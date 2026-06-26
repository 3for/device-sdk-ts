import { inject, injectable } from "inversify";

import { type SignTypedDataHashDAReturnType } from "@api/app-binder/SignTypedDataHashDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignTypedDataHashUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
  ) {}

  execute(
    derivationPath: string,
    domainHash: Uint8Array,
    messageHash: Uint8Array,
  ): SignTypedDataHashDAReturnType {
    return this.appBinder.signTypedDataHash({
      derivationPath,
      domainHash,
      messageHash,
    });
  }
}
