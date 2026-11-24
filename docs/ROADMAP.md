# ROADMAP — Fases, dependencias y criterios de finalización

> Responsabilidad: **el plan por fases**. El estado real de lo hecho está en `PROJECT_STATUS.md`; las tareas concretas de la fase activa, en `TASKS.md`.

Leyenda de estado: ✅ terminada · 🟡 en curso / pendiente de aprobación · ⬜ no iniciada

---

## MVP — "Un año en el Distrito XII" (rebanada vertical, D-06)

Una partida en la que se puede, desde el navegador del ordenador o del iPhone:
1. Empezar en primavera en un Distrito XII bonito, vivo y navegable (~120 habitantes con familias).
2. Construir y mejorar los edificios iniciales, gestionar recursos, trabajadores, leyes y la cuota.
3. Abrir la ficha de cualquier habitante con retrato, familia, relaciones e historial.
4. Vivir eventos encadenados y la presión del régimen.
5. Asistir a la Criba cinematográfica con los jóvenes reales.
6. Jugar los siete días en Áurea con decisiones que importan.
7. Jugar la arena forestal por turnos con 24 participantes, IA, niebla, supervivencia, combate, alianzas, traiciones y mecenas.
8. Volver al distrito con las consecuencias y empezar el año siguiente.
9. Guardar, cerrar y continuar; instalar como PWA; jugarlo en una URL pública de GitHub Pages.

---

## Fases

| Fase | Nombre | Estado | Depende de |
|---|---|---|---|
| 0 | Auditoría y diseño | ✅ Aprobada el 2026-11-23 | — |
| 1 | Fundación técnica + esqueleto andante | 🟡 Terminada y verificada en CI; falta activar GitHub Pages (acción del cliente) | 0 aprobada |
| 2 | Prototipo visual del distrito | ✅ 2026-11-24 | 1 |
| 3 | Construcción y economía | ✅ 2026-11-24 | 2 |
| 4 | Población (+ prototipo headless de IA de arena) | ✅ 2026-11-24 | 3 |
| 5 | Criba | ✅ 2026-11-24 | 4 |
| 6 | Preparación en Áurea | ✅ 2026-11-24 | 5 |
| 7 | Arena | ✅ 2026-11-24 | 4 (IA headless), 6 |
| 8 | Continuidad (regreso y nuevo ciclo) → **MVP completo** | ✅ 2026-11-24 | 7 |
| 9 | Política y eventos (profundización) | ✅ 2026-11-24 | 8 |
| 10 | Pulido y publicación | 🟡 Siguiente | 9 |
| 11+ | Post-MVP: multi-distrito, nuevas arenas, Jubileos, inglés… | ⬜ | 10 |

> El régimen y los eventos aparecen **de forma básica desde la Fase 3** (cuota, atención, unos pocos eventos) porque el MVP los necesita; la Fase 9 los profundiza.

---

### Fase 0 · Auditoría y diseño
**Objetivo:** decisiones de arquitectura, diseño y alcance antes de escribir código.
**Entregables:** los 10 documentos de `docs/` + `README.md` + `CLAUDE.md`; lista de decisiones para aprobación (`DECISIONS.md` parte A).
**Criterio de finalización:** el cliente aprueba (o corrige) D-01 a D-08.

### Fase 1 · Fundación técnica + esqueleto andante
**Objetivo:** proyecto que compila, se prueba y se despliega solo; flujo completo de fases navegable.
- Vite 8 + TS 6 + React 19 + Phaser 4; ESLint/Prettier; regla de imports por capas.
- Núcleo: `GameState`, comandos, scheduler de tiempo, RNG con semilla, bus de eventos.
- Persistencia: IndexedDB, ranuras, versión y primera migración de prueba, exportar/importar.
- Escenas vacías conectadas: Menú → Distrito → Criba → Capital → Arena → Regreso → Distrito (D-07).
- Vitest + Playwright (humo); GitHub Actions; despliegue en GitHub Pages; PWA básica.
- **Spike de arte:** renderizar en Blender headless un edificio y un personaje de prueba en 8 direcciones con normal map y mostrarlos con luz en Phaser 4.
**Criterio de finalización:** URL pública funcionando en escritorio e iPhone; CI verde; partida guardada sobrevive a recargar; el spike de arte tiene veredicto documentado.

