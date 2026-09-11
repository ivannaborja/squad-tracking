import { C, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card, Kpi, Mono } from '../ds';
import type { AHoy, SnapshotView } from '../../services/report/types';

// Números del check-in del squad, SÓLO LECTURA (copia fiel del Smartsheet). Cada
// card muestra el %real grande (dónde está el squad) y, debajo, su esperado y los
// puntos de diferencia, para ver el estado de un vistazo. El delivery comprometido
// se compara contra los dos esperados: el del Q (el oficial, define el color) y el
// priorizado (por fechas). El desglose de las 4 métricas vive en el informe del squad.
export function CheckinSection({
  snapshot,
  aHoy,
  kpiNoPlanificadas,
  date,
}: {
  snapshot: SnapshotView;
  aHoy: AHoy;
  kpiNoPlanificadas: number;
  date: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, marginTop: 16 }}>
      <MetricCard
        titulo="Delivery comprometido priorizado"
        real={snapshot.deliveryRealPct}
        filas={[
          { label: `Esperado del Q (${date})`, esperado: aHoy.esperadoPct, delta: snapshot.deliveryDeltaPct },
          { label: 'Esperado priorizado', esperado: aHoy.esperadoPriorizadoPct, delta: aHoy.deliveryDeltaPriorizadoPct },
        ]}
      />
      <MetricCard
        titulo="Discovery comprometido"
        real={snapshot.discoveryRealPct}
        filas={[{ label: `Esperado del Q (${date})`, esperado: aHoy.esperadoPct, delta: snapshot.discoveryDeltaPct }]}
      />
      <Kpi label="No planificadas" value={kpiNoPlanificadas} color={C.navy700} />
    </div>
  );
}

// El %real grande y, debajo, una línea por esperado con su valor y la diferencia en
// pp (verde si llegó o superó, rojo si quedó abajo). "No aplica" si no hay real.
function MetricCard({
  titulo,
  real,
  filas,
}: {
  titulo: string;
  real: number | null;
  filas: { label: string; esperado: number | null; delta: number | null }[];
}) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.gray600 }}>{titulo}</div>
      <Mono style={{ display: 'block', fontSize: 28, fontWeight: 600, color: C.navy900, marginTop: 4 }}>
        {real === null ? 'No aplica' : fmtPct(real)}
      </Mono>
      {real !== null &&
        filas.map((f) => (
          <div key={f.label} style={{ fontSize: 12, color: C.gray600, marginTop: 6 }}>
            {f.label}: <Mono style={{ color: C.gray900 }}>{fmtPct(f.esperado)}</Mono>
            {f.delta !== null && (
              <>
                {'  ·  '}
                <Mono style={{ color: deltaColor(f.delta), fontWeight: 600 }}>{fmtPp(f.delta)}</Mono>
              </>
            )}
          </div>
        ))}
    </Card>
  );
}
