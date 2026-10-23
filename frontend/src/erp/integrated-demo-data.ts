import { ensureMasterData } from "./master-migrations.ts";
import { createDocument, invoice, receive, today, type State } from "./model.ts";

const demoCases = [
  {
    brand: { id: "MAR-DEMO-001", name: "PackFlex", countryOfOrigin: "Perú" },
    product: { id: "PRD-DEMO-001", name: "Film stretch industrial 50 cm", category: "Embalaje", unit: "ROL", cost: 12, price: 19, minimum: 20, description: "Film extensible para protección de carga." },
    customer: { id: "CLI-DEMO-001", name: "Armonía Distribuciones S.A.C.", taxId: "20609900011", contact: "Camila Ríos", district: "Surquillo" },
    supplier: { id: "PRO-DEMO-001", name: "Novalina Polímeros S.A.C.", taxId: "20609900111", contact: "Valeria Montes", category: "Materia prima" },
    transporter: { id: "TRA-DEMO-001", document: "20609901011", legalName: "Logística Lima Norte", phone: "900100001" },
    seller: { id: "VEN-DEMO-001", code: "VEN-001", name: "Camila Ríos", commissionPct: 2.5, monthlyTarget: 25000 },
    zone: { id: "ZON-DEMO-001", code: "ZON-001", name: "Lima Norte", route: "Ruta industrial norte" },
    conversion: { id: "CON-DEMO-001", fromUnit: "ROL", toUnit: "UND", factor: 60 },
  },
  {
    brand: { id: "MAR-DEMO-002", name: "PolyShield", countryOfOrigin: "Perú" },
    product: { id: "PRD-DEMO-002", name: "Bolsa PE alta resistencia 20 L", category: "Bolsas", unit: "UND", cost: 1.2, price: 2.4, minimum: 40, description: "Bolsa de polietileno para embalaje industrial." },
    customer: { id: "CLI-DEMO-002", name: "Vértice Abastecimientos E.I.R.L.", taxId: "20609900022", contact: "Mateo Vera", district: "San Miguel" },
    supplier: { id: "PRO-DEMO-002", name: "Altacima Resinas Industriales S.A.C.", taxId: "20609900122", contact: "Diego Salcedo", category: "Resinas" },
    transporter: { id: "TRA-DEMO-002", document: "20609901022", legalName: "Carga Segura del Pacífico", phone: "900100002" },
    seller: { id: "VEN-DEMO-002", code: "VEN-002", name: "Mateo Vera", commissionPct: 3, monthlyTarget: 30000 },
    zone: { id: "ZON-DEMO-002", code: "ZON-002", name: "Lima Centro", route: "Ruta comercial centro" },
    conversion: { id: "CON-DEMO-002", fromUnit: "UND", toUnit: "PAQ", factor: 50 },
  },
  {
    brand: { id: "MAR-DEMO-003", name: "ResinPro", countryOfOrigin: "Colombia" },
    product: { id: "PRD-DEMO-003", name: "Resina PEBD natural", category: "Materia prima", unit: "KG", cost: 5.8, price: 9.5, minimum: 30, description: "Resina para fabricación de envases y bolsas." },
    customer: { id: "CLI-DEMO-003", name: "Brisalia Comercio Industrial S.A.C.", taxId: "20609900033", contact: "Elena Campos", district: "Ate" },
    supplier: { id: "PRO-DEMO-003", name: "Lumetra Embalajes E.I.R.L.", taxId: "20609900133", contact: "Lucía Prado", category: "Embalaje" },
    transporter: { id: "TRA-DEMO-003", document: "20609901033", legalName: "Transporte Andino Sur", phone: "900100003" },
    seller: { id: "VEN-DEMO-003", code: "VEN-003", name: "Elena Campos", commissionPct: 2, monthlyTarget: 22000 },
    zone: { id: "ZON-DEMO-003", code: "ZON-003", name: "Lima Este", route: "Ruta manufactura este" },
    conversion: { id: "CON-DEMO-003", fromUnit: "KG", toUnit: "BLS", factor: 25 },
  },
  {
    brand: { id: "MAR-DEMO-004", name: "PVCentral", countryOfOrigin: "Perú" },
    product: { id: "PRD-DEMO-004", name: "Codo PVC 90° de 1 pulgada", category: "PVC", unit: "UND", cost: 2.5, price: 4.8, minimum: 25, description: "Conexión de PVC para instalaciones hidráulicas." },
    customer: { id: "CLI-DEMO-004", name: "Nexora Suministros S.A.C.", taxId: "20609900044", contact: "Nicolás Lara", district: "Comas" },
    supplier: { id: "PRO-DEMO-004", name: "Conexiones del Valle S.A.C.", taxId: "20609900144", contact: "Paolo Cárdenas", category: "PVC" },
    transporter: { id: "TRA-DEMO-004", document: "20609901044", legalName: "Distribución Metropolitana", phone: "900100004" },
    seller: { id: "VEN-DEMO-004", code: "VEN-004", name: "Nicolás Lara", commissionPct: 2.75, monthlyTarget: 28000 },
    zone: { id: "ZON-DEMO-004", code: "ZON-004", name: "Lima Sur", route: "Ruta industrial sur" },
    conversion: { id: "CON-DEMO-004", fromUnit: "UND", toUnit: "CJA", factor: 24 },
  },
  {
    brand: { id: "MAR-DEMO-005", name: "Envaplus", countryOfOrigin: "Perú" },
    product: { id: "PRD-DEMO-005", name: "Balde industrial 20 L", category: "Envases", unit: "UND", cost: 8, price: 13.5, minimum: 15, description: "Envase de polietileno para almacenamiento industrial." },
    customer: { id: "CLI-DEMO-005", name: "Delta Comercial S.A.C.", taxId: "20609900055", contact: "Andrea Salas", district: "Miraflores" },
    supplier: { id: "PRO-DEMO-005", name: "Packline Soluciones E.I.R.L.", taxId: "20609900155", contact: "Sofía Valdivia", category: "Embalaje" },
    transporter: { id: "TRA-DEMO-005", document: "20609901055", legalName: "Envíos Industriales Lima", phone: "900100005" },
    seller: { id: "VEN-DEMO-005", code: "VEN-005", name: "Andrea Salas", commissionPct: 3.25, monthlyTarget: 32000 },
    zone: { id: "ZON-DEMO-005", code: "ZON-005", name: "Lima Surco", route: "Ruta comercial sur" },
    conversion: { id: "CON-DEMO-005", fromUnit: "UND", toUnit: "CJA", factor: 12 },
  },
] as const;

