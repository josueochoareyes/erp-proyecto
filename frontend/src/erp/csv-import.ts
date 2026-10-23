import { supplierErrors } from "./catalog-logic.ts";
import type { Party, Product, State } from "./model.ts";

export type ImportKind = "customers" | "suppliers" | "products";
export type DuplicateMode = "skip" | "update";
type Field = { key: string; label: string; required?: boolean };
const commonParty: Field[] = [
  { key: "id", label: "Código interno" },
  { key: "name", label: "Nombre / razón social", required: true },
  { key: "taxId", label: "RUC / DNI", required: true },
  { key: "contact", label: "Contacto" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Correo" },
  { key: "address", label: "Dirección" },
  { key: "credit", label: "Línea de crédito" },
  { key: "active", label: "Estado" },
];
export const importFields: Record<ImportKind, Field[]> = {
  customers: [
    ...commonParty,
    { key: "tradeName", label: "Nombre comercial" },
    { key: "contactRole", label: "Cargo" },
    { key: "district", label: "Distrito" },
    { key: "province", label: "Provincia" },
    { key: "department", label: "Departamento" },
    { key: "paymentTerms", label: "Condición de pago" },
    { key: "currency", label: "Moneda" },
    { key: "zoneId", label: "Zona" },
    { key: "sellerId", label: "Vendedor" },
    { key: "priceListId", label: "Lista de precios" },
    { key: "commercialNotes", label: "Observaciones comerciales" },
  ],
  suppliers: [
    ...commonParty,
    { key: "tradeName", label: "Nombre comercial" },
    { key: "category", label: "Categoría del proveedor" },
    { key: "supplierType", label: "Tipo de proveedor" },
    { key: "registeredAt", label: "Fecha de registro" },
    { key: "contactRole", label: "Cargo" },
    { key: "alternatePhone", label: "Teléfono alternativo" },
    { key: "district", label: "Distrito" },
    { key: "province", label: "Provincia" },
    { key: "department", label: "Departamento" },
    { key: "paymentTerms", label: "Condición de pago" },
    { key: "currency", label: "Moneda" },
    { key: "estimatedDeliveryDays", label: "Plazo de entrega (días)" },
    { key: "suppliedCategories", label: "Categorías suministradas (separar con |)" },
    { key: "commercialStatus", label: "Estado comercial" },
    { key: "commercialNotes", label: "Observaciones comerciales" },
    { key: "internalNotes", label: "Notas internas" },
  ],
  products: [
    { key: "id", label: "Código interno" },
    { key: "name", label: "Producto", required: true },
    { key: "category", label: "Categoría existente", required: true },
    { key: "unit", label: "Unidad", required: true },
    { key: "cost", label: "Costo", required: true },
    { key: "price", label: "Precio con IGV", required: true },
    { key: "minimum", label: "Stock mínimo", required: true },
    { key: "description", label: "Descripción" },
    { key: "sku", label: "SKU" },
    { key: "barcode", label: "Código de barras" },
    { key: "active", label: "Estado" },
    { key: "registeredAt", label: "Fecha de registro" },
  ],
};
export type ImportRow = {
  line: number;
  values: Record<string, string>;
  errors: Record<string, string>;
  status: "valid" | "duplicate" | "error";
  matchId?: string;
};
export type ImportPreview = {
  rows: ImportRow[];
  valid: number;
  duplicate: number;
  errors: number;
};
export type ImportSummary = { created: number; updated: number; skipped: number; errors: number };

function parseCsv(text: string): { line: number; cells: string[] }[] {
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) throw Error("El archivo CSV está vacío.");
  const header = source.split(/\r?\n/, 1)[0];
  const delimiter = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], cell = "", quoted = false, closed = false;
  let line = 1, rowLine = 1, beginning = true;
  const finishCell = () => { cells.push(cell.trim()); cell = ""; beginning = true; closed = false; };
  const finishRow = () => {
    finishCell();
    if (cells.some(Boolean)) rows.push({ line: rowLine, cells });
    cells = [];
    rowLine = line + 1;
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else { cell += char; if (char === "\n") line++; }
    } else if (char === '"') {
      if (!beginning) throw Error(`Comillas inesperadas en la fila ${line}.`);
      quoted = true;
      beginning = false;
    } else if (char === delimiter) finishCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      finishRow(); line++;
    } else if (closed) {
      if (char !== " " && char !== "\t") throw Error(`Texto después de comillas en la fila ${line}.`);
    } else {
      if (beginning && (char === " " || char === "\t")) continue;
      cell += char; beginning = false;
    }
  }
  if (quoted) throw Error(`Faltan comillas de cierre en la fila ${rowLine}.`);
  if (cell || cells.length || closed) finishRow();
  if (rows.length < 2) throw Error("El CSV debe contener encabezados y al menos un registro.");
  if (rows.length > 20001) throw Error("Importa un máximo de 20 000 registros por archivo.");
  return rows;
}
const normalize = (value: string) => value.trim().toLocaleLowerCase("es-PE");
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const numberFields = new Set(["credit", "cost", "price", "minimum", "estimatedDeliveryDays"]);
function numeric(value: string): number {
  const normalized = value.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}
