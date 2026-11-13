import type { DeliveryConfirmation, Dispatch, Route, RouteLiquidation, State } from "./model";

let sequence = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const log = (state: State, action: string, record: string) => state.audit.unshift({ id: id("AUD"), date: new Date().toISOString(), action, record });
const number = (state: State, prefix: string, records: { number: string }[]) => `${prefix}-${String(records.filter((item) => item.number.startsWith(prefix)).length + 1).padStart(6, "0")}`;
const units = (state: State, orderId: string) => state.documents.find((document) => document.id === orderId)?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

export function ensureLogisticsData(state: State) {
  let changed = false;
  (["vehicles", "drivers", "dispatches", "routes", "deliveryTracking", "deliveryConfirmations", "routeReturns", "routeLiquidations"] as const).forEach((key) => {
    if (!Array.isArray(state[key])) { (state[key] as unknown) = []; changed = true; }
  });
  return changed;
}

export function createDispatch(state: State, input: Pick<Dispatch, "salesOrderId" | "warehouseId" | "priority" | "deliveryWindow" | "zoneId" | "guideNumber">) {
  ensureLogisticsData(state);
  const order = state.documents.find((document) => document.id === input.salesOrderId && document.kind === "OV");
  if (!order || order.status === "Cancelada") throw Error("Selecciona un pedido de venta vigente.");
  if (!state.warehouses.some((warehouse) => warehouse.id === input.warehouseId && warehouse.active)) throw Error("Selecciona un almacén activo.");
  if (state.dispatches!.some((dispatch) => dispatch.salesOrderId === input.salesOrderId && !["Entregado", "Cerrado", "Cancelado"].includes(dispatch.status))) throw Error("El pedido ya tiene un despacho activo.");
  const customer = state.customers.find((party) => party.id === order.partyId);
  const dispatch: Dispatch = { id: id("DES"), number: number(state, "DES", state.dispatches!), date: new Date().toISOString().slice(0, 10), salesOrderId: order.id, warehouseId: input.warehouseId, zoneId: input.zoneId ?? customer?.zoneId, priority: input.priority, deliveryWindow: input.deliveryWindow, deliveryAddress: customer?.address ?? "", capacityUnits: units(state, order.id), guideNumber: input.guideNumber?.trim() || undefined, status: "Planificado", createdAt: new Date().toISOString() };
  state.dispatches!.unshift(dispatch); log(state, "Planificar despacho", `${dispatch.number} · ${order.number}`); return dispatch;
}

export function addVehicle(state: State, plate: string, description: string, capacityUnits: number) {
  ensureLogisticsData(state);
  if (!plate.trim() || !description.trim() || !Number.isFinite(capacityUnits) || capacityUnits <= 0 || state.vehicles!.some((vehicle) => vehicle.plate.toLowerCase() === plate.trim().toLowerCase())) throw Error("Revisa placa, descripción, capacidad y duplicados del vehículo.");
  const vehicle = { id: id("VEH"), code: `VEH-${String(state.vehicles!.length + 1).padStart(3, "0")}`, plate: plate.trim().toUpperCase(), description: description.trim(), capacityUnits, odometer: 0, active: true };
  state.vehicles!.unshift(vehicle); log(state, "Crear vehículo", `${vehicle.plate} · ${vehicle.description}`); return vehicle;
}

export function addDriver(state: State, name: string, license: string, licenseExpiresOn: string, phone?: string) {
  ensureLogisticsData(state);
  if (!name.trim() || !license.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiresOn) || state.drivers!.some((driver) => driver.license.toLowerCase() === license.trim().toLowerCase())) throw Error("Revisa nombre, licencia, vencimiento y duplicados del conductor.");
  const driver = { id: id("CON"), code: `CON-${String(state.drivers!.length + 1).padStart(3, "0")}`, name: name.trim(), license: license.trim().toUpperCase(), licenseExpiresOn, phone: phone?.trim() || undefined, active: true };
  state.drivers!.unshift(driver); log(state, "Crear conductor", `${driver.code} · ${driver.name}`); return driver;
}

