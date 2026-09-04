'use client';

import { EditableCollection } from '../write/EditableCollection';
import type { NeedItem } from '../../services/report/types';

const ESTADOS = [
  { value: 'ABIERTA', label: 'Abierta' },
  { value: 'MITIGADA_PARCIALMENTE', label: 'Mitigada parcialmente' },
  { value: 'RESUELTA', label: 'Resuelta' },
];
const estadoLabel = (v: string) => ESTADOS.find((e) => e.value === v)?.label ?? v;

// "Necesitamos de ustedes / Riesgos": pedidos de escalación con Fecha y Estado
// (Abierta / Mitigada parcialmente / Resuelta), como en la bitácora de Dai. La
// fecha arranca hoy pero es editable; el estado maneja el ciclo (ya no hay
// "responsable" ni el simple resolver).
export function NeedsSection({
  squadId,
  needs,
  semanaActual,
}: {
  squadId: number;
  needs: NeedItem[];
  semanaActual: string;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <EditableCollection<NeedItem>
      title="Necesitamos de ustedes / Riesgos"
      items={needs}
      fields={[
        { key: 'descripcion', label: 'Descripción', type: 'text', apiKey: 'descripcion' },
        { key: 'fecha', label: 'Fecha', type: 'date', apiKey: 'fecha', default: hoy },
        { key: 'estado', label: 'Estado', type: 'select', apiKey: 'estado', options: ESTADOS },
      ]}
      endpoint="/api/needs"
      emptyText="Sin pedidos."
      // La fecha se pre-carga con hoy (editable, vía default); el estado arranca en Abierta.
      createExtra={() => ({ squad_id: squadId, semana_inicio: semanaActual })}
      toForm={(n) => ({ descripcion: n.descripcion, fecha: n.fecha, estado: n.estado })}
      readLine={(n) => `${n.fecha} · ${n.descripcion} — ${estadoLabel(n.estado)}`}
    />
  );
}
