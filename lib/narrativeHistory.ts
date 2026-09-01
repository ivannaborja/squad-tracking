import { prisma } from './prisma';

// Bitácora de cambios de la narrativa (Bloque E). Al pisar un campo se guarda su
// versión previa; se conservan las últimas MAX por (tabla, registro, campo).
const MAX = 5;

export interface Cambio {
  campo: string; // clave snake_case del body de la API (la que consulta el editor)
  anterior: string | null;
  nuevo: string | null;
}

const str = (v: unknown): string | null => (v == null ? null : String(v));

// Compara el registro previo contra el guardado, sólo para los campos presentes en
// el body (los que el PATCH tocó). `mapa` va de la clave snake_case a la columna
// Prisma. null cuenta como valor, así vaciar un campo también queda registrado.
export function diffCampos(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  body: Record<string, unknown>,
  mapa: Record<string, string>
): Cambio[] {
  const cambios: Cambio[] = [];
  for (const [campo, col] of Object.entries(mapa)) {
    if (!(campo in body)) continue;
    cambios.push({ campo, anterior: str(before?.[col]), nuevo: str(after[col]) });
  }
  return cambios;
}

// Inserta una fila por cada campo que efectivamente cambió (string-a-string) y
// poda las entradas viejas que exceden MAX. No es transaccional a propósito: es
// una bitácora blanda; si algo falla acá no debe tumbar el guardado del informe.
export async function registrarHistoria(tabla: string, registroId: number, cambios: Cambio[]): Promise<void> {
  const modificados = cambios.filter((c) => c.anterior !== c.nuevo);
  for (const c of modificados) {
    await prisma.narrativeHistory.create({
      data: { tabla, registroId, campo: c.campo, valorAnterior: c.anterior, valorNuevo: c.nuevo },
    });
    const sobran = await prisma.narrativeHistory.findMany({
      where: { tabla, registroId, campo: c.campo },
      orderBy: [{ cambiadoEn: 'desc' }, { id: 'desc' }],
      skip: MAX,
      select: { id: true },
    });
    if (sobran.length) {
      await prisma.narrativeHistory.deleteMany({ where: { id: { in: sobran.map((s) => s.id) } } });
    }
  }
}
