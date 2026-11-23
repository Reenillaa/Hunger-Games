# GDD — Documento de diseño del juego

> Responsabilidad: **qué juego es y por qué**. Visión, pilares, bucles, estructura y alcance.
> El detalle numérico y las reglas de cada sistema están en `GAME_SYSTEMS.md`. La identidad visual, en `ART_BIBLE.md`.
> Nombres visibles: se usan los términos de trabajo del encargo; la propuesta de nombres originales está en `DECISIONS.md D-01` (glosario al final).

---

## 1. Concepto en una frase

**Gobiernas un distrito minero bajo un régimen que cada año se lleva a dos de tus jóvenes para un espectáculo mortal: construyes una sociedad que conoces persona a persona, sabiendo que no puedes elegir a quién perderás.**

## 2. Fantasía del jugador

No eres un dios ni un rey: eres **la administración local de un territorio oprimido**. Tienes poder sobre la economía y las normas del distrito, pero no sobre el régimen. Tu poder real es **preparar**: a la gente, a las familias, a los jóvenes, a la economía. Y cuando llega la competición, eres **el mentor** que guía a los suyos desde fuera.

## 3. Pilares de diseño

Cada sistema nuevo se valida contra estos cinco pilares. Si no sirve a ninguno, no entra.

1. **Cada persona importa.** Nadie es un número. Todo habitante tiene nombre, cara, familia, recuerdos y una historia que el juego recuerda.
2. **No eliges a quién pierdes, pero sí cómo te preparas.** La Criba es aleatoria; tu estrategia es invertir en *todos* los jóvenes, sabiendo que esa inversión compite con la economía.
3. **Todo está conectado.** Economía → bienestar → habilidades → Criba → preparación → arena → consecuencias en el distrito. Ninguna decisión vive aislada.
4. **El régimen observa.** Prosperar llama la atención; desafiar trae represalias; obedecer tiene un coste moral. La presión política es constante.
5. **La historia continúa.** Perder no acaba la partida. Las familias lloran, los vencedores vuelven cambiados, nacen nuevas generaciones y el año siguiente llega otra Criba.

## 4. Estructura del ciclo (bucle macro)

```
           ┌──────────────────────────────────────────────────────────────┐
           │                     UN AÑO DE JUEGO                          │
           ▼                                                              │
  ┌─────────────────┐   ┌──────────┐   ┌────────────────┐   ┌─────────┐  │
  │ DISTRITO        │──►│ CRIBA    │──►│ CAPITAL        │──►│ ARENA   │  │
  │ primavera-verano│   │ cinemát. │   │ 7 días         │   │ turnos  │  │
  │ gestión continua│   │ 2+ elegid│   │ decisiones     │   │ táctica │  │
  └─────────────────┘   └──────────┘   └────────────────┘   └────┬────┘  │
           ▲                                                      │       │
           │          ┌──────────────────────────────────┐        │       │
           └──────────│ REGRESO: duelo, laureado,         │◄───────┘       │
                      │ recompensas, represalias, otoño-  │────────────────┘
                      │ invierno de gestión               │
                      └──────────────────────────────────┘
```

- **Distrito (~70 % del tiempo de juego):** construir, producir, cumplir la cuota del régimen, cuidar a la población, gestionar eventos y leyes, preparar a los jóvenes.
- **Criba (2–3 min):** escena cinematográfica con la población real. Se eligen las ofrendas. Reacciones de sus familias.
- **Capital (~10–15 min):** siete días de decisiones: vestuario, entrenamiento, entrevistas, alianzas, mecenas.
- **Arena (~20–40 min):** estrategia por turnos con órdenes largas e interrupciones (D-05).
- **Regreso (2–5 min + consecuencias persistentes):** ceremonia, duelo o celebración, recompensas, reacción del régimen y de la población.

Mientras el jugador está en la capital y la arena, **el distrito sigue funcionando en piloto automático** con las órdenes vigentes. Al volver ve un resumen ("Durante tu ausencia: 1 nacimiento, accidente en la galería norte, la cuota se cumplió al 84 %").

## 5. Experiencia A — El distrito

**Sensación objetivo:** un pueblo minero pobre que *respira*. Humo de chimeneas, mineros entrando al turno con lámparas, niños en la escuela, colas en el economato, luces que se encienden al anochecer.

El jugador:
- Coloca y mejora edificios sobre un mapa isométrico con previsualización y zonas válidas.
- Asigna trabajadores (manual o automático por prioridades).
- Equilibra recursos: comida (escasa en el XII), madera, piedra, carbón (la exportación y la cuota), y más adelante metal, energía y material industrial.
- Promulga **leyes del distrito** (dilemas al estilo de presión política): trabajo juvenil en la mina, raciones, toque de queda propio, entrenamiento clandestino, mercado negro…
- Investiga tecnologías y especializa edificios.
- Atiende eventos con opciones y consecuencias encadenadas.
- Gestiona dos medidores políticos: **Moral del distrito** y **Atención del régimen**.

