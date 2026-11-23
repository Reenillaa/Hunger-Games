# ART_BIBLE — Biblia de dirección artística

> Responsabilidad: **identidad visual y sonora** y las reglas para producir assets coherentes.
> Cualquier asset nuevo se revisa contra este documento antes de entrar en el juego. La estrategia de producción aprobada/propuesta está en `DECISIONS.md D-02`.

---

## 1. Idea visual en una línea

**"Ceniza y oro."** Distritos de carbón, óxido y luz de lámpara; una capital de mármol, oro y luz fría que los observa. Toda la imagen del juego vive en la tensión entre esos dos mundos.

## 2. Principios

1. **Legibilidad antes que detalle.** Cada edificio, persona y objeto se reconoce por su silueta a zoom mínimo.
2. **Luz con intención.** La luz cuenta la historia: lámparas cálidas = vida del distrito; luz fría y blanca = poder; luz verde-gris = peligro en la arena.
3. **Desgaste creíble.** Nada nuevo ni limpio en los distritos: hollín, parches, madera reaprovechada, chapa oxidada.
4. **Un solo estilo.** Ningún asset entra si rompe la coherencia (iluminación, paleta, ángulo, grosor de detalle), aunque sea bonito por sí solo.
5. **Movimiento = información.** Humo indica producción; colas en el economato indican escasez; ventanas oscuras, viviendas vacías.

## 3. Proyección y especificaciones técnicas

| Parámetro | Valor |
|---|---|
| Proyección | Isométrica 2:1 (cámara ortográfica: rotación 45°, elevación 30°) |
| Tile base | 128 × 64 px a escala 1× (se producen a 2×: 256 × 128) |
| Altura de un nivel de elevación | 32 px a 1× |
| Personaje adulto (distrito) | ~72 px de alto a 1×; niños ~50 px |
| Direcciones de personajes | 8 |
| Luz principal | Arriba-izquierda de pantalla (noroeste), constante en todos los renders |
| Pases por sprite | Color (albedo + sombra suave horneada), normal map, máscara de emisión (ventanas, lámparas) |
| Formato | PNG en atlas por escena; 1× (calidad baja/media) y 2× (alta/retina) |
| Animación de personajes | 12 fps; idle 8 frames, caminar 8, correr 8, trabajar 8–12, atacar 6–8, herido 4, morir 8–10 |

## 4. Paletas

Las paletas se definen como **tokens** (también usados en la UI). Valores iniciales; se ajustarán con las primeras capturas reales.

### 4.1 Distrito XII — "Hollín"
| Uso | Color |
|---|---|
| Carbón profundo | `#16161A` |
| Hollín | `#2B2A2E` |
| Piedra húmeda | `#4A4D52` |
| Madera vieja | `#6B5443` |
| Óxido | `#8E4B2E` |
| Ocre de lámpara (luz) | `#E8A24A` |
| Musgo apagado | `#5C6B4A` |
| Cielo de ceniza | `#9AA0A6` |

Transformación visual con el progreso: se introducen más ocres, ventanas iluminadas, empedrado, verdes más vivos en huertos. El distrito **se ve** prosperar (y eso es lo que el régimen ve).

### 4.2 Áurea (capital) — "Mármol y oro"
Marfil `#EFE9DC`, oro `#C9A44C`, oro oscuro `#8C6B22`, azul de poder `#1F2A44`, blanco frío (luz) `#F4F7FF`, acento escarlata de ceremonia `#9C1C2B`. Arquitectura monumental, simétrica, escalinatas, estatuas, pantallas gigantes, multitudes con ropa extravagante.

### 4.3 Arena forestal — "Verde que acecha"
Verde bosque profundo `#1E3326`, musgo `#3E5B3A`, helecho `#6E8B4E`, agua `#2F5C63`, niebla `#A7B7B3`, sangre (uso muy medido) `#7A1E1E`, luz de atardecer `#E9B86B`. Niebla volumétrica falsa (capas de sprites + filtro), rayos de sol entre árboles, oscuridad densa de noche.

## 5. Escenarios

- **Distrito**: valle encajonado, bocaminas con castilletes de madera, vagonetas, casas adosadas de madera y chapa, chimeneas, plaza de tierra con un estrado del régimen, alambrada hacia el bosque, vía de tren. Actividad visible: mineros con lámpara, humo, ropa tendida, niños, custodios patrullando.
- **Arena**: ecosistema creíble: claro del Relicario, río con rocas, cuevas, árboles caídos, ruinas de una estación científica, lago. Debe invitar a explorar: siluetas misteriosas en la niebla explorada.
- **Capital**: escenas de presentación (andén, centro de entrenamiento, plató de entrevistas, avenida del desfile). Espectáculo frío y opresivo; contraste máximo con el distrito.

## 6. Personajes

- Proporciones realistas ligeramente estilizadas (cabeza ~1/7 del cuerpo), sin estética chibi ni caricatura.
- Variación por capas: tono de piel, pelo, ropa (colores de la paleta del distrito), accesorios (casco de minero, gorro, chal).
- **Las ofrendas** llevan en la arena el uniforme común con un detalle del distrito para reconocerlas a distancia; su color de selección en la UI es constante durante toda la partida.

### 6.1 Retratos (fichas)
- Sistema procedural de capas vectoriales en un único estilo: **ilustración plana con sombreado de dos tonos y trazo fino**, encuadre de busto 3/4.
- Capas: forma de cara, piel, ojos, cejas, nariz, boca, pelo, vello facial, arrugas por edad, cicatrices/suciedad, ropa, fondo de tono según el distrito.
- **Herencia genética**: los genes de retrato de los hijos mezclan los de los padres (se reconocen hermanos).
- Envejecimiento: el retrato se actualiza por tramos de edad.

