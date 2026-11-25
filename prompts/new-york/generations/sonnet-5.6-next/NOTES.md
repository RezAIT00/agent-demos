# New York at Blue Hour: voxel diorama on a floating island

`new-york.html` is the whole piece. It is one file whose only external dependency is three.js **0.170.0** from jsDelivr, loaded through an import map. All geometry, textures, lighting and lettering are generated in code. Billboard and sign text is drawn on a canvas with system fonts (Impact, with Arial Black as fallback).

Open it normally to play the 12 s loop live. It also works from `file://`. Add `?render=1` to stop the live loop and expose `window.renderAt(t)`. `&ss=2` sets the supersampling factor and defaults to 2 in render mode.

## What is in the scene

- **Island:** a jittered outline with a voxel rock keel. It has soil, pale fractured stone, schist with mica streaks, stepped ledges and stalactite spikes. Roots hang under Central Park's west cut. Timber pilings are exposed under Brooklyn's streets, with warm work lamps behind them. Waterfalls pour over the front in broad ribbons and over the sides in thin ones, with spray and mist.
- **Geography:** a tapered Manhattan between the Hudson and the East River, with Battery Park and the round Castle Clinton fort at its southern tip. In front is the harbor wedge, with a compact Brooklyn shore and Liberty Island.
- **Statue of Liberty:** sculpted from signed-distance shapes on a 0.34-unit grid, with face, seven rays, torch, fluted robe, sash and tilted tablet. It stands on a stepped pedestal with a loggia inside an 11-point Fort Wood.
- **Empire State and Chrysler:** the Empire State has recessed window bands, setbacks, a floodlit crown and a mast. The Chrysler has seven nested arches with radiating triangular windows, eagle ornaments and a needle spire.
- **One World Trade Center:** a square base and eight true triangular glass facets, ending in a top square turned 45°, with lit creases and an antenna.
- **Brooklyn Bridge:** two masonry towers with paired pointed arches, dark reveals and pale archivolts. It has a cambered deck, trusses and a raised promenade that splits around each central pier. Four main cables carry necklace lamps, vertical hangers and diagonal stays. Behind it are DUMBO lofts, a cobbled street running under the Brooklyn masonry, a waterfront park and a carousel.
- **Times Square and Central Park:** the square has Broadway's diagonal, lit red steps, 26 animated billboard panels, a plaza and waiting cabs. The park has autumn canopy, curving paths, a lake and Bow Bridge with its reflection.
- **Life:** signalled traffic with cabs, cars and buses; about 500 pedestrians; two Staten Island Ferries and two water taxis with bow waves and V-wakes; gulls; rooftop and manhole steam; blinking beacons and buoys.

## Key techniques

- **Voxels:** a greedy mesher with 4-corner vertex ambient occlusion. The city uses 1-unit voxels; the landmarks and bridge use finer grids, some of them rotated. One `MeshStandardMaterial` patch reads a float palette texture and computes per-voxel colour variation, lit windows, facade glass, stone courses, planks and cobbles in the shader. Merged faces therefore keep their per-voxel detail.
- **Light and occlusion volume:** a 143×66×186 3D texture. It stores about 730 baked lamp, shopfront, billboard and floodlight splats, plus a sky-occlusion term gathered from voxel occupancy.
- **Lighting:** a low peach key light with 4096² PCF soft shadows, cool fill and under-light for the cliffs, two spotlights on Liberty, and an image-based environment generated from the sky.
- **Water:** planar reflection with an oblique clip plane. The shader adds looping waves and blocky chop, vertically smeared reflections, anisotropic lamp glints, shore foam from a distance field, flow at the falls, and wakes traced along each boat's recent route.
- **Post:** the scene renders to a 4× MSAA half-float target. A 13-tap mip-chain bloom follows, then ACES fitted tone mapping, sRGB, a light grade and static dither.
- **Sky:** two mappings of one gradient. The visible backdrop puts the peach horizon just behind the far rim. Reflections and the environment map use a true-horizon version.

## Determinism and the 12 s loop

`renderAt(t)` is a pure function of `t mod 12`. It has no clocks, no accumulated state and no temporal effects.

- **Camera:** azimuth is `9° + 20°·sin(2πt/12)`, a 40° sweep. A 4.5 % push-in peaks at t = 6. At load, the framing is solved so the rim, keel, falls, torch, spires and bridge stay inside the square for the whole orbit.
- **Everything else:** all periods divide 12 s.
- **Traffic:** an Intelligent Driver Model with signals runs once at load for many cycles. The converged trajectory of each spawn slot is then replayed every 12 s. A "don't block the box" rule keeps intersections clear. Cars start and end inside covered road portals.
- **Boats:** each route takes 24 s with two identical hulls 12 s apart, and starts and ends fully inside a roofed slip. Wake and cabin glow fade out on the way into the slip and back in on the way out.
- **Walkers:** they follow closed loops. Outfit colours repeat in step with each loop's 12 s advance.

## Render

```
cd <output folder>
node build.mjs
node tools/capture.mjs video --ss 2 --crf 16 --out new-york.mp4
```

