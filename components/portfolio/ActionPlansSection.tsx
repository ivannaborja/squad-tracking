'use client';

import { useState, type ReactNode } from 'react';
import { C } from '../../lib/ds-tokens';
import { hoyISO, inicioDeSemana } from '../../lib/dates';
import { Card } from '../ds';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, RowAction, SectionHeader, TextField } from '../write/controls';
import type { ActionPlanItem } from '../../services/report/types';

// Planes de acción (mejora continua): de PORTAFOLIO, sin squad. Por eso se editan
// en el comparativo `/` (único lugar de escritura de portafolio) y no en cada
// squad. A diferencia del detalle de squad, acá la edición está siempre a mano
// (no hay toggle de modo): "+ agregar" y editar/resolver por fila.

interface Form {
  descripcion: string;
  dueno: string;
  plazo: string;
  estado: string;
}

const vacio: Form = { descripcion: '', dueno: '', plazo: '', estado: '' };

export function ActionPlansSection({ actionPlans }: { actionPlans: ActionPlanItem[] }) {
  const { pending, error, mutate } = useApiWrite();
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState<Form>(vacio);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Form>(vacio);

  async function crear() {
    const ok = await mutate({
      url: '/api/action-plans',
      method: 'POST',
      json: { ...nuevo, semana_inicio: inicioDeSemana(hoyISO()) },
    });
    if (ok !== null) {
      setAdding(false);
      setNuevo(vacio);
    }
  }

  async function guardar(id: number) {
    const ok = await mutate({ url: `/api/action-plans/${id}`, method: 'PATCH', json: editForm });
    if (ok !== null) setEditId(null);
  }

  return (
    <>
      <SectionHeader
        title="Planes de acción (portafolio)"
        action={!adding ? <RowAction onClick={() => setAdding(true)}>+ agregar</RowAction> : null}
      />

      {actionPlans.length === 0 && !adding ? (
        <p style={{ fontSize: 14, color: C.gray400, fontStyle: 'italic', margin: 0 }}>Sin planes de acción.</p>
      ) : (
        <Card style={{ padding: '4px 0' }}>
          {actionPlans.map((p, i) => (
            <div key={p.id} style={{ padding: '10px 20px', borderTop: i === 0 ? 'none' : `1px solid ${C.gray200}` }}>
              {editId === p.id ? (
                <PlanForm form={editForm} setForm={setEditForm}>
                  <Button onClick={() => guardar(p.id)} disabled={pending}>Guardar</Button>
                  <Button kind="secondary" onClick={() => setEditId(null)} disabled={pending}>Cancelar</Button>
                </PlanForm>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, opacity: p.resuelto ? 0.6 : 1 }}>
                  <span style={{ fontSize: 14, color: C.gray900 }}>
                    {p.descripcion} <span style={{ color: C.gray600 }}>— {p.dueno || 's/d'} · {p.plazo} · {p.estado}{p.resuelto ? ' (resuelto)' : ''}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <RowAction
                      onClick={() => {
                        setEditId(p.id);
                        setEditForm({ descripcion: p.descripcion, dueno: p.dueno, plazo: p.plazo, estado: p.estado });
                      }}
                    >
                      Editar
                    </RowAction>
                    {!p.resuelto && (
                      <RowAction onClick={() => mutate({ url: `/api/action-plans/${p.id}`, method: 'PATCH', json: { resuelto: true } })}>
                        Resolver
                      </RowAction>
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}

          {adding && (
            <div style={{ padding: '12px 20px', borderTop: actionPlans.length ? `1px solid ${C.gray200}` : 'none', background: C.gray050 }}>
              <PlanForm form={nuevo} setForm={setNuevo}>
                <Button onClick={crear} disabled={pending}>Agregar</Button>
                <Button kind="secondary" onClick={() => { setAdding(false); setNuevo(vacio); }} disabled={pending}>Cancelar</Button>
              </PlanForm>
            </div>
          )}
        </Card>
      )}
      <ErrorText error={error} />
    </>
  );
}

function PlanForm({ form, setForm, children }: { form: Form; setForm: (f: Form) => void; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TextField label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <TextField label="Responsable" value={form.dueno} onChange={(v) => setForm({ ...form, dueno: v })} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <TextField label="Plazo" value={form.plazo} onChange={(v) => setForm({ ...form, plazo: v })} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <TextField label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  );
}
