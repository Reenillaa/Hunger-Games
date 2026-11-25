# PROJECT_STATUS — Estado real del proyecto

> Responsabilidad: **qué existe y funciona hoy**, sin adornos. Se actualiza al final de cada sesión de trabajo.

**Última actualización:** 2026-11-25 · **Fases hechas:** 0–9 (jugables de punta a punta) · **Siguiente:** 10 (pulido) · **Rama:** `claude/dreamy-turing-n5zefc`

## Resumen

| Área | Estado |
|---|---|
| Fase 0 · Diseño | ✅ Aprobada (D-01…D-08). |
| Fase 1 · Fundación | ✅ Núcleo determinista, comandos, fases, guardado IndexedDB versionado, CI. Pages pendiente del cliente. |
| Fase 2 · Distrito visual | ✅ Terreno pre-renderizado con vegetación densa (v3: hierba viva, praderas, flores, helechos, hojas), edificios, habitantes animados, día/noche, humo, cuervos, sombras de nubes, mariposas y luciérnagas. |
| Fase 3 · Construcción y economía | ✅ Recursos, almacenes, obras, trabajadores, cuota de carbón, comercio con Áurea. |
| Fase 4 · Población | ✅ Ciudadanos reales con familias, rasgos, habilidades, ánimo, parejas, nacimientos y muertes (LOD). |
| Fase 5 · La Criba | ✅ Motor de reglas (datos), papeletas, Jubileo, ceremonia cinemática con reacciones de la familia. |
| Fase 6 · Áurea | ✅ 7 días de decisiones (postura, vestuario, entrenamiento, evaluación, entrevista, plan) y 22 rivales generados. |
| Fase 7 · Arena | ✅ Dos arenas (Bosque y Tundra helada, alternas por edición). Bosque 40×40 (río con vados, lago, colinas con cuevas, ruinas, Relicario). Rondas de 1 h, IA por utilidad con creencias, alianzas y traiciones, combate con probabilidades transparentes, supervivencia, director (fuego, perímetro, festín), cápsulas de Mecenas, órdenes e interrupciones, niebla de guerra. |
| Fase 8 · Continuidad | ✅ Resultados por edición, caídos enterrados como ciudadanos reales (duelo familiar), Laureado con recompensa y trauma, ceremonia de regreso. |
| Fase 9 · Régimen | ✅ 10 dilemas comunes + 10 regionales (temporal en el 4, incendio en el 7, plaga en el 11 y el 9, apagón en el 5…), atención y malestar, toque de queda (−15 % producción), represalias públicas, guarnición. |
| Inicio | ✅ Mapa de La Concordia en pergamino: los 12 distritos y el Capitolio consultables; **los 12 distritos son jugables**, cada uno con plano, terreno renderizado, perfil, arquitectura regional y dilemas propios. |
| Interfaz | ✅ UI v2: fuentes Inter/Oswald, paneles con estilo propio, menú con el distrito de fondo, construcción con miniaturas, arena plegable con pestañas. |
| Leyes | ✅ 7 leyes del distrito con efectos diarios (máx. 3). |
| Interfaz | ✅ UI v4 cristal (glassmorphism). |
| Pulido (Fase 10) | 🟡 Hecho: WebP, ajustes (texto, movimiento, volumen, calidad), sonido procedural, crónica, prólogo, equilibrio de la arena. Pendiente: prueba en iPhone real. |
| Móvil / PWA | 🟡 Layout adaptado (emulación). **Sin probar en iPhone real.** |
| Pruebas | Ver `TESTING.md` (registro real de ejecuciones). |
| Estado de partida | ✅ v10 con cadena de migraciones v1→v10. |

## Métricas medidas

- 100 arenas sin jugador: mediana ≈ 133 rondas (5,5 días); ganan 12 distritos distintos; causas de muerte: combate ≈ 72 %, desangrado ≈ 22 %, perímetro, sed, fuego. El Distrito XII (pobre) queda de media en el puesto ≈ 11/24 sin órdenes.
- Render del terreno del distrito (Cycles CPU, 4 núcleos, 24 muestras): ≈ 14 min.

## Bloqueos

1. Ninguno. La web está publicada en https://reenillaa.github.io/Hunger-Games/ (cada push a la rama la redespliega).

## Próximo paso

Fase 10 según `TASKS.md`: WebP, ajustes de calidad y accesibilidad, prueba en iPhone real, equilibrado fino.
