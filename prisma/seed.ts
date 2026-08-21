import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Los 8 squads en seguimiento son fijos (entities: "8 filas fijas"). Ids estables
// 1..8 para que el seed sea idempotente y el import los pueda matchear por nombre.
const SQUADS = [
  'Préstamos',
  'Cross',
  'Lealtad',
  'Cuentas',
  'Adquirencia',
  'TC',
  'Empresas Actual',
  'Pagos y transferencias',
];

async function main() {
  for (const [i, nombre] of SQUADS.entries()) {
    const id = i + 1;
    await prisma.squad.upsert({ where: { id }, create: { id, nombre }, update: { nombre } });
  }
  console.log(`Seed OK: ${SQUADS.length} squads`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
