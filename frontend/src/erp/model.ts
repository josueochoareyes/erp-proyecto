export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  minimum: number;
  active: boolean;
  demo?: boolean;
  description?: string;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  registeredAt?: string;
  categoryId?: string;
  brandId?: string;
  unitId?: string;
};
export type Company = {
  id: string;
  taxId: string;
  legalName: string;
  tradeName?: string;
  logoUrl?: string;
  fiscalAddress: string;
  baseCurrency: string;
  taxRegime?: string;
  phone?: string;
  email?: string;
  website?: string;
  active: boolean;
};
export type Branch = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
};
export type MasterCategory = {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  active: boolean;
};
export type Brand = {
  id: string;
  code: string;
  name: string;
  countryOfOrigin?: string;
  contact?: string;
  active: boolean;
};
export type UnitOfMeasure = {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  precision: number;
  active: boolean;
};
export type UnitConversion = {
  id: string;
  productId?: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
  validFrom: string;
  validTo?: string;
  active: boolean;
};
export type Transporter = {
  id: string;
  document: string;
  legalName: string;
  license?: string;
  vehicles?: string;
  drivers?: string;
  contact?: string;
  phone?: string;
  email?: string;
  active: boolean;
};
export type Seller = {
  id: string;
  code: string;
  name: string;
  commissionPct: number;
  monthlyTarget: number;
  zoneId?: string;
  userId?: string;
  active: boolean;
};
export type Zone = {
  id: string;
  code: string;
  name: string;
  route?: string;
  sellerId?: string;
  active: boolean;
};
export type Currency = {
  id: string;
  isoCode: string;
  name: string;
  symbol: string;
  active: boolean;
};
export type ExchangeRate = {
  id: string;
  currencyId: string;
  date: string;
  buyRate: number;
  sellRate: number;
  active: boolean;
};
export type Tax = {
  id: string;
  code: string;
  name: string;
  percentage: number;
  type: "IGV" | "ISC" | "Exonerado" | "Otro";
  validFrom: string;
  active: boolean;
};
export type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  creditDays: number;
  type: "Contado" | "Crédito" | "Electrónico" | "Otro";
  active: boolean;
};
export type PriceList = {
  id: string;
  code: string;
  name: string;
  currencyId: string;
  validFrom: string;
  validTo?: string;
  active: boolean;
};
export type PriceListItem = {
  id: string;
  priceListId: string;
  productId: string;
  minQuantity: number;
  price: number;
  active: boolean;
};
export type Party = {
  id: string;
  name: string;
  taxId: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  credit: number;
  active: boolean;
  demo?: boolean;
  tradeName?: string;
  category?: string;
  supplierType?: string;
  registeredAt?: string;
  contactRole?: string;
  alternatePhone?: string;
  district?: string;
  province?: string;
  department?: string;
  paymentTerms?: string;
  currency?: string;
  zoneId?: string;
  sellerId?: string;
  priceListId?: string;
  estimatedDeliveryDays?: number;
  suppliedCategories?: string[];
  commercialNotes?: string;
  internalNotes?: string;
  commercialStatus?: string;
  logoUrl?: string;
  country?: string;
  website?: string;
};
export type Warehouse = {
  id: string;
  name: string;
  branch: string;
  active: boolean;
  code?: string;
  branchId?: string;
  type?: "Principal" | "Secundario" | "Tránsito";
};
export type Line = {
  productId: string;
  quantity: number;
  price: number;
  productSnapshot?: Pick<
    Product,
    "name" | "category" | "unit" | "sku" | "description"
  >;
};
export type DocumentMetadata = {
  customerSnapshot?: Party;
  currency?: string;
  commercialTerms?: string;
  createdAt?: string;
  statusHistory?: { date: string; status: string }[];
};
export type Payment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
};
export type Document = DocumentMetadata & {
  demo?: boolean;
  id: string;
  number: string;
  kind: "OC" | "NI" | "OV" | "CP";
  date: string;
  partyId: string;
  warehouseId: string;
  method: string;
  voucher: string;
  lines: Line[];
  discount: number;
  freight: number;
  total: number;
  balance: number;
  status: string;
  sourceId?: string;
  receiptRequestId?: string;
  payments: Payment[];
  received?: Record<string, number>;
  notes: string;
};
export type Quote = DocumentMetadata & {
  demo?: boolean;
  id: string;
  number: string;
  date: string;
  partyId: string;
  warehouseId: string;
  method: string;
  voucher: string;
  lines: Line[];
  discount: number;
  freight: number;
  total: number;
  status: "Borrador" | "Pendiente" | "Enviada" | "Aceptada" | "Procesada";
  validity: number;
  notes: string;
  orderId?: string;
};
export type Movement = {
  id: string;
  date: string;
  documentId: string;
  productId: string;
  warehouseId: string;
  partyId: string;
  type: "Entrada" | "Salida";
  quantity: number;
  balance: number;
  cost: number;
};
export type Audit = {
  id: string;
  date: string;
  action: string;
  record: string;
};
export type PermissionDefinition = {
  id: string;
  group: string;
  label: string;
};
export type ErpRole = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  active: boolean;
  system?: boolean;
};
export type ErpUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  lastAccess: string;
  avatar?: string;
};
export const permissionCatalog: PermissionDefinition[] = [
  { id: "dashboard.view", group: "Inicio", label: "Ver resumen ejecutivo" },
  { id: "purchases.view", group: "Abastecimiento", label: "Consultar compras" },
  { id: "purchases.manage", group: "Abastecimiento", label: "Gestionar órdenes de compra" },
  { id: "receiving.manage", group: "Abastecimiento", label: "Registrar ingresos al Kardex" },
  { id: "sales.view", group: "Comercial", label: "Consultar ventas" },
  { id: "sales.manage", group: "Comercial", label: "Gestionar cotizaciones y pedidos" },
  { id: "billing.manage", group: "Comercial", label: "Gestionar facturación" },
  { id: "collections.manage", group: "Comercial", label: "Gestionar cuentas por cobrar" },
  { id: "inventory.view", group: "Inventario", label: "Consultar inventario y Kardex" },
  { id: "inventory.manage", group: "Inventario", label: "Gestionar movimientos de inventario" },
  { id: "reports.view", group: "Gestión", label: "Consultar analítica y reportes" },
  { id: "catalogs.manage", group: "Gestión", label: "Gestionar mantenimientos" },
  { id: "masters.view", group: "Gestión", label: "Consultar datos maestros" },
  { id: "masters.manage", group: "Gestión", label: "Gestionar datos maestros" },
  { id: "access.manage", group: "Gestión", label: "Gestionar usuarios y roles" },
  { id: "audit.view", group: "Gestión", label: "Consultar auditoría" },
];
export const defaultAccessRoles = (): ErpRole[] => [
  {
    id: "ROL-ADMIN",
    name: "Administrador",
    description: "Control completo de la operación y configuración del ERP.",
    permissions: [
      "dashboard.view",
      "purchases.view",
      "purchases.manage",
      "receiving.manage",
      "sales.view",
      "sales.manage",
      "billing.manage",
      "collections.manage",
      "inventory.view",
      "inventory.manage",
      "reports.view",
      "catalogs.manage",
      "masters.view",
      "masters.manage",
      "access.manage",
      "audit.view",
    ],
    active: true,
    system: true,
  },
  {
    id: "ROL-SUPERVISOR",
    name: "Supervisor",
    description: "Supervisa operaciones, inventario y resultados del negocio.",
    permissions: [
      "dashboard.view",
      "purchases.view",
      "purchases.manage",
      "receiving.manage",
      "sales.view",
      "sales.manage",
      "billing.manage",
      "collections.manage",
      "inventory.view",
      "inventory.manage",
      "reports.view",
      "catalogs.manage",
      "masters.view",
      "masters.manage",
      "audit.view",
    ],
    active: true,
  },
  {
    id: "ROL-OPERADOR",
    name: "Operador",
    description: "Registra operaciones diarias sin acceso a configuración.",
    permissions: [
      "dashboard.view",
      "purchases.view",
      "receiving.manage",
      "sales.view",
      "sales.manage",
      "inventory.view",
    ],
    active: true,
  },
  {
    id: "ROL-VENDEDOR",
    name: "Vendedor",
    description: "Gestiona cotizaciones, pedidos y seguimiento comercial.",
    permissions: [
      "dashboard.view",
      "sales.view",
      "sales.manage",
      "billing.manage",
      "collections.manage",
    ],
    active: true,
  },
  {
    id: "ROL-COMPRADOR",
    name: "Comprador",
    description: "Gestiona compras y abastecimiento con proveedores.",
    permissions: [
      "dashboard.view",
      "purchases.view",
      "purchases.manage",
      "receiving.manage",
      "inventory.view",
    ],
    active: true,
  },
  {
    id: "ROL-ALMACENERO",
    name: "Almacenero",
    description: "Controla existencias, ingresos y movimientos de almacén.",
    permissions: [
      "dashboard.view",
      "purchases.view",
      "receiving.manage",
      "inventory.view",
      "inventory.manage",
    ],
    active: true,
  },
  {
    id: "ROL-CONTADOR",
    name: "Contador",
    description: "Consulta resultados financieros, facturación y auditoría.",
    permissions: [
      "dashboard.view",
      "sales.view",
      "billing.manage",
      "collections.manage",
      "reports.view",
      "audit.view",
    ],
    active: true,
  },
];
export const defaultAccessUsers = (): ErpUser[] => [
  {
    id: "USR-001",
    name: "Administrador",
    email: "admin@enterprisecloud.pe",
    roleId: "ROL-ADMIN",
    active: true,
    lastAccess: new Date().toISOString(),
    avatar: "fox",
  },
];
export type State = {
  businessCleanupVersion?: 1;
  clearedOperationDates?: string[];
  demoDashboardVersion?: number;
  integratedDemoVersion?: 2;
  payables?: {
    id: string;
    documentId: string;
    supplierId: string;
    date: string;
    dueDate: string;
    total: number;
    balance: number;
    payments: Payment[];
    demo?: boolean;
  }[];
  inventoryValuations?: {
    date: string;
    value: number;
    demo?: boolean;
    includesTax: boolean;
  }[];
  version: 1;
  products: Product[];
  customers: Party[];
  suppliers: Party[];
  warehouses: Warehouse[];
  categories: string[];
  companies?: Company[];
  branches?: Branch[];
  masterCategories?: MasterCategory[];
  brands?: Brand[];
  units?: UnitOfMeasure[];
  unitConversions?: UnitConversion[];
  transporters?: Transporter[];
  sellers?: Seller[];
  zones?: Zone[];
  currencies?: Currency[];
  exchangeRates?: ExchangeRate[];
  taxes?: Tax[];
  paymentMethods?: PaymentMethod[];
  priceLists?: PriceList[];
  priceListItems?: PriceListItem[];
  deletedCategories?: string[];
  documents: Document[];
  quotes: Quote[];
  movements: Movement[];
  stock: Record<string, Record<string, number>>;
  audit: Audit[];
  auditCleanupVersion?: 1;
  settings: { company: string; currency: string };
  users?: ErpUser[];
  roles?: ErpRole[];
  currentUserId?: string;
};
export function ensureAccessControl(state: State) {
  let changed = false;
  if (!Array.isArray(state.roles) || state.roles.length === 0) {
    state.roles = defaultAccessRoles();
    changed = true;
  } else {
    const existingRoleIds = new Set(state.roles.map((role) => role.id));
    defaultAccessRoles().forEach((role) => {
      if (!existingRoleIds.has(role.id)) {
        state.roles!.push(role);
        changed = true;
      }
    });
  }
  if (!Array.isArray(state.users) || state.users.length === 0) {
    state.users = defaultAccessUsers();
    changed = true;
  }
  if (!state.currentUserId || !state.users.some((user) => user.id === state.currentUserId)) {
    state.currentUserId = state.users[0]?.id ?? "USR-001";
    changed = true;
  }
  return changed;
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n,
  );
