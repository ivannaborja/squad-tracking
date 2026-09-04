'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { C, FONT } from '../../lib/ds-tokens';
import { useEditMode } from '../write/EditMode';
import { useNavGuard } from './NavGuard';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, TextField } from '../write/controls';

// Estilo del textarea, alineado al de write/controls (que no lo exporta). Se
// replica acá porque los campos de texto llevan un layout propio (label + botón
// "• Lista") en vez del <Field> estándar.
const textareaStyle = {
  width: '100%',
  padding: 10,
  borderRadius: 6,
  border: `1px solid ${C.gray300}`,
  background: C.white,
  color: C.gray900,
  fontSize: 14,
  fontFamily: FONT.body,
  boxSizing: 'border-box' as const,
  resize: 'vertical' as const,
};

// Campo de texto multilínea con lista viva: el botón "• Lista" pone o quita la
// viñeta de la línea donde está el cursor, y al presionar Enter en una línea con
// viñeta se crea otra automáticamente. Enter en una viñeta vacía sale de la lista.
function CampoTextoEditor({
  label,
  value,
  onChange,
  ocultarLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ocultarLabel?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caretPendiente = useRef<number | null>(null);

  // Reposiciona el cursor tras un cambio controlado (insertar/quitar viñeta cambia
  // el texto, y el caret hay que fijarlo a mano después del re-render).
  useEffect(() => {
    if (caretPendiente.current !== null && ref.current) {
      ref.current.selectionStart = ref.current.selectionEnd = caretPendiente.current;
      caretPendiente.current = null;
    }
  });

  // Auto-crecer: la caja se ajusta al alto del contenido, para cargar textos largos
  // (novedades, pases) sin quedar chica ni depender de scroll interno.
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  function aplicar(nuevo: string, caret: number) {
    caretPendiente.current = caret;
    onChange(nuevo);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineaActual = value.slice(lineStart, start);
    if (!lineaActual.startsWith('• ')) return; // fuera de una lista: Enter normal
    e.preventDefault();
    if (lineaActual.trim() === '•') {
      // viñeta vacía → salir de la lista: borra el "• " de la línea
      aplicar(value.slice(0, lineStart) + value.slice(start), lineStart);
    } else {
      // continuar la lista: salto de línea ya con viñeta
      const ins = '\n• ';
      aplicar(value.slice(0, start) + ins + value.slice(end), start + ins.length);
    }
  }

  function toggleLista() {
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    const rel = value.slice(lineStart).indexOf('\n');
    const lineEnd = rel === -1 ? value.length : lineStart + rel;
    const linea = value.slice(lineStart, lineEnd);
    if (linea.startsWith('• ')) {
      aplicar(value.slice(0, lineStart) + linea.slice(2) + value.slice(lineEnd), Math.max(lineStart, pos - 2));
    } else {
      aplicar(value.slice(0, lineStart) + '• ' + linea + value.slice(lineEnd), pos + 2);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: ocultarLabel ? 'flex-end' : 'space-between', alignItems: 'center', marginBottom: 4 }}>
        {!ocultarLabel && <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>{label}</span>}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleLista}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: C.navy700, textDecoration: 'underline' }}
        >
          • Lista
        </button>
      </div>
      <textarea ref={ref} style={textareaStyle} rows={3} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
    </div>
  );
}

