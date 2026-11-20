import type {
  DeliveryConfirmation,
  Dispatch,
  Route,
  RouteLiquidation,
  State,
} from "./model.ts";
import { today } from "./model.ts";

let sequence = 0;
const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const log = (state: State, action: string, record: string) =>
  state.audit.unshift({
    id: id("AUD"),
    date: new Date().toISOString(),
    action,
    record,
  });
const nextNumber = (prefix: string, records: { number: string }[]) => {
  const maximum = records.reduce((value, item) => {
    const suffix = Number(item.number.replace(`${prefix}-`, ""));
    return Number.isFinite(suffix) ? Math.max(value, suffix) : value;
  }, 0);
  return `${prefix}-${String(maximum + 1).padStart(6, "0")}`;
};
const nextCode = (prefix: string, records: { code: string }[]) => {
  const maximum = records.reduce((value, item) => {
    const suffix = Number(item.code.replace(`${prefix}-`, ""));
    return Number.isFinite(suffix) ? Math.max(value, suffix) : value;
  }, 0);
  return `${prefix}-${String(maximum + 1).padStart(3, "0")}`;
};
const orderFor = (state: State, orderId: string) =>
  state.documents.find(
    (document) => document.id === orderId && document.kind === "OV",
  );
const units = (state: State, orderId: string) =>
  orderFor(state, orderId)?.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  ) ?? 0;
const isRouteResourceInUse = (
  state: State,
  route: Route,
  resourceId: string,
  field: "vehicleId" | "driverId",
) =>
  state.routes!.some(
    (other) =>
      other.id !== route.id &&
      other.date === route.date &&
      other[field] === resourceId &&
      !["Cerrada", "Cancelada"].includes(other.status),
  );

export function ensureLogisticsData(state: State) {
  let changed = false;
  (
    [
      "vehicles",
      "drivers",
      "dispatches",
      "routes",
      "deliveryTracking",
      "deliveryConfirmations",
      "routeReturns",
      "routeLiquidations",
    ] as const
  ).forEach((key) => {
    if (!Array.isArray(state[key])) {
      (state[key] as unknown) = [];
      changed = true;
    }
  });
  state.dispatches!.forEach((dispatch) => {
    if (!Array.isArray(dispatch.lines)) {
      dispatch.lines =
        orderFor(state, dispatch.salesOrderId)?.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })) ?? [];
      changed = true;
    }
  });
  return changed;
}

export function createDispatch(
  state: State,
  input: Pick<
    Dispatch,
    "salesOrderId" | "warehouseId" | "priority" | "deliveryWindow"
  > &
    Partial<
      Pick<
        Dispatch,
        | "zoneId"
        | "guideNumber"
        | "deliveryAddress"
        | "deliveryContact"
        | "deliveryPhone"
      >
    >,
) {
  ensureLogisticsData(state);
  const order = orderFor(state, input.salesOrderId);
  if (!order || !["Pendiente", "Facturada"].includes(order.status)) {
    throw Error("El despacho requiere una orden pendiente o facturada.");
  }
  if (
    !state.warehouses.some(
      (warehouse) => warehouse.id === input.warehouseId && warehouse.active,
    )
  ) {
    throw Error("Selecciona un almacén activo.");
  }
  if (
    state.dispatches!.some(
      (dispatch) =>
        dispatch.salesOrderId === input.salesOrderId &&
        dispatch.status !== "Cancelado",
    )
  ) {
    throw Error("El pedido ya tiene un despacho registrado.");
  }
  const customer = state.customers.find((party) => party.id === order.partyId);
  const dispatch: Dispatch = {
    id: id("DES"),
    number: nextNumber("DES", state.dispatches!),
    date: new Date().toISOString().slice(0, 10),
    salesOrderId: order.id,
    warehouseId: input.warehouseId,
    zoneId: input.zoneId ?? customer?.zoneId,
    priority: input.priority,
    deliveryWindow: input.deliveryWindow?.trim() || undefined,
    deliveryAddress:
      input.deliveryAddress?.trim() ||
      order.deliveryAddress ||
      customer?.address ||
      "",
    deliveryContact:
      input.deliveryContact?.trim() || customer?.contact || undefined,
    deliveryPhone: input.deliveryPhone?.trim() || customer?.phone || undefined,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
    capacityUnits: units(state, order.id),
    guideNumber: input.guideNumber?.trim() || undefined,
    status: "Planificado",
    createdAt: new Date().toISOString(),
  };
  if (!dispatch.deliveryAddress) {
    throw Error(
      "Agrega la dirección de entrega al pedido antes de crear el despacho.",
    );
  }
  state.dispatches!.unshift(dispatch);
  log(state, "Planificar despacho", `${dispatch.number} · ${order.number}`);
  return dispatch;
}

