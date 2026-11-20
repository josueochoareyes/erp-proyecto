import { useRef, useState, type ReactNode } from "react";
import {
  FileText,
  ReceiptText,
  X,
  ArrowUpRight,
  Printer,
  Download,
  UserRound,
  Package,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { Modal, ModalDismissButton } from "./modal";
import { useErp } from "./store";
import { toast } from "./toast";
import type { InvoicePdfFormat } from "./invoice-pdf";
import {
  dateLabel,
  invoice,
  isCredit,
  nextInvoiceNumber,
  today,
  vouchers,
  type Document,
  type Quote,
  type Party,
} from "./model";
import {
  creditDueDate,
  documentMoney,
  financialSummary,
  salesRelations,
} from "./sales-document-data";

type SalesDocument = Document | Quote;
const shown = (value?: string) => value?.trim() || "No registrado";
const stamp = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("es-PE")
    : "No registrado";
function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="sales-field">
      <dt>{label}</dt>
      <dd>{children || "No registrado"}</dd>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sales-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="sales-status">
      <span />
      {value}
    </span>
  );
}
function Header({
  title,
  doc,
  creation = false,
}: {
  title: string;
  doc: SalesDocument;
  creation?: boolean;
}) {
  return (
    <header className="sales-header">
      <div className="sales-heading-icon">
        {creation || ("kind" in doc && doc.kind === "CP") ? (
          <ReceiptText size={24} />
        ) : (
          <FileText size={24} />
        )}
      </div>
      <div className="sales-heading">
        <span className="sales-eyebrow">ENTERPRISECLOUD · VENTAS</span>
        <h2>{title}</h2>
        <p>
          {creation
            ? "Revisa y confirma la emisión del comprobante"
            : "Información comercial y trazabilidad del documento"}
        </p>
      </div>
      <ModalDismissButton className="sales-icon-button" aria-label="Cerrar">
        <X size={20} />
      </ModalDismissButton>
    </header>
  );
}
export function CustomerSummaryCard({ doc }: { doc: SalesDocument }) {
  const { state } = useErp();
  const customer =
    doc.customerSnapshot ?? state.customers.find((p) => p.id === doc.partyId);
  return (
    <div className="sales-customer">
      <span className="sales-customer-icon">
        <UserRound size={21} />
      </span>
      <div>
        <span className="sales-eyebrow">CLIENTE</span>
        <h4>{shown(customer?.name)}</h4>
        <p>
          {customer?.taxId?.length === 8 ? "DNI" : "RUC / DNI"}:{" "}
          {shown(customer?.taxId)}
        </p>
        <p>{shown(customer?.address)}</p>
        {customer?.email && <p>{customer.email}</p>}
      </div>
      <div className="sales-customer-terms">
        <span>Condición de pago</span>
        <strong>{shown(doc.method)}</strong>
        {!doc.customerSnapshot && <small>Ficha actual del catálogo</small>}
      </div>
    </div>
  );
}
export function DocumentItemsTable({
  doc,
  compact = false,
}: {
  doc: SalesDocument;
  compact?: boolean;
}) {
  const { state } = useErp();
  const fmt = (n: number) => documentMoney(doc, n);
  return (
    <>
      <div
        className="sales-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Productos del documento"
      >
        <table className="sales-items">
          <thead>
            <tr>
              <th>Código / Producto</th>
              {!compact && (
                <>
                  <th>Categoría</th>
                  <th>Unidad</th>
                </>
              )}
              <th className="sales-numeric">Cantidad</th>
              <th className="sales-numeric">Precio unitario</th>
              <th className="sales-numeric">Descuento</th>
              <th className="sales-numeric">Importe</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => {
              const p =
                l.productSnapshot ??
                state.products.find((p) => p.id === l.productId);
              return (
                <tr key={`${l.productId}-${i}`}>
                  <td>
                    <span className="sales-product-code">{l.productId}</span>
                    <strong>{shown(p?.name)}</strong>
                    {p?.description && <small>{p.description}</small>}
                  </td>
                  {!compact && (
                    <>
                      <td>{shown(p?.category)}</td>
                      <td>{shown(p?.unit)}</td>
                    </>
                  )}
                  <td className="sales-numeric">
                    {l.quantity.toLocaleString("es-PE", {
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="sales-numeric">{fmt(l.price)}</td>
                  <td className="sales-numeric">—</td>
                  <td className="sales-numeric">
                    <strong>{fmt(l.quantity * l.price)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={compact ? 4 : 6}>
                Total del documento · incluye descuento global y flete
              </td>
              <td className="sales-numeric">{fmt(doc.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="sales-hint">
        El descuento se registra sobre el documento completo; no hay descuentos
        individuales guardados por producto. Los precios incluyen IGV.
      </p>
    </>
  );
}
export function SalesOrderFinancialSummary({
  doc,
  account,
  preview = false,
}: {
  doc: SalesDocument;
  account?: Document;
  preview?: boolean;
}) {
  const f = financialSummary(doc),
    fmt = (n: number) => documentMoney(doc, n);
  return (
    <div className="sales-financial">
      <dl className="sales-amounts">
        <Field label="Subtotal de productos">{fmt(f.subtotal)}</Field>
        <Field label="Descuento global">− {fmt(f.discount)}</Field>
        <Field label="Flete">{fmt(f.freight)}</Field>
        {f.difference !== 0 && (
          <Field label="Diferencia respecto al detalle guardado">
            {fmt(f.difference)}
          </Field>
        )}
        <Field label="Base imponible (incluida en total)">{fmt(f.base)}</Field>
        <Field label="IGV 18% (incluido)">{fmt(f.tax)}</Field>
      </dl>
      <div className="sales-total">
        <span>{preview ? "Total a facturar" : "Total general"}</span>
        <strong>{fmt(doc.total)}</strong>
        <small>{doc.currency ?? "PEN"} · Precios con IGV incluido</small>
        <dl>
          <Field label={preview ? "Saldo que se generará" : "Saldo pendiente"}>
            {preview
              ? fmt(doc.total)
              : account
                ? fmt(account.balance)
                : "No generado"}
          </Field>
          {account && (
            <Field label="Importe pagado">
              {fmt(account.payments.reduce((sum, p) => sum + p.amount, 0))}
            </Field>
          )}
        </dl>
      </div>
      <p className="sales-hint">
        Se respeta el total guardado. Base e IGV se desglosan según la regla
        vigente del ERP (18% incluido); no son importes tributarios históricos
        almacenados por separado.
      </p>
    </div>
  );
}
function Payments({ doc }: { doc?: Document }) {
  return doc?.payments.length ? (
    <div className="sales-table-scroll">
      <table className="sales-items">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Medio de pago</th>
            <th>Referencia</th>
            <th className="sales-numeric">Importe</th>
          </tr>
        </thead>
        <tbody>
          {doc.payments.map((p) => (
            <tr key={p.id}>
              <td>{dateLabel(p.date)}</td>
              <td>{p.method}</td>
              <td>{shown(p.reference)}</td>
              <td className="sales-numeric">{documentMoney(doc, p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="sales-empty">No hay pagos registrados.</p>
  );
}
function DocumentLink({
  label,
  doc,
  onOpen,
  currentId,
}: {
  label: string;
  doc?: SalesDocument;
  onOpen: (doc: SalesDocument) => void;
  currentId?: string;
}) {
  return (
    <Field label={label}>
      {doc?.id === currentId ? (
        doc?.number
      ) : doc ? (
        <button className="sales-link" onClick={() => onOpen(doc)}>
          {doc.number}
          <ArrowUpRight size={14} />
        </button>
      ) : (
        "No registrado"
      )}
    </Field>
  );
}
export function SalesDocumentDetailsModal({
  doc,
  onClose,
}: {
  doc: SalesDocument;
  onClose: () => void;
}) {
  const { state } = useErp();
  const [tab, setTab] = useState(0),
    [related, setRelated] = useState<SalesDocument | null>(null);
  const [pdfFormat, setPdfFormat] = useState<InvoicePdfFormat>("corporate");
  const [pdfBusy, setPdfBusy] = useState(false);
  // Legacy quotations may carry a spread `kind: OV`; resolve identity from the collections.
  const storedDocument = state.documents.find((d) => d.id === doc.id);
  const current =
    storedDocument ?? state.quotes.find((q) => q.id === doc.id) ?? doc;
  const isOrder = storedDocument?.kind === "OV",
    isInvoice = storedDocument?.kind === "CP";
  const relations = storedDocument
    ? salesRelations(state, storedDocument)
    : {
        order: state.documents.find((d) => d.id === (current as Quote).orderId),
        invoice: undefined,
        quote: undefined,
        movements: [],
        payments: [],
      };
  const customer =
    current.customerSnapshot ??
    state.customers.find((p) => p.id === current.partyId);
  const account = isInvoice ? (current as Document) : relations.invoice;
  const documentNumbers = [
    current.number,
    relations.order?.number,
    relations.invoice?.number,
    relations.quote?.number,
  ].filter((n): n is string => !!n);
  const activity = state.audit.filter((event) =>
    documentNumbers.some((number) => event.record.includes(number)),
  );
  const title = isOrder
    ? "Detalle de orden de venta"
    : isInvoice
      ? "Detalle del comprobante"
      : "Detalle de cotización";
  const tabs = ["General", "Productos", "Resumen económico", "Seguimiento"];
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      hideHeader
      className="sales-premium-modal"
    >
      <Header title={title} doc={current} />
      <div className="sales-document-banner">
        <div>
          <span className="sales-eyebrow">
            {isInvoice
              ? current.voucher
              : isOrder
                ? "ORDEN DE VENTA"
                : "COTIZACIÓN"}
          </span>
          <strong>{current.number}</strong>
        </div>
        <Status value={current.status} />
        <div className="sales-banner-date">
          <span>Fecha de emisión</span>
          <b>{dateLabel(current.date)}</b>
        </div>
        {relations.quote && (
          <button
            className="sales-link sales-origin-link"
            onClick={() => setRelated(relations.quote!)}
          >
            Cotización {relations.quote.number}
            <ArrowUpRight size={14} />
          </button>
        )}
        {current.demo && <span className="sales-demo">DEMO</span>}
      </div>
      <div
        className="sales-tabs"
        role="tablist"
        aria-label="Información del documento"
      >
        {tabs.map((name, i) => (
          <button
            key={name}
            id={`sales-tab-${current.id}-${i}`}
            role="tab"
            aria-selected={tab === i}
            aria-controls={`sales-panel-${current.id}`}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const n =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? 3
                    : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
              setTab(n);
              document.getElementById(`sales-tab-${current.id}-${n}`)?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        className="sales-body"
        role="tabpanel"
        id={`sales-panel-${current.id}`}
        aria-labelledby={`sales-tab-${current.id}-${tab}`}
        tabIndex={0}
      >
        {tab === 0 && (
          <>
            <CustomerSummaryCard doc={current} />
            <Section title="Información del documento">
              <dl className="sales-field-grid">
                <Field label="Número de documento">{current.number}</Field>
                <Field label="Fecha de emisión">
                  {dateLabel(current.date)}
                </Field>
                <Field label="Estado">{current.status}</Field>
                {(isOrder || isInvoice) && (
                  <Field label="Dirección de entrega">
                    {current.deliveryAddress || customer?.address}
                  </Field>
                )}
                <Field label="Almacén">
                  {
                    state.warehouses.find((w) => w.id === current.warehouseId)
                      ?.name
                  }
                </Field>
                <Field label="Forma de pago">{current.method}</Field>
                <Field label="Tipo de comprobante">{current.voucher}</Field>
                <Field label="Teléfono">{customer?.phone}</Field>
                <Field label="Correo">{customer?.email}</Field>
                <Field label="Condiciones comerciales">
                  {current.commercialTerms}
                </Field>
                <Field label="Moneda">{current.currency ?? "PEN"}</Field>
                <DocumentLink
                  currentId={current.id}
                  label="Cotización de origen"
                  doc={relations.quote}
                  onOpen={setRelated}
                />
                {isInvoice && (
                  <DocumentLink
                    currentId={current.id}
                    label="Orden de venta de origen"
                    doc={relations.order}
                    onOpen={setRelated}
                  />
                )}
                <DocumentLink
                  currentId={current.id}
                  label="Comprobante asociado"
                  doc={relations.invoice}
                  onOpen={setRelated}
                />
              </dl>
            </Section>
            <Section title="Observaciones">
              <p className="sales-notes">{shown(current.notes)}</p>
            </Section>
          </>
        )}
        {tab === 1 && (
          <Section title="Productos del documento">
            <DocumentItemsTable doc={current} />
          </Section>
        )}
        {tab === 2 && (
          <Section title="Resumen económico">
            <SalesOrderFinancialSummary doc={current} account={account} />
          </Section>
        )}
        {tab === 3 && (
          <>
            <Section title="Trazabilidad documental">
              <dl className="sales-field-grid">
                <Field label="Estado actual">{current.status}</Field>
                <Field label="Fecha de creación">
                  {stamp(current.createdAt)}
                </Field>
                <DocumentLink
                  currentId={current.id}
                  label="Cotización relacionada"
                  doc={relations.quote}
                  onOpen={setRelated}
                />
                <DocumentLink
                  currentId={current.id}
                  label="Orden de venta"
                  doc={relations.order}
                  onOpen={setRelated}
                />
                <Field label="Fecha de facturación">
                  {relations.invoice
                    ? dateLabel(relations.invoice.date)
                    : undefined}
                </Field>
                <DocumentLink
                  currentId={current.id}
                  label="Comprobante asociado"
                  doc={relations.invoice}
                  onOpen={setRelated}
                />
              </dl>
            </Section>
            <Section title="Movimientos de inventario">
              {relations.movements.length ? (
                <ul className="sales-events">
                  {relations.movements.map((m) => (
                    <li key={m.id}>
                      <Package size={17} />
                      <div>
                        <strong>
                          {m.type} · {m.productId} · {m.quantity} unidades
                        </strong>
                        <span>
                          {dateLabel(m.date)} ·{" "}
                          {state.warehouses.find((w) => w.id === m.warehouseId)
                            ?.name ?? m.warehouseId}{" "}
                          · Saldo: {m.balance}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sales-empty">
                  No hay movimientos vinculados. Crear una orden no reserva ni
                  descuenta stock.
                </p>
              )}
            </Section>
            <Section title="Pagos registrados">
              <Payments doc={account} />
            </Section>
            <Section title="Historial de estados">
              {current.statusHistory?.length ? (
                <ul className="sales-events">
                  {current.statusHistory.map((event, i) => (
                    <li key={i}>
                      <Clock3 size={17} />
                      <div>
                        <strong>{event.status}</strong>
                        <span>{stamp(event.date)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sales-empty">
                  No se conservaron eventos de estado para este documento.
                </p>
              )}
            </Section>
            <Section title="Actividad registrada">
              {activity.length ? (
                <ul className="sales-events">
                  {activity.map((event) => (
                    <li key={event.id}>
                      <Clock3 size={17} />
                      <div>
                        <strong>{event.action}</strong>
                        <span>
                          {event.record} · {stamp(event.date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sales-empty">
                  No hay eventos de auditoría relacionados.
                </p>
              )}
            </Section>
          </>
        )}
      </div>
      <footer className="sales-footer">
        <span>
          Registro interno{current.demo ? " DEMO" : ""} · Sin validación
          electrónica SUNAT
        </span>
        <div>
          {isInvoice && (
            <div className="sales-pdf-actions">
              <label htmlFor={`invoice-pdf-format-${current.id}`}>Formato PDF</label>
              <select
                id={`invoice-pdf-format-${current.id}`}
                value={pdfFormat}
                disabled={pdfBusy}
                onChange={(event) => setPdfFormat(event.target.value as InvoicePdfFormat)}
              >
                <option value="corporate">A4 · Corporativo</option>
                <option value="classic">Carta · Clásico</option>
                <option value="compact">A5 · Compacto</option>
              </select>
              <button
                type="button"
                className="secondary-btn"
                disabled={pdfBusy}
                onClick={async () => {
                  setPdfBusy(true);
                  try {
                    const { downloadInvoicePdf } = await import("./invoice-pdf");
                    await downloadInvoicePdf(state, current as Document, pdfFormat);
                    toast.success("PDF de factura descargado correctamente.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "No se pudo exportar el PDF.");
                  } finally {
                    setPdfBusy(false);
                  }
                }}
              >
                <Download size={15} />
                {pdfBusy ? "Generando…" : "Descargar PDF"}
              </button>
            </div>
          )}
          <button
            className="secondary-btn"
            onClick={() => printSalesDocument(state, current)}
          >
            <Printer size={15} />
            Imprimir
          </button>
          <ModalDismissButton className="btn">Cerrar ficha</ModalDismissButton>
        </div>
      </footer>
      {related && (
        <SalesDocumentDetailsModal
          key={related.id}
          doc={related}
          onClose={() => setRelated(null)}
        />
      )}
    </Modal>
  );
}
export function InvoiceCreationModal({
  doc,
  onClose,
  onComplete,
}: {
  doc: Document;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const { state, transact } = useErp();
  const [date, setDate] = useState(today()),
    [voucher, setVoucher] = useState(doc.voucher || vouchers[0]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = state.documents.find((d) => d.id === doc.id) ?? doc;
  const processed =
    current.status !== "Pendiente" ||
    state.documents.some((d) => d.kind === "CP" && d.sourceId === current.id);
  const due = creditDueDate(date, current.method);
  return (
    <Modal
      title="Facturar venta"
      dismissible={!busy}
      onClose={() => {
        if (!lock.current) onClose();
      }}
      hideHeader
      wide
      className="sales-premium-modal sales-invoice-modal"
    >
      <Header title="Facturar venta" doc={current} creation />
      <div className="sales-document-banner">
        <div>
          <span className="sales-eyebrow">ORDEN DE VENTA</span>
          <strong>{current.number}</strong>
        </div>
        <Status value={current.status} />
        <span className="sales-banner-date">
          {current.lines.length} productos ·{" "}
          {documentMoney(current, current.total)}
        </span>
      </div>
      <form
        className="sales-invoice-form"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || processed) return;
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
            let id = "";
            transact((s) => {
              const cp = invoice(s, current.id, voucher, date);
              id = cp.id;
            });
            onComplete(id);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "No se pudo registrar el comprobante.",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <div className="sales-body">
          {(error || processed) && (
            <p className="sales-alert" role="alert">
              {error ||
                "Esta orden ya fue procesada. Consulta el comprobante asociado."}
            </p>
          )}
          <Section title="Cliente">
            <CustomerSummaryCard doc={current} />
          </Section>
          <Section title="Documento">
            <div className="sales-document-fields">
              <label>
                Fecha de emisión
                <input
                  type="date"
                  required
                  value={date}
                  disabled={busy}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Tipo de comprobante
                <select
                  value={voucher}
                  disabled={busy}
                  onChange={(e) => setVoucher(e.target.value)}
                >
                  {vouchers.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <Field label="Numeración interna prevista">
                {nextInvoiceNumber(state, voucher)}
              </Field>
              <Field label="Moneda">{current.currency ?? "PEN"}</Field>
              <Field label="Forma de pago">{current.method}</Field>
              {isCredit(current.method) && (
                <Field label="Vencimiento según condición de pago">
                  {due ? dateLabel(due) : "No registrado"}
                </Field>
              )}
            </div>
            <p className="sales-hint">
              Numeración interna asignada al confirmar; puede cambiar si se
              registra otro comprobante. No representa autorización de SUNAT.
            </p>
          </Section>
          <Section title="Productos a facturar">
            <DocumentItemsTable doc={current} compact />
          </Section>
          <Section title="Resumen de facturación">
            <SalesOrderFinancialSummary doc={current} preview />
          </Section>
          <Section title="Al confirmar esta operación">
            <ul className="sales-confirmation">
              <li>
                Registrar el comprobante interno y marcar la orden como
                facturada.
              </li>
              <li>
                Descontar existencias del almacén de la orden y registrar las
                salidas en el Kardex.
              </li>
              <li>
                Crear el saldo por cobrar. El pago se registra por separado.
              </li>
            </ul>
            <p className="sales-hint">
              Se vuelve a comprobar stock
              {isCredit(current.method) ? " y línea de crédito" : ""} antes de
              guardar. El proceso no envía documentos a SUNAT.
            </p>
          </Section>
        </div>
        <footer className="sales-footer">
          <span>Revisa los importes antes de confirmar</span>
          <div>
            <button
              type="button"
              className="secondary-btn"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="btn" disabled={busy || processed}>
              {busy && <LoaderCircle className="sales-spinning" size={16} />}{" "}
              {busy ? "Procesando…" : "Confirmar facturación"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

function printSalesDocument(
  state: ReturnType<typeof useErp>["state"],
  doc: SalesDocument,
) {
  const esc = (value: unknown) =>
    String(value ?? "No registrado").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const fmt = (n: number) => esc(documentMoney(doc, n)),
    f = financialSummary(doc),
    customer: Party | undefined =
      doc.customerSnapshot ?? state.customers.find((p) => p.id === doc.partyId);
  const storedDocument = state.documents.find((d) => d.id === doc.id);
  const relations = storedDocument
      ? salesRelations(state, storedDocument)
      : null,
    account =
      storedDocument?.kind === "CP" ? storedDocument : relations?.invoice;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(doc.number)} · EnterpriseCloud</title><style>body{font:14px Inter,Arial,sans-serif;color:#111827;margin:40px}header{border-bottom:2px solid #111827;padding-bottom:20px}h1{font-size:26px;margin:8px 0}p{line-height:1.6}small{color:#6b7280}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f3f4f6}td:nth-child(n+3),th:nth-child(n+3){text-align:right}.total{background:#f3f4f6;padding:20px;text-align:right;font-size:22px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px}.notes{white-space:pre-wrap}footer{margin-top:30px;border-top:1px solid #e5e7eb;padding-top:15px}@page{margin:15mm}@media print{body{margin:0}tr{break-inside:avoid}thead{display:table-header-group}}</style></head><body><header><small>ENTERPRISECLOUD · ${esc(state.settings.company)}</small><h1>${esc(doc.number)}</h1><p>${esc(storedDocument ? (storedDocument.kind === "OV" ? "Orden de venta" : storedDocument.voucher) : "Cotización")} · ${esc(doc.status)} · ${esc(dateLabel(doc.date))}</p></header><div class="meta"><p><b>Cliente</b><br>${esc(customer?.name)}<br>RUC / DNI: ${esc(customer?.taxId)}<br>${esc(customer?.address)}<br>${esc(customer?.email)}</p><p><b>Condiciones</b><br>${esc(doc.method)} · ${esc(doc.currency ?? "PEN")}<br>Orden: ${esc(relations?.order?.number)}<br>Cotización: ${esc(relations?.quote?.number)}<br>Almacén: ${esc(state.warehouses.find((w) => w.id === doc.warehouseId)?.name)}</p></div><table><thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>${doc.lines.map((l) => `<tr><td>${esc(l.productId)}</td><td>${esc(l.productSnapshot?.name ?? state.products.find((p) => p.id === l.productId)?.name)}</td><td>${esc(l.quantity)}</td><td>${fmt(l.price)}</td><td>${fmt(l.quantity * l.price)}</td></tr>`).join("")}</tbody></table><p>Subtotal: ${fmt(f.subtotal)} · Descuento global: ${fmt(f.discount)} · Flete: ${fmt(f.freight)}</p><p>Base imponible: ${fmt(f.base)} · IGV 18% incluido: ${fmt(f.tax)}</p><div class="total">Total: <b>${fmt(doc.total)}</b></div><p>Saldo pendiente: ${account ? fmt(account.balance) : "No generado"}</p><h3>Pagos registrados</h3>${account?.payments.length ? `<table><thead><tr><th>Fecha</th><th>Medio</th><th>Referencia</th><th>Importe</th></tr></thead><tbody>${account.payments.map((p) => `<tr><td>${esc(dateLabel(p.date))}</td><td>${esc(p.method)}</td><td>${esc(p.reference)}</td><td>${fmt(p.amount)}</td></tr>`).join("")}</tbody></table>` : "<p>No hay pagos registrados.</p>"}<p class="notes">Observaciones: ${esc(doc.notes)}</p><footer><b>Registro interno ${doc.demo ? "DEMO" : ""}. Sin validación electrónica SUNAT.</b><p>El total corresponde al documento guardado. Base e IGV son un desglose según la regla de 18% incluido del ERP.</p></footer></body></html>`;
  const frame = document.createElement("iframe");
  frame.title = "Imprimir documento";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  frame.onload = () => {
    const win = frame.contentWindow;
    if (win) {
      win.addEventListener("afterprint", () => frame.remove(), {
        once: true,
      });
      win.focus();
      win.print();
    }
    setTimeout(() => frame.remove(), 60000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
