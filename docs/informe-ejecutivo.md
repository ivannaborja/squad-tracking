# Informe ejecutivo semanal en la app — diseño 

*POC 3 · Seguimiento de Squads · 31-08-2026*

## Qué pidió Dai

Que la app **genere los informes ejecutivos semanales** que hoy Dai arma a mano en Google Slides (ejemplos: semanas del 10-14 y 17-21 de agosto), tomando como referencia principal el del **17-21 de agosto**. Acceso vía un **botón "Informe"** que lleva a una página nueva. Esa página tiene:

- Un **informe general** (portafolio, los 8 squads juntos) — como los que Dai mostró.
- Un **informe individual** por squad (página aparte, navegable desde el general).
- El **gráfico de tendencia** (Delivery / Discovery / Esperado por semana) — lo que Dai remarcó como muy importante, va abajo a la derecha.

Las secciones narrativas las **escribe Dai** cada semana (no se auto-generan) — usando la UI de escritura que ya existe.

## Validación importante (buena noticia)

El informe de Dai compara todos los squads contra **un solo "esperado" de portafolio** (58% esa semana). Eso es **exactamente la rampa uniforme del trimestre que la app ya calcula**, y el número coincide (la rampa de la app para el 21-08 da ~56-58%). **La metodología de la app ya coincide con cómo Dai reporta** — no hay que reinventar el cálculo del esperado, y esto cierra la duda de spec que teníamos ("¿esperado por-squad o uniforme?"): para el informe, uniforme es lo correcto.

## Los 4 KPIs de la cabecera — de dónde sale cada uno

Ejemplo tomado del informe del 17-21 de agosto:

| KPI | Valor de ejemplo | Origen del dato | ¿La app lo tiene? |
|---|---|---|---|
| **Avance Delivery** | 67% · esperado 58% (+9pp) · promedio de 8 squads | Promedio del `delivery_real_pct` de los 8 snapshots de la semana, vs. esperado (rampa uniforme) | ✅ Sí (agregado nuevo, simple) |
| **Discovery ponderado** | 52% · esperado 58% (-6pp) · vs. -23pp la sem. pasada | Promedio del `discovery_real_pct` (ignorando los null, ej. Empresas) vs. esperado, **+ comparación con la semana anterior** | ✅ Sí — usa el historial de snapshots que ya guardamos |
| **Pases a producción** | acum. Q3: 8/31 iniciativas en producción / total planificado del Q | Conteo de iniciativas "en producción" en el Q / total planificado | ⚠️ **Necesita el bloque de iniciativas (v1.1)** |
| **Pases planificados esta semana** | 11 · 4 squads con entregas | **Campo manual que completa Dai** (número) — no se calcula automáticamente | ✅ Campo de texto editable, no cálculo |

**Nota sobre KPI 4:** Dai confirmó que este número lo maneja verbalmente en reuniones, así que se implementa como un campo que ella completa a mano en la app (no como cálculo automático desde iniciativas). Se puede calcular automáticamente en una versión futura cuando las iniciativas estén más estables.

**1 de los 4 KPIs depende de las iniciativas** (KPI 3: "Pases a producción") → el bloque v1.1 sigue siendo prerrequisito del informe completo.

## El resto del informe

- **Semáforo por squad** (delivery + discovery + deltas por squad): la app ya lo tiene en el comparativo; se re-maqueta al formato del informe.
- **Gráfico de tendencia** (Delivery / Discovery / Esperado por semana): el modelo **ya guarda un `SquadSnapshot` por squad por semana** (historial completo desde el Bloque 1). El promedio de portafolio por semana sale directo de ahí. Se puebla solo a medida que Dai importa cada semana (al principio 1-2 puntos; es inherente, no un bug).
- **Secciones narrativas editables por Dai** — todas escritas a mano por Dai en la app, ninguna se auto-genera.

### Secciones narrativas del informe general (portafolio)
- "Novedades de la semana" — texto libre de Dai
- "Lectura" — texto libre de Dai

### Secciones narrativas por squad (en el informe individual)
- **Novedades** — texto libre
- **Próximas entregas** — texto libre
- **Pases a producción** — texto libre (lista que escribe Dai)
- **Ingresos no planificados** — texto libre (escribe Dai)
- **Despriorizaciones** — texto libre (campo nuevo, escribe Dai)
- **Necesitamos de ustedes / riesgos** — ya existe como entidad `Need`
- **Bloqueos** — aparte de Riesgos, más prominente (reutiliza `Risk.tipo="bloqueo"`)

## Informe general vs. individual

- **General (portafolio):** los 8 squads juntos, los 4 KPIs, semáforo, tendencia de portafolio, narrativa. El botón "Informe" lleva directo aquí. Desde aquí se puede navegar al informe individual de cada squad.
- **Individual (por squad):** página aparte. Misma estructura de KPIs pero para ese squad solo (delivery/discovery/esperado del squad, pases a producción del squad, pases planificados manual). Gráfico de tendencia = **la tendencia de ESE squad** (su historial propio, no el portafolio). Secciones narrativas del squad.

