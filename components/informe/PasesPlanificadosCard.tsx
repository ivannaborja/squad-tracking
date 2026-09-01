'use client';

import { useEffect, useRef, useState } from 'react';
import { C, FONT } from '../../lib/ds-tokens';
import { Card } from '../ds';
import { useEditMode } from '../write/EditMode';
import { useApiWrite } from '../write/useApiWrite';

// KPI "Pases planificados" editable en su propia card (Dai lo carga a mano). En
// lectura se ve igual que los otros KpiInforme; en modo edición, el valor pasa a
// ser un input numérico que guarda al salir del foco o con Enter. El PATCH upsertea
// por semana. Se re-sincroniza con el server tras un refresh salvo mientras se tipea.
export function PasesPlanificadosCard({
  endpoint,
  semanaInicio,
  value,
}: {
  endpoint: string;
  semanaInicio: string;
  value: number | null;
}) {
  const { editing } = useEditMode();
  const { mutate } = useApiWrite();
  const [input, setInput] = useState(value === null ? '' : String(value));
  const enFoco = useRef(false);

  // Si el server manda un valor nuevo (post-refresh) y el usuario no está tipeando,
  // adopto el valor fresco. Así no queda pegado en lo viejo hasta recargar.
  useEffect(() => {
    if (!enFoco.current) setInput(value === null ? '' : String(value));
  }, [value]);

  async function guardar() {
    const raw = input.trim();
    // Sin cambios frente a lo que ya está guardado: no vale la pena escribir.
    if (raw === (value === null ? '' : String(value))) return;
    const num = raw === '' ? null : Number(raw);
    if (raw !== '' && !Number.isFinite(num)) return;
    await mutate({ url: endpoint, method: 'PATCH', json: { semana_inicio: semanaInicio, pases_planificados: num } });
  }

  const valorStyle = { fontFamily: FONT.head, fontSize: 32, fontWeight: 700, color: C.navy900, lineHeight: 1.1 } as const;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: C.gray600 }}>Pases planificados</div>
      {editing ? (
        <input
          type="number"
          min={0}
          value={input}
          onFocus={() => {
            enFoco.current = true;
          }}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => {
            enFoco.current = false;
            guardar();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{
            ...valorStyle,
            width: '100%',
            margin: '6px 0 8px',
            padding: '2px 6px',
            border: `1px solid ${C.gray300}`,
            borderRadius: 6,
            background: C.white,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{ ...valorStyle, margin: '6px 0 8px' }}>{value ?? '—'}</div>
      )}
      <div style={{ fontSize: 12.5, color: C.gray600 }}>Esta semana</div>
    </Card>
  );
}
