// realPct y esperadoPct van como fracción (0–1), no como puntos porcentuales.
export function delta(realPct: number, esperadoPct: number): number {
  return realPct - esperadoPct;
}
