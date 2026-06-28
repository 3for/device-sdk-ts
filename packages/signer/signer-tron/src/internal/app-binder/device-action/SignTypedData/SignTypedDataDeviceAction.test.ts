import {
  CommandResultFactory,
  DeviceActionStatus,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { type SignTypedDataDAInput } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { SignTypedDataDeviceAction } from "./SignTypedDataDeviceAction";

const SIGNATURE: Signature = {
  r: "0x01",
  s: "0x02",
  v: 0,
};

const INPUT: SignTypedDataDAInput = {
  derivationPath: "44'/195'/0'/0/0",
  data: {
    primaryType: "Mail",
    types: {},
    domain: {},
    message: {},
  } as TypedData,
  parser: { parse: vi.fn() } as unknown as TypedDataParserService,
  skipOpenApp: true,
};

describe("SignTypedDataDeviceAction", () => {
  const signTypedDataMock = vi.fn();

  beforeEach(() => {
    signTypedDataMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses, streams and signs, forwarding derivationPath/data/parser to the task", async () => {
    const deviceAction = makeDeviceAction();

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    expect(signTypedDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          derivationPath: INPUT.derivationPath,
          data: INPUT.data,
          parser: INPUT.parser,
        },
      }),
    );
  });

  it("ends in Error when the signing task fails", async () => {
    signTypedDataMock.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("typed data signing failed"),
      }),
    );
    const deviceAction = makeDeviceAction();

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState.status).toBe(DeviceActionStatus.Error);
  });

  function makeDeviceAction() {
    const deviceAction = new SignTypedDataDeviceAction({ input: INPUT });

    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      signTypedData: signTypedDataMock,
    });

    return deviceAction;
  }
});
