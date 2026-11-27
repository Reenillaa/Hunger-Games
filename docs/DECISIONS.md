# DECISIONS — Registro de decisiones

> Responsabilidad de este documento: registrar **qué se decidió, qué alternativas se estudiaron y por qué**.
> No describe el diseño (eso está en `GDD.md` / `GAME_SYSTEMS.md`) ni la arquitectura en detalle (`TECHNICAL_ARCHITECTURE.md`).

Estados posibles:

- **PROPUESTA** — recomendada por el equipo técnico, pendiente de aprobación del cliente.
- **APROBADA** — confirmada por el cliente. No se vuelve a discutir salvo hecho nuevo.
- **INTERNA** — decisión menor tomada con criterio profesional; no requiere aprobación (regla 24 del prompt maestro), pero queda registrada.
- **RECHAZADA / SUSTITUIDA** — se conserva para no repetir el análisis.

---

## Parte A — Decisiones que requieren aprobación del cliente

### D-01 · Identidad original del universo (riesgo de propiedad intelectual) — APROBADA (2026-11-23) · CRÍTICA

**Contexto.** El prompt maestro pide un universo original "para evitar problemas de propiedad intelectual", pero varios elementos del encargo coinciden de forma literal con una franquicia existente y registrada: el título *The Hunger Games*, doce distritos numerados con esas mismas industrias, el distrito 12 minero como punto de partida, "la Cosecha", "el Vasallaje", la capital y el presidente. Cada uno por separado es genérico; **juntos** identifican la franquicia y la convierten en un derivado. Publicar eso en una URL pública es el mayor riesgo legal del proyecto.

**Propuesta.** Mantener todas las mecánicas pedidas (son genéricas: selección forzosa, preparación, arena, régimen) y dar a todo lo visible para el jugador una identidad propia:

| Término de trabajo (docs) | Propuesta original | Motivo |
|---|---|---|
| The Hunger Games (título) | **DIEZMO** | El régimen cobra un diezmo de producción *y* de vidas. Une economía y cosecha en una sola palabra. |
| Capitolio / la capital | **Áurea** | Ciudad dorada; contraste directo con el carbón. |
| Régimen | **La Concordia** | Nombre irónico de propaganda. |
| Presidente | **El Primado / La Primada** (nombre generado por partida) | Título original; el personaje es único en cada partida. |
| Cosecha | **La Criba** | "Cribar" = separar, seleccionar. Seco y siniestro. |
| Tributos / participantes | **Ofrendas** | Lo que el distrito "entrega". |
| Vasallaje (edición especial) | **Jubileo** (cada 25 años, *Gran Jubileo*) | Celebración del régimen = castigo para los distritos. |
| Agentes de la paz | **Custodios** | |
| Patrocinadores / regalos | **Mecenas** / **cápsulas de mecenazgo** | |
| Vencedores | **Laureados** | |
| Suministro central de la arena | **El Relicario** | |

- Los distritos conservan número romano (I–XII) **y** reciben un nombre propio (p. ej. *XII · Veta Negra*), arquitectura y cultura propias.
- **Todo texto visible vive en ficheros de localización** (`src/content/locales/es/*.json`), así que esta decisión **no bloquea el desarrollo**: el código usa identificadores neutros (`district`, `selection`, `participant`, `patron`, `regime`, `ruler`).
- El repositorio puede seguir llamándose `Hunger-Games` como nombre interno, pero **la versión pública no debería mostrar el título ni la marca**.
- Se evitan además los "momentos icónicos" literales (presentarse voluntario en lugar de un hermano, sinsajos, saludo de tres dedos, raciones a cambio de papeletas, proyección nocturna de los caídos en el cielo). Las mecánicas equivalentes se resuelven con soluciones propias (ver `GAME_SYSTEMS.md`).

**Alternativas.** (a) Usar los nombres de la franquicia → riesgo de retirada (DMCA en GitHub Pages) y no apto para publicar. (b) Renombrar solo el título → insuficiente, el conjunto sigue siendo reconocible.

**Aprobación (2026-11-23):** el cliente pide "mantener todo original". Se adoptan los nombres propuestos; siguen centralizados en `src/content/locales/es.ts`. La numeración de las ediciones de los juegos se genera por partida (101–160) para no reproducir números de la obra de referencia.

---

### D-02 · Estrategia de assets: sprites pre-renderizados desde 3D — APROBADA (2026-11-23) · CRÍTICA

**Contexto.** El punto más débil de cualquier proyecto así es el arte: mezclar packs, usar figuras de colores o imágenes generadas inconsistentes produce exactamente el "aspecto de proyecto de IA" que el cliente rechaza. No hay ilustrador en el equipo y en este entorno no hay herramienta de generación de imágenes.

**Propuesta (pipeline híbrido, coste 0 €):**

