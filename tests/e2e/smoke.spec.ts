import { expect, test } from "@playwright/test";

test("home, player selection and quick confirmation pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pelada da Quinta")).toBeVisible();

  await page.goto("/jogador");
  await expect(page.getByText("Quem e voce?")).toBeVisible();

  await page.goto("/confirmacao-rapida");
  await expect(page.getByRole("heading", { name: "Confirmacao rapida" })).toBeVisible();
});

