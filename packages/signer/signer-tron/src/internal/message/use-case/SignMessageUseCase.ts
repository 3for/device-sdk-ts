import { inject, injectable } from "inversify";

import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type MessageOptions } from "@api/model/MessageOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignMessageUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
  ) {}

  execute(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    const bytes =
      typeof message === "string" ? new TextEncoder().encode(message) : message;
    return this.appBinder.signMessage({
      derivationPath,
      message: bytes,
      fullDisplay: options?.fullDisplay ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
