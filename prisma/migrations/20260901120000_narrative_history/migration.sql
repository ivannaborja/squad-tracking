-- Historial de narrativa (Bloque E): guarda las últimas versiones de cada campo
-- de narrativa antes de un cambio, para poder consultar qué se escribió antes. No
-- reemplaza al informe: es una bitácora acotada (se conservan hasta 5 por campo).

CREATE TABLE "narrative_history" (
    "id" SERIAL NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "cambiado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "narrative_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "narrative_history_registro_idx" ON "narrative_history"("tabla", "registro_id", "campo");
