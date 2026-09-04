'use client';

import { useState } from 'react';
import { C } from '../../lib/ds-tokens';
import { SectionTitle, Mono } from '../ds';
import { Tabla } from './shared';
import { useEditMode } from '../write/EditMode';
import { useApiWrite } from '../write/useApiWrite';
import { Button, DateField, ErrorText, Modal, RowAction, SectionHeader, SelectField, TextAreaField } from '../write/controls';
import type { BloqueoItem } from '../../services/report/types';

const SEVERIDADES = [
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'BAJA', label: 'Baja' },
];

const sevLabel = (s: string): string => (s ? s.charAt(0) + s.slice(1).toLowerCase() : 's/d');

// Bloqueos del squad: entidad estructurada (severidad, squads afectados, desde/hasta).
// Un bloqueo puede pegarle a varios squads a la vez (multi-select). Crear/editar no
// toca el semáforo. Se puede resolver (marca resuelto + fecha) o quitar.
export function BloqueosSection({
  squadId,
  bloqueos,
  squads,
}: {
  squadId: number;
  bloqueos: BloqueoItem[];
  squads: { id: number; nombre: string }[];
}) {
  const { editing } = useEditMode();
  const { pending, error, mutate } = useApiWrite();
  const [form, setForm] = useState<'new' | BloqueoItem | null>(null);

  const columnas = ['Bloqueo', 'Severidad', 'Desde', 'Hasta', 'Estado'];
  const fila = (b: BloqueoItem) => [
    <span key="desc">
      {b.descripcion}
      {b.notaResolucion && (
        <span style={{ display: 'block', fontSize: 12, color: C.gray600, marginTop: 4 }}>
          Resolución: {b.notaResolucion}
        </span>
      )}
    </span>,
    sevLabel(b.severidad),
    <Mono key="d">{b.desde ?? '—'}</Mono>,
    <Mono key="h">{b.hasta ?? '—'}</Mono>,
    b.resuelto ? 'Resuelto' : 'Activo',
  ];

  if (!editing) {
    return (
      <>
        <SectionTitle>Bloqueos</SectionTitle>
        <Tabla columnas={columnas} filas={bloqueos.map(fila)} vacio="Sin bloqueos." />
      </>
    );
  }

  async function resolver(id: number) {
    await mutate({ url: `/api/bloqueos/${id}`, method: 'PATCH', json: { resuelto: true } });
  }

  return (
    <>
      <SectionHeader title="Bloqueos" action={<RowAction onClick={() => setForm('new')}>+ agregar bloqueo</RowAction>} />
      <Tabla
        columnas={[...columnas, 'Acciones']}
        filas={bloqueos.map((b) => [
          ...fila(b),
          <span key="a" style={{ display: 'flex', gap: 4 }}>
            <RowAction onClick={() => setForm(b)}>Editar</RowAction>
            {!b.resuelto && <RowAction onClick={() => resolver(b.id)}>Resuelto</RowAction>}
            <RowAction danger onClick={() => mutate({ url: `/api/bloqueos/${b.id}`, method: 'DELETE' })}>
              Quitar
            </RowAction>
          </span>,
        ])}
        vacio="Sin bloqueos."
      />
      <ErrorText error={error} />

      {form && (
        <BloqueoForm
          inicial={form === 'new' ? null : form}
          squads={squads}
          squadActual={squadId}
          pending={pending}
          onCancel={() => setForm(null)}
          onSubmit={async (body, id) => {
            const ok = await mutate(
              id
                ? { url: `/api/bloqueos/${id}`, method: 'PATCH', json: body }
                : { url: '/api/bloqueos', method: 'POST', json: body }
            );
            if (ok !== null) setForm(null);
          }}
        />
      )}
    </>
  );
}

function BloqueoForm({
  inicial,
  squads,
  squadActual,
  pending,
  onCancel,
  onSubmit,
}: {
  inicial: BloqueoItem | null;
  squads: { id: number; nombre: string }[];
  squadActual: number;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>, id?: number) => void;
}) {
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [severidad, setSeveridad] = useState(inicial?.severidad || 'MEDIA');
  const [desde, setDesde] = useState(inicial?.desde ?? '');
  const [hasta, setHasta] = useState(inicial?.hasta ?? '');
  const [nota, setNota] = useState(inicial?.notaResolucion ?? '');
  const [squadIds, setSquadIds] = useState<number[]>(inicial?.squadIds ?? [squadActual]);

  const valido = descripcion.trim() && severidad && squadIds.length > 0;

  function toggleSquad(id: number) {
    setSquadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    onSubmit(
      {
        descripcion,
        severidad,
        desde: desde || null,
        hasta: hasta || null,
        nota_resolucion: nota || null,
        squad_ids: squadIds,
      },
      inicial?.id
    );
  }

  return (
    <Modal title={inicial ? 'Editar bloqueo' : 'Nuevo bloqueo'} onClose={onCancel} width={620}>
      <TextAreaField label="Descripción" value={descripcion} onChange={setDescripcion} rows={2} />

      <div style={{ maxWidth: 200 }}>
        <SelectField label="Severidad" value={severidad} onChange={setSeveridad} options={SEVERIDADES} />
      </div>

      <TextAreaField label="Nota de resolución (opcional)" value={nota} onChange={setNota} rows={2} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <DateField label="Desde (opcional)" value={desde} onChange={setDesde} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <DateField label="Hasta (opcional)" value={hasta} onChange={setHasta} />
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
          {pending ? 'Guardando…' : inicial ? 'Guardar' : 'Crear bloqueo'}
        </Button>
        <Button kind="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
