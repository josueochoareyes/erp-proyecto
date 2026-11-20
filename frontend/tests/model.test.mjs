import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  receive,
  invoice,
  pay,
  saveQuote,
  changeQuote,
  cancelSalesOrder,
  cancelPurchaseOrder,
  canCancelPurchaseOrder,
  deleteQuote,
  stockOf,
  today,
  total,
} from "../src/erp/model.ts";
import { addDriver, addVehicle, assignRoute, confirmDelivery, createDispatch, createRoute, receiveRouteReturn, registerRouteReturn, setDispatchCoordinates, setRouteOriginCoordinates, startRoute } from "../src/erp/logistics.ts";
import { generateCommission, saveCommissionRule } from "../src/erp/commissions.ts";
import { populatedState } from "./fixtures/populated-state.ts";

test("fractional inventory quantities are retained independently of money rounding", () => {
  const s = populatedState(),
    d = draft(s, "OC", 0.123),
    before = stockOf(s, d.lines[0].productId, d.warehouseId),
    oc = createDocument(s, d);
  receive(s, oc.id, { [d.lines[0].productId]: 0.023 }, d.warehouseId, today());
  receive(s, oc.id, { [d.lines[0].productId]: 0.1 }, d.warehouseId, today());
  assert.equal(oc.status, "Recibida");
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before + 0.123);
});
test("invalid dates and amounts below one cent are rejected", () => {
  const s = populatedState(),
    d = draft(s);
  assert.throws(() => createDocument(s, { ...d, date: "2026-02-30" }));
  const oc = createDocument(s, draft(s, "OC"));
  assert.throws(() =>
    receive(s, oc.id, { [d.lines[0].productId]: 1 }, d.warehouseId, "bad"),
  );
  const cp = invoice(s, createDocument(s, d).id, d.voucher, today());
  assert.throws(() =>
    pay(s, cp.id, {
      date: today(),
      amount: 0.004,
      method: "Efectivo",
      reference: "test",
    }),
  );
});

test("logistics assigns only a capable vehicle, confirms evidence and returns stock through Kardex", () => {
  const s = populatedState();
  const ov = createDocument(s, draft(s));
  invoice(s, ov.id, ov.voucher, today());
  const dispatch = createDispatch(s, { salesOrderId: ov.id, warehouseId: ov.warehouseId, priority: "Normal" });
  const route = createRoute(s, today(), [dispatch.id]);
  setRouteOriginCoordinates(s, route.id, -12.0464, -77.0428);
  setDispatchCoordinates(s, route.id, dispatch.id, -12.05, -77.04);
  const vehicle = addVehicle(s, "ABC-123", "Furgón", 20);
  const driver = addDriver(s, "Ana Torres", "Q12345678", "2030-01-01");
  assignRoute(s, route.id, vehicle.id, driver.id, 0);
  startRoute(s, route.id);
  assert.throws(() => confirmDelivery(s, { dispatchId: dispatch.id, dateTime: "", receiver: "", evidenceUrl: "" }));
  confirmDelivery(s, { dispatchId: dispatch.id, dateTime: "", receiver: "Cliente", evidenceUrl: "https://evidence.test/1" });
  const before = stockOf(s, ov.lines[0].productId, ov.warehouseId);
  registerRouteReturn(s, dispatch.id, ov.lines[0].productId, 1, "Rechazo parcial", "Apto para venta");
  const returned = s.routeReturns[0];
  receiveRouteReturn(s, returned.id, ov.warehouseId, true);
  assert.equal(stockOf(s, ov.lines[0].productId, ov.warehouseId), before + 1);
  assert.equal(returned.status, "Recibida");
});

test("commissions snapshot a valid rule once per invoice", () => {
  const s = populatedState();
  s.sellers = [{ id: "VEN-001", code: "VEN-001", name: "Ana", commissionPct: 0, monthlyTarget: 0, active: true }];
  s.customers[0].sellerId = "VEN-001";
  const ov = createDocument(s, draft(s));
  const cp = invoice(s, ov.id, ov.voucher, today());
  saveCommissionRule(s, { code: "COM-01", name: "Base facturada", basis: "Facturado neto", percentage: 5, validFrom: today(), active: true });
  const commission = generateCommission(s, cp.id);
  assert.equal(commission.amount, Math.round((cp.total / 1.18 * 0.05 + Number.EPSILON) * 100) / 100);
  assert.throws(() => generateCommission(s, cp.id));
});