**Tensión central del distrito:** cada joven que entrena no trabaja; cada crédito invertido en el centro de formación no compra comida; cada mejora visible aumenta la atención del régimen y la cuota del año siguiente.

## 6. Experiencia B — Los juegos

**Sensación objetivo:** tensión, incertidumbre y apego. Conoces a tus dos ofrendas: sabes que la chica es hija de la enfermera y que el chico fue el mejor cazador furtivo del distrito. Sabes quién les espera en casa.

- **Capital:** decisiones con información incompleta. ¿Muestras las habilidades en la evaluación o las escondes para no ser objetivo? ¿Entrevista humilde o desafiante (el público te adora, la Primada te odia)?
- **Arena:** cuadrícula táctica con niebla de guerra, supervivencia (hambre, sed, energía, heridas, psique), combate con probabilidades transparentes, alianzas con memoria y traiciones motivadas, mecenas que envían cápsulas, y un **Director de la arena** que mantiene el espectáculo.

## 7. Conexiones entre sistemas (la columna vertebral)

| Desde | Hacia | Cómo |
|---|---|---|
| Economía | Población | Comida, vivienda y salud determinan ánimo, natalidad y mortalidad. |
| Población | Criba | Solo existen los jóvenes que el distrito ha criado; sus habilidades vienen de su vida (un hijo de minero tiene fuerza; uno de cazador furtivo, supervivencia). |
| Distrito | Preparación | Créditos y prestigio pagan vestuario; el centro de formación sube las habilidades base de *todos* los jóvenes; un laureado vivo actúa como mentor. |
| Preparación | Arena | Habilidades entrenadas, puntuación de evaluación, popularidad (mecenas), alianzas iniciales y equipo de salida. |
| Arena | Distrito | Victoria: laureado, prestigio, recursos, desbloqueos. Muerte: duelo familiar, caída de moral, posible ira o resignación. Actos de desafío: atención del régimen. |
| Régimen | Todo | Cuotas, impuestos, inspecciones, castigos, reglas especiales de Criba, eventos en la arena. |

## 8. Progresión a largo plazo

- **Sin nivel máximo arbitrario.** Progresión por tecnologías (con rangos de maestría repetibles de coste creciente), especializaciones de edificios, prestigio y generaciones.
- **Prestigio del distrito:** se gana con victorias, popularidad, producción y laureados vivos. Desbloquea opciones (vestuario, mentores, leyes, tecnologías).
- **Ascenso de distritos:** ganar unos juegos otorga **Favor de Victoria**; acumulado, el régimen te concede la administración del siguiente distrito (XII → XI → … → I). Los distritos anteriores **se conservan**: siguen simulándose (en modo abstracto cuando no los miras), comercian entre sí y se pueden mejorar. Diseño detallado en `GAME_SYSTEMS.md §12` (fuera del MVP).
- **Memoria histórica:** registro de cada Criba, cada ofrenda, cada muerte, cada laureado. Genealogías navegables.

## 9. Fracaso y dificultad

- **La partida no termina por perder unos juegos.**
- Sí existen estados críticos: hambruna, revuelta aplastada, ocupación de los custodios. Son situaciones muy duras de las que se puede salir (con coste), no pantallas de *game over*.
- Única derrota definitiva (opcional, configurable): población extinguida o "disolución del distrito" por el régimen tras rebelión fallida. Se debate en Fase 9.
- Niveles de dificultad = parámetros del narrador de eventos, de la severidad del régimen y de la IA de arena.

## 10. Tono y contenido

- Drama adulto, no gratuito. La violencia se muestra con peso, no con regodeo (sin gore explícito; elipsis y cámara para las muertes).
- Los participantes son adolescentes, como en el género: el tratamiento debe ser serio y respetuoso. Nada sexualizado.
- Humor negro solo en la propaganda del régimen y en la frivolidad de la capital (contraste).

## 11. Plataformas y sesiones

- Navegador de escritorio, navegador de iPhone/Android y PWA instalable.
- Sesiones cortas posibles en móvil (guardado automático en cada cambio de día y de fase).

## 12. Alcance del MVP

Ver `ROADMAP.md §MVP` y `DECISIONS.md D-06`.

## 13. Glosario (término de trabajo → propuesta original → identificador en código)

| Trabajo | Propuesta (D-01) | Código |
|---|---|---|
| Distrito 12 | Distrito XII · Veta Negra | `district` (`d12`) |
| Capital | Áurea | `capital` |
| Régimen | La Concordia | `regime` |
| Presidente | El Primado / La Primada | `ruler` |
| Cosecha | La Criba | `selection` |
| Participante / tributo | Ofrenda | `participant` |
| Vasallaje | Jubileo | `specialEdition` |
| Patrocinador | Mecenas | `patron` |
| Vencedor | Laureado | `laureate` |
| Agente del orden | Custodio | `warden` |
| Arena | Arena | `arena` |
| Suministro central | El Relicario | `arenaCache` |
