-- Informe ejecutivo (Bloque C): narrativa que escribe Dai a mano, separada del
-- resto porque no se auto-genera. Dos tablas: la del informe general de portafolio
-- (una por semana) y la del informe individual por squad (una por squad por semana).

CREATE TABLE "informe_semanal" (
    "id" SERIAL NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "novedades" TEXT,
    "lectura" TEXT,
    "pases_planificados" INTEGER,

    CONSTRAINT "informe_semanal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "informe_semanal_semana_inicio_key" ON "informe_semanal"("semana_inicio");

CREATE TABLE "informe_squad_semanal" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "novedades" TEXT,
    "pases_produccion" TEXT,
    "despriorizaciones" TEXT,
    "pases_planificados" INTEGER,

    CONSTRAINT "informe_squad_semanal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "informe_squad_semanal_squad_id_semana_inicio_key" ON "informe_squad_semanal"("squad_id", "semana_inicio");

ALTER TABLE "informe_squad_semanal" ADD CONSTRAINT "informe_squad_semanal_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