function addIfMissing<T extends { id: string }>(list: T[], record: T) {
  if (list.some((item) => item.id === record.id)) return false;
  list.push(record);
  return true;
}

function dateOffset(offset: number) {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

export type IntegratedDemoResult = {
  sets: number;
  created: boolean;
  products: number;
  purchaseOrders: number;
  salesInvoices: number;
};

function migrateReceivablesToCurrentDemo(state: State) {
  state.documents
    .filter((document) =>
      document.kind === "CP" &&
      document.lines.some((line) => line.productId.startsWith("PRD-DEMO-")),
    )
    .forEach((document) => {
      document.method = "Crédito 30 días";
      document.commercialTerms = "Crédito 30 días";
    });
}

/**
 * Creates five connected scenarios for local demonstration.
 * It intentionally does not mark documents as `demo`, because those records
 * must remain after a reload and be usable by the rest of the ERP.
 */
export function seedIntegratedDemoData(state: State): IntegratedDemoResult {
  if (state.integratedDemoVersion === 2)
    return { sets: demoCases.length, created: false, products: 5, purchaseOrders: 5, salesInvoices: 5 };

  if (state.integratedDemoVersion === 1) {
    migrateReceivablesToCurrentDemo(state);
    state.customers
      .filter((customer) => customer.id.startsWith("CLI-DEMO-"))
      .forEach((customer) => { customer.paymentTerms = "Crédito 30 días"; });
    state.integratedDemoVersion = 2;
    state.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: "Actualizar datos simulados", record: "Cartera vigente a 30 días" });
    return { sets: demoCases.length, created: false, products: 5, purchaseOrders: 5, salesInvoices: 5 };
  }

  ensureMasterData(state);
  state.brands ??= [];
  state.transporters ??= [];
  state.sellers ??= [];
  state.zones ??= [];
  state.unitConversions ??= [];
  state.priceListItems ??= [];
  state.stock ??= {};

  const priceList = state.priceLists?.find((list) => list.code === "BASE-PEN") ?? state.priceLists?.[0];
  const warehouse = state.warehouses.find((item) => item.active);
  if (!priceList || !warehouse) throw Error("Configura una lista de precios y un almacén activo antes de cargar la demo.");

  demoCases.forEach((item, index) => {
    const category = state.masterCategories?.find((entry) => entry.name === item.product.category);
    const unit = state.units?.find((entry) => entry.code === item.product.unit);
    const fromUnit = state.units?.find((entry) => entry.code === item.conversion.fromUnit);
    const toUnit = state.units?.find((entry) => entry.code === item.conversion.toUnit);
    const date = dateOffset(4 - index);

    addIfMissing(state.brands!, { ...item.brand, code: item.brand.id, active: true });
    addIfMissing(state.zones!, { ...item.zone, sellerId: item.seller.id, active: true });
    addIfMissing(state.sellers!, { ...item.seller, zoneId: item.zone.id, active: true });
    addIfMissing(state.transporters!, { ...item.transporter, contact: "Coordinación logística", email: `operaciones${index + 1}@transporte-demo.example`, active: true });
    addIfMissing(state.unitConversions!, { id: item.conversion.id, productId: item.product.id, fromUnitId: fromUnit?.id ?? item.conversion.fromUnit, toUnitId: toUnit?.id ?? item.conversion.toUnit, factor: item.conversion.factor, validFrom: date, active: true });

    addIfMissing(state.products, {
      ...item.product,
      active: true,
      sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
      registeredAt: date,
      categoryId: category?.id,
      brandId: item.brand.id,
      unitId: unit?.id ?? item.product.unit,
    });
    state.stock[item.product.id] = { [warehouse.id]: 0 };
    addIfMissing(state.priceListItems!, { id: `PLI-DEMO-${String(index + 1).padStart(3, "0")}`, priceListId: priceList.id, productId: item.product.id, minQuantity: 1, price: item.product.price, active: true });

    addIfMissing(state.customers, {
      ...item.customer,
      email: `compras${index + 1}@cliente-demo.example`,
      phone: `90020000${index + 1}`,
      address: `Av. Comercio ${120 + index * 30}, Lima`,
      credit: 25000,
      active: true,
      tradeName: item.customer.name.split(" ")[0],
      category: "Comercial",
      province: "Lima",
      department: "Lima",
      paymentTerms: "Crédito 30 días",
      currency: priceList.currencyId,
      zoneId: item.zone.id,
      sellerId: item.seller.id,
      priceListId: priceList.id,
      registeredAt: date,
    });
    addIfMissing(state.suppliers, {
      ...item.supplier,
      email: `ventas${index + 1}@proveedor-demo.example`,
      phone: `90030000${index + 1}`,
      address: `Av. Industrial ${220 + index * 30}, Lima`,
      credit: 25000,
      active: true,
      tradeName: item.supplier.name.split(" ")[0],
      supplierType: "Distribuidor nacional",
      paymentTerms: "Crédito 30 días",
      currency: priceList.currencyId,
      suppliedCategories: [item.supplier.category],
      estimatedDeliveryDays: 3 + index,
      registeredAt: date,
    });

    const quantity = 40 + index * 5;
    const purchase = createDocument(state, {
      kind: "OC",
      date,
      partyId: item.supplier.id,
      warehouseId: warehouse.id,
      method: "Crédito 30 días",
      voucher: "Orden de compra",
      lines: [{ productId: item.product.id, quantity, price: item.product.cost }],
      discount: 0,
      freight: 0,
      notes: "Registro simulado para validar compras e inventario.",
      currency: priceList.currencyId,
    });
    receive(state, purchase.id, { [item.product.id]: quantity }, warehouse.id, date);

    const sale = createDocument(state, {
      kind: "OV",
      date,
      partyId: item.customer.id,
      warehouseId: warehouse.id,
      method: "Crédito 30 días",
      voucher: "Pedido de venta",
      lines: [{ productId: item.product.id, quantity: 5, price: item.product.price }],
      discount: 0,
      freight: 0,
      notes: "Registro simulado para validar ventas y cobranzas.",
      currency: priceList.currencyId,
    });
    invoice(state, sale.id, "Factura electrónica", date);
  });

  state.integratedDemoVersion = 2;
  state.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: "Cargar datos simulados", record: "5 escenarios conectados" });
  return { sets: demoCases.length, created: true, products: 5, purchaseOrders: 5, salesInvoices: 5 };
}