function draft(state, kind = "OV", quantity = 2) {
  return {
    kind,
    date: today(),
    partyId: (kind === "OC" ? state.suppliers : state.customers)[0].id,
    warehouseId: "ALM-01",
    method: "Crédito 30 días",
    voucher: "Factura electrónica",
    lines: [{ productId: state.products[0].id, quantity, price: 2 }],
    discount: 0,
    freight: 0,
    notes: "",
  };
}
test("purchase order does not change stock; partial and final receptions do", () => {
  const s = populatedState(),
    d = draft(s, "OC", 10),
    before = stockOf(s, d.lines[0].productId, d.warehouseId);
  const oc = createDocument(s, d);
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before);
  const first = receive(
    s,
    oc.id,
    { [d.lines[0].productId]: 4 },
    d.warehouseId,
    today(),
  );
  assert.equal(oc.status, "Recibida parcial");
  assert.equal(first.sourceId, oc.id);
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before + 4);
  receive(s, oc.id, { [d.lines[0].productId]: 6 }, d.warehouseId, today());
  assert.equal(oc.status, "Recibida");
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before + 10);
  assert.throws(() =>
    receive(s, oc.id, { [d.lines[0].productId]: 1 }, d.warehouseId, today()),
  );
});
test("rejects reception larger than outstanding quantity without altering state", () => {
  const s = populatedState(),
    d = draft(s, "OC", 10),
    oc = createDocument(s, d),
    before = JSON.stringify(s);
  assert.throws(() =>
    receive(s, oc.id, { [d.lines[0].productId]: 11 }, d.warehouseId, today()),
  );
  assert.equal(JSON.stringify(s), before);
});

test("receipt request cannot be replayed while a purchase is still partially pending", () => {
  const s = populatedState(),
    d = draft(s, "OC", 10),
    oc = createDocument(s, d);
  const note = receive(
    s,
    oc.id,
    { [d.lines[0].productId]: 4 },
    d.warehouseId,
    today(),
    "receipt-request-test",
  );
  const snapshot = JSON.stringify(s);
  assert.equal(note.balance, 0);
  assert.equal(note.receiptRequestId, "receipt-request-test");
  assert.throws(
    () =>
      receive(
        s,
        oc.id,
        { [d.lines[0].productId]: 4 },
        d.warehouseId,
        today(),
        "receipt-request-test",
      ),
    /ya fue registrada/,
  );
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(oc.received[d.lines[0].productId], 4);
});

test("receipt rejects unknown products and invalid precision without changing documents or inventory", () => {
  const s = populatedState(),
    d = draft(s, "OC", 10),
    oc = createDocument(s, d);
  const snapshot = JSON.stringify(s);
  for (const quantities of [
    { unknown: 1 },
    { [d.lines[0].productId]: 0.0001 },
    { [d.lines[0].productId]: NaN },
  ]) {
    assert.throws(() => receive(s, oc.id, quantities, d.warehouseId, today()));
    assert.equal(JSON.stringify(s), snapshot);
  }
});

