import {
  importCsv,
  importFields,
  previewCsv,
  type DuplicateMode,
  type ImportKind,
  type ImportPreview,
  type ImportRow,
  type ImportSummary,
} from "./csv-import.ts";
import type {
  Brand,
  Branch,
  Company,
  Currency,
  ExchangeRate,
  MasterCategory,
  PaymentMethod,
  PriceList,
  PriceListItem,
  Seller,
  State,
  Tax,
  Transporter,
  UnitConversion,
  UnitOfMeasure,
  Warehouse,
  Zone,
} from "./model.ts";

export type MasterImportKind =
  | ImportKind
  | "companies"
  | "branches"
  | "warehouses"
  | "categories"
  | "brands"
  | "units"
  | "conversions"
  | "transporters"
  | "sellers"
  | "zones"
  | "currencies"
  | "taxes"
  | "paymentMethods"
  | "priceLists";

type Field = { key: string; label: string; required?: boolean };
type ParsedRow = { line: number; cells: string[] };

export type MasterImportRow = ImportRow & { values: Record<string, string> };
export type MasterImportPreview = ImportPreview & {
  kind: MasterImportKind;
  title: string;
  fields: Field[];
  rows: MasterImportRow[];
};

const customFields: Record<Exclude<MasterImportKind, ImportKind>, Field[]> = {
  companies: [
    { key: "id", label: "Código", required: true },
    { key: "taxId", label: "RUC" },
    { key: "legalName", label: "Razón social", required: true },
    { key: "tradeName", label: "Nombre comercial" },
    { key: "fiscalAddress", label: "Domicilio fiscal", required: true },
    { key: "baseCurrency", label: "Moneda base", required: true },
    { key: "taxRegime", label: "Régimen tributario" },
    { key: "phone", label: "Teléfono" },
    { key: "email", label: "Correo" },
    { key: "website", label: "Sitio web" },
    { key: "active", label: "Estado" },
  ],
  branches: [
    { key: "id", label: "Código", required: true },
    { key: "companyId", label: "Empresa", required: true },
    { key: "code", label: "Código de sucursal", required: true },
    { key: "name", label: "Nombre", required: true },
    { key: "address", label: "Dirección" },
    { key: "phone", label: "Teléfono" },
    { key: "active", label: "Estado" },
  ],
  warehouses: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código de almacén", required: true },
    { key: "name", label: "Nombre", required: true },
    { key: "branch", label: "Sucursal" },
    { key: "branchId", label: "Sucursal relacionada", required: true },
    { key: "type", label: "Tipo", required: true },
    { key: "active", label: "Estado" },
  ],
  categories: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Nombre", required: true },
    { key: "parentId", label: "Categoría padre" },
    { key: "active", label: "Estado" },
  ],
  brands: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Marca", required: true },
    { key: "countryOfOrigin", label: "País de origen" },
    { key: "active", label: "Estado" },
  ],
  units: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Nombre", required: true },
    { key: "abbreviation", label: "Abreviatura", required: true },
    { key: "precision", label: "Precisión", required: true },
    { key: "active", label: "Estado" },
  ],
  conversions: [
    { key: "id", label: "Código", required: true },
    { key: "productId", label: "Producto" },
    { key: "fromUnitId", label: "Unidad origen", required: true },
    { key: "toUnitId", label: "Unidad destino", required: true },
    { key: "factor", label: "Factor", required: true },
    { key: "validFrom", label: "Vigente desde", required: true },
    { key: "validTo", label: "Vigente hasta" },
    { key: "active", label: "Estado" },
  ],
  transporters: [
    { key: "id", label: "Código", required: true },
    { key: "document", label: "RUC / DNI", required: true },
    { key: "legalName", label: "Razón social", required: true },
    { key: "license", label: "Licencia" },
    { key: "vehicles", label: "Vehículos" },
    { key: "drivers", label: "Conductores" },
    { key: "contact", label: "Contacto" },
    { key: "phone", label: "Teléfono" },
    { key: "email", label: "Correo" },
    { key: "active", label: "Estado" },
  ],
  sellers: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Vendedor", required: true },
    { key: "commissionPct", label: "Comisión", required: true },
    { key: "monthlyTarget", label: "Meta mensual", required: true },
    { key: "zoneId", label: "Zona" },
    { key: "userId", label: "Usuario" },
    { key: "active", label: "Estado" },
  ],
  zones: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Zona", required: true },
    { key: "route", label: "Ruta" },
    { key: "sellerId", label: "Vendedor" },
    { key: "active", label: "Estado" },
  ],
  currencies: [
    { key: "currencyId", label: "Código interno", required: true },
    { key: "isoCode", label: "ISO", required: true },
    { key: "name", label: "Moneda", required: true },
    { key: "symbol", label: "Símbolo", required: true },
    { key: "currencyActive", label: "Moneda activa" },
    { key: "date", label: "Fecha de cambio" },
    { key: "buyRate", label: "Compra" },
    { key: "sellRate", label: "Venta" },
    { key: "rateActive", label: "Tipo de cambio activo" },
  ],
  taxes: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Impuesto", required: true },
    { key: "percentage", label: "Porcentaje", required: true },
    { key: "type", label: "Tipo", required: true },
    { key: "validFrom", label: "Vigente desde", required: true },
    { key: "active", label: "Estado" },
  ],
  paymentMethods: [
    { key: "id", label: "Código", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Forma de pago", required: true },
    { key: "creditDays", label: "Días de crédito", required: true },
    { key: "type", label: "Tipo", required: true },
    { key: "active", label: "Estado" },
  ],
  priceLists: [
    { key: "id", label: "Código de lista", required: true },
    { key: "code", label: "Código visible", required: true },
    { key: "name", label: "Lista", required: true },
    { key: "currencyId", label: "Moneda", required: true },
    { key: "validFrom", label: "Vigente desde", required: true },
    { key: "validTo", label: "Vigente hasta" },
    { key: "active", label: "Lista activa" },
    { key: "productId", label: "Producto", required: true },
    { key: "minQuantity", label: "Cantidad mínima", required: true },
    { key: "price", label: "Precio", required: true },
    { key: "itemActive", label: "Precio activo" },
  ],
};

