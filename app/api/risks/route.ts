import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { errorJson } from '../../../lib/http';
import { recomputarSemaforoSquads } from '../../../services/report/reportService';

// Flujo 4: crea un riesgo y sus vínculos a squads. Un riesgo puede pegarle a
// varios a la vez. Crearlo recomputa (write-through) el color de cada squad
// vinculado y devuelve los que cambiaron.
export async function POST(request: NextRequest) {
  const body = await request.json();
  // El SDD documenta todos estos como parte del body del riesgo; exigirlos evita
  // crear riesgos sin dueño ni acción próxima y perder trazabilidad.
  const requeridos = [
    'descripcion',
    'categoria_impacto',
    'severidad',
    'tipo',
    'accion_proxima',
    'checkpoint',
    'semana_inicio',
    'semana_fin',
  ];
  for (const campo of requeridos) {
    if (!body?.[campo]) return errorJson('bad_request', `falta ${campo}`, 400);
  }
  const dueno = body.dueno ?? body['dueño'];
  if (!dueno) return errorJson('bad_request', 'falta dueño', 400);
  if (!Array.isArray(body.squad_ids) || body.squad_ids.length === 0) {
    return errorJson('bad_request', 'falta squad_ids', 400);
  }
  const squadIds: number[] = body.squad_ids;

  const risk = await prisma.risk.create({
    data: {
      descripcion: body.descripcion,
      categoriaImpacto: body.categoria_impacto,
      severidad: body.severidad,
      dueno,
      accionProxima: body.accion_proxima,
      checkpoint: body.checkpoint,
      tipo: body.tipo,
      semanaInicio: new Date(body.semana_inicio),
      semanaFin: new Date(body.semana_fin),
      resuelto: body.resuelto ?? false,
      squads: { create: squadIds.map((squadId) => ({ squadId })) },
    },
  });

  const afectados = await recomputarSemaforoSquads(squadIds);
  return NextResponse.json({ risk, squadsAfectados: afectados }, { status: 200 });
}
