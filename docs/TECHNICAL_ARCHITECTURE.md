# TECHNICAL_ARCHITECTURE — Arquitectura técnica

> Responsabilidad: **cómo está construido el juego**: stack, capas, flujo de datos, rendimiento, guardado, despliegue.
> Los motivos de cada elección y sus alternativas están en `DECISIONS.md` (D-03, I-01…I-12).

---

## 1. Stack (verificado en npm el 2026-11-23)

> Versiones exactas instaladas y motivos: `DECISIONS.md` D-03.

| Pieza | Versión | Papel |
|---|---|---|
| Node.js | ≥ 22.12 (contenedor: 22.23) | Desarrollo, tests, simulador headless |
| TypeScript | **6.0.3** (fijado; TS 7 incompatible con typescript-eslint) | Todo el código |
| Phaser | **4.2.1** (renderer `AUTO`; Canvas está obsoleto en v4) | Render WebGL, escenas, cámaras, tweens, input, carga, audio, partículas, iluminación |
| React + React DOM | **19.3.1** | Interfaz (HUD, paneles, fichas, menús) superpuesta al canvas |
| Vite | **8.3.6** | Dev server y build |
| Vitest | **5.1.0** | Tests unitarios/integración (entorno Node) |
| idb | **8.0.4** | Envoltorio fino y tipado de IndexedDB |
| vite-plugin-pwa | **2.0.0** | Service worker (Workbox) y manifiesto |
| @playwright/test | **1.63.0** (misma versión que el Chromium preinstalado del contenedor) | Tests E2E de humo |
| fake-indexeddb | 6.2.8 (solo tests) | IndexedDB en Node |
| ESLint + typescript-eslint, Prettier | últimas compatibles | Calidad de código |

Nota: Phaser 4.2 incluye en el paquete una carpeta `skills/` con guías para agentes de IA (tilemaps, render…). Se consultarán en la Fase 1 como documentación oficial.

## 2. Principio rector: el núcleo no sabe que existe una pantalla

```
┌──────────────────────────────────────────────────────────────────────┐
│  src/ui  (React)            src/render  (Phaser 4)                   │
│  HUD, paneles, fichas,      Escenas: Boot, Menu, District, Selection,│
│  menús, diálogos            Capital, Arena, Cinematic                │
│        │  ▲                        │  ▲                               │
│ commands│  │snapshots/events  commands│  │snapshots/events           │
│        ▼  │                        ▼  │                               │
│  ┌──────────────────────── src/game (orquestación) ────────────────┐ │
│  │ GameSession: bucle de tiempo, cola de comandos, bus de eventos, │ │
│  │ autosave, piloto automático, cambio de fase                     │ │
│  └───────────────────────────────┬─────────────────────────────────┘ │
│                                  ▼                                   │
│  ┌──────────────────────── src/core (TS puro, determinista) ───────┐ │
│  │ state · commands · systems (time, economy, construction,        │ │
│  │ population, social, selection, prep, arena, ai, regime, events) │ │
│  │ rng · ids · rules · queries                                      │ │
│  └───────────────────────────────┬─────────────────────────────────┘ │
│                                  ▼                                   │
│  src/content (datos tipados)     src/persistence (IndexedDB, saves) │
└──────────────────────────────────────────────────────────────────────┘
```

Reglas de dependencia (se comprueban con una regla de lint de imports):
- `core` no importa nada de `game`, `render`, `ui`, `persistence`, ni `phaser`/`react`/DOM.
- `content` solo importa tipos de `core`.
- `render` y `ui` **nunca mutan** el estado: envían comandos y leen instantáneas/consultas.
- `render` y `ui` no se importan entre sí; se comunican por `game` (bus de eventos + selección actual).

## 3. Estructura de carpetas (implantada en la Fase 1)

