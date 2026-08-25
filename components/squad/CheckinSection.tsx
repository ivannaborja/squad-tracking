import { C, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card, Kpi, Mono } from '../ds';
import { KpiDelta } from './shared';
import type { AHoy, SnapshotView } from '../../services/report/types';

// Check-in del squad: los KPIs de delivery/discovery/frase + el bloque "a hoy".
// En B0 es read-only; B1 le agrega el modo edición (inputs → PATCH /api/snapshot).
// El `squadId` ya viaja como prop para que B1 no tenga que tocar la página.
export function CheckinSection({
  snapshot,
  aHoy,
  kpiNoPlanificadas,
  date,
}: {
  squadId: number;
  snapshot: SnapshotView;
  aHoy: AHoy;
  kpiNoPlanificadas: number;
  date: string;
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <Kpi label="Esperado (congelado)" value={fmtPct(snapshot.esperadoPct)} />
        <KpiDelta label="Delivery real" real={snapshot.deliveryRealPct} delta={snapshot.deliveryDeltaPct} />
        <KpiDelta label="Discovery real" real={snapshot.discoveryRealPct} delta={snapshot.discoveryDeltaPct} />
        <Kpi label="No planificadas" value={kpiNoPlanificadas} color={C.navy700} />
      </div>

      <Card style={{ padding: 16, marginTop: 16, background: C.navy050, border: 'none' }}>
        <span style={{ fontSize: 13, color: C.gray600 }}>Esperado a hoy ({date}): </span>
        <Mono style={{ fontWeight: 500, color: C.navy900 }}>{fmtPct(aHoy.esperadoPct)}</Mono>
        <span style={{ fontSize: 13, color: C.gray600 }}>
          {'  ·  '}Delivery <Mono style={{ color: deltaColor(aHoy.deliveryDeltaPct) }}>{fmtPp(aHoy.deliveryDeltaPct)}</Mono>
          {'  ·  '}Discovery <Mono style={{ color: deltaColor(aHoy.discoveryDeltaPct) }}>{fmtPp(aHoy.discoveryDeltaPct)}</Mono>
        </span>
      </Card>

      {snapshot.frasePronostico && (
        <Card style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray600 }}>Pronóstico</div>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: C.navy900 }}>“{snapshot.frasePronostico}”</p>
        </Card>
      )}
    </>
  );
}
