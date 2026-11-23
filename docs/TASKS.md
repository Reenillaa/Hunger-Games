# TASKS — Tareas pendientes

> Responsabilidad: **tareas accionables** de la fase activa y la siguiente, con prioridad y criterio de aceptación. El plan general está en `ROADMAP.md`.
> Prioridad: **P0** bloquea la fase · **P1** necesaria para cerrar la fase · **P2** deseable.

---

## Acciones del cliente

| ID | Tarea | Estado |
|---|---|---|
| C-1 | Activar GitHub Pages: *Settings → Pages → Build and deployment → Source: GitHub Actions*; después relanzar el workflow | Pendiente |
| C-2 | Comprobar que Actions está activado | ✅ Funciona (ejecución nº 1, 2026-11-23) |
| C-3 | Probar en un iPhone real: abrir la URL, jugar, "Añadir a pantalla de inicio", cerrar y volver | Pendiente (tras C-1) |
| C-4 | Reverse Engineering Skill: instalarla o descartarla (D-09) | Pendiente |

## Fase 1 — Fundación técnica + esqueleto andante

| ID | Tarea | Estado | Evidencia |
|---|---|---|---|
| F1-01 | Scaffold con versiones exactas | ✅ | `package.json`, D-03 |
| F1-02 | Lint con reglas de capas | ✅ | Prueba con imports prohibidos: 7/7 errores detectados (TESTING) |
| F1-03 | Núcleo determinista | ✅ | `src/core/core.test.ts` (hash idéntico con la misma semilla) |
| F1-04 | Sesión y máquina de fases | ✅ | `src/game/session.test.ts`, test de ciclo completo |
| F1-05 | Escenas Phaser + puente React | ✅ | E2E "walking skeleton" |
| F1-06 | Persistencia completa | ✅ | `src/persistence/persistence.test.ts`, E2E de recarga y de exportar/importar |
| F1-07 | Vitest + Playwright | ✅ | 48 + 10 tests en verde |
| F1-08 | GitHub Actions + Pages | 🟡 | Job `verify` en verde en GitHub; `deploy` espera a que se active Pages (C-1) |
| F1-09 | PWA básica | 🟡 | Manifest + SW generados; instalación no verificada en dispositivo (C-3) |
| F1-10 | Entrada unificada y layout responsive | ✅ | Capturas en escritorio, iPhone horizontal y vertical (emulado) |
| F1-11 | Spike de arte | ✅ | Veredicto en D-02; `docs/images/spike-light-*.png` |
| F1-12 | Errores globales con guardado de emergencia | ✅ | `ErrorBoundary` + manejador global + exportar |
| F1-13 | Documentación actualizada | ✅ | Este commit |

## Fase 2 — Prototipo visual del distrito (siguiente)

| ID | Tarea | Prio | Criterio de aceptación |
|---|---|---|---|
| F2-01 | Pipeline de arte definitivo: albedo sin luz direccional + capa de sombra + capa de emisión + márgenes (requisitos del spike) + empaquetado en atlas 1×/2× | P0 | Script reproducible; un edificio y un personaje animado con las 4 capas se ven bien de día y de noche |
| F2-02 | Fuentes de modelos CC0 (personajes con rig y animaciones; props) y registro en `assets/LICENSES.md` | P0 | Descarga verificada desde el entorno; licencias registradas |
| F2-03 | Modelo de datos del mapa del distrito (terreno, elevación, rasgos, zonas) + plantilla 48×48 + variación por semilla, en `src/core` | P0 | Tests: mapa determinista por semilla, zonas válidas |
| F2-04 | Render del terreno por chunks 16×16 horneados, transiciones y elevación | P0 | ≥ 30 fps en iPhone emulado con el mapa completo |
| F2-05 | Edificios iniciales estáticos (8) con niveles visuales 1–3 | P1 | Revisión contra `ART_BIBLE.md §12` |
| F2-06 | Iluminación día/noche con normal maps, farolas y lámparas; *grading* por hora | P1 | Capturas a 4 horas distintas |
| F2-07 | Partículas: humo, polvo de carbón, ceniza | P1 | Desactivables en calidad baja |
| F2-08 | Habitantes de demostración caminando por caminos (solo visual) | P1 | 40 agentes en móvil sin bajar de 30 fps |
| F2-09 | Tipografías OFL, iconos y tokens definitivos; maquetas de HUD | P1 | Aprobación visual del cliente |
| F2-10 | Presets de calidad Bajo/Medio/Alto con detección inicial | P2 | Cambio en caliente sin recargar |

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
- Revisar los avisos de `npm audit` (solo herramientas de desarrollo) al actualizar eslint.
