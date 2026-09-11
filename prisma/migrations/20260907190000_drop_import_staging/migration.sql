-- El import ahora es de una sola fase (espejo fiel del Smartsheet), sin staging de
-- conflictos. Se elimina la tabla que guardaba el batch entre las dos fases.
DROP TABLE IF EXISTS "import_staging";
