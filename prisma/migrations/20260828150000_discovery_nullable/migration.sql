-- Un squad solo-delivery (ej. Empresas, sin nodo Discovery en Smartsheet) no tiene
-- discovery: las columnas pasan a nullable para guardar un null honesto en vez de un
-- 0 que fingiría una brecha. Cambio aditivo (afloja una restricción), no destructivo.
ALTER TABLE "squad_snapshot" ALTER COLUMN "discovery_real_pct" DROP NOT NULL;
ALTER TABLE "squad_snapshot" ALTER COLUMN "discovery_delta_pct" DROP NOT NULL;