1. **Entornos, edificios y personajes → modelos 3D low/mid-poly renderizados a sprites isométricos** con Blender en modo headless (verificado: `bpy 5.3.0` instalable por pip en el contenedor). Cámara ortográfica fija, luz fija, paleta controlada. Es la técnica clásica de muchos juegos isométricos premium.
   - Fuentes de modelos: **solo CC0** (Kenney, Quaternius, Poly Haven para texturas/HDRI) + modelado/kitbash propio por script (madera, chapa, ladrillo, hormigón).
   - Se renderizan también **pases de normal map y oclusión** → la iluminación dinámica de Phaser 4 (`setLighting`) da día/noche, farolas y fuego reales sobre sprites 2D.
   - Niveles de edificio = variantes del mismo modelo (andamios, ampliaciones, chimeneas, luces) → la mejora **se ve**.
   - Personajes: rigs CC0 animados renderizados en 8 direcciones (idle, caminar, correr, trabajar, atacar, herido, morir), con variación de ropa/piel por capas y *gradient map*.
2. **Retratos → sistema procedural de capas vectoriales** dibujadas a mano en un único estilo (rostro, ojos, nariz, pelo, cicatrices, ropa, suciedad). Infinitas combinaciones, **heredables genéticamente** (los hijos se parecen a los padres) y coherentes.
3. **Interfaz → CSS + SVG propios** (iconografía propia, sin emojis).
4. **Efectos → partículas y filtros de Phaser 4** (niebla, polvo de carbón, ceniza, lluvia, bloom en la capital).
5. **Audio → CC0/CC-BY curado** con registro de licencias (`assets/LICENSES.md`).

**Alternativas.** (a) Packs isométricos 2D CC0 (Kenney): coherentes pero de estilo amable/caricaturesco, incompatible con la ambientación. (b) Ilustración a mano: mejor calidad, pero coste o tiempo inasumibles. (c) Imágenes generadas por IA: inconsistentes entre sí, difíciles de animar y con dudas de licencia; solo como referencia/moodboard, nunca como asset final sin revisión. (d) Gráficos 100 % procedurales con primitivas: coherentes, pero con el aspecto "web de minijuegos" que se quiere evitar.

**Riesgo.** El pipeline necesita un *spike* (Fase 1/2) para confirmar tiempos de render CPU y calidad. Si fallara, el plan B es (a) recoloreado y retocado por shader. Se dejará placeholder neutro mientras tanto, nunca marcado como definitivo.

**Aprobación (2026-11-23).** **Spike ejecutado el mismo día (F1-11) — veredicto: VIABLE.**
- `bpy 5.3.0` (Blender headless) en el contenedor, Cycles en CPU: casa 2×2 (color + normales, 640 px) ≈ 10 s; minero en 8 direcciones (192 px) ≈ 7 s en total.
- El normal map en espacio de cámara (convención OpenGL, +Y arriba) funciona tal cual con `setLighting(true)` de Phaser 4. Valores medidos frente a los teóricos: error ≤ 0,003. Evidencia: `docs/images/spike-light-left.png` y `spike-light-right.png`.
- Requisitos que el spike impone al pipeline definitivo (Fase 2):
  1. **Albedo sin luz direccional** (solo ambiente + oclusión), para no iluminar dos veces: la luz la pone Phaser.
  2. **Sombra en capa separada** (sprite de sombra), porque una sombra horneada no sigue a la luz dinámica.
  3. **Capa de emisión aditiva** (ventanas, lámparas), que no debe oscurecerse con la iluminación.
  4. **Margen en el lienzo** de personajes para que la sombra no se recorte.
- Pendiente: conseguir modelos CC0 reales (personajes con rig y animaciones) y comprobar su descarga desde este entorno.

**Revisión Fase 2 (2026-11-23), tras el feedback "el mapa es feísimo y poco detallado":**
- **Texturas fotográficas CC0** (ambientCG, 15 materiales) con gradación de color hacia la paleta → todo comparte look. Registro en `assets/LICENSES.md`; descarga reproducible con `tools/art/fetch_textures.py`.
- **Terreno del distrito pre-renderizado entero** en Blender (relieve real, mezcla de capas por ruido, río, vía con traviesas, puente, ~150 000 matas de hierba y piedras instanciadas) y cortado en trozos JPEG de 1024 px. Plantilla fija (`src/content/maps/d12.json`); la variedad entre partidas viene de casas, árboles y rocas colocados por semilla.
- **Edificios modelados por piezas** (tablón a tablón, chapa ondulada, ventanas con cruceta, chimeneas, barriles, leña) con 3 variantes de materiales para evitar repetición.
- **Iluminación en juego por tintado + halos aditivos** en lugar de luces por píxel de Phaser: 3× más FPS medidos en renderizado por software (4 → 13 FPS). Los normal maps se siguen generando para un futuro preset "Ultra".
- Se evaluaron plugins de generación con IA (SpriteCook, CellCog): el cliente los instaló pero **requieren autorización en claude.ai**; no se han usado. Si se usan, sus resultados pasan por la misma política de licencias y la biblia de arte.

---

### D-03 · Motor y stack — APROBADA (2026-11-23)

**Propuesta:** **Phaser 4.2.1** (no Phaser 3) + **TypeScript 6.0.3** + **React 19** (solo para interfaz) + **Vite 8** + **Vitest 5** + **IndexedDB vía `idb` 8** + **vite-plugin-pwa 2** + **GitHub Actions + GitHub Pages**.

