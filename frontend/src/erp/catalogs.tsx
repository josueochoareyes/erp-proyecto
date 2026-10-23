import { SupplierAdministration, CatalogDeleteDialog } from "./supplier-admin";
import { CustomerEditor } from "./customers";
import { deleteCategory, type CatalogKind } from "./catalog-logic";
import { Eye, Pencil, Trash2, FolderOpen, Search, Plus, Upload, UsersRound, Package, Warehouse as WarehouseIcon, Building2, Tags, Ruler, ArrowRightLeft, MapPin, ImagePlus } from "lucide-react";
import { ProductDetails } from "./products";
import { CsvImportModal } from "./csv-import-modal";
import { MasterCsvImportModal } from "./master-csv-import-modal";
import type { ImportKind } from "./csv-import";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { useErp } from "./store";
import {
  money,
  today,
  type Party,
  type Product,
  type Company,
  type Warehouse,
  type Branch,
  type Brand,
  type UnitOfMeasure,
  type UnitConversion,
} from "./model";
import { Modal, Records, Tag } from "./ui";
import { toast } from "./toast";
import { Currencies, PaymentMethods, PriceLists, Sellers, Taxes, Transporters, Zones } from "./master-extended";
export type Catalog =
  | "Clientes"
  | "Productos"
  | "Proveedores"
  | "Almacenes"
  | "Categorías"
  | "Empresas"
  | "Sucursales"
  | "Marcas"
  | "Unidades"
  | "Conversiones"
  | "Transportistas"
  | "Vendedores"
  | "Zonas"
  | "Monedas"
  | "Impuestos"
  | "Formas de pago"
  | "Listas de precios";