`tools/capture.mjs` starts a local server on a random 4xxxx port and drives the installed Chrome through `playwright-core` (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`). It aborts if `WEBGL_debug_renderer_info` reports a software renderer. For each frame 0–359 it calls `renderAt(frame/30)` at 2160×2160, reads the pixels back and pipes them to ffmpeg. ffmpeg flips them, downsamples with Lanczos and encodes:
`libx264 -preset slow -profile:v high -crf 16 -pix_fmt yuv420p`, BT.709 tags, `-movflags +faststart -an`.

`tools/` needs `npm install` (playwright-core 1.49.1) if `node_modules` is removed. `src/` holds the modules that `build.mjs` joins into `new-york.html`.

## Verification

Results for the delivered files. The GPU was ANGLE (NVIDIA GeForce RTX 4070 Ti, D3D11) in headless Chrome 158, not a software renderer.

**Video (`ffprobe`)**
- H.264 High, 1080×1080, yuv420p, 30 fps.
- 360 frames, 12.000000 s, 18,111,586 bytes, CRF 16.
- BT.709 matrix, primaries and transfer, TV range.
- One video stream and no audio; `moov` comes before `mdat`.
- All 360 captured frames are unique.

**Determinism** (`node tools/capture.mjs verify`, 2160×2160 pixel hashes)
- Seeking to t = 3.7 twice, with other times rendered in between, gives identical pixels.
- A fresh browser session reproduces the same frame.
- `renderAt(12)` is identical to `renderAt(0)`.
- With the modulo disabled (`?nowrap=1`), t = 0 and t = 12 differ by at most 5/255 in any colour channel.
- Without the modulo, the mean frame step just before the seam is 7.243 and just after it is 7.248.

**Motion** (`node tools/analyze.mjs new-york.mp4`, run at 540 px)
- Mean frame steps around the seam: 5.473, 5.531, **5.625 (359→000)**, 5.509, 5.469.
- No local one-frame pops.
- 0.000 % of pixels reversed sharply on more than 40 frames, the check used for z-fighting.

**Frame review**
- Frames 0, 90, 180, 270 and 359 from the finished MP4, plus tiled frames on both sides of the seam.
- Close crops during the build of Liberty, the bridge arches and cables, both Midtown crowns, Times Square, the park roots, the Brooklyn pilings and the southern tip.
- `stills/` holds frames 0, 90, 180 and 270 extracted from the MP4.

**Traffic and clipping** (QA hooks on `window.__nyc`)
- 0 vehicle-to-vehicle overlaps across 120 sampled instants.
- All 20 lanes reach an exact 12 s steady state.
- 95–103 vehicles outside the portals, with 8–21 of them stopped at the eight sampled instants.
- 0 vehicle or boat hits against the voxel structures.

**Live playback**
- Opened from `file://`, the page was ready in about 8 s and ran at about 174 fps at 900×900 in headless Chrome on this GPU.
- No console errors or warnings. Normal vsync-limited playback in a visible window was not measured.

## Issues found during checks and fixed

- The first cliffs were hidden behind the waterfalls. The falls were narrowed and shortened and the keel deepened.
- From the camera, the bridge arches read as solid. The towers were slimmed and given dark reveals and pale archivolts.
- The Times Square plaza was hidden. A voxel sightline test found a road portal and nearby mid-rises in the way.
- Boat light reflections jumped sides in one frame. The motion script caught it.
- With the modulo disabled, t = 0 and t = 12 differed. Boat bobbing and per-hull shading seeds repeated every 24 s.
- The Midtown crowns clipped to white. Their emissive and floodlight levels were lowered.
- Three look-alike road portals blunted the southern tip. They were varied, and Castle Clinton was added.
- The first full encode lacked the BT.709 primaries and transfer tags. The capture script now sets them, and the video was rendered again.
- The overlap and collision sweeps found vehicles overlapping each other (78 hits), roads running through the bridge anchorage, a bridge portal and One WTC, and walkers inside a bridge caisson.

## Known limits

- One World Trade Center passes in front of part of Times Square for part of the orbit. This is parallax; the Empire State, Chrysler and torch stay separate.
- The collision sweep covers voxel structures and the One WTC base. It does not cover small props such as lamp posts or rails. Its two remaining hits are walkers brushing through orange tree canopy at the end of Bow Bridge; a voxel probe confirmed the material.
- Lettering uses installed fonts, so it can look slightly different on another operating system.
- Motion was checked by frame metrics and extracted frames, not by a person watching playback.

## Build time

**About 76 minutes** of wall-clock time, from creating the folder (2026-11-25 20:49 UTC) to the finished notes. This includes writing the code, test renders, two 1× draft encodes, the discarded first full-quality encode, the final encode (505 s) and verification.

## QA tools

- `node tools/capture.mjs stills --times 0,3,6 --ss 2` renders chosen moments into `dev/`.
- `node tools/capture.mjs verify` runs the determinism checks.
- `node tools/analyze.mjs new-york.mp4` measures the seam, pops and flicker.
- `node tools/live.mjs` tests ordinary `file://` playback.
- The page exposes its test hooks on `window.__nyc`: `sightline`, `collisions`, `overlaps` and `signals`. They do not affect rendering.
