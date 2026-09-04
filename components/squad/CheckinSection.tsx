'use client';

import { useState, type ReactNode } from 'react';
import { C, deltaColor, fmtPct, fmtPp } from '../../lib/ds-tokens';
import { Card, Kpi, Mono } from '../ds';
import { KpiDelta } from './shared';
import { useEditMode } from '../write/EditMode';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, PctField, TextAreaField } from '../write/controls';
import type { AHoy, SnapshotView } from '../../services/report/types';

// Check-in del squad (Flujo 2): edita delivery/discovery/frase y confirma. El
// modo edición lo controla el toggle del header (useEditMode). Editar un real
// activa su override en el backend, así que sólo se manda un real si cambió —
// abrir y guardar sin tocarlo no debe disparar la confirmación del import.
export function CheckinSection({
  squadId,
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
  const { editing } = useEditMode();

  const AHoyCard = (
    <Card style={{ padding: 16, marginTop: 16, background: C.navy050, border: 'none' }}>
      <span style={{ fontSize: 13, color: C.gray600 }}>Esperado a hoy ({date}): </span>
      <Mono style={{ fontWeight: 500, color: C.navy900 }}>{fmtPct(aHoy.esperadoPct)}</Mono>
      <span style={{ fontSize: 13, color: C.gray600 }}>
        {'  ·  '}Delivery <Mono style={{ color: deltaColor(aHoy.deliveryDeltaPct) }}>{fmtPp(aHoy.deliveryDeltaPct)}</Mono>
        {'  ·  '}Discovery <Mono style={{ color: deltaColor(aHoy.discoveryDeltaPct) }}>{fmtPp(aHoy.discoveryDeltaPct)}</Mono>
      </span>
    </Card>
  );

  if (!editing) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
          <Kpi label="Esperado (congelado)" value={fmtPct(snapshot.esperadoPct)} />
          <KpiDelta label="Delivery real" real={snapshot.deliveryRealPct} delta={snapshot.deliveryDeltaPct} />
          <KpiDelta label="Discovery real" real={snapshot.discoveryRealPct} delta={snapshot.discoveryDeltaPct} />
          <Kpi label="No planificadas" value={kpiNoPlanificadas} color={C.navy700} />
        </div>
        {AHoyCard}
        {snapshot.frasePronostico && (
          <Card style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray600 }}>Comentarios</div>
            <p style={{ margin: '8px 0 0', fontSize: 16, color: C.navy900 }}>“{snapshot.frasePronostico}”</p>
          </Card>
        )}
      </>
    );
  }

  return <CheckinEditor squadId={squadId} snapshot={snapshot} kpiNoPlanificadas={kpiNoPlanificadas} aHoyCard={AHoyCard} />;
}

function CheckinEditor({
  squadId,
  snapshot,
  kpiNoPlanificadas,
  aHoyCard,
}: {
  squadId: number;
  snapshot: SnapshotView;
  kpiNoPlanificadas: number;
  aHoyCard: ReactNode;
}) {
  const { pending, error, mutate } = useApiWrite();

  const [delivery, setDelivery] = useState<number | null>(snapshot.deliveryRealPct);
  const [discovery, setDiscovery] = useState<number | null>(snapshot.discoveryRealPct);
  const [frase, setFrase] = useState(snapshot.frasePronostico ?? '');

  const deliveryCambio = delivery !== snapshot.deliveryRealPct;
  const discoveryCambio = discovery !== snapshot.discoveryRealPct;
  const fraseCambio = frase !== (snapshot.frasePronostico ?? '');
  const hayCambios = deliveryCambio || discoveryCambio || fraseCambio;

  async function guardar() {
    const json: Record<string, unknown> = { editado_por: 'sistema' };
    // Sólo los reales que cambiaron: mandarlos activa su override (Flujo 3).
    if (deliveryCambio) json.delivery_real_pct = delivery;
    if (discoveryCambio) json.discovery_real_pct = discovery;
    if (fraseCambio) json.frase_pronostico = frase;
    await mutate({ url: `/api/snapshot/${squadId}`, method: 'PATCH', json });
  }

  return (
    <Card style={{ padding: 20, marginTop: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <Kpi label="Esperado (congelado)" value={fmtPct(snapshot.esperadoPct)} />
        <PctField label="Delivery real" value={delivery} onChange={setDelivery} />
        <PctField label="Discovery real" value={discovery} onChange={setDiscovery} />
        <Kpi label="No planificadas" value={kpiNoPlanificadas} color={C.navy700} />
      </div>

      <div style={{ marginTop: 16 }}>
        <TextAreaField label="Comentarios" value={frase} onChange={setFrase} rows={2} />
      </div>

      {aHoyCard}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <Button onClick={guardar} disabled={pending || !hayCambios}>
          {pending ? 'Guardando…' : 'Confirmar'}
        </Button>
      </div>
      <ErrorText error={error} />
    </Card>
  );
}