export function createRoute(state: State, date: string, dispatchIds: string[], zoneId?: string) {
  ensureLogisticsData(state);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dispatchIds.length || new Set(dispatchIds).size !== dispatchIds.length) throw Error("Selecciona despachos únicos y una fecha válida.");
  const dispatches = dispatchIds.map((dispatchId) => state.dispatches!.find((dispatch) => dispatch.id === dispatchId));
  if (dispatches.some((dispatch) => !dispatch || !["Planificado", "Asignado"].includes(dispatch.status) || dispatch.routeId)) throw Error("Todos los despachos deben estar planificados y sin ruta.");
  const route: Route = { id: id("RUT"), number: number(state, "RUT", state.routes!), date, zoneId, dispatchIds, capacityUnits: dispatchIds.reduce((sum, dispatchId) => sum + (state.dispatches!.find((dispatch) => dispatch.id === dispatchId)?.capacityUnits ?? 0), 0), status: "Borrador" };
  state.routes!.unshift(route); dispatches.forEach((dispatch) => { if (dispatch) { dispatch.routeId = route.id; dispatch.status = "Asignado"; } });
  log(state, "Programar ruta", `${route.number} · ${dispatchIds.length} despachos`); return route;
}

export function assignRoute(state: State, routeId: string, vehicleId: string, driverId: string, initialMileage: number) {
  ensureLogisticsData(state);
  const route = state.routes!.find((item) => item.id === routeId);
  const vehicle = state.vehicles!.find((item) => item.id === vehicleId && item.active);
  const driver = state.drivers!.find((item) => item.id === driverId && item.active);
  if (!route || route.status !== "Borrador" || !vehicle || !driver) throw Error("La ruta, el vehículo o el conductor no están disponibles.");
  if (driver.licenseExpiresOn < route.date) throw Error("La licencia del conductor no está vigente para la fecha de ruta.");
  if (vehicle.capacityUnits < route.capacityUnits) throw Error("La capacidad del vehículo no cubre los despachos asignados.");
  if (!Number.isFinite(initialMileage) || initialMileage < vehicle.odometer) throw Error("El kilometraje inicial no es válido.");
  route.vehicleId = vehicleId; route.driverId = driverId; route.initialMileage = initialMileage; route.status = "Programada";
  log(state, "Asignar ruta", `${route.number} · ${vehicle.plate} · ${driver.name}`);
}

export function startRoute(state: State, routeId: string) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (!route || route.status !== "Programada" || !route.vehicleId || !route.driverId) throw Error("La ruta debe tener vehículo y conductor asignados.");
  const invalid = route.dispatchIds.some((dispatchId) => {
    const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
    return !dispatch || !state.documents.some((document) => document.kind === "CP" && document.sourceId === dispatch.salesOrderId);
  });
  if (invalid) throw Error("Solo pueden salir despachos con comprobante emitido.");
  route.status = "En ruta"; route.dispatchIds.forEach((dispatchId) => { const dispatch = state.dispatches?.find((item) => item.id === dispatchId); if (dispatch) dispatch.status = "En ruta"; });
  log(state, "Iniciar ruta", route.number);
}

export function addTracking(state: State, dispatchId: string, status: string, observation?: string, latitude?: number, longitude?: number) {
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  if (!dispatch || dispatch.status !== "En ruta" || !status.trim()) throw Error("El despacho debe estar en ruta y el evento debe tener estado.");
  state.deliveryTracking!.unshift({ id: id("SEG"), dispatchId, dateTime: new Date().toISOString(), status: status.trim(), observation: observation?.trim() || undefined, latitude, longitude });
  log(state, "Seguimiento de despacho", `${dispatch.number} · ${status}`);
}