## 7. Interfaz

Concepto: **"el libro de registro del distrito"** frente a **"la propaganda del régimen"**.

- Interfaz del jugador: papel oscuro envejecido, tinta, sellos, separadores finos, tipografía sobria. Densa en información pero ordenada.
- Mensajes del régimen: marfil y oro, simetría, sellos oficiales, tipografía monumental. Se reconocen al instante.
- Jerarquía: 1) estado crítico (cuenta atrás de la Criba, alertas), 2) recursos, 3) selección actual, 4) acciones contextuales. Nada más en pantalla por defecto.
- **Sin emojis.** Iconografía propia en SVG: rejilla de 24 px, trazo 1,5 px, terminaciones rectas, estilo "grabado/sello". Base posible: set propio + `game-icons.net` (CC BY 3.0, con atribución) adaptado al trazo común.
- Botones de tamaño mínimo 44 × 44 px en táctil; en escritorio más compactos. Sin botones gigantes sin criterio.

### 7.1 Tipografía (propuesta, todas con licencia OFL, alojadas en el propio repo)
- **Rótulos del distrito / títulos**: *Big Shoulders Display* (industrial, condensada).
- **Régimen / capital**: una serif monumental de alto contraste (*Cormorant* u otra a decidir en la Fase 2 con maquetas).
- **Texto de interfaz**: *IBM Plex Sans* (y *Plex Sans Condensed* para tablas).
- **Registros y datos**: *IBM Plex Mono*.

## 8. Efectos

Polvo de carbón, humo de chimeneas, ceniza flotando, lluvia, niebla por capas, chispas de fundición, luciérnagas en la arena de noche, bloom suave en la capital, viñeta y *grading* por escena, partículas de impacto en combate (no gore). Todos con versión reducida para calidad baja.

## 9. Audio (dirección)

- Distrito: ambiente de viento en el valle, martillos lejanos, vagonetas, campana del turno; música de cuerdas e instrumentos de viento sencillos, melancólica.
- Capital: orquesta grandilocuente, fanfarrias del régimen, público.
- Arena: silencio tenso, bosque vivo, percusión baja en peligro; tono propio de eliminación (no un cañonazo).
- Fuentes: CC0/CC-BY curadas con registro de licencias; pendiente de decisión en Fase 2 (posible composición propia).

## 10. Política de assets y licencias

1. Solo se aceptan assets **propios**, **CC0** o **CC-BY** (con atribución registrada). Nada con licencia NC, ND o "solo uso personal".
2. Cada asset externo se registra en `assets/LICENSES.md`: nombre, autor, URL, licencia, fecha, modificaciones.
3. Nada protegido por derechos de terceros: ni de la franquicia de referencia (D-01) ni de los juegos de referencia.
4. **Placeholder** = gris neutro con etiqueta "PLACEHOLDER" en desarrollo y listado en `TASKS.md`. Nunca se publica un placeholder como definitivo sin revisión explícita.
5. Imágenes generadas por IA: solo como moodboard o referencia interna, nunca como asset final sin revisión y sin verificar los términos de la herramienta.

## 11. Pipeline de producción (propuesta D-02)

```
Modelos CC0 / modelado por script (Blender bpy, headless)
   └─► escena estándar (cámara iso fija, luz fija, paleta de materiales del juego)
        └─► render por pases: color · normal · emisión  (8 direcciones para personajes)
             └─► empaquetado en atlas por escena (1× y 2×) + metadatos JSON (anclas, huellas)
                  └─► revisión contra esta biblia (checklist §12) ─► juego
```

Scripts en `tools/art/`; fuentes en `assets/src/`; resultados en `assets/build/` (no versionados si son regenerables, o con Git LFS si fuera necesario; decisión en Fase 2).

### 11.1 Lecciones del spike (Fase 1, `tools/art/spike_render.py`)

- Cámara: ortográfica, `ortho_scale = lado_px / (256/√2)` a escala 2×; azimut 45° desde +X/−Y; elevación 30°. Mapeo lógico: celda (cx, cy) ↔ mundo Blender (X = cx, Y = −cy).
- Normal map en espacio de cámara, convención OpenGL (+X derecha, +Y arriba, +Z hacia el espectador). En Cycles la Z de cámara apunta hacia dentro: hay que invertirla. Render con *view transform* `Raw` y sin denoiser.
- **Capas obligatorias** por sprite: albedo (solo luz ambiente y oclusión, sin sol), sombra (sprite aparte), emisión (aditiva, sin iluminar), normales.
- Margen de lienzo suficiente para que la sombra no se recorte.
- Coste medido: ~5 s por pase de un edificio 640 px; ~0,45 s por pase de un fotograma de personaje de 192 px (CPU, 48 muestras + denoiser).

## 12. Checklist de calidad de un asset

- [ ] Ángulo y escala correctos (rejilla de comprobación).
- [ ] Luz desde arriba-izquierda; sombra coherente.
- [ ] Colores dentro de la paleta de su escenario.
- [ ] Silueta legible a zoom 0,5×.
- [ ] Ancla y huella definidas en metadatos.
- [ ] Normal map y emisión generados (si aplica).
- [ ] Licencia registrada.
- [ ] Versión de calidad baja probada en móvil.