test("multi-product receipt changes only the receiving warehouse and creates a matching movement for every line", () => {
  const s = populatedState(),
    d = draft(s, "OC", 10);
  d.lines.push({ productId: s.products[1].id, quantity: 5, price: 3 });
  const oc = createDocument(s, d);
  const originalWarehouse = d.lines.map((l) =>
    stockOf(s, l.productId, "ALM-01"),
  );
  const receivingWarehouse = d.lines.map((l) =>
    stockOf(s, l.productId, "ALM-02"),
  );
  const note = receive(
    s,
    oc.id,
    { [d.lines[0].productId]: 4, [d.lines[1].productId]: 5 },
    "ALM-02",
    today(),
  );
  assert.equal(oc.status, "Recibida parcial");
  const movements = s.movements.filter((m) => m.documentId === note.id);
  assert.equal(movements.length, 2);
  note.lines.forEach((l, i) => {
    assert.equal(stockOf(s, l.productId, "ALM-01"), originalWarehouse[i]);
    assert.equal(
      stockOf(s, l.productId, "ALM-02"),
      receivingWarehouse[i] + l.quantity,
    );
    const movement = movements.find((m) => m.productId === l.productId);
    assert.equal(movement.quantity, l.quantity);
    assert.equal(movement.cost, l.price);
    assert.equal(movement.balance, stockOf(s, l.productId, "ALM-02"));
  });
});
test("sale order does not reduce stock; credit invoice does and creates debt", () => {
  const s = populatedState(),
    d = draft(s),
    before = stockOf(s, d.lines[0].productId, d.warehouseId),
    ov = createDocument(s, d);
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before);
  const cp = invoice(s, ov.id, d.voucher, today());
  assert.equal(cp.balance, 4);
  assert.equal(cp.status, "Pendiente de pago");
  assert.equal(cp.sourceId, ov.id);
  assert.equal(ov.status, "Facturada");
  assert.equal(stockOf(s, d.lines[0].productId, d.warehouseId), before - 2);
  assert.throws(() => invoice(s, ov.id, d.voucher, today()));
});
test("stock is checked again at invoicing when orders compete for stock", () => {
  const s = populatedState(),
    d = draft(s),
    quantity = stockOf(s, d.lines[0].productId, d.warehouseId);
  d.lines[0].quantity = quantity;
  const a = createDocument(s, d),
    b = createDocument(s, d);
  invoice(s, a.id, d.voucher, today());
  const before = JSON.stringify(s);
  assert.throws(
    () => invoice(s, b.id, d.voucher, today()),
    /Stock insuficiente/,
  );
  assert.equal(JSON.stringify(s), before);
});
test("partial payment and settlement preserve stock and reject overpayment", () => {
  const s = populatedState(),
    d = draft(s),
    ov = createDocument(s, d),
    cp = invoice(s, ov.id, d.voucher, today()),
    stock = JSON.stringify(s.stock);
  const payment = { date: today(), method: "Efectivo", reference: "TEST" };
  pay(s, cp.id, { ...payment, amount: 1.5 });
  assert.equal(cp.balance, 2.5);
  assert.equal(cp.status, "Pago parcial");
  const before = JSON.stringify(s);
  assert.throws(() => pay(s, cp.id, { ...payment, amount: 3 }));
  assert.equal(JSON.stringify(s), before);
  pay(s, cp.id, { ...payment, amount: 2.5 });
  assert.equal(cp.status, "Pagada");
  assert.equal(cp.balance, 0);
  assert.equal(JSON.stringify(s.stock), stock);
});
test("cash invoice remains invoiced until payment is registered", () => {
  const s = populatedState(),
    d = draft(s);
  d.method = "Contado";
  const cp = invoice(
    s,
    createDocument(s, d).id,
    "Boleta de venta electrónica",
    today(),
  );
  assert.equal(cp.status, "Pendiente de pago");
  assert.equal(cp.balance, cp.total);
  assert.deepEqual(cp.payments, []);
  assert.equal(cp.statusHistory.at(-1).status, "Pendiente de pago");
  pay(s, cp.id, { date: today(), amount: cp.total, method: "Efectivo", reference: "Cobro" });
  assert.equal(cp.status, "Pagada");
  assert.equal(cp.balance, 0);
  assert.match(cp.number, /^B001-/);
});
test("quotation can propose out-of-stock goods but acceptance checks availability", () => {
  const s = populatedState(),
    d = draft(s, "OV", 9999),
    q = saveQuote(s, { ...d, validity: 15 });
  changeQuote(s, q.id, "send");
  const before = JSON.stringify(s);
  assert.throws(() => changeQuote(s, q.id, "accept"), /Stock insuficiente/);
  assert.equal(JSON.stringify(s), before);
});
test("quotation conversion links order, processing follows invoicing", () => {
  const s = populatedState(),
    d = draft(s),
    q = saveQuote(s, { ...d, validity: 15 });
  changeQuote(s, q.id, "send");
  changeQuote(s, q.id, "accept");
  assert.equal(q.status, "Aceptada");
  const ov = s.documents.find((d) => d.id === q.orderId);
  assert.equal(ov.sourceId, q.id);
  invoice(s, ov.id, d.voucher, today());
  assert.equal(q.status, "Procesada");
  assert.throws(() => changeQuote(s, q.id, "accept"));
  assert.throws(() => saveQuote(s, { ...d, validity: 15 }, q.id));
});
test("credit limit is enforced before inventory mutation", () => {
  const s = populatedState(),
    d = draft(s);
  s.customers[0].credit = 0;
  const ov = createDocument(s, d),
    before = JSON.stringify(s);
  assert.throws(
    () => invoice(s, ov.id, d.voucher, today()),
    /línea de crédito/,
  );
  assert.equal(JSON.stringify(s), before);
});
test("validation rejects duplicate lines, nonfinite values and negative total", () => {
  const s = populatedState(),
    d = draft(s);
  assert.throws(() =>
    createDocument(s, { ...d, lines: [...d.lines, ...d.lines] }),
  );
  assert.throws(() =>
    createDocument(s, { ...d, lines: [{ ...d.lines[0], quantity: NaN }] }),
  );
  assert.throws(() => createDocument(s, { ...d, discount: 999 }));
  assert.equal(
    total([{ productId: "x", quantity: 3, price: 0.1 }], 0.1, 0.05),
    0.25,
  );
});
test("serializing state retains documents, movement links, balances and quotations", () => {
  const s = populatedState(),
    copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy.stock, s.stock);
  assert.deepEqual(copy.quotes, s.quotes);
  assert.deepEqual(copy.movements, s.movements);
  assert.deepEqual(
    copy.documents.map((d) => ({
      number: d.number,
      balance: d.balance,
      sourceId: d.sourceId,
      payments: d.payments,
    })),
    s.documents.map((d) => ({
      number: d.number,
      balance: d.balance,
      sourceId: d.sourceId,
      payments: d.payments,
    })),
  );
  for (const m of copy.movements)
    assert.ok(copy.documents.some((d) => d.id === m.documentId));
  assert.equal(
    new Set(copy.documents.map((d) => d.number)).size,
    copy.documents.length,
  );
  assert.equal(
    new Set(copy.documents.map((d) => d.id)).size,
    copy.documents.length,
  );
});