```
/
├─ index.html
├─ public/                    # iconos PWA, manifest base
├─ assets/                    # fuentes de arte (Blender, SVG de retratos), LICENSES.md
├─ tools/                     # art/ (Blender bpy + visor), sim/ (simulador headless), icons/
├─ src/
│  ├─ core/
│  │  ├─ state/               # tipos del estado (GameState, DistrictState, Citizen…)
│  │  ├─ commands/            # definición, validación y aplicación de comandos
│  │  ├─ systems/             # time, economy, construction, population, social,
│  │  │                       # selection, preparation, arena/, regime, events
│  │  ├─ ai/                  # utilidad, creencias, mapas de influencia, A*
│  │  ├─ rng/                 # PRNG con semilla, sub-flujos por sistema
│  │  └─ index.ts
│  ├─ content/                # buildings, resources, traits, laws, events, selection rules,
│  │  └─ locales/es/          #   weapons, arenas, districts, names… + textos
│  ├─ game/                   # GameSession (tiempo real→ticks, velocidades), event bus, autosave, contrato del renderer
│  ├─ render/                 # Phaser: scenes/, iso/, camera/, entities/, fx/, cinematic/
│  ├─ ui/                     # React: hud/, panels/, sheets/, dialogs/, theme/, hooks/
│  ├─ persistence/            # db.ts, saveSlots, migrations/, export/import
│  ├─ platform/               # input unificado, detección de calidad, safe areas, audio unlock
│  └─ main.tsx               # raíz de composición: único módulo que une ui, render y persistence
├─ tests/                     # e2e (Playwright); los unit tests van junto al código (*.test.ts)
└─ docs/
```

## 4. Modelo de estado y comandos

- `GameState` es un **árbol de datos serializable** (objetos planos, `Record<Id, T>`, sin clases con métodos, sin referencias circulares: relaciones por id).
- **Comando** = `{ type, payload, issuedAt }`. Cada comando tiene `validate(state)` y `apply(state, ctx)`. Ejemplos: `PlaceBuilding`, `UpgradeBuilding`, `AssignWorker`, `EnactLaw`, `ResolveEventOption`, `SetGameSpeed`, `ChooseTrainingSession`, `ArenaMove`, `ArenaAttack`, `ArenaLongOrder`.
- **Sistemas** = funciones `step(state, ctx)` llamadas por el scheduler por tick/día/estación.
- **Eventos de dominio** (`BuildingCompleted`, `CitizenBorn`, `ParticipantEliminated`…) salen del núcleo hacia el bus: la UI, el render, el audio y las cinemáticas reaccionan a ellos.
- **Determinismo**: `ctx.rng` es un PRNG con semilla (sfc32) con **sub-flujos por sistema** (cambiar la IA no altera la economía). Prohibido `Math.random` y `Date.now` en `core` (regla de lint).
- Mutación: en el MVP se muta el estado in situ dentro de `apply/step` por rendimiento; la UI recibe **instantáneas por selector** con número de versión para re-render barato (`useSyncExternalStore`).

## 5. Render isométrico (Phaser 4)

- **Proyección**: celda (x, y, z) → pantalla `((x − y)·W/2, (x + y)·H/2 − z·E)` con tile 2:1 (`W=128, H=64` unidades de mundo).
- **Suelo**: no se puede usar `TilemapGPULayer` (solo ortogonal). Se hornea el terreno por **chunks de 16×16 celdas** en `RenderTexture` al cargar y al cambiar; solo se re-hornea el chunk afectado. Transiciones de terreno con tiles de borde.
- **Objetos** (edificios, árboles, rocas, habitantes, participantes): sprites con profundidad = `(x + y) · K + z + offset de huella`. Edificios multi-celda se ordenan por su esquina frontal.
- **Iluminación**: sprites con normal map (pases del pipeline 3D, D-02) + luces de Phaser 4 (sol/luna direccional simulado, farolas, fuego, lámparas de minero). Ciclo día/noche con *color grading* por filtro de cámara.
- **Masas**: multitudes de la Criba y partículas de ambiente con `SpriteGPULayer`.
- **Cámara**: pan con límites, zoom 0,5×–2× con suavizado, enfoque en entidad, sacudidas. Selección por raycast inverso de la proyección + prueba de píxel para sprites altos.
- **Calidad adaptativa**: presets Bajo/Medio/Alto (resolución interna, luces simultáneas, partículas, sombras, número de agentes visibles). Detección inicial por GPU/memoria/FPS medidos los primeros segundos; ajustable en opciones.
- **Carga**: atlas de texturas por escena (Distrito, Capital, Arena-bosque…). Nunca se cargan todas las arenas. Liberación de texturas al salir de una escena.

