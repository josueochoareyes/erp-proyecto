import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initialState } from "../src/erp/model.ts";
import { ensureMasterData } from "../src/erp/master-migrations.ts";
import { seedIntegratedDemoData, separateDemoCodes } from "../src/erp/integrated-demo-data.ts";
import { previewBulkMasterCsv, importBulkMasterCsv } from "../src/erp/bulk-master-import.ts";

const names = [
  "17-listas-precios.csv", "09-clientes.csv", "08-conversiones.csv", "04-productos.csv",
  "10-proveedores.csv", "12-vendedores.csv", "13-zonas.csv", "03-almacenes.csv",
  "02-sucursales.csv", "01-empresas.csv", "05-categorias.csv", "06-marcas.csv",
  "07-unidades.csv", "11-transportistas.csv", "14-monedas-tipos-cambio.csv",
  "15-impuestos.csv", "16-formas-pago.csv",
];
const sample = async () => Promise.all(names.map(async (name) => ({ name, text: await readFile(resolve("public/plantillas-csv", name), "utf8") })));

test("importación masiva ordena 17 catálogos, conserva relaciones y no crea operaciones", async () => {
  const state = initialState(); ensureMasterData(state);
  const files = await sample();
  const before = structuredClone(state);
  const preview = previewBulkMasterCsv(state, files, "skip");
  assert.equal(preview.hasFileErrors, false);
  assert.equal(preview.totals.errors, 0);
  assert.equal(preview.files.length, 17);
  assert.equal(preview.files[0].kind, "currencies");
  assert.deepEqual(state, before, "la vista previa no cambia el estado");
  const result = importBulkMasterCsv(state, files, "skip");
  assert.equal(result.hasFileErrors, false);
  assert.equal(state.products.length, 10);
  assert.equal(state.customers.length, 10);
  assert.equal(state.suppliers.length, 10);
  assert.equal(state.documents.length, 0);
  assert.equal(state.movements.length, 0);
  assert.equal(state.quotes.length, 0);
  assert.ok(state.warehouses.find((item) => item.id === "ALM-004")?.branchId === "SUC-003");
  assert.ok(state.priceListItems?.some((item) => item.productId === "PRD-IMPORT-001"));
  assert.ok(state.products.every((item) => Object.values(state.stock[item.id] ?? {}).every((quantity) => quantity === 0)));
  const repeated = previewBulkMasterCsv(state, files, "skip");
  assert.equal(repeated.totals.created, 0);
  assert.throws(() => importBulkMasterCsv(state, files, "skip"), /No hay registros nuevos/);
  assert.equal(state.products.length, 10);
});

test("un archivo inválido bloquea el lote completo y señala el origen", async () => {
  const state = initialState(); ensureMasterData(state);
  const before = structuredClone(state);
  const files = [{ name: "clientes.csv", text: "id,name,taxId\nCLI-901,Cliente Real,12345678" }, { name: "otro.csv", text: "desconocido\nvalor" }];
  const preview = previewBulkMasterCsv(state, files, "skip");
  assert.equal(preview.hasFileErrors, true);
  assert.match(preview.files.find((file) => file.name === "otro.csv").error, /identificar/);
  assert.throws(() => importBulkMasterCsv(state, files, "skip"), /archivos/);
  assert.deepEqual(state, before);
});

test("las referencias circulares de zona y vendedor se validan al terminar el lote", () => {
  const state = initialState(); ensureMasterData(state);
  const zone = { name: "zonas.csv", text: "id,code,name,route,sellerId,active\nZ-1,Z-1,Lima,,V-1,Activo" };
  const seller = { name: "vendedores.csv", text: "id,code,name,commissionPct,monthlyTarget,zoneId,userId,active\nV-1,V-1,Ana,2,1000,Z-1,,Activo" };
  assert.equal(previewBulkMasterCsv(state, [seller, zone], "skip").hasFileErrors, false);
  importBulkMasterCsv(state, [seller, zone], "skip");
  assert.equal(state.sellers?.[0].zoneId, "Z-1");
  assert.equal(state.zones?.[0].sellerId, "V-1");
  const broken = previewBulkMasterCsv(state, [{ ...zone, text: zone.text.replace("V-1,Activo", "V-MISSING,Activo").replace("Z-1,Z-1", "Z-2,Z-2") }], "skip");
  assert.equal(broken.hasFileErrors, true);
  assert.match(broken.files[0].error, /vendedor no existe/);
});

test("los códigos demo no bloquean la carga masiva de los ejemplos", async () => {
  const state = initialState(); ensureMasterData(state); seedIntegratedDemoData(state);
  const files = await sample();
  const preview = previewBulkMasterCsv(state, files, "skip");
  assert.equal(preview.hasFileErrors, false);
  assert.equal(preview.totals.errors, 0);
  importBulkMasterCsv(state, files, "skip");
  assert.equal(state.customers.length, 15);
  assert.equal(state.sellers?.some((seller) => seller.id === "VEN-001"), true);
  assert.equal(state.zones?.some((zone) => zone.id === "ZON-001"), true);
  const legacySeller = state.sellers.find((seller) => seller.id === "VEN-DEMO-001");
  legacySeller.code = "VEN-001";
  assert.equal(separateDemoCodes(state), true);
  assert.equal(legacySeller.code, "VEN-DEMO-001");
  assert.equal(separateDemoCodes(state), false);
});
