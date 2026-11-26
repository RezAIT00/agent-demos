# ASHLAR — a world cut from stone and light

A photoreal take on the block sandbox, in one HTML file: `blockworld.html`.
Every texture, model, sound, cloud and star is generated in code. The only external dependency is
three.js 0.180.0 from jsdelivr, loaded through an import map (so the first load needs a network connection).

Open `blockworld.html` in a current Edge or Chrome. It needs WebGL 2 with float render targets.
`?preset=low|medium|high|ultra` picks a preset. `?demo=1` plays the film in real time (Space pauses).

## What is in it

- **World** — seeded and effectively endless: 16×16 chunks, 256 blocks tall, sea level 72. Continents,
  derivative-damped ridged mountains with snow caps and scree, meandering rivers that cut valleys, lakes, dunes,
  stepped mesas, layered rock strata, 11 biomes, caves, ravines, six ores, lava, cave pools, crystals, glowing fungi,
  rare grand caverns, villages. Oak, great oak, birch, blossom, pine, cypress and cactus, with tapered limbs.
- **84 block types**, 92 procedural material layers. Chests with hinged lids, swinging doors, kiln furnace,
  joiner's bench, ladders, slabs, torches, lamps, campfire.
- **Play** — survival and creative; walk, sprint, crouch (stops at ledges), jump, swim, climb, fly; health,
  hunger, fall, drowning, lava and cactus damage; death and respawn; mining with tool tiers (timber, stone,
  copper, iron, skyglass); 3 × 3 crafting with a recipe book; chests; smelting; searchable creative palette;
  item drops; falling sand; spreading water; day and night; clear, cloudy, rain, storm and snow weather;
  save and load (world edits, player, containers) in localStorage.
- **Creatures, all original** — Mossback (shaggy moss-backed grazer, herds), Plumehare, Reedstrider (wading
  bird); at night the Gloamstalker (ember-seamed hunter; crouches, brightens and hisses before it lunges) and the
  Hollow Lantern (floating stone hood; draws its shards in before it dashes). Skinned procedural meshes with
  shell fur, A* pathing, knockback, hit flash, burn-away death.
- **Sound** — synthesised WebAudio: footsteps per material, mining, placing, wind that rises with altitude, birds,
  crickets, frogs, water and surf, rain, thunder delayed by distance, cave drips, fire, lava, creature calls,
  generated convolution reverb that opens up in caves, muffling underwater.

## Controls

| Input | Action |
|---|---|
| W A S D / mouse | move / look |
| Space | jump, swim up, climb |
| Shift, or double-tap W | sprint |
| C or left Ctrl | crouch; descend while flying |
| F, or double-tap Space | fly (creative) |
| Left mouse | mine, attack |
| Right mouse | place, use, eat |
| Middle mouse | pick block (creative) |
| 1–9, mouse wheel | hotbar |
| E | inventory and crafting (creative: block palette) |
| Q | drop one item |
| J | cycle the weather |
| T (hold) | fast-forward time (creative) |
| F3 | debug overlay |
| F1 | hide HUD |
| Esc | pause: settings, controls, save |

Browsers may reserve Ctrl+W, so use **C** to crouch while walking forward.

## Key rendering techniques

**Materials.** Textures are synthesised in a pool of Web Workers (about 3–4 s) into three mipmapped,
anisotropic texture arrays: albedo + height, normal + roughness + AO, and emissive + metal + tint mask + alpha.
512 px per layer on High and Ultra, 256 px on Low and Medium. Hex (stochastic) tiling for natural ground,
two-sample offset blending for strata, world-space macro and micro variation, parallax occlusion mapping with
self-shadow, shader bevels that know which block edges are exposed, moss on north faces, snow by altitude,
rounded-trunk shading on bark.

**Geometry.** Chunks are generated, lit and meshed off the main thread: per-vertex voxel AO, flood-filled sky
light and **RGB** block light. Leaf voxels become clusters of alpha-tested cards with translucency; instanced grass
blades share a gust wind field. Tree limbs are tapered tubes, still one minable voxel each.

**Beyond the voxel radius** two rings of blocky level-of-detail terrain reach 1.7 km (High) or 2.4 km (Ultra), with
the same materials, alpha-tested canopy cards and the same water shader. A coarse height field casts
mountain-scale sun shadows. Past about 50 m, natural ground shades toward its true slope so stair steps do not
read as stripes. The voxels themselves are unchanged.

**Frame.** Deferred, half-float HDR: 4 cascaded shadow maps (texel-snapped, PCSS, staggered updates) plus
screen-space contact shadows → GTAO → raymarched volumetric clouds → lighting (GGX, spherical-harmonic sky
irradiance, bounce approximation, voxel light, up to 48 flickering point lights gated by voxel light so they do not
leak through walls) → screen-space reflections for wet and glossy surfaces → water and glass (Gerstner swell,
flow-mapped ripples, refraction with Beer–Lambert absorption, reflections, shoreline foam, caustics) →
raymarched shadowed fog with analytic glow around lamps and lava → particles → TAA with variance clipping →
metered auto exposure → 6-level bloom → lens flare → AgX tone map and per-hour grade → contrast-adaptive sharpen.
The sky is a Hillaire-style set of transmittance, multiple-scattering and sky-view LUTs, with limb-darkened sun,
textured moon, stars and a galaxy band.

