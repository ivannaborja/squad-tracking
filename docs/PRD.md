# PRD — Seguimiento de Squads

---

## Problema

### Qué problema resuelve
La información de estado de 8 squads está dispersa en tres fuentes que no se
hablan: Smartsheet (avance real, cargado a mano por cada TL), Jira y un Excel
de riesgos aparte. Para la reunión semanal de los jueves, el equipo de Agile
Coach consolida todo a mano y, además, calcula día por día el "% de avance
esperado del trimestre" con una fórmula de tiempo. Es trabajo manual,
repetitivo y propenso a error, que se rehace cada vez que un dato cambia.

### Para quién
El equipo de Agile Coach, dueño del armado y de la reunión de los jueves.

### Por qué ahora
Evidencia directa, no inferida: el 14-08 el equipo de Agile Coach pidió
explícitamente automatizar el cálculo diario del % esperado —"el número cambia
día a día"— como una de las cosas que este módulo debe resolver.

### El cálculo, exacto
- **Esperado (nivel trimestre):** días hábiles transcurridos / días hábiles
  totales del Q. Igual para los 8 squads. Ej. 14-08 → día 33 de 66 del Q3 = 50%
  (verificado: semana del 04-08 = 36%, semana del 11-08 = 48%, todos por igual).
  Hoy el equipo de Agile Coach lo calcula a mano cada día. Es cuenta, no
  juicio → 100% automatizable.
- **Esperado (nivel tarea/iniciativa):** ya es fórmula viva en Smartsheet
  —`SI hoy < inicio → 0; si no → MIN(100%, (hoy − inicio)/(fin − inicio))`—.
  No se recalcula: se lee.
- **Real:** son **dos categorías separadas por squad**, no un solo número:
  **Delivery comprometido** y **Discovery comprometido**. Cada una se compara
  contra el mismo esperado del trimestre (50% al 14-08) y tiene su propio delta
  en pp. Las carga a mano cada TL en Smartsheet.

### Cómo sabremos si funcionó
- El equipo de Agile Coach deja de calcular el esperado a mano (queda
  automatizado).
- Llega al jueves con el pre-informe por squad y el comparativo ya armados.
- El armado semanal pasa de horas a minutos.
(Métrica dura pendiente: minutos exactos del proceso hoy — ver open-questions.)

### Gaps declarados
- Minutos exactos del armado/cálculo manual y si el equipo de Agile Coach
  copia-pega entre las tres fuentes: no medido. Dueño: equipo de Agile Coach.

---

## Usuarios

### Usuario primario
**Equipo de Agile Coach.** Arma el pre-informe, corre la reunión de los jueves,
edita en vivo y exporta. Es quien pidió la herramienta. Si no se resuelve:
sigue perdiendo horas cada semana consolidando a mano y recalculando el
esperado día a día, con riesgo de llegar al jueves con números desactualizados.

### Con acceso de edición en v1
**Equipo de Agile Coach** y **equipo dev**. Nadie más edita en la web en la
primera versión.

### Usuarios de datos de entrada (sin acceso a la web en v1)
**TLs (líderes técnicos)** — cargan Delivery y Discovery comprometido de su
squad **en Smartsheet**, no en la web. **PO** — comunican avances/bloqueantes
hacia la Agile Coach durante la semana. En v1 no tienen acceso de edición a la
herramienta; siguen operando en Smartsheet como fuente de datos de entrada.

### Qué usan hoy en lugar de esto
Smartsheet + Jira + Excel de riesgos por separado, y el cálculo manual del
equipo de Agile Coach en su propia planilla. La consolidación y el armado del
deck es 100% manual.

### Frescura que necesitan
Foto semanal al día para el jueves. No hace falta tiempo real: los TL/PO
completan durante la semana y alcanza con estar al día para la reunión.

### Gaps declarados
- ¿Los TLs cargan a diario o esporádicamente? Frecuencia real no confirmada.
  Dueño: equipo de Agile Coach / TLs.

---

## Visión

Una sola web interna donde el estado de los 8 squads llega consolidado y
calculado solo. El equipo de Agile Coach abre la herramienta, cualquier día, y
ya tiene: el pre-informe
por squad y el comparativo de los 8, con el % esperado y los reales (Delivery y
Discovery) cruzados, el semáforo puesto por regla y el delta en puntos
porcentuales — sin haber hecho una sola cuenta a mano.

