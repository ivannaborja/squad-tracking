import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { errorJson } from '../../../../lib/http';

const SEVERIDADES = ['ALTA', 'MEDIA', 'BAJA'];

// Edita un bloqueo: incluye resolverlo (marca resuelto + resuelto_en) y reasignar
// squads. No toca el semáforo.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return errorJson('bad_request', 'id inválido', 400);

  const existente = await prisma.bloqueo.findUnique({ where: { id } });
  if (!existente) return errorJson('not_found', 'bloqueo inexistente', 404);

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.descripcion !== undefined) data.descripcion = body.descripcion;
  if (body.severidad !== undefined) {
    if (!SEVERIDADES.includes(body.severidad)) return errorJson('bad_request', 'severidad inválida (ALTA/MEDIA/BAJA)', 400);
    data.severidad = body.severidad;
  }
  if (body.desde !== undefined) data.desde = body.desde ? new Date(body.desde) : null;
  if (body.hasta !== undefined) data.hasta = body.hasta ? new Date(body.hasta) : null;
  if (body.nota_resolucion !== undefined) data.notaResolucion = body.nota_resolucion || null;
  if (body.resuelto !== undefined) {
    data.resuelto = body.resuelto;
    // Al resolver se sella la fecha; al reabrir se limpia.
    data.resueltoEn = body.resuelto ? new Date() : null;
  }
  if (Array.isArray(body.squad_ids)) {
    data.squads = { deleteMany: {}, create: (body.squad_ids as number[]).map((squadId) => ({ squadId })) };
  }

  const bloqueo = await prisma.bloqueo.update({ where: { id }, data });
  return NextResponse.json(bloqueo, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return errorJson('bad_request', 'id inválido', 400);
  await prisma.bloqueoSquad.deleteMany({ where: { bloqueoId: id } });
  await prisma.bloqueo.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
