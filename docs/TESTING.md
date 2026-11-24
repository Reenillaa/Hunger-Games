# TESTING — Estrategia y registro de pruebas

> Responsabilidad: **cómo se prueba el juego y qué se ha verificado de verdad**. Nunca se registra como pasada una prueba que no se ha ejecutado.

## 1. Pirámide de pruebas

| Nivel | Herramienta | Qué cubre | Cuándo |
|---|---|---|---|
| Unitarias | Vitest (Node) | Fórmulas, comandos, sistemas del `core`, reglas de Criba, IA (decisiones puntuales), migraciones de guardado | Cada commit (CI) |
| Propiedades / invariantes | Vitest + generadores con semilla | "Nadie es su propio padre", "recursos ≥ 0", "un muerto no trabaja", "la suma de pesos de la Criba = elegibles", "un participante eliminado no actúa" | Cada commit |
| Determinismo | Vitest | Mismo seed + mismos comandos ⇒ mismo hash de estado | Cada commit |
| Integración | Vitest | `GameSession` recorre ciclos completos; guardar → cargar → continuar produce el mismo estado | Cada commit |
| Simulación por lotes (equilibrado) | `npm run sim` (Node, headless) | N años de distrito / N arenas con informes estadísticos | Al cambiar números de diseño; informe adjunto al PR |
| E2E de humo | Playwright + Chromium (`--trace off`) | Arranque, nueva partida, velocidades, guardar, recargar, exportar/importar, ciclo completo; escritorio e iPhone emulado | Cada push (CI) |
| Rendimiento | Benchmarks + overlay de FPS (Fase 2) | Presupuestos de `TECHNICAL_ARCHITECTURE.md §12` | Por fase |
| Manual en dispositivo | Checklist §3 | iPhone real (Safari y PWA instalada), Android, escritorio | Fin de cada fase visual |

Los tests del `core` **no abren navegador ni Phaser**: la simulación se prueba sin interfaz.

## 2. Comandos

```bash
npm test                                   # unit + integración (Vitest)
npm run build && npm run e2e               # E2E contra el build de producción
npm run sim -- --years 50 --seed 123       # simulación headless
npm run typecheck
npm run lint
npm run format:check
npm run verify                             # lint + typecheck + test + build
```

En este contenedor, `@playwright/test` 1.63.0 coincide con el Playwright preinstalado y usa su Chromium. En CI se instala con `npx playwright install --with-deps chromium`.

## 3. Checklist manual en dispositivo (por fase visual)

- [ ] Carga en < 4 s en 4G simulada.
- [ ] Pan con un dedo, pellizco para zoom, toque selecciona, mantener pulsado inspecciona.
- [ ] Ningún elemento queda bajo el notch o la barra de inicio.
- [ ] Rotar el dispositivo no rompe el layout.
- [ ] Cerrar Safari y volver: la partida sigue.
- [ ] PWA instalada: arranca standalone; guardado persiste; exportar funciona.
- [ ] Audio suena tras el primer toque.
- [ ] ≥ 30 fps en la escena más cargada.

## 4. Registro de ejecuciones

