import { test, expect, type Page } from "../fixtures/browser-test";
import { populatedState } from "../fixtures/populated-state";
import { ensureMasterData } from "../../src/erp/master-migrations";

async function seed(page: Page) {
  const state = populatedState();
  ensureMasterData(state);
  state.companies!.push({ ...state.companies![0], id: "EMP-FREE", legalName: "Empresa sin vínculos", tradeName: "Empresa sin vínculos" });
  state.branches!.push({ id: "SUC-FREE", companyId: state.companies![0].id, code: "SF", name: "Sucursal libre", address: "", active: true });
  state.brands!.push({ id: "MAR-FREE", code: "MF", name: "Marca libre", active: true }, { id: "MAR-LINK", code: "ML", name: "Marca utilizada", active: true });
  state.products[0].brandId = "MAR-LINK";
  state.units!.push({ id: "UM-FREE", code: "LIB", name: "Unidad libre", abbreviation: "LIB", precision: 0, active: true });
  state.unitConversions!.push({ id: "CON-FREE", fromUnitId: "UM-FREE", toUnitId: "UND", factor: 2, validFrom: "2026-01-01", active: true });
  state.transporters!.push({ id: "TRA-FREE", document: "12345678", legalName: "Transportista libre", active: true });
  state.sellers!.push({ id: "VEN-FREE", code: "VF", name: "Vendedor libre", commissionPct: 0, monthlyTarget: 0, active: true });
  state.zones!.push({ id: "ZON-FREE", code: "ZF", name: "Zona libre", active: true });
  state.currencies!.push({ id: "JPY", isoCode: "JPY", name: "Yen libre", symbol: "Y", active: true });
  state.exchangeRates!.push({ id: "TC-FREE", currencyId: "USD", date: "2099-01-01", buyRate: 3, sellRate: 4, active: true });
  state.taxes!.push({ id: "IMP-FREE", code: "IF", name: "Impuesto libre", percentage: 0, type: "Otro", validFrom: "2026-01-01", active: true });
  state.paymentMethods!.push({ id: "PAY-FREE", code: "PF", name: "Pago libre", creditDays: 0, type: "Otro", active: true });
  state.priceLists!.push({ id: "LIST-FREE", code: "LF", name: "Lista libre", currencyId: "PEN", validFrom: "2026-01-01", active: true });
  state.priceListItems!.push({ id: "ITEM-FREE", priceListId: "LIST-FREE", productId: state.products[0].id, minQuantity: 1, price: 10, active: true });
  await page.goto("/dashboard");
  await page.evaluate((data) => localStorage.setItem("enterprisecloud-integrated-erp-v1", JSON.stringify(data)), state);
}

test("cada catálogo nuevo incluye su acción y elimina una marca después de confirmar", async ({ page }) => {
  await seed(page);
  const paths = ["empresa", "sucursales", "marcas", "unidades", "conversiones", "transportistas", "vendedores", "zonas", "monedas", "impuestos", "formas-pago", "listas-precios"];
  for (const path of paths) {
    await page.goto(`/maestros/${path}`);
    await expect(page.locator(".master-delete-button").first()).toBeVisible();
  }
  await page.goto("/maestros/marcas");
  const row = page.getByRole("row").filter({ hasText: "Marca libre" });
  await row.getByRole("button", { name: "Eliminar o desactivar Marca libre", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminar registro", exact: true });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Eliminar o desactivar Marca libre", exact: true }).click();
  await dialog.getByRole("button", { name: "Eliminar registro", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveCount(0);
});

test("marca relacionada se desactiva conservando productos y documentos", async ({ page }) => {
  await seed(page);
  await page.goto("/maestros/marcas");
  const before = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("enterprisecloud-integrated-erp-v1")!); return JSON.stringify([s.products, s.documents, s.stock]); });
  const row = page.getByRole("row").filter({ hasText: "Marca utilizada" });
  await row.getByRole("button", { name: "Eliminar o desactivar Marca utilizada", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desactivar registro", exact: true }).click();
  await expect(row).toContainText("Inactivo");
  await page.reload();
  await expect(row).toContainText("Inactivo");
  expect(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("enterprisecloud-integrated-erp-v1")!); return JSON.stringify([s.products, s.documents, s.stock]); })).toBe(before);
});

test("Empresas permite eliminar una libre y protege la principal; moneda base protegida", async ({ page }) => {
  await seed(page);
  await page.goto("/maestros/empresa");
  await page.locator(".master-delete-button").first().click();
  const protectedDialog = page.getByRole("dialog", { name: "Registro protegido" });
  await expect(protectedDialog).toContainText("empresa principal");
  await expect(protectedDialog.getByRole("button", { name: "Eliminar registro", exact: true })).toHaveCount(0);
  await protectedDialog.locator(".modal-actions").getByRole("button", { name: "Cerrar", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "EMP-FREE" });
  await row.getByRole("button", { name: "Eliminar o desactivar Empresa sin vínculos", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar registro", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.goto("/maestros/monedas");
  await page.getByRole("row").filter({ has: page.locator("code", { hasText: /^PEN$/ }) }).getByRole("button", { name: /^Eliminar o desactivar/ }).click();
  await expect(protectedDialog).toContainText("moneda base");
});

test("se pueden eliminar tipos de cambio y precios individuales sin borrar sus catálogos", async ({ page }) => {
  await seed(page);
  await page.goto("/maestros/monedas");
  const rate = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Eliminar o desactivar 2099-01-01 - USD", exact: true }) }).last();
  await rate.getByRole("button", { name: /^Eliminar o desactivar/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar registro", exact: true }).click();
  await expect(rate).toHaveCount(0);
  await page.goto("/maestros/listas-precios");
  await page.getByRole("button", { name: "Lista libre", exact: true }).click();
  const detail = page.locator(".masters-secondary-card");
  await detail.getByRole("button", { name: /^Eliminar o desactivar/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar registro", exact: true }).click();
  await expect(detail.getByRole("button", { name: /^Eliminar o desactivar/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lista libre", exact: true })).toBeVisible();
});
