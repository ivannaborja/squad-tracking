-- Iniciativas v1.1 (Bloque B): el adaptador xlsx ahora sí puebla Initiative.
-- La identidad pasa a ser el "Identificador de la fila" de Smartsheet (columna V),
-- estable y único, en vez del código IBD que se repite entre filas.

-- Identidad nueva + columnas de portafolio capturadas del export.
ALTER TABLE "initiative" ADD COLUMN "smartsheet_row_id" TEXT;
ALTER TABLE "initiative" ADD COLUMN "portafolio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "initiative" ADD COLUMN "etapa" TEXT;
ALTER TABLE "initiative" ADD COLUMN "fecha_fin_real" DATE;

-- Huecos honestos: no toda fila de portafolio trae % o fechas cargados.
ALTER TABLE "initiative" ALTER COLUMN "pct_avance" DROP NOT NULL;
ALTER TABLE "initiative" ALTER COLUMN "fecha_inicio" DROP NOT NULL;
ALTER TABLE "initiative" ALTER COLUMN "fecha_fin" DROP NOT NULL;

-- La clave natural del upsert deja de ser el código (se repite) y pasa a ser la
-- fila de Smartsheet. El índice viejo se cae; el nuevo lo reemplaza.
DROP INDEX "initiative_squad_id_codigo_externo_key";
CREATE UNIQUE INDEX "initiative_squad_id_smartsheet_row_id_key" ON "initiative"("squad_id", "smartsheet_row_id");