| Fecha | Fase | Qué se ejecutó | Resultado |
|---|---|---|---|
| 2026-11-23 | 0 | — (fase de documentación, no hay código) | No aplica |
| 2026-11-23 | 1 | `npm test` (Vitest 5.1.0, Node 22.23) | **48/48 pasan** en 6 ficheros: rng (7), calendario (5), núcleo/ciclo (12), sesión + autoguardado (8), persistencia (12), proyección (4) |
| 2026-11-23 | 1 | `npm run e2e` contra `vite preview` | **10/10 pasan** (5 tests × escritorio e iPhone 13 emulado en Chromium): arranque sin errores de consola, velocidades, guardado manual + recarga, ciclo completo Distrito→Criba→Áurea (7 días)→Arena→Regreso (Otoño día 8), exportar + importar `.diezmo` |
| 2026-11-23 | 1 | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` | Sin errores ni avisos |
| 2026-11-23 | 1 | Regla de capas: fichero de prueba con imports prohibidos en `core` y `ui` | 7/7 violaciones detectadas (phaser, game, `Math.random`, `Date.now`, `new Date`, `window` en core; render en ui). Fichero eliminado después |
| 2026-11-23 | 1 | `npm run sim -- --years 50 --seed 123` ×2 | 50 Cribas, mismo hash (`19b4dc951ac0e5`) en ambas ejecuciones |
| 2026-11-23 | 1 | `npm ci` con npm 10.9.9 en un directorio limpio | Correcto (el fallo de npm 10 solo ocurre al *resolver* dependencias nuevas) |
| 2026-11-23 | 1 | Capturas manuales (escritorio 1280×760, iPhone 13 horizontal y vertical) | HUD en una fila en horizontal y dos en vertical tras corregirla; sin solapes con el contenido |
| 2026-11-23 | 1 | Spike de arte: valores del normal map frente a los teóricos | Error ≤ 0,003 tras corregir el signo de Z |
| 2026-11-23 | 1 | CI en GitHub Actions, ejecución nº 1 (`08a24b0`) | Job `verify` **correcto** (E2E en 24 s). Job `deploy` **falla**: 404, Pages no activado en el repositorio |
| — | 1 | iPhone real / PWA instalada | **No ejecutado** (pendiente del cliente) |
| 2026-11-23 | 2 | `npm test` | **59/59** (nuevos: distrito ×7, día/noche ×3, migración v1→v2) |
| 2026-11-23 | 2 | `npm run e2e` | **10/10** con el distrito real cargando sus assets, sin errores de consola |
| 2026-11-23 | 2 | FPS en Chromium + SwiftShader (sin GPU), 1280×720 | Luces por píxel: 4 FPS · tintado + halos: 13 FPS. No representa una GPU real |
| 2026-11-23 | 2 | CI GitHub Actions (`1a28414`) | `verify` **correcto**. Antes fallaron dos ejecuciones por bugs reales encontrados por los E2E: el reloj del juego dependía del delta suavizado de Phaser (se paraba con pocos FPS; corregido) y dos tests dependían del reloj en marcha (corregidos). `deploy` falla: Pages sin activar (C-1) |
| 2026-11-23 | 2 | Revisión visual: capturas de día, noche, valle completo e iPhone horizontal | Corregidos: tejado invertido, pivote de rotación, objetos bajo tierra visibles, ventanas encendidas de día, costuras entre trozos, esquinas negras visibles |
| 2026-11-24 | 7–9 | `npx vitest run` | **106/106** en 17 ficheros (nuevos: arena ×6 incl. 100 arenas headless, regreso ×2, régimen ×3) |
| 2026-11-24 | 7 | 100 arenas sin jugador (test estadístico) | Mediana ≈ 133 rondas; 12 distritos ganadores distintos, ninguno > 15 %; muertes: combate 1695, desangrado 523, perímetro 105, sed 18, fuego 5, hambre 2 |
| 2026-11-24 | 7 | Captura manual de la arena (Chromium + SwiftShader) | Encontrados y corregidos: miembros del equipo propio atacándose entre sí (ahora son una alianza que solo se rompe al quedar solos) y rejilla visible en la niebla de guerra |
| 2026-11-24 | 9 | `npm run sim -- --years 10 --seed 123 --policy basic` | 10 años sin hambruna; población 111→105 (caídos de los juegos), moral 40–45, atención < 10 |
| 2026-11-24 | 7–9 | `npm run lint`, `typecheck`, `format:check`, `build` | Sin errores |
| 2026-11-24 | 7–9 | `npx playwright test --trace off` | **14/14** (escritorio + iPhone 13 emulado): incluye el ciclo completo con arena real, resultados y ceremonia de regreso, sin errores de consola |
| 2026-11-24 | 7 | Capturas de la Criba frente al ayuntamiento nuevo y de la arena | `docs/images/phase7-criba-townhall.jpg`, `phase7-arena.jpg`: niebla sin rejilla tras la corrección |
| 2026-11-24 | 10 | Despliegue en GitHub Pages (job `deploy` relanzado tras activar Pages) | Correcto; `https://reenillaa.github.io/Hunger-Games/` responde 200 con los assets de la arena |
| 2026-11-24 | 10 | UI v2: `vitest` 106/106, `playwright` **14/14**, lint/typecheck sin errores | Capturas antes/después en escritorio y móvil horizontal: `docs/images/ui-v2-*.jpg` |
| 2026-11-24 | 10 | Mapa de inicio: `vitest` 106/106, `playwright` **14/14**, lint/typecheck sin errores | Capturas en escritorio, iPhone horizontal y vertical sin errores de consola; los 13 sellos coinciden con los puntos dibujados (`docs/images/worldmap-*.jpg`). Corregidos: ficha que tapaba Vergel y cabecera que rozaba Bastión en horizontal |