Hallazgos verificados en el registro npm el 2026-11-23:

| Pieza | Hipótesis del prompt | Hallazgo | Decisión |
|---|---|---|---|
| Motor | Phaser 3 | Phaser 3 está en 3.90.0 (mayo 2025), sin versiones desde entonces. **Phaser 4 es estable desde abril de 2026** (4.2.1, julio 2026): renderizador WebGL nuevo, más rápido en móvil, filtros unificados, iluminación con normal maps en una línea, `SpriteGPULayer` (cientos de miles de sprites) y recuperación de pérdida de contexto WebGL. | **Phaser 4.** Empezar hoy en Phaser 3 es empezar con deuda. |
| Lenguaje | TypeScript | La última es **TS 7.0.2** (el compilador nativo nuevo), publicada **hoy**. `typescript-eslint` 8.74 solo admite `typescript <6.1`. | **TS 6.0.3** fijado. Migrar a TS 7 cuando el ecosistema de lint lo soporte. |
| UI | React | React 19.3.1 publicado **hoy**. | React 19, fijando una versión con ≥2 semanas de antigüedad. |
| Bundler | Vite | Vite 8.3.8 (Rolldown). Requiere Node ≥ 22.12 (el contenedor tiene 22.23). | Vite 8. |
| Alternativa estudiada | — | PixiJS 8.23: solo renderiza; habría que construir escenas, cámaras, tweens, input, carga y audio. Godot (export web): mejor editor, pero binario WASM pesado (arranque lento en iPhone), peor integración de UI HTML y de pruebas JS. | Descartadas. |

**Matiz importante:** `TilemapGPULayer` de Phaser 4 **no soporta isométrico** (lo dice su documentación). El terreno isométrico se hará con capas de suelo pre-horneadas por *chunks* (RenderTexture) y los objetos como sprites ordenados por profundidad. Ver `TECHNICAL_ARCHITECTURE.md §5`.

**Aprobación (2026-11-23).** Versiones instaladas en la Fase 1, todas fijadas y con ≥ 2 semanas de antigüedad (I-10):

| Paquete | Versión | Nota |
|---|---|---|
| phaser | 4.2.1 | |
| react / react-dom | 19.3.1 | |
| idb | 8.0.4 | |
| typescript | 6.0.3 | TS 7 descartado por typescript-eslint |
| vite | 8.3.6 | 8.3.8 tenía < 2 semanas |
| @vitejs/plugin-react | 6.2.1 | |
| vite-plugin-pwa | 2.0.0 | |
| vitest | 5.1.0 | |
| @playwright/test | 1.63.0 | igual que el Playwright preinstalado: usa su Chromium sin descargar otro |
| eslint / typescript-eslint | 10.14.0 / 8.72.1 | |
| eslint-plugin-react-hooks | 7.1.1 | |
| prettier | 3.9.10 | |
| fake-indexeddb | 6.2.8 | solo tests |

- **npm 10.9 falla** al resolver el árbol con vitest 5 (`Cannot read properties of null (reading 'edgesOut')`, bug de npm). Se resolvió instalando con **npm 11**. `npm ci` con npm 10 funciona sobre el lockfile (verificado).
- `npm audit`: 11 avisos *moderate* en `minimatch`/`glob` a través de eslint y typescript-eslint. **Solo afectan a herramientas de desarrollo** (no llegan al juego publicado). Riesgo aceptado; se revisa al actualizar eslint.

---

### D-04 · Ritmo temporal del ciclo — APROBADA (2026-11-23)

- Distrito en **tiempo continuo con pausa** (1 tick = 1 hora de juego; velocidades ×1/×2/×4).
- **Un año de juego = 4 estaciones × 10 días = 40 días ≈ 32 min reales a ×1** (8 min a ×4).
- **La Criba se celebra el primer día de otoño de cada año**; la primera partida empieza en primavera (≈16 min de distrito antes de la primera Criba, tiempo suficiente para conocer a la gente).
- Edad: +1 año por año de juego. Una generación (≈20 años) ≈ 10 h de juego a ×1; el modo ×4 y la simulación abstracta permiten verla en una partida larga.
- Capital (7 días) y arena se juegan **en su propio tiempo**; el distrito **sigue vivo en piloto automático** durante esos días y al volver se presenta un resumen.

**Alternativas.** Criba cada estación (demasiado frecuente: la población juvenil se agota y pierde peso emocional); cada 2 años (demasiado gestión entre competiciones).

**Aprobación (2026-11-23).** Implementado en `src/core/time/calendar.ts` y `src/game/session.ts`.

---

### D-05 · Control en la arena: turnos tácticos + órdenes de larga duración — APROBADA (2026-11-23)

Turnos por ronda (1 ronda = 1 hora de arena) con **2 Puntos de Acción** estilo táctico, **pero** el jugador puede dar órdenes que abarcan muchas rondas ("ve al río y busca comida hasta que anochezca", "escóndete y descansa"). La simulación avanza sola hasta que ocurre una **interrupción** (enemigo a la vista, regalo, evento del director, necesidad crítica, alianza propuesta).

