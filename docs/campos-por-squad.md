# Spec: Campos por squad y bitácora de Dai

*POC 3 · Seguimiento de Squads · 01-09-2026*
*Basado en análisis del sheet de Dai + sesión de definición con Ivanna*

---

## Contexto

El informe ejecutivo semanal (Bloque C) necesita que Dai pueda ingresar datos narrativos por squad — los campos de texto que hoy carga en su Google Sheet. Este documento especifica qué campos existen, cómo se modelan en la base de datos, cómo los ingresa Dai en la app, y cómo se conectan con el informe.

Complementa `informe-ejecutivo.md`. Commitearlo a `docs/` del repo junto con ese archivo antes del Gate 1 del Bloque C.

---

## 1. Campos narrativos por squad (la "bitácora")

### 1.1 Listado de campos

Todos son **texto libre, editables, con soporte de bullet list** (editor de texto enriquecido liviano — mínimo: negrita, lista con viñetas, lista numerada). Se asocian a un `SquadSnapshot` (un squad en una semana específica). La fecha queda registrada automáticamente como `updatedAt` del snapshot al momento de guardar.

| Campo | Nombre en la UI | Aparece en el informe individual |
|---|---|---|
| `novedades` | Novedades del squad | ✅ Sección "Novedades" |
| `proximas_entregas` | Próximas entregas | ✅ Sección "Próximas entregas" |
| `pases_produccion_notas` | Pases a producción (notas) | ✅ Sección "Pases a producción" (junto al KPI calculado) |
| `ingresos_no_planificados` | Ingresos no planificados | ✅ Sección "Ingresos no planificados" |
| `despriorizaciones` | Despriorizaciones | ✅ Sección "Despriorizaciones" |
| `riesgos` | Riesgos | ✅ Sección "Riesgos" |

**Todos nullable** — si Dai no completa un campo esa semana, no aparece en el informe (no muestra sección vacía).

### 1.2 Riesgos — cambio de modelo

La entidad `Risk` existente **se elimina** y se reemplaza por el campo de texto `riesgos` en `SquadSnapshot`. Riesgos en el contexto de Dai son notas informales que toma mientras habla con el TL ("existe un riesgo en esto y en esto otro") — no un registro estructurado con responsable, impacto, etc.

**Migración:** si existen filas en la tabla `Risk` con `tipo != "bloqueo"`, migrarlas concatenando su `descripcion` al campo `riesgos` del snapshot correspondiente antes de eliminar la tabla. Los de `tipo = "bloqueo"` se migran a la nueva entidad `Bloqueo` (ver sección 2).

### 1.3 Pases a producción — coexistencia texto + KPI

En el informe individual de cada squad conviven dos cosas:
- **KPI calculado automáticamente** (Bloque B): `Etapa=Despliegue + %Completo=100 + Estado=Completo` del Q, sobre iniciativas `Portafolio=true`.
- **Campo de texto** (`pases_produccion_notas`): notas de Dai sobre ese squad esa semana (qué pasó, detalles cualitativos).

Son independientes. El campo de texto no reemplaza al KPI — ambos se muestran en el informe.

---

## 2. Bloqueos

Entidad propia, **separada de Riesgos**. Los bloqueos son impedimentos reales que están frenando al squad ahora; tienen urgencia máxima y Dai debe resolverlos. Aparecen primero, prominentes, en el informe individual.

### 2.1 Campos de la entidad `Bloqueo`

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | uuid | auto | — |
| `descripcion` | text | ✅ | Texto libre con bullet list support |
| `severidad` | enum | ✅ | ALTA / MEDIA / BAJA |
| `squads` | Squad[] | ✅ (mínimo 1) | Relación many-to-many. Si se seleccionan varios squads, el bloqueo aparece en **todos** los seleccionados |
| `desde` | date | ❌ | Fecha de inicio del bloqueo |
| `hasta` | date | ❌ | Fecha estimada de resolución |
| `resuelto` | boolean | auto | Default `false`. Se activa con el botón "Resuelto" |
| `resuelto_en` | timestamp | auto | Se registra automáticamente cuando `resuelto` pasa a `true` |
| `createdAt` | timestamp | auto | — |
| `updatedAt` | timestamp | auto | — |

