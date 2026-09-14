'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONT } from '../../lib/ds-tokens';
import { useApiWrite } from '../write/useApiWrite';
import { Button, ErrorText, Modal } from '../write/controls';

// Import del .xlsx de Smartsheet en el comparativo `/`. Espejo fiel: una sola fase,
// sin conflictos ni edición manual — se escribe lo que trae la planilla. Un import
// cuenta como check-in → refresca los colores del comparativo al aplicar.

interface Summary {
  squads_updated: number;
  initiatives_upserted: number;
}
type Resultado = { status: 'applied'; summary: Summary; warnings: string[] };

export function ImportPanel() {
  const router = useRouter();
  const { pending, error, setError, mutate } = useApiWrite();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [aplicado, setAplicado] = useState<Summary | null>(null);
  // Lo que el adaptador no pudo leer con confianza (o no importa aún): se muestra
  // al aplicar, en vez de esconder el hueco.
  const [warnings, setWarnings] = useState<string[]>([]);

  function reset() {
    setFile(null);
    setAplicado(null);
    setWarnings([]);
    setError(null);
  }
  function cerrar() {
    const huboCambios = aplicado !== null;
    setOpen(false);
    reset();
    if (huboCambios) router.refresh();
  }

  // confirmar=true cuando el usuario ya vio el aviso de "archivo más viejo" y decidió
  // importar igual; el backend saltea el guard con ese flag.
  async function subir(confirmar = false) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('editado_por', 'sistema');
    if (confirmar) fd.append('confirmar', 'true');
    const r = await mutate<Resultado>({ url: '/api/import', method: 'POST', body: fd, refresh: false });
    if (!r) return;
    setWarnings(r.warnings ?? []);
    setAplicado(r.summary);
  }

  // El backend responde 409 stale_file cuando el .xlsx es más viejo que el último
  // importado; en vez de error crudo, se ofrece confirmar (mensaje trae las fechas).
  const esArchivoViejo = error?.code === 'stale_file';

  return (
    <>
      <Button kind="secondary" onClick={() => setOpen(true)}>
        Importar
      </Button>

      {open && (
        <Modal title="Importar (Smartsheet .xlsx)" onClose={aplicado ? cerrar : () => { setOpen(false); reset(); }}>
          {aplicado ? (
            <Aplicado summary={aplicado} warnings={warnings} onClose={cerrar} />
          ) : esArchivoViejo ? (
            <ArchivoViejo
              mensaje={error!.message}
              pending={pending}
              onConfirmar={() => subir(true)}
              onCancelar={() => { setOpen(false); reset(); }}
            />
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14, color: C.gray600 }}>
                Subí el export de Smartsheet (.xlsx). Se importa tal cual: los números y las fechas salen
                siempre de la planilla (la app es una copia fiel).
              </p>
              <Dropzone file={file} onFile={setFile} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => subir()} disabled={pending || !file}>
                  {pending ? 'Subiendo…' : 'Subir'}
                </Button>
                <Button kind="secondary" onClick={() => { setOpen(false); reset(); }} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
          {!esArchivoViejo && <ErrorText error={error} />}
        </Modal>
      )}
    </>
  );
}

const ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Zona de subida clara: todo el recuadro es clicable (abre el selector del SO) y
// también acepta arrastrar-y-soltar. El <input> nativo va oculto porque su texto
// por defecto ("Elegir archivo") no dejaba claro dónde ni cómo subir.
function Dropzone({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const abrir = () => inputRef.current?.click();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrir();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        border: `2px dashed ${arrastrando ? C.navy700 : C.gray300}`,
        borderRadius: 10,
        padding: '26px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: arrastrando ? C.navy050 : C.gray050,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.navy700} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 16V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      {file ? (
        <>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy900, wordBreak: 'break-all' }}>{file.name}</span>
          <span style={{ fontSize: 13, color: C.gray600 }}>Hacé clic para elegir otro archivo</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy900 }}>Hacé clic para elegir un archivo</span>
          <span style={{ fontSize: 13, color: C.gray600 }}>o arrastralo aquí · .xlsx de Smartsheet</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// Aviso de re-import viejo: el .xlsx exporta más atrás que el último ya cargado.
// No es un error de la app sino una salvaguarda; por eso se ofrece seguir igual.
function ArchivoViejo({
  mensaje,
  pending,
  onConfirmar,
  onCancelar,
}: {
  mensaje: string;
  pending: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <>
      <div style={{ border: `1px solid ${C.amarillo}`, background: C.amarilloBg, borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.amarilloFg }}>Archivo más viejo</div>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: C.gray900 }}>{mensaje}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onConfirmar} disabled={pending}>
          {pending ? 'Subiendo…' : 'Importar igual'}
        </Button>
        <Button kind="secondary" onClick={onCancelar} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </>
  );
}

function Aplicado({ summary, warnings, onClose }: { summary: Summary; warnings: string[]; onClose: () => void }) {
  return (
    <>
      <p style={{ margin: 0, fontSize: 15, color: C.navy900 }}>Import aplicado.</p>
      <p style={{ margin: 0, fontSize: 14, color: C.gray600 }}>
        {summary.squads_updated} squads actualizados · {summary.initiatives_upserted} iniciativas.
      </p>
      {warnings.length > 0 && <Advertencias warnings={warnings} />}
      <div>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </>
  );
}

// Lo que el import no pudo leer con confianza (o no importa aún): un hueco visible
// vale más que un dato inventado en silencio.
function Advertencias({ warnings }: { warnings: string[] }) {
  return (
    <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.navy900 }}>
        {warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}
      </div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {warnings.map((w, i) => (
          <li key={i} style={{ fontSize: 13, color: C.gray600, fontFamily: FONT.body }}>
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
