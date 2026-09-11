import { C, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card, Kpi, Mono } from '../ds';
import { KpiDelta } from './shared';
import type { AHoy, SnapshotView } from '../../services/report/types';

// Números del check-in del squad, SÓLO LECTURA: la app es copia fiel del
// Smartsheet, los reales no se editan a mano (se corrigen en la planilla y se
// reimporta). Delivery = Priorizado Finalizar; el esperado se deriva a hoy de las
// fechas del nodo. El desglose completo de las 4 métricas vive en el informe del squad.
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
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <Kpi label={`Esperado del Q (${date})`} value={fmtPct(aHoy.esperadoPct)} />
        <KpiDelta label="Delivery comprometido" real={snapshot.deliveryRealPct} delta={snapshot.deliveryDeltaPct} />
        <KpiDelta label="Discovery" real={snapshot.discoveryRealPct} delta={snapshot.discoveryDeltaPct} />
        <Kpi label="No planificadas" value={kpiNoPlanificadas} color={C.navy700} />
      </div>
      <Card style={{ padding: 16, marginTop: 16, background: C.navy050, border: 'none' }}>
        <span style={{ fontSize: 13, color: C.gray600 }}>Desvío a hoy — </span>
        <span style={{ fontSize: 13, color: C.gray600 }}>
          Delivery vs Q <Mono style={{ color: deltaColor(aHoy.deliveryDeltaPct) }}>{fmtPp(aHoy.deliveryDeltaPct)}</Mono>
          {aHoy.deliveryDeltaPriorizadoPct !== null && (
            <> {'('}vs priorizado <Mono style={{ color: deltaColor(aHoy.deliveryDeltaPriorizadoPct) }}>{fmtPp(aHoy.deliveryDeltaPriorizadoPct)}</Mono>{')'}</>
          )}
          {'  ·  '}Discovery vs Q <Mono style={{ color: deltaColor(aHoy.discoveryDeltaPct) }}>{fmtPp(aHoy.discoveryDeltaPct)}</Mono>
        </span>
      </Card>
    </>
  );
}
