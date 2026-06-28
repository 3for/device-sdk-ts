/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import {
  getLastDeviceResponseContent,
  isValidPublicKey,
  isValidTronAddress,
} from "../utils/utils";
import {
  whenClicking,
  whenConnectingDevice,
  whenExecute,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface GetAddressResponse {
  status: string;
  output?: {
    publicKey: string;
    address: string;
  };
  error?: object;
  pending?: object;
}

test.describe("TRON Signer: get address, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should return TRON pubKey and Base58Check address for the default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: get address", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Get Address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/0",
      });
    });

    await test.step("Then verify the response contains a valid Tron address and public key", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as GetAddressResponse;

      expect(response.status).toBe("completed");
      expect(isValidTronAddress(response?.output?.address || "")).toBe(true);
      expect(isValidPublicKey(response?.output?.publicKey || "")).toBe(true);
    });
  });

  test("device should require on-device confirmation when checkOnDevice is enabled", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: get address with checkOnDevice on", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenClicking(page, "CTA_command-Get Address");

      await whenClicking(page, "input-switch_checkOnDevice");

      await whenExecute("device-action")(page, "Get Address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/0",
      });
    });

    await test.step("Then the action stays pending until the address is confirmed", async () => {
      await page.waitForTimeout(1000);
      expect(
        ((await getLastDeviceResponseContent(page)) as GetAddressResponse)
          .status,
      ).toBe("pending");

      await page.waitForTimeout(2000);
      const response = (await getLastDeviceResponseContent(
        page,
      )) as GetAddressResponse;

      expect(response.status).toBe("completed");
      expect(isValidTronAddress(response?.output?.address || "")).toBe(true);
      expect(isValidPublicKey(response?.output?.publicKey || "")).toBe(true);
    });
  });

  test("device should return a different address for a different derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: get address", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Get Address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/0",
      });
    });

    await test.step("Then the address differs for index 1", async () => {
      await page.waitForTimeout(1000);

      const addressIndex0 = (
        (await getLastDeviceResponseContent(page)) as GetAddressResponse
      )?.output?.address;

      await whenExecute("device-action")(page, "Get Address", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/1",
      });

      await page.waitForTimeout(1000);

      const addressIndex1 = (
        (await getLastDeviceResponseContent(page)) as GetAddressResponse
      )?.output?.address;

      expect(isValidTronAddress(addressIndex0 || "")).toBe(true);
      expect(isValidTronAddress(addressIndex1 || "")).toBe(true);
      expect(addressIndex0).not.toBe(addressIndex1);
    });
  });
});
