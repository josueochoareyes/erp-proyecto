import type { CommissionRule, State } from "./model";

let sequence = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const log = (state: State, action: string, record: string) => state.audit.unshift({ id: id("AUD"), date: new Date().toISOString(), action, record });
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function ensureCommissionData(state: State) {
  let changed = false;
  (["commissionRules", "generatedCommissions", "commissionAdjustments", "commissionSettlements"] as const).forEach((key) => {
    if (!Array.isArray(state[key])) { (state[key] as unknown) = []; changed = true; }
  });
  return changed;
}

export function saveCommissionRule(state: State, input: Omit<CommissionRule, "id">, ruleId?: string) {
  ensureCommissionData(state);
  if (!input.code.trim() || !input.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom) || (input.validTo && input.validTo < input.validFrom) || !Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage > 100) throw Error("Revisa el código, vigencia y porcentaje de la regla.");
  if (state.commissionRules!.some((rule) => rule.id !== ruleId && rule.code.toLowerCase() === input.code.trim().toLowerCase())) throw Error("El código de regla ya existe.");
  const rule: CommissionRule = { ...input, id: ruleId ?? id("RCO"), code: input.code.trim().toUpperCase(), name: input.name.trim() };
  const index = state.commissionRules!.findIndex((item) => item.id === ruleId);
  if (index >= 0) state.commissionRules![index] = rule; else state.commissionRules!.unshift(rule);
  log(state, index >= 0 ? "Editar regla de comisión" : "Crear regla de comisión", `${rule.code} · ${rule.name}`); return rule;
}

function netInvoiceAmount(total: number) { return round(total / 1.18); }
export function generateCommission(state: State, invoiceId: string, sellerId?: string) {
  ensureCommissionData(state);
  const invoice = state.documents.find((document) => document.id === invoiceId && document.kind === "CP");
  const order = invoice && state.documents.find((document) => document.id === invoice.sourceId && document.kind === "OV");
  const resolvedSeller = sellerId ?? invoice?.sellerId ?? order?.sellerId ?? state.customers.find((customer) => customer.id === invoice?.partyId)?.sellerId;
  if (!invoice || !resolvedSeller || !state.sellers?.some((seller) => seller.id === resolvedSeller && seller.active)) throw Error("El comprobante debe tener un vendedor activo asignado.");
  if (state.generatedCommissions!.some((commission) => commission.invoiceId === invoiceId)) throw Error("El comprobante ya tiene una comisión generada.");
  const rule = state.commissionRules!.find((item) => item.active && item.validFrom <= invoice.date && (!item.validTo || item.validTo >= invoice.date));
  if (!rule) throw Error("No hay una regla de comisión vigente para la fecha del comprobante.");
  const movements = state.movements.filter((movement) => movement.documentId === invoice.id && movement.type === "Salida");
  const base = rule.basis === "Facturado neto" ? netInvoiceAmount(invoice.total) : rule.basis === "Cobrado neto" ? netInvoiceAmount(invoice.total - invoice.balance) : round(netInvoiceAmount(invoice.total) - movements.reduce((sum, movement) => sum + movement.quantity * movement.cost, 0));
  if (base < 0) throw Error("La base de comisión no puede ser negativa.");
  const commission = { id: id("COM"), invoiceId, sellerId: resolvedSeller, ruleId: rule.id, date: invoice.date, basisAmount: base, percentage: rule.percentage, amount: round(base * rule.percentage / 100), status: "Generada" as const };
  state.generatedCommissions!.unshift(commission); log(state, "Generar comisión", `${invoice.number} · ${commission.amount}`); return commission;
}

export function addCommissionAdjustment(state: State, commissionId: string, reason: string, amount: number, approver: string) {
  const commission = state.generatedCommissions?.find((item) => item.id === commissionId);
  if (!commission || commission.status !== "Generada" || !reason.trim() || !approver.trim() || !Number.isFinite(amount) || amount === 0) throw Error("El ajuste debe referirse a una comisión vigente, con motivo, aprobador e importe distinto de cero.");
  const adjustment = { id: id("AJC"), commissionId, reason: reason.trim(), amount: round(amount), approver: approver.trim(), status: "Aprobado" as const };
  state.commissionAdjustments!.unshift(adjustment); log(state, "Ajustar comisión", commissionId); return adjustment;
}

export function settleCommissions(state: State, sellerId: string, period: string, responsible: string) {
  if (!/^\d{4}-\d{2}$/.test(period) || !responsible.trim()) throw Error("Selecciona un período y responsable válidos.");
  if (state.commissionSettlements?.some((settlement) => settlement.sellerId === sellerId && settlement.period === period)) throw Error("El vendedor ya tiene una liquidación en ese período.");
  const commissions = state.generatedCommissions!.filter((commission) => commission.sellerId === sellerId && commission.status === "Generada" && commission.date.startsWith(period));
  if (!commissions.length) throw Error("No hay comisiones generadas para liquidar.");
  const ids = commissions.map((commission) => commission.id); const grossAmount = round(commissions.reduce((sum, commission) => sum + commission.amount, 0));
  const adjustments = round(state.commissionAdjustments!.filter((adjustment) => adjustment.status === "Aprobado" && ids.includes(adjustment.commissionId)).reduce((sum, adjustment) => sum + adjustment.amount, 0));
  const settlement = { id: id("LCO"), sellerId, period, commissionIds: ids, grossAmount, adjustments, netAmount: round(grossAmount + adjustments), responsible: responsible.trim(), status: "Aprobada" as const };
  state.commissionSettlements!.unshift(settlement); commissions.forEach((commission) => { commission.status = "Liquidada"; }); log(state, "Liquidar comisiones", `${period} · ${sellerId}`); return settlement;
}