function resolveMatch(state: State, kind: ImportKind, values: Record<string, string>) {
  const list = state[kind];
  const matched = list.filter((record) => {
    if (values.id && normalize(record.id) === normalize(values.id)) return true;
    if (kind !== "products") return normalize((record as Party).taxId) === normalize(values.taxId ?? "");
    const product = record as Product;
    return Boolean(
      values.sku && product.sku && normalize(product.sku) === normalize(values.sku) ||
      values.barcode && product.barcode && normalize(product.barcode) === normalize(values.barcode) ||
      values.name && values.category && values.unit &&
        normalize(product.name) === normalize(values.name) &&
        normalize(product.category) === normalize(values.category) &&
        normalize(product.unit) === normalize(values.unit)
    );
  });
  return matched;
}
function validateRow(state: State, kind: ImportKind, row: ImportRow) {
  const { values, errors } = row;
  const fields = importFields[kind];
  for (const field of fields) if (field.required && !values[field.key])
    errors[field.key] = `${field.label} es obligatorio.`;
  if (values.id && !/^[A-Za-z0-9_-]+$/.test(values.id))
    errors.id = "El código solo admite letras, números, guiones y guiones bajos.";
  for (const key of numberFields) if (values[key] !== undefined && values[key] !== "") {
    const value = numeric(values[key]);
    if (!Number.isFinite(value) || value < 0 ||
        key === "estimatedDeliveryDays" && !Number.isInteger(value))
      errors[key] = "Ingresa un número válido no negativo.";
    else if (key === "price" && value <= 0) errors.price = "El precio debe ser mayor que cero.";
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Ingresa un correo válido.";
  if (values.registeredAt && !validDate(values.registeredAt))
    errors.registeredAt = "Usa una fecha válida AAAA-MM-DD.";
  if (values.active && !/^(true|false|1|0|activo|inactivo|s[ií]|no)$/i.test(values.active))
    errors.active = "Usa Activo, Inactivo, Sí, No, true o false.";
  if (kind === "products") {
    const category = state.categories.find((c) => normalize(c) === normalize(values.category ?? ""));
    if (values.category && !category) errors.category = "La categoría no existe en Mantenimientos.";
    else if (category) values.category = category;
    if (values.unit && !/^[\p{L}\p{N}.\- /]{1,20}$/u.test(values.unit))
      errors.unit = "La unidad debe tener entre 1 y 20 caracteres.";
    else if (values.unit && state.units?.length && !state.units.some((unit) => normalize(unit.code) === normalize(values.unit) || normalize(unit.abbreviation) === normalize(values.unit)))
      errors.unit = "La unidad no existe en Maestros.";
  } else if (values.taxId && !/^\d{8}(?:\d{3})?$/.test(values.taxId))
    errors.taxId = "Ingresa DNI de 8 dígitos o RUC de 11 dígitos.";
  if (kind === "customers") {
    if (values.zoneId && !state.zones?.some((zone) => zone.id === values.zoneId)) errors.zoneId = "La zona no existe.";
    if (values.sellerId && !state.sellers?.some((seller) => seller.id === values.sellerId)) errors.sellerId = "El vendedor no existe.";
    if (values.priceListId && !state.priceLists?.some((list) => list.id === values.priceListId)) errors.priceListId = "La lista de precios no existe.";
  }
  if (kind !== "products" && values.currency && !state.currencies?.some((currency) => currency.id === values.currency))
    errors.currency = "La moneda no existe.";
  const matches = resolveMatch(state, kind, values);
  if (matches.length > 1) errors.id = "Los identificadores del CSV coinciden con varios registros diferentes.";
  const match = matches[0];
  if (match && values.id && normalize(values.id) !== normalize(match.id))
    errors.id = "El código del CSV no coincide con el registro de ese documento, SKU o producto.";
  if (kind === "suppliers" && !errors.taxId) {
    const candidate = toRecord(kind, values, match as Party | undefined, `PRO-IMPORT-${row.line}`) as Party;
    const validation = supplierErrors(state, candidate, match?.id);
    Object.assign(errors, validation);
  }
  if (kind === "customers" && values.id && state.suppliers.some((s) => normalize(s.id) === normalize(values.id)))
    errors.id = "El código ya pertenece a un proveedor.";
  if (kind === "products" && values.id && [...state.customers, ...state.suppliers].some((s) => normalize(s.id) === normalize(values.id)))
    errors.id = "El código ya pertenece a otro catálogo.";
  row.matchId = match?.id;
}
function toRecord(kind: ImportKind, values: Record<string, string>, previous?: Party | Product, generatedId?: string) {
  const record: Record<string, unknown> = {
    ...(kind === "products"
      ? { cost: 0, price: 0, minimum: 0 }
      : { contact: "", phone: "", email: "", address: "", credit: 0 }),
    active: true,
    ...previous,
    id: previous?.id ?? (values.id || generatedId),
  };
  for (const [key, text] of Object.entries(values)) {
    if (key === "id") continue;
    if (numberFields.has(key)) {
      if (text !== "") record[key] = numeric(text);
      else if (!previous) record[key] = 0;
    } else if (key === "active") {
      if (text) record.active = /^(true|1|activo|s[ií])$/i.test(text);
    } else if (key === "suppliedCategories") {
      record[key] = text.split("|").map((part) => part.trim()).filter(Boolean);
    } else {
      record[key] = text;
    }
  }
  // An imported record is business data, never a demo entity.
  delete record.demo;
  return record;
}

export function previewCsv(state: State, kind: ImportKind, text: string): ImportPreview {
  const parsed = parseCsv(text);
  const fields = importFields[kind];
  const allowed = new Set(fields.map((f) => f.key));
  const headers = parsed[0].cells.map((cell) => cell.trim());
  const duplicates = headers.filter((cell, i) => headers.indexOf(cell) !== i);
  const unknown = headers.filter((cell) => !allowed.has(cell));
  const missing = fields.filter((f) => f.required && !headers.includes(f.key));
  if (duplicates.length) throw Error(`Encabezado repetido: ${duplicates.join(", ")}.`);
  if (unknown.length) throw Error(`Columnas no reconocidas: ${unknown.join(", ")}. Descarga la plantilla de este apartado.`);
  if (missing.length) throw Error(`Faltan columnas obligatorias: ${missing.map((f) => f.key).join(", ")}.`);
  const seen = new Map<string, number>();
  const rows = parsed.slice(1).map(({ line, cells }): ImportRow => {
    const values: Record<string, string> = {};
    headers.forEach((key, index) => { values[key] = cells[index]?.trim() ?? ""; });
    const row: ImportRow = { line, values, errors: {}, status: "valid" };
    if (cells.length !== headers.length)
      row.errors._fila = `Se esperaban ${headers.length} columnas y se encontraron ${cells.length}.`;
    validateRow(state, kind, row);
    const identifiers = kind === "products"
      ? [values.id && `id:${normalize(values.id)}`, values.sku && `sku:${normalize(values.sku)}`,
        values.barcode && `barcode:${normalize(values.barcode)}`,
        values.name && values.category && values.unit &&
          `nombre:${normalize(values.name)}|${normalize(values.category)}|${normalize(values.unit)}`]
      : [values.id && `id:${normalize(values.id)}`, values.taxId && `documento:${values.taxId}`];
    for (const identifier of identifiers.filter((v): v is string => Boolean(v))) {
      if (seen.has(identifier)) row.errors._fila = `Registro repetido dentro del CSV (fila ${seen.get(identifier)}).`;
    }
    if (!Object.keys(row.errors).length) for (const identifier of identifiers.filter((v): v is string => Boolean(v)))
      seen.set(identifier, line);
    row.status = Object.keys(row.errors).length ? "error" : row.matchId ? "duplicate" : "valid";
    return row;
  });
  return {
    rows,
    valid: rows.filter((r) => r.status === "valid").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    errors: rows.filter((r) => r.status === "error").length,
  };
}

export function importCsv(state: State, kind: ImportKind, text: string, mode: DuplicateMode): ImportSummary {
  const preview = previewCsv(state, kind, text);
  const summary = { created: 0, updated: 0, skipped: 0, errors: preview.errors };
  for (const row of preview.rows) {
    if (row.status === "error") continue;
    if (row.status === "duplicate" && mode === "skip") { summary.skipped++; continue; }
    const list = state[kind] as (Party | Product)[];
    const index = list.findIndex((r) => r.id === row.matchId);
    const previous = index >= 0 ? list[index] : undefined;
    const prefix = kind === "products" ? "PRD" : kind === "suppliers" ? "PRO" : "CLI";
    const record = toRecord(kind, row.values, previous, `${prefix}-${crypto.randomUUID()}`) as Party & Product;
    if (kind === "products") {
      record.categoryId = state.masterCategories?.find((category) => normalize(category.name) === normalize(record.category))?.id;
      record.unitId = state.units?.find((unit) => normalize(unit.code) === normalize(record.unit) || normalize(unit.abbreviation) === normalize(record.unit))?.id;
    }
    if (kind === "suppliers") {
      const validation = supplierErrors(state, record, previous?.id);
      if (Object.keys(validation).length) throw Error(`Fila ${row.line}: ${Object.values(validation)[0]}`);
    }
    if (index >= 0) { list[index] = record; summary.updated++; }
    else {
      if ([...state.products, ...state.customers, ...state.suppliers].some((r) => normalize(r.id) === normalize(record.id)))
        throw Error(`Fila ${row.line}: el código ya pertenece a otro registro.`);
      list.push(record);
      if (kind === "products") state.stock[record.id] = Object.fromEntries(state.warehouses.map((w) => [w.id, 0]));
      summary.created++;
    }
  }
  if (summary.created || summary.updated) state.audit.unshift({
    id: crypto.randomUUID(), date: new Date().toISOString(),
    action: `Importar CSV de ${kind}`, record: `${summary.created} nuevos · ${summary.updated} actualizados`,
  });
  return summary;
}

export function csvTemplate(kind: ImportKind): string {
  return `\uFEFF${importFields[kind].map((field) => field.key).join(",")}\r\n`;
}