**Motivo.** 24 participantes × varios días × 24 rondas = cientos de rondas; jugar todas a mano agota. Así la arena es táctica cuando importa y fluida cuando no.

**Aprobación (2026-11-23).**

---

### D-06 · Alcance del MVP ("rebanada vertical") — APROBADA (2026-11-23)

El MVP es **un ciclo completo jugable en el Distrito XII**: distrito vivo → Criba → 7 días en Áurea → arena forestal con 24 participantes → regreso con consecuencias → siguiente año. Detalle en `ROADMAP.md §MVP`. Fuera del MVP: otros distritos jugables, gestión multi-distrito, multijugador, arenas adicionales, Jubileos.

**Aprobación (2026-11-23).**

---

### D-07 · "Esqueleto andante" desde la Fase 1 — APROBADA (2026-11-23)

Ajuste a la metodología del prompt: en la Fase 1 se crea el flujo **completo** de pantallas del ciclo (Distrito → Criba → Capital → Arena → Regreso) con contenido mínimo, conectado al estado real. Cada fase posterior **rellena** una etapa en lugar de construir capas aisladas.

**Motivo.** La arena (Fase 7) es el sistema de mayor riesgo y, con fases horizontales, no se integraría hasta muy tarde. El esqueleto garantiza que la integración existe desde el día uno. Además se adelanta un **prototipo headless de la IA de arena** en paralelo a la Fase 4 (sin gráficos, solo simulación y estadísticas).

**Aprobación (2026-11-23).** Esqueleto implementado en la Fase 1: el ciclo completo se recorre con transiciones reales; los paneles de Criba, Áurea, Arena y Regreso están marcados como PROVISIONAL.

---

### D-08 · Orientación en móvil — APROBADA (2026-11-23)

Horizontal como orientación principal en teléfono para distrito y arena (mapas anchos); vertical **soportado** con interfaz en *bottom sheets*. Fichas, menús y escenas de la capital funcionan bien en ambas.

**Aprobación (2026-11-23).** La HUD de la Fase 1 ya se adapta a horizontal (una fila) y vertical (dos filas).

---

### D-09 · Reverse Engineering Skill — BLOQUEADA (falta la herramienta)

Auditoría del 2026-11-23: la skill **no está instalada** en esta sesión (no aparece en la lista de skills disponibles, ni en `~/.claude/skills`, ni en el repositorio). No se le atribuye ninguna capacidad ni se han inventado resultados. La investigación de referencias de esta fase se ha hecho con análisis de diseño propio (ver `GAME_SYSTEMS.md`, apartados "Lecciones de referencia").

**Requiere del cliente:** instalarla o indicar dónde está (nombre exacto o repositorio) si se quiere usar en próximas fases. Preguntas concretas preparadas para cuando esté disponible: ver `TASKS.md §Investigación`.

---

## Parte B — Decisiones internas (criterio profesional, registradas)