Durante la reunión edita en vivo lo que es dato de entrada (corrige un % que un
TL no cargó, suma un riesgo, escribe la frase de pronóstico de una línea) y todo
lo calculado se recalcula solo delante de todos. Al terminar, exporta a PDF o
imagen y comparte.

El número que hoy el equipo de Agile Coach calcula día por día deja de existir
como tarea: es una
fórmula que la herramienta corre sola con la fecha de hoy.

En tres años esto se vuelve **más** necesario, no menos: más squads, más
trimestres, y el mismo ritual semanal que hoy no escala porque depende de las
horas manuales de una persona.

### Lo que sorprendió y bajó el esfuerzo
El "% esperado" a nivel tarea ya vivía como fórmula dentro de Smartsheet. El
producto no tiene que inventar el cálculo fino: tiene que leerlo, agregar el
número de trimestre y presentarlo editable y exportable.

---

## Alcance

### Alternativas consideradas (fase de alternativas del PRD)

- **Camino A** (el más chico, esta semana): sin adaptador, la web importa CSV o
  el equipo de Agile Coach tipea directo. Calcula esperado + semáforo, arma
  pre-informe y comparativo,
  exporta. Esfuerzo bajo, riesgo bajo. Problema: cuando llegue la API de
  Smartsheet, hay que reescribir la capa de datos.
- **Camino C** (lateral, no construir web): agregar el agregado del Q + semáforo
  directo en Smartsheet como dashboard. Esfuerzo muy bajo, pero choca con "editar
  en vivo" y "export a medida", y con el muro de login. Resuelve la cuenta manual,
  no la reunión.
- **Elegido: B.** A y B cuestan casi lo mismo porque la capa de informe domina el
  esfuerzo; B evita reescribir cuando llegue la API. C descarta el corazón del
  pedido (edición en vivo + export a medida).

### v1 — Camino B (decisión de slicing)
Misma experiencia de cara al equipo de Agile Coach que la carga manual, pero con
la fuente de datos
detrás de un adaptador desde el día 1: "import CSV (export de Smartsheet)" es el
primer adaptador; "Smartsheet API" es el segundo, y entra sin reescribir la capa
de informe cuando IT confirme acceso.

#### Entra en v1
- Cálculo automático del **esperado**: agregado de trimestre (días hábiles
  transcurridos / totales) y lectura del esperado por tarea que ya trae el
  export de Smartsheet.
- **Dos reales por squad** —Delivery comprometido y Discovery comprometido—
  cruzados contra el esperado del Q, cada uno con su **delta en pp**.
- **Semáforo por regla cualitativa** (no promedio ni umbral mecánico de pp).
  Orden de precedencia:
  - 🔴 **Rojo** — hay un riesgo activo nombrado con **impacto directo en
    ingresos**. Dispara rojo **por sí solo, sin importar el signo de Delivery**
    (ej. Adquirencia: Delivery +6 pp y aun así rojo).
  - 🟡 **Amarillo** — Delivery comprometido en negativo **sin** un riesgo de ese
    tipo (ej. Lealtad: −11 pp, con un riesgo pero sin impacto en ingresos).
  - 🟢 **Verde** — Delivery comprometido ≥ 0 pp y sin riesgo de ingresos.
  - **Discovery comprometido no cambia el color** por sí solo, ni aunque esté
    muy bajo: se reporta aparte como **hallazgo de portafolio**, no como causa
    de rojo/amarillo de un squad puntual.
- **Pre-informe por squad** con: KPIs (en producción, % avance general real vs.
  esperado con delta, en despliegue/QA, no planificadas); avance por squad (%) y
  cartera por estado en gráfico; semáforo + frase de pronóstico de cierre del Q;
  logros de la semana; ingresos no planificados de la semana; tabla de Riesgos |
  Bloqueos (Riesgo, Impacto, Severidad, Dueño, Acción/próximo paso, Checkpoint);
  próximas entregas (fecha, 2-3 semanas adelante); "Necesitamos de ustedes /
  Necesitamos ayuda" con dueño por pedido (**no exclusivo de rojo: aparece
  también en squads en amarillo**); planes de acción en curso.
