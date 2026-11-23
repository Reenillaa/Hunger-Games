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

### D-01 · Identidad original del universo (riesgo de propiedad intelectual) — PROPUESTA · CRÍTICA

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

**Requiere del cliente:** aprobar el enfoque y, si quiere, elegir otros nombres. Los nombres concretos se pueden cambiar en cualquier momento sin tocar código.

---

### D-02 · Estrategia de assets: sprites pre-renderizados desde 3D — PROPUESTA · CRÍTICA

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

**Requiere del cliente:** aprobar el pipeline (afecta al aspecto final de todo el juego).

---

### D-03 · Motor y stack — PROPUESTA

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

**Requiere del cliente:** aprobación (cambia la hipótesis inicial de Phaser 3).

---

### D-04 · Ritmo temporal del ciclo — PROPUESTA

- Distrito en **tiempo continuo con pausa** (1 tick = 1 hora de juego; velocidades ×1/×2/×4).
- **Un año de juego = 4 estaciones × 10 días = 40 días ≈ 32 min reales a ×1** (8 min a ×4).
- **La Criba se celebra el primer día de otoño de cada año**; la primera partida empieza en primavera (≈16 min de distrito antes de la primera Criba, tiempo suficiente para conocer a la gente).
- Edad: +1 año por año de juego. Una generación (≈20 años) ≈ 10 h de juego a ×1; el modo ×4 y la simulación abstracta permiten verla en una partida larga.
- Capital (7 días) y arena se juegan **en su propio tiempo**; el distrito **sigue vivo en piloto automático** durante esos días y al volver se presenta un resumen.

**Alternativas.** Criba cada estación (demasiado frecuente: la población juvenil se agota y pierde peso emocional); cada 2 años (demasiado gestión entre competiciones).

**Requiere del cliente:** aprobar el ritmo (afecta a toda la experiencia).

---

### D-05 · Control en la arena: turnos tácticos + órdenes de larga duración — PROPUESTA

Turnos por ronda (1 ronda = 1 hora de arena) con **2 Puntos de Acción** estilo táctico, **pero** el jugador puede dar órdenes que abarcan muchas rondas ("ve al río y busca comida hasta que anochezca", "escóndete y descansa"). La simulación avanza sola hasta que ocurre una **interrupción** (enemigo a la vista, regalo, evento del director, necesidad crítica, alianza propuesta).

**Motivo.** 24 participantes × varios días × 24 rondas = cientos de rondas; jugar todas a mano agota. Así la arena es táctica cuando importa y fluida cuando no.

**Requiere del cliente:** aprobación (define cómo se juega la mitad del juego).

---

### D-06 · Alcance del MVP ("rebanada vertical") — PROPUESTA

El MVP es **un ciclo completo jugable en el Distrito XII**: distrito vivo → Criba → 7 días en Áurea → arena forestal con 24 participantes → regreso con consecuencias → siguiente año. Detalle en `ROADMAP.md §MVP`. Fuera del MVP: otros distritos jugables, gestión multi-distrito, multijugador, arenas adicionales, Jubileos.

**Requiere del cliente:** confirmar el alcance.

---

### D-07 · "Esqueleto andante" desde la Fase 1 — PROPUESTA

Ajuste a la metodología del prompt: en la Fase 1 se crea el flujo **completo** de pantallas del ciclo (Distrito → Criba → Capital → Arena → Regreso) con contenido mínimo, conectado al estado real. Cada fase posterior **rellena** una etapa en lugar de construir capas aisladas.

**Motivo.** La arena (Fase 7) es el sistema de mayor riesgo y, con fases horizontales, no se integraría hasta muy tarde. El esqueleto garantiza que la integración existe desde el día uno. Además se adelanta un **prototipo headless de la IA de arena** en paralelo a la Fase 4 (sin gráficos, solo simulación y estadísticas).

**Requiere del cliente:** aprobación (cambia ligeramente el orden de trabajo, no el alcance).

---

### D-08 · Orientación en móvil — PROPUESTA

Horizontal como orientación principal en teléfono para distrito y arena (mapas anchos); vertical **soportado** con interfaz en *bottom sheets*. Fichas, menús y escenas de la capital funcionan bien en ambas.

**Requiere del cliente:** confirmar (si prefiere vertical como principal, cambia el diseño de la HUD).

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
| I-12 | Identificadores de entidades: cadenas cortas generadas por el RNG con semilla (`c_8f3a…`). | Estables entre guardados y aptas para red. |
