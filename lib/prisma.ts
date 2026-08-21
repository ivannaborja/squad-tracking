import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Prisma 7 no trae engine nativo: la conexión entra por un driver adapter. Neon
// escala a cero y auto-resume, así que el adapter serverless alcanza sin
// keep-alive (ver ARD, elección de Neon sobre Supabase).
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

// Singleton: Next.js recarga los módulos del server en dev y sin esto se
// abrirían conexiones nuevas en cada hot-reload hasta agotar el pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
