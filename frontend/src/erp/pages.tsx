import { SupplierDetailsTrigger } from "./suppliers";
import { ProductDetailsTrigger } from "./products";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { SalesDocumentDetailsModal, InvoiceCreationModal } from "./sales-documents";
import { ReceivingPage, ReceiptModal } from "./receiving";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { useErp } from "./store";
import {
  changeQuote,
  cancelSalesOrder,
  canCancelPurchaseOrder,
  cancelPurchaseOrder,
  deleteQuote,
  createDocument,
  dateLabel,
  money,
  pay,
  nextPaymentReference,
  paymentMethods,
  saveQuote,
  stockOf,
  quantityRound,
  today,
  type Document,
  type Quote,
} from "./model";
import {
  DocDetail,
  ExportMenu,
  Metrics,
  Modal,
  OrderEditor,
  Records,
  Tag,
} from "./ui";
import { toast } from "./toast";
import { useDailyDateFilter } from "./daily-filter";
import { LogisticsPage } from "./logistics-page";
import { CommissionsPage } from "./commissions-page";
export const routes = [
  {
    group: "Inicio",
    name: "Resumen ejecutivo",
    path: "/dashboard",
    icon: "dashboard",
  },
  {
    group: "Abastecimiento",
    name: "Órdenes de compra",
    path: "/orden-compra",
    icon: "purchase",
  },
  {
    group: "Abastecimiento",
    name: "Ingreso al Kardex",
    path: "/ingreso-kardex",
    icon: "receive",
  },
  {
    group: "Comercial",
    name: "Cotizaciones",
    path: "/cotizacion",
    icon: "quote",
  },
  {
    group: "Comercial",
    name: "Pedidos de venta",
    path: "/orden-venta",
    icon: "sale",
  },
  {
    group: "Comercial",
    name: "Facturación y comprobantes",
    path: "/facturacion",
    icon: "invoice",
  },
  {
    group: "Comercial",
    name: "Cuentas por cobrar",
    path: "/estado-cuenta",
    icon: "wallet",
  },
  {
    group: "Inventario",
    name: "Movimientos de Kardex",
    path: "/movimiento-kardex",
    icon: "movement",
  },
  {
    group: "Logística",
    name: "Logística y transporte",
    path: "/logistica",
    icon: "route",
  },
  {
    group: "Comercial",
    name: "Comisiones de vendedores",
    path: "/comisiones",
    icon: "commission",
  },
  {
    group: "Inventario",
    name: "Stock de productos",
    path: "/stock-productos",
    icon: "stock",
  },
  {
    group: "Gestión",
    name: "Analítica y reportes",
    path: "/reportes",
    icon: "report",
  },
  {
    group: "Gestión",
    name: "Maestros",
    path: "/mantenimientos",
    icon: "settings",
  },
  {
    group: "Administración",
    name: "Administración",
    path: "/administracion/usuarios",
    icon: "shield",
  },
];
export const administrationRoutes = [
  { name: "Usuarios", path: "/administracion/usuarios", icon: "users" },
  { name: "Roles", path: "/administracion/roles", icon: "shield" },
  { name: "Permisos", path: "/administracion/permisos", icon: "shield" },
  { name: "Auditoría", path: "/administracion/auditoria", icon: "report" },
];
const descriptions: Record<string, string> = {
  "orden-compra":
    "Emite órdenes a proveedores y recibe mercadería por almacén.",
  "ingreso-kardex":
    "Confirma recepciones completas o parciales y genera entradas de inventario.",
  "orden-venta":
    "Registra pedidos de clientes con productos, almacén y forma de pago.",
  facturacion:
    "Emite comprobantes de venta y descuenta existencias automáticamente.",
  "estado-cuenta": "Consulta la deuda de tus clientes y registra cobranzas.",
  "movimiento-kardex":
    "Historial de entradas y salidas conectado con compras y ventas.",
  "stock-productos":
    "Existencias y valorización actual por producto y almacén.",
  logistica: "Planifica despachos, rutas, unidades, entregas y devoluciones.",
  comisiones: "Calcula y liquida incentivos comerciales con reglas vigentes.",
};
function Head({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="hd page-head">
      <div>
        <h1>{title}</h1>
        <p className="sub no-margin">{description}</p>
      </div>
      <div className="header-actions">{actions}</div>
    </div>
  );
}
export function Operations({ view }: { view: string }) {
  const { state, transact } = useErp();
  const [date, setDate] = useDailyDateFilter();
  const [status, setStatus] = useState("Todos");
  const [warehouse, setWarehouse] = useState("Todos");
  const [editor, setEditor] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [action, setAction] = useState<Document | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Document | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [error, setError] = useState("");
  if (view === "ingreso-kardex") return <ReceivingPage />;
  if (view === "logistica") return <LogisticsPage />;
  if (view === "comisiones") return <CommissionsPage />;
  const name = routes.find((r) => r.path === `/${view}`)?.name ?? view;
  const partyName = (id: string) =>
    [...state.customers, ...state.suppliers].find((p) => p.id === id)?.name ??
    id;
  const warehouseName = (id: string) =>
    state.warehouses.find((w) => w.id === id)?.name ?? id;
  const productName = (id: string) =>
    state.products.find((p) => p.id === id)?.name ?? id;
  const sourceNumber = (id?: string) =>
    id
      ? (state.documents.find((d) => d.id === id)?.number ??
        state.quotes.find((q) => q.id === id)?.number)
      : undefined;
  const oc = state.documents.filter((d) => d.kind === "OC"),
    ov = state.documents.filter((d) => d.kind === "OV"),
    cp = state.documents.filter((d) => d.kind === "CP");
  const pending = oc.filter((d) =>
    ["Pendiente", "Recibida parcial"].includes(d.status),
  );
  const awaiting = ov.filter((d) => d.status === "Pendiente");
  let metrics: [string, string | number][] = [];
  let headers: string[] = [];
  let exportRows: (string | number)[][] = [];
  let rows: { id: string; cells: ReactNode[]; search: string }[] = [];
  let filterOptions: string[] = [];
  if (view === "movimiento-kardex") {
    filterOptions = ["Entrada", "Salida"];
    const all = state.movements;
    const data = all.filter(
      (m) =>
        (!date || m.date === date) &&
        (status === "Todos" || m.type === status) &&
        (warehouse === "Todos" || m.warehouseId === warehouse),
    );
    metrics = [
      ["Movimientos del historial", all.length],
      [
        "Unidades ingresadas",
        all
          .filter((m) => m.type === "Entrada")
          .reduce((s, m) => s + m.quantity, 0),
      ],
      [
        "Unidades salidas",
        all
          .filter((m) => m.type === "Salida")
          .reduce((s, m) => s + m.quantity, 0),
      ],
      ["Productos movidos", new Set(all.map((m) => m.productId)).size],
    ];
    headers = [
      "Fecha",
      "Documento",
      "Operación",
      "Producto",
      "Almacén",
      "Tercero",
      "Cantidad",
      "Saldo",
      "Acciones",
    ];
    exportRows = data.map((m) => [
      dateLabel(m.date),
      state.documents.find((d) => d.id === m.documentId)?.number ?? "",
      m.type,
      productName(m.productId),
      warehouseName(m.warehouseId),
      partyName(m.partyId),
      m.quantity,
      m.balance,
    ]);
    rows = data.map((m, i) => ({
      id: m.id,
      search: `${m.productId} ${exportRows[i].join(" ")}`,
      cells: [
        dateLabel(m.date),
        exportRows[i][1],
        <Tag value={m.type === "Entrada" ? "Compra" : "Venta"} />,
        <>
          <ProductDetailsTrigger
            id={m.productId}
            warehouseId={m.warehouseId}
            context={m.type === "Entrada" ? "OC" : "OV"}
          />
          <small>{m.productId}</small>
        </>,
        warehouseName(m.warehouseId),
        <SupplierDetailsTrigger supplierId={m.partyId}>
          {partyName(m.partyId)}
        </SupplierDetailsTrigger>,
        <span className={m.type === "Entrada" ? "positive" : "negative"}>
          {m.type === "Entrada" ? "+" : "−"}
          {m.quantity}
        </span>,
        `${m.balance} ${state.products.find((p) => p.id === m.productId)?.unit ?? ""}`,
        <button
          className="secondary-btn"
          onClick={() => setDetail(m.documentId)}
        >
          <Icon name="eye" size={13} />
          Ver documento
        </button>,
      ],
    }));
  } else if (view === "stock-productos") {
    filterOptions = ["Disponible", "Stock bajo", "Sin stock"];
    const shownWarehouses = state.warehouses.filter(
      (w) => warehouse === "Todos" || w.id === warehouse,
    );
    const data = state.products
      .map((p) => {
        const quantities = shownWarehouses.map((w) =>
          stockOf(state, p.id, w.id),
        );
        const quantity =
          warehouse === "Todos"
            ? quantityRound(quantities.reduce((s, n) => s + n, 0))
            : stockOf(state, p.id, warehouse);
        return {
          p,
          quantities,
          quantity,
          status:
            quantity === 0
              ? "Sin stock"
              : quantity <= p.minimum
                ? "Stock bajo"
                : "Disponible",
        };
      })
      .filter((r) => status === "Todos" || r.status === status);
    metrics = [
      ["Productos", data.length],
      ["Unidades", quantityRound(data.reduce((s, r) => s + r.quantity, 0))],
      ["En mínimo o por debajo", data.filter((r) => r.quantity <= r.p.minimum).length],
      [
        "Valor al costo",
        money(data.reduce((s, r) => s + r.quantity * r.p.cost, 0)),
      ],
    ];
    headers = [
      "Código",
      "Producto",
      ...shownWarehouses.map((w) => w.name),
      "Total",
      "Mínimo",
      "Valor al costo",
      "Estado",
    ];
    exportRows = data.map((r) => [
      r.p.id,
      r.p.name,
      ...r.quantities,
      quantityRound(r.quantities.reduce((s, n) => s + n, 0)),
      r.p.minimum,
      quantityRound(r.quantities.reduce((s, n) => s + n, 0)) * r.p.cost,
      r.status,
    ]);
    rows = data.map((r) => ({
      id: r.p.id,
      search: `${r.p.id} ${r.p.name} ${r.p.category}`,
      cells: [
        r.p.id,
        <>
          <ProductDetailsTrigger
            id={r.p.id}
            warehouseId={
              warehouse === "Todos" ? (shownWarehouses[0]?.id ?? "") : warehouse
            }
          />
          <small>
            {r.p.category} · {r.p.unit}
          </small>
        </>,
        ...r.quantities,
        quantityRound(r.quantities.reduce((s, n) => s + n, 0)),
        r.p.minimum,
        money(quantityRound(r.quantities.reduce((s, n) => s + n, 0)) * r.p.cost),
        <Tag value={r.status} />,
      ],
    }));
  } else {
    const kind =
      view === "orden-compra"
        ? "OC"
        : view === "ingreso-kardex"
          ? "NI"
          : view === "orden-venta"
            ? "OV"
            : "CP";
    // Every issued invoice is collectible until its payments are registered,
    // including cash and bank-transfer sales.
    let data = state.documents.filter((d) => d.kind === kind);
    filterOptions = [...new Set(data.map((d) => d.status))];
    data = data.filter(
      (d) =>
        (!date || d.date === date) &&
        (status === "Todos" || d.status === status) &&
        (warehouse === "Todos" || d.warehouseId === warehouse),
    );
    metrics =
      view === "orden-compra"
        ? [
            ["Órdenes", oc.length],
            ["Por recibir", pending.length],
            ["Recibidas", oc.filter((d) => d.status === "Recibida").length],
            ["Total ordenado", money(oc.reduce((s, d) => s + d.total, 0))],
          ]
        : view === "ingreso-kardex"
          ? [
              [
                "Notas de ingreso",
                state.documents.filter((d) => d.kind === "NI").length,
              ],
              ["Órdenes por recibir", pending.length],
              [
                "Unidades ingresadas",
                state.movements
                  .filter((m) => m.type === "Entrada")
                  .reduce((s, m) => s + m.quantity, 0),
              ],
              ["Almacenes", state.warehouses.length],
            ]
          : view === "orden-venta"
            ? [
                ["Órdenes", ov.length],
                ["Por facturar", awaiting.length],
                [
                  "Facturadas",
                  ov.filter((d) => d.status === "Facturada").length,
                ],
                ["Total pedidos", money(ov.reduce((s, d) => s + d.total, 0))],
              ]
            : view === "facturacion"
              ? [
                  ["Comprobantes", cp.length],
                  ["Órdenes por facturar", awaiting.length],
                  [
                    "Total facturado",
                    money(cp.reduce((s, d) => s + d.total, 0)),
                  ],
                  [
                    "Saldo por cobrar",
                    money(cp.reduce((s, d) => s + d.balance, 0)),
                  ],
                ]
              : [
                  ["Por cobrar", money(cp.reduce((s, d) => s + d.balance, 0))],
                  ["Con saldo", cp.filter((d) => d.balance > 0).length],
                  [
                    "Clientes con deuda",
                    new Set(
                      cp.filter((d) => d.balance > 0).map((d) => d.partyId),
                    ).size,
                  ],
                  [
                    "Cobrado",
                    money(
                      cp.reduce(
                        (s, d) =>
                          s + d.payments.reduce((n, p) => n + p.amount, 0),
                        0,
                      ),
                    ),
                  ],
                ];
    headers = [
      "Documento",
      "Fecha",
      kind === "OC" || kind === "NI" ? "Proveedor" : "Cliente",
      "Almacén",
      "Forma de pago",
      "Importe",
      ...(view === "estado-cuenta" ? ["Pagado", "Saldo"] : []),
      "Estado",
      "Acciones",
    ];
    exportRows = data.map((d) => [
      d.number,
      dateLabel(d.date),
      partyName(d.partyId),
      warehouseName(d.warehouseId),
      d.method,
      d.total,
      ...(view === "estado-cuenta" ? [d.total - d.balance, d.balance] : []),
      d.status,
    ]);
    rows = data.map((d) => ({
      id: d.id,
      search: `${d.number} ${partyName(d.partyId)} ${[...state.customers, ...state.suppliers].find((p) => p.id === d.partyId)?.taxId} ${sourceNumber(d.sourceId) ?? ""}`,
      cells: [
        <>
          <b>{d.number}</b>
          {sourceNumber(d.sourceId) && (
            <small>Ref. {sourceNumber(d.sourceId)}</small>
          )}
        </>,
        dateLabel(d.date),
        <SupplierDetailsTrigger supplierId={d.partyId}>
          {partyName(d.partyId)}
        </SupplierDetailsTrigger>,
        warehouseName(d.warehouseId),
        d.method,
        money(d.total),
        ...(view === "estado-cuenta"
          ? [
              money(d.total - d.balance),
              <b className="negative">{money(d.balance)}</b>,
            ]
          : []),
        <Tag value={d.status} />,
        <div className="row-actions">
          <button className="secondary-btn" onClick={() => setDetail(d.id)}>
            Ver
          </button>
          {d.kind === "OC" &&
            ["Pendiente", "Recibida parcial"].includes(d.status) && (
              <button className="btn" onClick={() => setAction(d)}>
                Recibir
              </button>
            )}
          {d.kind === "OV" && d.status === "Pendiente" && (
            <button className="btn" onClick={() => setAction(d)}>
              Facturar
            </button>
          )}
          {view === "orden-compra" && canCancelPurchaseOrder(state, d) && (
            <button type="button" className="secondary-btn" onClick={() => {setCancelOrder(d); setCancelError("");}}>Cancelar orden</button>
          )}
          {view === "orden-venta" && d.kind === "OV" && d.status === "Pendiente" && !state.documents.some((document) => document.kind === "CP" && document.sourceId === d.id) && (
            <button type="button" className="secondary-btn" onClick={() => {setCancelOrder(d); setCancelError("");}}>Cancelar pedido</button>
          )}
          {view === "estado-cuenta" && d.balance > 0 && (
            <button className="btn" onClick={() => setAction(d)}>
              Cobrar
            </button>
          )}
        </div>,
      ],
    }));
  }
  const actualFilters = (
    <div className="table-filter-controls">
      {view !== "stock-productos" && (
        <label className="filter-field">
          Fecha
          <input
            aria-label="Filtrar por fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      )}
      <select
        aria-label="Filtrar estado"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option>Todos</option>
        {filterOptions.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select
        aria-label="Filtrar almacén"
        value={warehouse}
        onChange={(e) => setWarehouse(e.target.value)}
      >
        <option value="Todos">Todos los almacenes</option>
        {state.warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button
        className="secondary-btn"
        onClick={() => {
          setDate("");
          setStatus("Todos");
          setWarehouse("Todos");
        }}
      >
        Limpiar
      </button>
    </div>
  );

  const exportProfile =
    view === "movimiento-kardex"
      ? "kardex"
      : view === "estado-cuenta"
        ? "account"
        : view === "stock-productos"
          ? "catalog"
          : "document";
  const exportSummary = metrics.map(([label, value]) => ({ label, value }));

  return (
    <>
      <Head
        title={name}
        description={descriptions[view]}
        actions={
          <>
            <ExportMenu
              data={{
                name: view,
                title: name,
                profile: exportProfile,
                company: { name: state.settings.company },
                subtitle: descriptions[view],
                summary: exportSummary,
                headers: headers.filter((h) => h !== "Acciones"),
                rows: exportRows,
              }}
            />
            {["orden-compra", "orden-venta"].includes(view) && (
              <button
                className="btn"
                aria-label="+ Nueva orden"
                onClick={() => setEditor(true)}
              >
                <Icon name="plus" size={15} />
                Nueva orden
              </button>
            )}
          </>
        }
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Metrics items={metrics} />
      {view === "ingreso-kardex" && pending.length > 0 && (
        <section className="card pending-card">
          <h2>Compras pendientes de recepción</h2>
          {pending.map((d) => (
            <div key={d.id}>
              <span>
                <b>{d.number}</b> · {partyName(d.partyId)} ·{" "}
                <Tag value={d.status} />
              </span>
              <button className="btn" onClick={() => setAction(d)}>
                Registrar ingreso
              </button>
            </div>
          ))}
        </section>
      )}
      {view === "facturacion" && awaiting.length > 0 && (
        <section className="card pending-card">
          <h2>Ventas pendientes de facturación</h2>
          {awaiting.map((d) => (
            <div key={d.id}>
              <span>
                <b>{d.number}</b> · {partyName(d.partyId)} · {money(d.total)}
              </span>
              <button className="btn" onClick={() => setAction(d)}>
                Emitir comprobante
              </button>
            </div>
          ))}
        </section>
      )}
      <Records
        headers={headers}
        rows={rows}
        filters={actualFilters}
        searchText="Buscar documento, producto, cliente o proveedor…"
      />
      {cancelOrder && <Modal title={cancelOrder.kind === "OC" ? "Cancelar orden de compra" : "Cancelar pedido de venta"} onClose={() => setCancelOrder(null)}>
        <p>¿Cancelar {cancelOrder.kind === "OC" ? "la orden de compra" : "el pedido"} <strong>{cancelOrder.number}</strong> de {partyName(cancelOrder.partyId)}?</p>
        <p className="muted">{cancelOrder.kind === "OC" ? "La orden se conservará en el historial como cancelada y ya no podrá recibirse en el Kardex. El stock no cambia." : "El pedido se conservará en el historial como cancelado y ya no podrá facturarse. El stock y los saldos no cambian."}</p>
        {cancelError && <p className="error" role="alert">{cancelError}</p>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setCancelOrder(null)}>Volver</button><button type="button" className="btn" onClick={() => {
          try {transact((state) => {if (cancelOrder.kind === "OC") cancelPurchaseOrder(state, cancelOrder.id); else cancelSalesOrder(state, cancelOrder.id);}); setCancelOrder(null); toast.success(cancelOrder.kind === "OC" ? "Orden de compra cancelada correctamente." : "Pedido cancelado correctamente.");}
          catch (error) {setCancelError(error instanceof Error ? error.message : "No se pudo cancelar la orden.");}
        }}>Confirmar cancelación</button></div>
      </Modal>}
      {editor && (
        <OrderEditor
          kind={view === "orden-compra" ? "OC" : "OV"}
          onClose={() => setEditor(false)}
          onSave={(draft) => {
            transact((s) => {
              createDocument(s, draft);
            });
            setEditor(false);
            toast.success(
              draft.kind === "OC"
                ? "Orden de compra creada correctamente."
                : "Orden de venta creada correctamente.",
            );
          }}
        />
      )}
      {action && action.kind === "OC" ? (
        <ReceiptModal
          doc={state.documents.find((d) => d.id === action.id)!}
          onClose={() => setAction(null)}
          onComplete={() => {
            setAction(null);
            toast.success("Ingreso registrado. Stock y Kardex actualizados.");
          }}
        />
      ) : action?.kind === "OV" ? (
        <InvoiceCreationModal
          doc={state.documents.find((d) => d.id === action.id)!}
          onClose={() => setAction(null)}
          onComplete={(id) => {
            setAction(null);
            setDetail(id);
            toast.success(
              "Comprobante registrado. Inventario y Kardex actualizados.",
            );
          }}
        />
      ) : (
        action && (
          <ActionModal
            doc={state.documents.find((d) => d.id === action.id)!}
            onClose={() => setAction(null)}
            onComplete={() => {
              setAction(null);
              toast.success(
                action?.kind === "OV"
                  ? "Venta facturada. Inventario y documentos actualizados."
                  : "Cobro registrado. La deuda del cliente fue actualizada.",
              );
            }}
          />
        )
      )}
      {detail && state.documents.find((d) => d.id === detail) && (
        <DocDetail
          doc={state.documents.find((d) => d.id === detail)!}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
function ActionModal({
  doc,
  onClose,
  onComplete,
}: {
  doc: Document;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { state, transact } = useErp();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(doc.balance);
  const [method, setMethod] = useState(paymentMethods[0]);
  const reference = nextPaymentReference(state);
  const [error, setError] = useState("");
  return (
    <Modal title={`Registrar cobro · ${doc.number}`} onClose={onClose} wide className="collection-modal">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            transact((s) =>
              pay(s, doc.id, { date, amount, method }),
            );
            onComplete();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Error al registrar.",
            );
          }
        }}
      >
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="collection-summary">
          <div><span>Comprobante</span><strong>{doc.number}</strong><small>{state.customers.find((c) => c.id === doc.partyId)?.name}</small></div>
          <div><span>Saldo pendiente</span><strong>{money(doc.balance)}</strong></div>
        </div>
        <div className="form-grid">
          <label>
            Fecha
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Importe a cobrar
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={doc.balance}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <label>
            Medio de pago
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Referencia de operación
            <input
              readOnly
              value={reference}
              aria-describedby="collection-reference-help"
            />
            <small id="collection-reference-help">Referencia interna generada al confirmar el cobro.</small>
          </label>
        </div>
        <p className="muted">
          El cobro actualizará la deuda del
          cliente.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn">Confirmar registrar cobro</button>
        </div>
      </form>
    </Modal>
  );
}
export function Quotes() {
  const { state, transact } = useErp();
  const [date, setDate] = useDailyDateFilter();
  const [status, setStatus] = useState("Todas");
  const [editor, setEditor] = useState<Quote | true | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    quote: Quote;
    action: "send" | "delete" | "reject" | "accept";
  } | null>(null);
  const data = state.quotes.filter(
    (q) => (!date || q.date === date) && (status === "Todas" || q.status === status),
  );
  const party = (id: string) =>
    state.customers.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <Head
        title="Cotizaciones"
        description="Prepara propuestas, registra la aceptación y convierte cada cotización en una venta."
        actions={
          <button
            className="btn"
            aria-label="+ Nueva cotización"
            onClick={() => setEditor(true)}
          >
            <Icon name="plus" size={15} />
            Nueva cotización
          </button>
        }
      />
      <div className="process-flow">
        {[
          "Cotizaciones",
          "Aceptación del cliente",
          "Pedidos de venta",
          "Facturación y comprobantes",
          "Cuentas por cobrar",
        ].map((step, i) => (
          <span key={step}>
            <b>{i + 1}</b>
            {step}
          </span>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Metrics
        items={(["Borrador", "Enviada", "Aceptada", "Procesada"] as const).map(
          (s) => [s, state.quotes.filter((q) => q.status === s).length],
        )}
      />
      <Records
        headers={[
          "Número",
          "Fecha",
          "Cliente",
          "Vigencia",
          "Total",
          "Estado",
          "Vínculo",
          "Acciones",
        ]}
        filters={
          <div className="table-filter-controls">
          <label className="filter-field">Fecha<input aria-label="Filtrar por fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <select
            aria-label="Estado de cotización"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["Todas", "Borrador", "Enviada", "Aceptada", "Procesada"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
          <button className="secondary-btn" onClick={() => { setDate(""); setStatus("Todas"); }}>Limpiar</button>
          </div>
        }
        rows={data.map((q) => ({
          id: q.id,
          search: `${q.number} ${party(q.partyId)}`,
          cells: [
            q.number,
            dateLabel(q.date),
            party(q.partyId),
            `${q.validity} días`,
            money(q.total),
            <Tag value={q.status} />,
            q.orderId ? (
              <button
                className="secondary-btn"
                onClick={() => setDetail(q.orderId!)}
              >
                {state.documents.find((d) => d.id === q.orderId)?.number}
              </button>
            ) : (
              "—"
            ),
            <div className="row-actions quote-row-actions">
              <button className="quote-action-icon" aria-label={`Ver detalles ${q.number}`} title="Ver detalles" onClick={() => setDetail(q.id)}><Eye size={16} /></button>
              {q.status === "Borrador" && !q.orderId && <>
                <button className="quote-action-icon" aria-label={`Editar ${q.number}`} title="Editar" onClick={() => setEditor(q)}><Pencil size={16} /></button>
                <button className="btn" onClick={() => setConfirm({quote: q, action: "send"})}>Enviar</button>
                <button className="quote-action-icon quote-delete-icon" aria-label={`Eliminar ${q.number}`} title="Eliminar borrador" onClick={() => setConfirm({quote: q, action: "delete"})}><Trash2 size={16} /></button>
              </>}
              {q.status === "Enviada" && !q.orderId && <>
                <button className="btn" onClick={() => setConfirm({quote: q, action: "accept"})}>Aceptar</button>
                <button className="secondary-btn" onClick={() => setConfirm({quote: q, action: "reject"})}>No aceptó</button>
              </>}
              {q.orderId && (
                <a className="secondary-btn" href="/facturacion">
                  Ir a facturación
                </a>
              )}
            </div>,
          ],
        }))}
        exportData={{
          name: "cotizaciones",
          title: "Cotizaciones",
          profile: "quote",
          company: { name: state.settings.company },
          subtitle: "Propuestas comerciales y vigencia de cada oferta.",
          summary: [
            { label: "Total de cotizaciones", value: data.length },
            {
              label: "Aceptadas",
              value: data.filter((q) => q.status === "Aceptada").length,
            },
            {
              label: "Importe ofertado",
              value: data.reduce((sum, q) => sum + q.total, 0),
            },
          ],
          headers: [
            "Número",
            "Fecha",
            "Cliente",
            "Vigencia",
            "Total",
            "Estado",
          ],
          rows: data.map((q) => [
            q.number,
            q.date,
            party(q.partyId),
            q.validity,
            q.total,
            q.status,
          ]),
        }}
      />
      {editor && (
        <OrderEditor
          kind="COT"
          quote={editor === true ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={(draft, validity, saveStatus) => {
            const editingQuote = editor !== true;
            transact((s) => {
              saveQuote(
                s,
                { ...draft, validity },
                editor === true ? undefined : editor.id,
                saveStatus,
              );
            });
            setEditor(null);
            toast.success(
              editingQuote
                ? "Cotización actualizada correctamente."
                : "Cotización guardada correctamente.",
            );
          }}
        />
      )}
      {confirm && (
        <Modal
          title={
            confirm.action === "send"
              ? "¿Enviar cotización al cliente?"
              : confirm.action === "accept"
              ? "Confirmar aceptación"
              : confirm.action === "reject"
                ? "Registrar rechazo"
                : "Eliminar cotización"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.quote.number} · {party(confirm.quote.partyId)} ·{" "}
            {money(confirm.quote.total)}
          </p>
          {confirm.action === "send" ? <div>
            <p>Se marcará como enviada a <strong>{state.customers.find((customer) => customer.id === confirm.quote.partyId)?.email?.trim() || confirm.quote.customerSnapshot?.email?.trim() || "cliente sin correo registrado"}</strong>.</p>
            <p className="muted">Este paso registra el envío; no envía correos automáticamente.</p>
          </div> : <p>
            {confirm.action === "accept"
              ? "Se creará una orden de venta vinculada. El stock se descontará al facturar."
              : confirm.action === "reject"
                ? "La cotización quedará en borrador para corregirla o eliminarla."
                : "Se eliminará este borrador. No se modificarán el stock ni otros documentos."}
          </p>}
          <div className="modal-actions">
            <button className="secondary-btn" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  const {quote, action} = confirm;
                  transact((s) => {
                    if (action === "delete") deleteQuote(s, quote.id);
                    else changeQuote(s, quote.id, action);
                  });
                  if (confirm.action === "delete") {
                    toast.success("Borrador eliminado correctamente.");
                  } else if (confirm.action === "send") {
                    toast.success("Cotización marcada como enviada.");
                  } else if (confirm.action === "accept") {
                    toast.success(
                      "Cotización aceptada y orden de venta creada.",
                    );
                  } else {
                    toast.warning("Cotización devuelta a borrador.");
                  }
                  setError("");
                  setConfirm(null);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No se pudo actualizar.",
                  );
                  setConfirm(null);
                }
              }}
            >
              {confirm.action === "send" ? "Enviar cotización" : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
      {detail && state.quotes.find((quote) => quote.id === detail) && <SalesDocumentDetailsModal doc={state.quotes.find((quote) => quote.id === detail)!} onClose={() => setDetail(null)} />}
      {detail && state.documents.find((d) => d.id === detail) && (
        <DocDetail
          doc={state.documents.find((d) => d.id === detail)!}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
