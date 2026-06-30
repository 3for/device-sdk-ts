import {
  CommandResultFactory,
  DeviceActionStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { type Signature } from "@api/model/Signature";
import { TronClearSignContextType } from "@api/model/TronClearSignContext";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const SIGNATURE: Signature = {
  r: "0x01",
  s: "0x02",
  v: 0,
};

const INPUT = {
  derivationPath: "44'/195'/0'/0/0",
  rawData: Uint8Array.from([0x01, 0x02, 0x03]),
};

describe("SignTransactionDeviceAction", () => {
  const buildContextsMock = vi.fn();
  const signTransactionMock = vi.fn();
  const signGcsTransactionMock = vi.fn();

  beforeEach(() => {
    buildContextsMock.mockResolvedValue([]);
    signTransactionMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
    signGcsTransactionMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the blind signing task by default", async () => {
    const deviceAction = makeDeviceAction({
      clearSigningMode: "auto",
    });

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    const buildContextsInput = (
      buildContextsMock.mock.calls[0]?.[0] as {
        readonly input: {
          readonly derivationPath: string;
          readonly rawData: Uint8Array;
        };
      }
    ).input;
    expect(buildContextsInput.derivationPath).toBe(INPUT.derivationPath);
    expect(buildContextsInput.rawData).toBe(INPUT.rawData);
    expect(signTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          derivationPath: INPUT.derivationPath,
          rawData: INPUT.rawData,
        }),
      }),
    );
    expect(signGcsTransactionMock).not.toHaveBeenCalled();
  });

  it("uses the GCS signing task when clear-signing contexts are provided", async () => {
    const contexts = [
      {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: "0102",
      },
    ];
    buildContextsMock.mockResolvedValueOnce(contexts);
    const deviceAction = makeDeviceAction({
      clearSigningMode: "auto",
      contexts,
    });

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    expect(signGcsTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          derivationPath: INPUT.derivationPath,
          rawData: INPUT.rawData,
          contexts,
        },
      }),
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("uses the GCS signing task when the context module returns contexts", async () => {
    const contexts = [
      {
        type: TronClearSignContextType.TRANSACTION_INFO,
        payload: "0102",
      },
    ];
    buildContextsMock.mockResolvedValueOnce(contexts);
    const deviceAction = makeDeviceAction({
      clearSigningMode: "auto",
    });

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    expect(signGcsTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          derivationPath: INPUT.derivationPath,
          rawData: INPUT.rawData,
          contexts,
        },
      }),
    );
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("uses the legacy signing task when only TRC10 contexts are provided", async () => {
    const contexts = [
      {
        type: TronClearSignContextType.TRC10_TOKEN,
        payload: "0a04555344541000",
      },
    ];
    buildContextsMock.mockResolvedValueOnce(contexts);
    const deviceAction = makeDeviceAction({
      clearSigningMode: "auto",
      contexts,
    });

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    expect(signTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          derivationPath: INPUT.derivationPath,
          rawData: INPUT.rawData,
          contexts,
        }),
      }),
    );
    expect(signGcsTransactionMock).not.toHaveBeenCalled();
  });

  it("keeps blind signing when explicitly requested, even with contexts", async () => {
    const deviceAction = makeDeviceAction({
      clearSigningMode: "blind",
      contexts: [
        {
          type: TronClearSignContextType.TRANSACTION_INFO,
          payload: "0102",
        },
      ],
    });

    const finalState = await lastValueFrom(
      deviceAction._execute({} as InternalApi).observable,
    );

    expect(finalState).toEqual({
      status: DeviceActionStatus.Completed,
      output: SIGNATURE,
    });
    expect(signTransactionMock).toHaveBeenCalledTimes(1);
    expect(signGcsTransactionMock).not.toHaveBeenCalled();
  });

  function makeDeviceAction(
    options: ConstructorParameters<
      typeof SignTransactionDeviceAction
    >[0]["input"]["options"],
  ) {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        ...INPUT,
        options: {
          ...options,
          skipOpenApp: true,
        },
        contextModule: {
          getContexts: vi.fn(),
          getFieldContext: vi.fn(),
          getTypedDataFilters: vi.fn(),
          report: vi.fn(),
        },
      },
    });

    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      buildContexts: buildContextsMock,
      signTransaction: signTransactionMock,
      signGcsTransaction: signGcsTransactionMock,
    });

    return deviceAction;
  }
});
