import test from "node:test";
import assert from "node:assert/strict";
import { populatedState } from "./fixtures/populated-state.ts";
import {
  validRuc,
  rucCheckDigit,
  supplierErrors,
  saveSupplier,
  deleteCatalogRecord,
  supplierActivity,
} from "../src/erp/catalog-logic.ts";
import { upgradeLegacyDemo } from "./fixtures/demo.ts";
const supplier = (id = "PRO-NEW") => ({
  id,
  name: "Empresa ficticia de prueba",
  taxId: "20600000013",
  contact: "",
  email: "",
  phone: "",
  address: "",
  credit: 0,
  active: true,
});
test("RUC format, prefix and check digit validate locally, including checksum edge cases", () => {
  assert.equal(validRuc("20600000013"), true);
  assert.equal(validRuc("20600000014"), false);
  assert.equal(validRuc("2060000001"), false);
  assert.equal(validRuc("30600000013"), false);
  for (let n = 0; n < 100; n++) {
    const base = `2098000${String(n).padStart(3, "0")}`;
    assert.equal(validRuc(base + rucCheckDigit(base)), true);
  }
});
test("supplier creation validates duplicate IDs, RUC, email and delivery days before mutation", () => {
  const state = populatedState();
  const value = supplier();
  saveSupplier(state, value);
  assert.equal(state.suppliers.at(-1).id, value.id);
  assert.match(supplierErrors(state, supplier()).id, /código/);
  assert.match(supplierErrors(state, supplier("PRO-OTHER")).taxId, /RUC/);
  const invalid = {
    ...supplier("PRO-INVALID"),
    email: "bad-email",
    estimatedDeliveryDays: -1,
    taxId: "123",
  };
  const before = JSON.stringify(state);
  assert.throws(() => saveSupplier(state, invalid));
  assert.equal(JSON.stringify(state), before);
  assert.ok(supplierErrors(state, invalid).email);
  assert.ok(supplierErrors(state, invalid).estimatedDeliveryDays);
  assert.match(supplierErrors(state, supplier("CLI-1")).id, /cliente/);
});
test("editing preserves supplier identity, legacy metadata and document links", () => {
  const state = populatedState();
  const original = state.suppliers[0];
  original.website = "https://legacy.example";
  original.country = "Dato histórico";
  const documents = JSON.stringify(state.documents);
  saveSupplier(
    state,
    { ...original, contact: "Nuevo contacto", paymentTerms: "Contado" },
    original.id,
  );
  assert.equal(state.suppliers[0].id, original.id);
  assert.equal(state.suppliers[0].website, "https://legacy.example");
  assert.equal(JSON.stringify(state.documents), documents);
  assert.throws(
    () => saveSupplier(state, { ...original, id: "CHANGED" }, original.id),
    /código/,
  );
});
test("linked suppliers, customers and products deactivate; unlinked suppliers delete definitively", () => {
  const state = populatedState();
  const documents = JSON.stringify(state.documents);
  const movements = JSON.stringify(state.movements);
  const stock = JSON.stringify(state.stock);
  assert.equal(deleteCatalogRecord(state, "suppliers", "PRO-1"), "deactivated");
  assert.equal(state.suppliers[0].active, false);
  assert.equal(deleteCatalogRecord(state, "customers", "CLI-4"), "deactivated");
  assert.equal(
    deleteCatalogRecord(state, "products", "PRD-001"),
    "deactivated",
  );
  assert.equal(JSON.stringify(state.documents), documents);
  assert.equal(JSON.stringify(state.movements), movements);
  assert.equal(JSON.stringify(state.stock), stock);
  saveSupplier(state, supplier());
  assert.equal(deleteCatalogRecord(state, "suppliers", "PRO-NEW"), "deleted");
  assert.equal(
    state.suppliers.some((s) => s.id === "PRO-NEW"),
    false,
  );
});
test("supplier activity derives totals, dates and products exclusively from linked purchase orders", () => {
  const state = populatedState();
  const activity = supplierActivity(state, "PRO-1");
  const orders = state.documents.filter(
    (d) => d.kind === "OC" && d.partyId === "PRO-1",
  );
  assert.equal(activity.orders.length, orders.length);
  assert.equal(
    activity.total,
    orders.reduce((s, d) => s + d.total, 0),
  );
  assert.equal(
    activity.months.reduce((s, [, value]) => s + value, 0),
    activity.total,
  );
  assert.equal(activity.products[0].quantity, 300);
  assert.deepEqual(supplierActivity(state, "UNKNOWN").orders, []);
  assert.equal(supplierActivity(state, "UNKNOWN").total, 0);
});
test("demo data is complete, identifiable and uses unique stable IDs and example domains", () => {
  const state = populatedState();
  for (const s of state.suppliers) {
    assert.equal(s.demo, true);
    assert.equal(validRuc(s.taxId), true);
    for (const key of [
      "tradeName",
      "category",
      "supplierType",
      "contactRole",
      "alternatePhone",
      "district",
      "province",
      "department",
      "paymentTerms",
      "currency",
      "registeredAt",
      "commercialNotes",
    ])
      assert.ok(s[key], key);
    assert.match(s.email, /\.example$/);
  }
  assert.equal(
    new Set(state.suppliers.map((s) => s.id)).size,
    state.suppliers.length,
  );
  assert.equal(
    state.documents.every((d) => d.demo),
    true,
  );
  assert.equal(
    state.products.every((p) => p.demo && p.description),
    true,
  );
  assert.equal(
    state.customers.every((c) => c.demo && c.contact && c.email),
    true,
  );
});
test("legacy demo migration never overwrites edited or user records, and is idempotent", () => {
  const state = populatedState();
  state.suppliers = [
    {
      id: "PRO-1",
      name: "Polímeros del Perú S.A.C.",
      taxId: "20100000001",
      contact: "Carlos Ramírez",
      email: "contacto1@empresa.pe",
      phone: "987654320",
      address: "Av. Industrial 250, Lima",
      credit: 25000,
      active: true,
    },
    {
      ...supplier("USER-1"),
      name: "Empresa del usuario",
      tradeName: "Mis datos",
    },
    {
      id: "PRO-2",
      name: "Resinas Andinas S.A.C.",
      taxId: "20100000002",
      contact: "Contacto editado",
      email: "contacto2@empresa.pe",
      phone: "987654321",
      address: "Av. Industrial 250, Lima",
      credit: 25000,
      active: true,
    },
  ];
  const user = JSON.stringify(state.suppliers.slice(1));
  const stock = JSON.stringify(state.stock);
  const docs = JSON.stringify(state.documents);
  assert.equal(upgradeLegacyDemo(state), true);
  assert.equal(state.suppliers[0].id, "PRO-1");
  assert.equal(state.suppliers[0].demo, true);
  assert.equal(JSON.stringify(state.suppliers.slice(1)), user);
  assert.equal(JSON.stringify(state.stock), stock);
  assert.equal(JSON.stringify(state.documents), docs);
  assert.equal(upgradeLegacyDemo(state), false);
});


