import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { errorJson } from '../../../../lib/http';
import { hoyISO, inicioDeSemana } from '../../../../lib/dates';
import { esperadoPct } from '../../../../domain/esperadoPct';
import { delta } from '../../../../domain/delta';
import { recomputeSemaforo } from '../../../../services/report/assemble';
import { resolverTrimestre, trimestreDeFecha } from '../../../../services/report/quarters';
import { avisoRojoSinNeed } from '../../../../services/report/assemble';
import type { Risk } from '../../../../domain/types';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// Flujo 2: edita datos de entrada de la semana en curso y confirma el check-in.
// Actualiza en el lugar la fila de esta semana; entre semanas nunca se pisa. Los
// calculados los reescribe domain/, no el cliente.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) return errorJson('bad_request', 'squadId inválido', 400);

  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!squad) return errorJson('not_found', 'squad inexistente', 404);

  const body = await request.json();
  if (!body?.editado_por) return errorJson('bad_request', 'falta editado_por', 400);

  const fechaReferencia = hoyISO();
  const semanaInicio = inicioDeSemana(fechaReferencia);
  const trimestre = trimestreDeFecha(fechaReferencia);
  const esperado = esperadoPct(fechaReferencia, resolverTrimestre(trimestre));

  const existente = await prisma.squadSnapshot.findUnique({
    where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semanaInicio) } },
  });

  // Los reales sólo se pisan si vienen en el body; si no, se conserva lo que había
  // (o 0 en la primera carga por PATCH sin reales).
  const deliveryRealPct = body.delivery_real_pct ?? existente?.deliveryRealPct ?? 0;
  const discoveryRealPct = body.discovery_real_pct ?? existente?.discoveryRealPct ?? 0;
  const deliveryDeltaPct = delta(deliveryRealPct, esperado);
  const discoveryDeltaPct = delta(discoveryRealPct, esperado);

  const risks = await prisma.risk.findMany({ where: { squads: { some: { squadId } } } });
  const risksDominio: Risk[] = risks.map((r) => ({
    categoriaImpacto: r.categoriaImpacto,
    resuelto: r.resuelto,
    semanaInicio: iso(r.semanaInicio),
    semanaFin: iso(r.semanaFin),
  }));
  const semaforo = recomputeSemaforo(deliveryDeltaPct, risksDominio, fechaReferencia);

  // Editar un real a mano activa su flag de override (por campo, independiente):
  // así un reimport posterior pide confirmación antes de pisarlo (Flujo 3).
  const deliveryManualOverride =
    body.delivery_real_pct !== undefined ? true : (existente?.deliveryManualOverride ?? false);
  const discoveryManualOverride =
    body.discovery_real_pct !== undefined ? true : (existente?.discoveryManualOverride ?? false);

  const datos = {
    trimestre,
    deliveryRealPct,
    discoveryRealPct,
    deliveryManualOverride,
    discoveryManualOverride,
    esperadoPct: esperado,
    deliveryDeltaPct,
    discoveryDeltaPct,
    semaforo,
    frasePronostico: body.frase_pronostico ?? existente?.frasePronostico ?? null,
    editadoPor: body.editado_por,
    fechaReferencia: new Date(fechaReferencia),
  };

  const snapshot = await prisma.squadSnapshot.upsert({
    where: { squadId_semanaInicio: { squadId, semanaInicio: new Date(semanaInicio) } },
    create: { squadId, semanaInicio: new Date(semanaInicio), ...datos },
    update: datos,
  });

  const needs = await prisma.need.findMany({
    where: { squadId, semanaInicio: new Date(semanaInicio) },
  });
  const aviso = avisoRojoSinNeed(
    semaforo,
    needs.map((n) => ({
      id: n.id,
      descripcion: n.descripcion,
      dueno: n.dueno,
      semanaInicio: iso(n.semanaInicio),
      resuelto: n.resuelto,
    })),
    semanaInicio
  );

  return NextResponse.json({ snapshot, avisoRojoSinNeed: aviso }, { status: 200 });
}