**No tiene:** tipo (siempre es bloqueo), responsable, acción próxima, checkpoint, categoría de impacto.

### 2.2 Comportamiento multi-squad

Cuando Dai crea un bloqueo y selecciona múltiples squads en "Squads afectados", ese único registro `Bloqueo` aparece en la vista de escritura y en el informe de **cada uno de esos squads**. No se duplica la entidad — es una relación many-to-many. Si el bloqueo se marca como "Resuelto", desaparece de todos los squads.

### 2.3 En el informe

- **Informe individual por squad:** muestra los bloqueos activos (`resuelto=false`) de ese squad, ordenados por severidad descendente. Sección al tope del informe, visualmente destacada.
- **Informe general de portafolio:** resumen de bloqueos activos de todos los squads (contador + listado breve).

---

## 3. Necesitamos ayuda (ex Need)

La entidad `Need` se **renombra** a `NecesitamosAyuda` (tabla: `necesitamos_ayuda`; UI: "Necesitamos ayuda"). Es el registro de pedidos de escalación que Dai hace al portafolio — cosas que están fuera del control del squad y necesitan resolución externa.

### 3.1 Campos de la entidad `NecesitamosAyuda`

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | uuid | auto | — |
| `squadId` | FK Squad | ✅ | Squad que hace el pedido |
| `descripcion` | text | ✅ | Texto libre con bullet list support |
| `estado` | enum | ✅ | Ver opciones abajo |
| `createdAt` | timestamp | auto | Fecha del pedido — se muestra en la UI como "Fecha" |
| `updatedAt` | timestamp | auto | — |

**Estados (enum `EstadoAyuda`):**
- `ABIERTA` — el pedido está activo, sin respuesta
- `MITIGADA_PARCIALMENTE` — se avanzó pero no está resuelto del todo
- `RESUELTA` — completamente resuelta

El estado inicial al crear es siempre `ABIERTA`.

### 3.2 En el informe

Aparece en la sección "Necesitamos de ustedes / riesgos" del informe individual por squad, mostrando las ayudas abiertas y mitigadas parcialmente (las resueltas pueden mostrarse opcionalmente con toggle).

---

## 4. KPI 4 — Pases planificados esta semana

**Campo numérico manual**, a nivel de portafolio (no por squad). Dai ingresa cuántos pases están planificados para la semana en curso.

- Se almacena en la entidad `InformeSemanal` (entidad nueva, definida en `informe-ejecutivo.md`): campo `pases_planificados_semana` (integer, nullable).
- Se muestra en la cabecera del informe general de portafolio como el KPI 4.
- No se calcula automáticamente — es siempre un campo que Dai completa a mano.

---

## 5. Notas Generales

Sección en la **página principal** de la app (no ligada a ningún squad). Sirve para notas transversales — sobre varios squads a la vez, sobre el portafolio en general, o cualquier cosa que no encaje en el contexto de un squad específico.

### 5.1 Campos de la entidad `NotaGeneral`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | — |
| `contenido` | text | Texto libre con bullet list support |
| `createdAt` | timestamp | Fecha automática al guardar, visible en la UI |
| `updatedAt` | timestamp | Se actualiza al editar |

### 5.2 Comportamiento

- Dai puede **agregar** múltiples notas (no hay límite).
- Cada nota muestra su `createdAt` (y `updatedAt` si fue editada).
- Dai puede **editar** cualquier nota después de guardarla.
- Dai puede **borrar** cualquier nota (con confirmación para evitar borrado accidental).
- No están asociadas a ningún squad ni a ninguna semana — son libres.

---

## 6. Modelo de datos — cambios al schema de Prisma

### 6.1 `SquadSnapshot` — campos nuevos

Agregar a la tabla existente (todos `String?`, nullable):