export function addVehicle(
  state: State,
  plate: string,
  description: string,
  capacityUnits: number,
) {
  ensureLogisticsData(state);
  const normalizedPlate = plate.trim().toUpperCase();
  if (
    !normalizedPlate ||
    !description.trim() ||
    !Number.isFinite(capacityUnits) ||
    capacityUnits <= 0 ||
    state.vehicles!.some(
      (vehicle) => vehicle.plate.toUpperCase() === normalizedPlate,
    )
  ) {
    throw Error(
      "Revisa placa, descripción, capacidad y duplicados del vehículo.",
    );
  }
  const vehicle = {
    id: id("VEH"),
    code: nextCode("VEH", state.vehicles!),
    plate: normalizedPlate,
    description: description.trim(),
    capacityUnits,
    odometer: 0,
    active: true,
  };
  state.vehicles!.unshift(vehicle);
  log(state, "Crear vehículo", `${vehicle.plate} · ${vehicle.description}`);
  return vehicle;
}

export function addDriver(
  state: State,
  name: string,
  license: string,
  licenseExpiresOn: string,
  phone?: string,
) {
  ensureLogisticsData(state);
  const normalizedLicense = license.trim().toUpperCase();
  if (
    !name.trim() ||
    !normalizedLicense ||
    !/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiresOn) ||
    state.drivers!.some(
      (driver) => driver.license.toUpperCase() === normalizedLicense,
    )
  ) {
    throw Error(
      "Revisa nombre, licencia, vencimiento y duplicados del conductor.",
    );
  }
  const driver = {
    id: id("CON"),
    code: nextCode("CON", state.drivers!),
    name: name.trim(),
    license: normalizedLicense,
    licenseExpiresOn,
    phone: phone?.trim() || undefined,
    active: true,
  };
  state.drivers!.unshift(driver);
  log(state, "Crear conductor", `${driver.code} · ${driver.name}`);
  return driver;
}

export function createRoute(
  state: State,
  date: string,
  dispatchIds: string[],
  zoneId?: string,
  originAddress?: string,
) {
  ensureLogisticsData(state);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < today() ||
    !dispatchIds.length ||
    dispatchIds.length > 25 ||
    new Set(dispatchIds).size !== dispatchIds.length
  ) {
    throw Error("Selecciona hasta 25 despachos únicos y una fecha de hoy o futura.");
  }
  const dispatches = dispatchIds.map((dispatchId) =>
    state.dispatches!.find((dispatch) => dispatch.id === dispatchId),
  );
  if (
    dispatches.some(
      (dispatch) =>
        !dispatch ||
        !["Planificado", "Asignado"].includes(dispatch.status) ||
        dispatch.routeId,
    )
  ) {
    throw Error("Todos los despachos deben estar planificados y sin ruta.");
  }
  const route: Route = {
    id: id("RUT"),
    number: nextNumber("RUT", state.routes!),
    date,
    originAddress: originAddress?.trim() || undefined,
    zoneId,
    dispatchIds: [...dispatchIds],
    capacityUnits: dispatches.reduce(
      (sum, dispatch) => sum + (dispatch?.capacityUnits ?? 0),
      0,
    ),
    status: "Borrador",
  };
  state.routes!.unshift(route);
  dispatches.forEach((dispatch) => {
    if (dispatch) {
      dispatch.routeId = route.id;
      dispatch.status = "Asignado";
    }
  });
  log(
    state,
    "Programar ruta",
    `${route.number} · ${dispatchIds.length} despachos`,
  );
  return route;
}

export function cancelRoute(state: State, routeId: string) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (!route || route.status !== "Borrador") {
    throw Error("Solo se pueden cancelar hojas de ruta en borrador.");
  }
  const dispatches = route.dispatchIds.map((dispatchId) =>
    state.dispatches?.find((item) => item.id === dispatchId),
  );
  if (
    dispatches.some(
      (dispatch) =>
        !dispatch ||
        dispatch.status !== "Asignado" ||
        dispatch.routeId !== route.id,
    )
  ) {
    throw Error("La ruta tiene despachos que ya no se pueden cancelar.");
  }
  route.status = "Cancelada";
  dispatches.forEach((dispatch) => {
    if (dispatch) dispatch.status = "Cancelado";
  });
  log(state, "Cancelar hoja de ruta", `${route.number} · ${dispatches.length} despachos`);
}

