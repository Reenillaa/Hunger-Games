# PROJECT_STATUS — Estado real del proyecto

> Responsabilidad: **qué existe y funciona hoy**, sin adornos. Se actualiza al final de cada sesión de trabajo.

**Última actualización:** 2026-11-23 · **Fase activa:** 1 (Fundación técnica + esqueleto andante) — **terminada en local**; publicación en GitHub Pages pendiente de una acción del cliente (ver Bloqueos) · **Rama:** `claude/dreamy-turing-n5zefc`

## Resumen

| Área | Estado |
|---|---|
| Fase 0 · Diseño | ✅ Aprobada por el cliente (D-01…D-08). |
| Proyecto y herramientas | ✅ Vite 8 + TS 6 + React 19 + Phaser 4, versiones fijadas. Lint con reglas de capas, Prettier, typecheck. |
| Núcleo de simulación | ✅ Determinista: RNG con semilla por flujos, calendario, reloj, comandos, máquina de fases, crónica histórica. |
| Ciclo anual (esqueleto) | ✅ Distrito → Criba (otoño, día 1) → Áurea (7 días) → Arena → Regreso con piloto automático → Distrito. Los paneles de Criba/Áurea/Arena/Regreso son **PROVISIONALES**: solo hacen transiciones reales; sus mecánicas llegan en las Fases 5–8. |
| Guardado | ✅ IndexedDB: 3 ranuras manuales + 2 autoguardados rotativos (al cambiar de día y de fase), saves gzip versionados, cadena de migraciones, exportar/importar `.diezmo`, petición de almacenamiento persistente. |
| Render | 🟡 Proyección isométrica, cámara (arrastrar, rueda, pellizco, teclado), selección de celda. El distrito es una **cuadrícula gris provisional**; terreno y edificios llegan en la Fase 2. |
| Interfaz | 🟡 Menú principal, HUD (fecha, hora, cuenta atrás de la Criba, velocidades), diálogos de guardar/cargar, pantalla de error con exportación, panel de depuración (`?debug`). Sistema de diseño básico; tipografías y pulido en la Fase 2. |
| Móvil | 🟡 Layout adaptado a iPhone horizontal y vertical (verificado en emulación). **Sin probar todavía en un iPhone real.** |
| PWA | 🟡 Manifest, iconos propios y service worker generados. Instalación no verificada en dispositivo real. |
| Pruebas | ✅ 48 tests unitarios/integración + 10 E2E (escritorio + iPhone emulado). Simulador headless. Ver `TESTING.md`. |
| CI / despliegue | 🟡 **Verificación en verde en GitHub Actions** (ejecución nº 1: lint, formato, typecheck, tests, simulador, build y E2E). El despliegue a Pages falla con un 404 porque **Pages no está activado** en el repositorio (ver Bloqueos). |
| Arte | 🟡 Spike del pipeline Blender → sprites con normal map → luz dinámica en Phaser 4: **viable** (D-02). Sin assets definitivos todavía. |

## Métricas medidas (2026-11-23)

- Bundle: JS inicial **80 KB gzip** (menú); motor Phaser cargado bajo demanda **359 KB gzip**; total ≈ 440 KB (presupuesto: < 600 KB).
- Simulador: 50 años de calendario en 9 ms (solo sistemas de la Fase 1; no representa el coste futuro).
- Render del spike: casa ≈ 10 s, minero 8 direcciones ≈ 7 s (CPU, Cycles).

## Bloqueos

1. **GitHub Pages**: el cliente debe activar Pages en *Settings → Pages → Source: GitHub Actions* y volver a lanzar el workflow (*Actions → CI / Deploy → Run workflow*) o hacer un push.
2. (No bloqueante) Reverse Engineering Skill no disponible (D-09).

## Próximo paso

Fase 2 (prototipo visual del distrito) según `TASKS.md`: pipeline de arte definitivo con los 4 requisitos del spike, mapa 48×48 con terreno, edificios estáticos, iluminación día/noche, habitantes de demostración y tipografías.
