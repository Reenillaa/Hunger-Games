# CLAUDE.md — Reglas de trabajo para sesiones de Claude Code

Proyecto: videojuego de estrategia/simulación/supervivencia (Phaser 4 + TS + React). Documentación en `docs/`.

## Al empezar cada sesión
1. Lee `docs/PROJECT_STATUS.md` y `docs/TASKS.md`. Continúa desde el último estado verificado.
2. **No repitas la auditoría** ni re-planifiques lo aprobado en `docs/DECISIONS.md`.
3. `git status` antes de tocar nada.

## Reglas
- `src/core` es TS puro y determinista: sin DOM, Phaser, React, `Math.random` ni `Date.now`. Todo cambio de estado pasa por comandos.
- Contenido como datos en `src/content`; textos visibles solo por claves de localización (los nombres del universo pueden cambiar, ver D-01).
- Código e identificadores en inglés; documentación en español.
- Dependencias: versión exacta, ≥ 2 semanas de antigüedad, justificada en `DECISIONS.md`.
- No inventes resultados de pruebas. Registra ejecuciones reales en `docs/TESTING.md`.
- Al cerrar trabajo: actualiza `PROJECT_STATUS.md`, `TASKS.md` y lo que corresponda. Sin duplicar información entre documentos.
- Assets: solo propios/CC0/CC-BY registrados en `assets/LICENSES.md`; nada de la franquicia de referencia.
