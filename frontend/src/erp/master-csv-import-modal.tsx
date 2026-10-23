import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Copy, Download, FileArchive, FileSpreadsheet, Rows3, UploadCloud } from "lucide-react";
import { Modal } from "./modal";
import { useErp } from "./store";
import { toast } from "./toast";
import { importBulkMasterCsv, previewBulkMasterCsv, type BulkCsvFile, type BulkImportPreview } from "./bulk-master-import";
import { masterDisplayValue } from "./master-csv-import";
import type { DuplicateMode } from "./csv-import";

export function MasterCsvImportModal({ onClose }: { onClose: () => void }) {
  const { state, transact } = useErp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<BulkCsvFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<BulkImportPreview | null>(null);
  const review = useMemo(() => files.length ? previewBulkMasterCsv(state, files, mode) : null, [state, files, mode]);
  const eligible = (review?.totals.created ?? 0) + (review?.totals.updated ?? 0);

  async function readFiles(selected: FileList | File[]) {
    setFileError(""); setFiles([]); setSummary(null);
    const list = Array.from(selected);
    if (!list.length) return;
    if (list.length > 30) { setFileError("Selecciona como máximo 30 archivos CSV."); return; }
    if (list.some((file) => !/\.csv$/i.test(file.name))) { setFileError("Todos los archivos deben tener extensión .csv."); return; }
    if (list.some((file) => file.size > 10 * 1024 * 1024) || list.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) {
      setFileError("Límite: 10 MB por archivo y 25 MB por lote."); return;
    }
    try {
      const decoded = await Promise.all(list.map(async (file) => ({ name: file.name, text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()) })));
      setFiles(decoded);
    } catch { setFileError("No se pudo leer uno de los CSV. Guárdalos con codificación UTF-8."); }
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void readFiles(event.dataTransfer.files); }
  function select(event: ChangeEvent<HTMLInputElement>) { void readFiles(event.target.files ?? []); event.target.value = ""; }
  function confirm() {
    if (!review || review.hasFileErrors || !eligible || busy) return;
    setBusy(true); setFileError("");
    try {
      let result!: BulkImportPreview;
      transact((draft) => { result = importBulkMasterCsv(draft, files, mode); });
      setSummary(result);
      toast.success("Importación masiva completada.");
    } catch (error) { setFileError(error instanceof Error ? error.message : "No se pudo guardar el lote."); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="Importación masiva CSV" subtitle="Maestros · 17 catálogos en un solo proceso" icon={<FileArchive size={20} />} onClose={onClose} wide className="csv-import-modal masters-bulk-modal">
      {summary ? (
        <div className="csv-finish" role="status">
          <span className="csv-finish-icon"><CheckCircle2 size={28} /></span>
          <h3>Importación finalizada</h3>
          <p>{summary.files.length} archivos procesados. Los catálogos ya están disponibles en los módulos del ERP.</p>
          <div className="csv-stats">
            <span><strong>{summary.totals.created}</strong> nuevos</span><span><strong>{summary.totals.updated}</strong> actualizados</span>
            <span><strong>{summary.totals.skipped}</strong> omitidos</span><span><strong>{summary.totals.errors}</strong> filas con errores</span>
          </div>
          <div className="masters-bulk-results">{summary.files.map((file) => <span key={file.name}>{file.title}: {file.result?.created ?? 0} nuevos · {file.result?.updated ?? 0} actualizados</span>)}</div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Finalizar</button></div>
        </div>
      ) : (
        <>
          <div className="csv-intro">
            <div><span className="csv-step">PASO 01 · ARCHIVOS</span><h3>Selecciona los CSV de los catálogos</h3><p>Puedes incluir los 17 submódulos en un lote. Se ordenarán según sus relaciones antes de importar.</p></div>
            <a className="secondary-btn csv-template" href="/plantillas-csv/plantillas-maestros.zip" download><Download size={16} /> Descargar plantillas</a>
          </div>
          <p className="csv-help">Una plantilla por catálogo. Guarda los archivos como CSV UTF-8; los códigos relacionados deben coincidir. Las operaciones comerciales y el stock no se generan por esta importación.</p>
          <div className={`csv-drop ${dragging ? "is-dragging" : ""}`} role="button" tabIndex={0}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
            onClick={() => fileInput.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }}>
            <span className="csv-drop-icon"><UploadCloud size={25} /></span>
            <strong>{files.length ? `${files.length} ${files.length === 1 ? "archivo seleccionado" : "archivos seleccionados"}` : "Arrastra varios CSV aquí o selecciónalos"}</strong>
            <small>Hasta 30 archivos · 10 MB cada uno · 25 MB por lote</small>
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv" multiple className="csv-file-input" onChange={select} aria-label="Seleccionar archivos CSV de Maestros" />
          {fileError && <p className="error" role="alert">{fileError}</p>}
          {review && <>
            <div className="csv-intro csv-preview-heading"><div><span className="csv-step">PASO 02 · REVISIÓN</span><h3>Resultado del lote</h3><p>Expande cada archivo para revisar sus filas y errores antes de confirmar.</p></div></div>
            <div className="csv-stats" aria-label="Resultado de validación">
              <span><CheckCircle2 size={16} /><strong>{review.totals.created}</strong> nuevos</span>
              <span><Copy size={16} /><strong>{review.totals.updated + review.totals.skipped}</strong> duplicados</span>
              <span><AlertCircle size={16} /><strong>{review.totals.errors}</strong> filas con errores</span>
              <span><Rows3 size={16} /><strong>{review.files.length}</strong> archivos</span>
            </div>
            {review.hasFileErrors && <p className="error" role="alert">Algunos archivos no se pueden procesar. Corrige sus encabezados o contenido antes de importar el lote.</p>}
            <label className="csv-policy">Si el registro ya existe:
              <select value={mode} onChange={(event) => setMode(event.target.value as DuplicateMode)}><option value="skip">Omitir duplicados</option><option value="update">Actualizar existentes</option></select>
            </label>
            <div className="masters-bulk-files">
              {review.files.map((file, index) => <details key={`${file.name}-${index}`} className="masters-bulk-file" open={index === 0 ? true : undefined}>
                <summary><FileSpreadsheet size={17} /><span><strong>{file.title ?? file.name}</strong><small>{file.name}</small></span><em>{file.error ? "Revisar archivo" : `${file.preview?.valid ?? 0} nuevos · ${file.preview?.duplicate ?? 0} duplicados · ${file.preview?.errors ?? 0} errores`}</em><ChevronDown size={16} /></summary>
                {file.error && <p className="masters-bulk-file-error" role="alert">{file.error}</p>}
                {file.preview && <div className="masters-bulk-file-body">
                  <div className="csv-table-wrap"><table className="csv-table"><thead><tr><th>Fila</th><th>Estado</th><th>Registro</th><th>Identificador</th><th>Detalle</th></tr></thead><tbody>{file.preview.rows.slice(0, 12).map((row) => <tr key={row.line}>
                    <td>{row.line}</td><td><span className={`csv-badge csv-${row.status}`}>{row.status === "error" ? "Error" : row.status === "duplicate" ? mode === "skip" ? "Se omitirá" : "Se actualizará" : "Nuevo"}</span></td>
                    <td>{masterDisplayValue(row)}</td><td>{row.values.taxId || row.values.document || row.values.id || row.values.currencyId || "—"}</td>
                    <td>{Object.entries(row.errors).length ? Object.entries(row.errors).map(([key, message]) => <div className="csv-cell-error" key={key}><b>{key === "_fila" ? "Fila" : key}:</b> {message}</div>) : row.matchId ? `Coincide con ${row.matchId}` : "Listo para importar"}</td>
                  </tr>)}</tbody></table></div>
                  {file.preview.rows.length > 12 && <p className="csv-help">Se muestran 12 de {file.preview.rows.length} filas. La validación incluye todo el archivo.</p>}
                </div>}
              </details>)}
            </div>
          </>}
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button type="button" className="btn" disabled={!eligible || review?.hasFileErrors || busy} onClick={confirm}>{busy ? "Guardando…" : `Importar ${eligible} registro${eligible === 1 ? "" : "s"}`}</button></div>
        </>
      )}
    </Modal>
  );
}
