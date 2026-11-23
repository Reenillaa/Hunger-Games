# TASKS — Tareas pendientes

> Responsabilidad: **tareas accionables** de la fase activa y la siguiente, con prioridad y criterio de aceptación. El plan general está en `ROADMAP.md`.
> Prioridad: **P0** bloquea la fase · **P1** necesaria para cerrar la fase · **P2** deseable.

---

## Fase 0 — Cierre

| ID | Tarea | Prio | Criterio de aceptación | Estado |
|---|---|---|---|---|
| F0-1 | Aprobación del cliente de D-01…D-08 | P0 | Respuesta registrada en `DECISIONS.md` (estado → APROBADA o modificada) | Pendiente (cliente) |
| F0-2 | Disponibilidad de la Reverse Engineering Skill | P2 | Instalada y leída su documentación, o descartada | Pendiente (cliente) |

## Fase 1 — Fundación técnica + esqueleto andante

| ID | Tarea | Prio | Criterio de aceptación |
|---|---|---|---|
| F1-01 | Scaffold Vite 8 + TS 6.0.3 + React 19 + Phaser 4 con versiones exactas y justificadas | P0 | `npm run dev` abre el juego; `npm run build` sin errores ni avisos de tipos |
| F1-02 | ESLint + typescript-eslint + Prettier; regla de capas (`core` sin dependencias de UI/motor; sin `Math.random`/`Date.now` en `core`) | P0 | `npm run lint` pasa; una importación prohibida de prueba falla |
| F1-03 | Núcleo: `GameState`, comandos (`validate/apply`), scheduler tick/día/estación/año, RNG sfc32 con sub-flujos, bus de eventos | P0 | Tests: mismo seed + mismos comandos ⇒ mismo estado (hash) tras 1.000 ticks |
| F1-04 | `GameSession` (orquestación), máquina de fases Distrito→Criba→Capital→Arena→Regreso | P0 | Test de integración recorre un ciclo completo con comandos |
| F1-05 | Escenas Phaser vacías por fase + puente React (`useSyncExternalStore`) | P0 | Navegación visual por todas las fases desde la UI |
| F1-06 | Persistencia: IndexedDB (`idb`), 3 ranuras + autosave doble, `saveVersion` + migración de ejemplo, compresión, exportar/importar | P0 | Tests con fake-indexeddb; recargar la página conserva la partida |
| F1-07 | Vitest (unit) + Playwright (humo: carga, nueva partida, guardar, recargar) | P0 | `npm test` y `npm run e2e` verdes en local y CI |
| F1-08 | GitHub Actions: lint → typecheck → test → build → deploy a Pages (rama principal) | P0 | URL pública sirve el juego bajo `/Hunger-Games/` |
| F1-09 | PWA básica (manifest, iconos provisionales, SW) | P1 | Instalable en Chrome escritorio; "Añadir a pantalla de inicio" en iPhone abre en standalone |
| F1-10 | Entrada unificada (toque/ratón/teclado) y layout responsive base con safe areas | P1 | Navegable en emulación iPhone y en escritorio |
| F1-11 | Spike de arte: Blender headless (bpy) → edificio + personaje 8 direcciones con normal map → Phaser 4 con luz | P1 | Captura y veredicto en `DECISIONS.md` (D-02 confirmada o plan B) |
| F1-12 | Manejo global de errores con guardado de emergencia | P2 | Error forzado → mensaje + exportación ofrecida |
| F1-13 | Actualizar `PROJECT_STATUS.md`, `TESTING.md`, `README.md` | P0 | Reflejan exactamente lo verificado |

## Investigación (cuando exista la Reverse Engineering Skill)

Cada pregunta tiene un objetivo concreto; no se investigan juegos enteros.
1. ¿Cómo resuelven los juegos isométricos 2D el orden de profundidad de edificios multi-celda con unidades que pasan por detrás?
2. ¿Qué información muestra la previsualización de construcción en juegos de gestión premium y en qué orden?
3. ¿Cómo presentan los simuladores de colonias la ficha de un personaje en pantallas pequeñas?
4. ¿Cómo comunican los tácticos por turnos el alcance de movimiento de 1 y 2 acciones y el desglose de probabilidades?
5. ¿Cómo se representan visualmente relaciones y alianzas (grafos, iconos, colores) sin saturar?

## Backlog (post-MVP, decisiones abiertas)

- Multi-distrito: ¿el jugador gestiona las ofrendas de todos sus distritos cada año o solo del distrito principal?
- Derrota definitiva opcional (extinción / disolución del distrito).
- Audio: composición propia vs. biblioteca CC0/CC-BY.
- Idioma inglés.
