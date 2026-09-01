import { notFound } from 'next/navigation';
import { getInformeSquad } from '../../../../services/report/informe';
import { hoyISO, inicioDeSemana } from '../../../../lib/dates';
import { C, FONT } from '../../../../lib/ds-tokens';
import { Card, SemaforoBadge, Mono, stripeColor } from '../../../../components/ds';
import { ExportButton } from '../../../../components/ExportButton';
import { NavGuardProvider, BackLink } from '../../../../components/informe/NavGuard';
import { EditModeProvider, EditModeToggle } from '../../../../components/write/EditMode';
import { KpiRow, Bloque, ListaInforme, BloqueosSection, entregaTexto, needTexto, simpleTexto } from '../../../../components/informe/pieces';
import { TrendChart } from '../../../../components/informe/TrendChart';
import { NarrativaEditor } from '../../../../components/informe/NarrativaEditor';

export const dynamic = 'force-dynamic';

export default async function InformeSquad({ params }: { params: Promise<{ squadId: string }> }) {
  const squadId = Number((await params).squadId);
  if (!Number.isInteger(squadId)) notFound();

  const date = hoyISO();
  const view = await getInformeSquad(squadId, date);
  if (!view) notFound();

  const semana = view.semanaInicio ?? inicioDeSemana(date);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      <NavGuardProvider>
      <BackLink href="/informe">← Informe de portafolio</BackLink>

      <EditModeProvider>
        <div id="reporte" style={{ marginTop: 16 }}>
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ height: 4, background: stripeColor(view.semaforo) }} />
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 24, fontWeight: 600, color: C.navy900 }}>
                  Informe — {view.squadNombre}
                </h1>
                <SemaforoBadge semaforo={view.semaforo} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, color: C.gray600 }}>
                  Semana del <Mono style={{ color: C.gray900 }}>{semana}</Mono>
                </span>
                <EditModeToggle />
                <ExportButton targetId="reporte" nombre={`informe-${view.squadNombre}-${semana}`} />
              </div>
            </div>
          </Card>

          <KpiRow kpis={view.kpis} />

          {/* Bloqueos: aparte de los riesgos y prominentes, arriba de todo. */}
          <Bloque title="Bloqueos">
            <BloqueosSection bloqueos={view.bloqueos} />
          </Bloque>

          <Bloque title={`Tendencia — ${view.squadNombre}`}>
            <Card style={{ padding: '20px 12px 12px' }}>
              <TrendChart data={view.trend} />
            </Card>
          </Bloque>

          <Bloque title="Narrativa del squad">
            <NarrativaEditor
              endpoint={`/api/informe/squad/${squadId}`}
              semanaInicio={semana}
              campos={[
                { key: 'novedades', label: 'Novedades', tipo: 'texto', value: view.narrativa.novedades ?? '' },
                { key: 'pases_produccion', label: 'Pases a producción', tipo: 'texto', value: view.narrativa.pasesProduccion ?? '' },
                { key: 'despriorizaciones', label: 'Despriorizaciones', tipo: 'texto', value: view.narrativa.despriorizaciones ?? '' },
                { key: 'pases_planificados', label: 'Pases planificados esta semana (KPI)', tipo: 'numero', value: view.narrativa.pasesPlanificados?.toString() ?? '' },
              ]}
            />
          </Bloque>

          <Bloque title="Próximas entregas">
            <ListaInforme items={view.proximasEntregas.map(entregaTexto)} vacio="Sin próximas entregas cargadas." />
          </Bloque>

          <Bloque title="Ingresos no planificados">
            <ListaInforme items={view.ingresosNoPlanificados.map(simpleTexto)} vacio="Sin ingresos no planificados." />
          </Bloque>

          <Bloque title="Necesitamos de ustedes / riesgos">
            <ListaInforme items={view.needs.map(needTexto)} vacio="Sin pedidos activos." />
          </Bloque>
        </div>
      </EditModeProvider>
      </NavGuardProvider>
    </div>
  );
}
