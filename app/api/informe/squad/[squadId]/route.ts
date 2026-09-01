import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { errorJson } from '../../../../../lib/http';
import { diffCampos, registrarHistoria } from '../../../../../lib/narrativeHistory';

// Clave snake_case del body → columna Prisma. Se usa para registrar el historial.
const CAMPOS = {
  novedades: 'novedades',
  pases_produccion: 'pasesProduccion',
  despriorizaciones: 'despriorizaciones',
  pases_planificados: 'pasesPlanificados',
};

// Narrativa del informe individual de un squad para una semana. Texto libre que
// escribe Dai: novedades, pases a producción, despriorizaciones, y el número
// manual de pases planificados (KPI 4 del squad). Upsert por (squad, semana).
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ squadId: string }> }) {
  const squadId = Number((await ctx.params).squadId);
  if (!Number.isInteger(squadId)) return errorJson('bad_request', 'squadId inválido', 400);

  const body = (await request.json()) as Record<string, unknown>;
  const semana = body.semana_inicio;
  if (typeof semana !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semana)) {
    return errorJson('bad_request', 'falta semana_inicio (YYYY-MM-DD)', 400);
  }

  const data = camposPresentes(body);
  const before = await prisma.informeSquadSemanal.findUnique({
    where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semana) } },
  });
  const row = await prisma.informeSquadSemanal.upsert({
    where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semana) } },
    create: { squadId, semanaInicio: new Date(semana), ...data },
    update: data,
  });
  await registrarHistoria('informe_squad_semanal', row.id, diffCampos(before, row, body, CAMPOS));
  return NextResponse.json(row, { status: 200 });
}

function camposPresentes(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ('novedades' in body) data.novedades = texto(body.novedades);
  if ('pases_produccion' in body) data.pasesProduccion = texto(body.pases_produccion);
  if ('despriorizaciones' in body) data.despriorizaciones = texto(body.despriorizaciones);
  if ('pases_planificados' in body) data.pasesPlanificados = entero(body.pases_planificados);
  return data;
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function entero(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
