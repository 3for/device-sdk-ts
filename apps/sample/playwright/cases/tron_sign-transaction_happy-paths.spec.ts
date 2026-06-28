/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

import { thenDeviceIsConnected } from "../utils/thenHandlers";
import { getLastDeviceResponseContent, isValid256BitHex } from "../utils/utils";
import {
  whenClicking,
  whenConnectingDevice,
  whenExecute,
  whenExecuteDeviceAction,
  whenNavigateTo,
} from "../utils/whenHandlers";

interface SignTransactionResponse {
  status: string;
  output?: {
    r: string;
    s: string;
    v: number;
  };
  error?: object;
  pending?: object;
}

// The "Sign Transaction" action pre-fills rawData with a sample Tron raw_data,
// so the tests only override the derivation path.
test.describe("TRON Signer: sign transaction, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign a raw_data transaction for the default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: sign transaction", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Sign Transaction", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/0",
      });
    });

    await test.step("Then verify the response contains a signature", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as SignTransactionResponse;

      expect(response.status).toBe("completed");
      expect(isValid256BitHex(response?.output?.r || "")).toBe(true);
      expect(isValid256BitHex(response?.output?.s || "")).toBe(true);
    });
  });

  test("device should produce a different signature for a different derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: sign transaction", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Sign Transaction", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/0",
      });
    });

    await test.step("Then the signature differs for index 1", async () => {
      await page.waitForTimeout(1000);

      const signatureIndex0 = (await getLastDeviceResponseContent(
        page,
      )) as SignTransactionResponse;

      await whenExecute("device-action")(page, "Sign Transaction", {
        inputField: "input-text_derivationPath",
        inputValue: "44'/195'/0'/0/1",
      });

      await page.waitForTimeout(1000);

      const signatureIndex1 = (await getLastDeviceResponseContent(
        page,
      )) as SignTransactionResponse;

      expect(signatureIndex0?.output?.r).toBeDefined();
      expect(signatureIndex1?.output?.r).toBeDefined();
      expect(signatureIndex0?.output?.r).not.toBe(signatureIndex1?.output?.r);
      expect(signatureIndex0?.output?.s).not.toBe(signatureIndex1?.output?.s);
    });
  });
});