## 6. Interfaz (React)

- Un único árbol React sobre el canvas, con `pointer-events` solo en paneles.
- Sistema de diseño propio con **tokens CSS** (color, tipografía, espaciado, radios, sombras) definidos en `ART_BIBLE.md`. CSS Modules. Sin frameworks de UI genéricos.
- Componentes base: Panel, BottomSheet (móvil), Tooltip/Popover (escritorio), Tabs, ResourceBar, Portrait, PersonCard, FamilyTree, Gauge, Timeline, ActionBar, ConfirmBar, Toast/News ticker, DialogEvent.
- Accesibilidad: foco visible, navegación por teclado, escala de texto, modo de alto contraste, "reducir movimiento", subtítulos, información nunca solo por color.
- Localización: todas las cadenas por clave (`t('building.mine.name')`) desde `src/content/locales`. Español primero; estructura lista para inglés.

## 7. Sistema de cinemáticas

- Secuencias definidas como **datos/DSL tipado** con pistas sincronizadas: cámara (pan, zoom, foco, sacudida, encuadre), actores (mover, animar, mirar), luz, texto (subtítulos, rótulos), audio (música, efectos, voz sintética no), filtros (viñeta, desenfoque, *fade*), esperas y **ramas según datos** (`if family.size > 3 → plano de hermanos`).
- Construidas **con el motor** y con **datos reales** (los elegidos, su familia, la moral del distrito).
- **Saltables siempre**; registro de "ya vista" en el perfil → la segunda vez se ofrece versión corta. Ninguna cinemática para acciones rutinarias.
- Reutilizable en todas las escenas de la lista del encargo (`GDD.md`, `ROADMAP.md`).

## 8. Persistencia

- **IndexedDB** (`idb`) con stores: `profile` (opciones, cinemáticas vistas, estadísticas), `slots` (metadatos: id, nombre, fecha, año, distrito, miniatura), `saves` (instantánea completa comprimida), `history` (archivo histórico grande, separado para no reescribirlo en cada autosave).
- **Instantánea completa** del estado (todos los habitantes, familias, relaciones, edificios, recursos, eventos pendientes, estado de competición, régimen, RNG) — suficiente para reconstruir la simulación exacta.
- `saveVersion` entero + **cadena de migraciones** (`v1→v2→…`) probada con guardados de ejemplo congelados en tests.
- Compresión con `CompressionStream('gzip')` nativo (sin dependencias).
- **Autosave** al cambiar de día y de fase + **guardado manual** + **3 ranuras** + 1 ranura de autosave rotativa (2 copias para tolerar corrupción).
- **Exportar/importar** a fichero `.json.gz` (copia de seguridad, migrar entre navegador y PWA en iPhone, compartir partidas para depuración).
- `navigator.storage.persist()` al crear la primera partida; si se deniega, aviso discreto y recordatorio de exportar.

## 9. PWA y despliegue

- `vite-plugin-pwa` con precarga del *shell* y **caché bajo demanda** de atlas por escena (no precachear todas las arenas).
- Manifiesto con iconos propios, `display: standalone`, orientación preferente horizontal (D-08), `theme_color` de la paleta.
- **GitHub Actions** (`.github/workflows/ci.yml`): `lint → format → typecheck → test → sim → build → e2e` en cada push y PR; despliegue a Pages solo desde la **rama por defecto** (I-13). Requiere *Settings → Pages → Source: GitHub Actions*.
- `vite.config` con `base: './'` y sin router (I-07) → funciona bajo `https://reenillaa.github.io/Hunger-Games/`.
- Phaser se carga con `import()` dinámico tras el menú (I-17).
- Gestión de errores: *error boundary* de React, manejador global de errores que ofrece **guardar copia de emergencia** y exportar el informe; recuperación de pérdida de contexto WebGL (nativa de Phaser 4).

