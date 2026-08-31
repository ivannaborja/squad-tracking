export function esperadoPct(
  fechaReferencia: string,
  trimestre: { inicio: string; fin: string }
): number {
  const hoy = new Date(fechaReferencia);
  const inicio = new Date(trimestre.inicio);
  const fin = new Date(trimestre.fin);

  if (hoy < inicio) return 0;
  if (hoy >= fin) return 1;

  // Días CALENDARIO inclusivos, como los cuenta Dai en su planilla maestra: del
  // 1/7 al 28/8 son 59 días (ambos extremos cuentan), y el Q3 entero son 92
  // (1/7 al 30/9). 59/92 = 64%, que es el esperado con el que ella reporta.
  const transcurridos = diasCalendarioInclusive(inicio, hoy);
  const totales = diasCalendarioInclusive(inicio, fin);

  return Math.min(1, transcurridos / totales);
}

// Cuenta los días de calendario de `desde` a `hasta` con ambos extremos incluidos.
// UTC para que el cambio de horario de verano no corra la cuenta un día.
function diasCalendarioInclusive(desde: Date, hasta: Date): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA) + 1;
}