const titles: Record<MasterImportKind, string> = {
  customers: "Clientes",
  suppliers: "Proveedores",
  products: "Productos",
  companies: "Empresas",
  branches: "Sucursales",
  warehouses: "Almacenes",
  categories: "Categorías",
  brands: "Marcas",
  units: "Unidades de medida",
  conversions: "Conversiones",
  transporters: "Transportistas",
  sellers: "Vendedores",
  zones: "Zonas",
  currencies: "Monedas y tipos de cambio",
  taxes: "Impuestos",
  paymentMethods: "Formas de pago",
  priceLists: "Listas de precios",
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("es-PE");
const numberFields = new Set([
  "precision",
  "factor",
  "commissionPct",
  "monthlyTarget",
  "percentage",
  "creditDays",
  "buyRate",
  "sellRate",
  "minQuantity",
  "price",
]);
const dateFields = new Set(["validFrom", "validTo", "date"]);
const baseImportKinds = new Set<ImportKind>(["customers", "suppliers", "products"]);

function parseCsv(text: string): ParsedRow[] {
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) throw Error("El archivo CSV está vacío.");
  const delimiter = ((source.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) >
    (source.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0)) ? ";" : ",";
  const rows: ParsedRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let rowLine = 1;
  let beginning = true;
  const finishCell = () => { cells.push(cell.trim()); cell = ""; beginning = true; closed = false; };
  const finishRow = () => { finishCell(); if (cells.some(Boolean)) rows.push({ line: rowLine, cells }); cells = []; rowLine = line + 1; };
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else { cell += char; if (char === "\n") line += 1; }
    } else if (char === '"') {
      if (!beginning) throw Error(`Comillas inesperadas en la fila ${line}.`);
      quoted = true; beginning = false;
    } else if (char === delimiter) finishCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && source[i + 1] === "\n") i += 1; finishRow(); line += 1; }
    else if (closed) { if (char !== " " && char !== "\t") throw Error(`Texto después de comillas en la fila ${line}.`); }
    else { if (beginning && (char === " " || char === "\t")) continue; cell += char; beginning = false; }
  }
  if (quoted) throw Error(`Faltan comillas de cierre en la fila ${rowLine}.`);
  if (cell || cells.length || closed) finishRow();
  if (rows.length < 2) throw Error("El CSV debe contener encabezados y al menos un registro.");
  if (rows.length > 20001) throw Error("Importa un máximo de 20 000 registros por archivo.");
  return rows;
}

