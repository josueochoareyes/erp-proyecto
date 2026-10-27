import type { Party, State } from "./model";
export type Supplier = Party;
export const rucCheckDigit = (base: string) =>
  (11 -
    ([5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce(
      (sum, w, i) => sum + Number(base[i]) * w,
      0,
    ) %
      11)) %
  10;
export const validRuc = (ruc: string) =>
  /^(10|15|16|17|20)\d{9}$/.test(ruc) &&
  rucCheckDigit(ruc.slice(0, 10)) === Number(ruc[10]);
export function supplierErrors(
  state: State,
  value: Supplier,
  originalId?: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const previous = state.suppliers.find((s) => s.id === originalId);
  if (!value.name.trim()) errors.name = "La razón social es obligatoria.";
  if (!/^\d{11}$/.test(value.taxId))
    errors.taxId = "El RUC debe contener exactamente 11 dígitos.";
  else if (
    !validRuc(value.taxId) &&
    (!previous || previous.taxId !== value.taxId)
  )
    errors.taxId = "El prefijo o dígito verificador del RUC no es válido.";
  if (!value.id.trim()) errors.id = "El código interno es obligatorio.";
  else if (!/^[A-Za-z0-9_-]+$/.test(value.id))
    errors.id = "Usa letras, números, guiones o guiones bajos.";
  else if (
    state.suppliers.some(
      (s) =>
        s.id !== originalId && s.id.toLowerCase() === value.id.toLowerCase(),
    )
  )
    errors.id = "Ya existe un proveedor con este código.";
  if (previous && value.id !== originalId)
    errors.id = "El código de un proveedor existente no puede cambiarse.";
  if (
    state.customers.some(
      (customer) => customer.id.toLowerCase() === value.id.trim().toLowerCase(),
    )
  )
    errors.id =
      "Este código ya identifica a un cliente. Usa un código de proveedor único.";
  if (
    state.suppliers.some((s) => s.id !== originalId && s.taxId === value.taxId)
  )
    errors.taxId = "Ya existe un proveedor con este RUC.";
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    errors.email = "Ingresa un correo electrónico válido.";
  if (
    value.estimatedDeliveryDays !== undefined &&
    (!Number.isFinite(value.estimatedDeliveryDays) ||
      value.estimatedDeliveryDays < 0 ||
      !Number.isInteger(value.estimatedDeliveryDays))
  )
    errors.estimatedDeliveryDays =
      "Ingresa un plazo entero de cero días o más.";
  if (
    value.registeredAt &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value.registeredAt) ||
      Number.isNaN(Date.parse(value.registeredAt)) ||
      new Date(value.registeredAt + "T12:00:00Z").toISOString().slice(0, 10) !==
        value.registeredAt)
  )
    errors.registeredAt = "Ingresa una fecha de registro válida.";
  return errors;
}
export function saveSupplier(
  state: State,
  value: Supplier,
  originalId?: string,
) {
  if (originalId && !state.suppliers.some((s) => s.id === originalId))
    throw Error("El proveedor ya no está disponible. Actualiza el directorio.");
  const normalized = {
    ...value,
    id: value.id.trim(),
    name: value.name.trim(),
    taxId: value.taxId.trim(),
    email: value.email.trim(),
    suppliedCategories: value.suppliedCategories
      ?.map((category) => category.trim())
      .filter(Boolean),
  };
  const errors = supplierErrors(state, normalized, originalId);
  if (Object.keys(errors).length) throw Error(Object.values(errors)[0]);
  const index = state.suppliers.findIndex((s) => s.id === originalId);
  if (index < 0) state.suppliers.push(normalized);
  else state.suppliers[index] = { ...state.suppliers[index], ...normalized };
  state.audit.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    action: index < 0 ? "Crear proveedor" : "Editar proveedor",
    record: `${normalized.id}: ${normalized.name}`,
  });
}
export type CatalogKind = "suppliers" | "customers" | "products" | "warehouses";
export function catalogHasLinks(state: State, kind: CatalogKind, id: string) {
  if (kind === "products")
    return (
      state.documents.some((d) => d.lines.some((l) => l.productId === id)) ||
      state.quotes.some((q) => q.lines.some((l) => l.productId === id)) ||
      state.movements.some((m) => m.productId === id) ||
      Object.values(state.stock[id] ?? {}).some((n) => n !== 0)
    );
  if (kind === "warehouses")
    return (
      state.documents.some((d) => d.warehouseId === id) ||
      state.quotes.some((q) => q.warehouseId === id) ||
      state.movements.some((m) => m.warehouseId === id) ||
      Object.values(state.stock).some((stock) => (stock[id] ?? 0) !== 0)
    );
  return (
    state.documents.some((d) => d.partyId === id) ||
    state.quotes.some((q) => q.partyId === id) ||
    state.movements.some((m) => m.partyId === id)
  );
}
export function deleteCatalogRecord(
  state: State,
  kind: CatalogKind,
  id: string,
): "deleted" | "deactivated" {
  const list = state[kind];
  const index = list.findIndex((r) => r.id === id);
  if (index < 0) throw Error("El registro ya no está disponible.");
  const record = list[index];
  const linked = catalogHasLinks(state, kind, id);
  if (linked) record.active = false;
  else {
    list.splice(index, 1);
    if (kind === "products") delete state.stock[id];
    if (kind === "warehouses")
      Object.values(state.stock).forEach((stock) => delete stock[id]);
  }
  state.audit.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    action: linked ? "Desactivar catálogo" : "Eliminar catálogo",
    record: `${kind}: ${id} · ${record.name}`,
  });
  return linked ? "deactivated" : "deleted";
}
export function supplierActivity(state: State, id: string) {
  const orders = state.documents
    .filter((d) => d.kind === "OC" && d.partyId === id)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.number.localeCompare(a.number),
    );
  const months = new Map<string, number>();
  const products = new Map<
    string,
    { id: string; name: string; quantity: number; amount: number; unit: string }
  >();
  orders.forEach((order) => {
    const month = order.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + order.total);
    order.lines.forEach((line) => {
      const product = state.products.find((p) => p.id === line.productId);
      const current = products.get(line.productId) ?? {
        id: line.productId,
        name: product?.name ?? line.productId,
        quantity: 0,
        amount: 0,
        unit: product?.unit ?? "",
      };
      current.quantity += line.quantity;
      current.amount += line.price * line.quantity;
      products.set(line.productId, current);
    });
  });
  return {
    orders,
    total: orders.reduce((sum, d) => sum + d.total, 0),
    last: orders[0]?.date,
    months: [...months].sort(([a], [b]) => a.localeCompare(b)),
    products: [...products.values()].sort((a, b) => b.amount - a.amount),
  };
}
export const nextSupplierCode = (state: State) => {
  let number = 1;
  while (
    state.suppliers.some(
      (s) => s.id.toLowerCase() === `pro-${String(number).padStart(3, "0")}`,
    )
  )
    number++;
  return `PRO-${String(number).padStart(3, "0")}`;
};


