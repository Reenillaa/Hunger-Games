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
| 2026-11-24 | 10 | Renombrado (Distrito 1–12, el Capitolio) y emblema propio: `vitest` 106/106, `playwright` **14/14** | Sin errores; iconos PWA regenerados con `node tools/icons/make-icons.ts` |
| 2026-11-24 | 10 | Renombrado a la Cosecha / los Juegos: `vitest` 106/106, `playwright` **14/14** | Sin errores |
| 2026-11-24 | 10 | Carteles de propaganda propios en el distrito: `vitest` 106/106, `playwright` (ver commit) | Captura `docs/images/propaganda-posters.png`, sin errores de consola |
| 2026-11-24 | 10 | Tanda de pulido: `vitest` 106/106, `playwright` **16/16** (nuevo: mapa + ajustes + crónica, escritorio e iPhone) | Encontrado y corregido un fallo real: Escape no cerraba los diálogos (el listener se re-suscribía durante el propio evento) |
| 2026-11-24 | 10 | Equilibrio de la arena con política "jugador cuidadoso" (150 partidas headless, script ad hoc) | Victorias del Distrito 12: 5,8 % → 6,7 % (mecenas diarios) → 5,0 % (solo esconderse) → **19,3 %** (emboscadas + buenas decisiones en el Capitolio) |
| 2026-11-24 | 10 | WebP | Sprites y personajes 18,3 MB → 3,0 MB; `public/assets` total ≈ 14 MB |
| 2026-11-24 | 10 | HUD v3: `vitest` 106/106, `playwright` **16/16**; capturas escritorio/iPhone (`docs/images/hud-v3-*.jpg`) | Corregidos: banda superior detrás del lienzo (faltaba contexto de apilado) y quinta casilla de recursos cortada en iPhone vertical |
| 2026-11-24 | 10 | Paneles con el lenguaje de la HUD v3 (esquinas doradas, títulos en oro, filete ornamental): `vitest` 106/106, `playwright` 16/16 | `docs/images/hud-v3-panels.jpg` |
| 2026-11-24 | 10 | Distritos 4 y 11 + retratos v2: `vitest` **111/111** (nuevos: generación conectada de los 3 distritos, cuota de comida con reserva, lonja junto al agua), `playwright` **18/18** (nuevo: partida en el Distrito 4 desde el mapa) | Capturas `docs/images/district-d11.jpg`, `district-d4.jpg`, `citizen-dossier.jpg`; render de terreno d11 655 s, d4 ≈ 700 s |
| 2026-11-24 | 10 | Arquitectura regional, biomas con relieve y 6 estructuras nuevas: `vitest` **113/113** (nuevos: catálogo sprite/huella/miniatura, taberna sube la moral), `playwright` 18/18 | Capturas `docs/images/regional-districts.jpg`, `new-structures.jpg`; terrenos d11 688 s y d4 ≈ 700 s |
| 2026-11-24 | 10 | Planos propios d11/d4 + economato, escuela y enfermería regionales: `vitest` 113/113, `playwright` 18/18 | `docs/images/district-plans.jpg`; renders d11 671 s, d4 ≈ 700 s |
| 2026-11-25 | 10 | UI v4 cristal: `playwright` 18/18; capturas escritorio/móvil (`docs/images/ui-v4-glass.jpg`) | Corregido: cristal demasiado transparente en paneles grandes (texto ilegible sobre el mapa) |
| 2026-11-25 | 10 | Distritos 7 y 2, leyes y Capitolio: `vitest` **117/117** (nuevos: leyes, generación conectada del 7 y del 2), `playwright` **20/20** (nuevo: leyes) | `docs/images/districts-7-2-capitol.jpg`; terrenos d7 997 s, d2 ≈ 1000 s. Corregido: granito del 2 renderizado como estuco blanco (se usa la textura de sillería) |
| 2026-11-25 | 10 | Música generativa + objetivos: `vitest` 117/117, `playwright` 20/20 | Corregido: el objetivo «construye algo nuevo» salía cumplido al empezar (contaba los huertos iniciales) |
| 2026-11-25 | 10 | Arena Tundra: `vitest` **118/118** (nuevo: ediciones pares en la Tundra, frío y final de partida), `playwright` 20/20 | Render 608 s ×2; corregido: suelo del bosque verde en vez de nevado, juncos alrededor del lago helado (`docs/images/arena-tundra.jpg`) |
| 2026-11-25 | 10 | Dilemas regionales, vestuario por distrito, ficha del mapa con cuota/oficio, 7 perfiles nuevos (bloqueados hasta tener terreno): `vitest` **126/126** (nuevo: dilemas regionales), `playwright` 20/20 | Encontrado y corregido: la ficha del mapa, al crecer, tapaba el sello del Distrito 4 en 1280×720 (barras en dos columnas, línea de oficio en una sola fila) |
| 2026-11-25 | 10 | Terreno de los distritos 1, 3, 5, 6 y 9 (jugables 10/12): `vitest` 126/126, `playwright` **22/22** (nuevo: partida en el Distrito 9; el 5 ya jugable) | Render de terreno 1109–1208 s por distrito (24 muestras, 4 núcleos). Encontrado y corregido: en iPhone la cabecera y la ficha tapaban sellos (el 9 no se podía tocar); el mapa deja margen para desplazarlos |
| 2026-11-25 | 10 | Los 12 distritos jugables (terreno del 8 y el 10): lint, typecheck y prettier limpios, `vitest` 126/126, `playwright` **22/22** (el 10 jugable en el mapa) | Render de terreno: d8 1345 s, d10 1097 s. Partidas nuevas en el 8 y el 10 revisadas en 1280×720 sin errores de página |
| 2026-11-26 | 11 | Cosecha por planos, oficios por distrito, desgracias, leyes como decretos: lint, typecheck y prettier limpios, `vitest` **130/130** (nuevos: guion de la Cosecha, oficios, desgracias y deterioro, textos de desgracias), `playwright` **24/24** (nuevos: tres toques → Cosecha filmada; ley firmada a mano con ratón y con toque real en iPhone) | Encontrado y corregido: caras «calvas» en primer plano (casquete de pelo nuevo), la ventana de la despedida parecía un gorro, y un efecto secundario dentro de `setState` en la firma. Dos tests antiguos asumían que los recursos nunca se perdían (ajustados) |
| 2026-11-26 | 11 | Cambio visual: suelo cartoon en tiempo real, mapas 64×64, caminos automáticos, menos casas, árbol del ayuntamiento, casas de nivel 2 y 3: lint, typecheck y prettier limpios, `vitest` **131/131** (nuevo: caminos automáticos; tests de generación y población adaptados al mapa grande y al pueblo pequeño), `playwright` **24/24** | Render de 48 variantes de casa (~25 s cada una) y del árbol (13 s). Encontrado y corregido: costuras entre trozos del suelo, caminos como charcos sueltos, doble desplazamiento al migrar partidas v1 (el distrito ya se genera en el mapa grande), y el test de leyes en iPhone firmaba mientras el pergamino aún se desenrollaba (intermitente). El test de la tundra ahora compara el gasto por ronda |
| 2026-11-27 | 11 | Retratos v3, tren 3D con andén y ataúdes, niebla y visitas a vecinos, fronteras en el mapa, arenas cartoon: lint, typecheck y prettier limpios, `vitest` **133/133** (nuevos: pasos del tren, vecinos tras la niebla), `playwright` **24/24** | Encontrado y corregido: ataúdes tapados por el andén, barra de recursos visible durante cinemáticas, `ground.ts` truncado por un script propio (restaurado desde git). El desfile queda desactivado (`PARADE_READY`) hasta montarlo con modelos reales con licencia |
| 2026-11-27 | 11 | Transiciones entre planos + assets descargados (Kenney Mini Characters CC0, caballo de Shyr CC0): `vitest` 133/133, `playwright` **24/24** | Encontrado y corregido: con las transiciones el fondo dejaba de desenfocarse (la animación con relleno y el `mix-blend-mode` del barrido aislaban el fondo). Poly Pizza bloquea el acceso automatizado (Cloudflare); kenney.nl rechaza clientes que no son navegador (descarga hecha con el navegador sin interfaz, por su botón oficial) |
| 2026-11-27 | 11 | 7 packs de Kenney (CC0, verificados en su página y su `License.txt`), 54 modelos a sprites, vida por distrito, niebla volumétrica: `vitest` **133/133**, `playwright` **24/24** | Encontrado y corregido: colores lavados (hojas cian) de los modelos con color plano → remapeo a la paleta; heno rosa descartado; pinos y rocas antiguos retirados por no casar |
| 2026-11-27 | 11 | Edificios por distrito con City Kits de Kenney (108 sprites), personajes Kenney, luz de cámara, recursos detallados, panel de obras, 9 objetivos nuevos, centro de entrenamiento, patrocinadores y entrevista filmada: lint, typecheck y prettier limpios, `vitest` **133/133**, `playwright` **24/24** (el ciclo completo ahora pasa por una estación del centro y por el plano de plató) | Encontrados y corregidos: el desenfoque de miniatura (tilt-shift) bajaba el render por software a 1,3 fps → ahora se apaga solo si el equipo no aguanta ~30 fps (medido: vuelve a 9,7 fps en software); los rivales del centro tapaban los clics a las estaciones; nombres de tributo encima del rótulo de la estación; hueco estirado en el palco de patrocinadores; la presentadora tenía nombre de hombre; test de población intermitente (contaba la lista a mitad de refresco y suponía más de 5 jóvenes, falso con el pueblo pequeño) |
| 2026-11-27 | 11 | Distrito 12 de referencia (relieve, luz del valle, texturas, paleta, casas de pizarra, sombras de contacto, túnel), UI v5 de materiales, arena con niebla de nubes y etiquetas con fundido: lint, typecheck y prettier limpios, `vitest` **137/137** (nuevo: relieve del 12), `playwright` **24/24** | Medido: con el sol de los renders las sombras proyectadas sobre el valle son casi nulas (1 de 38 678 muestras), así que el relieve se lee por la orientación de las laderas y la oclusión. Encontrados y corregidos: meseta «tipo Minecraft» por colores con umbrales (ahora mezclas continuas y 4×4 facetas), rocas naranjas (barro del kit → piedra gris), objetos rosas al desaturar en espacio lineal (ahora se oscurecen manteniendo el tono), túnel tapado por rocas, cojines naranjas que eran las tumbas del cementerio, el aviso en rojo del carbón se perdía con el estilo de cuero |
