# New York at Blue Hour - voxel floating-island diorama

Deliverables in this folder:

- `new-york.html`: a single self-contained page. Its only external dependency is three.js **0.170.0** (core plus `examples/jsm` addons), loaded from jsDelivr through an import map. All geometry, textures, lighting, billboard graphics and lettering are generated in code.
- `new-york.mp4`: 1080x1080, 30 fps, 360 frames, 12.0 s, H.264 High, yuv420p, CRF 14, `+faststart`, silent.
- `stills/`: four PNGs extracted from the finished MP4 (frames 0, 90, 180 and 270, i.e. t = 0, 3, 6 and 9 s).
- `src/`: the readable source parts. `build.mjs` concatenates them into `new-york.html`. `render.mjs` is the capture harness.

## What was built

- **Island.** The island is a superellipse with a noisy outline. Manhattan is a tapered peninsula that comes to a point at the Battery, with the Hudson to the west and the East River to the east. The two rivers meet in a broad harbour wedge in the foreground. Brooklyn is a compact strip across the East River, and a palisade rim lines the New Jersey side. Liberty, Ellis and Governors Islands sit in the harbour.
  - Upper Manhattan rises 12 voxels onto a schist plateau. This keeps Central Park readable above the Midtown roofs from the harbour camera.
- **Strata.** The cliffs are layered voxel bands: weathered brown soil with roots, grey schist with mica glints, pale fractured stone with crack lines, a second schist band, an ochre band, then dark deep rock.
  - Each band is inset a little more than the one above it, which gives stepped ledges. Moss grows on the ledges and roots hang from the soil band, most densely under the park and the forested rim.
  - The underside is an inverted, ridged cone with stalactite spikes.
  - Dark timber pilings stand under the FDR/South Street deck and under every pier.
- **Water.** Harbour water spills over the front lip in five broad ribbons, separated by rim rocks. Thinner falls drop through notches in the side rims. Mist sits beneath the lip, and spray particles animate at it.
- **City.** About 750 procedural buildings stand on lots cut from real street plans:
  - a Midtown avenue/street grid with sidewalks;
  - a warped, irregular street net in Lower Manhattan;
  - Broadway cutting diagonally from Columbus Circle to the Battery.
  - Density steps from the Financial District towers, down through low-rise Village and SoHo, back up to the Midtown towers, then opens into Central Park.
  - Building styles are walk-up brick, prewar limestone, office ribbon windows, glass curtain wall, cast-iron, Brooklyn warehouses, brownstones and Art Deco banding.
  - Roofs carry water towers, bulkheads, vents, antennas with blinking lights, and steam stacks. Walk-ups have fire escapes. Lit windows, storefronts and street lamps fill the blocks.
  - Heights are capped around the landmarks to leave gaps and lower roofs.
- **Landmarks.** These use finer voxel grids.
  - *Empire State Building* (0.5-unit voxels): limestone shaft with vertical window bands and aluminium spines, stepped Art Deco setbacks, a floodlit upper shaft, a glowing tiered mast and a slim antenna.
  - *Chrysler Building* (0.5): white brick with dark corner banding, steel eagles at the setback, a seven-tier stainless crown built from intersecting arches with rows of lit triangular windows, and a needle spire.
  - *One World Trade Center* (0.25): a square podium, then a tower made from a square intersected with a shrinking diamond, which produces the eight tapered triangular glass facets. It has lit office floors, a glowing parapet and a slender spire.
  - *Statue of Liberty* (0.35, scaled 1.22): an SDF-sculpted copper figure with robe folds, a seven-ray crown, face, raised torch arm with a glowing flame, and the tablet. It stands on a granite pedestal inside the 11-point star of Fort Wood, lit by two floodlights. It faces the camera, so the face, torch and tablet read throughout the orbit.
  - *Brooklyn Bridge* (0.5): two Gothic stone towers with paired, pointed, see-through arches, recessed mouldings and coursed masonry. The deck has a roadway, a raised timber promenade and X-braced stiffening trusses. Vaulted anchorages and arched masonry approach viaducts carry it ashore. Four catenary main cables, about 400 vertical suspenders and 160 diagonal stays are instanced thin boxes, with amber necklace lights and deck lamps.
  - On the Brooklyn side: brick DUMBO warehouses with a clock tower, cobbled Washington St and Water St, Brooklyn Bridge Park with Jane's Carousel, sports piers and the Heights promenade.
- **Times Square.** Broadway becomes a pedestrian plaza between 42nd and 47th Streets. About 215 LED billboard panels use a generated canvas atlas of fake brands and lettering, crossfading between ads, and some scroll. One Times Square carries a billboard stack. The red TKTS steps sit at Duffy Square, with magenta and cyan colour spill.
- **Central Park.** An elongated plateau with layered autumn voxel canopies, curving paths, the Mall, Sheep Meadow, the Great Lawn, the Lake, the Pond and the Reservoir as still water, plus Bethesda Terrace, Belvedere Castle, schist outcrops and the pale arch of Bow Bridge.
- **Life.**
  - About 1,160 cabs, buses and cars. On the avenues, cross streets and Broadway they stop and go at signals; on the West Side Highway, the FDR, the bridge roadways and the Brooklyn and New Jersey roads they flow continuously.
  - About 780 pedestrians on the bridge promenade, the Times Square plaza, park paths and the esplanades.
  - Two orange Staten Island ferries and two yellow water taxis, with bow waves, V-shaped Kelvin wake arms and stern wash. Their lit cabins reflect in the water.
  - Gulls flap and glide above the piers. Steam rises from rooftops and Con Ed stacks. TV windows flicker and billboards change.

