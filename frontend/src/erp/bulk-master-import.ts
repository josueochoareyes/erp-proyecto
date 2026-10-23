import { importMasterCsv, previewMasterCsv, detectMasterImportKind, type MasterImportKind, type MasterImportPreview } from "./master-csv-import.ts";
import { ensureMasterData } from "./master-migrations.ts";
import type { DuplicateMode, ImportSummary } from "./csv-import.ts";
import type { State } from "./model.ts";

export type BulkCsvFile = { name: string; text: string };
export type BulkFilePreview = {
  name: string;
  kind?: MasterImportKind;
  title?: string;
  preview?: MasterImportPreview;
  result?: ImportSummary;
  error?: string;
};
export type BulkImportPreview = {
  files: BulkFilePreview[];
  totals: ImportSummary;
  hasFileErrors: boolean;
};

// Dependencies precede their consumers, regardless of the file selection order.
const order: MasterImportKind[] = [
  "currencies", "companies", "branches", "warehouses", "categories", "brands",
  "units", "products", "conversions", "transporters", "zones", "sellers",
  "taxes", "paymentMethods", "priceLists", "customers", "suppliers",
];

function arrange(files: BulkCsvFile[]) {
  return files.map((file, position) => {
    try { return { file, position, kind: detectMasterImportKind(file.text) }; }
    catch (error) { return { file, position, error: error instanceof Error ? error.message : "CSV inválido." }; }
  }).sort((a, b) => (a.kind ? order.indexOf(a.kind) : order.length) - (b.kind ? order.indexOf(b.kind) : order.length) || a.position - b.position);
}

function missingReference(state: State, kind: MasterImportKind, values: Record<string, string>): [string, string] | undefined {
  const check = (field: string, list: { id: string }[] | undefined, message: string): [string, string] | undefined =>
    values[field] && !list?.some((item) => item.id === values[field]) ? [field, message] : undefined;
  if (kind === "categories") return check("parentId", state.masterCategories, "La categoría padre no existe en el lote final.");
  if (kind === "sellers") return check("zoneId", state.zones, "La zona no existe en el lote final.");
  if (kind === "zones") return check("sellerId", state.sellers, "El vendedor no existe en el lote final.");
  if (kind === "customers") return check("zoneId", state.zones, "La zona no existe.") ?? check("sellerId", state.sellers, "El vendedor no existe.") ?? check("priceListId", state.priceLists, "La lista de precios no existe.");
  return undefined;
}

function evaluate(state: State, files: BulkCsvFile[], mode: DuplicateMode): BulkImportPreview {
  if (!files.length) throw Error("Selecciona uno o varios archivos CSV.");
  if (files.length > 30) throw Error("Selecciona como máximo 30 archivos por importación.");
  let staged = structuredClone(state);
  const results: BulkFilePreview[] = [];
  const totals: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for (const { file, kind, error } of arrange(files)) {
    if (!kind) { results.push({ name: file.name, error }); continue; }
    try {
      // A failed file never leaves partial rows in the staged state.
      const candidate = structuredClone(staged);
      const preview = previewMasterCsv(candidate, file.text);
      const result = importMasterCsv(candidate, file.text, mode);
      ensureMasterData(candidate);
      staged = candidate;
      results.push({ name: file.name, kind, title: preview.title, preview, result });
      totals.created += result.created;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
      totals.errors += result.errors;
    } catch (cause) {
      results.push({ name: file.name, kind, error: cause instanceof Error ? cause.message : "No se pudo procesar el archivo." });
    }
  }
  for (const file of results) {
    if (file.error || !file.kind || !file.preview) continue;
    for (const row of file.preview.rows) {
      if (row.status === "error" || row.status === "duplicate" && mode === "skip") continue;
      const issue = missingReference(staged, file.kind, row.values);
      if (issue) {
        row.errors[issue[0]] = issue[1];
        row.status = "error";
        file.error = `Fila ${row.line}: ${issue[1]}`;
        break;
      }
    }
  }
  return { files: results, totals, hasFileErrors: results.some((file) => Boolean(file.error)) };
}

export function previewBulkMasterCsv(state: State, files: BulkCsvFile[], mode: DuplicateMode): BulkImportPreview {
  return evaluate(state, files, mode);
}

/** Commit only if every file was recognized and validated at the file level. Invalid rows are reported and skipped. */
export function importBulkMasterCsv(state: State, files: BulkCsvFile[], mode: DuplicateMode): BulkImportPreview {
  const preflight = evaluate(state, files, mode);
  if (preflight.hasFileErrors) throw Error("Hay archivos que no se pueden procesar. Corrígelos antes de confirmar.");
  if (!preflight.totals.created && !preflight.totals.updated) throw Error("No hay registros nuevos o actualizaciones para importar.");
  const results: BulkFilePreview[] = [];
  const totals: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for (const { file } of arrange(files)) {
    const preview = previewMasterCsv(state, file.text);
    const result = importMasterCsv(state, file.text, mode);
    ensureMasterData(state);
    results.push({ name: file.name, kind: preview.kind, title: preview.title, preview, result });
    totals.created += result.created;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
    totals.errors += result.errors;
  }
  return { files: results, totals, hasFileErrors: false };
}
