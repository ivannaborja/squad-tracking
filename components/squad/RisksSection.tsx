'use client';

import { useState } from 'react';
import { C, FONT } from '../../lib/ds-tokens';
import { SectionTitle, Mono } from '../ds';
import { Tabla } from './shared';
import { useEditMode } from '../write/EditMode';
import { useApiWrite } from '../write/useApiWrite';
import { Button, DateField, ErrorText, Modal, RowAction, SectionHeader, SelectField, TextAreaField, TextField } from '../write/controls';
import type { RiskItem } from '../../services/report/types';

const SEVERIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];
const TIPOS = [
  { value: 'riesgo', label: 'Riesgo' },
  { value: 'bloqueo', label: 'Bloqueo' },
  { value: 'incidencia', label: 'Incidencia' },
];

// Riesgos y bloqueos del squad (Flujo 4). Un riesgo puede pegarle a varios squads
// (multi-select), y crear/editar/resolver recomputa el color de los afectados
// (write-through en el backend). categoria_impacto='ingresos' es el único
// disparador de 🔴, y el match es exacto: por eso es opción fija, no texto libre.
export function RisksSection({
  squadId,
  risks,
  squads,
  semanaActual,
}: {
  squadId: number;
  risks: RiskItem[];
  squads: { id: number; nombre: string }[];
  semanaActual: string;
}) {
  const { editing } = useEditMode();
  const { pending, error, mutate } = useApiWrite();
  const [form, setForm] = useState<'new' | RiskItem | null>(null);

  const columnasBase = ['Riesgo', 'Categoría', 'Severidad', 'Responsable', 'Tipo', 'Vence', 'Estado'];

  function filaBase(r: RiskItem) {
    return [
      r.descripcion,
      r.categoriaImpacto,
      r.severidad || '—',
      r.dueno || '—',
      r.tipo,
      <Mono key="v">{r.semanaFin}</Mono>,
      r.resuelto ? 'Resuelto' : 'Abierto',
    ];
  }

  if (!editing) {
    return (
      <>
        <SectionTitle>Riesgos y bloqueos</SectionTitle>
        <Tabla columnas={columnasBase} filas={risks.map(filaBase)} vacio="Sin riesgos cargados." />
      </>
    );
  }

  async function resolver(id: number) {
    await mutate({ url: `/api/risks/${id}`, method: 'PATCH', json: { resuelto: true } });
  }

  return (
    <>
      <SectionHeader title="Riesgos y bloqueos" action={<RowAction onClick={() => setForm('new')}>+ agregar riesgo</RowAction>} />
      <Tabla
        columnas={[...columnasBase, 'Acciones']}
        filas={risks.map((r) => [
          ...filaBase(r),
          <span key="a" style={{ display: 'flex', gap: 4 }}>
            <RowAction onClick={() => setForm(r)}>Editar</RowAction>
            {!r.resuelto && <RowAction onClick={() => resolver(r.id)}>Resolver</RowAction>}
          </span>,
        ])}
        vacio="Sin riesgos cargados."
      />
      <ErrorText error={error} />

      {form && (
        <RiskForm
          inicial={form === 'new' ? null : form}
          squads={squads}
          squadActual={squadId}
          semanaActual={semanaActual}
          pending={pending}
          onCancel={() => setForm(null)}
          onSubmit={async (body, id) => {
            const ok = await mutate(
              id
                ? { url: `/api/risks/${id}`, method: 'PATCH', json: body }
                : { url: '/api/risks', method: 'POST', json: body }
            );
            if (ok !== null) setForm(null);
          }}
        />
      )}
    </>
  );
}