export function setRouteOriginCoordinates(
  state: State,
  routeId: string,
  latitude: number,
  longitude: number,
  geoLabel?: string,
) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (!route || !["Borrador", "Programada"].includes(route.status)) {
    throw Error("Solo puedes ajustar el origen de una ruta no iniciada.");
  }
  validateCoordinates(latitude, longitude);
  route.originLat = latitude;
  route.originLng = longitude;
  route.originGeoLabel = geoLabel?.trim() || undefined;
  log(state, "Ubicar origen de ruta", `${route.number} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
}

export function setDispatchCoordinates(
  state: State,
  routeId: string,
  dispatchId: string,
  latitude: number,
  longitude: number,
  geoLabel?: string,
) {
  const route = state.routes?.find((item) => item.id === routeId);
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  if (
    !route ||
    !["Borrador", "Programada"].includes(route.status) ||
    !route.dispatchIds.includes(dispatchId) ||
    !dispatch ||
    dispatch.routeId !== route.id
  ) {
    throw Error("Solo puedes ubicar paradas de una ruta no iniciada.");
  }
  validateCoordinates(latitude, longitude);
  dispatch.deliveryLat = latitude;
  dispatch.deliveryLng = longitude;
  dispatch.deliveryGeoLabel = geoLabel?.trim() || undefined;
  log(state, "Ubicar parada de entrega", `${dispatch.number} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
}

function validateCoordinates(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -85.051129 ||
    latitude > 85.051129 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw Error("Selecciona una ubicación válida en el mapa.");
  }
}

export function reorderRouteStops(
  state: State,
  routeId: string,
  dispatchIds: string[],
) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (
    !route ||
    !["Borrador", "Programada"].includes(route.status) ||
    dispatchIds.length !== route.dispatchIds.length ||
    new Set(dispatchIds).size !== dispatchIds.length ||
    dispatchIds.some((id) => !route.dispatchIds.includes(id))
  ) {
    throw Error("No se pudo actualizar el orden de paradas de esta ruta.");
  }
  route.dispatchIds = [...dispatchIds];
  log(state, "Optimizar paradas", route.number);
}

export function assignRoute(
  state: State,
  routeId: string,
  vehicleId: string,
  driverId: string,
  initialMileage?: number,
) {
  ensureLogisticsData(state);
  const route = state.routes!.find((item) => item.id === routeId);
  const vehicle = state.vehicles!.find(
    (item) => item.id === vehicleId && item.active,
  );
  const driver = state.drivers!.find(
    (item) => item.id === driverId && item.active,
  );
  if (!route || route.status !== "Borrador" || !vehicle || !driver) {
    throw Error("La ruta, el vehículo o el conductor no están disponibles.");
  }
  if (driver.licenseExpiresOn < route.date) {
    throw Error(
      "La licencia del conductor no está vigente para la fecha de ruta.",
    );
  }
  if (vehicle.capacityUnits < route.capacityUnits) {
    throw Error("La capacidad del vehículo no cubre los despachos asignados.");
  }
  if (isRouteResourceInUse(state, route, vehicleId, "vehicleId")) {
    throw Error("El vehículo ya está asignado a otra ruta en esa fecha.");
  }
  if (isRouteResourceInUse(state, route, driverId, "driverId")) {
    throw Error("El conductor ya está asignado a otra ruta en esa fecha.");
  }
  const mileage = initialMileage ?? vehicle.odometer;
  if (!Number.isFinite(mileage) || mileage < vehicle.odometer) {
    throw Error(
      "El kilometraje inicial no puede ser menor que el odómetro registrado.",
    );
  }
  route.vehicleId = vehicleId;
  route.driverId = driverId;
  route.initialMileage = mileage;
  route.status = "Programada";
  log(
    state,
    "Asignar ruta",
    `${route.number} · ${vehicle.plate} · ${driver.name}`,
  );
}

