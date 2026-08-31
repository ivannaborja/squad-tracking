import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '../../../lib/http';
import { prisma } from '../../../lib/prisma';
import { procesarImport } from '../../../services/import/importService';
import { CsvDataSource } from '../../../adapters/csv/CsvDataSource';
import { SmartsheetDataSource } from '../../../adapters/smartsheet/SmartsheetDataSource';
import type { DataSource } from '../../../ports/DataSource';

// Fase 1 del import (Flujo 3): sube el archivo, detecta conflictos por campo y
// decide entre aplicar directo, pedir confirmación (sin escribir nada), o rechazar.
// Rutea por tipo de archivo: CSV plano (reprocesado) o el .xlsx real de Smartsheet
// (planilla jerárquica). La escritura con conflictos vive sólo en la fase 2.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file');
  const editadoPor = form.get('editado_por');

  if (!(file instanceof File)) return errorJson('bad_request', 'falta el archivo', 400);
  if (typeof editadoPor !== 'string' || !editadoPor) {
    return errorJson('bad_request', 'falta editado_por', 400);
  }

  const esXlsx =
    /\.xlsx$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // El adaptador se construye acá (la construcción es donde parsea y puede fallar);
  // el servicio de import ya es agnóstico de la fuente.
  let source: DataSource;
  try {
    if (esXlsx) {
      // El .xlsx trae los squads por nombre; se matchean contra los del sistema.
      const squads = await prisma.squad.findMany({ select: { id: true, nombre: true } });
      source = await SmartsheetDataSource.fromArrayBuffer(await file.arrayBuffer(), squads);
    } else {
      source = new CsvDataSource(await file.text());
    }
  } catch {
    return errorJson('invalid_import', 'el archivo no parsea o le faltan columnas', 422);
  }

  const resultado = await procesarImport(source, editadoPor);
  if (resultado.status === 'invalid') {
    return errorJson('invalid_import', 'el archivo no parsea o le faltan columnas', 422);
  }
  return NextResponse.json(resultado, { status: 200 });
}
