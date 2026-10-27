import test from "node:test";
import assert from "node:assert/strict";
import { populatedState } from "./fixtures/populated-state.ts";
import { ensureMasterData } from "../src/erp/master-migrations.ts";
import { deleteMasterRecord, masterDeletionPolicy } from "../src/erp/master-deletion.ts";
import { deleteCategory } from "../src/erp/catalog-logic.ts";

const fresh = () => { const state = populatedState(); ensureMasterData(state); return state; };

test("empresas: protege la principal, elimina una libre y desactiva una con sucursales", () => {
  const state = fresh();
  const principal = state.companies[0].id;
  const before = JSON.stringify(state);
  assert.throws(() => deleteMasterRecord(state, "companies", principal), /principal/);
  assert.equal(JSON.stringify(state), before);
  state.companies.push({ ...state.companies[0], id: "EMP-DELETE", legalName: "Sin uso" });
  assert.equal(deleteMasterRecord(state, "companies", "EMP-DELETE"), "delete");
  state.companies.push({ ...state.companies[0], id: "EMP-LINK" });
  state.branches.push({ id: "BR-LINK", companyId: "EMP-LINK", name: "Sede", code: "SEDE", address: "", active: true });
  assert.equal(deleteMasterRecord(state, "companies", "EMP-LINK"), "deactivate");
  assert.equal(state.companies.find((item) => item.id === "EMP-LINK").active, false);
  assert.equal(state.branches.find((item) => item.id === "BR-LINK").companyId, "EMP-LINK");
});

test("marcas, sucursales, unidades y relaciones comerciales conservan referencias", () => {
  const state = fresh();
  state.brands.push({ id: "BRAND", name: "Marca", code: "M", active: true });
  state.products[0].brandId = "BRAND";
  state.sellers.push({ id: "SELLER", name: "Vendedor", code: "V", active: true, commissionPct: 0, monthlyTarget: 0 });
  state.customers[0].sellerId = "SELLER";
  const branch = state.branches.find((item) => state.warehouses.some((w) => w.branchId === item.id));
  for (const [kind, id] of [["brands", "BRAND"], ["branches", branch.id], ["units", state.products[0].unitId], ["sellers", "SELLER"]]) {
    assert.equal(deleteMasterRecord(state, kind, id), "deactivate");
    assert.equal(state[kind].find((item) => item.id === id).active, false);
  }
  assert.equal(state.customers[0].sellerId, "SELLER");
  assert.equal(state.products[0].brandId, "BRAND");
});

test("moneda base bloqueada y registros predeterminados permanecen inactivos al recargar", () => {
  const state = fresh();
  const base = state.currencies.find((item) => item.isoCode === state.settings.currency);
  assert.throws(() => deleteMasterRecord(state, "currencies", base.id), /moneda base/);
  for (const [kind, id] of [["currencies", "USD"], ["taxes", "IGV18"], ["paymentMethods", "CONTADO"], ["priceLists", "LISTA-BASE"]]) {
    assert.equal(deleteMasterRecord(state, kind, id), "deactivate");
  }
  ensureMasterData(state);
  for (const [kind, id] of [["currencies", "USD"], ["taxes", "IGV18"], ["paymentMethods", "CONTADO"], ["priceLists", "LISTA-BASE"]]) {
    assert.equal(state[kind].filter((item) => item.id === id).length, 1);
    assert.equal(state[kind].find((item) => item.id === id).active, false);
  }
});

test("registros libres se eliminan sin alterar documentos, movimientos o stock y se auditan", () => {
  const state = fresh();
  const before = JSON.stringify([state.documents, state.movements, state.stock]);
  const kinds = ["branches", "brands", "units", "unitConversions", "transporters", "sellers", "zones", "currencies", "exchangeRates", "taxes", "paymentMethods", "priceLists", "priceListItems"];
  for (const kind of kinds) {
    state[kind].push({ id: "FREE", active: true, name: "Libre", code: "FREE", isoCode: "ZZZ", priceListId: "FREE-LIST", currencyId: "ZZZ", date: "2099-01-01" });
    assert.equal(deleteMasterRecord(state, kind, "FREE"), "delete", kind);
    assert.equal(state[kind].some((item) => item.id === "FREE"), false);
    assert.match(state.audit[0].record, new RegExp(kind));
  }
  assert.equal(JSON.stringify([state.documents, state.movements, state.stock]), before);
  assert.throws(() => deleteMasterRecord(state, "brands", "NO-EXISTE"), /disponible/);
});

test("listas, precios y formas de pago respetan asignaciones e históricos del cliente", () => {
  const state = fresh();
  state.priceLists.push({ id: "LIST", name: "Especial", code: "ESP", currencyId: "USD", validFrom: "2026-01-01", active: true });
  state.priceListItems.push({ id: "ITEM", priceListId: "LIST", productId: state.products[0].id, price: 10, minQuantity: 1, active: true });
  state.documents[0].customerSnapshot = { ...state.customers[0], priceListId: "LIST", paymentTerms: "Pago especial", zoneId: "ZONE" };
  state.paymentMethods.push({ id: "PAY", name: "Pago especial", code: "ESP", creditDays: 1, type: "Crédito", active: true });
  state.zones.push({ id: "ZONE", name: "Zona", code: "Z", active: true });
  for (const [kind, id] of [["priceLists", "LIST"], ["priceListItems", "ITEM"], ["paymentMethods", "PAY"], ["zones", "ZONE"]]) {
    assert.equal(masterDeletionPolicy(state, kind, id).action, "deactivate");
    deleteMasterRecord(state, kind, id);
  }
  assert.equal(state.documents[0].customerSnapshot.priceListId, "LIST");
});

test("categorías conserva nombre e ID y el maestro histórico inactivo", () => {
  const state = fresh();
  const product = state.products[0];
  const origin = state.masterCategories.find((item) => item.id === product.categoryId);
  state.categories.push("Destino");
  state.masterCategories.push({ id: "DEST", code: "DEST", name: "Destino", active: true });
  deleteCategory(state, origin.name, "Destino");
  assert.equal(product.category, origin.name);
  assert.equal(product.categoryId, origin.id);
  assert.equal(origin.active, false);
  ensureMasterData(state);
  assert.equal(state.categories.includes(origin.name), true);
});
