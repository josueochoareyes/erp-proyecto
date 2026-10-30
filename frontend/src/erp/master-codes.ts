export function nextMasterCode(prefix: string, codes: Iterable<string | undefined>) {
  const used = new Set(Array.from(codes, (code) => String(code ?? "").trim().toUpperCase()));
  let sequence = 1;
  let code = `${prefix}-${String(sequence).padStart(3, "0")}`;
  while (used.has(code)) {
    sequence += 1;
    code = `${prefix}-${String(sequence).padStart(3, "0")}`;
  }
  return code;
}
