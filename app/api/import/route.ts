import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '../../../lib/http';
import { procesarImport } from '../../../services/import/importService';

// Fase 1 del import (Flujo 3): sube el CSV, detecta conflictos por campo y decide
// entre aplicar directo, pedir confirmación (sin escribir nada), o rechazar el
// archivo. La escritura con conflictos vive sólo en la fase 2.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file');
  const editadoPor = form.get('editado_por');

  if (!(file instanceof File)) return errorJson('bad_request', 'falta el archivo CSV', 400);
  if (typeof editadoPor !== 'string' || !editadoPor) {
    return errorJson('bad_request', 'falta editado_por', 400);
  }

  const resultado = await procesarImport(await file.text(), editadoPor);

  if (resultado.status === 'invalid_csv') {
    return errorJson('invalid_csv', 'el CSV no parsea o le faltan columnas', 422);
  }
  return NextResponse.json(resultado, { status: 200 });
}
