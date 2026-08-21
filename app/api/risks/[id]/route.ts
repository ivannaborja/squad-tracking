import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { errorJson } from '../../../../lib/http';
import { recomputarSemaforoSquads } from '../../../../services/report/reportService';

// Flujo 4: edita un riesgo, incluye resolverlo y reasignar squads. Recomputa el
// color de todos los afectados —los de antes y los de ahora— porque soltar un
// vínculo también puede cambiar un color (un riesgo que deja de aplicar).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return errorJson('bad_request', 'id inválido', 400);

  const existente = await prisma.risk.findUnique({ where: { id }, include: { squads: true } });
  if (!existente) return errorJson('not_found', 'riesgo inexistente', 404);

  const body = await request.json();
  const squadsPrevios = existente.squads.map((s) => s.squadId);

  const data: Record<string, unknown> = {};
  if (body.descripcion !== undefined) data.descripcion = body.descripcion;
  if (body.categoria_impacto !== undefined) data.categoriaImpacto = body.categoria_impacto;
  if (body.severidad !== undefined) data.severidad = body.severidad;
  if (body.dueno !== undefined || body['dueño'] !== undefined) data.dueno = body.dueno ?? body['dueño'];
  if (body.accion_proxima !== undefined) data.accionProxima = body.accion_proxima;
  if (body.checkpoint !== undefined) data.checkpoint = body.checkpoint;
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.semana_inicio !== undefined) data.semanaInicio = new Date(body.semana_inicio);
  if (body.semana_fin !== undefined) data.semanaFin = new Date(body.semana_fin);
  if (body.resuelto !== undefined) data.resuelto = body.resuelto;

  const reasigna = Array.isArray(body.squad_ids);
  if (reasigna) {
    data.squads = {
      deleteMany: {},
      create: (body.squad_ids as number[]).map((squadId) => ({ squadId })),
    };
  }

  const risk = await prisma.risk.update({ where: { id }, data });

  const afectados = reasigna
    ? Array.from(new Set([...squadsPrevios, ...(body.squad_ids as number[])]))
    : squadsPrevios;
  const cambios = await recomputarSemaforoSquads(afectados);

  return NextResponse.json({ risk, squadsAfectados: cambios }, { status: 200 });
}