## Key techniques

- **Voxel mesher.** A custom dense-grid mesher culls hidden faces and bakes per-vertex ambient occlusion (classic 3-neighbour AO with quad-diagonal flipping). Albedo is stored in sRGB bytes so dark cliff detail survives. Per-vertex emissive, roughness, metalness and a window-style code are stored alongside.
- **Shader windows.** A patched `MeshStandardMaterial` draws sub-voxel windows procedurally: punched, ribbon, curtain wall, storefront, arched and vertical bands. Edges are anti-aliased with `fwidth`, unlit panes reflect the sky, and the lit windows carry the HDR emissive.
- **Water.** A `Reflector` planar reflection with a custom harbour shader. The wave normals are built only from integer-frequency temporal terms, so the surface loops exactly. Distortion is anisotropic, which stretches the city lights into broken vertical streaks. The shader also adds Fresnel, a shore-distance field for shallows and shore foam, and a sun glint. The park lakes are a separate env-reflective surface.
- **Sky.** A shader dome: a deep blue zenith, a peach band toward the west-north-west, lilac below, and streaky clouds. A brighter variant is baked into a PMREM environment for image-based light.
- **Lighting and post.**
  - A dim peach key from the afterglow direction, with soft PCF shadows from a 4096 shadow map, plus a cool fill and spotlights on Liberty and the bridge towers.
  - Fog for aerial depth.
  - Post-processing: `UnrealBloomPass` (restrained) and `OutputPass` with ACES Filmic tone mapping.
  - Anti-aliasing: 4x MSAA on a half-float composer target, plus 2x supersampling (2160 capture, downscaled with Lanczos to 1080).
- **Loop maths.** Every motion is a closed-form function of `t` with period 12 s.
  - Camera: azimuth = 13 deg + 18 deg x sin(2*pi*t/12), a 36 deg sweep that goes out and back. Elevation is 34 deg. A 5.5 % push-in peaks at t = 6. Position and velocity match exactly across the seam.
  - Signal traffic: vehicles hop one block per 6 s signal cycle, and queue patterns repeat every two blocks.
  - Highway and bridge traffic and pedestrians: tiled conveyors whose pattern shifts by whole tiles every 12 s. Route ends are hidden by a scale fade or happen off the island.
  - Ferries and taxis: two identical boats per closed loop with a 24 s period, half a loop apart, so they exactly swap places every 12 s.
  - Waterfalls, spray, mist, steam, waves, billboards, gull wings and aviation blinkers: all use integer frequencies or periodic noise.
- **Exact seeking.** `renderAt(t)` wraps `t` into [0, 12), poses the whole scene from `t` alone and renders exactly one frame. There are no clocks, no accumulated state and no runtime randomness; every build-time random value comes from a seeded generator.

## Verification

- The capture GPU is real hardware, checked with `WEBGL_debug_renderer_info`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti ... Direct3D11 vs_5_0 ps_5_0, D3D11)`, in headless Chrome with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`.
- `node render.mjs check`:
  - `renderAt(0)` and `renderAt(12)` produce **identical** pixel hashes.
  - Re-seeking t = 3 after rendering other times gives identical hashes. One pixel differed by 1/255 in 1 of 12 stress trials, which is GPU-level rounding, not scene state.
  - Camera position and velocity differ by 0.000000 across the seam.
  - Ferry A at t = 12 sits exactly where ferry B was at t = 0.
- In the encoded MP4, the PSNR of the step from frame 359 to frame 0 (23.97 dB) matches a normal step, frame 0 to frame 1 (24.03 dB). The loop has no visible jump.
- Frames 0, 90, 180, 270 and 359 were reviewed, along with close-ups of the Statue of Liberty, the bridge, Midtown, the Chrysler crown, Times Square and the cliff face. The torch stays against water or sky at both orbit extremes, the bridge cables read against the East River, and the ESB, Chrysler and One WTC crowns stay separate throughout the orbit.

## Exact render command

```
cd <output folder>
npm install --save-exact playwright-core@1.65.1   # once
node build.mjs                                   # src/* -> new-york.html
node render.mjs video --size 2160 --out new-york.mp4
```

`render.mjs video` does the following:

1. Serves the folder on a random 4xxxx port.
2. Launches the local Chrome through `playwright-core`.
3. Opens `new-york.html?render=1&size=2160` and waits for `window.__ready`.
4. Calls `renderAt(frame/30)` for frames 0-359 and captures each frame as a PNG over CDP.
5. Pipes the PNGs into:

```
ffmpeg -f image2pipe -framerate 30 -c:v png -i - \
  -vf "scale=1080:1080:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 14 -pix_fmt yuv420p \
  -r 30 -frames:v 360 -movflags +faststart -an new-york.mp4
```

The stills were extracted with `ffmpeg -i new-york.mp4 -vf "select=eq(n\,N)" -vsync 0 -frames:v 1 stills/frame_NNN.png`.

## Build time

- Started 2026-11-25 14:45:19 (UTC-6).
- Final video and stills finished at 16:09 (UTC-6).
- **Total about 1 h 24 min.**
- The in-browser scene build takes about 1.3 s. A 2160x2160 capture and encode of the 360-frame loop takes about 1 min.
