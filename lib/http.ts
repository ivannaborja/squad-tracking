import { NextResponse } from 'next/server';

// Forma de error única del contrato (api.md): { error: { code, message } }.
export function errorJson(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Los calculados son de sólo lectura: si el cliente los manda en el body se
// ignoran (api.md). Esta lista es la que los handlers de escritura descartan.
export const CAMPOS_CALCULADOS = [
  'esperado_pct',
  'delivery_delta_pct',
  'discovery_delta_pct',
  'semaforo',
] as const;