## 10. Móvil

- **Entrada unificada** (`src/platform/input`): toque = seleccionar; mantener pulsado = inspeccionar/menú contextual; arrastrar = mover cámara; pellizco = zoom; doble toque = centrar. Escritorio: rueda = zoom, WASD/flechas = cámara, clic derecho = cancelar, atajos (espacio = pausa, 1/2/3 = velocidad, B = construir).
- Layouts por *breakpoints*: teléfono horizontal, teléfono vertical, tablet, escritorio. En teléfono: HUD mínima, paneles como *bottom sheets* de altura media, nunca a pantalla completa salvo fichas.
- `env(safe-area-inset-*)` para notch y barra de inicio del iPhone; `100dvh`; bloqueo de zoom del navegador en el canvas (no en la UI de texto, por accesibilidad).
- Audio: desbloqueo en el primer gesto (requisito de iOS).
- Rendimiento objetivo: 60 fps escritorio, ≥ 30 fps estables en un iPhone de 4–5 años; presupuesto de memoria de texturas ≤ 256 MB en móvil.

## 11. Preparación para multijugador futuro (sin implementarlo)

Lo que ya deja la puerta abierta, sin coste extra:
- Núcleo determinista y sin dependencias de navegador → puede ejecutarse en un **servidor Node autoritativo** tal cual.
- Comandos serializables → el cliente enviaría comandos; el servidor valida (`validate`) y difunde resultados.
- IDs estables y estado serializable → sincronización por instantánea + deltas.
- Separación "mi distrito / otros distritos" ya existe (§13.4 de `GAME_SYSTEMS.md`): otros distritos podrían ser de otros jugadores.
Lo que **no** se hace ahora: servidor, cuentas, red, anti-trampas.

## 12. Presupuestos de rendimiento

| Medida | Objetivo |
|---|---|
| Arranque en frío (móvil 4G) hasta menú | < 4 s; JS inicial < 600 KB gzip (Phaser incluido) |
| Tick de distrito (1.000 habitantes) | < 2 ms media en móvil medio |
| Ronda de arena con 24 IA | < 30 ms total; nunca bloquea un frame (se reparte entre frames si hace falta) |
| Memoria de texturas móvil | ≤ 256 MB |
| Guardado completo | < 200 ms y < 2 MB comprimido para 1.000 habitantes |

## 13. Riesgos técnicos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Purga de almacenamiento en Safari/iOS; almacén separado entre Safari y la PWA instalada | Pérdida de partidas | `persist()`, exportar/importar, aviso al usuario, pruebas en dispositivo real |
| Bugs de IndexedDB en PWA instalada de iOS 26 (transacciones que no completan, reportado en mayo 2026) | Guardados colgados | Timeouts y reintentos, doble copia de autosave, pruebas en dispositivo |
| Phaser 4 es reciente: menos ejemplos comunitarios que Phaser 3 | Más tiempo de investigación | Spikes acotados en Fase 1; guías oficiales incluidas en el paquete |
| Isométrico sin `TilemapGPULayer` | Rendimiento del suelo | Horneado por chunks + cull |
| Pipeline de render 3D → sprites (tiempo de CPU, calidad) | Retraso del arte | Spike en Fase 1/2; plan B documentado en D-02 |
| Memoria WebGL en iPhone | Cierres de pestaña | Atlas por escena, presets de calidad, liberación de texturas |
| Complejidad de la simulación social | Bugs difíciles de reproducir | Determinismo + semillas + simulador headless + tests de invariantes |
