'use client';

import { useState } from 'react';
import { C } from '../../lib/ds-tokens';
import { Card, SectionTitle } from '../ds';
import { ListaSimple, Vacio } from '../squad/shared';
import { useEditMode } from './EditMode';
import { useApiWrite } from './useApiWrite';
import { Button, DateField, ErrorText, RowAction, SectionHeader, TextField } from './controls';

// Las colecciones simples del squad (needs, logros, entregas, intake) comparten
// el mismo patrón: listar, agregar, editar por campo, y resolver (needs) o quitar
// (las que tienen DELETE). Esto centraliza ese plumbing para no repetirlo 4 veces;
// cada sección sólo declara sus campos, su endpoint y cómo se lee una fila.

export interface FieldSpec {
  key: string; // clave del estado del form
  label: string;
  type: 'text' | 'date';
  apiKey: string; // clave del body de la API (snake_case)
}

interface Props<Item extends { id: number }> {
  title: string;
  items: Item[];
  fields: FieldSpec[];
  endpoint: string; // ej. '/api/needs'
  emptyText: string;
  // Extra fijo del POST (squad_id, semana_inicio): no se edita, se agrega al crear.
  createExtra: () => Record<string, unknown>;
  // Valores iniciales del form de edición a partir del item.
  toForm: (item: Item) => Record<string, string>;
  // La línea de lectura (idéntica a la vista read-only de B0).
  readLine: (item: Item) => string;
  resolvable?: (item: Item) => boolean; // devuelve `resuelto`; si se pasa, ofrece "Resolver"
  deletable?: boolean; // si true, ofrece "Quitar" (DELETE endpoint/{id})
}

export function EditableCollection<Item extends { id: number }>(p: Props<Item>) {
  const { editing } = useEditMode();
  const { pending, error, mutate } = useApiWrite();

  const vacioForm = () => Object.fromEntries(p.fields.map((f) => [f.key, ''])) as Record<string, string>;
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<Record<string, string>>(vacioForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  if (!editing) {
    return (
      <>
        <SectionTitle>{p.title}</SectionTitle>
        <ListaSimple items={p.items.map(p.readLine)} vacio={p.emptyText} />
      </>
    );
  }

  async function crear() {
    const body: Record<string, unknown> = { ...p.createExtra() };
    for (const f of p.fields) body[f.apiKey] = newForm[f.key];
    const ok = await mutate({ url: p.endpoint, method: 'POST', json: body });
    if (ok !== null) {
      setAdding(false);
      setNewForm(vacioForm());
    }
  }

  async function guardar(id: number) {
    const body: Record<string, unknown> = {};
    for (const f of p.fields) body[f.apiKey] = editForm[f.key];
    const ok = await mutate({ url: `${p.endpoint}/${id}`, method: 'PATCH', json: body });
    if (ok !== null) setEditId(null);
  }

  const camposForm = (form: Record<string, string>, set: (f: Record<string, string>) => void) => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {p.fields.map((f) =>
        f.type === 'date' ? (
          <div key={f.key} style={{ flex: '0 0 auto' }}>
            <DateField label={f.label} value={form[f.key] ?? ''} onChange={(v) => set({ ...form, [f.key]: v })} />
          </div>
        ) : (
          <div key={f.key} style={{ flex: '1 1 200px' }}>
            <TextField label={f.label} value={form[f.key] ?? ''} onChange={(v) => set({ ...form, [f.key]: v })} />
          </div>
        )
      )}
    </div>
  );

  return (
    <>
      <SectionHeader
        title={p.title}
        action={
          !adding ? (
            <RowAction onClick={() => setAdding(true)}>+ agregar</RowAction>
          ) : null
        }
      />

      {p.items.length === 0 && !adding ? (
        <Vacio texto={p.emptyText} />
      ) : (
        <Card style={{ padding: '4px 0' }}>
          {p.items.map((item, i) => (
            <div
              key={item.id}
              style={{ padding: '10px 20px', borderTop: i === 0 ? 'none' : `1px solid ${C.gray200}` }}
            >
              {editId === item.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {camposForm(editForm, setEditForm)}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={() => guardar(item.id)} disabled={pending}>
                      Guardar
                    </Button>
                    <Button kind="secondary" onClick={() => setEditId(null)} disabled={pending}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: C.gray900 }}>{p.readLine(item)}</span>
                  <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <RowAction
                      onClick={() => {
                        setEditId(item.id);
                        setEditForm(p.toForm(item));
                      }}
                    >
                      Editar
                    </RowAction>
                    {p.resolvable && !p.resolvable(item) && (
                      <RowAction
                        onClick={() => mutate({ url: `${p.endpoint}/${item.id}`, method: 'PATCH', json: { resuelto: true } })}
                      >
                        Resolver
                      </RowAction>
                    )}
                    {p.deletable && (
                      <RowAction danger onClick={() => mutate({ url: `${p.endpoint}/${item.id}`, method: 'DELETE' })}>
                        Quitar
                      </RowAction>
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}

          {adding && (
            <div style={{ padding: '12px 20px', borderTop: p.items.length ? `1px solid ${C.gray200}` : 'none', background: C.gray050 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {camposForm(newForm, setNewForm)}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={crear} disabled={pending}>
                    Agregar
                  </Button>
                  <Button kind="secondary" onClick={() => { setAdding(false); setNewForm(vacioForm()); }} disabled={pending}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
      <ErrorText error={error} />
    </>
  );
}