function has(headers: Set<string>, ...keys: string[]) { return keys.every((key) => headers.has(key)); }

export function detectMasterImportKind(text: string): MasterImportKind {
  const header = parseCsv(text)[0].cells.map((cell) => cell.trim());
  const headers = new Set(header);
  if (has(headers, "sku", "cost", "price", "category", "unit")) return "products";
  if (has(headers, "supplierType", "estimatedDeliveryDays")) return "suppliers";
  if (has(headers, "taxId", "name", "address")) return "customers";
  if (has(headers, "legalName", "taxId", "baseCurrency")) return "companies";
  if (has(headers, "companyId", "code", "name", "address")) return "branches";
  if (has(headers, "branchId", "type", "code")) return "warehouses";
  if (has(headers, "parentId", "code", "name")) return "categories";
  if (has(headers, "countryOfOrigin", "code", "name")) return "brands";
  if (has(headers, "abbreviation", "precision", "code")) return "units";
  if (has(headers, "fromUnitId", "toUnitId", "factor")) return "conversions";
  if (has(headers, "document", "legalName", "license")) return "transporters";
  if (has(headers, "commissionPct", "monthlyTarget", "code")) return "sellers";
  if (has(headers, "route", "sellerId", "code")) return "zones";
  if (has(headers, "currencyId", "isoCode", "buyRate", "sellRate")) return "currencies";
  if (has(headers, "percentage", "type", "validFrom", "code")) return "taxes";
  if (has(headers, "creditDays", "type", "code")) return "paymentMethods";
  if (has(headers, "productId", "minQuantity", "price", "itemActive")) return "priceLists";
  throw Error("No se pudo identificar el submódulo. Usa una plantilla CSV de Maestros.");
}

function fieldsFor(kind: MasterImportKind): Field[] {
  return baseImportKinds.has(kind as ImportKind) ? importFields[kind as ImportKind] : customFields[kind as Exclude<MasterImportKind, ImportKind>];
}

function numeric(value: string) {
  const normalized = value.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

function bool(value: string | undefined, fallback = true) {
  if (!value) return fallback;
  return /^(true|1|activo|sí|si)$/i.test(value.trim());
}

function findMatch(state: State, kind: MasterImportKind, values: Record<string, string>): string | undefined {
  const id = values.id || values.currencyId;
  if (kind === "customers" || kind === "suppliers" || kind === "products") return undefined;
  if (kind === "companies") return state.companies?.find((item) => item.id === id || (values.taxId && item.taxId === values.taxId))?.id;
  if (kind === "branches") return state.branches?.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "warehouses") return state.warehouses.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "categories") return state.masterCategories?.find((item) => item.id === id || item.code === values.code || normalize(item.name) === normalize(values.name))?.id;
  if (kind === "brands") return state.brands?.find((item) => item.id === id || item.code === values.code || normalize(item.name) === normalize(values.name))?.id;
  if (kind === "units") return state.units?.find((item) => item.id === id || item.code === values.code || item.abbreviation === values.abbreviation)?.id;
  if (kind === "conversions") return state.unitConversions?.find((item) => item.id === id)?.id;
  if (kind === "transporters") return state.transporters?.find((item) => item.id === id || item.document === values.document)?.id;
  if (kind === "sellers") return state.sellers?.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "zones") return state.zones?.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "currencies") return state.currencies?.find((item) => item.id === id || item.isoCode === values.isoCode)?.id;
  if (kind === "taxes") return state.taxes?.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "paymentMethods") return state.paymentMethods?.find((item) => item.id === id || item.code === values.code)?.id;
  if (kind === "priceLists") return state.priceLists?.find((item) => item.id === id || item.code === values.code)?.id;
  return undefined;
}

