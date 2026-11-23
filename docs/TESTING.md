# TESTING — Estrategia y registro de pruebas

> Responsabilidad: **cómo se prueba el juego y qué se ha verificado de verdad**. Nunca se registra como pasada una prueba que no se ha ejecutado.

## 1. Pirámide de pruebas

| Nivel | Herramienta | Qué cubre | Cuándo |
|---|---|---|---|
| Unitarias | Vitest (Node) | Fórmulas, comandos, sistemas del `core`, reglas de Criba, IA (decisiones puntuales), migraciones de guardado | Cada commit (CI) |
| Propiedades / invariantes | Vitest + generadores con semilla | "Nadie es su propio padre", "recursos ≥ 0", "un muerto no trabaja", "la suma de pesos de la Criba = elegibles", "un participante eliminado no actúa" | Cada commit |
| Determinismo | Vitest | Mismo seed + mismos comandos ⇒ mismo hash de estado | Cada commit |
| Integración | Vitest | `GameSession` recorre ciclos completos; guardar → cargar → continuar produce el mismo estado | Cada commit |
| Simulación por lotes (equilibrado) | `npm run sim` (Node, headless) | N años de distrito / N arenas con informes estadísticos (duración, causas de muerte, economía, alianzas, traiciones) | Al cambiar números de diseño; informe adjunto al PR |
| E2E de humo | Playwright + Chromium preinstalado (`--trace off`) | Arranque, nueva partida, construir, guardar, recargar, cambio de fase; viewport de escritorio y de iPhone emulado | Cada PR |
| Rendimiento | Benchmarks Vitest + métricas en el juego (overlay de FPS/ms) | Presupuestos de `TECHNICAL_ARCHITECTURE.md §12` | Por fase |
| Manual en dispositivo | Checklist §3 | iPhone real (Safari y PWA instalada), Android, escritorio | Fin de cada fase visual |

Los tests del `core` **no abren navegador ni Phaser**: la simulación, la economía, la Criba y la IA se prueban sin interfaz (requisito del prompt maestro).

## 2. Comandos (se crean en la Fase 1)

```bash
npm test            # unit + integración
npm run e2e         # humo con Playwright
npm run sim -- --years 50 --seed 123
npm run typecheck
npm run lint
```

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
