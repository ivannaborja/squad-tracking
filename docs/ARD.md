# ARD — Arquitectura del cuerpo — Seguimiento de Squads (v1, Camino B)

Decisión técnica para la v1. Perfil que la condiciona: **construye y mantiene
el equipo dev**; **cloud externo permitido**; **datos minúsculos**
(8 squads × foto semanal); **sin tiempo real**; **sin login en v1** (URL directa,
sólo el equipo de Agile Coach y el equipo dev). El criterio que pesa más es *una
sola cosa que aprender y
arreglar*: un lenguaje, un framework, un deploy, una base.

## Restricción dura: presupuesto cero (es investigación)

**No hay presupuesto para este proyecto. Todo tiene que ser GRATIS, no "barato".**
Cada pieza elegida debe tener un **free tier permanente, sin tarjeta de crédito**
—no un trial que vence—. Confirmado en vivo (agosto 2026):

| Pieza | Free tier | Sin tarjeta | Permanente (no trial) | Uso comercial |
|---|---|---|---|---|
| **Next.js** | Open-source (MIT) | Sí | Sí | Sí |
| **Prisma** | Open-source (Apache 2.0) | Sí | Sí | Sí |
| **Recharts** | Open-source (MIT) | Sí | Sí | Sí |
| **Vercel Hobby** | Gratis para siempre; al llegar al límite **pausa, no factura** | Sí | Sí | **No** (ToS no-comercial ⚠️) |
| **Neon (Postgres)** | 0,5 GB/proyecto, 100 CU-h/mes, escala a cero y auto-resume | Sí | Sí, no vence | **Sí** |
| **Supabase (alt.)** | 500 MB DB; **pausa tras 7 días de inactividad** ⚠️ | Sí | Sí | Sí |

**Base de datos → Neon como opción primaria.** Sobre Supabase justamente porque
esta herramienta se usa una vez por semana: los 7 días de inactividad de
Supabase pueden dejar el proyecto pausado (despausado manual desde el dashboard)
justo un jueves. Neon escala a cero pero **auto-resume** en la siguiente query,
sin intervención. Supabase queda como alternativa válida sólo si se agrega un
keep-alive.

**El único riesgo de "uso comercial" vive en la capa de hosting (Vercel Hobby).**
Neon y Supabase permiten uso comercial en su free tier; el DB no es el problema.

> ⚠️ **Regla de gasto — autorización antes, nunca asumir.** Si en algún momento
> hace falta pasar a **Vercel Pro** (~$20/mes, por el ToS no-comercial de Hobby)
> o migrar a un free tier con límites más chicos, **eso ya es gasto real y hay
> que pedir autorización explícita antes de hacerlo** — no se asume ni se activa
> por conveniencia. Mientras tanto, el piloto corre 100% en free tiers
> permanentes sin tarjeta.

## Stack

| Capa | Decisión | Por qué / qué se descarta |
|---|---|---|
| Backend + Frontend | **Next.js (App Router), TypeScript** | Un solo proyecto y lenguaje; la "API" son route handlers en el mismo repo, sin backend separado. Se descarta **FastAPI+React** (duplica lenguajes y deploys sin ganancia) y **no-code** (no deja construir el adaptador que Camino B exige). |
| Base de datos | **Postgres gestionado — Neon (primaria), Supabase (alt.)** con **Prisma** | Relacional y aburrido; los datos son tabulares. Neon sobre Supabase por el free tier: auto-resume vs. pausa a los 7 días de inactividad (ver "Restricción dura: presupuesto cero"). Prisma sobre Drizzle por documentación que el agente maneja mejor (costo asumido: un poco más pesado). Se descarta NoSQL (no hay nada no-relacional) y SQLite/Turso (suma detalle de infra sin ganar nada a esta escala). |
| Gráficos | **Recharts** | Declarativo y probado; alcanza para avance por squad y cartera por estado. |
| Deploy | **Vercel** | Cero config con Next.js; free tier sobra para 2 personas. Se descarta infra propia/contenedores: no hay razón para operar servidores que un no-dev no quiere administrar. |
| Export PDF/imagen | **Client-side primero**: CSS de impresión (`window.print()`) para PDF y `html-to-image` para PNG | Exporta lo que se ve, sin operación de servidor. **Upgrade nombrado:** si la fidelidad no alcanza, mover el export a Playwright (Chrome headless) en el servidor. |

## El adaptador — garantía de que CSV→API no reescribe la capa de informe

Puertos y Adaptadores (hexagonal). Regla única: **la capa de informe nunca ve un
CSV ni un JSON de Smartsheet; sólo ve un modelo interno propio.**

```
  [CSV export]   ─┐
                  ├─►  Adaptador  ──►  SquadSnapshot  ──►  Postgres  ──►  Capa de informe
  [Smartsheet API]┘   (traduce)      (modelo propio)     (guardado)      (calcula, pinta, exporta)
```

- **`domain/`** — modelo canónico + reglas puras. Vive acá `SquadSnapshot`, que
  es **la fila persistida** (coincide exactamente con `specs/entities.md`):
  `squad_id, semana_inicio, fecha_referencia, trimestre, delivery_real_pct,
  discovery_real_pct, delivery_manual_override, discovery_manual_override,
  esperado_pct, delivery_delta_pct, discovery_delta_pct, semaforo,
  frase_pronostico, editado_por`. **Sin colecciones embebidas**: `Risk`, `Need`,
  `Achievement`, `UpcomingDelivery` son **tablas separadas**, no arrays adentro
  del snapshot. Y las reglas: esperado = días hábiles transcurridos / totales, y
  el semáforo con su precedencia (riesgo de ingresos → rojo; Delivery negativo sin
  ese riesgo → amarillo; Discovery no cambia color). Puras, sin saber de dónde
  vino el dato ni cómo se pinta. Se testean solas.
