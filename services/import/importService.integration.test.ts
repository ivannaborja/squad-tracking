import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Toca Neon de verdad y es DESTRUCTIVO: borra los SquadSnapshot/Initiative del
// squad 1 en beforeAll/afterAll. Por eso, además de necesitar DATABASE_URL, pide
// opt-in explícito (RUN_DB_INTEGRATION): así un `npm test` normal en local no
// pisa datos reales del squad 1 sin querer. Se salta en CI (sin URL) igual. Los
// imports de Prisma van dinámicos adentro de los hooks para que, al saltarse, la
// recolección de CI no dependa del cliente generado.
const hayDb = !!process.env.DATABASE_URL;
const optIn = !!process.env.RUN_DB_INTEGRATION;
const T = 30000;

describe.skipIf(!hayDb || !optIn)('importService · integración contra Neon', () => {
  const SQUAD = 1; // Préstamos, ya sembrado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any, procesarImport: any, confirmarImport: any, CsvDataSource: any;

  const csv = (delivery: number) =>
    `squad_id,squad,delivery_real_pct,discovery_real_pct,codigo_externo,iniciativa,tipo,estado,pct_avance,fecha_inicio,fecha_fin
${SQUAD},Préstamos,${delivery},0.4,IBD900,Test init,delivery,En curso,0.5,2026-07-01,2026-09-30`;

  async function limpiar() {
    await prisma.squadSnapshot.deleteMany({ where: { squadId: SQUAD } });
    await prisma.initiative.deleteMany({ where: { squadId: SQUAD } });
    await prisma.importStaging.deleteMany({});
  }

  beforeAll(async () => {
    ({ prisma } = await import('../../lib/prisma'));
    ({ procesarImport, confirmarImport } = await import('./importService'));
    ({ CsvDataSource } = await import('../../adapters/csv/CsvDataSource'));
    await limpiar();
  }, T);

  afterAll(async () => {
    await limpiar();
    await prisma.$disconnect();
  }, T);

  it('sin conflicto: aplica y persiste el snapshot con los calculados', async () => {
    const r = await procesarImport(new CsvDataSource(csv(0.6)), 'Test');
    expect(r.status).toBe('applied');

    const snap = await prisma.squadSnapshot.findFirst({ where: { squadId: SQUAD }, orderBy: { fechaReferencia: 'desc' } });
    expect(snap).not.toBeNull();
    expect(snap.deliveryRealPct).toBeCloseTo(0.6, 5);
    // el delta persistido es coherente con el esperado congelado
    expect(snap.deliveryDeltaPct).toBeCloseTo(0.6 - snap.esperadoPct, 5);

    const ini = await prisma.initiative.findFirst({ where: { squadId: SQUAD, codigoExterno: 'IBD900' } });
    expect(ini).not.toBeNull();
  }, T);

  it('override activo + valor distinto: pide confirmación y respeta lo manual si se rechaza', async () => {
    await prisma.squadSnapshot.updateMany({ where: { squadId: SQUAD }, data: { deliveryManualOverride: true, deliveryRealPct: 0.6 } });

    const r = await procesarImport(new CsvDataSource(csv(0.41)), 'Test');
    expect(r.status).toBe('needs_confirmation');
    expect(r.conflicts).toHaveLength(1);

    const c = await confirmarImport(r.import_token, [{ squad_id: SQUAD, field: 'delivery_real_pct', accept: false }], 'Test');
    expect(c.status).toBe('confirmed');

    const snap = await prisma.squadSnapshot.findFirst({ where: { squadId: SQUAD }, orderBy: { fechaReferencia: 'desc' } });
    expect(snap.deliveryRealPct).toBeCloseTo(0.6, 5); // el manual se conservó
    expect(snap.deliveryManualOverride).toBe(true);
  }, T);
});