test("collections generate unique internal references without manual input", () => {
  const s = populatedState(), d = draft(s);
  d.method = "Contado";
  const order = createDocument(s, d);
  const cp = invoice(s, order.id, d.voucher, today());
  const half = Math.round(cp.total * 50) / 100;
  pay(s, cp.id, { date: today(), amount: half, method: "Efectivo" });
  assert.match(cp.payments[0].reference, /^COB-\d{6}$/);
  assert.equal(cp.status, "Pago parcial");
  pay(s, cp.id, { date: today(), amount: cp.balance, method: "Efectivo" });
  assert.notEqual(cp.payments[0].reference, cp.payments[1].reference);
  assert.equal(cp.status, "Pagada");
  assert.equal(order.status, "Facturada");
});


test("quotations require sending and accepted records cannot be deleted", () => {
 const s = populatedState(), d = draft(s), q = saveQuote(s, {...d, validity: 15});
 const stock = structuredClone(s.stock);
 assert.throws(() => changeQuote(s, q.id, "accept"), /Primero envía/);
 changeQuote(s, q.id, "send");
 assert.throws(() => deleteQuote(s, q.id), /Solo puedes eliminar/);
 changeQuote(s, q.id, "accept");
 assert.equal(q.status, "Aceptada");
 assert.equal(s.documents.filter(d => d.sourceId === q.id).length, 1);
 assert.deepEqual(s.stock, stock);
 const before = JSON.stringify(s);
 assert.throws(() => deleteQuote(s, q.id), /Solo puedes eliminar/);
 assert.throws(() => changeQuote(s, q.id, "accept"));
 assert.equal(JSON.stringify(s), before);
 invoice(s, q.orderId, d.voucher, today());
 assert.throws(() => deleteQuote(s, q.id), /Solo puedes eliminar/);
});

test("draft deletion preserves inventory, documents and audit, and prevents stale edits", () => {
 const s = populatedState(), d = draft(s), q = saveQuote(s, {...d, validity: 15});
 const documents = structuredClone(s.documents), stock = structuredClone(s.stock);
 changeQuote(s, q.id, "send");
 changeQuote(s, q.id, "reject");
 assert.equal(q.status, "Borrador");
 deleteQuote(s, q.id);
 assert.equal(s.quotes.some(x => x.id === q.id), false);
 assert.deepEqual(s.documents, documents); assert.deepEqual(s.stock, stock);
 assert.equal(s.audit[0].action, "Eliminar cotización");
 assert.throws(() => saveQuote(s, {...d, validity: 15}, q.id), /ya no existe/);
 assert.throws(() => deleteQuote(s, q.id), /no encontrada/);
 const linked = saveQuote(s, {...d, validity: 15});
 createDocument(s, {...d, kind: "OV"}, linked.id);
 assert.throws(() => deleteQuote(s, linked.id), /Solo puedes eliminar/);
});


