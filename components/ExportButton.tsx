'use client';

import { toPng, toJpeg } from 'html-to-image';
import { C, FONT } from '../lib/ds-tokens';

// Export client-side (ARD): se exporta lo que se ve, sin operación de servidor.
// PNG con html-to-image; PDF armando un archivo real a partir de la captura.

// html-to-image multiplica el tamaño del nodo por pixelRatio. Un reporte alto
// ×2 supera el límite de canvas del navegador y se recorta el fondo en silencio;
// por eso calculamos un ratio que nunca exceda una dimensión segura.
const MAX_DIM = 12000;
function safeRatio(w: number, h: number) {
  return Math.min(2, MAX_DIM / w, MAX_DIM / h);
}

// La tabla del semáforo usa overflow-x:auto (y el navegador deriva overflow-y:auto).
// html-to-image copia al clon el overflow y una altura fija en px; al rasterizar
// dentro del foreignObject un desfase sub-píxel dispara las barras de scroll, que
// tapan la última fila/columna. Neutralizamos SOLO los contenedores con scroll real
// (auto/scroll) —no los overflow:hidden intencionales, p. ej. las gráficas de
// recharts o el text-overflow— y restauramos el estilo inline exacto al terminar.
const conScroll = (v: string) => v === 'auto' || v === 'scroll';
function expandirScroll(root: HTMLElement) {
  const previos: Array<[HTMLElement, string | null]> = [];
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const cs = getComputedStyle(el);
    if (conScroll(cs.overflowX) || conScroll(cs.overflowY)) {
      previos.push([el, el.getAttribute('style')]);
      el.style.overflow = 'visible';
      el.style.maxHeight = 'none';
      el.style.maxWidth = 'none';
    }
  }
  return () => {
    for (const [el, style] of previos) {
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    }
  };
}

// Márgenes del export: el nodo capturado puede venir centrado (margin:0 auto, cuyo
// margin-left grande html-to-image copia al clon y descuadra/recorta por la derecha)
// o sin padding (contenido pegado a los bordes). Al exportar lo dejamos sin margen y
// con un padding uniforme que hace de margen visual, sobre fondo blanco.
const MARGEN_EXPORT = 40;
function prepararRaiz(nodo: HTMLElement) {
  const previo = nodo.getAttribute('style');
  nodo.style.margin = '0';
  nodo.style.padding = `${MARGEN_EXPORT}px`;
  nodo.style.background = '#ffffff';
  return () => {
    if (previo === null) nodo.removeAttribute('style');
    else nodo.setAttribute('style', previo);
  };
}

// Corre `fn` con el reporte listo para capturar (sin scroll que recorte, sin margen
// de centrado y con márgenes) y sus métricas ya reflejadas; restaura pase lo que pase.
async function conReporteExpandido<T>(
  nodo: HTMLElement,
  fn: (dims: { w: number; h: number; pixelRatio: number }) => Promise<T>,
) {
  // Sin esperar a las fuentes, la primera captura sale con métricas equivocadas.
  await document.fonts.ready;
  const restaurarRaiz = prepararRaiz(nodo);
  const restaurarScroll = expandirScroll(nodo);
  try {
    const w = nodo.scrollWidth;
    const h = nodo.scrollHeight;
    return await fn({ w, h, pixelRatio: safeRatio(w, h) });
  } finally {
    restaurarScroll();
    restaurarRaiz();
  }
}

// Lee el tamaño real de un JPEG desde su marcador SOF: los valores de /Width y
// /Height del PDF deben coincidir con el JPEG o la imagen sale deformada.
function jpegSize(bytes: Uint8Array) {
  let i = 2; // salta FFD8
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    const esSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (esSOF) {
      const h = (bytes[i + 5] << 8) | bytes[i + 6];
      const w = (bytes[i + 7] << 8) | bytes[i + 8];
      return { w, h };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return { w: 0, h: 0 };
}

function dataUrlABytes(dataUrl: string) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Empaca un JPEG en un PDF mínimo de una sola página (embebido con /DCTDecode).
// Es una página larga con el reporte a escala 1px≈1pt, no paginado a A4.
function pdfConJpeg(jpeg: Uint8Array, pageW: number, pageH: number) {
  const { w: imgW, h: imgH } = jpegSize(jpeg);
  const enc = (s: string) => {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  };
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (chunk: Uint8Array | string) => {
    const b = typeof chunk === 'string' ? enc(chunk) : chunk;
    partes.push(b);
    len += b.length;
  };
  const obj = (n: number) => {
    offsets[n] = len;
  };

  push('%PDF-1.3\n');
  obj(1);
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  obj(2);
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  obj(3);
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  obj(4);
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push('\nendstream\nendobj\n');
  const contenido = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5);
  push(`5 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}endstream\nendobj\n`);

  const xrefStart = len;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(partes as BlobPart[], { type: 'application/pdf' });
}

function descargar(href: string, nombre: string) {
  const a = document.createElement('a');
  a.download = nombre;
  a.href = href;
  a.click();
}

export function ExportButton({ targetId, nombre }: { targetId: string; nombre: string }) {
  async function exportarPng() {
    const nodo = document.getElementById(targetId);
    if (!nodo) return;
    await conReporteExpandido(nodo, async ({ w, h, pixelRatio }) => {
      const dataUrl = await toPng(nodo, { backgroundColor: '#ffffff', pixelRatio, width: w, height: h });
      descargar(dataUrl, `${nombre}.png`);
    });
  }

  async function exportarPdf() {
    const nodo = document.getElementById(targetId);
    if (!nodo) return;
    await conReporteExpandido(nodo, async ({ w, h, pixelRatio }) => {
      // JPEG (no PNG) porque /DCTDecode embebe el flujo tal cual, sin recomprimir.
      const dataUrl = await toJpeg(nodo, { backgroundColor: '#ffffff', pixelRatio, quality: 0.95, width: w, height: h });
      const blob = pdfConJpeg(dataUrlABytes(dataUrl), w, h);
      const url = URL.createObjectURL(blob);
      descargar(url, `${nombre}.pdf`);
      URL.revokeObjectURL(url);
    });
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
      <button type="button" style={boton} onClick={exportarPdf}>
        Exportar PDF
      </button>
      <button type="button" style={boton} onClick={exportarPng}>
        Exportar PNG
      </button>
    </div>
  );
}
