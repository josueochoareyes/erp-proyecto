import { test, expect } from "../fixtures/browser-test";
import { masterCatalogs, masterGroups } from "../../src/erp/master-navigation";

test("Maestros agrupa los 17 catálogos en cinco accesos y conserva enlaces directos", async ({ page }) => {
  for (const catalog of masterCatalogs) {
    await page.goto(catalog.path);
    const group = masterGroups.find((item) => item.tabs.includes(catalog.tab))!;
    const sidebar = page.locator('[id="group-Maestros"]');
    await expect(sidebar.getByRole("link")).toHaveCount(5);
    await expect(sidebar.getByRole("link", { name: group.name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: group.name, exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { selected: true })).toHaveText(catalog.label);
    await expect(page.locator(".masters-subnav").getByRole("tab")).toHaveCount(group.tabs.length);
    await expect(page.locator(".masters-groups")).toHaveCount(0);
  }
});

test("pestañas, recarga, historial y teclado conservan la selección", async ({ page }) => {
  await page.goto("/maestros/terceros");
  await page.getByRole("tab", { name: "Proveedores", exact: true }).click();
  await expect(page).toHaveURL(/\/maestros\/proveedores$/);
  await page.reload();
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Proveedores");
  await page.goBack();
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Clientes");
  await page.goForward();
  const supplierTab = page.getByRole("tab", { name: "Proveedores", exact: true });
  await supplierTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/maestros\/transportistas$/);
  await expect(page.getByRole("tab", { selected: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Clientes");
  await page.locator('[id="group-Maestros"]').getByRole("link", { name: "Gestión comercial", exact: true }).click();
  await page.getByRole("tab", { name: "Listas de precios", exact: true }).click();
  await expect(page).toHaveURL(/\/maestros\/listas-precios$/);
  await expect(page.locator('[id="group-Maestros"] a[aria-current="page"]')).toHaveText("Gestión comercial");
  await page.getByRole("button", { name: "Importación masiva CSV", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("rutas de entrada antiguas abren Organización y rutas inexistentes muestran error", async ({ page }) => {
  for (const path of ["/maestros", "/mantenimientos"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: "Organización" })).toBeVisible();
  }
  await page.goto("/maestros/no-existe");
  await expect(page.getByRole("heading", { name: "Página no disponible" })).toBeVisible();
});

test("Maestros permite cambiar de grupo en móvil sin desbordar la página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/maestros/terceros");
  await page.getByRole("button", { name: "Abrir o cerrar menú", exact: true }).click();
  await page.locator('[id="group-Maestros"]').getByRole("link", { name: "Monedas, impuestos y pagos", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Monedas, impuestos y pagos" })).toBeVisible();
  await page.getByRole("tab", { name: "Formas de pago", exact: true }).click();
  await expect(page).toHaveURL(/\/maestros\/formas-pago$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/maestros-mobile.png", fullPage: true });
});
