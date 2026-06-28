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

interface SignMessageResponse {
  status: string;
  output?: {
    r: string;
    s: string;
    v: number;
  };
  error?: object;
  pending?: object;
}

test.describe("TRON Signer: sign message, happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
  });

  test("device should sign a TIP-191 message for the default derivation path", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: sign message", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Sign Message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/195'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, tron!",
        },
      ]);
    });

    await test.step("Then verify the response contains a signature", async () => {
      await page.waitForTimeout(1000);

      const response = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      expect(response.status).toBe("completed");
      expect(isValid256BitHex(response?.output?.r || "")).toBe(true);
      expect(isValid256BitHex(response?.output?.s || "")).toBe(true);
    });
  });

  test("device should produce a different signature for a different message", async ({
    page,
  }) => {
    await test.step("Given first device is connected", async () => {
      await whenConnectingDevice(page);

      await thenDeviceIsConnected(page, 0);
    });

    await test.step("When execute TRON: sign message", async () => {
      await whenNavigateTo(page, "/signers");

      await whenClicking(page, "CTA_command-Tron");

      await whenExecuteDeviceAction(page, "Sign Message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/195'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "hello, tron!",
        },
      ]);
    });

    await test.step("Then the signature differs for another message", async () => {
      await page.waitForTimeout(1000);

      const firstMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      await whenExecute("device-action")(page, "Sign Message", [
        {
          inputField: "input-text_derivationPath",
          inputValue: "44'/195'/0'/0/0",
        },
        {
          inputField: "input-text_message",
          inputValue: "bonjour le tron!",
        },
      ]);

      await page.waitForTimeout(1000);

      const secondMessage = (await getLastDeviceResponseContent(
        page,
      )) as SignMessageResponse;

      expect(firstMessage?.output?.r).toBeDefined();
      expect(secondMessage?.output?.r).toBeDefined();
      expect(firstMessage?.output?.r).not.toBe(secondMessage?.output?.r);
      expect(firstMessage?.output?.s).not.toBe(secondMessage?.output?.s);
    });
  });
});