Ambos exportables a PDF/PNG (la app ya tiene export).

## Periodicidad

**Solo semanal por ahora.** La vista mensual (período seleccionable semana/mes) queda para una versión futura — fuera de alcance de este bloque.

## Lo que se descarta / elimina de la app

- **"Cartera por estado"** — Dai no reconoce esta sección, se elimina.
- **"Planes de acción (portafolios)"** — Dai tampoco, se elimina.
- **Columnas "Cantidad soporte" / "Avance soporte"** del xlsx — se ignoran, no van al informe.

## Dependencia y secuencia propuesta

El bloque de **iniciativas (v1.1)** es prerrequisito del KPI 3 ("Pases a producción") y de las listas de pases. Recomendación:

1. **Primero: bloque de iniciativas (v1.1).** Poblar la tabla `Initiative` desde el xlsx usando el `Identificador de la fila` de Smartsheet como identidad (no el código IBD, que se repite). Ya está diseñado. Habilita "Pases a producción" y la cartera-detalle.
2. **Después: informe ejecutivo.** Con las iniciativas ya disponibles, se arma el informe completo.

## Respuestas de Dai — todas confirmadas

1. **Pase a producción =** `Etapa = "Despliegue"` **+** `% Completo = 100%` **+** `Estado = "Completo"`. Verificado en la planilla: "Despliegue" es una Etapa real (105 filas). ✅
2. **Denominador ("/31") =** iniciativas con `Portafolio = true` (columna C). El bloque de iniciativas debe capturar esa columna.
3. **Pases planificados esta semana =** campo manual que completa Dai (número), no cálculo automático.
4. **Informe individual = página aparte.** Navegable desde el general.
5. **Secciones narrativas:** Novedades, Próximas entregas, Pases a producción, Ingresos no planificados, Despriorizaciones, Necesitamos/riesgos, Bloqueos (aparte y prominente). Todas escritas por Dai.
6. **Periodicidad:** solo semanal (v1). Mensual queda para v2.
7. **Informe individual:** misma estructura de KPIs que el general, pero para ese squad. Gráfico = tendencia del squad, no del portafolio.
8. **Soporte:** columnas ignoradas.
9. **Eliminar de la app:** "Cartera por estado" y "Planes de acción (portafolios)".

## La planilla maestra de Dai = el molde completo

El link que pasó Dai es su **planilla maestra semanal completa**. Tiene, por squad y por semana (13-08, 21-08, 28-08…):

- Esperado semanal · Delivery Comprometido · Discovery Comprometido · Deltas
- **Bloqueos** (columna aparte) · **Novedades de squad** · **Próximas entregas** · **Pases a producción** · **Ingresos no planificados** · **Despriorizaciones** · **Necesitamos de ustedes / riesgos**
- Una **tabla de tendencia** — exactamente el dato detrás del gráfico que Dai quiere. Totales de portafolio: 13-08: 64/31/50 · 21-08: 67/52/58 · 28-08: 75/62/64.

## ⚠️ Hallazgo: la fórmula del esperado NO coincide con la de la app

**Dai calcula el esperado con días CALENDARIO: días transcurridos / 92** (Q3 = 92 días calendario, del 1/7 al 30/9). Su planilla lo dice explícito: "del 1 de julio al 28 de agosto = 59 días = 64%". La **app hoy usa días HÁBILES / 66** (`domain/esperadoPct.ts`). Se alinea al método de Dai en el Bloque A.

## Decisiones tomadas (31-08)
- **Esperado → días calendario / 92** (fórmula de Dai). Se implementa en el Bloque A.
- **Secuencia: Bloque A (esperado) → Bloque B (iniciativas v1.1) → Bloque C (informe ejecutivo).**
- **KPI 4 "Pases planificados" = campo manual** (no cálculo automático).
- **Despriorizaciones e Ingresos no planificados = texto libre** que escribe Dai (nuevos campos en la app).
- **Periodicidad = solo semanal** (v1). Mensual fuera de alcance.
- **Navegación:** botón "Informe" → general de portafolio → desde ahí al individual por squad.
- **Eliminar de la app:** "Cartera por estado" y "Planes de acción".

## Prompt para Claude Code (Gate 1)

