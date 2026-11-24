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
| F10-01 | Sprites y terreno a WebP (con PNG/JPEG de respaldo) | P1 | Peso de arte −40 % sin pérdida visible |
| F10-02 | Pantalla de ajustes: calidad (Bajo/Medio/Alto), movimiento reducido, tamaño de texto | P1 | Se guarda por dispositivo; `?quality=` sigue funcionando |
| F10-03 | Accesibilidad: foco visible, `aria` en paneles, contraste AA en HUD | P1 | Revisión con lector de pantalla y teclado |
| F10-04 | Equilibrado: ganar con el Distrito XII debe ser posible con buenas órdenes (objetivo 10–20 % jugando bien) | P1 | Simulación headless con política "jugador prudente" |
| F10-05 | Arena: árboles y ruinas en el terreno de la arena con oclusión transparente verificada en iPhone | P2 | Captura en iPhone real |
| F10-06 | Crónica de ediciones (Laureados, caídos) consultable desde el distrito | P2 | Panel con el historial real |
| F10-08 | Hacer jugables otros distritos (plantilla, economía y perfil propios) desde el mapa de inicio | P2 | Seleccionar otro distrito en el mapa inicia una partida en él |
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
