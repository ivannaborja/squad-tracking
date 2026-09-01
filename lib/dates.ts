// El lunes de la semana que contiene la fecha. Sólo agrupa la fila a su semana
// (semana_inicio); la fecha de cálculo real es fecha_referencia.
export function inicioDeSemana(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 domingo … 6 sábado
  const aLunes = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + aLunes);
  return d.toISOString().slice(0, 10);
}

// Rango legible lunes–viernes de una semana, en español y sin año, como lo lee
// Dai en la cabecera del informe. El viernes es el lunes + 4 días calendario.
// Mismo mes: "14 al 18 de agosto". Distinto mes: "31 de agosto al 4 de septiembre".
export function semanaRangoLabel(inicio: string): string {
  const lunes = new Date(inicio + 'T00:00:00Z');
  const viernes = new Date(lunes);
  viernes.setUTCDate(viernes.getUTCDate() + 4);

  const mes = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' });
  const dL = lunes.getUTCDate();
  const dV = viernes.getUTCDate();
  const mesL = mes.format(lunes);
  const mesV = mes.format(viernes);

  return mesL === mesV ? `${dL} al ${dV} de ${mesV}` : `${dL} de ${mesL} al ${dV} de ${mesV}`;
}

// El día "de hoy" en hora de Paraguay, no en UTC: un check-in cargado de noche
// (p. ej. 23:30 Asunción) ya cruzó la medianoche UTC y toISOString() lo fecharía
// al día siguiente, corriendo fecha_referencia/semana_inicio/trimestre cerca de
// un borde. Usamos la zona IANA, que ajusta sola el DST (Paraguay cambió reglas).
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date());
}