export function Catalogs({ initialTab }: { initialTab?: Catalog } = {}) {
  const { state, transact } = useErp();
  const [tab, setTab] = useState<Catalog>(initialTab ?? "Empresas");
  const [importKind, setImportKind] = useState<ImportKind | null>(null);
  const [masterImportOpen, setMasterImportOpen] = useState(false);
  const [editor, setEditor] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: CatalogKind;
    id: string;
  } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState("Todos");
  const groups = [
    { id: "structure", label: "Empresas y estructura", description: "Las organizaciones y sedes que sostienen la operación.", tabs: ["Empresas", "Sucursales", "Almacenes"] as Catalog[] },
    { id: "products", label: "Productos", description: "Catálogo, clasificación y unidades.", tabs: ["Productos", "Categorías", "Marcas", "Unidades", "Conversiones"] as Catalog[] },
    { id: "parties", label: "Terceros", description: "Clientes, proveedores y transporte compartidos.", tabs: ["Clientes", "Proveedores", "Transportistas"] as Catalog[] },
    { id: "commercial", label: "Comercial", description: "Responsables y segmentación de ventas.", tabs: ["Vendedores", "Zonas"] as Catalog[] },
    { id: "configuration", label: "Configuración", description: "Monedas, tributos, pagos y precios.", tabs: ["Monedas", "Impuestos", "Formas de pago", "Listas de precios"] as Catalog[] },
  ];
  const currentGroup = groups.find((group) => group.tabs.includes(tab)) ?? groups[0];
  const catalogs = currentGroup.tabs;
  const source =
    tab === "Clientes"
      ? state.customers
      : tab === "Proveedores"
        ? state.suppliers
        : tab === "Productos"
          ? state.products
          : tab === "Almacenes"
            ? state.warehouses
            : [];
  const data = source.filter(
    (r) =>
      (active === "Todos" || r.active === (active === "Activos")) &&
      (tab !== "Productos" ||
        !categoryFilter ||
        (r as Product).category === categoryFilter),
  );
  const catalogKind: CatalogKind =
    tab === "Clientes"
      ? "customers"
      : tab === "Productos"
        ? "products"
        : "warehouses";
  const rowActions = (record: Record<string, unknown>) => (
    <div className="catalog-action-buttons">
      <button
        type="button"
        aria-label={`Ver detalles ${record.name}`}
        title="Ver detalles"
        onClick={() => setViewing(record)}
      >
        <Eye />
      </button>
      <button
        type="button"
        aria-label={`Editar ${record.name}`}
        title="Editar"
      onClick={() => {
          setError("");
          if (tab === "Productos") {
            const productRecord = record as unknown as Product;
            setEditor({
              ...record,
              categoryId: productRecord.categoryId ?? state.masterCategories?.find((category) => category.name === productRecord.category)?.id ?? "",
              unitId: productRecord.unitId ?? state.units?.find((unit) => unit.code === productRecord.unit)?.id ?? "",
            });
          } else if (tab === "Almacenes") {
            const warehouseRecord = record as unknown as Warehouse;
            setEditor({
              ...record,
              code: warehouseRecord.code ?? warehouseRecord.id,
              branchId: warehouseRecord.branchId ?? state.branches?.find((branch) => branch.name === warehouseRecord.branch)?.id ?? "",
              type: warehouseRecord.type ?? "Principal",
            });
          } else {
            setEditor(record);
          }
        }}
      >
        <Pencil />
      </button>
      <button
        type="button"
        aria-label={`Eliminar ${record.name}`}
        title="Eliminar o desactivar"
        onClick={() =>
          setDeleting({ kind: catalogKind, id: String(record.id) })
        }
      >
        <Trash2 />
      </button>
    </div>
  );
  const product = tab === "Productos";
  const warehouse = tab === "Almacenes";
  const directory = ["Clientes", "Productos", "Almacenes"].includes(tab);
  const directoryModule = tab === "Productos" ? "1.4" : tab === "Almacenes" ? "1.3" : tab === "Clientes" ? "1.9" : "1.10";
  const emptyIcon = product ? <Package size={23} /> : warehouse ? <WarehouseIcon size={23} /> : <UsersRound size={23} />;
  const fields = product
      ? [
          "name",
          "categoryId",
          "unitId",
          "brandId",
          "sku",
          "barcode",
          "cost",
          "price",
          "minimum",
          "description",
        ]
      : warehouse
        ? ["code", "name", "branchId", "type"]
      : [
          "name",
          "taxId",
          "contact",
          "phone",
          "email",
          "address",
          "credit",
          ...(tab === "Proveedores"
            ? ["tradeName", "supplierCategory", "supplierType", "paymentTerms"]
            : []),
        ];
  const labels: Record<string, string> = {
    name: "Nombre / razón social",
    code: "Código interno",
    category: "Categoría",
    categoryId: "Categoría",
    unit: "Unidad",
    unitId: "Unidad de medida",
    cost: "Costo unitario",
    price: "Precio de venta (IGV incluido)",
    minimum: "Stock mínimo",
    description: "Descripción",
    sku: "SKU (opcional)",
    barcode: "Código de barras (opcional)",
    brandId: "Marca",
    branch: "Sucursal",
    branchId: "Sucursal",
    type: "Tipo de almacén",
    taxId: "RUC / DNI",
    contact: "Contacto",
    phone: "Teléfono",
    email: "Correo",
    address: "Dirección",
    credit: "Línea de crédito",
    tradeName: "Nombre comercial",
    supplierCategory: "Categoría del proveedor",
    supplierType: "Tipo de proveedor",
    paymentTerms: "Condiciones de pago",
    contactRole: "Cargo",
    alternatePhone: "Teléfono alternativo",
    district: "Distrito",
    province: "Provincia",
    department: "Departamento",
    currency: "Moneda habitual",
    commercialNotes: "Observaciones comerciales",
  };
  const empty = () =>
    product
      ? {
          name: "",
          category: state.categories[0] ?? "",
          categoryId: state.masterCategories?.find((category) => category.name === state.categories[0])?.id ?? "",
          unit: "UND",
          unitId: state.units?.find((unit) => unit.code === "UND")?.id ?? "",
          brandId: "",
          sku: "",
          barcode: "",
          description: "",
          cost: 0,
          price: 0,
          minimum: 30,
          active: true,
        }
      : warehouse
        ? { code: "", name: "", branch: "", branchId: "", type: "Principal", active: true }
        : {
            name: "",
            taxId: "",
            contact: "",
            phone: "",
            email: "",
            address: "",
            credit: 0,
            active: true,
          };
  const save = () => {
    if (!editor) return;
    try {
      if (!String(editor.name ?? "").trim())
        throw Error("El nombre es obligatorio.");
      if (
        !product &&
        !warehouse &&
        !/^\d{8}(\d{3})?$/.test(String(editor.taxId))
      )
        throw Error("Ingresa un DNI de 8 dígitos o RUC de 11 dígitos.");
      if (
        editor.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(editor.email))
      )
        throw Error("Ingresa un correo electrónico válido.");
      for (const key of ["cost", "price", "minimum", "credit"])
        if (
          key in editor &&
          (!Number.isFinite(Number(editor[key])) || Number(editor[key]) < 0)
        )
          throw Error("Los importes y mínimos no pueden ser negativos.");
      if (product && Number(editor.price) <= 0)
        throw Error("El precio debe ser mayor que cero.");
      if (product && (!String(editor.categoryId ?? editor.category ?? "") || !String(editor.unitId ?? editor.unit ?? "")))
        throw Error("Selecciona categoría y unidad de medida.");
      if (warehouse && !String(editor.code ?? "").trim())
        throw Error("El código del almacén es obligatorio.");
      if (warehouse && !String(editor.branchId ?? editor.branch ?? "").trim())
        throw Error("La sucursal es obligatoria.");
      transact((s) => {
        const list =
          tab === "Clientes"
            ? s.customers
            : tab === "Proveedores"
              ? s.suppliers
              : tab === "Productos"
                ? s.products
                : s.warehouses;
        const prefix = product
          ? "PRD"
          : warehouse
            ? "ALM"
            : tab === "Clientes"
              ? "CLI"
              : "PRO";
        const id = String(editor.id ?? `${prefix}-${Date.now().toString(36)}`);
        const normalizedWarehouseCode = String(editor.code ?? "").trim().toUpperCase();
        if (warehouse && list.some((r) => r.id !== id && String((r as Warehouse).code ?? r.id).toUpperCase() === normalizedWarehouseCode))
          throw Error("Ya existe un almacén con ese código.");
        if (
          !product &&
          !warehouse &&
          list.some(
            (r) => r.id !== id && "taxId" in r && r.taxId === editor.taxId,
          )
        )
          throw Error("Ya existe un tercero con ese documento.");
        const { supplierCategory, ...values } = editor;
        const selectedCategory = product
          ? s.masterCategories?.find((category) => category.id === editor.categoryId) ??
            s.masterCategories?.find((category) => category.name === editor.category)
          : undefined;
        const selectedUnit = product
          ? s.units?.find((unit) => unit.id === editor.unitId) ??
            s.units?.find((unit) => unit.code === editor.unit)
          : undefined;
        const selectedBranch = warehouse
          ? s.branches?.find((branch) => branch.id === editor.branchId) ??
            s.branches?.find((branch) => branch.name === editor.branch)
          : undefined;
        const record = {
          ...values,
          ...(product
            ? {
                category: selectedCategory?.name ?? String(editor.category ?? ""),
                categoryId: selectedCategory?.id,
                unit: selectedUnit?.code ?? String(editor.unit ?? ""),
                unitId: selectedUnit?.id,
              }
            : {}),
          ...(warehouse
            ? {
                code: String(editor.code ?? "").trim().toUpperCase() || id,
                branch: selectedBranch?.name ?? String(editor.branch ?? ""),
                branchId: selectedBranch?.id,
                type: editor.type === "Secundario" || editor.type === "Tránsito" ? editor.type : "Principal",
              }
            : {}),
          ...(tab === "Proveedores" && supplierCategory !== undefined
            ? { category: supplierCategory }
            : {}),
          id,
        } as Product & Party & Warehouse;
        const index = list.findIndex((r) => r.id === id);
        if (index >= 0) list[index] = record;
        else list.push(record);
        if (product && !s.stock[id])
          s.stock[id] = Object.fromEntries(s.warehouses.map((w) => [w.id, 0]));
        s.audit.unshift({
          id: `CAT-${Date.now()}`,
          date: new Date().toISOString(),
          action: index >= 0 ? "Editar catálogo" : "Crear catálogo",
          record: `${tab}: ${record.name}`,
        });
      });
      const editingRecord = Boolean(editor.id);
      setEditor(null);
      setError("");
      toast.success(
        `${tab} ${editingRecord ? "actualizado" : "creado"} correctamente.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };
  const headers = product
    ? [
        "Código",
        "Producto",
        "Categoría",
        "Unidad",
        "Costo",
        "Precio",
        "Mínimo",
        "Estado",
        "Acciones",
      ]
    : warehouse
      ? ["Código", "Almacén", "Sucursal", "Tipo", "Estado", "Acciones"]
      : [
          "Código",
          "Razón social",
          "RUC / DNI",
          "Contacto",
          "Crédito",
          "Estado",
          "Acciones",
        ];
  return (
    <>
      <div className="maintenance-module">
      <div className="hd page-head">
        <div>
          <span className="masters-eyebrow">MÓDULO 01 · DATOS COMPARTIDOS</span>
          <h1>Maestros</h1>
          <p className="sub no-margin">
            Fuente única de datos que alimenta compras, ventas, inventario y reportes.
          </p>
        </div>
        <div className="masters-page-actions">
          <button type="button" className="secondary-btn" onClick={() => setMasterImportOpen(true)}><Upload size={16} /> Importación masiva CSV</button>
        </div>
      </div>
      <div className="masters-groups" aria-label="Grupos del módulo Maestros">
        {groups.map((group, index) => (
          <button
            key={group.id}
            type="button"
            className={`masters-group-card ${currentGroup.id === group.id ? "is-selected" : ""}`}
            onClick={() => setTab(group.tabs[0])}
          >
            <span className="masters-group-icon">
              {index === 0 ? <Building2 size={19} /> : index === 1 ? <Package size={19} /> : <UsersRound size={19} />}
            </span>
            <span><strong>{group.label}</strong><small>{group.description}</small></span>
            <b>{group.tabs.length}</b>
          </button>
        ))}
      </div>
      <div className="masters-subnav" role="tablist" aria-label={`Submódulos de ${currentGroup.label}`}>
        {catalogs.map((c) => (
          <button
            key={c}
            id={`catalog-tab-${c.toLowerCase()}`}
            className="access-tab masters-subnav-tab"
            role="tab"
            aria-selected={tab === c}
            aria-controls="catalog-panel"
            onClick={() => {
              setTab(c);
              setActive("Todos");
              setCategoryFilter("");
              setError("");
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div id="catalog-panel" role="tabpanel" aria-labelledby={`catalog-tab-${tab.toLowerCase()}`}>
      {!editor && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "Proveedores" && <SupplierAdministration onImport={() => setImportKind("suppliers")} />}
      {directory && (
        <>
          <div className="hd maintenance-heading">
            <div className="maintenance-heading-copy">
              <span className="maintenance-eyebrow">MÓDULO 01 · {directoryModule} · {tab.toUpperCase()}</span>
              <h2>{tab}</h2>
              <p>{source.length} {source.length === 1 ? "registro" : "registros"} en este catálogo</p>
            </div>
            <div className="csv-catalog-actions">
            {!warehouse && <button type="button" className="secondary-btn" onClick={() => setImportKind(product ? "products" : "customers")}><Upload size={16} /> Importar CSV</button>}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setError("");
                setEditor(empty());
              }}
            >
              <Plus size={15} />
              Nuevo registro
            </button>
            </div>
          </div>
          <Records
            key={tab}
            sortable
            className="maintenance-records"
            searchText={`Buscar ${tab.toLowerCase()} por nombre o código…`}
            emptyTitle={source.length ? undefined : `Aún no hay ${tab.toLowerCase()}`}
            emptyIcon={emptyIcon}
            empty={source.length ? "Prueba con otros filtros o términos de búsqueda." : warehouse ? "Registra un almacén para organizar las operaciones de inventario." : `Crea tu primer ${product ? "producto" : "cliente"} o importa un archivo CSV para comenzar.`}
            emptyAction={!source.length && !warehouse ? <button type="button" className="secondary-btn" onClick={() => setImportKind(product ? "products" : "customers")}><Upload size={15} /> Importar CSV</button> : undefined}
            headers={headers}
            filters={
              <>
                <select
                  aria-label="Filtrar actividad"
                  value={active}
                  onChange={(e) => setActive(e.target.value)}
                >
                  {["Todos", "Activos", "Inactivos"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                {product && (
                  <select
                    aria-label="Categoría de productos"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="">Todas las categorías</option>
                    {state.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </>
            }
            rows={data.map((r) => ({
              id: r.id,
              search: Object.values(r).join(" "),
              sortValues: product
                ? [
                    r.id,
                    r.name,
                    (r as Product).category,
                    (r as Product).unit,
                    (r as Product).cost,
                    (r as Product).price,
                    (r as Product).minimum,
                    r.active ? "Activo" : "Inactivo",
                  ]
                : warehouse
                  ? [
                      (r as Warehouse).code ?? r.id,
                      r.name,
                      (r as Warehouse).branch,
                      (r as Warehouse).type ?? "Principal",
                      r.active ? "Activo" : "Inactivo",
                    ]
                  : [
                      r.id,
                      r.name,
                      (r as Party).taxId,
                      (r as Party).contact,
                      (r as Party).credit,
                      r.active ? "Activo" : "Inactivo",
                    ],
              cells: product
                ? [
                    r.id,
                    <>
                      {r.name}
                    </>,
                    (r as Product).category,
                    (r as Product).unit,
                    money((r as Product).cost),
                    money((r as Product).price),
                    (r as Product).minimum,
                    <Tag value={r.active ? "Activo" : "Inactivo"} />,
                    rowActions({ ...r }),
                  ]
                : warehouse
                  ? [
                      (r as Warehouse).code ?? r.id,
                      <>
                        {r.name}
                      </>,
                      (r as Warehouse).branch,
                      (r as Warehouse).type ?? "Principal",
                      <Tag value={r.active ? "Activo" : "Inactivo"} />,
                      rowActions({ ...r }),
                    ]
                  : [
                      r.id,
                      <>
                        {r.name}
                      </>,
                      (r as Party).taxId,
                      (r as Party).contact,
                      money((r as Party).credit),
                      <Tag value={r.active ? "Activo" : "Inactivo"} />,
                      rowActions({ ...r }),
                    ],
            }))}
            exportData={{
              name: tab,
              title: tab,
              profile: "catalog",
              company: { name: state.settings.company },
              subtitle: `Maestro de ${tab.toLowerCase()} administrado desde EnterpriseCloud ERP.`,
              summary: [
                { label: "Registros", value: data.length },
                {
                  label: "Activos",
                  value: data.filter((r) => r.active).length,
                },
              ],
              headers: headers.filter((h) => h !== "Acciones"),
              rows: data.map((r) =>
                product
                  ? [
                      r.id,
                      r.name,
                      (r as Product).category,
                      (r as Product).unit,
                      (r as Product).cost,
                      (r as Product).price,
                      (r as Product).minimum,
                      r.active ? "Activo" : "Inactivo",
                    ]
                    : warehouse
                      ? [
                          (r as Warehouse).code ?? r.id,
                          r.name,
                          (r as Warehouse).branch,
                          (r as Warehouse).type ?? "Principal",
                          r.active ? "Activo" : "Inactivo",
                        ]
                    : [
                        r.id,
                        r.name,
                        (r as Party).taxId,
                        (r as Party).contact,
                        (r as Party).credit,
                        r.active ? "Activo" : "Inactivo",
                      ],
              ),
            }}
          />
          <p className="muted">
            Desactiva registros para dejar de utilizarlos en nuevas operaciones.
            Sus documentos y movimientos anteriores se conservan.
          </p>
        </>
      )}
      {tab === "Categorías" && <Categories />}
      {tab === "Sucursales" && <Branches />}
      {tab === "Marcas" && <Brands />}
      {tab === "Unidades" && <Units />}
      {tab === "Conversiones" && <Conversions />}
      {tab === "Transportistas" && <Transporters />}
      {tab === "Vendedores" && <Sellers />}
      {tab === "Zonas" && <Zones />}
      {tab === "Monedas" && <Currencies />}
      {tab === "Impuestos" && <Taxes />}
      {tab === "Formas de pago" && <PaymentMethods />}
      {tab === "Listas de precios" && <PriceLists />}
      {tab === "Empresas" && <CompaniesTable />}
      {importKind && <CsvImportModal kind={importKind} onClose={() => setImportKind(null)} />}
      {masterImportOpen && <MasterCsvImportModal onClose={() => setMasterImportOpen(false)} />}
      {viewing && (
        <Modal title={String(viewing.name)} onClose={() => setViewing(null)}>
          {product ? (
            <ProductDetails
              product={viewing as unknown as Product}
              warehouseId={state.warehouses[0]?.id ?? ""}
            />
          ) : (
            <div className="detail-meta">
              {Object.entries(viewing)
                .filter(([key]) => !["country", "website"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <small>
                      {labels[key] ??
                        {
                          id: "Código",
                          active: "Estado",
                          registeredAt: "Fecha de registro",
                        }[key] ??
                        key}
                    </small>
                    <b>
                      {typeof value === "boolean"
                        ? value
                          ? "Sí"
                          : "No"
                        : String(
                            value === undefined ||
                              value === null ||
                              value === ""
                              ? "No registrado"
                              : value,
                          )}
                    </b>
                  </div>
                ))}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setViewing(null)}
            >
              Cerrar ficha
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <CatalogDeleteDialog
          kind={deleting.kind}
          id={deleting.id}
          onClose={() => setDeleting(null)}
          onDone={(deactivated) => {
            setDeleting(null);
            toast[deactivated ? "warning" : "success"](
              deactivated
                ? "Registro desactivado. Su historial se conserva."
                : "Registro eliminado.",
            );
          }}
        />
      )}
      {editor && tab === "Clientes" && (
        <CustomerEditor
          customer={editor.id ? (editor as unknown as Party) : undefined}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            toast.success("Cliente guardado correctamente.");
          }}
        />
      )}
      {editor && tab !== "Clientes" && (
        <Modal
          title={`${editor.id ? "Editar" : "Crear"} · ${tab}`}
          subtitle={product ? "Ficha comercial y de inventario del producto." : "Define la ubicación y el uso operativo del almacén."}
          wide={product || warehouse}
          className="masters-editor-modal"
          onClose={() => setEditor(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-grid">
              {fields.map((key) => (
                <label key={key} className={key === "description" ? "span-two" : undefined}>
                  {labels[key]}
                  {key === "categoryId" && product ? (
                    <select
                      required
                      value={String(editor.categoryId ?? state.masterCategories?.find((category) => category.name === editor.category)?.id ?? "")}
                      onChange={(e) => {
                        const selected = state.masterCategories?.find((category) => category.id === e.target.value);
                        setEditor({ ...editor, categoryId: e.target.value, category: selected?.name ?? "" });
                      }}
                    >
                      <option value="">Selecciona una categoría</option>
                      {(state.masterCategories ?? []).filter((category) => category.active).map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  ) : key === "brandId" && product ? (
                    <select
                      value={String(editor[key] ?? "")}
                      onChange={(e) => setEditor({ ...editor, [key]: e.target.value })}
                    >
                      <option value="">Sin marca</option>
                      {(state.brands ?? []).filter((brand) => brand.active).map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  ) : key === "unitId" && product ? (
                    <select
                      required
                      value={String(editor.unitId ?? state.units?.find((unit) => unit.code === editor.unit)?.id ?? "")}
                      onChange={(e) => {
                        const selected = state.units?.find((unit) => unit.id === e.target.value);
                        setEditor({ ...editor, unitId: e.target.value, unit: selected?.code ?? "" });
                      }}
                    >
                      {(state.units ?? []).filter((unit) => unit.active).map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.abbreviation} · {unit.name}</option>
                      ))}
                    </select>
                  ) : key === "branchId" && warehouse ? (
                    <select
                      required
                      value={String(editor.branchId ?? "")}
                      onChange={(e) => {
                        const selected = state.branches?.find((branch) => branch.id === e.target.value);
                        setEditor({ ...editor, branchId: e.target.value, branch: selected?.name ?? "" });
                      }}
                    >
                      <option value="">Selecciona una sucursal</option>
                      {(state.branches ?? []).filter((branch) => branch.active).map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
                      ))}
                    </select>
                  ) : key === "type" && warehouse ? (
                    <select
                      value={String(editor.type ?? "Principal")}
                      onChange={(e) => setEditor({ ...editor, type: e.target.value })}
                    >
                      <option>Principal</option>
                      <option>Secundario</option>
                      <option>Tránsito</option>
                    </select>
                  ) : key === "description" ? (
                    <textarea
                      rows={3}
                      value={String(editor[key] ?? "")}
                      onChange={(e) => setEditor({ ...editor, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      required={["name", "taxId", "code", "price"].includes(
                        key,
                      )}
                      type={
                        ["cost", "price", "minimum", "credit"].includes(key)
                          ? "number"
                          : key === "email"
                            ? "email"
                            : "text"
                      }
                      min="0"
                      step="0.01"
                      value={String(editor[key] ?? "")}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          [key]: [
                            "cost",
                            "price",
                            "minimum",
                            "credit",
                          ].includes(key)
                            ? Number(e.target.value)
                            : e.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                Estado
                <select
                  value={editor.active ? "Activo" : "Inactivo"}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      active: e.target.value === "Activo",
                    })
                  }
                >
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
              <button className="btn">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
      </div>
      </div>
    </>
  );
}
function Categories() {
  const { state, transact } = useErp();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const visible = state.categories.filter((c) => c.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")));
  return (
    <section className="categories-page">
      <div className="categories-heading">
        <div><span className="categories-eyebrow">MÓDULO 01 · 1.5 · CATÁLOGO DE PRODUCTOS</span><h2>Categorías de producto</h2><p className="muted">Organiza tu catálogo por familias de productos.</p></div>
        <span className="categories-total"><FolderOpen size={18} />{state.categories.length} categorías</span>
      </div>
      <div className="categories-layout">
      <div className="card categories-directory">
        <label className="categories-search"><Search size={18} /><input aria-label="Buscar categorías" placeholder="Buscar una categoría…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="categories-grid">
          {visible.map((category) => {
            const count = state.products.filter((p) => p.category === category).length;
            return <article className="category-tile" key={category}><div className="category-tile-head"><span className="category-tile-icon"><FolderOpen size={22} /></span><button type="button" className="category-delete-button" aria-label={`Eliminar categoría ${category}`} title="Eliminar categoría" onClick={() => {setDeleting(category); setReplacement(""); setDeleteError("");}}><Trash2 size={16} /></button></div><h3>{category}</h3><p>{count} {count === 1 ? "producto" : "productos"}</p></article>;
          })}
        </div>
        {!visible.length && <div className="categories-empty"><FolderOpen size={30} /><h3>{search ? "No se encontraron categorías" : "Aún no hay categorías"}</h3><p className="muted">{search ? "Prueba con otro nombre." : "Agrega tu primera categoría para organizar los productos."}</p></div>}
      </div>
      <aside className="card categories-create"><span className="category-tile-icon"><Plus size={22} /></span><h3>Nueva categoría</h3><p className="muted">Usa un nombre breve y fácil de identificar.</p>
      <form
        className="categories-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            transact((s) => {
              if (!name.trim()) throw Error("Ingresa un nombre.");
              if (
                s.categories.some(
                  (c) => c.toLowerCase() === name.trim().toLowerCase(),
                )
              )
                throw Error("La categoría ya existe.");
              const category = name.trim();
              s.categories.push(category);
              s.masterCategories ??= [];
              s.masterCategories.push({
                id: `CAT-${Date.now().toString(36).toUpperCase()}`,
                code: `CAT-${String(s.masterCategories.length + 1).padStart(3, "0")}`,
                name: category,
                active: true,
              });
              s.deletedCategories = s.deletedCategories?.filter((deleted) => deleted !== category);
              s.audit.unshift({
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                action: "Crear categoría",
                record: category,
              });
            });
            setName("");
            setError("");
            toast.success("Categoría agregada correctamente.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
          }
        }}
      >
        <label htmlFor="new-category-name">Nombre de la categoría</label>
        <input
          id="new-category-name"
          aria-label="Nombre de nueva categoría"
          placeholder="Nueva categoría"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn"><Plus size={16} />Agregar categoría</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      </aside>
      </div>
      {deleting !== null && <Modal title="Eliminar categoría" onClose={() => setDeleting(null)}>
        <p>¿Eliminar la categoría <strong>{deleting}</strong>?</p>
        {state.products.some((product) => product.category === deleting) && <>
          <p className="muted">Los productos se conservarán. Elige cómo clasificarlos después de eliminar esta categoría.</p>
          <label className="filter-field">Mover productos a<select value={replacement} onChange={(event) => setReplacement(event.target.value)}><option value="">Sin categoría</option>{state.categories.filter((category) => category !== deleting).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        </>}
        {deleteError && <p className="error" role="alert">{deleteError}</p>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" className="btn" onClick={() => {try {transact((state) => deleteCategory(state, deleting, replacement)); setDeleting(null); toast.success("Categoría eliminada correctamente.");} catch (error) {setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la categoría.");}}}>Eliminar categoría</button></div>
      </Modal>}
    </section>
  );
}
function CompaniesTable() {
  const { state, transact } = useErp();
  const companies = state.companies ?? [];
  const [editor, setEditor] = useState<Partial<Company> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const currencies = state.currencies ?? [];
  const availableCurrencies = currencies.filter((item) => item.active || item.isoCode === editor?.baseCurrency);
  const isEditing = Boolean(editingId);
  const editorBranchCount = editor ? state.branches?.filter((branch) => branch.companyId === (editingId ?? editor.id)).length ?? 0 : 0;

  const nextCompanyId = () => {
    let number = companies.length + 1;
    while (companies.some((item) => item.id === `EMP-${String(number).padStart(3, "0")}`)) number += 1;
    return `EMP-${String(number).padStart(3, "0")}`;
  };

  const startNewCompany = () => {
    setError("");
    setEditingId(null);
    setEditor({ id: nextCompanyId(), baseCurrency: state.settings.currency, active: true });
  };

  const saveCompany = () => {
    if (!editor) return;
    try {
      transact((s) => {
        const id = String(editor.id ?? "").trim();
        const legalName = String(editor.legalName ?? "").trim();
        const taxId = String(editor.taxId ?? "").trim();
        const baseCurrency = String(editor.baseCurrency ?? state.settings.currency);
        if (!id) throw Error("El código interno es obligatorio.");
        if (!legalName) throw Error("La razón social es obligatoria.");
        if (taxId && !/^\d{11}$/.test(taxId)) throw Error("El RUC debe contener 11 dígitos.");
        if (editor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(editor.email).trim())) throw Error("Ingresa un correo empresarial válido.");
        s.companies ??= [];
        if (s.companies.some((item) => item.id !== editingId && item.id === id)) throw Error("Ya existe una empresa con ese código.");
        if (s.companies.some((item) => item.id !== id && item.taxId && taxId && item.taxId === taxId)) throw Error("Ya existe una empresa con ese RUC.");
        if (s.companies.some((item) => item.id !== id && item.legalName.toLocaleLowerCase("es") === legalName.toLocaleLowerCase("es"))) throw Error("Ya existe una empresa con esa razón social.");
        const index = s.companies.findIndex((item) => item.id === (editingId ?? id));
        const current: Company = {
          id,
          taxId,
          legalName,
          tradeName: String(editor.tradeName ?? "").trim() || undefined,
          logoUrl: String(editor.logoUrl ?? "").trim() || undefined,
          fiscalAddress: String(editor.fiscalAddress ?? "").trim(),
          taxRegime: String(editor.taxRegime ?? "").trim() || undefined,
          phone: String(editor.phone ?? "").trim() || undefined,
          email: String(editor.email ?? "").trim() || undefined,
          website: String(editor.website ?? "").trim() || undefined,
          baseCurrency,
          active: editor.active !== false,
        };
        if (index >= 0) s.companies[index] = current;
        else s.companies.push(current);
        if (index === 0 || s.companies.length === 1) {
          s.settings.company = legalName;
          s.settings.currency = baseCurrency;
        }
        s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Actualizar empresa" : "Crear empresa", record: `${id}: ${legalName}` });
      });
      setEditor(null);
      setEditingId(null);
      setError("");
      toast.success(isEditing ? "Empresa actualizada correctamente." : "Empresa creada correctamente.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la empresa.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <section className="masters-section">
      <MasterSectionHeader module="1.1" title="Empresas" description="Administra las organizaciones que comparten la operación del ERP." count={companies.length} icon={<Building2 size={20} />} onAdd={startNewCompany} />
      <div className="card masters-table-card company-table-card">
        <div className="company-table-caption">
          <div>
            <span className="company-form-eyebrow">CATÁLOGO COMPARTIDO</span>
            <h3>Empresas registradas</h3>
            <p>Cada empresa puede tener sus propias sedes, moneda y parámetros operativos.</p>
          </div>
          <span className="company-directory-count">{companies.length} {companies.length === 1 ? "registro" : "registros"}</span>
        </div>
        {companies.length ? (
          <table className="masters-table company-table">
            <thead><tr><th>Empresa</th><th>RUC</th><th>Moneda base</th><th>Sucursales</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {companies.map((company) => {
                const branchCount = state.branches?.filter((branch) => branch.companyId === company.id).length ?? 0;
                return <tr key={company.id}>
                  <td><div className="company-table-name"><span className="company-table-icon"><Building2 size={16} /></span><span><strong>{company.tradeName || company.legalName}</strong><small>{company.id} · {company.legalName}</small></span></div></td>
                  <td>{company.taxId || "Pendiente"}</td>
                  <td><code>{company.baseCurrency}</code></td>
                  <td>{branchCount}</td>
                  <td><Tag value={company.active ? "Activo" : "Inactivo"} /></td>
                  <td><button className="icon-btn" type="button" aria-label={`Editar ${company.legalName}`} onClick={() => { setError(""); setEditingId(company.id); setEditor({ ...company }); }}><Pencil size={16} /></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        ) : (
          <div className="masters-empty"><Building2 size={28} /><h3>Aún no hay empresas</h3><p>Registra la primera empresa para habilitar la operación del ERP.</p></div>
        )}
      </div>
      {editor && <Modal wide className="company-editor-modal" title={isEditing ? "Editar empresa" : "Nueva empresa"} subtitle="Información fiscal y operativa que alimenta documentos, reportes y comprobantes." icon={<Building2 size={20} />} onClose={() => { setEditor(null); setEditingId(null); setError(""); }}>
        <form onSubmit={(event) => { event.preventDefault(); saveCompany(); }}>
          <div className="company-editor-shell">
            <aside className="company-preview-card">
              <div className="company-preview-top">
                <label className="company-logo-trigger" title={editor.logoUrl ? "Cambiar logo" : "Agregar logo"} aria-label={editor.logoUrl ? "Cambiar logo de la empresa" : "Agregar logo de la empresa"}>
                  {editor.logoUrl ? <img src={editor.logoUrl} alt="Logo de la empresa" /> : <Building2 size={22} />}
                  <span className="company-logo-trigger-badge"><ImagePlus size={12} /></span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { setError("Selecciona un archivo de imagen válido."); event.currentTarget.value = ""; return; } if (file.size > 2 * 1024 * 1024) { setError("El logo no debe superar los 2 MB."); event.currentTarget.value = ""; return; } const reader = new FileReader(); reader.onload = () => setEditor((current) => current ? { ...current, logoUrl: String(reader.result ?? "") } : current); reader.readAsDataURL(file); }} />
                </label>
                <Tag value={editor.active === false ? "Inactiva" : "Activa"} />
              </div>
              <span className="company-identity-label">{isEditing && editingId === companies[0]?.id ? "REGISTRO PRINCIPAL" : isEditing ? "EMPRESA SELECCIONADA" : "NUEVA EMPRESA"}</span>
              <h3>{String(editor.tradeName || editor.legalName || "Nombre de la empresa")}</h3>
              <p>{editor.tradeName ? String(editor.legalName || "Identidad fiscal de la empresa.") : "Identidad fiscal y operativa del catálogo de empresas."}</p>
              <dl><div><dt>Código interno</dt><dd>{editor.id}</dd></div><div><dt>RUC</dt><dd>{editor.taxId || "Pendiente"}</dd></div><div><dt>Moneda base</dt><dd>{editor.baseCurrency || state.settings.currency}</dd></div><div><dt>Sucursales</dt><dd>{editorBranchCount}</dd></div></dl>
              {editor.logoUrl && <button type="button" className="company-logo-remove" onClick={() => setEditor({ ...editor, logoUrl: undefined })}><Trash2 size={14} /> Quitar logo</button>}
              <div className="company-identity-note"><Icon name="shield" size={14} /><span>Los cambios quedan registrados en auditoría.</span></div>
            </aside>
            <div className="card company-editor-form-card">
              <div className="company-form-intro"><div><span className="company-form-eyebrow">DATOS CENTRALES</span><h3>Información fiscal y operativa</h3><p>Completa los datos que se utilizarán en documentos, reportes y comprobantes.</p></div><span className="company-form-code">{editor.id}</span></div>
              <div className="form-grid">
                <label>Código interno<input required readOnly={isEditing} value={String(editor.id ?? "")} onChange={(event) => setEditor({ ...editor, id: event.target.value.toUpperCase() })} placeholder="EMP-001" /></label>
                <label>Estado<select value={editor.active === false ? "Inactivo" : "Activo"} onChange={(event) => setEditor({ ...editor, active: event.target.value === "Activo" })}><option>Activo</option><option>Inactivo</option></select></label>
                <label className="span-two">Razón social<input required value={String(editor.legalName ?? "")} onChange={(event) => setEditor({ ...editor, legalName: event.target.value })} placeholder="Razón social registrada" /></label>
                <label>Nombre comercial <span className="optional">· opcional</span><input value={String(editor.tradeName ?? "")} onChange={(event) => setEditor({ ...editor, tradeName: event.target.value })} placeholder="Nombre visible en documentos" /></label>
                <label>RUC <span className="optional">· 11 dígitos</span><input inputMode="numeric" maxLength={11} value={String(editor.taxId ?? "")} onChange={(event) => setEditor({ ...editor, taxId: event.target.value.replace(/\D/g, "") })} placeholder="20123456789" /></label>
                <label>Régimen tributario<select value={String(editor.taxRegime ?? "")} onChange={(event) => setEditor({ ...editor, taxRegime: event.target.value })}><option value="">No especificado</option><option>Régimen General</option><option>Régimen MYPE Tributario</option><option>Régimen Especial</option></select></label>
                <label>Moneda base<select value={String(editor.baseCurrency ?? state.settings.currency)} onChange={(event) => setEditor({ ...editor, baseCurrency: event.target.value })}>{availableCurrencies.map((currency) => <option key={currency.id} value={currency.isoCode}>{currency.isoCode} · {currency.name}</option>)}</select></label>
                <label className="span-two">Domicilio fiscal<input value={String(editor.fiscalAddress ?? "")} onChange={(event) => setEditor({ ...editor, fiscalAddress: event.target.value })} placeholder="Dirección fiscal completa" /></label>
                <label>Teléfono empresarial<input type="tel" value={String(editor.phone ?? "")} onChange={(event) => setEditor({ ...editor, phone: event.target.value })} placeholder="01 000 0000" /></label>
                <label>Correo empresarial<input type="email" value={String(editor.email ?? "")} onChange={(event) => setEditor({ ...editor, email: event.target.value })} placeholder="contacto@empresa.com" /></label>
                <label>Sitio web <span className="optional">· opcional</span><input type="url" value={String(editor.website ?? "")} onChange={(event) => setEditor({ ...editor, website: event.target.value })} placeholder="https://empresa.com" /></label>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="company-form-footer"><p>La moneda base se utilizará para precios, compras, ventas y reportes. Los cambios quedan registrados en auditoría.</p><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => { setEditor(null); setEditingId(null); setError(""); }}>Cancelar</button><button className="btn">Guardar empresa</button></div></div>
            </div>
          </div>
        </form>
      </Modal>}
    </section>
  );
}

function Company() {
  const { state, transact } = useErp();
  const companies = state.companies ?? [];
  const [selectedId, setSelectedId] = useState(companies[0]?.id ?? "EMP-001");
  const companyMaster = companies.find((item) => item.id === selectedId);
  const [company, setCompany] = useState(companyMaster?.legalName ?? state.settings.company);
  const [tradeName, setTradeName] = useState(companyMaster?.tradeName ?? "");
  const [taxId, setTaxId] = useState(companyMaster?.taxId ?? "");
  const [address, setAddress] = useState(companyMaster?.fiscalAddress ?? "");
  const [taxRegime, setTaxRegime] = useState(companyMaster?.taxRegime ?? "");
  const [phone, setPhone] = useState(companyMaster?.phone ?? "");
  const [email, setEmail] = useState(companyMaster?.email ?? "");
  const [website, setWebsite] = useState(companyMaster?.website ?? "");
  const [currency, setCurrency] = useState(companyMaster?.baseCurrency ?? state.settings.currency);
  const [active, setActive] = useState(companyMaster?.active !== false);
  const [error, setError] = useState("");
  const availableCurrencies = (state.currencies ?? []).filter((item) => item.active || item.isoCode === currency);
  const branchCount = state.branches?.filter((branch) => branch.companyId === companyMaster?.id).length ?? 0;
  useEffect(() => {
    if (!companyMaster) return;
    setCompany(companyMaster.legalName);
    setTradeName(companyMaster.tradeName ?? "");
    setTaxId(companyMaster.taxId ?? "");
    setAddress(companyMaster.fiscalAddress ?? "");
    setTaxRegime(companyMaster.taxRegime ?? "");
    setPhone(companyMaster.phone ?? "");
    setEmail(companyMaster.email ?? "");
    setWebsite(companyMaster.website ?? "");
    setCurrency(companyMaster.baseCurrency);
    setActive(companyMaster.active !== false);
    setError("");
  }, [companyMaster?.id]);
  const startNewCompany = () => {
    const nextId = `EMP-${String(companies.length + 1).padStart(3, "0")}`;
    setSelectedId(nextId);
    setCompany(""); setTradeName(""); setTaxId(""); setAddress(""); setTaxRegime(""); setPhone(""); setEmail(""); setWebsite(""); setCurrency(state.settings.currency); setActive(true); setError("");
  };
  return (
    <section className="masters-section">
      <MasterSectionHeader module="1.1" title="Empresas" description="Administra las organizaciones que comparten la operación del ERP." count={companies.length} icon={<Building2 size={20} />} onAdd={startNewCompany} />
      <div className="card company-directory-card">
        <div className="company-directory-head"><div><span className="company-form-eyebrow">CATÁLOGO COMPARTIDO</span><h3>Empresas registradas</h3><p>Selecciona una empresa para consultar o actualizar su información fiscal.</p></div><span className="company-directory-count">{companies.length} registros</span></div>
        <div className="company-directory-list">
          {companies.map((item) => <button type="button" key={item.id} className={`company-directory-item ${item.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(item.id)}><span className="company-directory-item-icon"><Building2 size={17} /></span><span><strong>{item.tradeName || item.legalName}</strong><small>{item.id} · {item.legalName}</small></span><Tag value={item.active ? "Activo" : "Inactivo"} /></button>)}
        </div>
      </div>
      <div className="company-master-layout">
      <aside className="company-identity">
        <div className="company-identity-top">
          <span className="company-identity-mark"><Building2 size={21} /></span>
          <span className="company-record-status">{active ? "Activa" : "Inactiva"}</span>
        </div>
        <span className="company-identity-label">{companyMaster?.id === companies[0]?.id ? "REGISTRO PRINCIPAL" : "EMPRESA SELECCIONADA"}</span>
        <h3>{tradeName || company || state.settings.company}</h3>
        <p>{tradeName ? company : "Identidad fiscal y operativa del catálogo de empresas."}</p>
        <dl>
          <div><dt>Código interno</dt><dd>{companyMaster?.id ?? "EMP-001"}</dd></div>
          <div><dt>RUC</dt><dd>{taxId || "Pendiente"}</dd></div>
          <div><dt>Moneda base</dt><dd>{currency}</dd></div>
          <div><dt>Sucursales</dt><dd>{branchCount}</dd></div>
        </dl>
        <div className="company-identity-note">
          <Icon name="shield" size={14} />
          <span>Los cambios quedan registrados en auditoría.</span>
        </div>
      </aside>
      <div className="card company-master-card">
      <div className="company-form-intro">
        <div>
          <span className="company-form-eyebrow">DATOS CENTRALES</span>
          <h3>Información fiscal y operativa</h3>
          <p>Completa los datos que se utilizarán en documentos, reportes y comprobantes.</p>
        </div>
          <span className="company-form-code">{companyMaster?.id ?? selectedId}</span>
      </div>
      <form
        className="company-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            transact((s) => {
              const nextCompany = company.trim();
              const nextTaxId = taxId.trim();
              if (!nextCompany) throw Error("La razón social es obligatoria.");
              if (nextTaxId && !/^\d{11}$/.test(nextTaxId)) throw Error("El RUC debe contener 11 dígitos.");
              if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw Error("Ingresa un correo empresarial válido.");
              s.companies ??= [];
              s.companies ??= [];
              const targetId = selectedId || "EMP-001";
              if (s.companies.some((item) => item.id !== targetId && item.taxId && nextTaxId && item.taxId === nextTaxId)) throw Error("Ya existe una empresa con ese RUC.");
              if (s.companies.some((item) => item.id !== targetId && item.legalName.toLocaleLowerCase("es") === nextCompany.toLocaleLowerCase("es"))) throw Error("Ya existe una empresa con esa razón social.");
              const index = s.companies.findIndex((item) => item.id === targetId);
              const current: Company = { id: targetId, taxId: nextTaxId, legalName: nextCompany, tradeName: tradeName.trim() || undefined, fiscalAddress: address.trim(), taxRegime: taxRegime || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined, website: website.trim() || undefined, baseCurrency: currency, active };
              if (index >= 0) s.companies[index] = current; else s.companies.push(current);
              if (index === 0 || s.companies.length === 1) { s.settings.company = nextCompany; s.settings.currency = currency; }
              s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Actualizar empresa" : "Crear empresa", record: `${targetId}: ${nextCompany}` });
            });
            setError("");
            toast.success(companyMaster ? "Empresa actualizada correctamente." : "Empresa creada correctamente.");
          } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo actualizar la empresa.";
            setError(message);
            toast.error(message);
          }
        }}
      >
        <div className="form-grid">
          <label className="span-two">Razón social<input required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Razón social registrada" /></label>
          <label>Nombre comercial <span className="optional">· opcional</span><input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Nombre visible en documentos" /></label>
          <label>RUC <span className="optional">· 11 dígitos</span><input inputMode="numeric" maxLength={11} value={taxId} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))} placeholder="20123456789" /></label>
          <label>Régimen tributario<select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)}><option value="">No especificado</option><option>Régimen General</option><option>Régimen MYPE Tributario</option><option>Régimen Especial</option></select></label>
          <label>Moneda base<select value={currency} onChange={(e) => setCurrency(e.target.value)}>{availableCurrencies.map((item) => <option key={item.id} value={item.isoCode}>{item.isoCode} · {item.name}</option>)}</select></label>
          <label className="span-two">Domicilio fiscal<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección fiscal completa" /></label>
          <label>Teléfono empresarial<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 000 0000" /></label>
          <label>Correo empresarial<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@empresa.com" /></label>
          <label>Sitio web <span className="optional">· opcional</span><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://empresa.com" /></label>
          <label>Estado<select value={active ? "Activo" : "Inactivo"} onChange={(e) => setActive(e.target.value === "Activo")}><option>Activo</option><option>Inactivo</option></select></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="company-form-footer">
          <p>La moneda base se utilizará para precios, compras, ventas y reportes.</p>
          <button className="btn" type="submit">Guardar empresa</button>
        </div>
      </form>
      </div>
      </div>
    </section>
  );
}

