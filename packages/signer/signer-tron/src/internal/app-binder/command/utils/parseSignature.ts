import {
  type ApduParser,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

import { type TronErrorCodes } from "./tronApplicationErrors";

const R_LENGTH = 32;
const S_LENGTH = 32;

/**
 * Parse a Tron device signature: r (32) || s (32) || v (1, recovery parity).
 * See app-tron helpers.c `signTransaction`.
 */
export function parseSignature(
  parser: ApduParser,
): CommandResult<Signature, TronErrorCodes> {
  const r = parser.extractFieldByLength(R_LENGTH);
  if (r === undefined || r.length !== R_LENGTH) {
    return CommandResultFactory({
      error: new InvalidStatusWordError("Signature r is missing or malformed"),
    });
  }

  const s = parser.extractFieldByLength(S_LENGTH);
  if (s === undefined || s.length !== S_LENGTH) {
    return CommandResultFactory({
      error: new InvalidStatusWordError("Signature s is missing or malformed"),
    });
  }

  const v = parser.extract8BitUInt();
  if (v === undefined) {
    return CommandResultFactory({
      error: new InvalidStatusWordError("Signature v is missing"),
    });
  }

  return CommandResultFactory({
    data: {
      r: parser.encodeToHexaString(r, true),
      s: parser.encodeToHexaString(s, true),
      v,
    },
  });
}
