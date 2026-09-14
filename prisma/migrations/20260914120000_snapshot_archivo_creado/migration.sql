-- Guard de re-import de planilla vieja: se guarda el timestamp de exportación del
-- .xlsx (workbook.created) para poder comparar contra el último import. Nullable:
-- las filas previas quedan en NULL y no participan del MAX de comparación.
ALTER TABLE "squad_snapshot" ADD COLUMN "archivo_creado" TIMESTAMPTZ(6);
