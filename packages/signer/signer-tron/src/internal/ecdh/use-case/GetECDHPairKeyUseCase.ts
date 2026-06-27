import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetECDHPairKeyDAReturnType } from "@api/app-binder/GetECDHPairKeyDeviceActionTypes";
import { type ECDHOptions } from "@api/model/ECDHOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

const ECDH_PUBLIC_KEY_LENGTH = 65;
const UNCOMPRESSED_PUBLIC_KEY_PREFIX = 0x04;

@injectable()
export class GetECDHPairKeyUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private readonly appBinder: TronAppBinder,
  ) {}

  execute(
    derivationPath: string,
    publicKey: string | Uint8Array,
    options?: ECDHOptions,
  ): GetECDHPairKeyDAReturnType {
    const publicKeyBuffer =
      typeof publicKey === "string"
        ? hexaStringToBuffer(publicKey)
        : new Uint8Array(publicKey);

    if (
      publicKeyBuffer === null ||
      publicKeyBuffer.length !== ECDH_PUBLIC_KEY_LENGTH ||
      publicKeyBuffer[0] !== UNCOMPRESSED_PUBLIC_KEY_PREFIX
    ) {
      throw new Error(
        "ECDH public key must be a 65-byte uncompressed secp256k1 public key",
      );
    }

    return this.appBinder.getECDHPairKey({
      derivationPath,
      publicKey: publicKeyBuffer,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
