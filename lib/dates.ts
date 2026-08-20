// El lunes de la semana que contiene la fecha. Sólo agrupa la fila a su semana
// (semana_inicio); la fecha de cálculo real es fecha_referencia.
export function inicioDeSemana(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 domingo … 6 sábado
  const aLunes = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + aLunes);
  return d.toISOString().slice(0, 10);
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