## Where it differs from the letter of the brief

- **Alpha-to-coverage:** hardware A2C needs MSAA, which this deferred renderer does not use. Foliage uses
  coverage-preserving, dithered alpha testing, resolved over time by TAA (game) or by the sub-frames (film).
- **Ocean waves** are Gerstner waves plus scrolling normal maps, not an FFT simulation.
- **Bounce light** is an approximation: a biome-tinted ground-bounce term plus coloured voxel light, not traced GI.
- **Audio has not been judged by ear.** I cannot listen. See Testing for what was checked.

## The film (`?demo=1`)

`window.renderAt(t)` poses everything (camera, sun, clouds, weather, water, wind, foliage, creatures, particles,
lightning) from `t` alone and renders one output frame from 8 sub-frames: jittered for anti-aliasing and spread
over a 1/120 s shutter for motion blur, with lens-jitter depth of field on the meadow and storm shots.
Determinism: re-rendering a frame after rendering a different one gave 0 differing bytes (t = 8.0 s and 13.5 s,
checked just before the last world-generation fix). With the final `blockworld.html`, frames at 8.6 s and 23.6 s
rendered in a new browser session are pixel-identical to the stills saved during the final render.

Shots: sunrise over the sea and snow range (0–5.4 s) · meadow glide into canopy light shafts (5.4–10.8) · down a
sinkhole into a lava hall (10.8–16.4) · golden hour on rust dunes and mesas (16.4–20.9) · storm over a ruined
colonnade (20.9–25.8) · lamp-lit village under the galaxy (25.8–30).

**What is staged.** The film uses seed 4242 and the real game renderer, but it is art-directed. It adds set
pieces that normal worlds do not have at those spots: a carved dive tunnel (dressed with extra fungi and crystals)
and cavern, a placed great oak with clearings and trodden grass, the colonnade, and a guaranteed village. Creatures follow scripted paths. The cave has
three film-only soft fill lights that stand in for lava bounce. Eye adaptation is the metered exposure of each
frame multiplied by a keyframed curve, because live adaptation would depend on frame history.

### Exact render command

```
npm install                       # playwright-core 1.55.0 (drives the installed Edge)
node build.mjs                    # assembles src/ into blockworld.html
node tools/capture.mjs --from 0 --to 1800 --out blockworld.mp4 --ss 2 --spp 8 --crf 17 --png 3.2,8.6,15.2,18.9,23.6,29.4
node tools/capture.mjs --verify 8.0 --ss 2 --spp 8      # determinism check
```

Run from this folder. Needs Node, ffmpeg on PATH and Microsoft Edge. Edge runs headless with
`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --force_high_performance_gpu`; the script aborts if WebGL
reports a software renderer. It renders at 3840×2160, resolves to 1920×1080, posts raw frames to a local server
on a random 4xxxx port and pipes them into ffmpeg (libx264 High, CRF 17, yuv420p, bt709, +faststart, no audio).

### The delivered file (ffprobe, every frame decoded)

H.264 High, level 4.2 · 1920×1080 · 60 fps · 1800 frames · 30.000000 s · yuv420p (bt709, TV range) · CRF 17 ·
122,248,588 bytes (32.6 Mb/s) · `moov` before `mdat` (faststart) · no audio stream · no decode errors.
*(The `blockworld.mp4` in this repository is a two-pass re-encode of that master at 20 Mb/s, 75,069,616 bytes, with the same 1800 frames, because GitHub rejects files over 100 MB.)*
The final render took 27 minutes (about 0.90 s per frame) on an RTX 3090 that another job was also using when it
started.

**Frame review.** Frames were taken from the MP4 at the start, every 3 s and the end, plus both sides of every cut.
One known blemish: frame 0 is black with a faint orange lens flare, because the flare is added after the exposure
fade. The picture is fading in normally by 0.2 s. It was not re-rendered. Some platforms use frame 0 as the poster
image, so choose a thumbnail by hand (`stills/film_03.20s.png` works well).

**Edits after the render** affect gameplay only: a held torch now goes out under water, the hand is no longer a
black silhouette there, and the faint gameplay vignette was removed (vignette belongs to the film). The film sets
its own grade and never draws the first-person hand.

### Stills

`stills/film_*.png` are six frames saved straight from the final render. `stills/gameplay_mining.png` and
`stills/gameplay_village_dusk.png` are real in-game frames at High, 1920×1080, with the HUD, in **scripted
setups**: the player was teleported, the pack filled and the clock set. For the mining shot the script also placed
the stone blocks and two animals, and froze the game 69% of the way through the break so the fracture shows.

