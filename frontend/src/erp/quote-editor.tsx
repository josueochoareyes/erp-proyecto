import { useRef, useState } from "react";
import { Package, Plus, Trash2, LoaderCircle } from "lucide-react";
import { Modal } from "./modal";
import { CustomerSelector } from "./customers";
import { ProductSelectorModal, ProductDetailsTrigger } from "./products";
import { appendProducts } from "./product-query";
import { useErp } from "./store";
import { toast } from "./toast";
import {
  methods,
  vouchers,
  today,
  money,
  total,
  type Draft,
  type Quote,
} from "./model";
import "./quotes.css";

export function QuoteEditor({
  kind = "COT",
  quote,
  onClose,
  onSave,
}: {
  kind?: "COT" | "OV";
  quote?: Quote;
  onClose: () => void;
  onSave: (draft: Draft, validity: number, status?: "Borrador") => void;
}) {
  const { state } = useErp();
  const isQuote = kind === "COT";
  const totalLabel = isQuote ? "Total de la cotización" : "Total de la orden";
  const [draft, setDraft] = useState<Draft>(() =>
    quote
      ? { ...quote, kind: "OV" }
      : {
          kind: "OV",
          date: today(),
          partyId: "",
          warehouseId: state.warehouses.find((w) => w.active)?.id ?? "",
          method: "Contado",
          voucher: "Factura electrónica",
          lines: [],
          discount: 0,
          freight: 0,
          notes: "",
          deliveryAddress: "",
        },
  );
  const [validity, setValidity] = useState(quote?.validity ?? 15);
  const [selecting, setSelecting] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const update = (key: keyof Draft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const subtotal = draft.lines.reduce(
    (sum, l) => sum + l.quantity * l.price,
    0,
  );
  const amount = total(draft.lines, draft.discount, draft.freight);
  return (
    <Modal
      title={
        quote
          ? `Editar ${quote.number}`
          : isQuote
            ? "Nueva cotización"
            : "Nueva orden de venta"
      }
      subtitle={
        isQuote
          ? "Prepara una propuesta comercial para tu cliente"
          : "Registra y administra los pedidos de tus clientes"
      }
      onClose={() => {
        if (!busy.current) onClose();
      }}
      wide
      className={`quote-editor ${isQuote ? "" : "sales-order-editor"}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) return;
          if (!draft.partyId) {
            setError("Selecciona un cliente para continuar.");
            return;
          }
          const status = "Borrador" as const;
          busy.current = true;
          setSaving(true);
          setError("");
          try {
            await onSave(draft, validity, isQuote ? status : undefined);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "No se pudo guardar.",
            );
            busy.current = false;
            setSaving(false);
          }
        }}
      >
        <div className="quote-body">
          {error && (
            <p className="quote-error" role="alert">
              {error}
            </p>
          )}
          <section className="quote-section">
            <div className="quote-section-title">
              <span>01</span>
              <div>
                <h3>Información general</h3>
                <p>
                  {isQuote
                    ? "Define el cliente y las condiciones de la propuesta."
                    : "Define el cliente y las condiciones del pedido."}
                </p>
              </div>
            </div>
            <CustomerSelector
              allowCreate={isQuote}
              value={draft.partyId}
              onChange={(id) => {
                update("partyId", id);
                const customer = state.customers.find((item) => item.id === id);
                update("deliveryAddress", customer?.address ?? "");
                setError("");
              }}
            />
            <div className="quote-fields">
              <label>
                Fecha de emisión
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => update("date", e.target.value)}
                />
              </label>
              <label>
                Almacén / sucursal
                <select
                  required
                  value={draft.warehouseId}
                  onChange={(e) => update("warehouseId", e.target.value)}
                >
                  {state.warehouses
                    .filter((w) => w.active)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} · {w.branch}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Forma de pago
                <select
                  value={draft.method}
                  onChange={(e) => update("method", e.target.value)}
                >
                  {(state.paymentMethods?.filter((method) => method.active).map((method) => method.name) ?? methods).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              {isQuote && (
                <label>
                  Vigencia (días)
                  <input
                    type="number"
                    required
                    min="1"
                    max="365"
                    step="1"
                    value={validity}
                    onChange={(e) => setValidity(Number(e.target.value))}
                  />
                </label>
              )}
              <label>
                Comprobante
                <select
                  value={draft.voucher}
                  onChange={(e) => update("voucher", e.target.value)}
                >
                  {vouchers.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            {!isQuote && (
              <label className="quote-delivery-address">
                Dirección de entrega
                <textarea
                  rows={2}
                  required
                  value={draft.deliveryAddress ?? ""}
                  onChange={(event) => update("deliveryAddress", event.target.value)}
                  placeholder="Selecciona al cliente para cargar su dirección y ajusta el destino de este pedido."
                />
                <small>Esta dirección quedará vinculada al pedido y al despacho.</small>
              </label>
            )}
          </section>
          <section className="quote-section">
            <div className="quote-section-heading">
              <div className="quote-section-title">
                <span>02</span>
                <div>
                  <h3>
                    Productos <small>{draft.lines.length}</small>
                  </h3>
                  <p>Precios unitarios con IGV incluido.</p>
                </div>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelecting(true)}
              >
                <Plus size={16} />
                Seleccionar productos
              </button>
            </div>
            {draft.lines.length ? (
              <div className="quote-table">
                <table>
                  <thead>
                    <tr>
                      <th>Producto / código</th>
                      <th>Cantidad</th>
                      <th>Precio unitario</th>
                      <th>Importe</th>
                      <th>
                        <span className="sr-only">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l) => (
                      <tr key={l.productId}>
                        <td>
                          <ProductDetailsTrigger
                            id={l.productId}
                            warehouseId={draft.warehouseId}
                            context={kind}
                          />
                          <small className="quote-product-code">
                            {l.productId}
                          </small>
                        </td>
                        <td>
                          <input
                            aria-label={`Cantidad ${l.productId}`}
                            type="number"
                            min="0.001"
                            step="0.001"
                            required
                            value={l.quantity}
                            onChange={(e) =>
                              update(
                                "lines",
                                draft.lines.map((x) =>
                                  x.productId === l.productId
                                    ? {
                                        ...x,
                                        quantity: Math.max(
                                          0,
                                          Number(e.target.value),
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Precio ${l.productId}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={l.price}
                            onChange={(e) =>
                              update(
                                "lines",
                                draft.lines.map((x) =>
                                  x.productId === l.productId
                                    ? {
                                        ...x,
                                        price: Math.max(
                                          0,
                                          Number(e.target.value),
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="quote-line-total">
                          {money(l.quantity * l.price)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="quote-remove"
                            aria-label={`Eliminar ${state.products.find((p) => p.id === l.productId)?.name ?? l.productId}`}
                            onClick={() => {
                              update(
                                "lines",
                                draft.lines.filter(
                                  (x) => x.productId !== l.productId,
                                ),
                              );
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="quote-empty">
                <span>
                  <Package size={26} strokeWidth={1.5} />
                </span>
                <h4>
                  {isQuote
                    ? "Tu propuesta empieza aquí"
                    : "Agrega los productos del pedido"}
                </h4>
                <p>
                  {isQuote
                    ? "Selecciona productos del catálogo para definir tu cotización."
                    : "Selecciona productos del catálogo disponibles en el almacén elegido."}
                </p>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setSelecting(true)}
                >
                  <Plus size={15} />
                  Agregar productos
                </button>
              </div>
            )}
          </section>
          <section className="quote-bottom">
            <div className="quote-observations">
              <div className="quote-section-title">
                <span>03</span>
                <div>
                  <h3>Observaciones y condiciones</h3>
                  <p>Incluye información relevante para tu cliente.</p>
                </div>
              </div>
              <label>
                Observaciones
                <textarea
                  aria-label="Observaciones"
                  rows={5}
                  placeholder={
                    isQuote
                      ? "Escribe las condiciones o notas de tu propuesta…"
                      : "Escribe las condiciones o notas del pedido…"
                  }
                  value={draft.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
              <small>{draft.notes.length} caracteres</small>
            </div>
            <aside className="quote-summary" aria-label="Resumen económico">
              <h3>
                {isQuote ? "Resumen de la cotización" : "Resumen de la orden"}
              </h3>
              <div>
                <span>Subtotal (IGV incluido)</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <label>
                Descuento global{" "}
                <span>
                  S/
                  <input
                    aria-label="Descuento global"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.discount}
                    onChange={(e) =>
                      update("discount", Math.max(0, Number(e.target.value)))
                    }
                  />
                </span>
              </label>
              <label>
                Flete{" "}
                <span>
                  S/
                  <input
                    aria-label="Flete"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.freight}
                    onChange={(e) =>
                      update("freight", Math.max(0, Number(e.target.value)))
                    }
                  />
                </span>
              </label>
              <p>IGV incluido en los precios de los productos.</p>
              <div className="quote-grand-total">
                <span>{totalLabel}</span>
                <strong aria-live="polite">{money(amount)}</strong>
              </div>
            </aside>
          </section>
        </div>
        <footer className="quote-footer">
          <div>
            <small>{totalLabel}</small>
            <strong>{money(amount)}</strong>
          </div>
          <div>
            <button
              type="button"
              className="secondary-btn"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </button>
            {isQuote && <button type="submit" name="saveAction" value="draft" className="secondary-btn" disabled={saving || !draft.lines.length}>Guardar como borrador</button>}
            <button type="submit" name="saveAction" value="quote" className="btn" disabled={saving || !draft.lines.length}>
              {saving && <LoaderCircle size={16} className="quote-spinner" />}
              {saving
                ? "Guardando…"
                : isQuote
                  ? "Guardar cotización"
                  : "Guardar orden"}
            </button>
          </div>
        </footer>
      </form>
      {selecting && (
        <ProductSelectorModal
          context={kind}
          warehouseId={draft.warehouseId}
          lines={draft.lines}
          onClose={() => setSelecting(false)}
          onSelect={(ids) => {
            update(
              "lines",
              appendProducts(state, draft.lines, ids, draft.warehouseId, kind),
            );
            toast.info(
              `${ids.length} producto(s) agregados ${isQuote ? "a la cotización" : "a la orden"}.`,
            );
          }}
        />
      )}
    </Modal>
  );
}
