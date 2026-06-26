import { inject, injectable } from "inversify";

import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataOptions } from "@api/model/TypedDataOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

@injectable()
export class SignTypedDataUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
    @inject(typedDataTypes.TypedDataParserService)
    private readonly parser: TypedDataParserService,
  ) {}

  execute(
    derivationPath: string,
    data: TypedData,
    options?: TypedDataOptions,
  ): SignTypedDataDAReturnType {
    return this.appBinder.signTypedData({
      derivationPath,
      data,
      parser: this.parser,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
