# TASKS — Tareas pendientes

> Responsabilidad: **tareas accionables** de la fase activa y la siguiente, con prioridad y criterio de aceptación. El plan general está en `ROADMAP.md`.
> Prioridad: **P0** bloquea la fase · **P1** necesaria para cerrar la fase · **P2** deseable.

---

## Acciones del cliente

| ID | Tarea | Estado |
|---|---|---|
| C-1 | Activar GitHub Pages | ✅ Hecho (2026-11-24) |
| C-2 | Comprobar que Actions está activado | ✅ Funciona (ejecución nº 1, 2026-11-23) |
| C-3 | Probar en un iPhone real: abrir la URL, jugar, "Añadir a pantalla de inicio", cerrar y volver | Pendiente (tras C-1) |
| C-4 | Reverse Engineering Skill: instalarla o descartarla (D-09) | Pendiente |

## Fases 1–9

Hechas. El detalle de lo que existe está en `PROJECT_STATUS.md`; las ejecuciones de prueba, en `TESTING.md`.

## Fase 10 — Pulido (siguiente)

| ID | Tarea | Prio | Criterio de aceptación |
|---|---|---|---|
| F10-01 | Sprites y personajes a WebP | ✅ | 18,3 MB → 3,0 MB; normales fuera de `public/` (`tools/art/to_webp.py`) |
| F10-02 | Ajustes: calidad, tamaño de texto, movimiento reducido, volumen | ✅ | `SettingsDialog`, `src/platform/settings.ts`; E2E nuevo |
| F10-03 | Accesibilidad: foco visible, `aria` en paneles, contraste AA en HUD | P1 | Revisión con lector de pantalla y teclado |
| F10-04 | Equilibrado de la arena | ✅ | Jugando bien el Distrito 12 gana ≈ 19 % (150 partidas headless); sin órdenes ≈ 1–5 % |
| F10-05 | Arena: árboles y ruinas en el terreno de la arena con oclusión transparente verificada en iPhone | P2 | Captura en iPhone real |
| F10-06 | Crónica de ediciones | ✅ | `ChroniclePanel` desde la barra superior; E2E nuevo |
| F10-08 | Distritos jugables desde el mapa | 🟡 | 5 jugables; los 7 restantes, a la espera del render de terreno. Los 12, con plano, terreno, arquitectura y dilemas propios; tests por distrito + E2E |
| F10-09 | Sonido procedural (viento, mina, pájaros, grillos, multitud, campana de la Cosecha, cañonazo por cada caído) | ✅ | `src/platform/audio.ts` + `AudioDirector` |
| F10-10 | Prólogo cinemático de nueva partida | ✅ | `buildPrologue`; el reloj espera a que termine |
| F10-11 | Retratos v2 y expediente del ciudadano | ✅ | `Portrait.tsx`, `CitizenCard.tsx` |
| F10-12 | Dilemas regionales por distrito | ✅ | `EventCondition.districts`; test: el 4 nunca ve el derrumbe de mina y sí temporales |
| F10-07 | Prueba en iPhone real + PWA instalada (C-3) | P0 | Checklist de `TESTING.md` §3 |

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