// Render de lectura de un campo de texto: como <ul> si tiene viñetas, si no como
// párrafo con saltos preservados (comportamiento anterior).
function TextoLectura({ value }: { value: string }) {
  const lineas = value.split('\n');
  if (lineas.some((l) => l.startsWith('• '))) {
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {lineas
          .filter((l) => l.trim() !== '')
          .map((l, i) => (
            <li key={i} style={{ fontSize: 14, color: C.gray900 }}>
              {l.startsWith('• ') ? l.slice(2) : l}
            </li>
          ))}
      </ul>
    );
  }
  return <p style={{ margin: 0, fontSize: 14, color: C.gray900, whiteSpace: 'pre-wrap' }}>{value}</p>;
}

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
  ocultarLabel,
}: {
  endpoint: string;
  semanaInicio: string;
  campos: Campo[];
  onDirtyChange?: (dirty: boolean) => void;
  historiaTabla: string;
  historiaRegistroId: number | null;
  // Oculta el label interno del campo (para usar un título de sección externo y
  // uniforme, ej. en la página del squad). Sólo aplica a un editor de un campo.
  ocultarLabel?: boolean;
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
  // Espejo del baseline para leerlo dentro del efecto de sync sin volverlo dependencia.
  const baselineRef = useRef(baseline);
  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  // Modo edición LOCAL de la sección: al entrar al modo edición global se abre; al
  // Guardar se colapsa a lectura mostrando lo guardado (aunque el modo global siga
  // activo), y desde la lectura se puede reabrir con "Editar".
  const [abierto, setAbierto] = useState(false);
  // Sincroniza "abierto" con el modo global sin efecto (ajuste en render): cuando el
  // modo global cambia, la sección se abre/cierra acorde; entre medio manda lo local.
  const [modoPrev, setModoPrev] = useState(editing);
  if (modoPrev !== editing) {
    setModoPrev(editing);
    setAbierto(editing);
  }
  const enEdicion = editing && abierto;

  const dirty = enEdicion && campos.some((c) => (form[c.key] ?? '') !== (baseline[c.key] ?? ''));

  // Sync con el server: cuando router.refresh() trae valores nuevos (tras guardar
  // acá o en otra card), el estado local los adopta en vez de quedar pegado en lo
  // viejo hasta recargar. Los campos con edición sin guardar (form ≠ baseline) se
  // respetan: sólo se pisan los que estaban "limpios".
  const serverSig = campos.map((c) => `${c.key}${c.value}`).join(' ');
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) {
      // El primer render ya quedó sembrado por los useState; no hay nada que adoptar.
      montado.current = true;
      return;
    }
    setForm((prev) => {
      const next = { ...prev };
      for (const c of campos) {
        if ((prev[c.key] ?? '') === (baselineRef.current[c.key] ?? '')) next[c.key] = c.value;
      }
      return next;
    });
    setBaseline(Object.fromEntries(campos.map((c) => [c.key, c.value])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig]);

  // Empuja el estado sucio al guard de navegación (y al callback opcional). Salir
  // del modo edición deja dirty en false, así el back link no molesta en lectura.
  useEffect(() => {
    setDirty(dirty);
    onDirtyChange?.(dirty);
    return () => {
      setDirty(false);
    };
  }, [dirty, setDirty, onDirtyChange]);

  if (!enEdicion) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {editing && (
          <div>
            <button
              type="button"
              onClick={() => setAbierto(true)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.navy700, textDecoration: 'underline' }}
            >
              Editar
            </button>
          </div>
        )}
        {campos.map((c) => (
          <div key={c.key}>
            {!ocultarLabel && (
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray600, marginBottom: 4 }}>
                {c.label}
              </div>
            )}
            {c.value.trim() ? (
              // Tarjeta de fondo suave: deja claro que es texto escrito por Dai, no
              // parte del label/título de arriba.
              <div style={{ background: C.gray050, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: '10px 14px' }}>
                {c.tipo === 'texto' ? (
                  <TextoLectura value={c.value} />
                ) : (
                  <p style={{ margin: 0, fontSize: 14, color: C.gray900, whiteSpace: 'pre-wrap' }}>{c.value}</p>
                )}
              </div>
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
    // Guardado ok → lo escrito pasa a ser el nuevo baseline (ya no hay pendientes)
    // y la sección colapsa a lectura mostrando lo guardado.
    if (ok) {
      setBaseline({ ...form });
      setAbierto(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {campos.map((c) =>
        c.tipo === 'numero' ? (
          <div key={c.key} style={{ maxWidth: 220 }}>
            <TextField label={c.label} value={form[c.key]} onChange={(v) => setForm({ ...form, [c.key]: v })} placeholder="número" />
          </div>
        ) : (
          <CampoTextoEditor key={c.key} label={c.label} value={form[c.key] ?? ''} onChange={(v) => setForm({ ...form, [c.key]: v })} ocultarLabel={ocultarLabel} />
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
