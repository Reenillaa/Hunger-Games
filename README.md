# DIEZMO

Videojuego de estrategia, gestión, simulación social y supervivencia para navegador (escritorio y móvil) y PWA.

Gobiernas el Distrito XII · Veta Negra, un valle minero bajo **la Concordia**, un régimen que cada año exige su diezmo: carbón… y dos de tus jóvenes para los Juegos del Diezmo en la capital, **Áurea**. Construyes una sociedad que conoces persona a persona, con familias, relaciones y generaciones, sabiendo que no puedes elegir a quién perderás. Gane quien gane, el distrito sigue vivo… y el año que viene habrá otra Criba.

> **Estado:** Fase 1 terminada (base técnica y esqueleto jugable del ciclo anual). Todavía no hay mecánicas de juego: el distrito es una cuadrícula provisional. Estado real en [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

| Menú | Distrito (provisional) | iPhone |
|---|---|---|
| ![Menú](docs/images/phase1-menu.png) | ![Distrito](docs/images/phase1-district.png) | ![iPhone](docs/images/phase1-iphone-capital.png) |

Spike del pipeline de arte: sprites renderizados desde 3D con normal maps e iluminados en tiempo real por Phaser 4 (modelos provisionales).

| Luz a la izquierda | Luz a la derecha |
|---|---|
| ![Spike izquierda](docs/images/spike-light-left.png) | ![Spike derecha](docs/images/spike-light-right.png) |

## Jugar

- **Web:** `https://reenillaa.github.io/Hunger-Games/` (disponible cuando se active GitHub Pages; ver `docs/TASKS.md`, C-1).
- **iPhone:** abre la URL en Safari → Compartir → *Añadir a pantalla de inicio*.
- Herramientas de desarrollo: añade `?debug` a la URL.

## Desarrollo

Requisitos: Node ≥ 22.12. Para instalar dependencias **nuevas**, usa npm 11 (`npx npm@11 install …`): npm 10 tiene un bug con vitest 5. `npm ci` funciona con cualquiera.

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm run verify
```

```bash
npm run build && npm run e2e
```

```bash
npm run sim -- --years 50 --seed 123
```

Pipeline de arte (opcional; requiere `pip install bpy==5.3.0` en un entorno de Python 3.13):

```bash
python tools/art/spike_render.py --out assets/build/spike
```

```bash
npx vite --config tools/art/viewer/vite.config.ts
```

## Documentación

| Documento | Para qué sirve |
|---|---|
| [GDD](docs/GDD.md) | Visión, pilares, bucles, estructura y alcance del juego |
| [GAME_SYSTEMS](docs/GAME_SYSTEMS.md) | Reglas, fórmulas y datos de cada sistema |
| [TECHNICAL_ARCHITECTURE](docs/TECHNICAL_ARCHITECTURE.md) | Stack, capas, rendimiento, guardado, despliegue |
| [ART_BIBLE](docs/ART_BIBLE.md) | Dirección artística, paletas, especificaciones y política de assets |
| [ROADMAP](docs/ROADMAP.md) | Fases, dependencias y criterios de finalización |
| [PROJECT_STATUS](docs/PROJECT_STATUS.md) | Qué existe y funciona hoy |
| [TASKS](docs/TASKS.md) | Tareas accionables con criterios de aceptación |
| [DECISIONS](docs/DECISIONS.md) | Decisiones, alternativas y motivos |
| [TESTING](docs/TESTING.md) | Estrategia de pruebas y registro de ejecuciones |

Tecnología: Phaser 4 · TypeScript 6 · React 19 · Vite 8 · Vitest · Playwright · IndexedDB · PWA · GitHub Actions · GitHub Pages.

## Propiedad intelectual

Universo, nombres, personajes y assets son originales o de licencia libre (CC0/CC-BY con atribución). El proyecto se inspira en conceptos de género (distopía, competición de supervivencia, simulación de colonias, táctica por turnos) sin usar marcas, personajes ni recursos protegidos de terceros. El nombre del repositorio es solo interno.
