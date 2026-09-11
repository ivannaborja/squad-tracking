-- Espejo fiel del Smartsheet: el snapshot pasa a guardar las 4 métricas del Q en
-- curso (Q total, Priorizado Finalizar, Priorizado Avanzar, Discovery) con su
-- %real y sus fechas planificadas. El esperado, el desvío y el color ya NO se
-- persisten: son cálculo puro que se deriva al leer (esperadoDesdeFechas). Se
-- quita también la edición manual (override): la app es copia fiel, no se edita.
ALTER TABLE "squad_snapshot"
  DROP COLUMN "delivery_real_pct",
  DROP COLUMN "discovery_real_pct",
  DROP COLUMN "delivery_manual_override",
  DROP COLUMN "discovery_manual_override",
  DROP COLUMN "esperado_pct",
  DROP COLUMN "delivery_delta_pct",
  DROP COLUMN "discovery_delta_pct",
  DROP COLUMN "semaforo",
  ADD COLUMN "q3_total_real" DOUBLE PRECISION,
  ADD COLUMN "q3_total_inicio" DATE,
  ADD COLUMN "q3_total_fin" DATE,
  ADD COLUMN "finalizar_real" DOUBLE PRECISION,
  ADD COLUMN "finalizar_inicio" DATE,
  ADD COLUMN "finalizar_fin" DATE,
  ADD COLUMN "avanzar_real" DOUBLE PRECISION,
  ADD COLUMN "avanzar_inicio" DATE,
  ADD COLUMN "avanzar_fin" DATE,
  ADD COLUMN "discovery_real" DOUBLE PRECISION,
  ADD COLUMN "discovery_inicio" DATE,
  ADD COLUMN "discovery_fin" DATE;