function MasterSectionHeader({
  module,
  title,
  description,
  count,
  icon,
  onAdd,
}: {
  module: string;
  title: string;
  description: string;
  count: number;
  icon: ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="masters-section-head">
      <div className="masters-section-title" data-master-module={module}>
        <span className="masters-section-icon">{icon}</span>
        <div>
          <span className="masters-eyebrow">MÓDULO 01 · {module}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="masters-section-actions">
        <span className="masters-count">{count} {count === 1 ? "registro" : "registros"}</span>
        {onAdd && <button type="button" className="btn" onClick={onAdd}><Plus size={15} /> Nuevo registro</button>}
      </div>
    </div>
  );
}

function Branches() {
  const { state, transact } = useErp();
  const [editor, setEditor] = useState<Partial<Branch> | null>(null);
  const [error, setError] = useState("");
  const branches = state.branches ?? [];
  const companies = state.companies ?? [];
  const save = () => {
    if (!editor) return;
    try {
      const name = String(editor.name ?? "").trim();
      const code = String(editor.code ?? "").trim().toUpperCase();
      if (!name || !code) throw Error("El código y nombre de la sucursal son obligatorios.");
      transact((s) => {
        s.branches ??= [];
        const companyId = String(editor.companyId ?? "").trim();
        if (!companyId || !s.companies?.some((company) => company.id === companyId))
          throw Error("Selecciona una empresa válida para la sucursal.");
        if (s.branches.some((branch) => branch.id !== editor.id && (branch.code.toLowerCase() === code.toLowerCase() || branch.name.toLowerCase() === name.toLowerCase())))
          throw Error("Ya existe una sucursal con ese código o nombre.");
        const id = editor.id ?? `SUC-${Date.now().toString(36).toUpperCase()}`;
        const value: Branch = { id, companyId, code, name, address: String(editor.address ?? "").trim(), phone: String(editor.phone ?? "").trim(), active: editor.active !== false };
        const index = s.branches.findIndex((branch) => branch.id === id);
        if (index >= 0) s.branches[index] = value;
        else s.branches.push(value);
        s.warehouses.forEach((warehouse) => {
          if (warehouse.branchId === id || warehouse.branch === editor.name) warehouse.branch = name;
          if (warehouse.branch === name) warehouse.branchId = id;
        });
        s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Editar sucursal" : "Crear sucursal", record: `${code}: ${name}` });
      });
      setEditor(null); setError(""); toast.success("Sucursal guardada correctamente.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la sucursal."); }
  };
  return <section className="masters-section">
    <MasterSectionHeader
      module="1.2"
      title="Sucursales"
      description="Define las sedes donde opera la empresa y relaciona sus almacenes."
      count={branches.length}
      icon={<MapPin size={20} />}
      onAdd={() => {
        setError("");
        setEditor({
          active: true,
          companyId: companies.find((company) => company.active)?.id ?? companies[0]?.id ?? "",
        });
      }}
    />
    <div className="card masters-table-card"><table className="masters-table"><thead><tr><th>Código</th><th>Sucursal</th><th>Empresa</th><th>Dirección</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id}><td><code>{branch.code}</code></td><td><strong>{branch.name}</strong></td><td>{companies.find((company) => company.id === branch.companyId)?.tradeName || companies.find((company) => company.id === branch.companyId)?.legalName || branch.companyId}</td><td>{branch.address || "No registrada"}</td><td>{branch.phone || "—"}</td><td><Tag value={branch.active ? "Activo" : "Inactivo"} /></td><td><button className="icon-btn" type="button" aria-label={`Editar ${branch.name}`} onClick={() => { setError(""); setEditor({ ...branch }); }}><Pencil size={16} /></button></td></tr>)}</tbody></table>{!branches.length && <div className="masters-empty"><MapPin size={28} /><h3>Aún no hay sucursales</h3><p>Registra la primera sede para organizar almacenes y operaciones.</p></div>}</div>
    {editor && <Modal title={`${editor.id ? "Editar" : "Nueva"} sucursal`} subtitle="La sucursal se reutiliza en almacenes y documentos." onClose={() => setEditor(null)}><form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label>Empresa<select required value={String(editor.companyId ?? "")} onChange={(e) => setEditor({ ...editor, companyId: e.target.value })}><option value="">Selecciona una empresa</option>{companies.filter((company) => company.active || company.id === editor.companyId).map((company) => <option key={company.id} value={company.id}>{company.tradeName || company.legalName} · {company.id}</option>)}</select></label><label>Código<input required value={String(editor.code ?? "")} onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })} placeholder="LIM-01" /></label><label>Nombre<input required value={String(editor.name ?? "")} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Sede central · Lima" /></label><label className="span-two">Dirección<input value={String(editor.address ?? "")} onChange={(e) => setEditor({ ...editor, address: e.target.value })} placeholder="Av. / calle y número" /></label><label>Teléfono<input type="tel" value={String(editor.phone ?? "")} onChange={(e) => setEditor({ ...editor, phone: e.target.value })} placeholder="01 000 0000" /></label><label>Estado<select value={editor.active === false ? "Inactivo" : "Activo"} onChange={(e) => setEditor({ ...editor, active: e.target.value === "Activo" })}><option>Activo</option><option>Inactivo</option></select></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditor(null)}>Cancelar</button><button className="btn">Guardar sucursal</button></div></form></Modal>}
  </section>;
}

