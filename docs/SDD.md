# SDD — Seguimiento de Squads

---

## SDD — Entidades (Seguimiento de Squads)

Primer documento del SDD. Define el modelo de datos que sostiene `domain/`
(ver `context/architecture.md`). Revisado
contra `context/scope.md`, `context/glossary.md` y `context/open-questions.md`.

### Entidades

**Squad** — `id, nombre` (8 filas fijas)

**SquadSnapshot** — la foto de un squad en un check-in. Una fila por squad por
semana; dentro de la misma semana se **actualiza en el lugar**, y **nunca se pisa
entre semanas** (historial completo semana a semana desde el día 1):
`id, squad_id FK, semana_inicio, fecha_referencia, trimestre, delivery_real_pct,
discovery_real_pct, delivery_manual_override (bool, default false),
discovery_manual_override (bool, default false), esperado_pct (calc·congelado
contra fecha_referencia), delivery_delta_pct (calc), discovery_delta_pct (calc),
semaforo (calc·no editable), frase_pronostico (texto, la escribe el equipo de
Agile Coach), editado_por`

- **`delivery_manual_override` / `discovery_manual_override`** — procedencia por
  campo de los dos reales. Se activan (`true`) cuando el equipo de Agile Coach
  edita **ese** real a mano esa semana. Un import que choca contra un flag
  activo dispara la confirmación del Flujo 3 (`flows.md`): si el equipo de
  Agile Coach confirma el import, el valor se sobrescribe y el flag vuelve a
  `false`; si no, se conserva el valor manual y el flag sigue en `true`. **Son
  dos flags separados, no uno solo de "origen" a nivel snapshot**, porque el
  equipo de Agile Coach puede corregir un real y dejar el otro intacto en la
  misma semana.
- **`fecha_referencia`** — el día real del check-in. **No es un jueves asumido:
  el equipo de Agile Coach puede entrar cualquier día** (martes, domingo, el que
  sea) y ve el estado a esa fecha. Es contra `fecha_referencia` que se calculó
  `esperado_pct` y que se
  evaluó la ventana de los riesgos ese check-in.
- **`semana_inicio`** — sólo **agrupa** a qué semana pertenece la fila (para
  comparar Q contra Q y armar el historial). No es la fecha de cálculo; esa es
  `fecha_referencia`.

**Initiative** — una fila por iniciativa/subtarea del CSV importado; alimenta el
gráfico de "cartera por estado" que promete `scope.md`:
`id, squad_id FK, codigo_externo (nullable), nombre, tipo (delivery/discovery),
estado, pct_avance, fecha_inicio, fecha_fin, semana_inicio`

- **`codigo_externo`** — el ID de la fila en Smartsheet (ej. `IBD015`). Es la
  clave natural para el **upsert** del import: matchea por `(squad_id,
  codigo_externo)` para saber si una fila es la misma iniciativa de una semana
  anterior o una nueva. **Nullable a propósito**: en el Smartsheet real no todas
  las filas traen código (algunas sí como `IBD015`, otras no tienen ID). Sin
  código no hay match confiable entre semanas → se inserta fila nueva cada import
  (limitación conocida, ver `api.md` → "Límites conocidos de la API"). La regla de
  upsert vive en `api.md` (Flujo 3), no acá.

**Risk** (riesgo + bloqueo + incidencia unificados) — puede afectar más de un
squad a la vez:
`id, descripcion, categoria_impacto, severidad, dueño, accion_proxima,
checkpoint, tipo (riesgo/bloqueo/incidencia), semana_inicio, semana_fin,
resuelto`

**RiskSquad** — intermedia many-to-many: `risk_id FK, squad_id FK`

**Need** (Necesitamos de ustedes) —
`id, squad_id FK, descripcion, dueño, semana_inicio, resuelto`

**UpcomingDelivery** —
`id, squad_id FK, descripcion, fecha_estimada, semana_inicio`

**Achievement** — `id, squad_id FK, descripcion, semana_inicio`

**UnplannedIntake** (iniciativas que entraron al portafolio sin estar
planificadas — "ingresos no planificados" en el informe; ⚠️ es *intake*, NO
plata; ver "Ojo con 'ingresos'") — `id, squad_id FK, descripcion, semana_inicio`

**ActionPlan** (Planes de acción / mejora continua) — **es de portafolio, no de
squad** (fuente real pág. 3: ej. "Discovery en Q-1 — [PMO] · desde Q3", sin
squad asociado). Sin `squad_id`:
`id, descripcion, dueño, plazo (texto libre: "Q3", "próx. sprint"…), estado,
semana_inicio, resuelto`

### Regla del semáforo (vive en `domain/`, no en la tabla)

Precedencia:
- 🔴 **Rojo** — existe un `Risk` **activo** vinculado al squad con
  `categoria_impacto = 'ingresos'`, sin importar el signo del delta. "Activo" =
  `resuelto = false` **y** `Risk.semana_inicio ≤ fecha_referencia del snapshot ≤
  Risk.semana_fin` (misma condición que `ingresosActivo()` en `domain.md`).
- 🟡 **Amarillo** — `delivery_delta_pct < 0` y no hay ese riesgo activo.
- 🟢 **Verde** — cualquier otro caso (sin riesgo de ingresos activo y
  `delivery_delta_pct ≥ 0`).

`discovery_delta_pct` nunca participa. `severidad` se guarda para mostrar y para
el futuro, pero **no** entra hoy en la regla del color.

### Reglas esperadas (prácticas, no constraints de DB)

