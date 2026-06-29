import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { type SignerTron } from "@ledgerhq/device-signer-kit-tron";
import { injectable } from "inversify";

import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  type SigningService,
  type SigningServiceResult,
} from "@root/src/domain/services/SigningService";

/**
 * Tron signing service. The `rawTx` field carries the protobuf `raw_data` as a
 * hex string (what a Tron node returns as `raw_data_hex` and what the device
 * signs); no crafting step is required. Clear-signing contexts (TRC10/TRC20/
 * GTP/GCS) are resolved by the signer's default Tron context module from CAL.
 */
@injectable()
export class TronSigningService implements SigningService {
  private signer: SignerTron | null = null;

  setSigner(signer: SignerTron): void {
    this.signer = signer;
  }

  sign(input: SignableInput, derivationPath: string): SigningServiceResult {
    if (!this.signer) {
      throw new Error("Signer not initialized. Call setSigner() first.");
    }

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        const rawData = hexaStringToBuffer(input.rawTx);
        if (!rawData) {
          throw new Error("Invalid hex transaction data (raw_data).");
        }
        return this.signer.signTransaction(derivationPath, rawData, {
          skipOpenApp: true,
          clearSigningMode: "auto",
        }) as SigningServiceResult;
      }
      case SignableInputKind.TypedData:
        throw new Error(
          "TypedData signing is not supported by the Tron tester. Only transaction signing is available.",
        );
    }
  }
}
