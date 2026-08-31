-- Limpieza (Bloque 0): "Planes de acción (portafolio)" se elimina de la app —
-- Dai no reconoce la sección. La tabla es exclusiva de esa feature (sin FK entrante),
-- así que el DROP no arrastra nada más. "Cartera por estado" era sólo UI sobre
-- Initiative: no toca el esquema.
DROP TABLE "action_plan";
