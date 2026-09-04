import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { errorJson } from '../../../lib/http';

const SEVERIDADES = ['ALTA', 'MEDIA', 'BAJA'];

// Crea un bloqueo y sus vínculos a squads. Un bloqueo puede pegarle a varios a la
// vez (BloqueoSquad). No toca el semáforo: hoy el color sólo depende del delivery.
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body?.descripcion) return errorJson('bad_request', 'falta descripcion', 400);
  if (!SEVERIDADES.includes(body?.severidad)) return errorJson('bad_request', 'severidad inválida (ALTA/MEDIA/BAJA)', 400);
  if (!Array.isArray(body.squad_ids) || body.squad_ids.length === 0) {
    return errorJson('bad_request', 'falta squad_ids', 400);
  }

  const bloqueo = await prisma.bloqueo.create({
    data: {
      descripcion: body.descripcion,
      severidad: body.severidad,
      desde: body.desde ? new Date(body.desde) : null,
      hasta: body.hasta ? new Date(body.hasta) : null,
      resuelto: body.resuelto ?? false,
      notaResolucion: body.nota_resolucion ?? null,
      squads: { create: (body.squad_ids as number[]).map((squadId) => ({ squadId })) },
    },
  });

  return NextResponse.json(bloqueo, { status: 200 });
}
