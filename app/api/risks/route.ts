import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { errorJson } from '../../../lib/http';
import { recomputarSemaforoSquads } from '../../../services/report/reportService';

// Flujo 4: crea un riesgo y sus vínculos a squads. Un riesgo puede pegarle a
// varios a la vez. Crearlo recomputa (write-through) el color de cada squad
// vinculado y devuelve los que cambiaron.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const requeridos = ['descripcion', 'categoria_impacto', 'semana_inicio', 'semana_fin'];
  for (const campo of requeridos) {
    if (!body?.[campo]) return errorJson('bad_request', `falta ${campo}`, 400);
  }
  const squadIds: number[] = Array.isArray(body.squad_ids) ? body.squad_ids : [];

  const risk = await prisma.risk.create({
    data: {
      descripcion: body.descripcion,
      categoriaImpacto: body.categoria_impacto,
      severidad: body.severidad ?? '',
      dueno: body.dueno ?? body['dueño'] ?? '',
      accionProxima: body.accion_proxima ?? '',
      checkpoint: body.checkpoint ?? '',
      tipo: body.tipo ?? 'riesgo',
      semanaInicio: new Date(body.semana_inicio),
      semanaFin: new Date(body.semana_fin),
      resuelto: body.resuelto ?? false,
      squads: { create: squadIds.map((squadId) => ({ squadId })) },
    },
  });

  const afectados = await recomputarSemaforoSquads(squadIds);
  return NextResponse.json({ risk, squadsAfectados: afectados }, { status: 200 });
}