```prisma
novedades              String?
proximas_entregas      String?
pases_produccion_notas String?
ingresos_no_planificados String?
despriorizaciones      String?
riesgos                String?
```

El `updatedAt` existente (o uno nuevo si no existe) registra cuándo fue la última edición de cualquier campo del snapshot.

**Importante:** el snapshot puede existir sin haber hecho el import xlsx — si Dai quiere escribir notas de una semana antes de importar, la app debe crear el `SquadSnapshot` on-demand (con campos numéricos null y solo texto). El import xlsx existente hace upsert (crea o actualiza), así que al importar después los campos numéricos se pueblan sin pisar los textos.

### 6.2 Nueva entidad `Bloqueo`

```prisma
model Bloqueo {
  id          String    @id @default(cuid())
  descripcion String
  severidad   Severidad
  desde       DateTime?
  hasta       DateTime?
  resuelto    Boolean   @default(false)
  resuelto_en DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  squads      Squad[]   @relation("BloqueoSquads")
}

enum Severidad {
  ALTA
  MEDIA
  BAJA
}
```

Y en `Squad`:
```prisma
bloqueos Bloqueo[] @relation("BloqueoSquads")
```

### 6.3 Entidad `Need` → `NecesitamosAyuda`

Renombrar tabla y modelo. Agregar campo `estado`:

```prisma
model NecesitamosAyuda {
  id          String       @id @default(cuid())
  squadId     Int
  squad       Squad        @relation(fields: [squadId], references: [id])
  descripcion String
  estado      EstadoAyuda  @default(ABIERTA)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

enum EstadoAyuda {
  ABIERTA
  MITIGADA_PARCIALMENTE
  RESUELTA
}
```

### 6.4 Nueva entidad `NotaGeneral`

