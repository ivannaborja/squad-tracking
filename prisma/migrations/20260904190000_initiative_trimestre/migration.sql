-- "Pases a producción" debe contar sólo las iniciativas de portafolio del Q en
-- curso (no el agregado de todos los trimestres). Para eso la iniciativa guarda a
-- qué trimestre pertenece (según su nodo Q ancestro en el árbol de Smartsheet).
-- Nullable: el CSV no lo trae y las filas viejas quedan null hasta reimportar.
ALTER TABLE "initiative" ADD COLUMN "trimestre" TEXT;
