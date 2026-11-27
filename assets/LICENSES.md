# Registro de licencias de assets

> Política: `docs/ART_BIBLE.md §10`. Solo assets propios, CC0 o CC-BY (con atribución). Cada asset externo tiene una fila aquí.
> Las texturas fuente se descargan con `python3 tools/art/fetch_textures.py` (no se versionan); los sprites generados a partir de ellas sí.

| Uso | Asset | Autor / fuente | URL | Licencia | Modificaciones |
|---|---|---|---|---|---|
| texture `wood_siding` | WoodSiding008 | ambientCG | https://ambientcg.com/view?id=WoodSiding008 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `wood_beam` | WoodSiding006 | ambientCG | https://ambientcg.com/view?id=WoodSiding006 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `corrugated_rust` | CorrugatedSteel007C | ambientCG | https://ambientcg.com/view?id=CorrugatedSteel007C | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `corrugated_dark` | CorrugatedSteel009 | ambientCG | https://ambientcg.com/view?id=CorrugatedSteel009 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `stone_blocks` | Bricks108A | ambientCG | https://ambientcg.com/view?id=Bricks108A | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `rock_dark` | Rock058 | ambientCG | https://ambientcg.com/view?id=Rock058 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `rock_layered` | Rock051 | ambientCG | https://ambientcg.com/view?id=Rock051 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `dirt_coal` | Ground110 | ambientCG | https://ambientcg.com/view?id=Ground110 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `dirt_light` | Ground109 | ambientCG | https://ambientcg.com/view?id=Ground109 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `grass_patchy` | Grass004 | ambientCG | https://ambientcg.com/view?id=Grass004 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `grass_dry` | Ground037 | ambientCG | https://ambientcg.com/view?id=Ground037 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `gravel` | Gravel043 | ambientCG | https://ambientcg.com/view?id=Gravel043 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `cobble` | PavingStones151 | ambientCG | https://ambientcg.com/view?id=PavingStones151 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `roof_tar` | RoofingTiles013A | ambientCG | https://ambientcg.com/view?id=RoofingTiles013A | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| texture `metal_rust` | Metal064 | ambientCG | https://ambientcg.com/view?id=Metal064 | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |
| font (UI) | Inter (variable) | Rasmus Andersson · paquete `@fontsource-variable/inter@5.3.0` | https://github.com/rsms/inter | SIL OFL 1.1 | None |
| font (display) | Oswald (variable) | Vernon Adams et al. · `@fontsource-variable/oswald@5.3.0` | https://github.com/googlefonts/OswaldFont | SIL OFL 1.1 | None |
| font (map) | Cinzel (variable) | Natanael Gama · `@fontsource-variable/cinzel@5.3.0` | https://github.com/NDISCOVER/Cinzel | SIL OFL 1.1 | None |
| world map `public/assets/ui/worldmap*.jpg` | Mapa de La Concordia | Propio (`tools/art/render_world_map.py`, pintado procedural + Blender) | — | Propio | — |
| prop `poster_a`, `poster_b` | Carteles de propaganda | Propio (`tools/art/paint_posters.py`, tipografía Inter Display OFL) | — | Propio | — |
| sprites `farm`, `fishery`, `fruit_tree`, `boat`; terrenos `d11`, `d4` | Distritos 11 y 4 | Propio (`tools/art/render_district_assets.py`, `generate_district_templates.py`, `render_terrain.py --map`) | — | Propio (texturas CC0 ya registradas) | — |
| model `character-*` (people, guards, tributes, crowd) | Mini Characters 2.0 (GLB + textures) | Kenney (www.kenney.nl) | https://kenney.nl/assets/mini-characters | CC0 1.0 (`assets/models/kenney_mini-characters/License.txt`) | Rendered to isometric sprites; colours may be graded |
| model `horse` (parade) | Base Horse - Patricio Adalberto, «Horse SIMPLIFIED.fbx» (free tier) | Shyr | https://shyr.itch.io/horse | CC0 1.0 (asset page, checked 2026-11-27) | Rendered to plates/sprites; rig posed, geometry untouched |
| model `chariot` + horses (parade) | Ancient Horse Chariot (Mauryan era), GLB with gallop animation | EqualizerX (https://sketchfab.com/EqualizerX) | https://sketchfab.com/3d-models/ancient-horse-chariot-mauryan-era-4d23f8e14e3e4898ab4d0757735a331e | CC BY 4.0 — **attribution required** (also in the in-game credits) | Rendered with the game's cartoon materials and palette; geometry untouched |
| models `k_*` (trees, plants, rocks, crops, tents, campfire, canoe) | Nature Kit (GLB) | Kenney | https://kenney.nl/assets/nature-kit | CC0 1.0 (`assets/models/kenney_nature-kit/License.txt`) | Rendered to sprites; flat colours mapped to the game palette |
| models `k_*` (cart, stalls, lantern, fountain, hedge, banner) | Fantasy Town Kit 2.0 (GLB) | Kenney | https://kenney.nl/assets/fantasy-town-kit | CC0 1.0 | Rendered to sprites; matte finish |
| models `k_*` (barrel, crates, bucket, workbench, wood, signpost) | Survival Kit (GLB) | Kenney | https://kenney.nl/assets/survival-kit | CC0 1.0 | Rendered to sprites; matte finish |
| models `k_*` (coffin, graves, candles, bench, fire basket, lightpost) | Graveyard Kit 5.0 (GLB) | Kenney | https://kenney.nl/assets/graveyard-kit | CC0 1.0 | Rendered to sprites; matte finish |
| models (trains, carriages, tracks; not used yet) | Train Kit (GLB) | Kenney | https://kenney.nl/assets/train-kit | CC0 1.0 | — |
| models `k_market_*` | Mini Market 2.1 (GLB) | Kenney | https://kenney.nl/assets/mini-market | CC0 1.0 | Rendered to sprites; matte finish |
| sprites `house_shack__d*`, `house_terrace__d*` (L1–L3) | City Kit Suburban 2.0 (GLB) | Kenney | https://kenney.nl/assets/city-kit-suburban | CC0 1.0 (`assets/models/kenney_city-kit-suburban/License.txt`) | Rendered to isometric sprites per district; colour grade per district |
| sprites `warehouse__d*` and industrial props | City Kit Industrial (GLB) | Kenney | https://kenney.nl/assets/city-kit-industrial | CC0 1.0 (`assets/models/kenney_city-kit-industrial/License.txt`) | Rendered to isometric sprites per district |
| sprites `town_hall__d*`, `economato__d*` | City Kit Commercial (GLB) | Kenney | https://kenney.nl/assets/city-kit-commercial | CC0 1.0 (`assets/models/kenney_city-kit-commercial/License.txt`) | Rendered to isometric sprites per district |