### Fase 2 · Prototipo visual del distrito
**Objetivo:** un Distrito XII **bonito y navegable** (aún sin economía).
- Menú principal con identidad. Mapa 48×48 isométrico: terreno con elevación, vegetación, montaña, río, caminos, edificios estáticos, decoración.
- Cámara (pan, zoom, límites, inercia) con ratón, teclado y gestos táctiles.
- Iluminación día/noche, sombras, partículas (humo, polvo, ceniza).
- Habitantes de demostración caminando por los caminos (representación visual).
- HUD base y sistema de diseño de UI; layouts móvil/escritorio.
- Presets de calidad.
**Criterio:** 60 fps escritorio / ≥ 30 fps iPhone de referencia; revisión visual contra `ART_BIBLE.md` aprobada por el cliente.

### Fase 3 · Construcción y economía
- Colocación con fantasma y validez, obras, constructores, niveles con cambio visual, demolición, caminos.
- Recursos (fase 3: comida, madera, piedra, carbón, créditos; 3b: mineral, metal, material, energía), almacenes, producción, consumo, comercio en el economato, cuota básica del régimen, Atención básica.
- Asignación de trabajadores (automática por prioridades + manual).
**Criterio:** el simulador headless corre 10 años sin colapsos absurdos; tests de economía; el jugador puede crecer o arruinarse según sus decisiones.

### Fase 4 · Población
- Habitantes completos (ficha, retratos procedurales, rasgos, atributos, habilidades), LOD de simulación, agenda diaria visible, necesidades y ánimo, relaciones, familias, parejas, nacimientos, envejecimiento, muertes, profesiones, eventos sociales básicos, leyes iniciales.
- **En paralelo:** prototipo headless de la IA de arena (D-07) con informe estadístico.
**Criterio:** 1.000 habitantes dentro del presupuesto de rendimiento; genealogía consistente tras 50 años simulados (tests de invariantes).

### Fase 5 · Criba
- Motor de reglas de selección configurable; cinemática completa con datos reales; reacciones familiares; sistema de cinemáticas reutilizable (base).
**Criterio:** tests estadísticos del sorteo (distribución por pesos); cinemática saltable y con versión corta.

### Fase 6 · Preparación en Áurea
- Escenas de la capital; los 7 días; vestuario, entrenamiento animado, evaluación, entrevistas, relaciones con otras ofrendas, mecenas, equipo inicial; perfiles de los otros 11 distritos.
**Criterio:** cada decisión tiene efecto medible en la arena (verificado con simulación).

### Fase 7 · Arena
- Generación de la arena forestal, cuadrícula, turnos, PA, movimiento, niebla, supervivencia, combate animado, inventario, alianzas con memoria, traiciones, IA de utilidad, director, mecenas y cápsulas, órdenes largas con interrupciones, eliminaciones y victoria.
**Criterio:** 1.000 arenas simuladas: duración 4–8 días en ≥ 95 %; sin bloqueos; la IA usa solo su percepción; una partida jugada a mano dura 20–40 min.

### Fase 8 · Continuidad → MVP
- Regreso, laureados, duelo, recompensas, represalias, piloto automático durante la ausencia, historial nacional, nuevo año.
**Criterio:** se pueden jugar 3 ciclos seguidos sin incoherencias; guardar/cargar en cualquier punto.

### Fase 9 · Política y eventos
- Gobernante con personalidad y agenda, intervenciones con motivo, tensión y revueltas, narrador de eventos completo (≥ 60 eventos), cadenas largas.

### Fase 10 · Pulido y publicación
- Optimización, accesibilidad, responsive final, PWA completa, pruebas en dispositivos reales, README visual con capturas, revisión de licencias, publicación.

### Fase 11+ · Post-MVP (backlog)
Ascenso y gestión multi-distrito, arenas adicionales, Jubileos, idioma inglés, logros, editor de reglas, preparación de multijugador (servidor autoritativo).