function validateCustomRow(state: State, kind: Exclude<MasterImportKind, ImportKind>, row: MasterImportRow, plannedCategoryIds: Set<string>) {
  const fields = customFields[kind];
  for (const field of fields) if (field.required && !row.values[field.key]) row.errors[field.key] = `${field.label} es obligatorio.`;
  if (row.values.id && !/^[A-Za-z0-9_-]+$/.test(row.values.id)) row.errors.id = "El código solo admite letras, números, guiones y guiones bajos.";
  for (const key of numberFields) if (row.values[key] !== undefined && row.values[key] !== "") {
    const value = numeric(row.values[key]);
    if (!Number.isFinite(value) || value < 0) row.errors[key] = "Ingresa un número válido no negativo.";
    else if (["precision", "creditDays"].includes(key) && !Number.isInteger(value)) row.errors[key] = "Ingresa un número entero.";
  }
  if (row.values.factor && numeric(row.values.factor) <= 0) row.errors.factor = "El factor debe ser mayor que cero.";
  if (row.values.price && numeric(row.values.price) <= 0) row.errors.price = "El precio debe ser mayor que cero.";
  if (row.values.validFrom && row.values.validTo && row.values.validTo < row.values.validFrom) row.errors.validTo = "La fecha final debe ser posterior a la inicial.";
  for (const key of dateFields) if (row.values[key] && !validDate(row.values[key])) row.errors[key] = "Usa una fecha válida AAAA-MM-DD.";
  if (row.values.email && !/^\S+@\S+\.\S+$/.test(row.values.email)) row.errors.email = "Ingresa un correo válido.";
  if (row.values.active && !/^(true|false|1|0|activo|inactivo|sí|si|no)$/i.test(row.values.active)) row.errors.active = "Usa Activo, Inactivo, Sí, No, true o false.";
  if (kind === "companies" && row.values.taxId && !/^\d{11}$/.test(row.values.taxId)) row.errors.taxId = "El RUC debe tener 11 dígitos.";
  if (kind === "transporters" && row.values.document && !/^\d{8}(?:\d{3})?$/.test(row.values.document)) row.errors.document = "Ingresa DNI de 8 dígitos o RUC de 11 dígitos.";
  if (kind === "warehouses" && row.values.type && !["Principal", "Secundario", "Tránsito"].includes(row.values.type)) row.errors.type = "Usa Principal, Secundario o Tránsito.";
  if (kind === "taxes" && row.values.type && !["IGV", "ISC", "Exonerado", "Otro"].includes(row.values.type)) row.errors.type = "Tipo de impuesto no reconocido.";
  if (kind === "paymentMethods" && row.values.type && !["Contado", "Crédito", "Electrónico", "Otro"].includes(row.values.type)) row.errors.type = "Tipo de pago no reconocido.";
  const match = findMatch(state, kind, row.values);
  row.matchId = match;
  if (kind === "currencies" && row.values.date) {
    const rateExists = state.exchangeRates?.some((rate) => rate.currencyId === row.values.currencyId && rate.date === row.values.date);
    if (!rateExists) row.matchId = undefined;
  }
  if (kind === "priceLists") {
    const itemId = `PLI-${row.values.id}-${row.values.productId}-${row.values.minQuantity}`;
    if (!state.priceListItems?.some((item) => item.id === itemId)) row.matchId = undefined;
  }
  if (kind === "branches" && row.values.companyId && !state.companies?.some((item) => item.id === row.values.companyId)) row.errors.companyId = "La empresa debe existir antes de importar la sucursal.";
  if (kind === "companies" && row.values.baseCurrency && !state.currencies?.some((item) => item.id === row.values.baseCurrency)) row.errors.baseCurrency = "La moneda base no existe.";
  if (kind === "warehouses" && row.values.branchId && !state.branches?.some((item) => item.id === row.values.branchId)) row.errors.branchId = "La sucursal debe existir antes de importar el almacén.";
  if (kind === "categories" && row.values.parentId && !state.masterCategories?.some((item) => item.id === row.values.parentId) && !plannedCategoryIds.has(row.values.parentId)) row.errors.parentId = "La categoría padre no existe.";
  if (kind === "categories" && row.values.parentId === row.values.id) row.errors.parentId = "Una categoría no puede ser su propio padre.";
  if (kind === "currencies" && row.values.date && (!row.values.buyRate || !row.values.sellRate)) row.errors.date = "Indica compra y venta para la fecha de cambio.";
  if (kind === "conversions") {
    if (row.values.fromUnitId && !state.units?.some((item) => item.id === row.values.fromUnitId)) row.errors.fromUnitId = "La unidad origen no existe.";
    if (row.values.toUnitId && !state.units?.some((item) => item.id === row.values.toUnitId)) row.errors.toUnitId = "La unidad destino no existe.";
    if (row.values.productId && !state.products.some((item) => item.id === row.values.productId)) row.errors.productId = "El producto no existe.";
  }
  if (kind === "priceLists") {
    if (row.values.currencyId && !state.currencies?.some((item) => item.id === row.values.currencyId)) row.errors.currencyId = "La moneda no existe.";
    if (row.values.productId && !state.products.some((item) => item.id === row.values.productId)) row.errors.productId = "El producto no existe.";
  }
}