export function confirmDelivery(state: State, input: DeliveryConfirmation) {
  const dispatch = state.dispatches?.find((item) => item.id === input.dispatchId);
  if (!dispatch || dispatch.status !== "En ruta" || !input.receiver.trim() || !input.evidenceUrl?.trim()) throw Error("La entrega exige despacho en ruta, receptor y una evidencia verificable.");
  if (state.deliveryConfirmations!.some((item) => item.dispatchId === input.dispatchId)) throw Error("El despacho ya fue confirmado.");
  state.deliveryConfirmations!.unshift({ ...input, receiver: input.receiver.trim(), evidenceUrl: input.evidenceUrl.trim(), dateTime: new Date().toISOString() }); dispatch.status = "Entregado";
  log(state, "Confirmar entrega", `${dispatch.number} · ${input.receiver.trim()}`);
}

export function registerRouteReturn(state: State, dispatchId: string, productId: string, quantity: number, reason: string, condition: "Apto para venta" | "Dañado" | "Pendiente de revisión", returnDocument?: string) {
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  const order = dispatch && state.documents.find((item) => item.id === dispatch.salesOrderId);
  const ordered = order?.lines.find((line) => line.productId === productId)?.quantity ?? 0;
  const returned = state.routeReturns!.filter((item) => item.dispatchId === dispatchId && item.productId === productId && item.status !== "Rechazada").reduce((sum, item) => sum + item.quantity, 0);
  if (!dispatch || !Number.isFinite(quantity) || quantity <= 0 || quantity + returned > ordered || !reason.trim()) throw Error("La devolución debe pertenecer al despacho y no superar lo entregado.");
  state.routeReturns!.unshift({ id: id("DEV"), dispatchId, productId, quantity, reason: reason.trim(), condition, returnDocument: returnDocument?.trim() || undefined, status: "Pendiente de recepción" });
  log(state, "Registrar devolución de ruta", dispatch.number);
}

export function receiveRouteReturn(state: State, returnId: string, warehouseId: string, acceptToStock: boolean) {
  const returned = state.routeReturns?.find((item) => item.id === returnId);
  const dispatch = returned && state.dispatches?.find((item) => item.id === returned.dispatchId);
  if (!returned || !dispatch || returned.status !== "Pendiente de recepción") throw Error("La devolución ya fue procesada o no existe.");
  if (!state.warehouses.some((warehouse) => warehouse.id === warehouseId && warehouse.active)) throw Error("Selecciona un almacén activo.");
  if (!acceptToStock || returned.condition !== "Apto para venta") { returned.status = "Rechazada"; log(state, "Rechazar devolución de ruta", returned.id); return; }
  const before = state.stock[returned.productId]?.[warehouseId] ?? 0;
  const movementId = id("MOV");
  state.stock[returned.productId] = { ...state.stock[returned.productId], [warehouseId]: Math.round((before + returned.quantity) * 1000) / 1000 };
  state.movements.unshift({ id: movementId, date: new Date().toISOString().slice(0, 10), documentId: returned.id, productId: returned.productId, warehouseId, partyId: state.documents.find((document) => document.id === dispatch.salesOrderId)?.partyId ?? "", type: "Entrada", quantity: returned.quantity, balance: state.stock[returned.productId][warehouseId], cost: state.products.find((product) => product.id === returned.productId)?.cost ?? 0 });
  returned.status = "Recibida"; returned.movementId = movementId; log(state, "Recibir devolución en almacén", `${dispatch.number} → ${returned.id}`);
}

export function saveLiquidation(state: State, input: Omit<RouteLiquidation, "id">) {
  if (!state.routes?.some((route) => route.id === input.routeId) || [input.fuel, input.tolls, input.otherExpenses, input.collections, input.returnsAmount].some((value) => !Number.isFinite(value) || value < 0) || !input.responsible.trim()) throw Error("Revisa la ruta, los importes y el responsable de la liquidación.");
  const liquidation = { ...input, id: id("LIQ") }; state.routeLiquidations!.unshift(liquidation); log(state, "Registrar liquidación de ruta", state.routes.find((route) => route.id === input.routeId)!.number); return liquidation;
}
