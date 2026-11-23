# PROJECT_STATUS — Estado real del proyecto

> Responsabilidad: **qué existe y funciona hoy**, sin adornos. Se actualiza al final de cada sesión de trabajo.

**Última actualización:** 2026-11-23 · **Fase activa:** 2 (Prototipo visual del distrito) — **en curso** · Fase 1 terminada (Pages pendiente del cliente) · **Rama:** `claude/dreamy-turing-n5zefc`

## Resumen

| Área | Estado |
|---|---|
| Fase 0 · Diseño | ✅ Aprobada por el cliente (D-01…D-08). |
| Proyecto y herramientas | ✅ Vite 8 + TS 6 + React 19 + Phaser 4, versiones fijadas. Lint con reglas de capas, Prettier, typecheck. |
| Núcleo de simulación | ✅ Determinista: RNG con semilla por flujos, calendario, reloj, comandos, máquina de fases, crónica histórica. |
| Ciclo anual (esqueleto) | ✅ Distrito → Criba (otoño, día 1) → Áurea (7 días) → Arena → Regreso con piloto automático → Distrito. Los paneles de Criba/Áurea/Arena/Regreso son **PROVISIONALES**: solo hacen transiciones reales; sus mecánicas llegan en las Fases 5–8. |
| Guardado | ✅ IndexedDB: 3 ranuras manuales + 2 autoguardados rotativos (al cambiar de día y de fase), saves gzip versionados, cadena de migraciones, exportar/importar `.diezmo`, petición de almacenamiento persistente. |
| Render | 🟡 Distrito XII visible: terreno pre-renderizado (valle, montañas, río, bosque, plaza, vía), 7 tipos de edificio (+3 variantes), árboles, rocas, farolas, humo de chimeneas, día/noche con halos de luz. Cámara con límites y zoom adaptado a la pantalla. Falta: habitantes caminando, partículas de polvo, mejoras visuales por nivel, presets de calidad completos. |
| Interfaz | 🟡 Menú principal, HUD (fecha, hora, cuenta atrás de la Criba, velocidades), diálogos de guardar/cargar, pantalla de error con exportación, panel de depuración (`?debug`). Sistema de diseño básico; tipografías y pulido en la Fase 2. |
| Móvil | 🟡 Layout adaptado a iPhone horizontal y vertical (verificado en emulación). **Sin probar todavía en un iPhone real.** |
| PWA | 🟡 Manifest, iconos propios y service worker generados. Instalación no verificada en dispositivo real. |
| Pruebas | ✅ 48 tests unitarios/integración + 10 E2E (escritorio + iPhone emulado). Simulador headless. Ver `TESTING.md`. |
| CI / despliegue | 🟡 **Verificación en verde en GitHub Actions** (ejecución nº 1: lint, formato, typecheck, tests, simulador, build y E2E). El despliegue a Pages falla con un 404 porque **Pages no está activado** en el repositorio (ver Bloqueos). |
| Arte | 🟡 Pipeline v2 en producción (D-02, ART_BIBLE §11.2): 15 texturas CC0, terreno y 21 sprites. Pendiente: personajes animados, niveles visuales de edificios, compresión WebP. |
| Estado de partida | ✅ v2 con el distrito (estructuras y props deterministas por semilla) y migración v1→v2 probada. |

## Métricas medidas (2026-11-23)

- Bundle: JS inicial **80 KB gzip** (menú); motor Phaser cargado bajo demanda **359 KB gzip**; total ≈ 440 KB (presupuesto: < 600 KB).
- Simulador: 50 años de calendario en 9 ms (solo sistemas de la Fase 1; no representa el coste futuro).
- Distrito en Chromium con WebGL por software (SwiftShader, sin GPU), 1280×720: 4 FPS con luces por píxel → **13 FPS con tintado + halos** (decisión I-21/D-02). Falta medir en GPU real y en iPhone.
- Arte: terreno 3,4 MB (1x) / 0,9 MB (0,5x); sprites 13 MB en PNG (pendiente WebP).
- Render del spike: casa ≈ 10 s, minero 8 direcciones ≈ 7 s (CPU, Cycles).

## Bloqueos

1. **GitHub Pages**: el cliente debe activar Pages en *Settings → Pages → Source: GitHub Actions* y volver a lanzar el workflow (*Actions → CI / Deploy → Run workflow*) o hacer un push.
2. (No bloqueante) Reverse Engineering Skill no disponible (D-09).

## Próximo paso

Terminar la Fase 2 según `TASKS.md`: habitantes animados caminando, niveles visuales de edificios, polvo de carbón y ambiente, tipografías, presets de calidad, WebP, y medir rendimiento en iPhone real.
