import type { State } from "./model.ts";

// Removes only explicitly simulated operational records, preserving real catalog data.
export function clearDemoOperations(state: State): boolean {
  const demoDocumentIds = new Set(
    state.documents.filter((document) => document.demo).map((document) => document.id),
  );
  const demoQuoteIds = new Set(
    state.quotes.filter((quote) => quote.demo).map((quote) => quote.id),
  );
  const removedReferences = new Set([...demoDocumentIds, ...demoQuoteIds]);
  let changed = false;

  state.movements = state.movements.filter((movement) => {
    if (!demoDocumentIds.has(movement.documentId)) return true;
    const warehouseStock = (state.stock[movement.productId] ??= {});
    warehouseStock[movement.warehouseId] =
      (warehouseStock[movement.warehouseId] ?? 0) +
      (movement.type === "Entrada" ? -movement.quantity : movement.quantity);
    changed = true;
    return false;
  });
  state.documents = state.documents.filter((document) => {
    const remove = demoDocumentIds.has(document.id);
    changed ||= remove;
    return !remove;
  });
  state.quotes = state.quotes.filter((quote) => {
    const remove = demoQuoteIds.has(quote.id);
    changed ||= remove;
    return !remove;
  });
  for (const document of state.documents) {
    if (document.sourceId && removedReferences.has(document.sourceId)) {
      document.sourceId = undefined;
      changed = true;
    }
  }
  for (const quote of state.quotes) {
    if (quote.orderId && demoDocumentIds.has(quote.orderId)) {
      quote.orderId = undefined;
      changed = true;
    }
  }
  if (state.payables) {
    state.payables = state.payables.filter((payable) => {
      const remove = payable.demo || demoDocumentIds.has(payable.documentId);
      changed ||= remove;
      return !remove;
    });
  }
  if (state.inventoryValuations) {
    state.inventoryValuations = state.inventoryValuations.filter((valuation) => {
      const remove = valuation.demo === true;
      changed ||= remove;
      return !remove;
    });
  }
  if (state.demoDashboardVersion !== 1) {
    state.demoDashboardVersion = 1;
    changed = true;
  }
  return changed;
}