function makePreview(state: State, kind: Exclude<MasterImportKind, ImportKind>, text: string): MasterImportPreview {
  const parsed = parseCsv(text);
  const fields = customFields[kind];
  const headers = parsed[0].cells.map((cell) => cell.trim());
  const allowed = new Set(fields.map((field) => field.key));
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  const unknown = headers.filter((header) => !allowed.has(header));
  const missing = fields.filter((field) => field.required && !headers.includes(field.key));
  if (duplicateHeaders.length) throw Error(`Encabezado repetido: ${duplicateHeaders.join(", ")}.`);
  if (unknown.length) throw Error(`Columnas no reconocidas: ${unknown.join(", ")}. Descarga la plantilla de ${titles[kind]}.`);
  if (missing.length) throw Error(`Faltan columnas obligatorias: ${missing.map((field) => field.key).join(", ")}.`);
  const seen = new Map<string, number>();
  const plannedCategoryIds = new Set(kind === "categories" ? parsed.slice(1).map(({ cells }) => cells[headers.indexOf("id")]?.trim()).filter(Boolean) : []);
  const rows = parsed.slice(1).map(({ line, cells }): MasterImportRow => {
    const values: Record<string, string> = {};
    headers.forEach((key, index) => { values[key] = cells[index]?.trim() ?? ""; });
    const row: MasterImportRow = { line, values, errors: {}, status: "valid" };
    if (cells.length !== headers.length) row.errors._fila = `Se esperaban ${headers.length} columnas y se encontraron ${cells.length}.`;
    validateCustomRow(state, kind, row, plannedCategoryIds);
    const identity = kind === "currencies"
      ? `${values.currencyId}:${values.date || ""}`
      : kind === "priceLists"
        ? `${values.id}:${values.productId}:${values.minQuantity}`
        : values.id;
    if (identity && seen.has(identity)) row.errors._fila = `Registro repetido dentro del CSV (fila ${seen.get(identity)}).`;
    if (!Object.keys(row.errors).length && identity) seen.set(identity, line);
    row.status = Object.keys(row.errors).length ? "error" : row.matchId ? "duplicate" : "valid";
    return row;
  });
  return { kind, title: titles[kind], fields, rows, valid: rows.filter((row) => row.status === "valid").length, duplicate: rows.filter((row) => row.status === "duplicate").length, errors: rows.filter((row) => row.status === "error").length };
}

export function previewMasterCsv(state: State, text: string): MasterImportPreview {
  const kind = detectMasterImportKind(text);
  if (baseImportKinds.has(kind as ImportKind)) {
    const legacy = previewCsv(state, kind as ImportKind, text);
    return { ...legacy, kind, title: titles[kind], fields: importFields[kind as ImportKind], rows: legacy.rows };
  }
  return makePreview(state, kind as Exclude<MasterImportKind, ImportKind>, text);
}

function stringValue(values: Record<string, string>, key: string) { return values[key]?.trim() || undefined; }
function numberValue(values: Record<string, string>, key: string, fallback = 0) { const value = values[key]; return value === undefined || value === "" ? fallback : numeric(value); }

function replaceRecord<T extends { id: string }>(list: T[], record: T, matchId?: string) {
  const index = list.findIndex((item) => item.id === (matchId ?? record.id));
  if (index >= 0) { list[index] = matchId && matchId !== record.id ? { ...record, id: matchId } : record; return true; }
  list.push(record); return false;
}