> Hay que sumar a la app el **informe ejecutivo semanal** que Dai arma hoy a mano. Es un esfuerzo de **3 bloques en secuencia** + una limpieza. El detalle, las respuestas de Dai verificadas y la planilla maestra que es el molde están en `docs/informe-ejecutivo.md` (commiteálo al repo si no está) — **leélo primero**.
>
> **Esto es Gate 1: producí un plan por bloque, NO construyas todavía.** Rama nueva por bloque, PR contra main, no mergees. Leé los archivos reales del repo, no asumas. Después de cada merge se verifica la feature EN VIVO sobre main (no solo tsc).
>
> ---
>
> **Bloque 0 (limpieza, chico, PR propio) — Eliminar secciones que Dai no reconoce.**
> Buscar y eliminar de la app: (1) **"Cartera por estado"** y (2) **"Planes de acción (portafolios)"**. Dai no sabe qué son. Buscar en el repo todos los archivos que las renderizan o sirven (componentes, rutas de API, queries), eliminarlos o vaciarlos. Si hay tablas/modelos de Prisma exclusivos de esas features, agregarlos a la migración de limpieza. No romper el resto de la app.
>
> **Bloque A — Esperado a días calendario (chico, PR propio).**
> Hoy `domain/esperadoPct.ts` usa días HÁBILES / total hábiles del Q. Dai usa días CALENDARIO transcurridos / 92 (Q3 = 92 días calendario, 1/7 al 30/9, inclusive). Cambiar `esperadoPct()` a: días calendario inclusive de `inicio` a `fechaReferencia`, dividido por los días calendario totales de `inicio`..`fin`. Verificar: 1/7 al 28/8 = 59 días → 59/92 = 64% (coincide con Dai). Actualizar `docs/SDD.md` (donde diga "66 días hábiles"). Los `esperado_pct`/deltas guardados quedan viejos hasta reimportar; la vista "a hoy" recalcula sola. Paso de despliegue: reimportar el xlsx tras mergear. Verificación en vivo: un snapshot del 28/8 muestra esperado 64%.
>
> **Bloque B — Iniciativas v1.1 (prerrequisito del informe).**
> El adaptador xlsx hoy no escribe iniciativas (diferidas por choque de códigos IBD repetidos). Poblarlas ahora. **Identidad = `Identificador de la fila` de Smartsheet (columna V), único y estable — NO el código IBD.** Agregar `smartsheetRowId` a `Initiative`, migración, `@@unique([squadId, smartsheetRowId])`; mantener `codigoExterno` como informativo. Capturar además: `Portafolio` (bool, col C), `Etapa` (col L), `Estado`, `% Completo`, `Fecha de Finalización` (planificada) y `Fecha Fin Real`. **Leé el archivo real y confirmá a qué nivel del árbol están las iniciativas con `Portafolio=true` (hay 83) y cuáles son las reales a importar (vs. tareas/plantilla) — no asumas el nivel.** Reusar el pipeline de import (sin conflicto de override; son import-driven). Verificación en vivo: las de `Etapa=Despliegue + %Completo=100 + Estado=Completo` quedan identificables.
>
> **Bloque C — Informe ejecutivo (el grande).**
> Página nueva vía botón "Informe" desde el comparativo. Lleva directo al **informe general de portafolio**; desde ahí se navega al **informe individual de cada squad** (página aparte). Molde exacto: `docs/informe-ejecutivo.md` + la planilla maestra de Dai.
>
> **4 KPIs:**
> - (1) Avance Delivery = promedio `delivery_real_pct` de los 8 squads vs esperado (+delta)
> - (2) Discovery ponderado = promedio `discovery_real_pct` (ignorando nulls, ej. Empresas) vs esperado + comparación con semana anterior
> - (3) Pases a producción = iniciativas `Portafolio=true` en `Despliegue+100%+Completo` del Q / total `Portafolio=true` del Q (viene de Bloque B)
> - (4) Pases planificados esta semana = **campo manual** que completa Dai (un número), no cálculo automático
>
> **Informe general:** semáforo por squad (delivery+discovery+deltas), gráfico de tendencia Delivery/Discovery/Esperado del portafolio por semana (historial de `SquadSnapshot`). Narrativa editable: "Novedades de la semana" y "Lectura" (entidad nueva `InformeSemanal` por semana, textos que escribe Dai).
>
> **Informe individual por squad:** misma estructura de KPIs pero para ese squad. Gráfico de tendencia = **la tendencia de ESE squad** (no el portafolio). Secciones narrativas editables por squad: Novedades, Próximas entregas, Pases a producción (texto libre), Ingresos no planificados (texto libre), **Despriorizaciones (nuevo, texto libre)**, Necesitamos/riesgos (reutiliza `Need`). **Bloqueos aparte de Riesgos** — reutiliza `Risk.tipo="bloqueo"`, pero surfaceado prominente, separado visualmente de los riesgos.
>
> **Periodicidad:** solo semanal (v1). No implementar selector de mes — fuera de alcance.
>
> Export PDF/PNG (reusar el existente).
>
> Producí el Gate 1 (plan por bloque: archivos a tocar, decisiones, verificación) y esperá aprobación. No mergees.

## Fuera de alcance / versión futura
- Periodicidad mensual (selector semana/mes, histórico de meses cerrados) → v2.
- Narrativa auto-generada por la app → por ahora la escribe Dai.
- KPI 4 calculado automáticamente desde iniciativas → puede hacerse cuando las iniciativas estén más estables.

*Nota de manejo: datos internos. Vive en el Project, no se publica afuera.*