// Remove only the integrated sample sales flow and its logistics artifacts.
// Purchases and received stock remain; outbound sample sales are reversed.
export function clearIntegratedDemoSalesAndLogistics(state: State): boolean {
  if (state.integratedSalesLogisticsCleanupVersion === 1) return false;
  const demoOrders = state.documents.filter(
    (document) =>
      document.kind === "OV" &&
      document.notes === "Registro simulado para validar ventas y cobranzas.",
  );
  const demoOrderIds = new Set(demoOrders.map((document) => document.id));
  const demoInvoiceIds = new Set(
    state.documents
      .filter((document) => document.kind === "CP" && document.sourceId && demoOrderIds.has(document.sourceId))
      .map((document) => document.id),
  );
  const demoDispatches = (state.dispatches ?? []).filter((dispatch) => demoOrderIds.has(dispatch.salesOrderId));
  const demoDispatchIds = new Set(demoDispatches.map((dispatch) => dispatch.id));
  const affectedRoutes = (state.routes ?? []).filter((route) => route.dispatchIds.some((id) => demoDispatchIds.has(id)));
  const affectedRouteIds = new Set(affectedRoutes.map((route) => route.id));
  const demoReturns = (state.routeReturns ?? []).filter((item) => demoDispatchIds.has(item.dispatchId));
  const demoReturnMovementIds = new Set(demoReturns.flatMap((item) => item.movementId ? [item.movementId] : []));
  const removedCommissionIds = new Set(
    (state.generatedCommissions ?? [])
      .filter((commission) => demoInvoiceIds.has(commission.invoiceId) && commission.status === "Generada")
      .map((commission) => commission.id),
  );
  let changed = false;

  state.movements = state.movements.filter((movement) => {
    const isDemoSale = demoInvoiceIds.has(movement.documentId);
    const isDemoReturn = demoReturnMovementIds.has(movement.id);
    if (!isDemoSale && !isDemoReturn) return true;
    const current = state.stock[movement.productId]?.[movement.warehouseId] ?? 0;
    const correction = movement.type === "Entrada" ? -movement.quantity : movement.quantity;
    state.stock[movement.productId] = {
      ...state.stock[movement.productId],
      [movement.warehouseId]: Math.round((current + correction) * 1000) / 1000,
    };
    changed = true;
    return false;
  });
  state.documents = state.documents.filter((document) => {
    const remove = demoOrderIds.has(document.id) || demoInvoiceIds.has(document.id);
    changed ||= remove;
    return !remove;
  });
  for (const quote of state.quotes) {
    if (quote.orderId && demoOrderIds.has(quote.orderId)) {
      quote.orderId = undefined;
      if (quote.status === "Procesada") quote.status = "Aceptada";
      changed = true;
    }
  }
  state.dispatches = (state.dispatches ?? []).filter((dispatch) => {
    const remove = demoDispatchIds.has(dispatch.id);
    changed ||= remove;
    return !remove;
  });
  state.routes = (state.routes ?? []).flatMap((route) => {
    if (!affectedRouteIds.has(route.id)) return [route];
    const remainingDispatchIds = route.dispatchIds.filter((id) => !demoDispatchIds.has(id));
    if (!remainingDispatchIds.length) {
      changed = true;
      return [];
    }
    route.dispatchIds = remainingDispatchIds;
    route.capacityUnits = remainingDispatchIds.reduce(
      (sum, dispatchId) => sum + (state.dispatches?.find((dispatch) => dispatch.id === dispatchId)?.capacityUnits ?? 0),
      0,
    );
    changed = true;
    return [route];
  });
  state.deliveryTracking = (state.deliveryTracking ?? []).filter((item) => {
    const remove = demoDispatchIds.has(item.dispatchId);
    changed ||= remove;
    return !remove;
  });
  state.deliveryConfirmations = (state.deliveryConfirmations ?? []).filter((item) => {
    const remove = demoDispatchIds.has(item.dispatchId);
    changed ||= remove;
    return !remove;
  });
  state.routeReturns = (state.routeReturns ?? []).filter((item) => {
    const remove = demoDispatchIds.has(item.dispatchId);
    changed ||= remove;
    return !remove;
  });
  state.routeLiquidations = (state.routeLiquidations ?? []).filter((item) => {
    const remove = affectedRouteIds.has(item.routeId);
    changed ||= remove;
    return !remove;
  });
  state.generatedCommissions = (state.generatedCommissions ?? []).filter((item) => {
    const remove = removedCommissionIds.has(item.id);
    changed ||= remove;
    return !remove;
  });
  state.commissionAdjustments = (state.commissionAdjustments ?? []).filter((item) => {
    const remove = removedCommissionIds.has(item.commissionId);
    changed ||= remove;
    return !remove;
  });
  state.commissionSettlements = (state.commissionSettlements ?? []).flatMap((settlement) => {
    const remainingIds = settlement.commissionIds.filter((id) => !removedCommissionIds.has(id));
    if (remainingIds.length === settlement.commissionIds.length) return [settlement];
    if (!remainingIds.length && settlement.status !== "Pagada") {
      changed = true;
      return [];
    }
    const remainingCommissions = (state.generatedCommissions ?? []).filter((item) => remainingIds.includes(item.id));
    settlement.commissionIds = remainingIds;
    if (settlement.status !== "Pagada") {
      settlement.grossAmount = Math.round(remainingCommissions.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
      settlement.adjustments = Math.round((state.commissionAdjustments ?? [])
        .filter((item) => item.status === "Aprobado" && remainingIds.includes(item.commissionId))
        .reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
      settlement.netAmount = Math.round((settlement.grossAmount + settlement.adjustments) * 100) / 100;
    }
    changed = true;
    return [settlement];
  });
  state.integratedSalesLogisticsCleanupVersion = 1;
  changed = true;
  if (demoOrders.length || demoDispatches.length) {
    state.audit.unshift({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      action: "Limpiar datos demo de ventas y logística",
      record: `${demoOrders.length} pedidos · ${demoDispatches.length} despachos · stock de salida revertido`,
    });
  }
  return changed;
}

// One-time transition to an empty operational ledger. Keep all existing
// categories, warehouses and company settings exactly as stored.
export function cleanBusinessData(state: State): boolean {
  if (state.businessCleanupVersion === 1) return false;
  state.products = [];
  state.customers = [];
  state.suppliers = [];
  state.documents = [];
  state.quotes = [];
  state.movements = [];
  state.stock = {};
  state.audit = [];
  state.payables = [];
  state.inventoryValuations = [];
  state.users = state.users?.filter((user) => ![
    "USR-002|ana.torres@enterprisecloud.pe|Ana Torres",
    "USR-003|diego.salazar@enterprisecloud.pe|Diego Salazar",
    "USR-004|lucia.mendoza@enterprisecloud.pe|Lucía Mendoza",
    "USR-005|marco.rivas@enterprisecloud.pe|Marco Rivas",
  ].includes(`${user.id}|${user.email}|${user.name}`));
  delete state.clearedOperationDates;
  delete state.demoDashboardVersion;
  delete state.integratedDemoVersion;
  state.businessCleanupVersion = 1;
  return true;
}
