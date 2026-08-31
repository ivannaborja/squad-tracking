'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONT, fmtPct } from '../../lib/ds-tokens';
import { useEditor } from '../write/EditorContext';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, Modal } from '../write/controls';

// Import de CSV (Flujo 3, 2 fases) en el comparativo `/`. Fase 1 sube el archivo
// y, si hay conflictos con reales corregidos a mano, NO persiste: devuelve un
// token y los conflictos campo por campo. Fase 2 confirma por campo (omitir un
// conflicto = mantener lo manual). Un import cuenta como check-in → refresca los
// colores del comparativo al aplicar.

interface Summary {
  squads_updated: number;
  initiatives_upserted: number;
}
interface Conflicto {
  squad_id: number;
  field: 'delivery_real_pct' | 'discovery_real_pct';
  current_manual_value: number;
  incoming_value: number;
}
type Fase1 =
  | { status: 'applied'; summary: Summary }
  | { status: 'needs_confirmation'; import_token: string; conflicts: Conflicto[]; non_conflicting_preview: Summary };
type Fase2 = { status: 'confirmed'; summary: Summary };

const labelCampo = (f: Conflicto['field']) => (f === 'delivery_real_pct' ? 'Delivery' : 'Discovery');
const claveConflicto = (c: Conflicto) => `${c.squad_id}:${c.field}`;

export function ImportPanel() {
  const router = useRouter();
  const { editadoPor } = useEditor();
  const { pending, error, setError, mutate } = useApiWrite();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fase1, setFase1] = useState<Fase1 | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, boolean>>({});
  const [aplicado, setAplicado] = useState<Summary | null>(null);

  function reset() {
    setFile(null);
    setFase1(null);
    setDecisiones({});
    setAplicado(null);
    setError(null);
  }
  function cerrar() {
    const huboCambios = aplicado !== null;
    setOpen(false);
    reset();
    if (huboCambios) router.refresh();
  }

  async function subir() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('editado_por', editadoPor);
    const r = await mutate<Fase1>({ url: '/api/import', method: 'POST', body: fd, refresh: false });
    if (!r) return;
    if (r.status === 'applied') {
      setAplicado(r.summary);
    } else {
      setFase1(r);
      // Default seguro (SDD): un conflicto sin decidir = mantener lo manual.
      setDecisiones(Object.fromEntries(r.conflicts.map((c) => [claveConflicto(c), false])));
    }
  }

  async function confirmar() {
    if (!fase1 || fase1.status !== 'needs_confirmation') return;
    const decisions = fase1.conflicts.map((c) => ({
      squad_id: c.squad_id,
      field: c.field,
      accept: decisiones[claveConflicto(c)] ?? false,
    }));
    const r = await mutate<Fase2>({
      url: `/api/import/${fase1.import_token}/confirm`,
      method: 'POST',
      json: { decisions, editado_por: editadoPor },
      refresh: false,
    });
    if (r) setAplicado(r.summary);
  }

  async function descartar() {
    if (fase1 && fase1.status === 'needs_confirmation') {
      await mutate({ url: `/api/import/${fase1.import_token}`, method: 'DELETE', refresh: false });
    }
    cerrar();
  }

  return (
    <>
      <Button kind="secondary" onClick={() => setOpen(true)}>
        Importar CSV
      </Button>

      {open && (
        <Modal title="Importar CSV (Smartsheet)" onClose={aplicado || (fase1 && fase1.status === 'needs_confirmation') ? cerrar : () => { setOpen(false); reset(); }}>
          {aplicado ? (
            <Aplicado summary={aplicado} onClose={cerrar} />
          ) : fase1 && fase1.status === 'needs_confirmation' ? (
            <Conflictos
              conflicts={fase1.conflicts}
              decisiones={decisiones}
              setDecisiones={setDecisiones}
              preview={fase1.non_conflicting_preview}
              pending={pending}
              onConfirmar={confirmar}
              onDescartar={descartar}
            />
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14, color: C.gray600 }}>
                Subí el export de Smartsheet. Si algún real ya lo corregiste a mano y el CSV trae otro
                valor, te vamos a pedir confirmación antes de pisarlo.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 14, fontFamily: FONT.body }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={subir} disabled={pending || !file}>
                  {pending ? 'Subiendo…' : 'Subir'}
                </Button>
                <Button kind="secondary" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
                  Cancelar
                </Button>
              </div>
              <span style={{ fontSize: 12, color: C.gray400 }}>Importando como {editadoPor}</span>
            </>
          )}
          <ErrorText error={error} />
        </Modal>
      )}
    </>
  );
}

function Aplicado({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  return (
    <>
      <p style={{ margin: 0, fontSize: 15, color: C.navy900 }}>Import aplicado.</p>
      <p style={{ margin: 0, fontSize: 14, color: C.gray600 }}>
        {summary.squads_updated} squads actualizados · {summary.initiatives_upserted} iniciativas.
      </p>
      <div>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </>
  );
}

function Conflictos({
  conflicts,
  decisiones,
  setDecisiones,
  preview,
  pending,
  onConfirmar,
  onDescartar,
}: {
  conflicts: Conflicto[];
  decisiones: Record<string, boolean>;
  setDecisiones: (d: Record<string, boolean>) => void;
  preview: Summary;
  pending: boolean;
  onConfirmar: () => void;
  onDescartar: () => void;
}) {
  return (
    <>
      <p style={{ margin: 0, fontSize: 14, color: C.gray600 }}>
        Estos reales ya los corregiste a mano y el CSV trae otro valor. Elegí por campo qué conservar.
        Lo no conflictivo ({preview.squads_updated} squads · {preview.initiatives_upserted} iniciativas) se
        aplica igual.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {conflicts.map((c) => {
          const k = `${c.squad_id}:${c.field}`;
          const aceptar = decisiones[k] ?? false;
          return (
            <div key={k} style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy900 }}>
                Squad #{c.squad_id} · {labelCampo(c.field)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <OpcionConflicto
                  activo={!aceptar}
                  onClick={() => setDecisiones({ ...decisiones, [k]: false })}
                  titulo="Mantener manual"
                  valor={fmtPct(c.current_manual_value)}
                />
                <OpcionConflicto
                  activo={aceptar}
                  onClick={() => setDecisiones({ ...decisiones, [k]: true })}
                  titulo="Aceptar del CSV"
                  valor={fmtPct(c.incoming_value)}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onConfirmar} disabled={pending}>
          {pending ? 'Confirmando…' : 'Confirmar import'}
        </Button>
        <Button kind="danger" onClick={onDescartar} disabled={pending}>
          Descartar
        </Button>
      </div>
    </>
  );
}

function OpcionConflicto({ activo, onClick, titulo, valor }: { activo: boolean; onClick: () => void; titulo: string; valor: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 160px',
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 6,
        border: `1px solid ${activo ? C.navy700 : C.gray300}`,
        background: activo ? C.navy050 : C.white,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 12, color: C.gray600 }}>{titulo}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: C.navy900 }}>{valor}</div>
    </button>
  );
}