```prisma
model NotaGeneral {
  id        String   @id @default(cuid())
  contenido String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 6.5 Entidad `Risk` — eliminación

- Migrar `Risk` con `tipo != "bloqueo"` → campo `riesgos` del `SquadSnapshot` correspondiente.
- Migrar `Risk` con `tipo = "bloqueo"` → nueva entidad `Bloqueo`.
- Eliminar tabla `Risk` y enum `RiskTipo`.

---

## 7. UX de carga — flujo de Dai en la reunión

### 7.1 Contexto de uso

Dai carga los datos **en vivo durante la reunión semanal**, squad por squad, mientras habla con cada TL. El turno de un squad termina y pasa al siguiente. Necesita rapidez y seguridad ante pérdida accidental de datos.

### 7.2 Flujo por squad

1. Dai está en la vista del squad (ya existe en la app).
2. Activa el **modo edición** (botón "Editar" existente).
3. Ve todos los campos de texto del squad para esa semana: Bloqueos activos, Riesgos, Novedades, Próximas entregas, Pases a producción, Ingresos no planificados, Despriorizaciones, Necesitamos ayuda.
4. Edita lo que corresponda. Los campos tienen soporte de bullet list (botón de lista en el toolbar del editor).
5. **Autoguardado o confirmación antes de salir:** al salir del modo edición o navegar a otro squad, si hay cambios sin guardar → mostrar confirmación "¿Guardar cambios antes de salir?" (Guardar / Descartar / Cancelar). No se pierden datos sin confirmación explícita.
6. Al guardar, el `updatedAt` del snapshot queda registrado.

### 7.3 Bloqueos — flujo específico

Los bloqueos tienen su propio formulario (no son un simple textarea porque tienen campos estructurados: severidad, squads afectados, desde/hasta). Se muestra en la parte superior de la vista del squad, antes de los campos de texto.

- Botón **"+ Agregar bloqueo"** → abre modal/inline form.
- Campos: Descripción (textarea con bullet list), Severidad (selector: Alta / Media / Baja), Squads afectados (multi-select con los 8 squads, el squad actual pre-seleccionado), Desde (date picker, opcional), Hasta (date picker, opcional).
- Botón **"Resuelto"** en cada bloqueo activo → marca `resuelto=true`, registra `resuelto_en`, lo colapsa/oculta del listado activo (puede haber un toggle "Ver resueltos").

### 7.4 Semana de referencia

Los campos de texto se asocian al `SquadSnapshot` de la semana actual. Si no existe snapshot para la semana actual, la app lo crea automáticamente (on-demand, con campos numéricos null). Al hacer el import xlsx después, los campos numéricos se agregan sin pisar los textos.

Si Dai necesita editar datos de una semana pasada, debe navegar al historial del squad y seleccionar la semana correspondiente — los campos de esa semana se vuelven editables en modo edición.

---

## 8. Integración con el informe ejecutivo

### Informe individual por squad

| Sección del informe | Fuente de dato |
|---|---|
| Bloqueos | `Bloqueo[]` activos (`resuelto=false`) del squad — prominente, al tope |
| KPI Delivery | `SquadSnapshot.delivery_real_pct` + `esperado_pct` |
| KPI Discovery | `SquadSnapshot.discovery_real_pct` + `esperado_pct` |
| KPI Pases a producción | Calculado desde `Initiative` (Bloque B) |
| KPI Pases planificados | `InformeSemanal.pases_planificados_semana` (manual, portafolio) |
| Novedades | `SquadSnapshot.novedades` |
| Próximas entregas | `SquadSnapshot.proximas_entregas` |
| Pases a producción (notas) | `SquadSnapshot.pases_produccion_notas` |
| Ingresos no planificados | `SquadSnapshot.ingresos_no_planificados` |
| Despriorizaciones | `SquadSnapshot.despriorizaciones` |
| Riesgos | `SquadSnapshot.riesgos` |
| Necesitamos ayuda | `NecesitamosAyuda[]` del squad (estado ABIERTA o MITIGADA_PARCIALMENTE) |

### Informe general de portafolio

| Sección | Fuente |
|---|---|
| KPI 1 Avance Delivery | Promedio `delivery_real_pct` de los 8 squads |
| KPI 2 Discovery ponderado | Promedio `discovery_real_pct` (excl. nulls) + delta vs semana anterior |
| KPI 3 Pases a producción | Calculado desde `Initiative` (Bloque B) |
| KPI 4 Pases planificados | `InformeSemanal.pases_planificados_semana` (campo manual) |
| Resumen bloqueos activos | `Bloqueo[]` con `resuelto=false` de todos los squads |
| Novedades de la semana | `InformeSemanal.novedades_semana` (texto libre, lo escribe Dai) |
| Lectura | `InformeSemanal.lectura` (texto libre, lo escribe Dai) |

---

## 9. Campos pendientes de definición

Los siguientes campos del sheet de Dai **no se implementan en este bloque** — esperan mayor claridad sobre cómo funciona esa parte del Smartsheet:

- **Delivery Avanzar (%)** — trabajo no planificado que avanzó
- **Cantidad Soporte** — cantidad de personas en soporte
- **Avance Soporte (%)** — porcentaje avanzado del soporte

Se agregarán al spec cuando Dai o el equipo aclaren la lógica de la sección "Soporte" en el Smartsheet de cada squad.

---

## 10. Secuencia de implementación (dentro del Bloque C)

Dado que el Bloque C es el informe ejecutivo completo, los campos por squad son parte de él. Secuencia interna sugerida:

1. **Migración del schema** (nuevos campos en SquadSnapshot, entidad Bloqueo, NecesitamosAyuda, NotaGeneral, eliminar Risk).
2. **APIs** (endpoints CRUD para Bloqueo, NecesitamosAyuda, NotaGeneral; PATCH para campos de texto de SquadSnapshot; creación on-demand de snapshot).
3. **UI de escritura por squad** (editor de texto enriquecido reutilizable, formulario de bloqueos, sección de necesitamos ayuda).
4. **Notas Generales** en la página principal.
5. **Informe individual** (consume los campos ya cargados).
6. **Informe general** (portafolio).

*Nota de manejo: datos internos. Vive en el Project; commitear a `docs/` del repo cuando Claude Code lo necesite.*