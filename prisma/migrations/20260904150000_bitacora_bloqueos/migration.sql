-- Bitácora por squad: "Bloqueos" pasa a ser una entidad estructurada propia y
-- "Riesgos" pasa a texto libre (informe_squad_semanal.riesgos). Se migran los
-- Risk existentes (tipo='bloqueo' → bloqueo; el resto → texto riesgos) y se
-- eliminan las tablas risk / risk_squad. Al desaparecer Risk, el semáforo ya no
-- tiene disparador de rojo (categoría 'ingresos'): queda 🟡 (delta<0) / 🟢.

CREATE TYPE "Severidad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

CREATE TABLE "bloqueo" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "desde" DATE,
    "hasta" DATE,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resuelto_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "bloqueo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bloqueo_squad" (
    "bloqueo_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,
    CONSTRAINT "bloqueo_squad_pkey" PRIMARY KEY ("bloqueo_id", "squad_id")
);

ALTER TABLE "bloqueo_squad" ADD CONSTRAINT "bloqueo_squad_bloqueo_id_fkey" FOREIGN KEY ("bloqueo_id") REFERENCES "bloqueo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bloqueo_squad" ADD CONSTRAINT "bloqueo_squad_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "informe_squad_semanal" ADD COLUMN "riesgos" TEXT;

-- Migrar Risk tipo='bloqueo' → bloqueo. Columna temporal para correlacionar el
-- nuevo id con el risk de origen y así reconstruir los vínculos a squads.
ALTER TABLE "bloqueo" ADD COLUMN "_risk_id" INTEGER;

INSERT INTO "bloqueo" ("descripcion", "severidad", "desde", "hasta", "resuelto", "resuelto_en", "created_at", "updated_at", "_risk_id")
SELECT
    r."descripcion",
    CASE lower(r."severidad")
        WHEN 'alta' THEN 'ALTA'::"Severidad"
        WHEN 'baja' THEN 'BAJA'::"Severidad"
        ELSE 'MEDIA'::"Severidad"
    END,
    r."semana_inicio",
    r."semana_fin",
    r."resuelto",
    CASE WHEN r."resuelto" THEN now() ELSE NULL END,
    now(),
    now(),
    r."id"
FROM "risk" r
WHERE r."tipo" = 'bloqueo';

INSERT INTO "bloqueo_squad" ("bloqueo_id", "squad_id")
SELECT b."id", rs."squad_id"
FROM "risk_squad" rs
JOIN "bloqueo" b ON b."_risk_id" = rs."risk_id";

ALTER TABLE "bloqueo" DROP COLUMN "_risk_id";

-- Migrar Risk tipo<>'bloqueo' → texto en informe_squad_semanal.riesgos, agrupando
-- por squad + semana (un mismo riesgo puede pegarle a varios squads).
WITH riesgos_txt AS (
    SELECT rs."squad_id" AS squad_id, r."semana_inicio" AS semana_inicio,
           string_agg(r."descripcion", E'\n') AS txt
    FROM "risk" r
    JOIN "risk_squad" rs ON rs."risk_id" = r."id"
    WHERE r."tipo" <> 'bloqueo'
    GROUP BY rs."squad_id", r."semana_inicio"
)
INSERT INTO "informe_squad_semanal" ("squad_id", "semana_inicio", "riesgos")
SELECT squad_id, semana_inicio, txt FROM riesgos_txt
ON CONFLICT ("squad_id", "semana_inicio")
DO UPDATE SET "riesgos" =
    CASE
        WHEN "informe_squad_semanal"."riesgos" IS NULL OR "informe_squad_semanal"."riesgos" = ''
            THEN EXCLUDED."riesgos"
        ELSE "informe_squad_semanal"."riesgos" || E'\n' || EXCLUDED."riesgos"
    END;

DROP TABLE "risk_squad";
DROP TABLE "risk";
