# PROJECT_STATUS — Estado real del proyecto

> Responsabilidad: **qué existe y funciona hoy**, sin adornos. Se actualiza al final de cada sesión de trabajo.

**Última actualización:** 2026-11-23 · **Fase activa:** 0 (Auditoría y diseño) — entregada, **pendiente de aprobación** · **Rama:** `claude/dreamy-turing-n5zefc`

## Resumen

| Área | Estado |
|---|---|
| Código del juego | **No existe todavía.** Ninguna línea de código. |
| Documentación de diseño y arquitectura | Redactada (10 documentos en `docs/` + `README.md` + `CLAUDE.md`). |
| Build / tests / CI / despliegue | No configurados (Fase 1). |
| Assets | Ninguno. Pipeline propuesto (D-02), sin probar. |
| Decisiones aprobadas por el cliente | Ninguna todavía. Ver `DECISIONS.md` parte A. |

## Auditoría inicial (2026-11-23)

- **Repositorio** `Reenillaa/Hunger-Games`: vacío, sin commits, sin ficheros. No hay trabajo previo que preservar.
- **Entorno**: contenedor Linux; Node 22.23.5, npm 10.9.9, pnpm 10.28.0, Git 2.43, Python 3.13; Chromium + Playwright preinstalados; 4 CPU, 15 GB RAM.
- **Blender**: no instalado, pero `bpy 5.3.0` disponible por pip → el pipeline de arte 3D→sprites es viable en el contenedor (pendiente de spike).
- **Reverse Engineering Skill**: **no instalada** (D-09). No se ha usado.
- **Versiones de librerías** comprobadas en npm (ver `TECHNICAL_ARCHITECTURE.md §1`). Hallazgos relevantes: Phaser 4 estable (cambia la hipótesis de Phaser 3); TS 7 incompatible con typescript-eslint → TS 6.0.3; `TilemapGPULayer` no soporta isométrico.

## Bloqueos

1. Aprobación del cliente de D-01…D-08 para empezar la Fase 1.
2. (No bloqueante) Reverse Engineering Skill no disponible.

## Próximo paso

Tras la aprobación: Fase 1 según `TASKS.md`.
