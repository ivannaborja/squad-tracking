import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSquadReportView, getSquads } from '../../../services/report/reportService';
import { getNarrativaSquad } from '../../../services/report/informe';
import { C, FONT } from '../../../lib/ds-tokens';
import { Card, SemaforoBadge, Mono, stripeColor } from '../../../components/ds';
import { ExportButton } from '../../../components/ExportButton';
import { hoyISO, inicioDeSemana } from '../../../lib/dates';
import { NavGuardProvider } from '../../../components/informe/NavGuard';
import { EditModeProvider, EditModeToggle } from '../../../components/write/EditMode';
import { NarrativaEditor } from '../../../components/informe/NarrativaEditor';
import { CheckinSection } from '../../../components/squad/CheckinSection';
import { BloqueosSection } from '../../../components/squad/BloqueosSection';
import { NeedsSection } from '../../../components/squad/NeedsSection';
import { UpcomingSection } from '../../../components/squad/UpcomingSection';
import { UnplannedSection } from '../../../components/squad/UnplannedSection';

export const dynamic = 'force-dynamic';

export default async function Detalle({ params }: { params: Promise<{ squadId: string }> }) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) notFound();

  const date = hoyISO();
  const semanaActual = inicioDeSemana(date);
  const [view, squads, narrativa] = await Promise.all([
    getSquadReportView(squadId, date),
    getSquads(),
    getNarrativaSquad(squadId, semanaActual),
  ]);
  if (!view) notFound();

  const s = view.snapshot;

  // Un editor de texto de narrativa (Novedades/Pases/Despriorizaciones/Riesgos) que
  // guarda en InformeSquadSemanal de la semana en curso.
  const narrativaEditor = (key: string, label: string, value: string | null) => (
    <NarrativaEditor
      endpoint={`/api/informe/squad/${squadId}`}
      semanaInicio={semanaActual}
      historiaTabla="informe_squad_semanal"
      historiaRegistroId={narrativa.informeId}
      campos={[{ key, label, tipo: 'texto', value: value ?? '' }]}
    />
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <NavGuardProvider>
        <Link href="/" className="no-print" style={{ fontSize: 14, fontWeight: 700, color: C.navy700, textDecoration: 'none' }}>
          ← Comparativo
        </Link>

        <EditModeProvider>
          <div id="reporte" style={{ marginTop: 16 }}>
            <Card style={{ overflow: 'hidden' }}>
              <div style={{ height: 4, background: stripeColor(s.semaforo) }} />
              <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 26, fontWeight: 600, color: C.navy900 }}>
                    {view.squadNombre}
                  </h1>
                  <SemaforoBadge semaforo={s.semaforo} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 13, color: C.gray600 }}>
                    Datos de <Mono style={{ color: C.gray900 }}>{view.datosDe ?? '—'}</Mono>
                  </span>
                  <EditModeToggle />
                  <ExportButton targetId="reporte" nombre={`${view.squadNombre}-${date}`} />
                </div>
              </div>
            </Card>

            {/* Números de la semana (Delivery/Discovery comprometido). No es una de las
                7 secciones narrativas; va arriba. */}
            <CheckinSection
              squadId={squadId}
              snapshot={s}
              aHoy={view.aHoy}
              kpiNoPlanificadas={view.kpiNoPlanificadas}
              date={date}
            />

            {/* Las 7 secciones de la bitácora, en orden. */}
            <div style={{ marginTop: 28 }}>
              <BloqueosSection squadId={squadId} bloqueos={view.collections.bloqueos} squads={squads} />
            </div>

            <div style={{ marginTop: 28 }}>{narrativaEditor('novedades', 'Novedades de squad', narrativa.novedades)}</div>

            <div style={{ marginTop: 28 }}>
              <UpcomingSection squadId={squadId} upcomingDeliveries={view.collections.upcomingDeliveries} semanaActual={semanaActual} />
            </div>

            <div style={{ marginTop: 28 }}>{narrativaEditor('pases_produccion', 'Pases a producción', narrativa.pasesProduccion)}</div>

            <div style={{ marginTop: 28 }}>
              <UnplannedSection squadId={squadId} unplannedIntake={view.collections.unplannedIntake} semanaActual={semanaActual} />
            </div>

            <div style={{ marginTop: 28 }}>{narrativaEditor('despriorizaciones', 'Despriorizaciones', narrativa.despriorizaciones)}</div>

            {/* 7) Necesitamos de ustedes / Riesgos: la lista estructurada + los riesgos
                como texto libre bajo el mismo bloque. */}
            <div style={{ marginTop: 28 }}>
              <NeedsSection squadId={squadId} needs={view.collections.needs} semanaActual={semanaActual} />
              <div style={{ marginTop: 16 }}>{narrativaEditor('riesgos', 'Riesgos', narrativa.riesgos)}</div>
            </div>
          </div>
        </EditModeProvider>
      </NavGuardProvider>
    </div>
  );
}