export const dateLabel = (d: string) => d.split("-").reverse().join("/");
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const quantityRound = (n: number) =>
  Math.round((n + Number.EPSILON) * 1000) / 1000;
function validateDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` !==
      date
  )
    throw Error("Selecciona una fecha válida.");
}
export const total = (lines: Line[], discount = 0, freight = 0) =>
  round(
    lines.reduce((s, l) => s + l.quantity * l.price, 0) - discount + freight,
  );
export const isCredit = (method: string) => method.startsWith("Crédito");
export const stockOf = (s: State, p: string, w: string) => s.stock[p]?.[w] ?? 0;
export const methods = [
  "Contado",
  "Transferencia bancaria",
  "Yape / Plin",
  "Crédito 30 días",
  "Crédito 60 días",
];
export const paymentMethods = [
  "Efectivo",
  "Transferencia bancaria",
  "Depósito en cuenta",
  "Yape / Plin",
  "Cheque",
];
export const vouchers = [
  "Factura electrónica",
  "Boleta de venta electrónica",
  "Nota de venta",
];
let sequence = 0;
const uid = () => `${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const number = (s: State, kind: string, voucher = "Factura electrónica") => {
  const series =
    kind === "CP"
      ? voucher.startsWith("Boleta")
        ? "B001"
        : voucher === "Nota de venta"
          ? "NV01"
          : "F001"
      : kind;
  const existing =
    kind === "COT"
      ? s.quotes.map((d) => d.number)
      : s.documents.map((d) => d.number);
  const maximum = existing
    .filter((n) => n.startsWith(`${series}-`))
    .reduce((max, n) => Math.max(max, Number(n.split("-").at(-1)) || 0), 0);
  return `${series}-${kind === "CP" ? "" : `${new Date().getFullYear()}-`}${String(maximum + 1).padStart(6, "0")}`;
};
const log = (s: State, action: string, record: string) =>
  s.audit.unshift({
    id: uid(),
    date: new Date().toISOString(),
    action,
    record,
  });
export const nextInvoiceNumber = (s: State, voucher: string) =>
  number(s, "CP", voucher);
function snapshotLines(s: State, lines: Line[]): Line[] {
  return lines.map((line) => {
    const p = s.products.find((p) => p.id === line.productId);
    return {
      ...line,
      productSnapshot: structuredClone(
        line.productSnapshot ??
          (p
            ? {
                name: p.name,
                category: p.category,
                unit: p.unit,
                sku: p.sku,
                description: p.description,
              }
            : undefined),
      ),
    };
  });
}
export type Draft = DocumentMetadata & {
  kind: "OC" | "OV";
  date: string;
  partyId: string;
  warehouseId: string;
  method: string;
  voucher: string;
  lines: Line[];
  discount: number;
  freight: number;
  notes: string;
};
function validate(
  s: State,
  d: Omit<Draft, "kind">,
  sale: boolean,
  checkStock = sale,
) {
  validateDate(d.date);
  if (
    !(sale ? s.customers : s.suppliers).some(
      (p) => p.id === d.partyId && p.active,
    )
  )
    throw Error("Selecciona un tercero activo.");
  if (!s.warehouses.some((w) => w.id === d.warehouseId && w.active))
    throw Error("Selecciona un almacén activo.");
  if (!d.lines.length) throw Error("Agrega al menos un producto.");
  if (new Set(d.lines.map((l) => l.productId)).size !== d.lines.length)
    throw Error("Un producto solo puede aparecer una vez.");
  for (const l of d.lines) {
    if (
      !s.products.some((p) => p.id === l.productId && p.active) ||
      !Number.isFinite(l.quantity) ||
      l.quantity <= 0 ||
      !Number.isFinite(l.price) ||
      l.price <= 0
    )
      throw Error("Revisa los productos, cantidades y precios.");
    if (checkStock && stockOf(s, l.productId, d.warehouseId) < l.quantity)
      throw Error(
        `Stock insuficiente de ${s.products.find((p) => p.id === l.productId)?.name}.`,
      );
  }
  if (
    !Number.isFinite(d.discount) ||
    d.discount < 0 ||
    !Number.isFinite(d.freight) ||
    d.freight < 0 ||
    !Number.isFinite(total(d.lines, d.discount, d.freight)) ||
    total(d.lines, d.discount, d.freight) <= 0
  )
    throw Error("El total debe ser positivo; revisa descuento y flete.");
}
export function createDocument(s: State, d: Draft, sourceId?: string) {
  validate(s, d, d.kind === "OV");
  const doc: Document = {
    ...d,
    lines: snapshotLines(s, d.lines),
    customerSnapshot:
      d.kind === "OV"
        ? structuredClone(
            d.customerSnapshot ?? s.customers.find((p) => p.id === d.partyId),
          )
        : undefined,
    currency: d.currency ?? s.settings.currency,
    commercialTerms:
      d.commercialTerms ??
      (d.kind === "OV"
        ? s.customers.find((p) => p.id === d.partyId)?.paymentTerms
        : undefined),
    createdAt: new Date().toISOString(),
    statusHistory: [{ date: new Date().toISOString(), status: "Pendiente" }],
    id: uid(),
    number: number(s, d.kind),
    total: total(d.lines, d.discount, d.freight),
    balance: 0,
    status: "Pendiente",
    payments: [],
    sourceId,
  };
  s.documents.unshift(doc);
  log(s, "Crear orden", doc.number);
  return doc;
}
function move(s: State, doc: Document, type: "Entrada" | "Salida") {
  for (const l of doc.lines) {
    const balance = quantityRound(
      stockOf(s, l.productId, doc.warehouseId) +
        (type === "Entrada" ? l.quantity : -l.quantity),
    );
    if (balance < 0) throw Error("La operación dejaría stock negativo.");
    s.stock[l.productId] = {
      ...s.stock[l.productId],
      [doc.warehouseId]: balance,
    };
    s.movements.unshift({
      id: uid(),
      date: doc.date,
      documentId: doc.id,
      productId: l.productId,
      warehouseId: doc.warehouseId,
      partyId: doc.partyId,
      type,
      quantity: l.quantity,
      balance,
      cost:
        type === "Entrada"
          ? l.price
          : s.products.find((p) => p.id === l.productId)!.cost,
    });
  }
}
export function receive(
  s: State,
  id: string,
  quantities: Record<string, number>,
  warehouseId: string,
  date: string,
  requestId?: string,
) {
  if (
    requestId &&
    s.documents.some((d) => d.kind === "NI" && d.receiptRequestId === requestId)
  )
    throw Error(
      "Esta recepción ya fue registrada. Consulta la nota de ingreso.",
    );
  validateDate(date);
  const oc = s.documents.find((d) => d.id === id && d.kind === "OC");
  if (!oc || !["Pendiente", "Recibida parcial"].includes(oc.status))
    throw Error("Esta compra ya fue recibida.");
  if (!s.warehouses.some((w) => w.id === warehouseId && w.active))
    throw Error("Selecciona un almacén activo.");
  if (
    Object.keys(quantities).some(
      (productId) => !oc.lines.some((l) => l.productId === productId),
    )
  )
    throw Error("La recepción contiene productos ajenos a la orden de compra.");
  if (new Set(oc.lines.map((l) => l.productId)).size !== oc.lines.length)
    throw Error(
      "La orden contiene productos duplicados. Revisa la compra antes de recibirla.",
    );
  const lines = oc.lines.map((l) => ({
    ...l,
    quantity: quantities[l.productId] ?? 0,
  }));
  for (const l of lines) {
    const ordered = oc.lines.find((x) => x.productId === l.productId)!.quantity;
    const alreadyReceived = oc.received?.[l.productId] ?? 0;
    if (
      !Number.isFinite(ordered) ||
      ordered <= 0 ||
      !Number.isFinite(alreadyReceived) ||
      alreadyReceived < 0 ||
      alreadyReceived > ordered
    )
      throw Error(
        "Las cantidades de la orden no son válidas para registrar el ingreso.",
      );
    const remaining = quantityRound(
      ordered - (oc.received?.[l.productId] ?? 0),
    );
    if (
      !Number.isFinite(l.quantity) ||
      l.quantity < 0 ||
      l.quantity > remaining ||
      Math.abs(l.quantity - quantityRound(l.quantity)) > 1e-9
    )
      throw Error("La recepción no puede superar la cantidad pendiente.");
  }
  const incoming = lines.filter((l) => l.quantity > 0);
  if (!incoming.length) throw Error("Ingresa una cantidad a recibir.");
  for (const l of incoming) {
    if (
      !s.products.some((p) => p.id === l.productId) ||
      !Number.isFinite(l.price) ||
      l.price < 0 ||
      !Number.isFinite(stockOf(s, l.productId, warehouseId) + l.quantity) ||
      stockOf(s, l.productId, warehouseId) < 0
    )
      throw Error(
        "El producto, costo o stock no es válido para registrar el ingreso.",
      );
  }
  const note: Document = {
    ...oc,
    id: uid(),
    number: number(s, "NI"),
    kind: "NI",
    date,
    warehouseId,
    lines: incoming,
    total: total(incoming),
    discount: 0,
    freight: 0,
    status: "Registrado",
    sourceId: oc.id,
    receiptRequestId: requestId,
    balance: 0,
    payments: [],
    received: undefined,
  };
  s.documents.unshift(note);
  move(s, note, "Entrada");
  oc.received = { ...oc.received };
  for (const l of incoming)
    oc.received[l.productId] = quantityRound(
      (oc.received[l.productId] ?? 0) + l.quantity,
    );
  oc.status = oc.lines.every(
    (l) => (oc.received?.[l.productId] ?? 0) >= l.quantity,
  )
    ? "Recibida"
    : "Recibida parcial";
  log(s, "Recibir compra", `${oc.number} → ${note.number}`);
  return note;
}
export function invoice(s: State, id: string, voucher: string, date: string) {
  validateDate(date);
  if (!vouchers.includes(voucher))
    throw Error("Selecciona un tipo de comprobante válido.");
  const ov = s.documents.find((d) => d.id === id && d.kind === "OV");
  if (
    !ov ||
    ov.status !== "Pendiente" ||
    s.documents.some((d) => d.kind === "CP" && d.sourceId === id)
  )
    throw Error("La orden ya fue facturada.");
  validate(s, ov, true);
  if (isCredit(ov.method)) {
    const client = s.customers.find((c) => c.id === ov.partyId)!;
    const debt = s.documents
      .filter((d) => d.kind === "CP" && d.partyId === client.id)
      .reduce((sum, d) => sum + d.balance, 0);
    if (debt + ov.total > client.credit)
      throw Error(
        `La venta supera la línea de crédito disponible (${money(Math.max(0, client.credit - debt))}).`,
      );
  }
  const cp: Document = {
    ...ov,
    id: uid(),
    number: number(s, "CP", voucher),
    kind: "CP",
    createdAt: new Date().toISOString(),
    statusHistory: [
      {
        date: new Date().toISOString(),
        status: "Pendiente de pago",
      },
    ],
    voucher,
    date,
    sourceId: ov.id,
    balance: ov.total,
    status: "Pendiente de pago",
    payments: [],
  };
  s.documents.unshift(cp);
  move(s, cp, "Salida");
  ov.status = "Facturada";
  (ov.statusHistory ??= []).push({
    date: new Date().toISOString(),
    status: "Facturada",
  });
  const quote = s.quotes.find((q) => q.orderId === ov.id);
  if (quote) quote.status = "Procesada";
  log(s, "Facturar venta", `${ov.number} → ${cp.number}`);
  return cp;
}
export function canCancelPurchaseOrder(state: State, order: Document) {
  return order.kind === "OC" && order.status === "Pendiente" &&
    !Object.values(order.received ?? {}).some((quantity) => quantity !== 0) &&
    !state.documents.some((document) => document.kind === "NI" && document.sourceId === order.id) &&
    !state.movements.some((movement) => movement.documentId === order.id) &&
    !order.payments.length &&
    !(state.payables ?? []).some((account) => account.documentId === order.id && (account.payments.length > 0 || account.balance < account.total));
}
export function cancelPurchaseOrder(state: State, id: string) {
  const order = state.documents.find((document) => document.id === id && document.kind === "OC");
  if (!order) throw Error("Orden de compra no encontrada.");
  if (!canCancelPurchaseOrder(state, order)) throw Error("Solo puedes cancelar órdenes pendientes sin recepciones, movimientos ni pagos registrados.");
  order.status = "Cancelada";
  (order.statusHistory ??= []).push({date: new Date().toISOString(), status: "Cancelada"});
  log(state, "Cancelar orden de compra", order.number);
}

export function cancelSalesOrder(state: State, id: string) {
  const order = state.documents.find((document) => document.id === id && document.kind === "OV");
  if (!order) throw Error("Pedido de venta no encontrado.");
  if (order.status !== "Pendiente" || state.documents.some((document) => document.kind === "CP" && document.sourceId === id) || state.movements.some((movement) => movement.documentId === id) || order.payments.length)
    throw Error("Solo puedes cancelar pedidos pendientes sin comprobantes, movimientos ni cobros.");
  order.status = "Cancelada";
  (order.statusHistory ??= []).push({date: new Date().toISOString(), status: "Cancelada"});
  log(state, "Cancelar pedido de venta", order.number);
}

export function nextPaymentReference(s: State) {
  const references = new Set(s.documents.flatMap((d) => d.payments.map((p) => p.reference)));
  let sequence = 1;
  while (references.has(`COB-${String(sequence).padStart(6, "0")}`)) sequence++;
  return `COB-${String(sequence).padStart(6, "0")}`;
}
export function pay(s: State, id: string, payment: Omit<Payment, "id" | "reference"> & { reference?: string }) {
  validateDate(payment.date);
  const cp = s.documents.find((d) => d.id === id && d.kind === "CP");
  if (!cp || cp.balance <= 0) throw Error("El comprobante no tiene deuda.");
  if (
    !Number.isFinite(payment.amount) ||
    round(payment.amount) < 0.01 ||
    round(payment.amount) > cp.balance
  )
    throw Error("El pago debe ser positivo y no superar el saldo.");
  cp.balance = round(cp.balance - payment.amount);
  cp.payments.push({ ...payment, reference: payment.reference?.trim() || nextPaymentReference(s), amount: round(payment.amount), id: uid() });
  cp.status = cp.balance === 0 ? "Pagada" : "Pago parcial";
  (cp.statusHistory ??= []).push({
    date: new Date().toISOString(),
    status: cp.status,
  });
  log(s, "Registrar cobro", `${cp.number}: ${money(payment.amount)}`);
}
export function saveQuote(
  s: State,
  d: Omit<Quote, "id" | "number" | "status" | "total">,
  id?: string,
  status?: "Borrador",
) {
  validate(s, d, true, false);
  if (!Number.isInteger(d.validity) || d.validity < 1 || d.validity > 365)
    throw Error("La vigencia debe estar entre 1 y 365 días.");
  const old = s.quotes.find((q) => q.id === id);
  if (id && !old) throw Error("La cotización ya no existe.");
  if (old && (old.status !== "Borrador" || old.orderId || s.documents.some((document) => document.sourceId === old.id)))
    throw Error("La cotización ya está vinculada a una venta.");
  const quote: Quote = {
    ...d,
    lines: snapshotLines(s, d.lines),
    customerSnapshot: structuredClone(
      s.customers.find((p) => p.id === d.partyId),
    ),
    currency: old?.currency ?? s.settings.currency,
    commercialTerms: s.customers.find((p) => p.id === d.partyId)?.paymentTerms,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    id: old?.id ?? uid(),
    number: old?.number ?? number(s, "COT"),
    status: status ?? old?.status ?? "Borrador",
    total: total(d.lines, d.discount, d.freight),
  };
  if (old) s.quotes[s.quotes.indexOf(old)] = quote;
  else s.quotes.unshift(quote);
  log(s, "Guardar cotización", quote.number);
  return quote;
}
export function changeQuote(
  s: State,
  id: string,
  action: "send" | "reject" | "accept",
) {
  const q = s.quotes.find((q) => q.id === id);
  if (!q) throw Error("Cotización no encontrada.");
  if (action === "send") {
    if (q.status !== "Borrador" || q.orderId || s.documents.some((d) => d.sourceId === q.id)) throw Error("Solo puedes enviar una cotización en borrador.");
    q.status = "Enviada";
  } else if (action === "reject") {
    if (q.status !== "Enviada" || q.orderId || s.documents.some((d) => d.sourceId === q.id)) throw Error("Solo puedes rechazar una cotización enviada sin venta vinculada.");
    q.status = "Borrador";
  } else {
    if (q.status !== "Enviada" || q.orderId || s.documents.some((d) => d.sourceId === q.id))
      throw Error("Primero envía la cotización; no puede tener una venta vinculada.");
    const ov = createDocument(s, { ...q, kind: "OV", date: today() }, q.id);
    q.orderId = ov.id;
    q.status = "Aceptada";
  }
  log(s, "Actualizar cotización", `${q.number}: ${q.status}`);
}
export function deleteQuote(s: State, id: string) {
  const quote = s.quotes.find((q) => q.id === id);
  if (!quote) throw Error("Cotización no encontrada.");
  if (quote.status !== "Borrador" || quote.orderId || s.documents.some((d) => d.sourceId === id))
    throw Error("Solo puedes eliminar cotizaciones en borrador sin una venta vinculada.");
  s.quotes = s.quotes.filter((q) => q.id !== id);
  log(s, "Eliminar cotización", quote.number);
}

export function initialState(): State {
  return {
    version: 1,
    businessCleanupVersion: 1,
    products: [],
    customers: [],
    suppliers: [],
    warehouses: [
      {
        id: "ALM-01",
        name: "Almacén principal",
        branch: "Sede central · Lima",
        active: true,
      },
      {
        id: "ALM-02",
        name: "Almacén secundario",
        branch: "Sede central · Lima",
        active: true,
      },
      {
        id: "ALM-03",
        name: "Almacén Arequipa",
        branch: "Sucursal Arequipa",
        active: true,
      },
    ],
    companies: [
      {
        id: "EMP-001",
        taxId: "",
        legalName: "EnterpriseCloud S.A.C.",
        fiscalAddress: "",
        baseCurrency: "PEN",
        active: true,
      },
    ],
    branches: [
      {
        id: "SUC-001",
        companyId: "EMP-001",
        code: "LIM-01",
        name: "Sede central · Lima",
        address: "",
        active: true,
      },
      {
        id: "SUC-002",
        companyId: "EMP-001",
        code: "ARE-01",
        name: "Sucursal Arequipa",
        address: "",
        active: true,
      },
    ],
    categories: [
      "Bolsas", "Envases", "Materia prima", "PVC", "Embalaje",
      "Adhesivos", "Seguridad industrial", "Limpieza", "Químicos", "Accesorios",
    ],
    masterCategories: [
      "Bolsas", "Envases", "Materia prima", "PVC", "Embalaje",
      "Adhesivos", "Seguridad industrial", "Limpieza", "Químicos", "Accesorios",
    ].map((name, index) => ({
      id: `CAT-${String(index + 1).padStart(3, "0")}`,
      code: `CAT-${String(index + 1).padStart(3, "0")}`,
      name,
      active: true,
    })),
    brands: [],
    units: [
      { id: "UND", code: "UND", name: "Unidad", abbreviation: "UND", precision: 0, active: true },
      { id: "KG", code: "KG", name: "Kilogramo", abbreviation: "KG", precision: 3, active: true },
      { id: "ROL", code: "ROL", name: "Rollo", abbreviation: "ROL", precision: 0, active: true },
      { id: "CJA", code: "CJA", name: "Caja", abbreviation: "CJA", precision: 0, active: true },
      { id: "BLS", code: "BLS", name: "Bolsa", abbreviation: "BLS", precision: 0, active: true },
      { id: "PAQ", code: "PAQ", name: "Paquete", abbreviation: "PAQ", precision: 0, active: true },
      { id: "MLL", code: "MLL", name: "Millar", abbreviation: "MLL", precision: 0, active: true },
    ],
    unitConversions: [],
    documents: [],
    quotes: [],
    movements: [],
    stock: {},
    audit: [],
    settings: { company: "EnterpriseCloud S.A.C.", currency: "PEN" },
    users: [defaultAccessUsers()[0]],
    roles: defaultAccessRoles(),
    currentUserId: "USR-001",
  };
}