function RiskForm({
  inicial,
  squads,
  squadActual,
  semanaActual,
  pending,
  onCancel,
  onSubmit,
}: {
  inicial: RiskItem | null;
  squads: { id: number; nombre: string }[];
  squadActual: number;
  semanaActual: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>, id?: number) => void;
}) {
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const esIngresos = inicial ? inicial.categoriaImpacto === 'ingresos' : false;
  const [catModo, setCatModo] = useState<'ingresos' | 'otra'>(esIngresos ? 'ingresos' : 'otra');
  const [catOtra, setCatOtra] = useState(esIngresos ? '' : (inicial?.categoriaImpacto ?? ''));
  const [severidad, setSeveridad] = useState(inicial?.severidad || 'media');
  const [tipo, setTipo] = useState(inicial?.tipo || 'riesgo');
  const [accionProxima, setAccionProxima] = useState(inicial?.accionProxima ?? '');
  const [checkpoint, setCheckpoint] = useState(inicial?.checkpoint ?? '');
  const [dueno, setDueno] = useState(inicial?.dueno ?? '');
  const [semanaInicio, setSemanaInicio] = useState(inicial?.semanaInicio ?? semanaActual);
  const [semanaFin, setSemanaFin] = useState(inicial?.semanaFin ?? semanaActual);
  const [squadIds, setSquadIds] = useState<number[]>(inicial?.squadIds ?? [squadActual]);

  const categoria = catModo === 'ingresos' ? 'ingresos' : catOtra.trim();
  const valido =
    descripcion.trim() && categoria && accionProxima.trim() && checkpoint.trim() && dueno.trim() && semanaInicio && semanaFin && squadIds.length > 0;

  function toggleSquad(id: number) {
    setSquadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    onSubmit(
      {
        descripcion,
        categoria_impacto: categoria,
        severidad,
        tipo,
        accion_proxima: accionProxima,
        checkpoint,
        dueno,
        semana_inicio: semanaInicio,
        semana_fin: semanaFin,
        squad_ids: squadIds,
      },
      inicial?.id
    );
  }

  return (
    <Modal title={inicial ? 'Editar riesgo' : 'Nuevo riesgo'} onClose={onCancel} width={620}>
      <TextAreaField label="Descripción" value={descripcion} onChange={setDescripcion} rows={2} />

      <div>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 4 }}>
          Categoría de impacto
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={catModo}
            onChange={(e) => setCatModo(e.target.value as 'ingresos' | 'otra')}
            style={{ height: 36, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.gray300}`, background: C.white, fontSize: 14, fontFamily: FONT.body }}
          >
            <option value="ingresos">ingresos (dispara 🔴)</option>
            <option value="otra">Otra…</option>
          </select>
          {catModo === 'otra' && (
            <input
              value={catOtra}
              onChange={(e) => setCatOtra(e.target.value)}
              placeholder="ej. plazos, alcance…"
              style={{ flex: '1 1 200px', height: 36, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.gray300}`, fontSize: 14, fontFamily: FONT.body }}
            />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <SelectField label="Severidad" value={severidad} onChange={setSeveridad} options={SEVERIDADES} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <SelectField label="Tipo" value={tipo} onChange={setTipo} options={TIPOS} />
        </div>
      </div>

      <TextField label="Responsable" value={dueno} onChange={setDueno} />
      <TextField label="Acción próxima" value={accionProxima} onChange={setAccionProxima} />
      <TextField label="Checkpoint" value={checkpoint} onChange={setCheckpoint} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <DateField label="Desde" value={semanaInicio} onChange={setSemanaInicio} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <DateField label="Hasta" value={semanaFin} onChange={setSemanaFin} />
        </div>
      </div>

      <div>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 6 }}>
          Squads afectados
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {squads.map((s) => (
            <label key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.gray900 }}>
              <input type="checkbox" checked={squadIds.includes(s.id)} onChange={() => toggleSquad(s.id)} />
              {s.nombre}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button onClick={submit} disabled={pending || !valido}>
          {pending ? 'Guardando…' : inicial ? 'Guardar' : 'Crear riesgo'}
        </Button>
        <Button kind="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
