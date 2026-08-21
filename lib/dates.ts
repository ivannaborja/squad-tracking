// El lunes de la semana que contiene la fecha. Sólo agrupa la fila a su semana
// (semana_inicio); la fecha de cálculo real es fecha_referencia.
export function inicioDeSemana(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 domingo … 6 sábado
  const aLunes = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + aLunes);
  return d.toISOString().slice(0, 10);
}

// El día "de hoy" en hora de Paraguay, no en UTC: un check-in cargado de noche
// (p. ej. 23:30 Asunción) ya cruzó la medianoche UTC y toISOString() lo fecharía
// al día siguiente, corriendo fecha_referencia/semana_inicio/trimestre cerca de
// un borde. Usamos la zona IANA, que ajusta sola el DST (Paraguay cambió reglas).
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());
}
