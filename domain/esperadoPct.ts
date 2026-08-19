export function esperadoPct(
  fechaReferencia: string,
  trimestre: { inicio: string; fin: string }
): number {
  const hoy = new Date(fechaReferencia);
  const inicio = new Date(trimestre.inicio);
  const fin = new Date(trimestre.fin);

  if (hoy < inicio) return 0;
  if (hoy >= fin) return 1;

  const diasHabilesTranscurridos = contarDiasHabiles(inicio, hoy);
  const diasHabilesTotales = contarDiasHabiles(inicio, fin);

  return Math.min(1, diasHabilesTranscurridos / diasHabilesTotales);
}

function contarDiasHabiles(desde: Date, hasta: Date): number {
  let contador = 0;
  const actual = new Date(desde);
  while (actual < hasta) {
    const diaSemana = actual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) contador++;
    actual.setDate(actual.getDate() + 1);
  }
  return contador;
}