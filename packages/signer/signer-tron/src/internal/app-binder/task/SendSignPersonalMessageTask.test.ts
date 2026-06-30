import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import { SendSignPersonalMessageTask } from "./SendSignPersonalMessageTask";

const SIGNATURE: Signature = {
  r: "0x01",
  s: "0x02",
  v: 0,
};

// "44'/195'/0'/0/0" encoded as 1-byte count + 5 × 32-bit big-endian.
const PATH = "44'/195'/0'/0/0";
const PATH_BYTES = Uint8Array.from([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0xc3, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const APDU_HEADER_LEN = 5; // cla, ins, p1, p2, Lc

const rawApduOf = (api: InternalApi, i: number): Uint8Array =>
  vi.mocked(api.sendCommand).mock.calls[i]![0].getApdu().getRawApdu();

describe("SendSignPersonalMessageTask", () => {
  it("uses P1_SIGN for a single-chunk personal message", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      message: Uint8Array.from([0xaa]),
      fullDisplay: false,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    const command = vi.mocked(api.sendCommand).mock.calls[0]![0];
    expect(command.getApdu().getRawApdu()[2]).toBe(0x10);
  });

  it("uses FIRST then MORE for a multi-chunk personal message", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing }))
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: "44'/195'/0'/0/0",
      message: Uint8Array.from(new Array(260).fill(0xaa)),
      fullDisplay: true,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const firstCommand = vi.mocked(api.sendCommand).mock.calls[0]![0];
    const secondCommand = vi.mocked(api.sendCommand).mock.calls[1]![0];
    expect(firstCommand.getApdu().getRawApdu()[1]).toBe(0xc8);
    expect(firstCommand.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(secondCommand.getApdu().getRawApdu()[1]).toBe(0xc8);
    expect(secondCommand.getApdu().getRawApdu()[2]).toBe(0x80);
  });

  it("routes to INS 0x08 and wraps the first chunk as path || uint32BE(len) || message", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;
    const message = Uint8Array.from([0xaa, 0xbb]);

    await new SendSignPersonalMessageTask(api, {
      derivationPath: PATH,
      message,
      fullDisplay: false,
    }).run();

    const raw = rawApduOf(api, 0);
    // non-full-display INS, P1.SIGN, P2 = 0
    expect(raw[1]).toBe(0x08);
    expect(raw[2]).toBe(0x10);
    expect(raw[3]).toBe(0x00);

    const body = raw.slice(APDU_HEADER_LEN);
    expect(body.slice(0, PATH_BYTES.length)).toStrictEqual(PATH_BYTES);
    // uint32BE message length immediately after the path
    expect(body.slice(PATH_BYTES.length, PATH_BYTES.length + 4)).toStrictEqual(
      Uint8Array.from([0x00, 0x00, 0x00, message.length]),
    );
    expect(body.slice(PATH_BYTES.length + 4)).toStrictEqual(message);
  });

  it("uses FIRST then MORE for every subsequent chunk (3 chunks)", async () => {
    // prefix = 25 bytes → firstMessageBytes = 250 - 25 = 225; 500 bytes ⇒ 225/250/25
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing }))
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing }))
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(SIGNATURE) })),
    } as unknown as InternalApi;

    await new SendSignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: Uint8Array.from(new Array(500).fill(0xaa)),
      fullDisplay: false,
    }).run();

    expect(api.sendCommand).toHaveBeenCalledTimes(3);
    expect([
      rawApduOf(api, 0)[2],
      rawApduOf(api, 1)[2],
      rawApduOf(api, 2)[2],
    ]).toStrictEqual([
      0x00, // FIRST
      0x80, // MORE
      0x80, // MORE
    ]);
  });

  it("short-circuits and returns the error when a chunk fails", async () => {
    const error = new InvalidStatusWordError("message chunk rejected");
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValueOnce(CommandResultFactory({ error })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: Uint8Array.from(new Array(500).fill(0xaa)),
      fullDisplay: false,
    }).run();

    expect(result).toStrictEqual(CommandResultFactory({ error }));
    expect(api.sendCommand).toHaveBeenCalledTimes(1); // later chunks never sent
  });

  it("returns an error when the device never yields a signature", async () => {
    const api = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: Nothing })),
    } as unknown as InternalApi;

    const result = await new SendSignPersonalMessageTask(api, {
      derivationPath: PATH,
      message: Uint8Array.from([0xaa]),
      fullDisplay: false,
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
