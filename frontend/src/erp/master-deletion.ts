import type { State } from "./model";

export type MasterKind = "companies" | "branches" | "brands" | "units" | "unitConversions" | "transporters" | "sellers" | "zones" | "currencies" | "exchangeRates" | "taxes" | "paymentMethods" | "priceLists" | "priceListItems";
export type DeletionPolicy = { action: "delete" | "deactivate" | "blocked"; reason: string };

export function masterDeletionPolicy(state: State, kind: MasterKind, id: string): DeletionPolicy {
  const record = state[kind]?.find((item) => item.id === id);
  if (!record) return { action: "blocked", reason: "El registro ya no está disponible." };
  const parties = [...state.customers, ...state.suppliers];
  const operations = [...state.documents, ...state.quotes];
  // Snapshots keep commercial assignments even after the current client is edited.
  const snapshots = operations.flatMap((item) => item.customerSnapshot ? [item.customerSnapshot] : []);
  const allParties = [...parties, ...snapshots];
  let linked = false;
  let defaultRecord = false;
  switch (kind) {
    case "companies": {
      if (state.companies?.[0]?.id === id) return { action: "blocked", reason: "Esta es la empresa principal de la operación. No se puede eliminar ni desactivar desde esta acción." };
      linked = !!state.branches?.some((item) => item.companyId === id);
      break;
    }
    case "branches": {
      const branch = state.branches!.find((item) => item.id === id)!;
      linked = state.warehouses.some((item) => item.branchId === id || item.branch === branch.name);
      break;
    }
    case "brands": linked = state.products.some((item) => item.brandId === id); break;
    case "units": {
      const unit = state.units!.find((item) => item.id === id)!;
      linked = state.products.some((item) => item.unitId === id || item.unit === unit.code)
        || !!state.unitConversions?.some((item) => item.fromUnitId === id || item.toUnitId === id)
        || operations.some((item) => item.lines.some((line) => line.productSnapshot?.unit === unit.code));
      defaultRecord = unit.code.toUpperCase() === "UND";
      break;
    }
    case "sellers": linked = allParties.some((item) => item.sellerId === id) || !!state.zones?.some((item) => item.sellerId === id); break;
    case "zones": linked = allParties.some((item) => item.zoneId === id) || !!state.sellers?.some((item) => item.zoneId === id); break;
    case "currencies": {
      const currency = state.currencies!.find((item) => item.id === id)!;
      if (currency.isoCode === state.settings.currency || state.companies?.some((item) => item.baseCurrency === currency.isoCode))
        return { action: "blocked", reason: "Esta moneda es la moneda base de una empresa. Cambia esa configuración antes de eliminarla o desactivarla." };
      linked = allParties.some((item) => item.currency === currency.isoCode || item.currency === id)
        || operations.some((item) => item.currency === currency.isoCode || item.currency === id)
        || !!state.priceLists?.some((item) => item.currencyId === id)
        || !!state.exchangeRates?.some((item) => item.currencyId === id);
      defaultRecord = ["PEN", "USD", "EUR"].includes(currency.isoCode);
      break;
    }
    case "exchangeRates": {
      const rate = state.exchangeRates!.find((item) => item.id === id)!;
      const iso = state.currencies?.find((item) => item.id === rate.currencyId)?.isoCode;
      linked = operations.some((item) => (item.currency === rate.currencyId || (!!iso && item.currency === iso)) && item.date === rate.date);
      break;
    }
    case "taxes": defaultRecord = id === "IGV18"; break;
    case "paymentMethods": {
      const method = state.paymentMethods!.find((item) => item.id === id)!;
      linked = allParties.some((item) => item.paymentTerms === method.name)
        || operations.some((item) => item.method === method.name || item.commercialTerms === method.name)
        || state.documents.some((item) => item.payments.some((payment) => payment.method === method.name))
        || !!state.payables?.some((item) => item.payments.some((payment) => payment.method === method.name));
      defaultRecord = ["CONTADO", "TRANSFERENCIA", "CREDITO-30", "CREDITO-60"].includes(id);
      break;
    }
    case "priceLists":
      linked = allParties.some((item) => item.priceListId === id) || !!state.priceListItems?.some((item) => item.priceListId === id);
      defaultRecord = state.priceLists?.find((item) => item.id === id)?.code === "BASE-PEN";
      break;
    case "priceListItems": {
      const item = state.priceListItems!.find((item) => item.id === id)!;
      linked = allParties.some((party) => party.priceListId === item.priceListId);
      break;
    }
    // Transport and conversions have no operational references in the current model.
    case "transporters": case "unitConversions": break;
  }
  return linked ? { action: "deactivate", reason: "El registro tiene relaciones o historial. Se conservará su información y se marcará como inactivo." }
    : defaultRecord ? { action: "deactivate", reason: "Es un registro base del sistema. Se conservará su información y se marcará como inactivo." }
    : { action: "delete", reason: "El registro no tiene vínculos. Se eliminará definitivamente después de confirmar." };
}

export function deleteMasterRecord(state: State, kind: MasterKind, id: string) {
  const policy = masterDeletionPolicy(state, kind, id);
  if (policy.action === "blocked") throw Error(policy.reason);
  const list = state[kind]!;
  const index = list.findIndex((item) => item.id === id);
  const record = list[index];
  if (policy.action === "deactivate") record.active = false;
  else list.splice(index, 1);
  state.audit.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), action: policy.action === "delete" ? "Eliminar maestro" : "Desactivar maestro", record: `${kind}: ${id}` });
  return policy.action;
}
