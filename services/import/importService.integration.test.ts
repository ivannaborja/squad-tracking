import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Toca Neon de verdad y es DESTRUCTIVO: borra los SquadSnapshot/Initiative del
// squad 1 en beforeAll/afterAll. Por eso, además de necesitar DATABASE_URL, pide
// opt-in explícito (RUN_DB_INTEGRATION): así un `npm test` normal en local no
// pisa datos reales del squad 1 sin querer. Se salta en CI (sin URL) igual.
const hayDb = !!process.env.DATABASE_URL;
const optIn = !!process.env.RUN_DB_INTEGRATION;
const T = 30000;

describe.skipIf(!hayDb || !optIn)('importService · integración contra Neon', () => {
  const SQUAD = 1; // Préstamos, ya sembrado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any, procesarImport: any;

  // Fuente espejo fiel: expone las 4 métricas del Q como las devolvería el .xlsx.
  const source = {
    fetchMetricas: () => [
      {
        squadId: SQUAD,
        q3Total: { real: 0.6, inicio: '2026-07-01', fin: '2026-09-30' },
        finalizar: { real: 0.63, inicio: '2026-07-01', fin: '2026-10-14' },
        avanzar: null,
        discovery: { real: 0.4, inicio: '2026-07-27', fin: '2026-09-29' },
      },
    ],
    parseInitiatives: () => [
      {
        squadId: SQUAD,
        smartsheetRowId: 'ROW900',
        codigoExterno: 'IBD900',
        portafolio: true,
        nombre: 'Test init',
        tipo: 'delivery',
        etapa: null,
        estado: 'En curso',
        pctAvance: 0.5,
        fechaInicio: '2026-07-01',
        fechaFin: '2026-09-30',
        fechaFinReal: null,
        trimestre: 'Q3-2026',
        semanaInicio: '2026-09-07',
      },
    ],
    warnings: () => [],
  };

  async function limpiar() {
    await prisma.squadSnapshot.deleteMany({ where: { squadId: SQUAD } });
    await prisma.initiative.deleteMany({ where: { squadId: SQUAD } });
  }

  beforeAll(async () => {
    ({ prisma } = await import('../../lib/prisma'));
    ({ procesarImport } = await import('./importService'));
    await limpiar();
  }, T);

  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  }, T);

  it('espejo fiel: aplica y persiste las 4 métricas con sus fechas', async () => {
    const r = await procesarImport(source, 'Test');
    expect(r.status).toBe('applied');

    const snap = await prisma.squadSnapshot.findFirst({
      where: { squadId: SQUAD },
      orderBy: { fechaReferencia: 'desc' },
    });
    expect(snap).not.toBeNull();
    expect(snap.finalizarReal).toBeCloseTo(0.63, 5);
    expect(snap.q3TotalReal).toBeCloseTo(0.6, 5);
    expect(snap.discoveryReal).toBeCloseTo(0.4, 5);
    expect(snap.avanzarReal).toBeNull();
    // Las fechas del nodo se guardan tal cual (para derivar el esperado al leer).
    expect(snap.finalizarFin.toISOString().slice(0, 10)).toBe('2026-10-14');

    const ini = await prisma.initiative.findFirst({ where: { squadId: SQUAD, codigoExterno: 'IBD900' } });
    expect(ini).not.toBeNull();
  }, T);
});
