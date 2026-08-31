import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSquadReportView, getSquads } from '../../../services/report/reportService';
import { C, FONT } from '../../../lib/ds-tokens';
import { Card, SectionTitle, SemaforoBadge, Mono, stripeColor } from '../../../components/ds';
import { ExportButton } from '../../../components/ExportButton';
import { hoyISO, inicioDeSemana } from '../../../lib/dates';
import { EditModeProvider, EditModeToggle } from '../../../components/write/EditMode';
import { ListaSimple } from '../../../components/squad/shared';
import { CheckinSection } from '../../../components/squad/CheckinSection';
import { RisksSection } from '../../../components/squad/RisksSection';
import { NeedsSection } from '../../../components/squad/NeedsSection';
import { AchievementsSection } from '../../../components/squad/AchievementsSection';
import { UpcomingSection } from '../../../components/squad/UpcomingSection';
import { CarteraSection } from '../../../components/squad/CarteraSection';
import { UnplannedSection } from '../../../components/squad/UnplannedSection';

export const dynamic = 'force-dynamic';

export default async function Detalle({ params }: { params: Promise<{ squadId: string }> }) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) notFound();

  const date = hoyISO();
  const [view, squads] = await Promise.all([getSquadReportView(squadId, date), getSquads()]);
  if (!view) notFound();

  const s = view.snapshot;
  const semanaActual = inicioDeSemana(date);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/" className="no-print" style={{ fontSize: 14, fontWeight: 700, color: C.navy700, textDecoration: 'none' }}>
        ← Comparativo
      </Link>

      {/* El modo lectura/edición cubre header (para el toggle que agrega B1) y las
          secciones editables. Las secciones lo consumen; en B0 queda inerte. */}
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

          {view.avisoRojoSinNeed && (
            <Card style={{ borderLeft: `4px solid ${C.rojo}`, padding: 16, marginTop: 16 }}>
              <strong style={{ color: C.rojoFg }}>Rojo sin pedido de ayuda:</strong>{' '}
              <span style={{ color: C.gray600, fontSize: 14 }}>
                este squad está en rojo y no tiene un “Necesitamos de ustedes” activo esta semana.
              </span>
            </Card>
          )}

          <CheckinSection
            squadId={squadId}
            snapshot={s}
            aHoy={view.aHoy}
            kpiNoPlanificadas={view.kpiNoPlanificadas}
            date={date}
          />

          <RisksSection squadId={squadId} risks={view.collections.risks} squads={squads} semanaActual={semanaActual} />

          <NeedsSection squadId={squadId} needs={view.collections.needs} semanaActual={semanaActual} />

          <AchievementsSection squadId={squadId} achievements={view.collections.achievements} semanaActual={semanaActual} />

          <UpcomingSection squadId={squadId} upcomingDeliveries={view.collections.upcomingDeliveries} semanaActual={semanaActual} />

          <CarteraSection initiatives={view.collections.initiatives} />

          <UnplannedSection squadId={squadId} unplannedIntake={view.collections.unplannedIntake} semanaActual={semanaActual} />

          {/* Planes de acción: read-only acá (contexto por squad + export PDF por
              squad). La edición vive sólo en el comparativo `/` (portafolio). */}
          <SectionTitle>Planes de acción (portafolio)</SectionTitle>
          <ListaSimple
            items={view.actionPlans.map((p) => `${p.descripcion} — ${p.dueno || 's/d'} · ${p.plazo} · ${p.estado}${p.resuelto ? ' (resuelto)' : ''}`)}
            vacio="Sin planes de acción."
          />
        </div>
      </EditModeProvider>
    </div>
  );
}
