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
| F10-08 | Distritos jugables desde el mapa | ✅ | Los 12, con plano, terreno, arquitectura y dilemas propios; tests por distrito + E2E |
| F10-09 | Sonido procedural (viento, mina, pájaros, grillos, multitud, campana de la Cosecha, cañonazo por cada caído) | ✅ | `src/platform/audio.ts` + `AudioDirector` |
| F10-10 | Prólogo cinemático de nueva partida | ✅ | `buildPrologue`; el reloj espera a que termine |
| F10-11 | Retratos v2 y expediente del ciudadano | ✅ | `Portrait.tsx`, `CitizenCard.tsx` |
| F10-12 | Dilemas regionales por distrito | ✅ | `EventCondition.districts`; test: el 4 nunca ve el derrumbe de mina y sí temporales |
| F10-07 | Prueba en iPhone real + PWA instalada (C-3) | P0 | Checklist de `TESTING.md` §3 |
| F11-01 | Cosecha como película por planos + atajo oculto | ✅ | Test del guion (`ceremonies.test.ts`) + E2E de los tres toques |
| F11-02 | Oficios por distrito en el menú y en el núcleo | ✅ | Test: el 4 no puede poner minas, el 12 no puede poner pesquerías |
| F11-03 | Desgracias, deterioro y aviso-telegrama | ✅ | Test: almacén lleno se estropea y atrae desgracias regionales correctas |
| F11-04 | Leyes como decretos firmados | ✅ | E2E con firma a mano (ratón y toque real) |
| F11-05 | Cambio visual a estilo cartoon (suelo en tiempo real, sin rejilla visible, caminos automáticos, mapa más grande, menos casas al empezar, mejoras visibles en las casas, árbol del ayuntamiento) | ✅ | Test de caminos automáticos; tests de generación adaptados a 64×64 |
| F11-08 | Colocación libre de verdad (sin casillas en la lógica) y edificios con estilo cartoon renderizados de nuevo | P2 | Hoy la rejilla sigue en la lógica, aunque ya no se ve |
| F11-06 | Cinemáticas del resto de fases: desfile (guion y efectos hechos, desactivado hasta tener modelos reales de caballos, carros y público), tren de ida y vuelta con ataúdes ✅; entrevista ✅; pendiente: entrada en la arena | 🟡 | Test de los pasos de tren; E2E salta el desfile |
| F11-09 | Retratos v3 | ✅ | Muestra visual revisada |
| F11-10 | Niebla en los bordes, visitas a distritos vecinos y fronteras en el mapa del mundo | ✅ | Test de vecinos; prueba manual en navegador |
| F11-11 | Arenas con el suelo cartoon | ✅ | Captura del bosque |
| F11-15 | Edificios de los 12 distritos con modelos completos de Kenney (casas de 3 niveles, ayuntamiento, almacén, economato) | ✅ | Render revisado; edificios de producción aún los antiguos |
| F11-16 | Centro de entrenamiento interactivo, patrocinadores y entrevista escenificada | ✅ | E2E: estación elegida en la nave; entrevista filmada y saltable |
| F11-17 | Gente del pueblo, guardias y tributos con los Mini Characters de Kenney | ✅ | Hojas de 8 direcciones con animación real |
| F11-18 | Luz de cámara (se apaga sola en equipos lentos), panel de obras, recursos detallados y cadena de tareas | ✅ | Medido: 1,3 → 9,7 fps en render por software al apagarse el desenfoque |
| F11-19 | Edificios de producción (mina, aserradero, cantera, granja, pesquería…) con modelos reales | P0 | — |
| F11-20 | Regenerar las miniaturas del menú de obras (`assets/ui/thumbs`) desde los sprites nuevos | P1 | Hoy salen los renders antiguos, oscuros |
| F11-21 | Distrito 12 de referencia: relieve (acantilados, meseta con pinares, túnel), luz del valle, texturas de suelo, paleta propia, casas de pizarra, sombras de contacto | ✅ | Test del relieve (suelo del pueblo plano, montaña alta, determinista, luz por orientación); capturas revisadas |
| F11-22 | Llevar el relieve y la paleta del 12 a los otros once distritos | P1 | Pendiente de que el cliente apruebe el 12 |
| F11-23 | UI v5 con materiales (hierro, latón, madera, cuero, papel, botón grueso) | ✅ | E2E 24/24 sin cambios en los tests |
| F11-24 | Arena: niebla de nubes, etiquetas de nombre con fundido, paso continuo y pausas solo cuando hay que decidir | ✅ | E2E del ciclo completo |
| F11-13 | Pantalla de créditos en el juego (obligatoria por la licencia CC BY del carro de EqualizerX) | P0 | — |
| F11-14 | Estilo visual único: renderizar todos los modelos externos con los mismos materiales cartoon, paleta y luz | P0 | — |
| F11-12 | Sustituir modelos hechos a código (caballos, carros, personajes, tren) por assets reales CC0/CC BY | P0 | Candidatos presentados al cliente; esperando su elección |
| F11-07 | Variedad de UI por pantalla (cada panel con su objeto propio) | P1 | Hecho para leyes y desgracias |

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