| ID | Decisión | Motivo |
|---|---|---|
| I-01 | Documentación en **español**; código, identificadores y commits en **inglés**. | El equipo lee español; el inglés en el código evita mezclar idiomas en APIs y facilita colaboración futura. |
| I-02 | Documentos de proyecto en `docs/`; `README.md` y `CLAUDE.md` en la raíz. | Raíz limpia. `CLAUDE.md` lo carga automáticamente cada sesión de Claude Code: reduce re-auditorías y tokens. |
| I-03 | El núcleo de simulación (`src/core`) es **TypeScript puro y determinista**: sin DOM, sin Phaser, sin React, sin `Math.random`, sin `Date.now`. RNG con semilla propio. | Pruebas sin interfaz, guardados reproducibles, simulación por lotes para equilibrado y base para servidor autoritativo futuro. |
| I-04 | Todo cambio de estado pasa por **Comandos** serializables. | Deshacer/replay, depuración, red futura (multijugador) y un único punto de validación. |
| I-05 | Contenido del juego (edificios, rasgos, eventos, reglas de Criba, armas…) **como datos tipados** en `src/content`, validados en tests. | Añadir contenido sin tocar sistemas. |
| I-06 | Sin gestor de estado externo (Zustand/Redux): React se suscribe al núcleo con `useSyncExternalStore`. | Una dependencia menos; la fuente de verdad es el núcleo, no la UI. |
| I-07 | Sin router de URLs; base de Vite relativa (`./`). | GitHub Pages sirve el juego bajo `/Hunger-Games/`; sin rutas no hay 404 ni rutas absolutas rotas. |
| I-08 | Guardado = **instantánea completa versionada** + cadena de migraciones + compresión nativa (`CompressionStream`) + **exportar/importar a fichero**. | Robustez y protección contra la purga de almacenamiento de Safari. |
| I-09 | Simulación en el hilo principal en el MVP, pero con interfaz de mensajes lista para moverla a un **Web Worker**. | Evitar complejidad prematura sin cerrar la puerta. |
| I-10 | Política de dependencias: versión exacta fijada, publicada hace ≥ 2 semanas, mantenida activamente y justificada en este documento. | Estabilidad y cadena de suministro. |
| I-11 | Cuadrícula lógica **cuadrada** con representación isométrica 2:1 (distrito y arena). | Lógica simple (vecinos, A*, línea de visión) independiente del dibujo; el isométrico es solo proyección. |
| I-12 | Identificadores de entidades: prefijo + contador en base 36 guardado en el estado (`h_1a`). *(Sustituye a la idea inicial de generarlos con el RNG.)* | Deterministas, estables entre guardados, aptos para red y no consumen aleatoriedad. |
| I-13 | Despliegue a GitHub Pages desde la **rama por defecto** del repositorio, no desde un nombre fijo. | Hoy la única rama (y la de por defecto) es la de desarrollo; cuando exista `main` y se marque por defecto, no hay que tocar el workflow. |
| I-14 | Imports con extensión `.ts` + `erasableSyntaxOnly`. | Node 22 ejecuta las herramientas TS (`npm run sim`, iconos) de forma nativa, sin añadir `tsx` ni compilar. |
| I-15 | Tipografías propias (OFL) aplazadas a la Fase 2; en la Fase 1 se usan las del sistema con tokens preparados. | Se eligen con maquetas reales (ART_BIBLE §7.1); evita añadir dependencias antes de tiempo. |
| I-16 | Herramientas de depuración solo con `?debug` en la URL; aceleran la simulación real, nunca inventan estado. | Necesarias para probar ciclos completos en E2E sin esperar 16 minutos reales. |
| I-17 | El motor (Phaser) se carga **bajo demanda** tras el menú. | Menú interactivo con 80 KB gzip; Phaser (359 KB gzip) llega después. |
| I-18 | Extensión de las copias de seguridad: `.diezmo` (gzip interno). | Safari descomprime automáticamente los `.gz` al descargarlos. |
| I-19 | **Luz del sol desde delante-izquierda** del espectador (viaja hacia +Y, −X). Sustituye a "arriba-izquierda". | Con luz desde atrás las dos fachadas visibles quedaban en sombra; así tejado > fachada izquierda > fachada derecha y los volúmenes se leen. |
| I-20 | Arte versionado en `public/assets/` (~17 MB) y excluido de la precarga de la PWA (caché bajo demanda). | El CI no necesita Blender; la instalación de la PWA sigue siendo ligera. Pendiente: pasar los sprites a WebP. |
| I-21 | Estado v2: `GameState.district` (estructuras y props). Migración real v1→v2 genera el distrito a partir de la semilla del guardado. | Las partidas de la Fase 1 siguen cargando. |
| I-22 | La partida empieza a las 08:00 del primer día. | Empezar de noche daba una mala primera impresión. |
| I-23 | Arena: **1 ronda = 1 hora**; el jugador da órdenes largas + una actitud de equipo y el juego se detiene solo en interrupciones (avistamiento, herida, orden cumplida, director). `arena/conclude` resuelve lo que falte sin el jugador. | Táctico sin microgestión, jugable en móvil (D-05). |
| I-24 | La IA de la arena (y la del equipo sin órdenes) es por **utilidad sobre creencias**: cada participante actúa con lo que cree saber, nunca con el estado real; los aliados comparten creencias. | Sorpresas, emboscadas y errores creíbles; la niebla de guerra del jugador sale del mismo modelo. |
| I-25 | Estado v7 (`arena`) y v8 (`regime`) con migraciones triviales; los resultados de cada edición se guardan en `competition.history[].result`. | Continuidad entre ciclos (Laureados, duelo) sin depender de `games`/`arena`, que se borran al volver. |
| I-26 | Régimen como **eventos-dato** (`src/content/districtEvents.ts`) con efectos declarativos; siempre hay al menos una opción gratuita; sin respuesta se resuelven solos a los 2 días (o al instante en piloto automático). | Añadir dilemas no requiere tocar el núcleo; nunca bloquean la partida. |
| I-27 | Terreno pre-renderizado parametrizado por mapa (`render_terrain.py --map`), con vegetación instanciada (hierba, pradera, flores con tallo, helechos, hojas caídas) y ambiente en tiempo real (sombras de nubes, mariposas, luciérnagas). | Respuesta a "el suelo no tiene vida" sin coste de GPU en el dispositivo. |
| I-28 | Tipografías **Inter** (UI) y **Oswald** (titulares), variables, vía `@fontsource-variable/inter@5.3.0` y `@fontsource-variable/oswald@5.3.0` (OFL, publicadas 2026-07-19). | Autoalojadas (funcionan sin red en la PWA) y con subconjuntos por `unicode-range`; Oswald estrecha encaja con la estética de propaganda. |
| I-29 | UI v2: paneles translúcidos con desenfoque y filo dorado, botones con relieve, menú de construcción con miniaturas WebP generadas de los sprites (`public/assets/ui/thumbs`), menú principal con el propio distrito de fondo, panel de arena plegable con pestañas. | Respuesta a "mejora la UI"; todo con tokens, sin dependencias nuevas aparte de las fuentes. |
| I-30 | Pantalla de inicio = **mapa de La Concordia** (pergamino pintado por código y renderizado en Blender sobre una mesa a la luz de velas) con sellos HTML posicionados a partir de la proyección de cámara (`src/content/maps/world.json`). Se pueden consultar los 12 distritos y Áurea; solo el XII es jugable por ahora. Fuente de mapa: Cinzel (`@fontsource-variable/cinzel@5.3.0`, OFL). | Petición del cliente; geografía original (no la de la franquicia, D-01). Los sellos son botones reales: accesibles y nítidos a cualquier resolución. |
| I-31 | Por decisión del cliente (proyecto fan made): los distritos se llaman solo por su número (**Distrito 1…12**) y la capital es **el Capitolio**. No se usan logos, símbolos ni imágenes oficiales de la franquicia: el emblema es propio (doce rayos que convergen en una gema). | Nombres comunes sí; arte y marcas registradas de terceros no se copian ni se redibujan. |
| I-32 | La ceremonia de selección se llama **la Cosecha** y el evento anual **los Juegos** (sin apellido). El título de la franquicia no se usa como nombre del juego ni del evento. | Petición del cliente con palabras comunes; el título registrado de terceros queda fuera (misma línea que I-31). |
| I-33 | Sprites en **WebP** (q90, alfa q92); normales fuera de `public/` (`assets/normals/`). | Peso de descarga ÷6 en móvil; iOS 14+ soporta WebP. |
| I-34 | Sonido **100 % procedural** (Web Audio): sin ficheros ni licencias, se desbloquea con el primer toque (iOS). | Ambiente vivo sin peso de descarga. |
| I-35 | Arena: mecenas que donan cada mañana según la popularidad y las bajas, y **emboscadas** (escondido + presa a tiro que no te ha visto). | Hacer que las decisiones del Capitolio y la prudencia cuenten: ganar ≈ 19 % jugando bien. |

