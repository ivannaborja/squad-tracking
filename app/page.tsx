import Link from 'next/link';
import { getOverview } from '../services/report/reportService';
import { C, FONT, deltaColor, fmtPct, fmtPp } from '../lib/ds-tokens';
import { Card, Kpi, ProgressBar, SemaforoBadge, Mono, stripeColor } from '../components/ds';
import { ExportButton } from '../components/ExportButton';
import { hoyISO } from '../lib/dates';

// Lee la base en cada request y usa la fecha de hoy: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

export default async function Comparativo() {
  const date = hoyISO();
  const squads = await getOverview(date);

  const cuenta = (s: string) => squads.filter((x) => x.semaforo === s).length;

  return (
    <div id="reporte" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FONT.head, fontSize: 30, fontWeight: 600, color: C.navy900 }}>
            Comparativo de squads
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: C.gray600 }}>
            Estado al <Mono>{date}</Mono>
          </p>
        </div>
        <ExportButton targetId="reporte" nombre={`comparativo-${date}`} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '24px 0 8px' }}>
        <Kpi label="Squads" value={squads.length} />
        <Kpi label="En verde" value={cuenta('verde')} color={C.verde} />
        <Kpi label="En amarillo" value={cuenta('amarillo')} color={C.amarilloFg} />
        <Kpi label="En rojo" value={cuenta('rojo')} color={C.rojo} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 16 }}>
        {squads.map((s) => (
          <Link key={s.squadId} href={`/squad/${s.squadId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card style={{ overflow: 'hidden', height: '100%' }}>
              <div style={{ height: 4, background: stripeColor(s.semaforo) }} />
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ fontFamily: FONT.head, fontSize: 17, fontWeight: 600, color: C.navy900 }}>
                    {s.squadNombre}
                  </div>
                  <SemaforoBadge semaforo={s.semaforo} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.gray600 }}>
                    <span>Esperado a hoy</span>
                    <Mono style={{ fontWeight: 500, color: C.gray900 }}>{fmtPct(s.aHoy.esperadoPct)}</Mono>
                  </div>
                  <ProgressBar pct={s.aHoy.esperadoPct} />
                </div>

                <div style={{ display: 'flex', gap: 20, paddingTop: 4, borderTop: `1px solid ${C.gray200}` }}>
                  <Metric label="Delivery" value={fmtPp(s.deliveryDeltaPct)} color={deltaColor(s.deliveryDeltaPct)} />
                  <Metric label="Discovery" value={fmtPp(s.discoveryDeltaPct)} color={deltaColor(s.discoveryDeltaPct)} />
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ fontSize: 12, color: C.gray400 }}>Datos de</div>
                    <Mono style={{ fontSize: 14, color: C.gray900 }}>{s.datosDe ?? '—'}</Mono>
                  </div>
                </div>

                {s.frasePronostico && (
                  <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: C.gray600 }}>“{s.frasePronostico}”</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ fontSize: 12, color: C.gray400 }}>{label}</div>
      <Mono style={{ fontSize: 16, fontWeight: 500, color }}>{value}</Mono>
    </div>
  );
}
