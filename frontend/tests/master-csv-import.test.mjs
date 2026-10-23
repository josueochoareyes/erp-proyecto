import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initialState } from "../src/erp/model.ts";
import { ensureMasterData } from "../src/erp/master-migrations.ts";
import { detectMasterImportKind, importMasterCsv, previewMasterCsv } from "../src/erp/master-csv-import.ts";

const root = resolve(process.cwd(), "public/plantillas-csv");
const file = (name) => readFile(resolve(root, name), "utf8");

test("las 17 plantillas tienen diez filas y el importador identifica cada submódulo", async () => {
  const names = [
    "01-empresas.csv", "02-sucursales.csv", "03-almacenes.csv", "04-productos.csv", "05-categorias.csv", "06-marcas.csv", "07-unidades.csv", "08-conversiones.csv", "09-clientes.csv", "10-proveedores.csv", "11-transportistas.csv", "12-vendedores.csv", "13-zonas.csv", "14-monedas-tipos-cambio.csv", "15-impuestos.csv", "16-formas-pago.csv", "17-listas-precios.csv",
  ];
  const state = initialState();
  ensureMasterData(state);
  const kinds = [];
  for (const name of names) {
    const csv = await file(name);
    const preview = previewMasterCsv(state, csv);
    assert.equal(preview.rows.length, 10, name);
    kinds.push(preview.kind);
  }
  assert.deepEqual(kinds, ["companies", "branches", "warehouses", "products", "categories", "brands", "units", "conversions", "customers", "suppliers", "transporters", "sellers", "zones", "currencies", "taxes", "paymentMethods", "priceLists"]);
});

test("un solo botón enruta cada CSV al catálogo correcto y conserva relaciones", async () => {
  const state = initialState();
  ensureMasterData(state);
  for (const name of ["14-monedas-tipos-cambio.csv", "01-empresas.csv", "02-sucursales.csv", "03-almacenes.csv", "05-categorias.csv", "06-marcas.csv", "07-unidades.csv", "04-productos.csv", "08-conversiones.csv", "11-transportistas.csv", "13-zonas.csv", "12-vendedores.csv", "15-impuestos.csv", "16-formas-pago.csv", "17-listas-precios.csv", "09-clientes.csv", "10-proveedores.csv"]) {
    const result = importMasterCsv(state, await file(name), "skip");
    assert.equal(result.errors, 0, `${name}: ${result.errors}`);
  }
  assert.equal(state.companies?.length, 11);
  assert.equal(state.branches?.find((item) => item.id === "SUC-003")?.companyId, "EMP-002");
  assert.equal(state.warehouses.find((item) => item.id === "ALM-004")?.branchId, "SUC-003");
  assert.equal(state.products.length, 10);
  assert.equal(state.unitConversions?.length, 10);
  assert.equal(state.customers.length, 10);
  assert.equal(state.suppliers.length, 10);
  assert.equal(state.transporters?.length, 10);
  assert.equal(state.sellers?.length, 10);
  assert.equal(state.zones?.length, 10);
  assert.equal(state.currencies?.length, 10);
  assert.equal(state.taxes?.length, 10);
  assert.equal(state.paymentMethods?.length, 10);
  assert.equal(state.priceLists?.find((item) => item.id === "LST-MAYORISTA")?.code, "LST-MAYORISTA");
  assert.equal(state.priceListItems?.filter((item) => item.priceListId === "LST-MAYORISTA").length, 10);
  assert.equal(detectMasterImportKind(await file("13-zonas.csv")), "zones");
});

test("las empresas pueden importarse con RUC pendiente y el RUC sigue validándose cuando existe", () => {
  const state = initialState();
  ensureMasterData(state);
  const csv = [
    "id,taxId,legalName,tradeName,fiscalAddress,baseCurrency,taxRegime,phone,email,website,active",
    "EMP-900,,Empresa sin RUC,,Av. Central 100,PEN,No especificado,,,,Activo",
    "EMP-901,123,Empresa con RUC invalido,,Av. Central 101,PEN,No especificado,,,,Activo",
  ].join("\n");
  const preview = previewMasterCsv(state, csv);
  assert.equal(preview.rows[0].status, "valid");
  assert.equal(preview.rows[1].status, "error");
  assert.equal(preview.rows[1].errors.taxId, "El RUC debe tener 11 dígitos.");
  const result = importMasterCsv(state, csv, "skip");
  assert.equal(result.errors, 1);
  assert.equal(state.companies?.some((item) => item.id === "EMP-900" && item.taxId === ""), true);
});