| I-36 | HUD v3 propia: banda de hierro con filo dorado, medallón con el emblema y cinta del distrito, placa colgante con reloj de esfera, icono de estación y cuenta atrás, medallones redondos para velocidad y menús, casillas de recursos con disco de color y barra de capacidad, anillos de moral y vigilancia, barra de cuota. Solo CSS/SVG. | Petición del cliente de una HUD "de juego de estrategia" más bonita, sin copiar la de ningún juego concreto. |
| I-37 | **Distritos jugables 4, 11 y 12** mediante perfiles (`src/content/homeDistricts.ts`): plantilla de terreno, cuota (carbón o comida, con reserva de una semana de comida), edificio característico (mina, granja, lonja), calefacción (carbón o leña), hitos, casas, árboles y decorado. La plaza con el ayuntamiento y el escenario de la Cosecha es común. Sin cambio de esquema: `meta.homeDistrictId` ya existía. | Petición del cliente; reutiliza todo el ciclo (Cosecha, Capitolio, arena, regreso) sin duplicar lógica. |
| I-38 | Retratos v2 procedurales (originales, por genes): volumen, brillo en los ojos, seis peinados, pecas/cicatrices deterministas, ropa por oficio; ficha del ciudadano como expediente. | Petición del cliente: personajes más detallados sin assets externos. |
| I-39 | **Arquitectura regional original** (`<tipo>__<distrito>`): 11 = adobe encalado, teja de barro, soportales, ayuntamiento con arcada y torre de vigilancia, silos; 4 = casas sobre pilotes pintadas, hileras de colores, pizarra, ayuntamiento de estuco con torre-faro, varadero. Cada escena carga solo su región. Relieve y bioma por distrito (lomas doradas en el 11; costa en terrazas y acantilados de hasta 4,5 en el 4), con la plaza siempre llana. | Petición del cliente; ayuntamientos diseñados para el juego, no copiados de ninguna película. |
| I-40 | Seis estructuras nuevas: taberna y pozo (moral diaria), horno comunal, molino, ahumadero (junto al agua) y mercadillo (créditos). Miniaturas generadas con `tools/art/make_thumbs.py`. | Más opciones de construcción con efecto real en la economía. |
| I-41 | **Planos propios por distrito**: el 11 (pueblo al suroeste, cuadrícula de parcelas `c` con caminos rectos y canales con puentes, frutales en hileras) y el 4 (pueblo en ladera sobre el puerto, plaza junto al muelle, tres embarcaderos, playa, escolleras y acantilados). Nuevo código de terreno `c` (cultivo, construible) renderizado con surcos y trigo instanciado. Ayuntamiento y escenario se colocan relativos a la plaza de cada plantilla; la Cosecha, la cámara y el tren del regreso también. | Petición del cliente: el mismo plano bajo distintas casas no basta. |
| I-42 | **UI v4 "cristal"** (sustituye la estética ornamentada v3 por petición del cliente): capas translúcidas con desenfoque, bordes finos claros, radios grandes, botones píldora, controles segmentados tipo iOS, hojas inferiores con asa en móvil, Inter en todos los títulos (Cinzel solo en el mapa). Superficies de lectura con cristal más denso para mantener el contraste. | "Más moderno, que no parezca un juego de estrategia clásico". |
| I-43 | **Distritos jugables 7 (bosque) y 2 (montaña)** con plano, terreno y arquitectura propios (cabañas de troncos y ayuntamiento con campanario; casas de sillería y ayuntamiento-fortaleza). Cuotas en madera y piedra. | Seguir ampliando el mapa jugable con identidad real por distrito. |
| I-44 | **Leyes del distrito** (estado v9, `src/content/laws.ts`): hasta 3 en vigor; producción, consumo, comida, créditos, moral, vigilancia y malestar diarios. Interruptores tipo iOS con chips de ventaja/coste. | Decisiones permanentes con coste visible (GAME_SYSTEMS §6). |
| I-45 | Capitolio: línea de progreso de los 7 días y retratos con traje de tributo. | Orientarse en la semana de un vistazo. |
| I-46 | **Música generativa** por fase (menú, distrito, Capitolio, arena) con Web Audio: acordes lentos, melodía en paseo aleatorio por una escala propia de cada fase y pulso en las fases tensas. Interruptor en Ajustes. | Ambiente musical sin ficheros ni licencias; nunca se repite igual. |
| I-47 | **Objetivos del distrito**: tarjeta de cristal calculada en vivo desde el estado (cuota, comida para 7 días, moral, primera construcción, primera ley), plegable, oculta en pantallas pequeñas. | Guiar los primeros minutos sin tutorial pesado. |
| I-48 | **Segunda arena: la Tundra helada** (diseño propio, `arena_tundra.json`): lago helado transitable con agujeros de agua, cresta de roca con cuevas, pinos nevados, ruinas de un observatorio. Ediciones pares en la Tundra, impares en el Bosque. El frío drena más energía (sobre todo de noche) y la nieve calma la sed. Estado v10 (`arena.mapId`); el núcleo apunta al mapa activo antes de cada consulta. | Variedad entre ediciones con reglas que cambian de verdad. |
| I-49 | **Los 12 distritos jugables.** Los siete restantes (1, 3, 5, 6, 8, 9, 10) usan un generador de planos paramétrico (`build_generic` en `generate_district_templates.py`: colinas, río, lago, vetas, cultivo, huertos, cercados, bosques, playa de vías) y un generador de **arquitectura por estilos** (`STYLES` en `render_district_assets.py`: muros, tejado plano/a dos aguas/diente de sierra/paja, remate propio del ayuntamiento: cúpula dorada en el 1, antena en el 3, chimenea y reloj en el 5, marquesina de estación en el 6, torre del reloj en el 8, silo en el 9, cúpula-veleta de granero en el 10). Los hitos que caen en agua/roca/vía se recolocan en la celda libre más cercana (radio ≤ 12). | Cubrir el mapa entero con identidad sin escribir a mano siete constructores; diseños originales. |
| I-50 | **Dilemas regionales**: `EventCondition.districts` limita un evento a ciertos distritos (el derrumbe de mina solo en 12, 5 y 2). Diez nuevos, uno por oficio, con la primera opción siempre prudente (la que se elige sola). | Que cada distrito se juegue distinto, no solo se vea distinto. |
| I-51 | **Cinemáticas por planos** (`Shot` en `src/game/cinematic.ts`, `CineShot.tsx`): planos compuestos por la UI sobre el mapa vivo desenfocado (profundidad de campo con `backdrop-filter`), con retratos reales: guardias, caras nerviosas, la escolta del Capitolio (personaje original, Celestine Vauclair), la urna y la papeleta, primer plano del elegido, reacciones de la familia, paseo al estrado dentro del motor (`walk`), despedida en el ayuntamiento y el tren, cuya ventana deja ver el distrito real alejándose. Atajo oculto: tres toques en el reloj saltan a la Cosecha. | El cliente pide cinemáticas con planos cercanos; pre-renderizar vídeo por distrito sería inviable y no usaría a los ciudadanos reales. |
| I-52 | **Oficios por distrito** (`trades` en cada perfil): solo se construye la producción del oficio del distrito, además de vivienda y servicios comunes; el núcleo lo valida (`not-here`). Lo que falte se compra en el economato. | El cliente no quiere que todos los distritos construyan lo mismo. |
| I-53 | **Desgracias y deterioro** (`src/content/calamities.ts`): cada día la comida y la madera por encima del 60 % del almacén se estropean un poco, y hay una probabilidad (3 % + 9 % × lo lleno del almacén) de una desgracia que se lleva un porcentaje (ratas, robo, incendio, calor, helada, requisa, temporal y regionales). Solo mientras se gobierna el distrito. Aviso en forma de telegrama. | El cliente veía que los recursos solo subían. Pérdidas proporcionales: castigan más a quien acumula. |
| I-54 | **Leyes como decretos**: mesa de madera con pergaminos enrollados; se abre uno, se firma a mano (dedo o ratón, o con una rúbrica automática para teclado) y se sella y envía con animación; las leyes en vigor llevan lacre y se derogan. | Petición del cliente; además cada tipo de mensaje tiene ya su propio objeto (telegrama, decreto, cristal del HUD). |
| I-55 | **Suelo pintado en tiempo real** (`src/render/district/ground.ts`) en lugar del terreno pre-renderizado en Blender: capas de «brochazos» suaves (sellos radiales, sin filtros de canvas que el Safari antiguo ignora), paleta cartoon viva, caminos como cintas continuas, plaza de adoquines irregulares, agua con orilla y espuma, rocas con luz arriba. El mundo es plano (altura 0). Se repinta cuando se trazan caminos nuevos. Se borran ~62 MB de terreno renderizado. | El cliente veía el suelo fotográfico desentonar con las casas sencillas y pide un estilo tipo juego de móvil de estrategia; además los caminos dinámicos y el mapa más grande no caben en un terreno horneado. |
| I-56 | **Mapas de 64×64** (`tools/art/pad_templates.py`: 8 casillas por lado que continúan montañas, agua, bosque, vías y caminos; tierra, campos y plaza pasan a prado) y **pueblo inicial pequeño** (≈ la mitad de casas). Los perfiles siguen en coordenadas de diseño 48×48 y se desplazan con `MAP_PAD`. Estado v11: `district.roads` (caminos trazados en partida) y migración que desplaza lo construido. **Caminos automáticos** (`src/core/district/roads.ts`): al colocar un edificio, búsqueda en anchura desde su puerta hasta el camino más cercano, prefiriendo tramos rectos (máx. 40 casillas); no se puede construir encima. **Sin cuadrícula**: ni rombo al pasar el ratón ni contorno de casillas; el fantasma del edificio se desliza y bajo él hay un charco de luz. | Petición del cliente: más espacio, empezar con menos y más libertad. La rejilla lógica se mantiene (determinismo, guardados, pruebas) pero deja de verse. |
| I-57 | **Mejoras visibles en las casas**: variantes `_l2` y `_l3` renderizadas con un kit genérico que envuelve cualquier constructor regional (anexo lateral si cabe, jardineras con flores, antena; en el nivel 3 además jardín vallado con arbustos, farol y banderín). **Árbol de los ahorcados** (`hanging_tree`): roble seco retorcido con dos cuerdas, sin figuras, junto al ayuntamiento de cada distrito. | Petición del cliente. |
| I-58 | **Retratos v3**: cabeza con mandíbula y barbilla según genes, piel modelada con degradados suaves (luz arriba a la izquierda, borde frío), ojos almendrados con párpado, pestañas e iris degradado, cejas afiladas que suben con la preocupación, nariz con aletas y orificios, labios con arco de cupido, pelo por capas con mechones y brillo, orejas, cuello y ropa por oficio; arrugas y canas con la edad. | El cliente encontraba feas las caras en los primeros planos. |
| I-59 | **El tren del Capitolio** (sprites `train_head`/`train_car`/`train_tail`, `platform`, `coffin`; `src/render/district/train.ts`): andén junto a la estación de cada distrito; pasos de cinemática `train` (llegar, salir), `board` y `unload`. Salida: el tren entra, los tributos suben, arranca; regreso: bajan los supervivientes y sacan los ataúdes; plano cercano de cada ataúd con su retrato y de quien lo llora. | Petición del cliente: un tren de verdad y los ataúdes al final. |
| I-60 | **Desfile de carros** (`tools/art/render_parade.py`): avenida nocturna con gradas, farolas, haces de luz, fuegos artificiales y doce carros con caballos; tres planos renderizados (aéreo, lateral, contrapicado) animados en la UI con movimientos de cámara (grúa, barridos, acercamiento) y efectos (confeti, flashes, focos, fuegos). Los tributos reales van en el carro protagonista. Se reproduce al llegar al Capitolio. | Petición del cliente: planos épicos del desfile. |
| I-61 | **Niebla y vecinos**: velo de niebla más allá del área jugable; al empujar la cámara contra un borde se ofrece el distrito que hay en esa dirección del mapa del mundo (`neighbourOf`); cruzar pausa la partida y muestra ese distrito, solo para mirar. El mapa de pergamino dibuja las fronteras de cada distrito (regiones del sello más cercano), resalta la seleccionada y marca el oficio de cada uno con un glifo. | Petición del cliente. |
| I-62 | **Arenas pintadas en tiempo real** con el mismo pintor (paleta de bosque y paleta de nieve y hielo para la tundra); se borra su terreno pre-renderizado (~6 MB). | Coherencia visual con los distritos. |
| I-63 | **Assets 3D: buscar, no modelar.** Por instrucción del cliente, los modelos (personajes, animales, vehículos, objetos) se buscan ya hechos por artistas (Poly Pizza, Sketchfab, Kenney, OpenGameArt), low-poly de calidad, CC0 o CC BY con uso comercial; se descargan solo tras su elección y se registran en `assets/LICENSES.md`. Nada de geometría con primitivas ni generadores por IA. Blender solo se usará, con su permiso, para renderizar esos modelos a sprites isométricos. | El cliente rechaza los modelos hechos con primitivas. |
| I-64 | **Transiciones entre planos**: cada plano entra con su efecto (barrido con desenfoque, iris, zoom con desenfoque, fogonazo de flash o fundido), por defecto según el tipo de plano y sobrescribible en el guion. Sin `fill-mode` para que el desenfoque de profundidad reaparezca al acabar (como un cambio de foco). | Petición del cliente: planos con transiciones vistosas. |
