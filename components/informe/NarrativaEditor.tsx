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
// En lectura, cada campo ofrece "Ver historial" (últimas versiones previas) si el
// registro ya fue guardado alguna vez (historiaRegistroId no es null).
export function NarrativaEditor({
  endpoint,
  semanaInicio,
  campos,
  onDirtyChange,
  historiaTabla,
  historiaRegistroId,
}: {
  endpoint: string;
  semanaInicio: string;
  campos: Campo[];
  onDirtyChange?: (dirty: boolean) => void;
  historiaTabla: string;
  historiaRegistroId: number | null;
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
            {historiaRegistroId !== null && (
              <HistorialCampo tabla={historiaTabla} registroId={historiaRegistroId} campo={c.key} />
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

interface Entrada {
  id: number;
  valorAnterior: string | null;
  valorNuevo: string | null;
  cambiadoEn: string;
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Toggle "Ver historial" de un campo: al abrir, trae las últimas versiones previas
// del endpoint de historia. Se pide sólo la primera vez que se abre.
function HistorialCampo({ tabla, registroId, campo }: { tabla: string; registroId: number; campo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [cargando, setCargando] = useState(false);

  async function toggle() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    if (entradas === null) {
      setCargando(true);
      const qs = new URLSearchParams({ tabla, id: String(registroId), campo });
      const res = await fetch(`/api/informe/historia?${qs}`).catch(() => null);
      const data = res && res.ok ? ((await res.json().catch(() => [])) as Entrada[]) : [];
      setEntradas(data);
      setCargando(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={toggle}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: C.navy700, textDecoration: 'underline' }}
      >
        {abierto ? 'Ocultar' : 'Ver historial'}
      </button>
      {abierto && (
        <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${C.gray200}` }}>
          {cargando ? (
            <p style={{ margin: 0, fontSize: 12, color: C.gray400 }}>Cargando…</p>
          ) : !entradas || entradas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: C.gray400, fontStyle: 'italic' }}>Sin cambios anteriores.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entradas.map((e) => (
                <li key={e.id} style={{ fontSize: 12, color: C.gray600 }}>
                  <span style={{ color: C.gray400 }}>{fmtFecha(e.cambiadoEn)}</span>{' · '}
                  {e.valorAnterior && e.valorAnterior.trim() ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{e.valorAnterior}</span>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: C.gray400 }}>(vacío)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