function Brands() {
  const { state, transact } = useErp();
  const [editor, setEditor] = useState<Partial<Brand> | null>(null);
  const [error, setError] = useState("");
  const brands = state.brands ?? [];
  const save = () => {
    if (!editor) return;
    try {
      const name = String(editor.name ?? "").trim(); const code = String(editor.code ?? "").trim().toUpperCase();
      if (!name || !code) throw Error("El código y nombre de la marca son obligatorios.");
      transact((s) => { s.brands ??= []; if (s.brands.some((brand) => brand.id !== editor.id && (brand.code.toLowerCase() === code.toLowerCase() || brand.name.toLowerCase() === name.toLowerCase()))) throw Error("Ya existe una marca con ese código o nombre."); const id = editor.id ?? `MAR-${Date.now().toString(36).toUpperCase()}`; const value: Brand = { id, code, name, countryOfOrigin: String(editor.countryOfOrigin ?? "").trim(), active: editor.active !== false }; const index = s.brands.findIndex((brand) => brand.id === id); if (index >= 0) s.brands[index] = value; else s.brands.push(value); s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Editar marca" : "Crear marca", record: `${code}: ${name}` }); });
      setEditor(null); setError(""); toast.success("Marca guardada correctamente.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la marca."); }
  };
  return <section className="masters-section"><MasterSectionHeader module="1.6" title="Marcas" description="Normaliza las marcas para analizar compras, ventas y productos." count={brands.length} icon={<Tags size={20} />} onAdd={() => { setError(""); setEditor({ active: true }); }} /><div className="card masters-table-card"><table className="masters-table"><thead><tr><th>Código</th><th>Marca</th><th>País de origen</th><th>Productos</th><th>Estado</th><th></th></tr></thead><tbody>{brands.map((brand) => <tr key={brand.id}><td><code>{brand.code}</code></td><td><strong>{brand.name}</strong></td><td>{brand.countryOfOrigin || "—"}</td><td>{state.products.filter((product) => product.brandId === brand.id).length}</td><td><Tag value={brand.active ? "Activo" : "Inactivo"} /></td><td><button className="icon-btn" type="button" aria-label={`Editar ${brand.name}`} onClick={() => { setError(""); setEditor({ ...brand }); }}><Pencil size={16} /></button></td></tr>)}</tbody></table>{!brands.length && <div className="masters-empty"><Tags size={28} /><h3>Aún no hay marcas</h3><p>Agrega marcas para completar la ficha de productos.</p></div>}</div>{editor && <Modal title={`${editor.id ? "Editar" : "Nueva"} marca`} subtitle="Identifica las marcas utilizadas por los productos del catálogo." onClose={() => setEditor(null)}><form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label>Código<input required value={String(editor.code ?? "")} onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })} placeholder="MAR-001" /></label><label>Nombre<input required value={String(editor.name ?? "")} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Nombre de la marca" /></label><label>País de origen<span className="optional"> · opcional</span><input value={String(editor.countryOfOrigin ?? "")} onChange={(e) => setEditor({ ...editor, countryOfOrigin: e.target.value })} placeholder="Perú" /></label><label>Estado<select value={editor.active === false ? "Inactivo" : "Activo"} onChange={(e) => setEditor({ ...editor, active: e.target.value === "Activo" })}><option>Activo</option><option>Inactivo</option></select></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditor(null)}>Cancelar</button><button className="btn">Guardar marca</button></div></form></Modal>}</section>;
}