- **Rojo ⇒ Need.** Todo squad en 🔴 esa semana **debería** tener al menos un
  `Need` activo (no resuelto) esa semana (fuente real pág. 4: "si hay un rojo,
  tiene que aparecer también en Necesitamos de ustedes"). Es una regla de
  práctica del informe, **no** un constraint de base: se valida como advertencia
  en la UI/armado ("este squad está en rojo y no tiene pedido de ayuda"), no
  impide guardar.

### KPIs derivados (no se almacenan, se calculan)

- **"No planificadas"** (KPI de cartera, ej. "22 iniciativas no planificadas,
  25% de la cartera") = `COUNT(UnplannedIntake) GROUP BY trimestre`. No hace
  falta un flag en `Initiative`; sale del acumulado de `UnplannedIntake` del Q.

### Consistencia de los campos calculados (importante)

`esperado_pct`, `delivery_delta_pct`, `discovery_delta_pct` y `semaforo` son
**derivados, no autorales**. Coherente con `architecture.md` ("los % calculados
se recalculan solos; `domain/` es puro"):

- Son un **write-through cache**: `domain/` los recomputa y reescribe en cada
  edición de un dato de entrada (o de un riesgo vinculado). Nunca se escriben a
  mano ni se editan en la UI.
- **`esperado_pct` se congela contra `fecha_referencia`**: depende del día del
  check-in (días hábiles transcurridos / totales del Q). Congelarlo es lo que
  preserva el historial real de lo que se mostró esa semana — no se recalcula con
  la fecha de hoy al mirar una semana vieja. Mientras el equipo de Agile Coach
  sólo mira (sin guardar), el esperado se calcula en vivo contra hoy; recién al
  confirmar un check-in queda
  congelado con esa `fecha_referencia`.
- **`semaforo` se recomputa por write-through** ante cualquier **escritura** que
  lo afecte —cambio de `delivery_real_pct` o de los riesgos vinculados
  (crear/editar/resolver)— y se **reescribe la columna**. Las **lecturas devuelven
  la columna, no la recalculan**: la columna es la fuente de verdad del color, y
  `domain/` la mantiene fresca en cada escritura. Consecuencia: una ventana de
  riesgo que vence sólo por calendario no cambia el color hasta la próxima
  escritura (ver `api.md` → "Congelado vs. en vivo"). Esto **difiere** de
  `esperado_pct`, que sí se puede recalcular en vivo en una lectura por ser pura
  cuenta de fechas.

### Decisiones tomadas y por qué

- **`categoria_impacto` (categórico) en vez de un booleano `impacta_ingresos`**:
  la pregunta abierta #7 del PRD (si "ingresos" es el único disparador de rojo)
  sigue sin confirmar. Un campo categórico permite sumar categorías después sin
  migrar datos ni reclasificar filas viejas.
- **Historial completo en SquadSnapshot** (no se sobreescribe): costo casi cero
  (8 squads × 1 fila/semana) y necesario para poder verificar algún día la regla
  candidata de "amarillo sostenido 3 semanas" (pregunta abierta #6) — sin
  historial esa regla nunca sería verificable, ni contando desde que se active.
- **Initiative como tabla separada**: `scope.md` promete un gráfico de "cartera
  por estado". Eso necesita datos por iniciativa, no sólo el % agregado por
  squad; sin esta tabla `scope.md` prometía algo que el modelo no podía dar.
- **`editado_por` en SquadSnapshot**: mitiga parcialmente la deuda de seguridad
  ya declarada en `architecture.md` (acceso sin login = sin registro de quién
  cambió qué). **Aviso: es auditoría blanda** — sin autenticación, sólo puede
  ser un selector auto-declarado (equipo de Agile Coach/equipo dev), no una
  atribución confiable. Se
  vuelve real cuando entre el puerto `Auth` (usuarios/historial más adelante).
- **`Risk` unifica riesgo/bloqueo/incidencia** con un campo `tipo` y many-to-many
  a squads: un mismo evento puede pegarle a varios squads a la vez sin duplicar
  filas.

### Ojo con "ingresos" — dos significados distintos

El término aparece con **dos sentidos que no hay que confundir** (riesgo real de
bug en `domain/`):

- **`Risk.categoria_impacto = 'ingresos'`** = impacto en **ingresos = plata /
  revenue**. Es el disparador de 🔴.
- **`UnplannedIntake` / "ingresos no planificados"** = **ingreso = intake**
  (iniciativas que *entraron* al portafolio sin estar planificadas). Alimenta el
  KPI "no planificadas". **No es plata.**

La entidad se llama `UnplannedIntake` (no `UnplannedIncome`) justamente para
eliminar la homonimia de raíz: el nombre en inglés ya no colisiona con "ingresos
= revenue".

### Cerrado con la fuente real (Informe_estado_semanal_ejemplo)

- **ActionPlan** (era Abierto #4) → **resuelto, pág. 3**: existe como sección
  propia "Planes de acción (mejora continua)", **de portafolio, sin squad**. Se
  quitó `squad_id` y se agregó `plazo`.
- **"No planificadas"** (era Abierto #5) → **resuelto, pág. 1**: es el acumulado
  de `UnplannedIntake` del trimestre. Se quitó el flag `Initiative.planificada`;
  el KPI sale de `COUNT(UnplannedIntake)`.

**No quedan puntos abiertos esperando al equipo de Agile Coach.
`specs/entities.md` está congelado.**

### Extensibilidad prevista (no bloquea)

- **Valores de `categoria_impacto`** más allá de `'ingresos'`: el campo es
  categórico justamente para sumar categorías sin migrar (pregunta abierta #7 del
  PRD). Hasta que se confirme otra, la única que dispara 🔴 es `'ingresos'`.

---

## SDD — Domain (Seguimiento de Squads)

Segundo documento del SDD. Define las **reglas puras** de `domain/` (ver
`context/architecture.md`): funciones que toman datos ya modelados
(`specs/entities.md`) y devuelven los campos calculados. No saben de dónde vino
el dato (adaptador CSV/API), ni de Postgres, ni de cómo se pinta. **Se testean
solas.**

> Contrato con la arquitectura: los calculados (`esperado_pct`, deltas,
> `semaforo`) son **derivados, no autorales** — un *write-through cache* que
> estas funciones recomputan y reescriben en cada edición de un dato de entrada
> o de un riesgo vinculado. La fuente de verdad es esta capa, no la columna.

### Tipos que consume (de `entities.md`)

Las firmas usan un subconjunto de las entidades ya congeladas. Nombres en
`camelCase` (modelo interno de `domain/`), aunque en la tabla vivan en
`snake_case`:

```ts
type Trimestre = { inicio: Date; fin: Date };   // fechas de arranque/cierre del Q

type RiskActivo = {
  categoriaImpacto: string;   // 'ingresos' | … (categórico, extensible)
  resuelto: boolean;
  semanaInicio: Date;
  semanaFin: Date;
};

type Semaforo = 'rojo' | 'amarillo' | 'verde';
```

`severidad` existe en `Risk` pero **no** entra hoy en ninguna función de color
(se guarda para mostrar y para el futuro).

---

### 1. `esperadoPct(hoy, trimestre) → number`

El **% de avance esperado del trimestre**: días hábiles transcurridos / días
hábiles totales del Q. Igual para los 8 squads (no depende del squad). Se calcula
con la **fecha de referencia** de ese snapshot (el día del check-in, cualquiera
sea — no hay jueves fijo).

```
esperadoPct(hoy, { inicio, fin }):
  si hoy <= inicio          → 0
  si hoy >= fin             → 1
  si no                     → habilesEntre(inicio, hoy) / habilesEntre(inicio, fin)
```

- **Días hábiles**, no calendario: lunes-viernes, sin fines de semana. (Feriados:
  ver "Pendiente" abajo — hoy no se descuentan.)
- **Rango cerrado y saturado**: antes del inicio da 0; en o después del cierre da
  1. Nunca devuelve <0 ni >1.
- **Puro respecto de la fecha que se le pasa**, no de `Date.now()`. Quien arma el
  snapshot le pasa la `fecha_referencia` de ese check-in; así `esperado_pct` queda
  **congelado por semana** y una semana vieja no se recalcula con la fecha de hoy.

#### Casos de test

| `hoy` | `inicio` | `fin` | esperado | por qué |
|---|---|---|---|---|
| día 33 hábil | día 0 | día 66 hábil | `0.50` | mitad del Q (referencia del PRD) |
| = `inicio` | inicio | fin | `0` | arranca el Q |
| < `inicio` | inicio | fin | `0` | Q no empezó |
| = `fin` | inicio | fin | `1` | Q cerrado |
| > `fin` | inicio | fin | `1` | saturado, no pasa de 1 |

---

### 2. `delta(realPct, esperadoPct) → number`

La **brecha en puntos porcentuales**: real − esperado. Una por categoría
(Delivery y Discovery), misma función.

```
delta(realPct, esperadoPct):
  → realPct - esperadoPct
```

- Devuelve pp con signo. Positivo = adelantado; negativo = atrasado.
- Trabaja en la **misma unidad** que sus entradas (fracción 0–1 o porcentaje
  0–100, pero consistente). Convención del proyecto: fracción 0–1 en `domain/`,
  se formatea a pp/% sólo en la UI.
- `deliveryDelta = delta(deliveryRealPct, esperadoPct)`
- `discoveryDelta = delta(discoveryRealPct, esperadoPct)`

#### Casos de test

| `realPct` | `esperadoPct` | delta | lectura |
|---|---|---|---|
| 0.56 | 0.50 | `+0.06` | Adquirencia Delivery +6 pp |
| 0.39 | 0.50 | `−0.11` | Lealtad Delivery −11 pp |
| 0.50 | 0.50 | `0` | justo en el esperado |

---

### 3. `semaforo(deliveryDelta, risks, fechaReferencia) → Semaforo`

El **color del squad**, por regla cualitativa con precedencia. **No** es promedio
ni umbral mecánico de pp. Sólo mira el delta de **Delivery** y los riesgos
activos; **Discovery nunca participa**.

`fechaReferencia` es el **día del check-in** (no hay jueves fijo: el equipo de
Agile Coach puede entrar cualquier día). Se pasa **explícito**, igual que `hoy` en `esperadoPct`: sin él,
"¿está el riesgo dentro de su ventana?" dependería de la fecha del sistema y la
función dejaría de ser determinística — un mismo caso de test podría dar rojo hoy
y verde mañana. Con `fechaReferencia` como parámetro, mismas entradas → misma
salida siempre.

```
semaforo(deliveryDelta, risks, fechaReferencia):
  si algún r en risks es ingresosActivo(r, fechaReferencia)   → 'rojo'
  si no, si deliveryDelta < 0                                 → 'amarillo'
  si no                                                       → 'verde'

ingresosActivo(r, fechaReferencia):
  → r.categoriaImpacto == 'ingresos'
    AND r.resuelto == false
    AND r.semanaInicio <= fechaReferencia <= r.semanaFin
```

Precedencia (el orden importa):

1. **🔴 Rojo** — hay al menos un `Risk` **activo** vinculado al squad ese
   check-in con `categoriaImpacto = 'ingresos'`. Dispara rojo **por sí solo, sin
   importar el signo de Delivery**. "Activo" = no resuelto **y** `fechaReferencia`
   cae dentro de `[semanaInicio, semanaFin]`.
2. **🟡 Amarillo** — no hay ese riesgo, pero `deliveryDelta < 0`.
3. **🟢 Verde** — cualquier otro caso (sin riesgo de ingresos activo y
   `deliveryDelta ≥ 0`).

- `discoveryDelta` **no se pasa a esta función**: no puede cambiar el color. Un
  Discovery bajo se reporta aparte como *hallazgo de portafolio*.
- `severidad` **no** entra en la regla hoy (ver #7 del PRD: sigue sin confirmarse
  si "ingresos" es el único disparador; por eso `categoriaImpacto` es categórico
  y extensible, no un booleano).
- La función recibe **sólo los risks vinculados a ese squad** (vía `RiskSquad`).
  El filtrado por squad es responsabilidad de quien la llama, no de la regla.
- `semaforo()` se llama **sólo en las escrituras** (write-through): confirmar un
  check-in (Flujo 2), importar (Flujo 3) o crear/editar/resolver un Risk (Flujo
  4). En cada caso `fechaReferencia` es la `fecha_referencia` de la fila que se
  escribe. **Los reads NO la llaman**: devuelven el `semaforo` persistido. Por eso
  el color no cambia por sí solo cuando una ventana de riesgo vence por calendario
  — se refresca en la próxima escritura (ver `api.md` → "Congelado vs. en vivo").
  `esperadoPct()`, en cambio, sí se recalcula libre en los reads (es pura cuenta
  de fechas).

#### Casos de test (los reales del PRD)

| squad | deliveryDelta | risk activo de ingresos | color | por qué |
|---|---|---|---|---|
| **Adquirencia** | `+0.06` | **sí** | 🔴 **rojo** | el riesgo de ingresos gana aunque Delivery sea positivo |
| **Lealtad** | `−0.11` | no (tiene riesgo, pero no de ingresos) | 🟡 **amarillo** | Delivery negativo sin riesgo de ingresos |
| (verde) | `+0.03` | no | 🟢 **verde** | Delivery ≥ 0 y sin riesgo de ingresos |
| (borde) | `0` | no | 🟢 **verde** | delta = 0 no es negativo |
| (precedencia) | `−0.20` | **sí** | 🔴 **rojo** | rojo tapa amarillo |
| (riesgo resuelto) | `+0.02` | no (resuelto = true) | 🟢 **verde** | un riesgo resuelto no activa |
| (riesgo fuera de ventana) | `+0.02` | no (`fechaReferencia` fuera de rango) | 🟢 **verde** | activo exige `fechaReferencia` dentro de `[semanaInicio, semanaFin]` |

---

### Advertencia de práctica (no es una función de `domain/`, es validación de UI)

**Rojo ⇒ Need.** Todo squad en 🔴 esa semana *debería* tener al menos un `Need`
activo (fuente real pág. 4). Es una **regla de práctica del informe, no un
constraint ni parte de `semaforo()`**: se valida como advertencia en el armado
("este squad está en rojo y no tiene pedido de ayuda"), no impide guardar ni
cambia el color. Vive en la capa de `services/report`, no en `domain/`.

```
avisoRojoSinNeed(squad, semana):
  si semaforo(...) == 'rojo' AND no hay Need activo del squad esa semana
    → advertencia (no bloqueante)
```

---

### Pureza — por qué importa acá

- Ninguna de estas funciones lee la fecha del sistema, la base, ni el DOM.
  Toda fecha entra **como parámetro**: `esperadoPct` recibe `hoy` y `semaforo`
  recibe `fechaReferencia`. Por eso una semana vieja se recomputa idéntica: el
  color y el esperado dependen de la fecha que se les pasa, no del día en que se
  corre.
- Sin efectos: mismas entradas → misma salida. Es lo que hace el **test de
  contrato** y la tabla de casos de arriba verificables sin montar nada.
- El *write-through cache* (recomputar y reescribir los calculados en cada
  edición) vive **fuera** de `domain/`, en la capa de servicios; `domain/` sólo
  provee el cálculo.

### Pendiente (no bloquea la v1)

- **Feriados en días hábiles**: hoy `esperadoPct` sólo excluye fines de semana.
  Si el esperado debe descontar feriados del país, entra una lista de feriados
  como parámetro (se mantiene puro: se le pasa, no se lee de ningún lado). Marcar
  con el equipo de Agile Coach si el desalineo importa a esta escala.
- **`categoriaImpacto` más allá de `'ingresos'`**: si el PRD #7 confirma otro
  disparador de rojo, se suma a `ingresosActivo` sin migrar datos (campo
  categórico). Hasta entonces, `'ingresos'` es el único.

### Nota para el próximo doc (casos de uso / flujos)

`services/report` tiene que **llamar a `ingresosActivo()` de `domain/`**, no
reimplementar su propio chequeo de "¿está activo?" (no resuelto + dentro de la
ventana). Esa regla vive en un solo lugar a propósito — si se reescribe en otro
lado, es cuestión de tiempo hasta que se desincronicen.

---

## SDD — Casos de uso / Flujos (Seguimiento de Squads)

Tercer documento del SDD. Describe **qué pasa de punta a punta** en cada
interacción, quién la dispara, qué reglas de `domain/` toca y qué queda guardado.
Consume `specs/entities.md` (modelo) y `specs/domain.md` (reglas puras). No define
UI ni endpoints todavía — define comportamiento.

Actores (v1): **equipo de Agile Coach** y **equipo dev** (únicos con acceso de
edición). TL/PO no
entran a la web (ver `context/scope.md`).

Regla transversal que atraviesa todos los flujos: los campos calculados
(`esperado_pct`, deltas, `semaforo`) **nunca se editan a mano**; `domain/` los
recomputa. La capa que orquesta esto es `services/report`, que **llama a las
funciones de `domain/`** (incluida `ingresosActivo()`) en vez de reimplementarlas.

---

### Flujo 1 — Ver el estado sin guardar (cualquier día)

**El caso más frecuente y el más barato.** El equipo de Agile Coach entra un día
cualquiera —no hay jueves fijo— y ve el estado al día de hoy, **sin crear ni
tocar ninguna fila**.

- **Actor:** equipo de Agile Coach / equipo dev.
- **Disparador:** abre la herramienta (pre-informe de un squad o comparativo).
- **Precondición:** pasó el gate de acceso (Flujo 7).
- **Pasos:**
  1. `services/report` toma el último check-in guardado de cada squad
     (iniciativas y riesgos vinculados incluidos).
  2. Lee el **`semaforo` persistido** de esa fila (el color oficial — **no lo
     recalcula**; sólo cambia por escritura, ver Flujos 2 y 4).
  3. Calcula **en vivo contra `hoy`** sólo lo que es cuenta de fechas —
     `esperadoPct(hoy, trimestre)` y los deltas contra ese esperado— y lo muestra
     **aparte, etiquetado "a hoy"**, sin pisar el color oficial.
  4. Ensambla el **`SquadReportView`** (el snapshot persistido + sus colecciones +
     el bloque `a_hoy`; ver `api.md` y `architecture.md`) y pinta pre-informe /
     comparativo, con `datos_de` avisando de qué fecha son los reales.
- **Postcondición:** **nada se persiste.** No hay `SquadSnapshot` nuevo, no cambia
  `fecha_referencia` ni el color. Es una vista.
- **Por qué importa:** separa "mirar" de "congelar". El esperado "a hoy" es cuenta
  de fechas y se puede mostrar fresco siempre; el **color no**, porque depende del
  estado de los riesgos y sólo se actualiza por write-through (ver
  `api.md` → "Congelado vs. en vivo").

---

### Flujo 2 — Editar en vivo y confirmar un check-in

El equipo de Agile Coach ajusta datos de entrada (los reales que cargó el TL, la
frase de pronóstico, etc.) y **confirma**. Acá sí se guarda.

- **Actor:** equipo de Agile Coach / equipo dev.
- **Disparador:** edita un dato de entrada y guarda.
- **Precondición:** gate de acceso pasado.
- **Pasos:**
  1. El equipo de Agile Coach edita un **dato de entrada** (`delivery_real_pct`,
     `discovery_real_pct`,
     `frase_pronostico`, o vínculos de riesgo/need/logro…). Si edita un real a
     mano, se activa su flag (`delivery_manual_override` / `discovery_manual_override`
     = `true`) para el Flujo 3.
  2. Al guardar, se fija `fecha_referencia = hoy` para ese check-in.
  3. `domain/` recomputa los derivados contra esa fecha:
     `esperado_pct = esperadoPct(fecha_referencia, trimestre)`,
     los deltas, y `semaforo(deliveryDelta, risks, fecha_referencia)`.
  4. Se escribe la fila de `SquadSnapshot` de **esa semana** (`semana_inicio`),
     con `editado_por` y la `fecha_referencia`.
- **Persistencia — actualización en el lugar:** una **sola fila por squad por
  semana**. Si ya existe la fila de esta semana, se **actualiza en el lugar** (no
  se crea una versión nueva por cada guardado); `fecha_referencia` y
  `esperado_pct` se re-congelan al valor de este último check-in. Entre semanas
  **nunca se pisa**: la fila de la semana pasada conserva su `fecha_referencia` y
  no se recalcula jamás.
- **Postcondición:** el snapshot de la semana refleja el último check-in; los
  calculados quedan congelados contra `fecha_referencia`.
- **Regla de `domain/` que toca:** `esperadoPct`, `delta`, `semaforo` (+
  `ingresosActivo` adentro).
- **Advertencia no bloqueante:** si el resultado es 🔴 y el squad **no** tiene un
  `Need` activo esa semana, `services/report` muestra el aviso "rojo sin pedido de
  ayuda" (ver `domain.md`). No impide guardar.

---

### Flujo 3 — Importar datos desde CSV (adaptador)

La fuente de los reales es el export de Smartsheet, vía el adaptador CSV (Camino
B). Más adelante el mismo flujo entra por `adapters/smartsheet/` sin cambiar nada
aguas abajo.

- **Actor:** equipo de Agile Coach / equipo dev.
- **Disparador:** sube un CSV (export de Smartsheet).
- **Pasos:**
  1. `adapters/csv/CsvDataSource` parsea el CSV → modelo interno. Toda rareza del
     CSV vive **sólo acá**.
  2. Alimenta `Initiative[]` (gráfico de cartera por estado) y los **campos de
     import** del `SquadSnapshot` de la semana: `delivery_real_pct` y
     `discovery_real_pct`.
  3. Se persiste en Postgres. La import cuenta como un **check-in**: fija
     `fecha_referencia` y congela los calculados igual que el Flujo 2. Si ya hay
     fila de la semana para ese squad, **actualiza en el lugar** — respetando la
     resolución de conflicto de abajo.
- **Resolución de conflicto — por campo, no por fila.** El import **no** hace
  last-write-wins de la fila entera: eso pisaría en silencio una corrección
  manual del equipo de Agile Coach con un reimport de un CSV viejo, que es justo
  el caso que la
  edición manual existe para resolver. En cambio:
  - **Campos exclusivos de edición manual** — `frase_pronostico`, `needs`,
    `risks` (y sus vínculos): **el import nunca los toca.** Cero conflicto posible
    ahí, no requieren confirmación.
  - **Campos que pueden venir de ambos lados** — `delivery_real_pct`,
    `discovery_real_pct`: son el único choque real.
    - Si **no** fueron editados a mano esta semana → el import los escribe directo.
    - Si **ya fueron corregidos a mano** esta semana (su flag de override está en
      `true`) y el reimport trae un valor distinto para ese campo → **no se pisa
      en silencio**: se muestra una confirmación antes (*"ya corregiste esto a
      mano, ¿confirmás el import igual?"*). El equipo de Agile Coach decide por
      campo; si no confirma, se conserva el valor manual.
  - **Cómo se sabe qué se tocó a mano:** los flags
    `delivery_manual_override` / `discovery_manual_override` del `SquadSnapshot`
    (ver `entities.md`). Al editar un real a mano (Flujo 2) el flag pasa a `true`;
    un import que choca contra un flag en `true` dispara la confirmación. Si el
    equipo de Agile Coach confirma, se sobrescribe y el flag vuelve a `false`; si
    no, se conserva lo manual y el flag sigue en `true`. **Son dos flags
    separados** — el equipo de Agile Coach puede corregir un real y dejar el otro
    intacto en la misma semana.
- **Postcondición:** los 8 `SquadSnapshot` de la semana quedan en la base con sus
  reales; las correcciones manuales sólo se sobrescriben con confirmación
  explícita. La capa de informe lee de la base, no del CSV.
- **Garantía verificable:** el adaptador escribe en la base y la capa de informe
  lee de la base — cambiar CSV→API sólo cambia *cómo entra* el dato. Lo respalda
  el **test de contrato** contra `ports/DataSource` (ver `architecture.md`).

---

### Flujo 4 — Cargar / editar riesgos (carga manual)

Los riesgos siguen en un Excel aparte; en v1 se cargan a mano. Un riesgo puede
pegarle a varios squads a la vez.

- **Actor:** equipo de Agile Coach / equipo dev.
- **Disparador:** crea, edita, resuelve o vincula un `Risk`.
- **Pasos:**
  1. Se guarda el `Risk` (`categoria_impacto`, `severidad`, `tipo`,
     `semana_inicio`, `semana_fin`, `resuelto`, dueño, acción, checkpoint) y sus
     vínculos `RiskSquad`.
  2. **Recálculo de color (write-through, se persiste):** para cada squad
     vinculado, `semaforo(...)` se recomputa contra la `fecha_referencia` de su
     `SquadSnapshot` **más reciente** y **se reescribe esa fila** (la misma que
     leen los GET). Un riesgo de `categoria_impacto='ingresos'` activo empuja a
     🔴. Crear/editar/resolver un riesgo es **siempre** una escritura: no hay
     variante "sin guardar" acá.
- **Postcondición:** el `semaforo` **persistido** de los squads afectados refleja
  el estado nuevo; nunca queda un color viejo pegado a un riesgo ya resuelto.
- **Regla de `domain/`:** `ingresosActivo(r, fechaReferencia)` — **una sola
  implementación**, la de `domain/`. `services/report` la llama; no reimplementa
  "¿está activo?".
- **Ojo (documentado en `entities.md`):** `categoria_impacto='ingresos'` = plata
  (dispara rojo). No confundir con `UnplannedIntake` = intake (no dispara nada).

---

### Flujo 5 — Armar el pre-informe por squad

- **Actor:** equipo de Agile Coach (lo lleva a la reunión).
- **Disparador:** abre el pre-informe de un squad.
- **Contenido** — el pre-informe **es un `SquadReportView`** (el objeto que
  `services/report` ensambla al leer; ver `api.md` y `architecture.md`). De
  `scope.md`: KPIs; avance por squad (%) y cartera por estado (gráfico, de
  `Initiative`); semáforo + frase de pronóstico; logros de la semana
  (`Achievement`); ingresos no planificados (`UnplannedIntake`); tabla de
  Riesgos/Bloqueos; próximas entregas (`UpcomingDelivery`); "Necesitamos de
  ustedes" (`Need`, no exclusivo de rojo); planes de acción (`ActionPlan`, de
  portafolio).
- **Cálculo:** el `semaforo` y los deltas congelados salen **persistidos** del
  último check-in (el color no se recalcula al mirar); el esperado/delta "a hoy"
  se calcula en vivo contra la fecha pedida y se muestra aparte (ver Flujo 1 y
  `api.md`). El KPI **"no planificadas"** = `COUNT(UnplannedIntake) GROUP BY
  trimestre`.
- **Postcondición:** vista lista para editar en vivo (→ Flujo 2) o exportar (→
  Flujo 6).

---

### Flujo 6 — Comparativo de los 8 squads

- **Actor:** equipo de Agile Coach / equipo dev.
- **Disparador:** abre la vista comparativa.
- **Pasos:** `services/report` arma la grilla de los 8 squads — cada fila es un
  **`SquadReportView` compacto** (la proyección resumida, sin las colecciones
  completas; ver `api.md` `/overview`): el **`semaforo` persistido** de cada uno
  (color oficial, no recalculado), sus deltas congelados y `frase_pronostico`, más
  el bloque `a_hoy` (esperado/deltas contra la fecha pedida) como contexto. Cada
  fila trae su `datos_de`.
- **Postcondición:** vista de una pantalla, editable y exportable, no sólo en el
  export.

---

### Flujo 7 — Exportar a PDF / imagen

- **Actor:** equipo de Agile Coach (al cerrar la reunión).
- **Disparador:** exporta el pre-informe o el comparativo.
- **Pasos:** export **client-side** — CSS de impresión (`window.print()`) para
  PDF, `html-to-image` para PNG. Exporta **lo que se ve**, sin operación de
  servidor.
- **Postcondición:** archivo PDF/PNG del estado mostrado.
- **Upgrade nombrado (no v1):** si la fidelidad no alcanza, mover el export a
  Playwright (Chrome headless) en el servidor (ver `architecture.md`).

---

### Flujo 8 — Acceso (gate, transversal)

- **Disparador:** cualquier request al dominio de producción.
- **Pasos:** middleware de Next.js (Basic Auth casero, corre en el edge) pide la
  credencial compartida de la variable de entorno. Sin credencial → 401.
- **Postcondición:** "cualquiera con el link" → "cualquiera con el link **y** la
  credencial". Es el **piso** declarado en `architecture.md`; no lanzar ni la
  demo interna sin él.
- **Deuda declarada:** sin login real no hay atribución confiable; `editado_por`
  es auto-declarado (auditoría blanda) hasta que entre el puerto `Auth`.

---

### Reglas transversales (valen en todos los flujos)

1. **Los calculados no se editan.** `esperado_pct`, deltas y `semaforo` los
   escribe `domain/`, nunca la UI.
2. **Toda fecha entra como parámetro** (en las escrituras): un check-in usa la
   `fecha_referencia` que congela. Misma función, resultado determinístico.
2b. **El color no se recalcula al leer.** `semaforo` sólo lo escribe el
   write-through en una escritura (check-in, import, riesgo); los reads devuelven
   el persistido. Lo único que se recalcula en vivo al mirar es `esperado_pct`/
   delta "a hoy" (cuenta de fechas), mostrado aparte. Ver `api.md` → "Congelado
   vs. en vivo".
3. **Una sola fuente por regla.** `ingresosActivo()` vive en `domain/`;
   `services/report` la llama. Nada de un segundo chequeo de "¿está activo?".
4. **Persistencia:** una fila de `SquadSnapshot` por squad por semana; se
   actualiza en el lugar dentro de la semana, nunca se pisa entre semanas.
5. **El import respeta lo manual (Flujo 3):** separación por campo. Los campos
   manuales (`frase_pronostico`, `needs`, `risks`) el import no los toca; los dos
   reales sólo se sobrescriben con confirmación si ya fueron corregidos a mano.

---

## SDD — Contratos de API (Seguimiento de Squads)

Cuarto documento del SDD. Define **qué recibe y qué devuelve cada acción** de los
flujos (`specs/flows.md`), sobre el modelo de `specs/entities.md` y las reglas de
`specs/domain.md`. Es el contrato entre el frontend y los route handlers de
Next.js — **no** define pantallas ni componentes (eso lo resuelve el agente al
construir; no es decisión de este doc).

Implementación: **route handlers de Next.js (App Router)**, un solo proyecto (ver
`architecture.md`). No hay backend separado.

### Convenciones (valen para todos los endpoints)

- **Formato:** JSON. Fechas en ISO `YYYY-MM-DD`. Porcentajes como **fracción
  0–1** (igual que `domain/`); el formateo a pp/% es de la vista, no del contrato.
- **Autenticación:** todos los endpoints van **detrás del middleware Basic Auth**
  (Flujo 8). Sin credencial → `401` antes de tocar el handler. No hay endpoint
  público.
- **Campos calculados de sólo lectura:** ningún endpoint de escritura acepta
  `esperado_pct`, `delivery_delta_pct`, `discovery_delta_pct` ni `semaforo`. Si
  llegan en el body se **ignoran** (los escribe `domain/`, nunca el cliente). Ver
  regla transversal #1 de `flows.md`.
- **Fecha de referencia:** los reads muestran **en vivo** contra `?date=` (default
  hoy) sólo lo que es cuenta de fechas (`esperado_pct`/deltas); las escrituras
  congelan `fecha_referencia` en el momento del check-in.
- **`semaforo` es siempre el valor persistido — los reads NO lo recalculan.** El
  color depende del estado de los riesgos, que sólo cambia por **escritura
  explícita** (crear/editar/resolver un Risk, o editar un real): ahí el
  write-through lo recomputa y lo reescribe. Recalcularlo en un GET contra `date`
  mezclaría "cuenta de fechas" con "estado de riesgos" y podría dar un color
  distinto al persistido (ej. una ventana de riesgo que vence por calendario sin
  que nadie lo resuelva), rompiendo la garantía "nunca queda un color viejo". El
  **color oficial es siempre el último persistido**; lo único que se recalcula en
  vivo contra `date` es `esperado_pct`/delta, mostrado **aparte y etiquetado "a
  hoy"**. Ver "Congelado vs. en vivo — por qué el color no se recalcula" abajo.
- **Forma de error:** `{ "error": { "code": string, "message": string } }` con el
  status HTTP correspondiente.

---

### Lecturas (Flujos 1, 5, 6) — nunca persisten

#### `GET /api/report/squad/{squadId}?date=YYYY-MM-DD`
Pre-informe de un squad. Calcula en vivo contra `date` (default hoy). **No crea
ninguna fila** (Flujo 1).

- **De qué fila lee:** siempre la **`SquadSnapshot` más reciente por
  `fecha_referencia`**, sin importar a qué semana pertenece. Si no hubo check-in
  de la semana en curso, usa la última que exista (los reales de ese último
  check-in).
- **Qué devuelve tal cual está persistido (el "oficial"):** `semaforo`,
  `delivery_real_pct`, `discovery_real_pct`, y los `esperado_pct`/deltas
  **congelados** de esa fila. **El color NO se recalcula** (ver principio en
  Convenciones): es el del último check-in/evento, que el write-through mantiene
  fresco.
- **Qué se recalcula en vivo contra `date` (contexto, aparte):** un bloque
  `a_hoy` con `esperado_pct_a_hoy` y `delta_*_a_hoy` = (real persistido − esperado
  a `date`). Es sólo cuenta de fechas; **no** es el color oficial ni lo pisa.
- **Aviso de frescura obligatorio:** el response incluye
  **`datos_de: <fecha_referencia de esa fila>`**, para que la vista pueda avisar
  "estos reales son del [fecha]" en vez de mostrar un real viejo pegado a un
  esperado de hoy sin aclararlo. Si `datos_de` < la semana de `date`, los reales
  no son de esta semana — el dato es explícito, no implícito.
- **200:** un **`SquadReportView`** — el objeto ensamblado en `services/report`
  al leer (no se persiste así; ver `architecture.md`) que junta el `SquadSnapshot`
  persistido con sus colecciones. Contiene: valores persistidos del último
  check-in (`semaforo`, reales, esperado/deltas congelados) + `datos_de` + bloque
  `a_hoy` (esperado/deltas contra `date`) + colecciones (`risks`, `needs`,
  `achievements`, `upcomingDeliveries`, `initiatives`, `unplannedIntake`) +
  `actionPlans` de portafolio. Incluye el **aviso no bloqueante** "rojo sin Need"
  si aplica.
- **404:** `squadId` inexistente. Si el squad existe pero **nunca** tuvo un
  snapshot, `semaforo`/reales/`datos_de` van `null` y sólo se devuelve el bloque
  `a_hoy` (esperado en vivo, sin color oficial todavía).

#### `GET /api/report/overview?date=YYYY-MM-DD`
Comparativo de los 8 squads (Flujo 6): una lista de **`SquadReportView` en su
forma compacta** — por squad, el **`semaforo` persistido** (no recalculado), los
deltas congelados y `frase_pronostico`, más el bloque `a_hoy` (esperado/deltas
contra `date`) como contexto. Es una **proyección resumida** del `SquadReportView`
del endpoint de squad: para el grid no se traen las colecciones completas
(`risks`, `needs`, etc.). Cada squad lee su **snapshot más reciente por
`fecha_referencia`** con el mismo criterio que el endpoint de squad, y cada fila
trae su propio **`datos_de`** — así se ve de un vistazo si algún squad viene
arrastrando reales viejos. No persiste.

#### `GET /api/report/squad/{squadId}/history?from=YYYY-MM-DD&to=YYYY-MM-DD`
Lectura **histórica**: la lista de `SquadSnapshot` persistidos del squad cuya
`fecha_referencia` cae en `[from, to]`, ordenados por `fecha_referencia`.

- **Devuelve cada fila tal cual quedó congelada en su check-in** — su `semaforo`,
  reales y deltas ya persistidos, con su `fecha_referencia` y `semana_inicio`.
  **No recalcula nada**: no hay bloque `a_hoy`, no se toca ninguna fecha. Sólo
  expone lo que ya está guardado.
- **Para qué existe:** es lo que hace **usable** el historial completo que
  `entities.md` justifica guardar — **comparar Q contra Q** (agrupando por
  `trimestre`/`semana_inicio`) y poder verificar algún día **"amarillo sostenido
  3 semanas"** (open-question #6): ambas necesitan leer varias filas pasadas por
  su propia `fecha_referencia`, cosa que el GET de fila-más-reciente no da.
- **Parámetros:** `from`/`to` opcionales (default: todo el historial del squad).
- **200:** `{ "squad_id", "snapshots": [ …filas congeladas… ] }`. Lista vacía si
  no hay filas en el rango (no es 404).
- **404:** `squadId` inexistente.

> El export a PDF/PNG (Flujo 7) es **client-side**: no tiene endpoint. Toma lo que
> ya devolvieron estos reads. Si algún día sube a Playwright server-side, ahí
> entra un endpoint nuevo (upgrade nombrado en `architecture.md`).

---

### Escritura de un check-in (Flujo 2)

#### `PATCH /api/snapshot/{squadId}`
Edita datos de entrada de la semana en curso y **confirma el check-in**.

- **Body (todos opcionales, sólo lo que cambió):**
  `{ delivery_real_pct?, discovery_real_pct?, frase_pronostico?, editado_por }`.
  Los vínculos de riesgo/need/logro tienen sus propios endpoints (abajo).
- **Comportamiento:**
  1. Fija `fecha_referencia = hoy`.
  2. Si el body trae `delivery_real_pct` → activa `delivery_manual_override = true`
     (ídem discovery). **Por campo, independiente.**
  3. `domain/` recomputa `esperado_pct`, deltas y `semaforo`.
  4. **Actualiza en el lugar** la fila de `SquadSnapshot` de esta semana (no crea
     versión nueva); entre semanas nunca se pisa.
- **200:** el `SquadSnapshot` resultante con derivados recomputados y el aviso
  "rojo sin Need" si corresponde.

---

### Riesgos y pedidos (Flujo 4)

Un `Risk` puede afectar varios squads (`RiskSquad`). Toda escritura acá
—incluido **resolver** un riesgo— **recomputa el `semaforo`** de los squads
vinculados vía la **única** implementación de `ingresosActivo()` en `domain/`
(regla transversal #3).

**El recómputo se persiste** (write-through cache, `entities.md`): actualiza el
`semaforo` de la **`SquadSnapshot` más reciente por `fecha_referencia`** de cada
squad afectado —la misma fila que leen los GET—, recalculado contra la
`fecha_referencia` de esa fila. No es un color efímero que sólo aparecería en un
GET futuro: queda escrito, así el comparativo, el export y la próxima lectura ven
el color nuevo sin depender de recalcular. Nunca queda un color viejo pegado a un
riesgo ya resuelto.

- `POST /api/risks` — crea. Body: `descripcion, categoria_impacto, severidad,
  tipo, dueño, accion_proxima, checkpoint, semana_inicio, semana_fin,
  squad_ids[]`.
- `PATCH /api/risks/{id}` — edita, incluye **resolver** (`resuelto: true`) y
  reasignar `squad_ids`.
- Respuesta **200** de ambos: el riesgo + la lista de squads cuyo `semaforo`
  cambió (para refrescar la vista sin recargar todo).

(Análogos y más simples: `POST/PATCH /api/needs`, `/api/achievements`,
`/api/upcoming-deliveries`, `/api/unplanned-intake`, `/api/action-plans`. Mismo
patrón: escriben una entrada de entrada, no tocan calculados.)

---

### Import de CSV — **dos fases** (Flujo 3)

El punto crítico: el import **no puede ser éxito/error simple**. Por la resolución
de conflicto **por campo** ya definida, tiene que poder devolver un **estado
intermedio "hay conflictos, confirmá cuáles aceptás" _antes_ de persistir**. Se
modela en dos fases con un token de staging; **la fase 1 no escribe nada si hay
conflictos.**

#### Fase 1 — `POST /api/import`
Sube el CSV (multipart). El servidor parsea con `adapters/csv`, calcula qué
cambiaría y **detecta conflictos**: campos real (`delivery_real_pct` /
`discovery_real_pct`) cuyo flag de override está en `true` y el valor entrante
**difiere** del manual.

**Regla de upsert de `Initiative`** (qué significa `initiatives_upserted`): la
clave de match es **`(squad_id, codigo_externo)`** (`entities.md`).
- Si la fila del CSV **trae `codigo_externo`** (ej. `IBD015`) y ya existe una
  `Initiative` con ese `(squad_id, codigo_externo)` → **actualiza** esa fila (es
  la misma iniciativa de una semana anterior). Si no existe → inserta.
- Si la fila **no trae `codigo_externo`** (nullable — hay filas de Smartsheet sin
  ID) → **no hay match confiable entre semanas: se inserta fila nueva cada
  import.** Es una limitación conocida (ver "Límites conocidos de la API"), no se
  resuelve en v1.

Dos resultados posibles:

- **200 `applied`** — no hubo conflictos. Se persistió (campos manuales
  intactos, reales sin override escritos directo). Devuelve el resumen de lo
  aplicado.
  ```json
  { "status": "applied",
    "summary": { "squads_updated": 8, "initiatives_upserted": 42 } }
  ```
- **200 `needs_confirmation`** — hubo conflictos. **No se persistió nada.** Se
  guarda el batch parseado en staging (con TTL) y se devuelve un `import_token` +
  la lista de conflictos, campo por campo:
  ```json
  { "status": "needs_confirmation",
    "import_token": "imp_a1b2c3",
    "expires_at": "2026-08-18T14:30:00Z",
    "conflicts": [
      { "squad_id": 3, "field": "delivery_real_pct",
        "current_manual_value": 0.56, "incoming_value": 0.41 },
      { "squad_id": 7, "field": "discovery_real_pct",
        "current_manual_value": 0.30, "incoming_value": 0.38 }
    ],
    "non_conflicting_preview": { "squads_updated": 8, "initiatives_upserted": 42 } }
  ```
  Los campos **sin** conflicto (manuales, y reales sin override) quedan listos en
  el staging; sólo esperan la decisión sobre los conflictivos.
- **422 `invalid_csv`** — el CSV no parsea / faltan columnas. No se toca la base.

#### Fase 2 — `POST /api/import/{import_token}/confirm`
El equipo de Agile Coach decide **por campo** cuáles acepta. Recién acá se
persiste.

- **Body:**
  ```json
  { "decisions": [
      { "squad_id": 3, "field": "delivery_real_pct", "accept": true },
      { "squad_id": 7, "field": "discovery_real_pct", "accept": false }
    ],
    "editado_por": "Equipo de Agile Coach" }
  ```
- **Resolución por decisión** (coincide con `entities.md` / Flujo 3):
  - `accept: true` → se sobrescribe el real con el valor del CSV y su flag
    `*_manual_override` vuelve a **`false`**.
  - `accept: false` → se **conserva el valor manual** y el flag sigue en
    **`true`**.
  - Un conflicto **omitido** en `decisions` se trata como `accept: false` (default
    seguro: no pisar lo manual sin confirmación explícita).
  - Todo lo no conflictivo del batch se aplica igual.
- **200:** resumen final + estado de cada decisión aplicada.
- **409 `token_expired` / `token_not_found`:** el staging venció o no existe →
  reintentar desde la Fase 1 (re-subir el CSV). Evita aplicar un batch viejo
  contra datos que cambiaron mientras tanto.
- **Descartar sin confirmar:** `DELETE /api/import/{import_token}` (o dejar que
  expire por TTL). No persiste nada.

**Por qué dos endpoints y no un flag en uno solo:** la Fase 1 es idempotente y sin
efectos cuando hay conflictos (puede reintentarse sin miedo); la escritura vive
sólo en la Fase 2, con las decisiones explícitas. Un solo endpoint con "modo"
mezclaría "detectar" con "escribir" y haría más fácil pisar algo sin querer —
justo lo que el flujo por campo existe para evitar.

---

### Límites conocidos de la API (v1) — riesgos aceptados, no olvidos

- **`Initiative` no tiene endpoint de escritura propio.** Se **puebla sólo vía
  import** (Flujo 3, `POST /api/import`); **no** hay `POST`/`PATCH
  /api/initiatives`. Las iniciativas son un espejo del CSV de Smartsheet, no algo
  que el equipo de Agile Coach edite a mano en la web — un valor cargado así lo
  pisaría el próximo
  import. Se **leen** (para el gráfico de cartera por estado y el KPI "no
  planificadas") vía la colección `initiatives` del GET de squad. Si algún día
  hiciera falta crear/editar una iniciativa fuera de Smartsheet, ahí entraría el
  endpoint; hoy no existe **a propósito**.
- **Iniciativas sin `codigo_externo` se duplican entre semanas.** El upsert de
  `Initiative` matchea por `(squad_id, codigo_externo)`; las filas del CSV que
  vienen **sin ID** (Smartsheet no siempre lo trae) no tienen clave natural, así
  que cada import las **inserta de nuevo** en vez de actualizar la de la semana
  pasada. Consecuencia: el gráfico de cartera y el conteo pueden inflarse con
  duplicados de esas filas sin código. **Riesgo aceptado en v1**; se resolvería
  exigiendo un ID en Smartsheet, o con una clave sustituta (ej. hash de
  `nombre`), decisión aparte y no ahora.
- **Edición concurrente equipo de Agile Coach/equipo dev: no cubierta.** Si
  ambos equipos editan el mismo
  `SquadSnapshot` (o el mismo `Risk`) a la vez, **gana el último `PATCH` que
  llega**, sin aviso ni bloqueo optimista (no hay `version`/`If-Match`, no hay
  `409` por conflicto de edición). Es un **riesgo aceptado** dado el equipo de 2
  personas que se coordinan y rara vez tocan el mismo squad en el mismo instante
  — **no un descuido**. Si se suman editores (cuando entre el puerto `Auth`),
  revisar control de concurrencia: versión por fila + `409` en conflicto. (El
  `409` que hoy sí existe es sólo el de `token_expired` del import, otra cosa.)

---

### Congelado vs. en vivo — por qué el color no se recalcula

Dos derivados, dos naturalezas distintas:

- **`esperado_pct`/delta = pura cuenta de fechas.** Recalcularlo contra cualquier
  `date` siempre tiene sentido y da lo mismo sin importar quién lo corra. Por eso
  el bloque `a_hoy` puede calcularse en vivo, libre.
- **`semaforo` = cuenta de fechas + estado de los riesgos.** El estado de los
  riesgos **sólo cambia por escritura explícita** (crear/editar/resolver un Risk,
  o editar un real). El write-through recomputa y reescribe el color en cada una
  de esas escrituras; entre escrituras, el color persistido **es** la verdad.

Mezclarlos rompe la garantía. Ejemplo: un riesgo de ingresos con ventana
`[lunes, martes]`. El check-in del lunes lo ve activo → `semaforo` persistido =
🔴. Llega el jueves y **nadie tocó ese Risk** (la ventana venció sola, por
calendario). Un GET que recalculara el color en vivo contra `date=jueves` vería
la ventana vencida y mostraría 🟢/🟡, **contradiciendo la fila persistida** que
sigue en 🔴. Dos lecturas del mismo dato, distinto color, sin que esté definido
cuál gana. Por eso: **el GET no recalcula el color, lee el persistido.**

**Consecuencia asumida (no es un bug, es la semántica):** una ventana de riesgo
que vence sólo por calendario **no** cambia el color por sí sola — el color
oficial refleja el último check-in/evento, no el reloj. Se refresca en la próxima
escritura: típicamente el **check-in siguiente** (Flujo 2), que recomputa contra
su nueva `fecha_referencia` y suelta el rojo si el riesgo ya no aplica. El campo
`datos_de` hace visible esa antigüedad mientras tanto. Si alguna vez se quisiera
que el calendario mueva el color solo, haría falta un recómputo programado
(cron), que **hoy no está** y sería una decisión aparte.

### Mapa flujo → endpoint

| Flujo | Endpoint(s) |
|---|---|
| 1 — Ver sin guardar | `GET /api/report/squad/{id}`, `GET /api/report/overview` (no persisten) |
| — Historial (Q vs Q, amarillo sostenido) | `GET /api/report/squad/{id}/history` (lee filas congeladas, no recalcula) |
| 2 — Editar / confirmar check-in | `PATCH /api/snapshot/{squadId}` |
| 3 — Import CSV | `POST /api/import` → `POST /api/import/{token}/confirm` (2 fases) |
| 4 — Riesgos / pedidos | `POST`·`PATCH /api/risks` (+ needs, achievements, etc.) |
| 5 — Pre-informe | `GET /api/report/squad/{id}` |
| 6 — Comparativo | `GET /api/report/overview` |
| 7 — Export PDF/PNG | *(client-side, sin endpoint)* |
| 8 — Acceso | *(middleware Basic Auth, transversal a todos)* |

### Pendiente (no bloquea)
- **Storage del staging del import:** tabla temporal en Postgres vs. cache en
  memoria. A esta escala (8 squads, un import por semana) una fila temporal con
  TTL alcanza; decidir al implementar.
- **Cuando entre `adapters/smartsheet`:** el contrato de estos endpoints **no
  cambia** — el import podría dispararse desde la API en vez de un archivo, pero
  la lógica de dos fases y la resolución por campo se reusan igual.