- **Comparativo de los 8 squads** — en vivo, no sólo en el export.
- **Edición en vivo** de datos de entrada; los % calculados (esperado, brechas,
  color) se recalculan solos y no se editan a mano.
- **Frase de pronóstico manual** de una línea por squad (la escribe el equipo de
  Agile Coach; convive
  con el color automático, no lo reemplaza).
- **Carga manual de riesgos** (equipo de Agile Coach/equipo dev pegan o tipean;
  el Excel sigue aparte).
- **Export a PDF e imagen** del pre-informe y del comparativo.

### Lo que NO hace la v1
- **No** da acceso de edición a los TL ni al PO: sólo el equipo de Agile Coach y
  el equipo dev editan en la web. Los TL siguen cargando en Smartsheet.
  Reactivación: si se decide abrir
  autoservicio de carga en la web.
- **No** integra automáticamente con Smartsheet todavía (adaptador API queda
  listo; se activa cuando IT confirme acceso). Reactivación: acceso API
  habilitado.
- **No** integra riesgos automáticamente (siguen en Excel; carga manual).
  Reactivación: si se decide llevar riesgos a Smartsheet/fuente conectable.
- **No** consume Jira directamente en v1 (el real llega vía Smartsheet).
  Reactivación: si se define que un dato debe salir de Jira.
- **No** escala el color por antigüedad del amarillo (regla de 3 semanas sin
  confirmar — ver open-questions).
- **No** es tiempo real: es foto semanal para el jueves.
- **No** deja editar a mano los números calculados.

### Restricciones duras
- El link de Smartsheet redirige a login: no se lee sin sesión autenticada, y
  el acceso a la API no está confirmado con IT. La v1 no depende de eso (usa el
  puente de export manual), pero la integración plena sí. Dueño: IT.

### A quién NO sirve (todavía)
- No es una herramienta para que cada TL/PO gestione su squad: es la vista de
  consolidación y reporte del equipo de Agile Coach, editable sólo por el
  equipo de Agile Coach y el equipo dev.

---

## Contra qué compite (alternativas actuales)

Herramienta interna: no compite en un mercado, compite contra cómo se hace hoy.

- **El proceso manual actual** (equipo de Agile Coach consolidando las 3 fuentes
  + cálculo diario +
  armado del deck a mano). Es el rival real. Diferencia: la web elimina el
  cálculo y la consolidación manual, y deja el armado listo para el jueves.
- **Dashboards nativos de Smartsheet.** Ya tienen la fórmula del esperado por
  tarea. Techo: no dan edición en vivo en reunión, ni export a PDF/imagen a
  medida del deck, y arrastran el muro de login/acceso.
- **Dashboards de Jira.** No consolidan las tres fuentes ni dan el esperado por
  tiempo del trimestre.
- **BI genérico (tipo Power BI).** Sobredimensionado para el ritual semanal y no
  pensado para editar en vivo delante de la reunión.

Diferenciador central: es la única opción que junta *cálculo automático del
esperado + consolidación de las 3 fuentes + edición en vivo + export a medida*
en el mismo lugar y en el momento de la reunión.

---

## Oportunidades (no decididas)

- **Integración plena con Smartsheet API** una vez que IT habilite acceso:
  elimina el puente de export manual. Adaptador ya previsto en v1 (Camino B).
- **Conectar riesgos a una fuente** (llevar el Excel a Smartsheet o a la propia
  web) para dejar de tipearlos.
- **Histórico de trimestres**: guardar los cierres para comparar Q contra Q y
  ver tendencia por squad — habilita reglas que hoy no se pueden verificar con
  una sola semana (ej. escalar amarillo sostenido).
- **% real objetivo desde Jira** (cerrados/total) si se decide que el avance no
  debe depender del juicio del TL — depende de cerrar la pregunta abierta.
- **Autoservicio para TLs/PO**: que carguen directo en la web en vez de
  Smartsheet, cerrando el círculo de datos de entrada.

---

## Preguntas abiertas (vivo)

1. **¿El % real que carga el TL es cuenta objetiva o estimación?**
   ¿Sale de Jira (cerrados/total) o es juicio personal del TL? Aplica a Delivery
   y Discovery. Cambia cuánto confiar en el número. Dueño: equipo de Agile Coach / TLs.