function importCustomRow(state: State, kind: Exclude<MasterImportKind, ImportKind>, values: Record<string, string>, matchId?: string): boolean {
  if (kind === "companies") {
    const record: Company = { id: values.id, taxId: values.taxId || "", legalName: values.legalName, tradeName: stringValue(values, "tradeName"), fiscalAddress: values.fiscalAddress, baseCurrency: values.baseCurrency, taxRegime: stringValue(values, "taxRegime"), phone: stringValue(values, "phone"), email: stringValue(values, "email"), website: stringValue(values, "website"), active: bool(values.active) };
    state.companies ??= [];
    const isPrimary = (matchId ?? record.id) === state.companies[0]?.id;
    const updated = replaceRecord(state.companies, record, matchId);
    if (isPrimary) state.settings.company = record.legalName;
    return updated;
  }
  if (kind === "branches") {
    const record: Branch = { id: values.id, companyId: values.companyId, code: values.code, name: values.name, address: stringValue(values, "address") ?? "", phone: stringValue(values, "phone"), active: bool(values.active) };
    state.branches ??= [];
    const previous = state.branches.find((branch) => branch.id === matchId);
    const updated = replaceRecord(state.branches, record, matchId);
    state.warehouses.forEach((warehouse) => {
      if (warehouse.branchId === (matchId ?? record.id) || previous && warehouse.branch === previous.name) {
        warehouse.branchId = matchId ?? record.id;
        warehouse.branch = record.name;
      }
    });
    return updated;
  }
  if (kind === "warehouses") {
    const record: Warehouse = { id: values.id, code: values.code, name: values.name, branch: state.branches?.find((branch) => branch.id === values.branchId)?.name ?? values.branch ?? values.branchId, branchId: values.branchId, type: values.type as Warehouse["type"], active: bool(values.active) };
    const updated = replaceRecord(state.warehouses, record, matchId);
    state.products.forEach((product) => { state.stock[product.id] ??= {}; state.stock[product.id][matchId ?? record.id] ??= 0; });
    return updated;
  }
  if (kind === "categories") {
    const record: MasterCategory = { id: values.id, code: values.code, name: values.name, parentId: stringValue(values, "parentId"), active: bool(values.active) };
    state.masterCategories ??= [];
    const previous = state.masterCategories.find((category) => category.id === matchId);
    const updated = replaceRecord(state.masterCategories, record, matchId);
    if (previous && normalize(previous.name) !== normalize(record.name)) {
      state.categories = state.categories.map((name) => normalize(name) === normalize(previous.name) ? record.name : name);
      state.products.forEach((product) => { if (product.categoryId === previous.id || normalize(product.category) === normalize(previous.name)) product.category = record.name; });
    }
    if (!state.categories.some((name) => normalize(name) === normalize(record.name))) state.categories.push(record.name);
    return updated;
  }
  if (kind === "brands") { const record: Brand = { id: values.id, code: values.code, name: values.name, countryOfOrigin: stringValue(values, "countryOfOrigin"), active: bool(values.active) }; state.brands ??= []; return replaceRecord(state.brands, record, matchId); }
  if (kind === "units") { const record: UnitOfMeasure = { id: values.id, code: values.code, name: values.name, abbreviation: values.abbreviation, precision: numberValue(values, "precision"), active: bool(values.active) }; state.units ??= []; return replaceRecord(state.units, record, matchId); }
  if (kind === "conversions") { const record: UnitConversion = { id: values.id, productId: stringValue(values, "productId"), fromUnitId: values.fromUnitId, toUnitId: values.toUnitId, factor: numberValue(values, "factor"), validFrom: values.validFrom, validTo: stringValue(values, "validTo"), active: bool(values.active) }; state.unitConversions ??= []; return replaceRecord(state.unitConversions, record, matchId); }
  if (kind === "transporters") { const record: Transporter = { id: values.id, document: values.document, legalName: values.legalName, license: stringValue(values, "license"), vehicles: stringValue(values, "vehicles"), drivers: stringValue(values, "drivers"), contact: stringValue(values, "contact"), phone: stringValue(values, "phone"), email: stringValue(values, "email"), active: bool(values.active) }; state.transporters ??= []; return replaceRecord(state.transporters, record, matchId); }
  if (kind === "sellers") { const record: Seller = { id: values.id, code: values.code, name: values.name, commissionPct: numberValue(values, "commissionPct"), monthlyTarget: numberValue(values, "monthlyTarget"), zoneId: stringValue(values, "zoneId"), userId: stringValue(values, "userId"), active: bool(values.active) }; state.sellers ??= []; return replaceRecord(state.sellers, record, matchId); }
  if (kind === "zones") { const record: Zone = { id: values.id, code: values.code, name: values.name, route: stringValue(values, "route"), sellerId: stringValue(values, "sellerId"), active: bool(values.active) }; state.zones ??= []; return replaceRecord(state.zones, record, matchId); }
  if (kind === "currencies") {
    state.currencies ??= []; state.exchangeRates ??= [];
    const currency: Currency = { id: values.currencyId, isoCode: values.isoCode, name: values.name, symbol: values.symbol, active: bool(values.currencyActive) };
    const updatedCurrency = replaceRecord(state.currencies, currency, matchId);
    const currencyId = matchId ?? values.currencyId;
    if (values.date) {
      const rate: ExchangeRate = { id: `TDC-${currencyId}-${values.date}`, currencyId, date: values.date, buyRate: numberValue(values, "buyRate"), sellRate: numberValue(values, "sellRate"), active: bool(values.rateActive) };
      replaceRecord(state.exchangeRates, rate, rate.id);
    }
    return updatedCurrency;
  }
  if (kind === "taxes") { const record: Tax = { id: values.id, code: values.code, name: values.name, percentage: numberValue(values, "percentage"), type: values.type as Tax["type"], validFrom: values.validFrom, active: bool(values.active) }; state.taxes ??= []; return replaceRecord(state.taxes, record, matchId); }
  if (kind === "paymentMethods") { const record: PaymentMethod = { id: values.id, code: values.code, name: values.name, creditDays: numberValue(values, "creditDays"), type: values.type as PaymentMethod["type"], active: bool(values.active) }; state.paymentMethods ??= []; return replaceRecord(state.paymentMethods, record, matchId); }
  const list: PriceList = { id: values.id, code: values.code, name: values.name, currencyId: values.currencyId, validFrom: values.validFrom, validTo: stringValue(values, "validTo"), active: bool(values.active) };
  state.priceLists ??= []; state.priceListItems ??= [];
  const updatedList = replaceRecord(state.priceLists, list, matchId);
  const item: PriceListItem = { id: `PLI-${matchId ?? values.id}-${values.productId}-${values.minQuantity}`, priceListId: matchId ?? values.id, productId: values.productId, minQuantity: numberValue(values, "minQuantity"), price: numberValue(values, "price"), active: bool(values.itemActive) };
  replaceRecord(state.priceListItems, item, item.id);
  return updatedList;
}