export function deleteCategory(state: State, category: string, replacement = "") {
  if (!state.categories.includes(category)) throw Error("La categoría ya no existe.");
  if (replacement === category || replacement && !state.categories.includes(replacement)) throw Error("Selecciona otra categoría disponible.");
  const master = state.masterCategories?.find((item) => item.name === category);
  const target = state.masterCategories?.find((item) => item.name === replacement);
  const hasLinks = state.products.some((item) => item.category === category || (master && item.categoryId === master.id))
    || !!state.masterCategories?.some((item) => master && item.parentId === master.id)
    || [...state.documents, ...state.quotes].some((item) => item.lines.some((line) => line.productSnapshot?.category === category))
    || !!state.suppliers.some((item) => item.suppliedCategories?.includes(category) || (master && item.suppliedCategories?.includes(master.id)));
  if (hasLinks) {
    if (master) master.active = false;
    else {
      state.masterCategories ??= [];
      state.masterCategories.push({ id: crypto.randomUUID(), code: `CAT-${crypto.randomUUID()}`, name: category, active: false });
    }
    state.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: "Desactivar categoría", record: category });
    return;
  }
  state.categories = state.categories.filter((name) => name !== category);
  for (const product of state.products) if (product.category === category || (master && product.categoryId === master.id)) {
    product.category = replacement;
    product.categoryId = target?.id;
  }
  if (master) {
    if (hasLinks) master.active = false;
    else state.masterCategories = state.masterCategories?.filter((item) => item.id !== master.id);
  }
  const deleted = state.deletedCategories ??= [];
  if (!deleted.includes(category)) deleted.push(category);
  state.audit.unshift({id: crypto.randomUUID(), date: new Date().toISOString(), action: "Eliminar categoría", record: `${category} → ${replacement || "Sin categoría"}`});
}
