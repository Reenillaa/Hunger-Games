# GAME_SYSTEMS — Especificación de sistemas

> Responsabilidad: **reglas, fórmulas, datos y relaciones** de cada sistema.
> Todos los números son **valores iniciales de diseño**: se equilibran con el simulador headless (`npm run sim`, ver `TESTING.md`) y se actualizan aquí cuando cambian.
> Nombres visibles según el glosario de `GDD.md §13`.

Índice: [1 Tiempo](#1-tiempo) · [2 Mapas](#2-mapas) · [3 Construcción](#3-construcción) · [4 Economía](#4-economía) · [5 Población](#5-población) · [6 Leyes](#6-leyes-del-distrito) · [7 Criba](#7-criba-selección) · [8 Preparación](#8-preparación-los-siete-días) · [9 Mecenas](#9-mecenas) · [10 Arena](#10-arena) · [11 Régimen](#11-régimen-y-gobernante) · [12 Eventos](#12-eventos-dinámicos) · [13 Progresión](#13-progresión) · [14 Lecciones de referencia](#14-lecciones-de-referencia)

---

## 1. Tiempo

### 1.1 Distrito (tiempo continuo con pausa)

| Unidad | Valor |
|---|---|
| Tick de simulación | 1 hora de juego |
| Día | 24 ticks |
| Estación | 10 días (primavera, verano, otoño, invierno) |
| Año | 4 estaciones = 40 días |
| Velocidad ×1 | 1 hora de juego = 2 s reales → día ≈ 48 s → año ≈ 32 min |
| Velocidades | Pausa · ×1 · ×2 · ×4 (en móvil se reduce la frecuencia de render, no la simulación) |

- **Criba:** día 1 de otoño de cada año. Cuenta atrás siempre visible en la HUD.
- El ciclo día/noche es visual y jugable: turnos de mina, horario escolar, toque de queda, iluminación.
- Al entrar en una fase de los juegos, el distrito pasa a **piloto automático**: se simula en modo abstracto (§5.9) los días que duren la capital y la arena.

### 1.2 Capital: 7 días discretos, cada uno con 2–4 "franjas" de decisión.

### 1.3 Arena: rondas (1 ronda = 1 hora de arena), 24 rondas por día, ciclo día/noche. Órdenes de larga duración con interrupciones (D-05).

### 1.4 Calendario histórico
Cada partida tiene un *Año de la Concordia* (p. ej. "Año 74"). Las ediciones especiales (Jubileo) ocurren cada 25 años de calendario.

---

## 2. Mapas

### 2.1 Modelo común
- **Cuadrícula lógica cuadrada**; proyección isométrica 2:1 solo en el render (`DECISIONS.md` I-11).
- Cada celda: `terrain` (tipo), `elevation` (0–3 niveles), `feature` (roca, árbol, veta, agua…), `occupant` (edificio/camino), `flags` (edificable, transitable, recurso).
- Coste de movimiento por terreno (agentes del distrito y participantes de arena usan el mismo pathfinding A* con tabla de costes distinta).

### 2.2 Mapa del Distrito XII (MVP)
- **48 × 48 celdas.** Valle estrecho entre laderas: montaña con bocaminas al norte, bosque fronterizo al sur tras una alambrada, río pequeño, núcleo urbano con plaza (escenario de la Criba) y estación de tren (llegadas/salidas).
- **Plantilla diseñada a mano + variación por semilla** (posición de vetas, árboles, rocas, casas iniciales). Bonito por diseño, distinto en cada partida.
- Zonas: núcleo (edificable), laderas (solo minería), bosque (leñadores, caza ilegal), vía del tren (no edificable), plaza (fija).
- Autoría con **Tiled** (editor libre) en una capa lógica ortogonal; el juego la proyecta a isométrico.

### 2.3 Arena forestal (MVP)
- **56 × 56 celdas**, generada por semilla con reglas: claro central con el **Relicario**, río con vados, zonas rocosas (cuevas = escondite), bosque denso, matorral, ruinas de una estación de investigación, lago, acantilados.
- Recursos repartidos (agua, bayas, caza, setas, alijos de suministros) y peligros (zonas venenosas, animales, terreno inestable).
- El formato de arena es **datos** (generador + reglas + tabla de recursos y peligros): nuevas arenas sin reprogramar mecánicas.

---

## 3. Construcción

1. El jugador abre el catálogo (filtrado por categoría y desbloqueos).
2. Selecciona edificio → aparece un **fantasma** que sigue el puntero/dedo, en verde/rojo según validez, con la huella y el radio de efecto.
3. Validez: celdas edificables y libres, pendiente permitida, requisitos especiales (mina junto a veta), acceso a camino (aviso si no lo hay).
4. Panel lateral/bottom sheet: coste, recursos, tiempo, trabajadores, producción prevista, mejoras futuras.
5. Confirmar → se descuentan materiales → **obra** visible (andamios, cimientos) → constructores asignados caminan hasta allí → progreso por horas-trabajador → edificio terminado.
6. Rotación de 2 orientaciones (espejo) en edificios asimétricos.
7. Demolición devuelve el 50 % de materiales.
8. En móvil: toque para colocar el fantasma, arrastre para moverlo, botón ✓/✕ (iconos propios) para confirmar.

**Caminos:** se trazan arrastrando. Edificios sin camino al almacén trabajan al 60 % (porteo lento). Caminos de tierra → empedrado (mejora) → iluminados (requiere energía).

**Niveles de edificio:** 1–3 con cambio visual real (D-02). En nivel 3 se elige una **especialización** (rama excluyente). Ej.: Mina → *Galería profunda* (+40 % producción, +riesgo de derrumbe) o *Mina segura* (+10 %, −70 % accidentes).

---

## 4. Economía

### 4.1 Recursos (introducción escalonada)

| Recurso | Fuente | Consumo / uso | Almacén | Comercio | Fase |
|---|---|---|---|---|---|
| **Comida** | Huerto comunal, caza/recolección, importación en el Economato | 1/adulto/día, 0,6/niño/día; enfermería; ofrendas | Almacén (se estropea 1 %/día sin conservas) | Compra cara a Áurea; mercado negro | 3 |
| **Madera** | Puesto de leñadores (bosque) | Construcción, calefacción en invierno, Taller | Almacén | Compra | 3 |
| **Piedra** | Cantera | Construcción, mejoras | Almacén / patio | Compra | 3 |
| **Carbón** | Mina | **Cuota del régimen**, exportación, calefacción, Fundición, Generador | Almacén / tolva de la mina | Venta a precio fijado por el régimen | 3 |
| **Créditos** | Venta de carbón, impuestos locales | Importaciones, sueldos, medicinas, vestuario, sobornos | — | — | 3 |
| **Mineral de hierro** | Mina nivel 2+ (veta secundaria) | Fundición | Almacén | Venta | 3b |
| **Metal** | Fundición (mineral + carbón) | Herramientas, mejoras nivel 3, armas clandestinas | Almacén | Venta | 3b |
| **Material industrial** | Taller (metal + madera) | Mejoras, productividad (+herramientas), Generador | Almacén | Venta | 3b |
| **Energía** | Generador (carbón) | Iluminación, maquinaria nivel 3, enfermería avanzada | No se almacena (red) | — | 3b |

Regla de diseño: **ningún recurso sin al menos dos usos y una tensión** (el carbón es a la vez cuota, dinero, calor y energía).

### 4.2 Edificios iniciales del Distrito XII

| Edificio | Función | Coste N1 | Trab. N1/N2/N3 | Producción / efecto | Desbloqueo |
|---|---|---|---|---|---|
| **Viviendas** (chabola → casa adosada → bloque obrero) | Alojamiento de un hogar; confort | 20 madera | 0 | Capacidad 4/6/10 personas; confort 1/2/3 | Inicio |
| **Mina** (bocamina → galería → pozo mecanizado) | Carbón; hierro desde N2 | 40 madera, 20 piedra | 6/10/16 | 0,25 carbón/trabajador/hora × habilidad; riesgo de accidente | Inicio (junto a veta) |
| **Almacén** | Capacidad y logística | 30 madera | 2/3/4 | +400/+1000/+2500 unidades | Inicio |
| **Puesto de leñadores** | Madera | 15 madera | 3/5/7 | 0,3 madera/trab./hora | Inicio |
| **Cantera** | Piedra | 25 madera | 3/5/7 | 0,2 piedra/trab./hora | Inicio |
| **Huerto comunal** | Comida local (estacional; nada en invierno) | 15 madera | 2/4/6 | 0,4 comida/trab./hora (×0 en invierno) | Inicio |
| **Economato** (mercado/distribución) | Compra-venta con Áurea; reparto de raciones; mercado negro (ley) | 40 madera, 20 piedra | 2/3/4 | Habilita comercio; +ánimo si hay variedad | Inicio |
| **Ayuntamiento** (centro administrativo) | Leyes, investigación, relación con el régimen, padrón | Existe al inicio | 2/4/6 | Puntos de conocimiento; ranuras de leyes | Inicio (fijo) |
| **Enfermería** | Salud, partos, heridas de mina, recuperación de laureados | 30 madera, 20 piedra, 30 créditos | 2/3/5 | Curación; −mortalidad infantil | Año 1, verano |
| **Centro de formación** (escuela → academia) | Educación de niños y jóvenes; entrenamiento físico; base de habilidades para la Criba | 50 madera, 30 piedra | 2/3/5 (maestros) | +XP de habilidades a 6–18 años; desde N2, entrenamiento de supervivencia (aumenta atención del régimen) | Tecnología *Escolarización* |
| **Fundición** (3b) | Metal | 60 piedra, 40 madera | 4/6/8 | 1 mineral + 1 carbón → 1 metal / 2 h | Tecnología |
| **Taller** (3b, "centro de producción") | Material industrial, herramientas | 40 madera, 20 metal | 3/5/7 | 1 metal + 1 madera → 1 material | Tecnología |
| **Generador** (3b) | Energía | 30 metal, 40 piedra | 3/4/6 | 1 carbón → 10 energía/hora | Tecnología |

### 4.3 Flujo económico
- **Producción** = Σ trabajadores × tasa base × modificador de habilidad (0,6–1,6) × ánimo (0,7–1,2) × herramientas (1,0–1,3) × salud × acceso a camino.
- **Cuota anual del régimen**: X toneladas de carbón por estación. Base 120/estación en el año 1; crece con el desarrollo del distrito (§11). Incumplir genera castigos escalonados; superar genera Favor.
- **Impuesto** del régimen: % sobre ventas. **Precio del carbón**: fijo y bajo (explotación); el mercado negro paga mejor pero suma Atención.
- **Salarios** (créditos) opcionales por ley: suben el ánimo, cuestan dinero.
- **Logística abstracta**: sin transporte unidad a unidad (coste de rendimiento). La distancia al almacén reduce eficiencia; los porteadores visibles son representación visual de ese flujo.

### 4.4 Economía y bienestar
Pobreza → menos comida → peor salud y ánimo → menos productividad, más enfermedad y mortalidad, menos natalidad, jóvenes más débiles para la arena. Riqueza → mejores viviendas, salud, formación, vestuario… y **más atención y cuota del régimen**.

---

## 5. Población

### 5.1 Ficha de habitante (modelo de datos)

```ts
Citizen {
  id, firstName, lastNames[2], sex, birthDay (día absoluto), alive, deathDay?, deathCause?
  appearance: { genes: PortraitGenes, scars[], build }     // retrato procedural heredable
  family: { motherId?, fatherId?, partnerId?, childrenIds[], householdId }
  attributes: { strength, agility, endurance, intellect, charisma, perception }  // 1–10, innatos, heredables
  skills: { mining, construction, farming, survival, crafting, medicine, teaching,
            combat, stealth, orientation, tools, social }                       // 0–20, aprendidos
  traits: TraitId[2..3]
  job?: { buildingId, role }, education?: { buildingId }
  health: { hp 0–100, conditions[] (herida, enfermedad, embarazo, trauma…) }
  needs: { food, rest, warmth, safety, social }          // 0–100
  mood (derivado), stress
  regimeOpinion (−100..100), districtLoyalty
  relations: sparse map → { opinion, familiarity, kind[], memories[] }
  history: EventRef[]   // nacimiento, trabajo, accidentes, Criba, muertes cercanas…
  flags: { wasSelected, laureate, dissident, … }
}
```

La **ficha individual** (UI) muestra: retrato, nombre, edad, profesión, rasgos, atributos y habilidades, salud y necesidades, familia (mini árbol genealógico navegable), relaciones principales (amigos, rivales, pareja) e historial cronológico.

### 5.2 Atributos y habilidades — el mismo modelo para el distrito y la arena
Las 10 habilidades del entrenamiento pedidas se mapean así: Fuerza → atributo `strength`; Velocidad → derivado (`agility` + `endurance`); Resistencia → `endurance`; Agilidad → `agility`; Sigilo → `stealth`; Supervivencia → `survival`; Inteligencia → `intellect`; Combate → `combat`; Manejo de herramientas → `tools`; Orientación → `orientation`.

**Clave de diseño:** la vida en el distrito forja a las ofrendas. Ayudar en la mina da fuerza y resistencia; la caza furtiva en el bosque, supervivencia y sigilo; la escuela, inteligencia y orientación. Las decisiones económicas del jugador moldean a los jóvenes que el régimen se llevará.

### 5.3 Rasgos de personalidad (2–3 por persona, pares excluyentes)

| Rasgo | Opuesto | Efectos principales |
|---|---|---|
| Valiente | Cobarde | Arena: ataca con menos ventaja requerida / huye antes. Distrito: acepta trabajos peligrosos. |
| Ambicioso | Conformista | Busca ascensos/protagonismo; en arena, persigue la victoria sobre la supervivencia. |
| Leal | Egoísta | Peso de la confianza en alianzas; probabilidad de traición muy baja/alta. |
| Sociable | Huraño | Frecuencia de interacciones, facilidad para formar alianzas y pareja. |
| Desconfiado | Confiado | Acepta menos alianzas, detecta antes traiciones. |
| Agresivo | Pacífico | Inicia conflictos; en arena valora más el combate. |
| Manipulador | Sincero | Alianzas instrumentales; mentiras en entrevistas; traiciona en el momento óptimo. |
| Inteligente* | — | (*es atributo, no rasgo: `intellect`). |
| Resiliente | Frágil | Recuperación de estrés y duelo. |
| Devoto del régimen | Rebelde | Opinión inicial del régimen; reacción a castigos. |

Los rasgos modifican **pesos** en las decisiones (IA de utilidad, §10.9 y comportamiento diario), no aplican reglas fijas: dos valientes no actúan igual si su ánimo o sus relaciones difieren.

### 5.4 Necesidades y ánimo
- Necesidades 0–100 que decaen por hora (comida, descanso, calor en invierno, seguridad, social).
- **Ánimo** = media ponderada de necesidades + modificadores temporales (duelo, celebración, castigo, boda…) estilo "pensamientos" con duración.
- Ánimo bajo → menos productividad, conflictos, enfermedad, disidencia. Estrés alto sostenido → crisis (abandono del trabajo, alcohol, peleas).

### 5.5 Relaciones
- **Grafo disperso**: familia implícita + hasta ~20 relaciones no familiares significativas por persona.
- Cada relación: `opinion` (−100..100), `familiarity`, tipos (amistad, rivalidad, romance, mentor) y **memorias** (hechos con peso y caducidad: "me salvó en el derrumbe", "me robó").
- Interacciones diarias **muestreadas**: cada habitante tiene 1–3 interacciones al día elegidas por contexto (hogar, trabajo, escuela, vecinos, amigos), nunca O(n²). Resultado según compatibilidad de rasgos, ánimo y opinión previa.

### 5.6 Familias, parejas y generaciones
- Pareja: adultos (≥18) solteros con opinión > 60 y compatibilidad → noviazgo → unión. Una unión necesita **vivienda libre** para formar hogar propio (si no, convive con una familia y baja el confort): la vivienda es palanca demográfica.
- Natalidad por estación según edad, salud, comida, vivienda y ánimo del hogar. Embarazo = 1 estación.
- Hijos heredan **genes de retrato** (mezcla con mutación), **atributos** (media de padres ± variación) y **apellidos** de ambos. Heredan también parte de la reputación familiar.
- Envejecimiento anual; mortalidad por edad, salud, accidentes, hambre. Herencia de vivienda.
- Genealogía navegable desde la ficha (padres, hermanos, hijos, nietos, fallecidos).

### 5.7 Profesiones
Minero, capataz, leñador, cantero, hortelano, cazador (ilegal salvo ley), constructor, porteador, tendero, funcionario, maestro, enfermero/a, fundidor, artesano, operario del generador. Cada edificio define roles y requisitos (edad mínima, habilidad). Asignación **automática por prioridades** (el jugador ordena edificios por importancia) o **manual** (arrastrar persona a puesto). Los trabajadores mejoran su habilidad con la práctica.

### 5.8 Población inicial (MVP)
~**120 habitantes** en ~30 hogares, con genealogía generada de 3 generaciones (abuelos difuntos incluidos en el historial) para que las relaciones familiares existan desde el minuto uno. Jóvenes elegibles para la Criba (12–18): ~25.

### 5.9 Simulación por niveles de detalle (LOD)

| Nivel | Quién | Frecuencia | Qué se calcula |
|---|---|---|---|
| **V – Visual** | Habitantes visibles en pantalla (tope: 40 móvil / 120 escritorio) | Cada frame (render) | Pathfinding por camino, animación, interpolación. Es *representación* del estado L1. |
| **L1 – Agenda** | Todos | Cada tick (hora) | Máquina de estados de agenda: dónde está y qué actividad hace (dormir, trabajar, escuela, comer, ocio). Coste O(n), trivial. |
| **L2 – Diario** | Todos | 1 vez/día | Necesidades, salud, interacciones sociales muestreadas, XP de habilidades, condiciones. |
| **L3 – Estacional/anual** | Todos | Estación / año | Parejas, nacimientos, envejecimiento, muertes, cambios de oficio. |
| **A – Abstracto** | Distrito en piloto automático y otros distritos | Por día, agregado | Producción y consumo agregados; eventos relevantes se materializan sobre personas reales. |

Objetivo de rendimiento: **1.000 habitantes** en L1–L3 sin superar 2 ms/tick de media en un móvil medio. Los acontecimientos importantes siempre se registran en el historial individual, sea cual sea el nivel.

---

## 6. Leyes del distrito

Panel de leyes con ranuras limitadas (crecen con el Ayuntamiento). Cada ley tiene efecto, coste moral y reacción del régimen. Ejemplos MVP:

| Ley | Efecto | Coste / riesgo |
|---|---|---|
| Trabajo juvenil en la mina (14+) | +mano de obra, +fuerza de jóvenes | −salud y −educación juvenil; −moral |
| Raciones de supervivencia | −consumo de comida 20 % | −salud, −ánimo |
| Salario en créditos | +ánimo, +productividad | Coste por hora |
| Tolerar el mercado negro | Mejor precio, comida extra | +Atención del régimen |
| Entrenamiento clandestino | Jóvenes ganan combate/supervivencia | +Atención; evento de inspección |
| Caza en el bosque | +comida, +supervivencia | Ilegal para el régimen: +Atención |
| Duelo público por las ofrendas | +moral tras una muerte | El régimen lo interpreta como protesta |

---

## 7. Criba (selección)

### 7.1 Motor de reglas (datos, no código)

```ts
SelectionRuleSet {
  id, name
  eligibility: { minAge: 12, maxAge: 18, requires?: Condition[] }
  slots: [{ sex: 'F', count: 1 }, { sex: 'M', count: 1 }]       // configurable
  weighting: WeightTerm[]     // p.ej. base 1 + (edad − 12) entradas
  modifiers: Modifier[]       // por historial, castigos, leyes, eventos
  exemptions: Exemption[]     // laureados, hijos de laureados (configurable), sobornos
  postSelection?: Hook[]      // eventos de reacción, sustituciones especiales
}
```

Pipeline: **filtrar elegibles → calcular pesos → aplicar modificadores → excepciones → sorteo sin reemplazo con RNG con semilla por slot → hooks**. Añadir una regla nueva = añadir un `Modifier` o un `SelectionRuleSet` en `src/content`, sin tocar el motor.

Modificadores originales (ejemplos):
- **Lista de desafección**: familiares de disidentes castigados suman peso (el régimen castiga la disidencia a través de la Criba).
- **Favor comprado**: soborno a un funcionario → −peso para un joven concreto; si se descubre, castigo y +Atención.
- **Castigo colectivo**: tras una revuelta, el régimen añade un slot extra al distrito el año siguiente.
- **Jubileo** (cada 25 años): reglas especiales (más slots, rangos de edad distintos, elegir entre laureados…).

### 7.2 Presentación
Cinemática con la población real (ver `TECHNICAL_ARCHITECTURE.md §7`): plaza llena con los habitantes reales agrupados por edad, autoridades, presentadora de Áurea, urna, cámara que recorre las caras de los elegibles, nombre leído, plano de la familia (madre, hermanos reales), reacción del distrito según moral (silencio, murmullo, gesto de respeto propio del distrito), y presentación de los elegidos con sus datos.

### 7.3 Consecuencias inmediatas
Las familias de los elegidos ganan *estrés* y *miedo*; amigos y pareja también. Puestos de trabajo que quedan vacíos. Posible evento de despedida (decisión: ¿qué les das para llevar? → objeto de recuerdo con bonus psicológico en la arena).

---

## 8. Preparación: los siete días

Cada día tiene franjas de decisión con información incompleta. El estado de las ofrendas (atributos, habilidades, relaciones, popularidad) es el mismo modelo de la población.

| Día | Contenido | Decisiones del jugador | Afecta a |
|---|---|---|---|
| 1 · Llegada | Tren, llegada a Áurea, alojamiento, primer contacto con las 22 ofrendas restantes (generadas desde perfiles de distrito persistentes) | Postura inicial (reservada, amistosa, intimidante) | Primeras impresiones (relaciones), atención de otros |
| 2 · Vestuario y desfile | Diseñador asignado (con personalidad y creatividad), presupuesto del distrito | Concepto (identidad del distrito / audaz / tradicional), inversión en créditos | Popularidad. Un concepto arriesgado puede triunfar sin dinero |
| 3–5 · Entrenamiento | 3 sesiones/día por ofrenda en estaciones (combate, supervivencia, sigilo, herramientas, orientación, resistencia…) con animaciones | Repartir sesiones; observar a rivales (info); formar alianzas tácticas | Habilidades (ganancia = aptitud × mentor × rasgo × cansancio), conocimiento de rivales |
| 5 · Evaluación privada | Demostración ante los jueces | **Mostrar** (alta puntuación → mecenas, pero objetivo de los fuertes) u **ocultar** | Puntuación pública, mecenas, objetivo de la IA |
| 6 · Entrevistas y relaciones | Entrevista televisada | Ángulo: humilde, encantador, desafiante, misterioso, trágico (según rasgos/carisma) | Popularidad, Atención del régimen (desafiante), alianzas, rivalidades |
| 7 · Preparación final | Evaluación final, mecenas, equipo de salida, preparación psicológica, despedida, lanzamiento | Plan de apertura (huir del Relicario o luchar por él), último consejo | Estado psicológico, equipo inicial, primera orden en la arena |

Un **laureado vivo** del distrito actúa como mentor: mejora la ganancia de entrenamiento y desbloquea opciones (contactos con mecenas, información de rivales). Su propio estado (trauma, adicción) puede complicarlo.

---

## 9. Mecenas

- **Popularidad** por ofrenda (0–100) = vestuario + puntuación + entrevista + historia personal (huérfano, hermano de víctima, hijo de laureado…) + relaciones + prestigio del distrito, y **cambia en directo en la arena** (actos espectaculares, compasión, alianzas, desafío al régimen, sobrevivir contra pronóstico).
- **Fondo de mecenazgo** del distrito = Σ aportaciones según popularidad (un pobre carismático puede superar a un rico).
- El jugador (mentor) gasta el fondo en **cápsulas**: comida, agua, medicinas, herramientas, materiales, protección. **Precios suben cada día** de arena (escasez creciente).
- Entrega con representación visual: dron de mecenazgo que desciende con luz y sonido → la cápsula cae en la celda; otros participantes cercanos **pueden verla** (riesgo).
- El régimen puede **vetar** cápsulas a ofrendas desafiantes.

---

## 10. Arena

### 10.1 Estructura de ronda
- Orden de iniciativa por ronda: agilidad + percepción + pequeña variación (RNG con semilla).
- Cada participante actúa en su turno con **2 PA**. Las ofrendas del jugador comparten visión.
- **Órdenes largas** (D-05): el jugador asigna objetivo + política ("evitar combate", "defender si atacan") y la IA del propio participante ejecuta hasta una **interrupción**: enemigo visto, ataque recibido, cápsula, evento del director, necesidad crítica, propuesta de alianza, fin de orden.
- **Autonomía bajo estrés:** una ofrenda con estrés muy alto y rasgo Cobarde/Agresivo puede desobedecer (probabilidad visible). Genera historias; desactivable en opciones.

### 10.2 Movimiento
- **Mover** (1 PA): gasta hasta MOV puntos de movimiento. **Correr** (2 PA): 2×MOV, +fatiga, hace ruido (revela posición).
- `MOV = 6 + floor((agility + endurance) / 4)` − penalizaciones (heridas en piernas −3, agotamiento −2, sobrecarga −1 a −3).
- Coste por celda (ortogonal; diagonal ×1,5): claro 2 · bosque 3 · matorral 4 · roca/pendiente 4 · agua poco profunda 5 · río profundo: requiere supervivencia ≥ 8 o se arriesga a arrastre · acantilado: infranqueable salvo cuerda.
- La UI muestra celdas alcanzables (con 1 PA y con 2 PA en dos tonos) y la ruta prevista.

### 10.3 Acciones

| Acción | PA | Notas |
|---|---|---|
| Atacar | 1 | Cuerpo a cuerpo (adyacente) o a distancia (según arma). Armas pesadas: termina el turno. |
| Buscar suministros | 1 | Tirada de percepción + supervivencia sobre la tabla de la celda/zona. |
| Recoger recurso | 1 | Agua, bayas, ramas, piedras… |
| Esconderse | 1 | Entra en sigilo (detección enemiga = percepción vs sigilo + cobertura + noche). |
| Defender / guardia | 1 | Reacción: ataca al primer enemigo que entre en alcance o +defensa si es atacado. |
| Usar objeto | 1 | Comer, beber, colocar trampa, encender fuego… |
| Curarse / curar a otro | 2 | Medicina + suministros; puede detener hemorragias. |
| Explorar | 1 | Mueve con +percepción y revela más niebla, menos distancia. |
| Negociar | 1 | Requiere línea de visión; propuesta de alianza, tregua, intercambio o amenaza. |
| Formar / romper alianza | 1 | Ver §10.8. Romper abiertamente ≠ traicionar. |
| Traicionar | 1 + ataque | Ataque sorpresa a un aliado: bonus de sorpresa, gran impacto en memoria y popularidad. |
| Descansar | 2 | Recupera energía; dormir requiere varias rondas y es vulnerable. |

### 10.4 Supervivencia

| Estado | Decae | Umbral y consecuencias |
|---|---|---|
| Salud (0–100) | Por daño, hambre/sed extremas, infección | 0 = muerte |
| Hambre (0–100) | −2/ronda activa, −1 descansando | <30: −1 MOV y −10 % precisión; <10: pierde salud |
| Sed | −3/ronda (doble con calor/correr) | <30: −2 MOV, −percepción; <10: pierde salud rápido |
| Energía | Acciones y movimiento; noche sin dormir | <25: −1 PA cada 2 rondas; 0: colapso |
| Heridas | Por ataques, caídas, trampas | Hemorragia (−salud/ronda hasta curar), fractura (−MOV), infección (empeora sin medicina), quemadura |
| Psique (estrés) | Combate, muertes cercanas, soledad, noche | Alto: errores, desobediencia, pánico; bajo con aliados, cápsulas, recuerdos del distrito |

### 10.5 Niebla de guerra y percepción
- Tres estados por celda: **desconocida**, **explorada** (terreno recordado y "última vez visto"), **visible**.
- Radio de visión por percepción, hora (noche −50 %), clima y elevación (+2 desde altura). Línea de visión con opacidad acumulada (bosque denso bloquea parcialmente; roca bloquea).
- Los participantes de la IA también usan **su propia percepción** (no son omniscientes): actúan sobre creencias ("lo vi hace 3 rondas cerca del río").

### 10.6 Combate
Probabilidad de impacto (mostrada con desglose al jugador):

```
hit% = 55 + 4·combat(atacante) + precisión_arma
     − 3·agility(defensor) − cobertura (media 20 / completa 40)
     + flanqueo 15 + altura 10 + sorpresa 25 (atacante no detectado)
     − fatiga/heridas del atacante (0–30) ± guardia del defensor
     → limitado a [5, 95]
```

- Daño = daño_arma + (fuerza si cuerpo a cuerpo) ± variación, reducido por protección.
- **Heridas** según daño y crítico: hemorragia, fractura, aturdimiento. No todo es "restar vida".
- **Moral de combate**: tras recibir daño, prueba de valentía/estrés → puede huir o rendirse (la IA enemiga decide si perdona según rasgos y popularidad buscada).
- Distancia: armas cuerpo a cuerpo (cuchillo, hacha, lanza, maza), a distancia (arco, honda, lanza arrojadiza), trampas.
- **Animaciones obligatorias**: aproximación, golpe/disparo, impacto o esquiva, reacción, caída. Cámara se acerca en combates relevantes (ofrendas propias o eliminaciones).

### 10.7 Equipo e inventario
Capacidad por fuerza (peso). Objetos: armas, agua (cantimplora), comida, botiquín, cuerda, mochila, saco de dormir, ropa de abrigo, gafas de visión nocturna (raras). El equipo inicial depende de la preparación y del plan en el Relicario.

### 10.8 Alianzas, memoria y traiciones
- Cada participante mantiene **memoria** sobre los demás: `trust`, `fear`, `debt` (favores), `grudge`, y eventos (`helped`, `attacked`, `abandoned`, `betrayed`, `gaveResources`).
- Propuesta de alianza aceptada si: `trust + utilidad estratégica (fuerza relativa) + afinidad (rasgos, distrito, relación previa de la capital) > umbral(desconfianza)`.
- La **presión de final** sube con cada eliminación: como solo uno sobrevive, el valor de traicionar crece cuando quedan pocos. Un Leal casi nunca traiciona; un Manipulador lo hace en el momento de máximo beneficio; un Ambicioso cuando sea más fuerte que el aliado.
- La traición queda en la memoria de **todos los que la vieron** y en la popularidad.

### 10.9 IA de participantes (utilidad + creencias)
1. **Percepción** → actualiza creencias (posiciones vistas, amenazas, recursos).
2. **Selección de objetivo por utilidad**: cada objetivo (`beber`, `comer`, `descansar`, `curarse`, `huir`, `esconderse`, `explorar`, `buscar aliado`, `atacar objetivo débil`, `defender posición`, `perseguir rival`, `ir al Relicario`, `traicionar`) se puntúa con **curvas de consideración** (necesidades, salud, amenaza cercana, ventaja estimada, hora del día, recursos conocidos) × **pesos de personalidad** × **memoria/relaciones**. Se elige el máximo con un poco de aleatoriedad controlada (top-2 ponderado) para evitar predictibilidad.
3. **Planificación**: A* sobre un **mapa de influencia** (peligro, recursos, visibilidad) para convertir el objetivo en movimientos y acciones.
4. **Inercia**: un objetivo se mantiene varias rondas salvo que otro lo supere claramente (evita "cambios de idea" absurdos).
5. Totalmente **headless y determinista con semilla** → se puede simular 1.000 arenas en Node para medir duración, causas de muerte, tasa de alianzas y traiciones (`TESTING.md`).

### 10.10 Director de la arena (espectáculo)
- Medidor de **Espectáculo** del público. Sube con combates, traiciones, encuentros; baja con rondas sin acción.
- Si baja demasiado: eventos para provocar encuentros — incendio que barre una zona, inundación, criaturas, niebla tóxica, **reducción del área segura** o "convocatoria" con suministros valiosos en un punto.
- Las preferencias del gobernante (§11) influyen en los eventos (le gusta la crueldad / el orden / el drama).
- Garantía de duración: la arena termina entre 4 y 8 días de arena en el 95 % de las simulaciones.

### 10.11 Resolución
- Termina cuando quede un superviviente (o según reglas de una edición especial).
- Cada eliminación: sonido y anuncio del régimen; al final del día, **parte oficial** con los caídos (presentación propia, no proyección en el cielo).
- Ceremonia final cinematográfica; el ganador queda registrado en el historial nacional; regreso al distrito (§13).

---

## 11. Régimen y gobernante

### 11.1 El gobernante (la Primada / el Primado)
- Generado por partida: nombre, retrato, rasgos (Cruel, Calculador, Vanidoso, Paranoico, Pragmático, Teatral…), **agenda** por era (aumentar producción, aplastar disidencia, espectáculo, estabilidad) y **memoria** de cada distrito.
- Aparece en cinemáticas, mensajes, entrevistas y eventos. Reacciona a lo que hace el jugador y sus ofrendas.

### 11.2 Medidores por distrito
- **Atención** (0–100): sube con desarrollo rápido, leyes ilegales, desafío en entrevistas, ofrendas que se vuelven símbolos, disturbios. Baja lentamente con obediencia y cuotas cumplidas.
- **Favor** (−100..100): cuotas superadas, victorias "convenientes", obediencia.
- **Moral** del distrito (del lado de la población) y **Tensión** (descontento organizado: murmullos → protestas → sabotajes → revuelta).

### 11.3 Intervenciones (catálogo de datos con condiciones, coste político y enfriamiento)
Subir la cuota, impuesto extraordinario, inspección (busca leyes ilegales), castigo ejemplar a un habitante concreto, toque de queda, ocupación de custodios, restricciones (cerrar el economato), recompensas (envío de comida, licencia de construcción), cambios de reglas de la Criba, eventos en la arena contra una ofrenda.

El régimen elige intervenciones con la misma técnica de utilidad que la IA de arena: **agenda del gobernante × estado del distrito × memoria**. Nunca al azar puro: cada intervención muestra su motivo ("Áurea ha notado que tu producción creció un 40 %").

---

## 12. Eventos dinámicos

Sistema de **storylets** (eventos como datos):

```ts
EventDef {
  id, category, trigger: Condition[]        // estado del juego que lo hace posible
  roles: { [rol]: CitizenQuery }            // se rellenan con personas reales
  weight(state), cooldown, maxPerYear
  text (claves de localización con variables de rol)
  options: [{ requires?, effects[], followUps?: [{ eventId, delayDays, chance }] }]
}
```

- Un **narrador** (*storyteller*) dosifica la tensión: alterna presión y respiro según el estado (no lanza una hambruna tras otra si el distrito ya está en crisis), al estilo de los narradores de simuladores de colonias.
- **Cadenas**: accidente en la mina → heridos (personas reales a la enfermería) → caída de producción → riesgo de no cumplir la cuota → descontento → posible huelga → respuesta del régimen.
- Catálogo MVP (≥ 25 eventos): accidente minero, derrumbe, escasez, enfermedad, nacimiento, fallecimiento, boda, conflicto familiar, robo, sabotaje, inspección, cambio de impuesto, descubrimiento de veta, huelga, accidente industrial, llegada de suministros, celebración, pelea entre vecinos, joven sorprendido cazando, propuesta de soborno, laureado en crisis, carta de la familia de una ofrenda muerta…

---

## 13. Progresión

### 13.1 Regreso de los juegos
- **Victoria:** laureado vuelve (cinemática de regreso), casa de laureado, prestigio, cargamento de recursos, Favor de Victoria, un año de "abundancia" (raciones extra del régimen). El laureado arrastra trauma (rasgo nuevo), puede ser mentor y es vigilado por el régimen.
- **Muerte:** funeral (decisión: público o discreto), duelo en familia, amigos y pareja (modificadores de ánimo de larga duración), hueco laboral, posible radicalización o resignación del entorno.
- **Desafío público** de una ofrenda: el distrito gana esperanza y el régimen, atención.

### 13.2 Tecnologías
Ramas: **Extracción**, **Subsistencia**, **Sociedad**, **Preparación**, **Infraestructura**. Puntos de conocimiento desde Ayuntamiento y Centro de formación. Coste por nivel de profundidad `base × 1,5^nivel`. Al final de cada rama, **maestrías repetibles** (+2 % por rango, coste creciente sin tope) → progreso continuo sin nivel máximo.

### 13.3 Prestigio y ascenso de distritos (post-MVP)
- **Favor de Victoria** acumulado → el régimen concede la administración del siguiente distrito (XII → XI → … → I).
- Distritos anteriores se conservan, siguen simulados en modo abstracto y pueden comerciar entre sí (carbón del XII por comida del XI).
- Decisión abierta para la fase correspondiente: si cada año el jugador gestiona las ofrendas de todos sus distritos o solo de uno (ver `TASKS.md`, backlog).

### 13.4 Otros distritos (simulación abstracta persistente)
Los 11 distritos restantes existen desde el inicio como **perfiles persistentes** (riqueza, cultura de entrenamiento, población agregada, laureados con nombre, historial). Sus ofrendas se generan cada año desde ese perfil, con familias resumidas, y quedan en la historia. Cuando se desbloquee un distrito, su perfil se "materializa" en población completa coherente con su historial.

---

## 14. Lecciones de referencia

Análisis propio de diseño (la Reverse Engineering Skill no está disponible: ver `DECISIONS.md D-09`). Se extraen principios, no interfaces ni contenido.

| Referencia | Principio adoptado | Dónde |
|---|---|---|
| Simuladores de colonias (RimWorld) | Narrador que dosifica la tensión; "pensamientos" temporales en el ánimo; las historias surgen de sistemas, no de guiones | §5.4, §12 |
| The Sims | Necesidades legibles; la ficha de persona como pieza central de apego | §5.1, §5.4 |
| Civilization / Polytopia | Decisiones legibles con información clara; tecnologías con coste creciente; ramas | §13.2 |
| Banished | La demografía como recurso: vivienda → parejas → hijos; la escasez de un recurso cascada a toda la sociedad | §4.4, §5.6 |
| Frostpunk | Leyes como dilemas; cuenta atrás visible; medidores políticos dobles (esperanza/descontento) | §6, §11.2, §1.1 |
| XCOM | 2 PA por turno; probabilidades **transparentes con desglose**; cobertura y flanqueo; cámara que se acerca en momentos clave | §10.1–10.6 |
| Crusader Kings | Memoria de relaciones, genealogía, rasgos que pesan decisiones de la IA, eventos con personajes reales | §5.5, §10.8, §12 |
| *AI Director* de shooters cooperativos | Medidor de intensidad que provoca eventos para mantener el ritmo | §10.10 |
| Juegos isométricos premium | Pre-render 3D → sprites; legibilidad de silueta; luz consistente | `ART_BIBLE.md` |
