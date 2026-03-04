import { expect, test } from "@playwright/test";

test("home and player selection pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pelada da Quinta")).toBeVisible();

  await page.goto("/jogador");
  await expect(page.getByText("Quem e voce?")).toBeVisible();
});