test("saved quotations remain drafts until explicitly sent", () => {
 const s = populatedState(), d = {...draft(s), validity:15};
 const quote = saveQuote(s, d, undefined, "Borrador");
 assert.equal(quote.status, "Borrador");
 const ready = saveQuote(s, d, quote.id, "Borrador");
 assert.equal(ready.id, quote.id); assert.equal(ready.status, "Borrador");
 changeQuote(s, ready.id, "send");
 assert.equal(ready.status, "Enviada");
 assert.throws(() => saveQuote(s, d, ready.id, "Borrador"));
 assert.throws(() => deleteQuote(s, ready.id), /Solo puedes eliminar/);
 changeQuote(s, ready.id, "accept");
 assert.equal(ready.status, "Aceptada");
 assert.throws(() => saveQuote(s, d, ready.id, "Borrador"), /vinculada/);
 assert.throws(() => deleteQuote(s, ready.id), /Solo puedes eliminar/);
});


test("cancelling a pending sales order preserves its quote, stock and balances and blocks invoicing",()=>{
 const s=populatedState(), d=draft(s), quote=saveQuote(s,{...d,validity:15});
 changeQuote(s,quote.id,"send"); changeQuote(s,quote.id,"accept");
 const order=s.documents.find(d=>d.id===quote.orderId);
 const stock=structuredClone(s.stock), movements=structuredClone(s.movements);
 const bills=structuredClone(s.documents.filter(d=>d.kind==="CP"));
 cancelSalesOrder(s,order.id);
 assert.equal(order.status,"Cancelada"); assert.equal(order.statusHistory.at(-1).status,"Cancelada");
 assert.equal(s.audit[0].action,"Cancelar pedido de venta"); assert.equal(s.audit[0].record,order.number);
 assert.deepEqual(s.stock,stock); assert.deepEqual(s.movements,movements);
 assert.deepEqual(s.documents.filter(d=>d.kind==="CP"),bills);
 assert.equal(quote.orderId,order.id); assert.equal(quote.status,"Aceptada");
 assert.throws(()=>invoice(s,order.id,d.voucher,today()));
 assert.throws(()=>cancelSalesOrder(s,order.id));
});

test("cancellation checks current invoice links and rejects purchases and missing orders",()=>{
 const s=populatedState(), d=draft(s), order=createDocument(s,d);
 const bill=invoice(s,order.id,d.voucher,today());
 let before=JSON.stringify(s); assert.throws(()=>cancelSalesOrder(s,order.id),/Solo puedes cancelar/); assert.equal(JSON.stringify(s),before);
 order.status="Pendiente"; before=JSON.stringify(s);
 assert.throws(()=>cancelSalesOrder(s,order.id),/Solo puedes cancelar/); assert.equal(JSON.stringify(s),before);
 assert.throws(()=>cancelSalesOrder(s,bill.id),/no encontrado/);
 assert.throws(()=>cancelSalesOrder(s,"unknown"),/no encontrado/);
});


test("purchase cancellation preserves stock and history and prevents future receipt",()=>{
 const s=populatedState(),d=draft(s,"OC"),order=createDocument(s,d);
 const stock=structuredClone(s.stock),moves=structuredClone(s.movements);
 assert.equal(canCancelPurchaseOrder(s,order),true);
 cancelPurchaseOrder(s,order.id);
 assert.equal(order.status,"Cancelada"); assert.equal(order.statusHistory.at(-1).status,"Cancelada");
 assert.equal(s.audit[0].action,"Cancelar orden de compra");
 assert.deepEqual(s.stock,stock); assert.deepEqual(s.movements,moves);
 assert.throws(()=>receive(s,order.id,{[d.lines[0].productId]:1},d.warehouseId,today()));
 assert.throws(()=>cancelPurchaseOrder(s,order.id));
});

test("purchase cancellation rejects partial receipts, linked notes and recorded supplier payments",()=>{
 const s=populatedState(),d=draft(s,"OC"),order=createDocument(s,d);
 receive(s,order.id,{[d.lines[0].productId]:1},d.warehouseId,today());
 assert.equal(canCancelPurchaseOrder(s,order),false);
 assert.throws(()=>cancelPurchaseOrder(s,order.id),/sin recepciones/);
 order.status="Pendiente"; order.received={};
 assert.equal(canCancelPurchaseOrder(s,order),false);
 assert.throws(()=>cancelPurchaseOrder(s,order.id));
 const unpaid=createDocument(s,d);
 s.payables=[{id:"paid",documentId:unpaid.id,supplierId:d.partyId,date:d.date,dueDate:d.date,total:unpaid.total,balance:unpaid.total-1,payments:[]}];
 const before=JSON.stringify(s); assert.throws(()=>cancelPurchaseOrder(s,unpaid.id)); assert.equal(JSON.stringify(s),before);
 assert.throws(()=>cancelPurchaseOrder(s,"missing"),/no encontrada/);
});
