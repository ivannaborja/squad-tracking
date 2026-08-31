import Link from 'next/link';
import { getInformeGeneral } from '../../services/report/informe';
import { hoyISO, inicioDeSemana } from '../../lib/dates';
import { C, FONT } from '../../lib/ds-tokens';
import { Card } from '../../components/ds';
import { ExportButton } from '../../components/ExportButton';
import { EditModeProvider, EditModeToggle } from '../../components/write/EditMode';
import { KpiRow, SemaforoTabla, Bloque } from '../../components/informe/pieces';
import { TrendChart } from '../../components/informe/TrendChart';
import { NarrativaEditor } from '../../components/informe/NarrativaEditor';

// Lee la base en cada request; nunca se prerenderiza.
export const dynamic = 'force-dynamic';

export default async function InformeGeneral() {
  const date = hoyISO();
  const view = await getInformeGeneral(date);
  const semana = view.semanaInicio ?? inicioDeSemana(date);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/" className="no-print" style={{ fontSize: 14, fontWeight: 700, color: C.navy700, textDecoration: 'none' }}>
        ← Comparativo
      </Link>

      <EditModeProvider>
        <div id="reporte" style={{ marginTop: 16 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 28, fontWeight: 600, color: C.navy900 }}>
                Informe ejecutivo — Portafolio
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: C.gray600 }}>Semana del {semana}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EditModeToggle />
              <ExportButton targetId="reporte" nombre={`informe-portafolio-${semana}`} />
            </div>
          </header>

          <KpiRow kpis={view.kpis} />

          <Bloque title="Semáforo por squad">
            <SemaforoTabla rows={view.semaforos} />
          </Bloque>

          <Bloque title="Tendencia del portafolio">
            <Card style={{ padding: '20px 12px 12px' }}>
              <TrendChart data={view.trend} />
            </Card>
          </Bloque>

          <Bloque title="Narrativa de la semana">
            <NarrativaEditor
              endpoint="/api/informe/general"
              semanaInicio={semana}
              campos={[
                { key: 'novedades', label: 'Novedades de la semana', tipo: 'texto', value: view.novedades ?? '' },
                { key: 'lectura', label: 'Lectura', tipo: 'texto', value: view.lectura ?? '' },
                { key: 'pases_planificados', label: 'Pases planificados esta semana (KPI)', tipo: 'numero', value: view.kpis.pasesPlanificados?.toString() ?? '' },
              ]}
            />
          </Bloque>
        </div>
      </EditModeProvider>
    </div>
  );
}
