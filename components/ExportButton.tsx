'use client';

import { toPng } from 'html-to-image';
import { C, FONT } from '../lib/ds-tokens';

// Export client-side (ARD): PDF con el diálogo de impresión del navegador, PNG
// con html-to-image. No hay operación de servidor: se exporta lo que se ve.
export function ExportButton({ targetId, nombre }: { targetId: string; nombre: string }) {
  async function exportarPng() {
    const nodo = document.getElementById(targetId);
    if (!nodo) return;
    const dataUrl = await toPng(nodo, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `${nombre}.png`;
    a.href = dataUrl;
    a.click();
  }

  const boton: React.CSSProperties = {
    height: 40,
    padding: '0 16px',
    borderRadius: 8,
    border: `1px solid ${C.gray300}`,
    background: C.white,
    color: C.navy700,
    fontFamily: FONT.body,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  };

  return (
    <div className="no-print" style={{ display: 'flex', gap: 8 }}>
      <button type="button" style={boton} onClick={() => window.print()}>
        Exportar PDF
      </button>
      <button type="button" style={boton} onClick={exportarPng}>
        Exportar PNG
      </button>
    </div>
  );
}
