import Link from 'next/link';
import { C, FONT, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card, ProgressBar, SemaforoBadge, Mono, stripeColor } from '../ds';
import type { SquadReportViewCompact } from '../../services/report/types';

// La grilla de tarjetas del comparativo. Read-only: el comparativo no edita nada de
// squad (eso vive en /squad/[id]); acá sólo se lista y se enlaza. Se muestran los
// DOS esperados: el del Q (barra + define el color) y, en el comprometido, el desvío
// vs el priorizado (por fechas) como dato extra.
export function SquadGrid({ squads }: { squads: SquadReportViewCompact[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 16 }}>
      {squads.map((s) => (
        <Link key={s.squadId} href={`/squad/${s.squadId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ overflow: 'hidden', height: '100%' }}>
            <div style={{ height: 4, background: stripeColor(s.semaforo) }} />
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div style={{ fontFamily: FONT.head, fontSize: 17, fontWeight: 600, color: C.navy900 }}>{s.squadNombre}</div>
                <SemaforoBadge semaforo={s.semaforo} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.gray600 }}>
                  <span>Esperado del Q (a hoy)</span>
                  <Mono style={{ fontWeight: 500, color: C.gray900 }}>{fmtPct(s.aHoy.esperadoPct)}</Mono>
                </div>
                <ProgressBar pct={s.aHoy.esperadoPct ?? 0} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: `1px solid ${C.gray200}` }}>
                <MetricDual
                  label="Delivery comprometido"
                  real={s.deliveryRealPct}
                  vsQ={s.deliveryDeltaPct}
                  vsPriorizado={s.deliveryDeltaPriorizadoPct}
                />
                <MetricDual label="Discovery" real={s.discoveryRealPct} vsQ={s.discoveryDeltaPct} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.gray400 }}>
                  <span>Datos de</span>
                  <Mono style={{ color: C.gray900 }}>{s.datosDe ?? '—'}</Mono>
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
  );
}

// Una métrica del comprometido: el %real arriba y, debajo, el desvío vs el esperado
// del Q (el oficial) y —si aplica— vs el priorizado (por fechas). "No aplica" si no
// hay real (ej. discovery en Empresas).
function MetricDual({
  label,
  real,
  vsQ,
  vsPriorizado,
}: {
  label: string;
  real: number | null;
  vsQ: number | null;
  vsPriorizado?: number | null;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, color: C.gray600 }}>{label}</span>
        <Mono style={{ fontSize: 16, fontWeight: 600, color: C.navy900 }}>{real === null ? 'No aplica' : fmtPct(real)}</Mono>
      </div>
      {real !== null && (
        <div style={{ fontSize: 12, color: C.gray600, marginTop: 2 }}>
          vs Q <Mono style={{ color: deltaColor(vsQ), fontWeight: 600 }}>{fmtPp(vsQ)}</Mono>
          {vsPriorizado != null && (
            <>
              {'  ·  '}vs priorizado <Mono style={{ color: deltaColor(vsPriorizado) }}>{fmtPp(vsPriorizado)}</Mono>
            </>
          )}
        </div>
      )}
    </div>
  );
}
