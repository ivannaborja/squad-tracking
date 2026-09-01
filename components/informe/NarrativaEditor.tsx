'use client';

import { useEffect, useState } from 'react';
import { C } from '../../lib/ds-tokens';
import { useEditMode } from '../write/EditMode';
import { useNavGuard } from './NavGuard';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, TextAreaField, TextField } from '../write/controls';

// Un campo de narrativa. `texto` es multilínea; `numero` es el KPI manual.
export interface Campo {
  key: string; // clave del body de la API (snake_case)
  label: string;
  tipo: 'texto' | 'numero';
  value: string;
}

// Editor de las secciones narrativas del informe (general o squad). En lectura
// muestra lo que escribió Dai; con el modo edición activo, inputs + guardar. El
// endpoint upsertea por semana, así que siempre manda la semana del informe.
export function NarrativaEditor({
  endpoint,
  semanaInicio,
  campos,
  onDirtyChange,
}: {
  endpoint: string;
  semanaInicio: string;
  campos: Campo[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { editing } = useEditMode();
  const { setDirty } = useNavGuard();
  const { pending, error, mutate } = useApiWrite();
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.key, c.value]))
  );
  // Baseline de "guardado": arranca en los valores iniciales y se reafirma tras
  // cada guardado exitoso, así el guard sabe si hay cambios pendientes reales.
  const [baseline, setBaseline] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.key, c.value]))
  );

  const dirty = editing && campos.some((c) => (form[c.key] ?? '') !== (baseline[c.key] ?? ''));

  // Empuja el estado sucio al guard de navegación (y al callback opcional). Salir
  // del modo edición deja dirty en false, así el back link no molesta en lectura.
  useEffect(() => {
    setDirty(dirty);
    onDirtyChange?.(dirty);
    return () => {
      setDirty(false);
    };
  }, [dirty, setDirty, onDirtyChange]);

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {campos.map((c) => (
          <div key={c.key}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray600, marginBottom: 4 }}>
              {c.label}
            </div>
            {c.value.trim() ? (
              <p style={{ margin: 0, fontSize: 14, color: C.gray900, whiteSpace: 'pre-wrap' }}>{c.value}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: C.gray400, fontStyle: 'italic' }}>Sin cargar.</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  async function guardar() {
    const body: Record<string, unknown> = { semana_inicio: semanaInicio };
    for (const c of campos) body[c.key] = form[c.key];
    const ok = await mutate({ url: endpoint, method: 'PATCH', json: body });
    // Guardado ok → lo escrito pasa a ser el nuevo baseline (ya no hay pendientes).
    if (ok) setBaseline({ ...form });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {campos.map((c) =>
        c.tipo === 'numero' ? (
          <div key={c.key} style={{ maxWidth: 220 }}>
            <TextField label={c.label} value={form[c.key]} onChange={(v) => setForm({ ...form, [c.key]: v })} placeholder="número" />
          </div>
        ) : (
          <TextAreaField key={c.key} label={c.label} value={form[c.key]} onChange={(v) => setForm({ ...form, [c.key]: v })} rows={3} />
        )
      )}
      <div>
        <Button onClick={guardar} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}
