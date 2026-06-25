import { inject, injectable } from "inversify";

import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignTransactionHashUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
  ) {}

  execute(
    derivationPath: string,
    hash: Uint8Array,
  ): SignTransactionHashDAReturnType {
    return this.appBinder.signTransactionHash({ derivationPath, hash });
  }
}
