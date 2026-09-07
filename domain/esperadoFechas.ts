const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Replica la fórmula de Smartsheet que usa fechas planificadas por fila: el avance
// esperado es la fracción de tiempo transcurrido entre inicio y fin. A diferencia
// de esperadoPct (que cuenta días inclusivos del trimestre), acá la resta NO suma
// +1, así que el propio día de inicio todavía marca 0 y el día de fin marca 1.
export function esperadoDesdeFechas(
  hoy: string,
  inicio: string | null,
  fin: string | null
): number | null {
  // Sin ambas fechas no hay tramo que medir; mejor devolver null que inventar un 0.
  if (!inicio || !fin) return null;

  const hoyMs = Date.parse(hoy);
  const inicioMs = Date.parse(inicio);
  const finMs = Date.parse(fin);

  // fin <= inicio dejaría el denominador en cero o negativo: no es un rango válido.
  if (finMs <= inicioMs) return null;

  if (hoyMs < inicioMs) return 0;

  // getTime en UTC (Date.parse de 'YYYY-MM-DD' es medianoche UTC) evita que el
  // cambio de horario de verano corra la cuenta medio día para un lado.
  const transcurridos = (hoyMs - inicioMs) / MS_POR_DIA;
  const totales = (finMs - inicioMs) / MS_POR_DIA;

  return Math.min(1, transcurridos / totales);
}