- **`ports/DataSource.ts`** — el contrato: `fetchSnapshot(period): Promise<SquadSnapshot[]>`.
- **`adapters/csv/`** — `CsvDataSource` implementa `DataSource`: parsea el export
  de Smartsheet → `SquadSnapshot`. Toda rareza del CSV vive sólo acá.
- **`adapters/smartsheet/`** — `SmartsheetDataSource`, la **misma** interfaz, más
  adelante. Al agregarlo no se toca ningún otro archivo.
- **`services/report/`** — capa de informe: toma `SquadSnapshot[]` (leídos de
  Postgres) **más** las tablas relacionadas (`Risk`, `Need`, `Achievement`,
  `UpcomingDelivery`, `Initiative`, `UnplannedIntake`, `ActionPlan`), aplica
  reglas de `domain` y **ensambla `SquadReportView`** — el objeto que junta el
  snapshot con sus colecciones para el pre-informe y el comparativo. `SquadReportView`
  **se arma al leer, no se persiste así** (es la vista, no la fila). Importa sólo
  de `domain`, jamás de un adaptador.

Dos cosas hacen la garantía **verificable, no una promesa:**

1. **El flujo pasa por Postgres en el medio.** El adaptador escribe el snapshot
   en la base; la capa de informe lee de la base. Cambiar CSV→API sólo cambia
   *cómo entra* el dato; ediciones en vivo, recálculo y export leen de la base y
   ni se enteran.
2. **Test de contrato** contra la interfaz `DataSource`: ambos adaptadores deben
   pasar el mismo test de "produce un `SquadSnapshot` válido". Al enchufar la
   API, el test verde/rojo avisa —sin leer código— si algo se rompió.

Mismo patrón para el "más adelante": modelar **`ports/Auth`** con un adaptador
"usuario único fijo" hoy y SSO como segundo adaptador después, para que sumar
login no reordene la app.

## Seguridad — deuda declarada, firmada ahora

**Acceso por URL sin login, sobre datos de riesgo con impacto en ingresos.**
Costo real: cualquiera con el link (reenvío de mail, historial, pantalla
compartida) entra y edita, y no hay registro de quién vio o cambió qué.

**Piso de mitigación (gratis, funciona en Hobby):** un gate con **variable de
entorno + middleware de Next.js** (Basic Auth casero, corre en el edge). Una
sola credencial compartida protege todo el dominio de producción. Convierte
"cualquiera con el link" en "cualquiera con el link **y** la credencial".

> Nota: **Vercel Password Protection NO sirve acá.** En el plan Hobby sólo cubre
> deployments de *preview*, no el dominio de producción que usan el equipo de
> Agile Coach y el equipo dev;
> proteger producción requiere Enterprise o el add-on de ~$150/mes en Pro. Por
> eso el piso es el middleware casero, no esa feature.

Recomendación: no lanzar ni la demo interna sin ese piso. Cuando se sumen
usuarios para historial, ahí entra la auth real por el puerto `Auth`.

## Restricción de plan a revisar (no bloqueante para el piloto)

El plan **Hobby de Vercel restringe a uso "no comercial"** en sus términos. Una
herramienta interna de una fintech cae en zona gris. No es problema para un
piloto de 2 personas, pero **revisar si escala más allá del piloto**: mover a
**Vercel Pro (~$20/mes, uso comercial permitido)** o a un host alternativo con
free tier (Render / Fly). El middleware Basic Auth sigue igual en cualquiera de
ellos. **Cualquiera de esos movimientos que implique pago cae bajo la regla de
gasto: autorización explícita antes, nunca asumir** (ver "Restricción dura:
presupuesto cero").

## Próximos pasos verificables

1. **Esqueleto:** Next.js + TS, conectar Neon/Supabase, activar el middleware
   Basic Auth. *Verificable:* la URL de producción pide credencial y muestra una
   página vacía deployada.
2. **Modelo + reglas puras primero:** `domain/` (`SquadSnapshot` + esperado +
   semáforo) con tests. *Verificable:* los casos reales dan verde (Adquirencia
   +6 pp → rojo; Lealtad −11 pp → amarillo).
3. **Adaptador CSV + test de contrato.** *Verificable:* subís un export real y
   ves los 8 `SquadSnapshot` en la base (panel de Neon).
4. **Capa de informe + export.** *Verificable:* ves pre-informe por squad y
   comparativo; editás un dato de entrada y color/brecha se recalculan solos;
   exportás PDF y PNG.
5. **Recién con API confirmada por IT:** agregar `adapters/smartsheet/`, pasa el
   mismo test de contrato, no se toca nada más.

## Deudas y pendientes que hereda esta arquitectura
- Auth real (puerto `Auth` + SSO) — cuando se sumen usuarios/historial.
- Fidelidad del export — si el client-side no alcanza, upgrade a Playwright.
- Plan de hosting comercial — antes de pasar de piloto (ToS de Hobby).
- Acceso a la API de Smartsheet — dueño IT (ver open-questions.md #2).