export function importMasterCsv(state: State, text: string, mode: DuplicateMode): ImportSummary & { kind: MasterImportKind; title: string } {
  const preview = previewMasterCsv(state, text);
  const summary: ImportSummary & { kind: MasterImportKind; title: string } = { kind: preview.kind, title: preview.title, created: 0, updated: 0, skipped: 0, errors: preview.errors };
  if (baseImportKinds.has(preview.kind as ImportKind)) {
    const result = importCsv(state, preview.kind as ImportKind, text, mode);
    return { ...result, kind: preview.kind, title: preview.title };
  }
  for (const row of preview.rows) {
    if (row.status === "error") continue;
    if (row.status === "duplicate" && mode === "skip") { summary.skipped += 1; continue; }
    const updated = importCustomRow(state, preview.kind as Exclude<MasterImportKind, ImportKind>, row.values, row.matchId);
    if (updated) summary.updated += 1; else summary.created += 1;
  }
  if (summary.created || summary.updated) state.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: `Importar CSV de ${preview.title}`, record: `${summary.created} nuevos · ${summary.updated} actualizados` });
  return summary;
}

export function masterCsvTemplate(kind: Exclude<MasterImportKind, ImportKind>) {
  return `\uFEFF${customFields[kind].map((field) => field.key).join(",")}\r\n`;
}

export function masterDisplayValue(row: MasterImportRow) {
  return row.values.name || row.values.legalName || row.values.tradeName || row.values.code || row.values.isoCode || row.values.currencyId || row.values.id || "Registro";
}