export function startRoute(state: State, routeId: string) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (
    !route ||
    route.status !== "Programada" ||
    !route.vehicleId ||
    !route.driverId
  ) {
    throw Error("La ruta debe tener vehículo y conductor asignados.");
  }
  if (route.originLat == null || route.originLng == null) {
    throw Error("Ubica el origen en el mapa antes de iniciar la ruta.");
  }
  const invalid = route.dispatchIds.some((dispatchId) => {
    const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
    return (
      !dispatch ||
      dispatch.status !== "Asignado" ||
      !Number.isFinite(dispatch.deliveryLat) ||
      !Number.isFinite(dispatch.deliveryLng) ||
      !state.documents.some(
        (document) =>
          document.kind === "CP" && document.sourceId === dispatch.salesOrderId,
      )
    );
  });
  if (invalid) {
    throw Error(
      "Cada parada necesita ubicación en el mapa y un comprobante emitido antes de salir.",
    );
  }
  route.status = "En ruta";
  route.startedAt = new Date().toISOString();
  route.dispatchIds.forEach((dispatchId) => {
    const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
    if (dispatch) dispatch.status = "En ruta";
  });
  log(state, "Iniciar ruta", route.number);
}

export function addTracking(
  state: State,
  dispatchId: string,
  status: string,
  observation?: string,
  latitude?: number,
  longitude?: number,
) {
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  if (!dispatch || dispatch.status !== "En ruta" || !status.trim()) {
    throw Error(
      "El despacho debe estar en ruta y el evento debe tener estado.",
    );
  }
  if (!["En tránsito", "En destino", "Esperando recepción", "Incidencia en ruta", "Entrega fallida"].includes(status)) {
    throw Error("Selecciona un estado válido para el seguimiento.");
  }
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw Error("Registra latitud y longitud juntas para ubicar el evento.");
  }
  if (status === "Incidencia en ruta" && !observation?.trim()) {
    throw Error("Describe la incidencia antes de guardarla.");
  }
  if (
    (latitude !== undefined &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== undefined &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    throw Error("Las coordenadas del seguimiento no son válidas.");
  }
  state.deliveryTracking!.unshift({
    id: id("SEG"),
    dispatchId,
    dateTime: new Date().toISOString(),
    status: status.trim(),
    observation: observation?.trim() || undefined,
    latitude,
    longitude,
  });
  log(
    state,
    "Seguimiento de despacho",
    `${dispatch.number} · ${status.trim()}`,
  );
}

export function markDeliveryFailed(
  state: State,
  dispatchId: string,
  reason: string,
) {
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  if (!dispatch || dispatch.status !== "En ruta" || !reason.trim()) {
    throw Error("Registra el motivo de una entrega fallida en ruta.");
  }
  addTracking(state, dispatchId, "Entrega fallida", reason);
  dispatch.status = "Entrega fallida";
  log(
    state,
    "Registrar entrega fallida",
    `${dispatch.number} · ${reason.trim()}`,
  );
}

export function confirmDelivery(state: State, input: DeliveryConfirmation) {
  const dispatch = state.dispatches?.find(
    (item) => item.id === input.dispatchId,
  );
  let evidenceUrl: URL | undefined;
  try {
    evidenceUrl = new URL(input.evidenceUrl ?? "");
  } catch {
    throw Error("Agrega un enlace válido para la evidencia de entrega.");
  }
  if (
    !dispatch ||
    dispatch.status !== "En ruta" ||
    !input.receiver.trim() ||
    !["https:", "http:"].includes(evidenceUrl.protocol)
  ) {
    throw Error(
      "La entrega exige despacho en ruta, receptor y evidencia válida.",
    );
  }
  if (
    state.deliveryConfirmations!.some(
      (item) => item.dispatchId === input.dispatchId,
    )
  ) {
    throw Error("El despacho ya fue confirmado.");
  }
  state.deliveryConfirmations!.unshift({
    ...input,
    receiver: input.receiver.trim(),
    evidenceUrl: evidenceUrl.href,
    dateTime: new Date().toISOString(),
  });
  dispatch.status = "Entregado";
  log(
    state,
    "Confirmar entrega",
    `${dispatch.number} · ${input.receiver.trim()}`,
  );
}

export function closeRoute(
  state: State,
  routeId: string,
  finalMileage: number,
) {
  const route = state.routes?.find((item) => item.id === routeId);
  if (!route || route.status !== "En ruta") {
    throw Error("Solo se puede cerrar una ruta que está en curso.");
  }
  if (
    !Number.isFinite(finalMileage) ||
    finalMileage < (route.initialMileage ?? 0)
  ) {
    throw Error("El kilometraje final debe ser igual o mayor al inicial.");
  }
  const unresolved = route.dispatchIds.some((dispatchId) => {
    const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
    return (
      !dispatch || !["Entregado", "Entrega fallida"].includes(dispatch.status)
    );
  });
  if (unresolved) {
    throw Error(
      "Resuelve todas las entregas o incidencias antes de cerrar la ruta.",
    );
  }
  route.finalMileage = finalMileage;
  route.closedAt = new Date().toISOString();
  route.status = "Cerrada";
  const vehicle = state.vehicles?.find((item) => item.id === route.vehicleId);
  if (vehicle) vehicle.odometer = finalMileage;
  log(state, "Cerrar ruta", `${route.number} · ${finalMileage} km`);
}

