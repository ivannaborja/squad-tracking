import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { errorJson } from '../../../../lib/http';
import { diffCampos, registrarHistoria } from '../../../../lib/narrativeHistory';

// Clave snake_case del body → columna Prisma. Se usa para registrar el historial.
const CAMPOS = { novedades: 'novedades', lectura: 'lectura', pases_planificados: 'pasesPlanificados' };

// Narrativa del informe general (portafolio) de una semana. La escribe Dai:
// novedades, lectura y el número manual de pases planificados (KPI 4). Upsert por
// semana — no hay "crear vs editar", es un texto que se guarda para esa semana.
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const semana = body.semana_inicio;
  if (typeof semana !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semana)) {
    return errorJson('bad_request', 'falta semana_inicio (YYYY-MM-DD)', 400);
  }

  const data = camposPresentes(body);
  const before = await prisma.informeSemanal.findUnique({ where: { semanaInicio: new Date(semana) } });
  const row = await prisma.informeSemanal.upsert({
    where: { semanaInicio: new Date(semana) },
    create: { semanaInicio: new Date(semana), ...data },
    update: data,
  });
  await registrarHistoria('informe_semanal', row.id, diffCampos(before, row, body, CAMPOS));
  return NextResponse.json(row, { status: 200 });
}

// Sólo las claves presentes en el body (edición parcial por campo). pases
// planificados es un entero o null; los textos, string o null para poder vaciar.
function camposPresentes(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ('novedades' in body) data.novedades = texto(body.novedades);
  if ('lectura' in body) data.lectura = texto(body.lectura);
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
