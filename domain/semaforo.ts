import type { Risk, Semaforo } from './types';

// Va exportada aparte para que services/report reuse este chequeo en vez de
// reimplementarlo cuando lo necesite.
export function ingresosActivo(risk: Risk, fechaReferencia: string): boolean {
  if (risk.categoriaImpacto !== 'ingresos') return false;
  if (risk.resuelto) return false;

  const hoy = new Date(fechaReferencia);
  const inicio = new Date(risk.semanaInicio);
  const fin = new Date(risk.semanaFin);

  // Inclusive en los dos extremos: un riesgo cuenta también el primer y el
  // último día de su semana.
  return hoy >= inicio && hoy <= fin;
}

export function semaforo(
  deliveryDelta: number,
  risks: Risk[],
  fechaReferencia: string
): Semaforo {
  // Un riesgo de ingresos activo manda sobre el delta: rojo aunque el delivery
  // venga adelantado.
  if (risks.some((risk) => ingresosActivo(risk, fechaReferencia))) return 'rojo';
  if (deliveryDelta < 0) return 'amarillo';
  return 'verde';
}