2. **¿Está habilitado el acceso a la API de Smartsheet?** Y si no, ¿el puente
   es export manual? Bloquea la integración plena, no la v1. Dueño: IT.
3. **¿Cuántos minutos/horas exactos** lleva hoy el armado + cálculo, y el
   equipo de Agile Coach copia-pega entre las 3 fuentes? Necesario para la
   métrica de éxito dura.
   Dueño: equipo de Agile Coach.
4. **¿Con qué frecuencia cargan los TLs** el real (diario / esporádico)?
   Afecta qué tan "al día" está la foto del jueves. Dueño: equipo de Agile Coach / TLs.
5. **¿Qué rol juega Jira en v1?** Se nombró como fuente pero el real llega por
   Smartsheet. Definir si queda afuera o entra como fuente de algún dato.
   Dueño: equipo de Agile Coach.
6. **¿Se escala el color por amarillo sostenido?** Regla candidata: amarillo
   3 semanas seguidas escala. No verificable en un informe de una sola semana;
   sin confirmar. Dueño: equipo de Agile Coach.
7. **¿"Impacto en ingresos" es el único disparador de rojo?** Es el único caso
   observado (Adquirencia) que empuja a rojo independiente del Delivery. Con una
   sola semana de datos no alcanza para saber si hay otros tipos de riesgo
   severo que también deberían disparar rojo. Dueño: equipo de Agile Coach.

---

## Glosario

- **Squad** — equipo de trabajo con avance propio; hay 8 en seguimiento.
- **% avance esperado (trimestre)** — días hábiles transcurridos / días hábiles
  totales del Q. Igual para los 8 squads. Se calcula solo con la fecha de hoy.
- **% avance esperado (tarea)** — fórmula viva en Smartsheet:
  `SI hoy < inicio → 0; si no → MIN(100%, (hoy − inicio)/(fin − inicio))`.
- **Delivery comprometido** — una de las dos categorías de avance real del
  squad; se compara contra el esperado del Q. Es la que puede llevar el squad a
  amarillo cuando queda en negativo.
- **Discovery comprometido** — la otra categoría de avance real; se reporta como
  hallazgo de portafolio y NO cambia el color del semáforo por sí sola.
- **Brecha / delta (pp)** — real − esperado, en puntos porcentuales; una por
  categoría (Delivery y Discovery).
- **Semáforo** — color por regla cualitativa, con precedencia:
  - 🔴 Rojo — riesgo activo nombrado con impacto directo en ingresos; dispara
    rojo por sí solo, sin importar el signo de Delivery (ej. Adquirencia +6 pp).
  - 🟡 Amarillo — Delivery en negativo sin riesgo de ingresos (ej. Lealtad −11 pp).
  - 🟢 Verde — Delivery ≥ 0 pp y sin riesgo de ingresos.
  - Discovery no altera el color.
  - **Activo** (de un riesgo) = `resuelto = false` y la fecha de referencia cae
    dentro de `[semana_inicio, semana_fin]` del riesgo (igual que en
    `specs/entities.md`).
- **Frase de pronóstico** — comentario manual de una línea por squad que escribe
  el equipo de Agile Coach (ej. "Bloqueo BEPSA", "sale 07/07", "en fecha").
  Convive con el color.
- **Pre-informe** — reporte por squad que el equipo de Agile Coach lleva al
  jueves, editable en vivo.
- **Comparativo** — vista de los 8 squads juntos, en vivo y exportable.
- **Necesitamos ayuda / de ustedes** — pedidos con dueño; aparecen en rojo y en
  amarillo.
- **Hallazgo de portafolio** — señal a nivel cartera (ej. Discovery bajo) que se
  reporta aparte, no como estado de un squad puntual.
- **TL** — líder técnico; carga Delivery y Discovery de su squad en Smartsheet.
- **PO** — product owner; comunica avances/bloqueantes a la Agile Coach.
- **Agile Coach** — rol dueño del seguimiento y de la reunión; en esta
  herramienta, el **equipo de Agile Coach**.
- **Riesgo/Bloqueo** — entrada de la tabla: Riesgo, Impacto, Severidad, Dueño,
  Acción/próximo paso, Checkpoint. Hoy en Excel aparte.