export function registerRouteReturn(
  state: State,
  dispatchId: string,
  productId: string,
  quantity: number,
  reason: string,
  condition: "Apto para venta" | "Dañado" | "Pendiente de revisión",
  returnDocument?: string,
) {
  ensureLogisticsData(state);
  const dispatch = state.dispatches?.find((item) => item.id === dispatchId);
  const order = dispatch && orderFor(state, dispatch.salesOrderId);
  const line = dispatch?.lines?.find((item) => item.productId === productId);
  const ordered =
    line?.quantity ??
    order?.lines.find((item) => item.productId === productId)?.quantity ??
    0;
  const returned = state
    .routeReturns!.filter(
      (item) =>
        item.dispatchId === dispatchId &&
        item.productId === productId &&
        item.status !== "Rechazada",
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  if (
    !dispatch ||
    dispatch.status !== "Entregado" ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity + returned > ordered ||
    !reason.trim()
  ) {
    throw Error(
      "La devolución debe ser de una entrega confirmada y no superar lo entregado.",
    );
  }
  state.routeReturns!.unshift({
    id: id("DEV"),
    dispatchId,
    productId,
    quantity,
    reason: reason.trim(),
    condition,
    returnDocument: returnDocument?.trim() || undefined,
    status: "Pendiente de recepción",
  });
  log(state, "Registrar devolución de ruta", dispatch.number);
}

export function receiveRouteReturn(
  state: State,
  returnId: string,
  warehouseId: string,
  acceptToStock: boolean,
) {
  const returned = state.routeReturns?.find((item) => item.id === returnId);
  const dispatch =
    returned &&
    state.dispatches?.find((item) => item.id === returned.dispatchId);
  if (!returned || !dispatch || returned.status !== "Pendiente de recepción") {
    throw Error("La devolución ya fue procesada o no existe.");
  }
  if (
    !state.warehouses.some(
      (warehouse) => warehouse.id === warehouseId && warehouse.active,
    )
  ) {
    throw Error("Selecciona un almacén activo.");
  }
  if (!acceptToStock || returned.condition !== "Apto para venta") {
    returned.status = "Rechazada";
    log(state, "Rechazar devolución de ruta", returned.id);
    return;
  }
  const before = state.stock[returned.productId]?.[warehouseId] ?? 0;
  const movementId = id("MOV");
  state.stock[returned.productId] = {
    ...state.stock[returned.productId],
    [warehouseId]: Math.round((before + returned.quantity) * 1000) / 1000,
  };
  state.movements.unshift({
    id: movementId,
    date: new Date().toISOString().slice(0, 10),
    documentId: returned.id,
    productId: returned.productId,
    warehouseId,
    partyId:
      state.documents.find((document) => document.id === dispatch.salesOrderId)
        ?.partyId ?? "",
    type: "Entrada",
    quantity: returned.quantity,
    balance: state.stock[returned.productId][warehouseId],
    cost:
      state.products.find((product) => product.id === returned.productId)
        ?.cost ?? 0,
  });
  returned.status = "Recibida";
  returned.movementId = movementId;
  log(
    state,
    "Recibir devolución en almacén",
    `${dispatch.number} → ${returned.id}`,
  );
}

export function saveLiquidation(
  state: State,
  input: Omit<RouteLiquidation, "id">,
) {
  ensureLogisticsData(state);
  const route = state.routes?.find((item) => item.id === input.routeId);
  if (!route || route.status !== "Cerrada") {
    throw Error("La liquidación requiere una ruta cerrada.");
  }
  if (
    [
      input.fuel,
      input.tolls,
      input.otherExpenses,
      input.collections,
      input.returnsAmount,
    ].some((value) => !Number.isFinite(value) || value < 0) ||
    !input.responsible.trim()
  ) {
    throw Error("Revisa los importes y el responsable de la liquidación.");
  }
  if (state.routeLiquidations!.some((item) => item.routeId === input.routeId)) {
    throw Error("Esta ruta ya tiene una liquidación registrada.");
  }
  const liquidation = { ...input, id: id("LIQ") };
  state.routeLiquidations!.unshift(liquidation);
  log(state, "Registrar liquidación de ruta", route.number);
  return liquidation;
}
