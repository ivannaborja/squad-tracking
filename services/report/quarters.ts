// El snapshot guarda el trimestre como etiqueta ("Q3-2026"), pero recalcular el
// esperado "a hoy" necesita las fechas de arranque y cierre del Q. Deriva los
// límites del trimestre calendario a partir del label.
//
// PENDIENTE (decisión con impacto a futuro, anotada para la usuaria): esto asume
// trimestre calendario. Si la empresa usa trimestres fiscales corridos, hay que
// mover esto a un config explícito o a una tabla Trimestre en la DB.
export interface Trimestre {
  inicio: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD, último día del Q
}

export function resolverTrimestre(label: string): Trimestre {
  const m = /^Q([1-4])-(\d{4})$/.exec(label.trim());
  if (!m) throw new Error(`trimestre con formato inesperado: "${label}"`);

  const q = Number(m[1]);
  const year = Number(m[2]);
  const primerMes = (q - 1) * 3; // 0-based: Q1→0, Q3→6
  const inicio = new Date(Date.UTC(year, primerMes, 1));
  const fin = new Date(Date.UTC(year, primerMes + 3, 0)); // día 0 del mes siguiente = último del Q

  return { inicio: iso(inicio), fin: iso(fin) };
}

// Qué trimestre calendario contiene una fecha. Se usa cuando un squad todavía no
// tiene snapshot: el "a hoy" igual muestra el esperado del Q en curso.
export function trimestreDeFecha(fecha: string): string {
  const d = new Date(fecha);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q}-${d.getUTCFullYear()}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
