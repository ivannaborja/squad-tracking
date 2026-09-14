import { NextRequest, NextResponse } from 'next/server';
import { errorJson } from '../../../lib/http';
import { prisma } from '../../../lib/prisma';
import { procesarImport } from '../../../services/import/importService';
import { SmartsheetDataSource } from '../../../adapters/smartsheet/SmartsheetDataSource';

// Import del .xlsx real de Smartsheet (planilla jerárquica). Espejo fiel: una sola
// fase, sin conflictos ni edición manual — se escribe lo que trae la planilla. El
// CSV plano ya no alimenta el snapshot (no tiene el desglose de las 4 métricas del Q).
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file');
  const editadoPor = form.get('editado_por');
  // El usuario ya vio el aviso de "archivo más viejo" y decidió importar igual.
  const confirmar = form.get('confirmar') === 'true';

  if (!(file instanceof File)) return errorJson('bad_request', 'falta el archivo', 400);
  if (typeof editadoPor !== 'string' || !editadoPor) {
    return errorJson('bad_request', 'falta editado_por', 400);
  }

  const esXlsx =
    /\.xlsx$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!esXlsx) {
    return errorJson('invalid_import', 'el import requiere el export .xlsx de Smartsheet', 422);
  }

  // El adaptador se construye acá (parsea y puede fallar al construir); el servicio
  // de import trabaja sobre los datos ya resueltos.
  let source: SmartsheetDataSource;
  try {
    // El .xlsx trae los squads por nombre; se matchean contra los del sistema.
    const squads = await prisma.squad.findMany({ select: { id: true, nombre: true } });
    source = await SmartsheetDataSource.fromArrayBuffer(await file.arrayBuffer(), squads);
  } catch {
    return errorJson('invalid_import', 'el archivo no parsea o le faltan columnas', 422);
  }

  const resultado = await procesarImport(source, editadoPor, { confirmar });
  if (resultado.status === 'invalid') {
    return errorJson('invalid_import', 'el archivo no parsea o le faltan columnas', 422);
  }
  // Archivo más viejo que el último import: 409 con las dos fechas en el mensaje.
  // El front lo reconoce por el código y ofrece "Importar igual" (reenvía confirmar=true).
  if (resultado.status === 'stale') {
    const dia = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return errorJson(
      'stale_file',
      `Este archivo es del ${dia(resultado.archivoCreado)}, más viejo que el último import (${dia(resultado.ultimoImport)}). ¿Importar igual?`,
      409
    );
  }
  return NextResponse.json(resultado, { status: 200 });
}
