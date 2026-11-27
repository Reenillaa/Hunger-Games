# PROJECT_STATUS — Estado real del proyecto

> Responsabilidad: **qué existe y funciona hoy**, sin adornos. Se actualiza al final de cada sesión de trabajo.

**Última actualización:** 2026-11-27 · **Fases hechas:** 0–9 (jugables de punta a punta) · **Siguiente:** 11 (contenido visual) · **Rama:** `claude/dreamy-turing-n5zefc`

## Resumen

| Área | Estado |
|---|---|
| Fase 0 · Diseño | ✅ Aprobada (D-01…D-08). |
| Fase 1 · Fundación | ✅ Núcleo determinista, comandos, fases, guardado IndexedDB versionado, CI. Pages pendiente del cliente. |
| Fase 2 · Distrito visual | ✅ Suelo pintado en tiempo real con estilo cartoon (hierba viva, caminos de arena, plaza adoquinada, agua con orilla, rocas), a juego con los edificios; sin cuadrícula visible. Mapas de 64×64 (antes 48×48) y un pueblo pequeño al empezar (10–11 casas). Los caminos se trazan solos al construir. Árbol de los ahorcados junto a cada ayuntamiento. El 12 es la referencia visual, un diorama low-poly de un solo estilo (suelo y acantilados en facetas de color plano, sin desenfoque, edificios de trabajo hechos con piezas de Kenney): relieve real (acantilados con bandas de roca, meseta con pinares, túnel de la vía), lomas suaves en el valle, tierra, caminos y plaza con textura, casas de pizarra y sombras de contacto; el resto de distritos aún con el suelo plano. Casas (3 niveles), ayuntamiento, almacén y economato con modelos completos de los City Kits de Kenney (CC0), distintos en cada distrito (108 sprites); los de producción siguen siendo los antiguos. Habitantes, guardias y tributos con los Mini Characters de Kenney (8 direcciones, paso animado). Luz de cámara: gradación por hora, desenfoque de miniatura y viñeta (se apagan solos si el equipo no aguanta ~30 fps). Día/noche, niebla volumétrica, humo, cuervos y luciérnagas. |
| Fase 3 · Construcción y economía | ✅ Recursos, almacenes, obras, trabajadores, cuota, comercio en el economato. Panel de obras con pestañas (oficio, vivienda, servicios, mejoras), obras en curso con progreso y recursos con detalle (tendencia, producción y consumo). Cada distrito construye solo su oficio (más vivienda y servicios). Deterioro diario por encima del 60 % del almacén y desgracias que se llevan un porcentaje (aviso-telegrama). |
| Fase 4 · Población | ✅ Ciudadanos reales con familias, rasgos, habilidades, ánimo, parejas, nacimientos y muertes (LOD). |
| Fase 5 · La Cosecha | ✅ Motor de reglas (datos), papeletas, Jubileo. Ceremonia filmada por planos: guardias, caras nerviosas, la escolta del Capitolio, la urna, primer plano del elegido, reacciones de la familia, paseo al estrado, despedida en el ayuntamiento y el tren alejándose del distrito real. Atajo oculto: tres toques en el reloj. Salida y regreso en el tren del Capitolio, con ataúdes en el andén. |
| Fase 6 · Capitolio | ✅ 7 días de decisiones (postura, vestuario, entrenamiento, evaluación, entrevista, plan) y 22 rivales generados. Centro de entrenamiento interactivo (los tributos caminan a 6 estaciones con modelos reales; los rivales entrenan a la vista), palco de 6 patrocinadores y entrevista filmada en plató con la presentadora. El desfile está desactivado (`PARADE_READY`) hasta montarlo con los modelos reales. |
| Fase 7 · Arena | ✅ Dos arenas (Bosque y Tundra helada, alternas por edición). Bosque 40×40 (río con vados, lago, colinas con cuevas, ruinas, Relicario). Rondas de 1 h, IA por utilidad con creencias, alianzas y traiciones, combate con probabilidades transparentes, supervivencia, director (fuego, perímetro, festín), cápsulas de Mecenas, órdenes e interrupciones, niebla de guerra. |
| Fase 8 · Continuidad | ✅ Resultados por edición, caídos enterrados como ciudadanos reales (duelo familiar), Laureado con recompensa y trauma, ceremonia de regreso. |
| Fase 9 · Régimen | ✅ 10 dilemas comunes + 10 regionales (temporal en el 4, incendio en el 7, plaga en el 11 y el 9, apagón en el 5…), atención y malestar, toque de queda (−15 % producción), represalias públicas, guarnición. |
| Inicio | ✅ Mapa de La Concordia en pergamino: los 12 distritos y el Capitolio consultables; **los 12 distritos son jugables**, cada uno con plano, perfil, arquitectura regional y dilemas propios. Fronteras de los distritos y glifo de cada oficio en el mapa; niebla en los bordes del distrito para visitar a los vecinos. |
| Interfaz | ✅ UI v2: fuentes Inter/Oswald, paneles con estilo propio, menú con el distrito de fondo, construcción con miniaturas, arena plegable con pestañas. |
| Leyes | ✅ 7 leyes del distrito con efectos diarios (máx. 3), presentadas como decretos: se abren, se firman a mano y se envían. |
| Interfaz | ✅ UI v5: materiales del distrito en la HUD (hierro, latón, madera, cuero, papel, botón grueso); cristal en diálogos y fichas. |
| Pulido (Fase 10) | 🟡 Hecho: WebP, ajustes (texto, movimiento, volumen, calidad), sonido procedural, crónica, prólogo, equilibrio de la arena. Pendiente: prueba en iPhone real. |
| Móvil / PWA | 🟡 Layout adaptado (emulación). **Sin probar en iPhone real.** |
| Pruebas | Ver `TESTING.md` (registro real de ejecuciones). |
| Estado de partida | ✅ v11 con cadena de migraciones v1→v11. |

## Métricas medidas

- 100 arenas sin jugador: mediana ≈ 133 rondas (5,5 días); ganan 12 distritos distintos; causas de muerte: combate ≈ 72 %, desangrado ≈ 22 %, perímetro, sed, fuego. El Distrito XII (pobre) queda de media en el puesto ≈ 11/24 sin órdenes.
- Render del terreno del distrito (Cycles CPU, 4 núcleos, 24 muestras): ≈ 14 min.

## Bloqueos

1. Ninguno. La web está publicada en https://reenillaa.github.io/Hunger-Games/ (cada push a la rama la redespliega).

## Próximo paso

Que el cliente revise el 12; luego F11-22 (llevar el relieve a los demás distritos), F11-19 (edificios de producción con modelos reales), F11-20 (miniaturas nuevas), F11-13 (créditos) y el desfile con los modelos reales (F11-06), según `TASKS.md`.
