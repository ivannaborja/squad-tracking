import { getInformeGeneral } from '../../services/report/informe';
import { hoyISO, inicioDeSemana, semanaRangoLabel } from '../../lib/dates';
import { trimestreDeFecha } from '../../services/report/quarters';
import { C, FONT, fmtPct } from '../../lib/ds-tokens';
import { Card } from '../../components/ds';
import { ExportButton } from '../../components/ExportButton';
import { NavGuardProvider, BackLink } from '../../components/informe/NavGuard';
import { EditModeProvider, EditModeToggle } from '../../components/write/EditMode';
import { KpiRow, SemaforoTabla, Bloque } from '../../components/informe/pieces';
import { TrendChart } from '../../components/informe/TrendChart';
import { NarrativaEditor } from '../../components/informe/NarrativaEditor';
import { PasesPlanificadosCard } from '../../components/informe/PasesPlanificadosCard';

// Lee la base en cada request; nunca se prerenderiza.
export const dynamic = 'force-dynamic';

export default async function InformeGeneral() {
  const date = hoyISO();
  const view = await getInformeGeneral(date);
  const semana = view.semanaInicio ?? inicioDeSemana(date);

  // Subtítulo: rango de la semana + quarter calendario. Ej: "Semana del 31 de
  // agosto al 4 de septiembre · Q3 2026".
  const [, qNum, qAnio] = /^Q(\d)-(\d{4})$/.exec(trimestreDeFecha(semana)) ?? [];
  const subtitulo = `Semana del ${semanaRangoLabel(semana)} · Q${qNum} ${qAnio}`;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <NavGuardProvider>
      <BackLink href="/">← Comparativo</BackLink>

      <EditModeProvider>
        <div id="reporte" style={{ marginTop: 16 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 28, fontWeight: 600, color: C.navy900 }}>
                Informe ejecutivo Semanal
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: C.gray600 }}>{subtitulo}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <EditModeToggle />
              <ExportButton targetId="reporte" nombre={`informe-portafolio-${semana}`} />
            </div>
          </header>

          <KpiRow
            kpis={view.kpis}
            pasesPlanificadosSlot={
              <PasesPlanificadosCard endpoint="/api/informe/general" semanaInicio={semana} value={view.kpis.pasesPlanificados} />
            }
          />

          <Bloque title={`Semáforo por squad — avance vs. esperado ${fmtPct(view.kpis.esperadoPct)}`}>
            <SemaforoTabla rows={view.semaforos} />
          </Bloque>

          <Bloque title="Tendencia del portafolio">
            <Card style={{ padding: '20px 12px 12px' }}>
              <TrendChart data={view.trend} />
            </Card>
            <div style={{ marginTop: 16 }}>
              <NarrativaEditor
                endpoint="/api/informe/general"
                semanaInicio={semana}
                historiaTabla="informe_semanal"
                historiaRegistroId={view.informeId}
                campos={[{ key: 'lectura', label: 'Lectura', tipo: 'texto', value: view.lectura ?? '' }]}
              />
            </div>
          </Bloque>

          {/* Sin título de bloque: el label del campo ya lo identifica. */}
          <section style={{ marginTop: 28 }}>
            <NarrativaEditor
              endpoint="/api/informe/general"
              semanaInicio={semana}
              historiaTabla="informe_semanal"
              historiaRegistroId={view.informeId}
              campos={[
                { key: 'novedades', label: 'Novedades de la semana', tipo: 'texto', value: view.novedades ?? '' },
              ]}
            />
          </section>
        </div>
      </EditModeProvider>
      </NavGuardProvider>
    </div>
  );
}
