import type { Semaforo } from './types';

// El semáforo del squad. Hoy sólo depende del delta de delivery: 🟡 si atrasa
// respecto del esperado, 🟢 si llega o lo supera. El disparador de 🔴 (riesgo de
// ingresos activo) se retiró al pasar "Riesgos" a texto libre; la definición del
// rojo queda pendiente de revisar con Dai, así que no se rediseña acá.
export function semaforo(deliveryDelta: number): Semaforo {
  if (deliveryDelta < 0) return 'amarillo';
  return 'verde';
}
