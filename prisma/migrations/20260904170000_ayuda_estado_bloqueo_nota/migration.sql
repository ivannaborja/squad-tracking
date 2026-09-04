-- Refinamientos de la bitácora del squad:
-- 1) "Necesitamos ayuda" gana Estado (Abierta / Mitigada parcialmente / Resuelta)
--    y Fecha (editable, arranca hoy). `resuelto` se conserva derivado del estado.
-- 2) Bloqueo gana "nota de resolución" (texto libre) para narrar cómo se resolvió.

CREATE TYPE "EstadoAyuda" AS ENUM ('ABIERTA', 'MITIGADA_PARCIALMENTE', 'RESUELTA');

ALTER TABLE "need" ADD COLUMN "estado" "EstadoAyuda" NOT NULL DEFAULT 'ABIERTA';
ALTER TABLE "need" ADD COLUMN "fecha" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill: la fecha de los pedidos viejos se aproxima con su semana; el estado
-- se deriva del resuelto que ya tenían.
UPDATE "need" SET "fecha" = "semana_inicio";
UPDATE "need" SET "estado" = 'RESUELTA' WHERE "resuelto" = true;

ALTER TABLE "bloqueo" ADD COLUMN "nota_resolucion" TEXT;