function Units() {
  const { state, transact } = useErp();
  const [editor, setEditor] = useState<Partial<UnitOfMeasure> | null>(null);
  const [error, setError] = useState("");
  const units = state.units ?? [];
  const save = () => {
    if (!editor) return;
    try {
      const name = String(editor.name ?? "").trim(); const code = String(editor.code ?? "").trim().toUpperCase(); const abbreviation = String(editor.abbreviation ?? "").trim().toUpperCase(); const precision = Number(editor.precision ?? 0);
      if (!name || !code || !abbreviation) throw Error("Completa código, nombre y abreviatura.");
      if (!Number.isInteger(precision) || precision < 0 || precision > 6) throw Error("La precisión debe ser un entero entre 0 y 6.");
      transact((s) => { s.units ??= []; if (s.units.some((unit) => unit.id !== editor.id && (unit.code.toLowerCase() === code.toLowerCase() || unit.abbreviation.toLowerCase() === abbreviation.toLowerCase()))) throw Error("Ya existe una unidad con ese código o abreviatura."); const id = editor.id ?? code; const value: UnitOfMeasure = { id, code, name, abbreviation, precision, active: editor.active !== false }; const index = s.units.findIndex((unit) => unit.id === id); if (index >= 0) s.units[index] = value; else s.units.push(value); s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Editar unidad" : "Crear unidad", record: `${code}: ${name}` }); });
      setEditor(null); setError(""); toast.success("Unidad guardada correctamente.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la unidad."); }
  };
  return <section className="masters-section"><MasterSectionHeader module="1.7" title="Unidades de medida" description="Controla la unidad base y la precisión permitida por producto." count={units.length} icon={<Ruler size={20} />} onAdd={() => { setError(""); setEditor({ precision: 0, active: true }); }} /><div className="card masters-table-card"><table className="masters-table"><thead><tr><th>Código</th><th>Unidad</th><th>Abreviatura</th><th>Precisión</th><th>Productos</th><th>Estado</th><th></th></tr></thead><tbody>{units.map((unit) => <tr key={unit.id}><td><code>{unit.code}</code></td><td><strong>{unit.name}</strong></td><td>{unit.abbreviation}</td><td>{unit.precision} decimales</td><td>{state.products.filter((product) => product.unit === unit.code || product.unitId === unit.id).length}</td><td><Tag value={unit.active ? "Activo" : "Inactivo"} /></td><td><button className="icon-btn" type="button" aria-label={`Editar ${unit.name}`} onClick={() => { setError(""); setEditor({ ...unit }); }}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>{editor && <Modal title={`${editor.id ? "Editar" : "Nueva"} unidad`} subtitle="La precisión se aplicará en cantidades y conversiones del inventario." onClose={() => setEditor(null)}><form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label>Código<input required value={String(editor.code ?? "")} onChange={(e) => setEditor({ ...editor, code: e.target.value.toUpperCase() })} placeholder="UND" /></label><label>Nombre<input required value={String(editor.name ?? "")} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Unidad" /></label><label>Abreviatura<input required value={String(editor.abbreviation ?? "")} onChange={(e) => setEditor({ ...editor, abbreviation: e.target.value.toUpperCase() })} placeholder="UND" /></label><label>Precisión decimal<input type="number" min="0" max="6" step="1" value={Number(editor.precision ?? 0)} onChange={(e) => setEditor({ ...editor, precision: Number(e.target.value) })} /></label><label>Estado<select value={editor.active === false ? "Inactivo" : "Activo"} onChange={(e) => setEditor({ ...editor, active: e.target.value === "Activo" })}><option>Activo</option><option>Inactivo</option></select></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditor(null)}>Cancelar</button><button className="btn">Guardar unidad</button></div></form></Modal>}</section>;
}

function Conversions() {
  const { state, transact } = useErp();
  const [editor, setEditor] = useState<Partial<UnitConversion> | null>(null);
  const [error, setError] = useState("");
  const units = (state.units ?? []).filter((unit) => unit.active); const conversions = state.unitConversions ?? [];
  const save = () => {
    if (!editor) return;
    try {
      const factor = Number(editor.factor);
      if (!editor.fromUnitId || !editor.toUnitId || editor.fromUnitId === editor.toUnitId)
        throw Error("Selecciona dos unidades diferentes.");
      if (!Number.isFinite(factor) || factor <= 0)
        throw Error("El factor debe ser mayor que cero.");
      if (!editor.validFrom)
        throw Error("Indica desde cuándo aplica la conversión.");
      if (editor.validTo && editor.validTo < editor.validFrom)
        throw Error("La fecha final no puede ser anterior a la fecha inicial.");
      transact((s) => {
        s.unitConversions ??= [];
        const id = editor.id ?? `CON-${Date.now().toString(36).toUpperCase()}`;
        const duplicate = s.unitConversions.some((conversion) =>
          conversion.id !== id &&
          conversion.productId === (editor.productId || undefined) &&
          conversion.fromUnitId === editor.fromUnitId &&
          conversion.toUnitId === editor.toUnitId &&
          conversion.validFrom === editor.validFrom,
        );
        if (duplicate) throw Error("Ya existe una conversión para esa combinación y fecha.");
        const value: UnitConversion = { id, productId: editor.productId || undefined, fromUnitId: editor.fromUnitId!, toUnitId: editor.toUnitId!, factor, validFrom: editor.validFrom!, validTo: editor.validTo || undefined, active: editor.active !== false };
        const index = s.unitConversions.findIndex((conversion) => conversion.id === id);
        if (index >= 0) s.unitConversions[index] = value;
        else s.unitConversions.push(value);
        s.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: index >= 0 ? "Editar conversión" : "Crear conversión", record: `${value.fromUnitId} → ${value.toUnitId}` });
      });
      setEditor(null); setError(""); toast.success("Conversión guardada correctamente.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la conversión."); }
  };
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.abbreviation ?? id;
  return <section className="masters-section"><MasterSectionHeader module="1.8" title="Conversiones de unidades" description="Define equivalencias vigentes para compras, inventario y ventas." count={conversions.length} icon={<ArrowRightLeft size={20} />} onAdd={() => { setError(""); setEditor({ validFrom: today(), active: true, factor: 1 }); }} /><div className="card masters-table-card"><table className="masters-table"><thead><tr><th>Producto</th><th>Desde</th><th>Hacia</th><th>Factor</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>{conversions.map((conversion) => <tr key={conversion.id}><td>{conversion.productId ? state.products.find((product) => product.id === conversion.productId)?.name ?? conversion.productId : "General"}</td><td>{unitName(conversion.fromUnitId)}</td><td>{unitName(conversion.toUnitId)}</td><td>1 = {conversion.factor}</td><td>{conversion.validFrom}{conversion.validTo ? ` · ${conversion.validTo}` : " · vigente"}</td><td><Tag value={conversion.active ? "Activo" : "Inactivo"} /></td><td><button className="icon-btn" type="button" aria-label="Editar conversión" onClick={() => { setError(""); setEditor({ ...conversion }); }}><Pencil size={16} /></button></td></tr>)}</tbody></table>{!conversions.length && <div className="masters-empty"><ArrowRightLeft size={28} /><h3>Aún no hay conversiones</h3><p>Úsalas cuando una operación requiera equivalencias entre unidades.</p></div>}</div>{editor && <Modal title={`${editor.id ? "Editar" : "Nueva"} conversión`} subtitle="Las conversiones no reemplazan la unidad base del producto." onClose={() => setEditor(null)}><form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label>Producto (opcional)<select value={String(editor.productId ?? "")} onChange={(e) => setEditor({ ...editor, productId: e.target.value })}><option value="">Conversión general</option>{state.products.filter((product) => product.active).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Unidad origen<select required value={String(editor.fromUnitId ?? "")} onChange={(e) => setEditor({ ...editor, fromUnitId: e.target.value })}><option value="">Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation} · {unit.name}</option>)}</select></label><label>Unidad destino<select required value={String(editor.toUnitId ?? "")} onChange={(e) => setEditor({ ...editor, toUnitId: e.target.value })}><option value="">Selecciona</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation} · {unit.name}</option>)}</select></label><label>Factor<input required type="number" min="0.000001" step="0.000001" value={Number(editor.factor ?? 1)} onChange={(e) => setEditor({ ...editor, factor: Number(e.target.value) })} /></label><label>Vigente desde<input required type="date" value={String(editor.validFrom ?? "")} onChange={(e) => setEditor({ ...editor, validFrom: e.target.value })} /></label><label>Vigente hasta<input type="date" value={String(editor.validTo ?? "")} onChange={(e) => setEditor({ ...editor, validTo: e.target.value })} /></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditor(null)}>Cancelar</button><button className="btn">Guardar conversión</button></div></form></Modal>}</section>;
}