## Performance

Measured on an RTX 3090 and Ryzen 7 9700X in headless Edge with vsync and the frame cap off, High preset at
1920×1080. Another program used this GPU at times, which moves the numbers a lot.

| Situation | Result |
|---|---|
| Spawn meadow, standing, final world generation | 149 fps, 9.1 ms GPU time (GPU 55% busy just before the run) |
| Spawn meadow, standing, earlier build, quiet GPU | 163 fps, 5.3 ms GPU time |
| Spawn meadow with another program busy on the same GPU, build with the final tree limbs | 76 fps, 11.0 ms GPU time |
| Village at dusk and mining shot, with HUD | about 100–140 fps |
| Medium preset, one spot | 195 fps (earlier build) |

Low and Ultra were not benchmarked in live play.

**Streaming is not completely hitch-free.** Flying 475 m into new terrain at 24 m/s (over five times walking speed),
with another program using about 60% of the GPU: median frame 8.2 ms, 99th percentile 25.4 ms, **7 of 2,131 frames over
33 ms, worst 117 ms**. Standing still in the same run: median 6.9 ms, 99th percentile 25.9 ms, worst 31 ms. So the
long hitches come with streaming, while the frames just over 16.7 ms also happen when standing still. This was not
repeated on a quiet GPU, and walking pace was not measured separately.

## Testing

Scripts in `tools/t_*.mjs` drive the real game in headless Edge with real keyboard and mouse events. **No person has
played it.** The scripts use shortcuts to set scenes up: teleporting to flat test pads, setting the clock, granting
materials for some steps, and `?test=1`, which skips pointer lock (pointer lock was then checked separately).

- **Core loop through the real UI:** chop a tree, pick up logs, craft planks, craft and place a bench, open it,
  craft sticks and a timber pick.
- **Building and survival:** chest (stack moved in), furnace (iron smelted, block lights up), door opens, torch
  placed, stone mined with the pick; fall damage; death and respawn; save, page reload, then blocks, chest contents
  and inventory restored.
- **Movement and hazards:** walk 4.3 m/s, sprint 6.0–6.1 m/s with FOV kick, crouch 1.5 m/s, crouch stops at ledges,
  slab step-up, ladder, swimming, drowning, lava, eating, falling sand, water flowing into a broken wall.
- **A full night with natural spawning:** dusk to 06:06 on day 2. 18 hostiles appeared and 10 were killed; lowest
  health 17/20. The script aims perfectly, so a person will find it harder. The first run was far too soft (hits
  stun-locked creatures from outside their reach), which led to the poise, reach and spawn changes.
- **Film determinism:** byte-identical re-render.

**Pointer lock** was checked in a normal session without the test flag: the click captured the mouse, moving it
turned the view, Esc opened the pause menu, and Resume returned to play.

**Audio** was measured with an analyser on the final mix. Nobody has listened to it.

| Scene | RMS | Peak | Spectral centroid |
|---|---|---|---|
| Day, standing | 0.0061 | 0.034 | 713 Hz |
| Walking and jumping | 0.0058 | 0.069 | 814 Hz |
| Thunder | 0.032 | 0.364 | 444 Hz |
| Storm, rain and wind | 0.034 | 0.315 | 611 Hz |
| Night | 0.0029 | 0.016 | 418 Hz |
| Cave (state forced by the script) | 0.017 | 0.063 | 83 Hz |

The audio context runs, the signal changes with the situation, the reverb send rises to 0.5 in the cave and nothing
clips. Whether it **sounds** convincing is unknown. The quiet ambiences may want more level after a listen.

**Which build was tested.** The chop-and-craft and the building, combat, save and reload runs were repeated after
the last world-generation change. The movement, full-night, flight, palette, cave and settings runs were on earlier
builds. The edits made after those runs did not touch movement or combat code.

Bugs that testing caught and that are fixed include: chunk meshes being requested again while still pending (this
alone took the game from about 50 fps to 160+), the palette search box swallowing the E key, that soft night, and a
held torch that kept burning under water.

## Folder

- `blockworld.html` — the game (one file)
- `blockworld.mp4` — the film
- `stills/` — film frames and gameplay screenshots
- `src/`, `build.mjs` — sources the single file is assembled from
- `tools/` — capture, screenshot, play-test, texture-preview and profiling scripts (`fix*.mjs` are one-off
  patches already applied during development; do not run them again)

## Build time

Wall clock from 19:36 CST on 2026-11-25 to 23:48 CST: **about 4 h 12 min**.

That includes these gaps and repeats:

- an accidental stop of about 2 minutes (around 21:32–21:35);
- two provider connection errors, about 22:11–22:28 and 23:07–23:23 (about 33 minutes together);
- a first full render, started about 21:56 and abandoned at frame 960 to fix two world-generation flaws;
- the final 27-minute render (22:40–23:07).
