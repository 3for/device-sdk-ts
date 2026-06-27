import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
  ) {}

  execute(
    derivationPath: string,
    rawData: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      rawData,
      options: {
        skipOpenApp: options?.skipOpenApp ?? false,
        clearSigningMode: options?.clearSigningMode ?? "auto",
        contexts: options?.contexts,
      },
    });
  }
}