test("supplier purchase ranking sorts actual orders without changing totals or records", async () => {
 const {supplierPurchaseRanking} = await import("../src/erp/supplier-purchase-chart.ts");
 const s = populatedState(), base = s.documents.find(d => d.kind === "OC");
 s.documents = [
  {...base, id:"small",partyId:"chart-vendor",date:"2026-10-16",total:50},
  {...base, id:"large",partyId:"chart-vendor",date:"2026-10-16",total:616},
  {...base, id:"medium",partyId:"chart-vendor",date:"2026-10-15",total:100},
  {...base, id:"other",partyId:"other-vendor",date:"2026-10-16",total:9999},
 ];
 const activity = supplierActivity(s,"chart-vendor");
 const before = structuredClone(activity.orders);
 const ranked = supplierPurchaseRanking(activity.orders);
 assert.deepEqual(ranked.map(d => d.id),["large","medium","small"]);
 assert.deepEqual(activity.orders,before);
 assert.equal(ranked.reduce((sum,d) => sum+d.total,0),activity.total);
 assert.deepEqual(supplierPurchaseRanking([]),[]);
});


test("referenced categories become inactive and preserve product assignments and operations", async () => {
 const {deleteCategory} = await import("../src/erp/catalog-logic.ts");
 const {expandCatalogData} = await import("./fixtures/demo.ts");
 const state=populatedState(); expandCatalogData(state);
 const operational=JSON.stringify([state.documents,state.quotes,state.stock,state.movements]);
 const product=state.products.find(p=>p.category==="Adhesivos");
 deleteCategory(state,"Adhesivos","PVC");
 assert.equal(product.category,"Adhesivos"); assert.equal(state.categories.includes("Adhesivos"),true);
 assert.equal(state.masterCategories.find(c=>c.name==="Adhesivos").active,false);
 expandCatalogData(state); assert.equal(state.categories.includes("Adhesivos"),true);
 assert.equal(JSON.stringify([state.documents,state.quotes,state.stock,state.movements]),operational);
 const another=state.products.find(p=>p.category==="PVC");
 deleteCategory(state,"PVC"); assert.equal(another.category,"PVC");
 assert.equal(state.masterCategories.find(c=>c.name==="PVC").active,false);
 const before=JSON.stringify(state);
 assert.throws(()=>deleteCategory(state,state.categories[0],"NO-EXISTE"),/otra categoría/);
 assert.equal(JSON.stringify(state),before);
});
