'use client';

import { EditableCollection } from '../write/EditableCollection';
import type { NeedItem } from '../../services/report/types';

// "Necesitamos de ustedes": agregar / editar / resolver (tiene `resuelto`, no DELETE).
export function NeedsSection({
  squadId,
  needs,
  semanaActual,
}: {
  squadId: number;
  needs: NeedItem[];
  semanaActual: string;
}) {
  return (
    <EditableCollection<NeedItem>
      title="Necesitamos de ustedes"
      items={needs}
      fields={[
        { key: 'descripcion', label: 'Descripción', type: 'text', apiKey: 'descripcion' },
        { key: 'dueno', label: 'Responsable', type: 'text', apiKey: 'dueno' },
      ]}
      endpoint="/api/needs"
      emptyText="Sin pedidos."
      createExtra={() => ({ squad_id: squadId, semana_inicio: semanaActual })}
      toForm={(n) => ({ descripcion: n.descripcion, dueno: n.dueno })}
      readLine={(n) => `${n.descripcion} — ${n.dueno || 's/d'}${n.resuelto ? ' (resuelto)' : ''}`}
      resolvable={(n) => n.resuelto}
    />
  );
}
