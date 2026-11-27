# New York, built from nothing in Unreal Engine 5

Midtown Manhattan around **5th Avenue and 42nd Street**, generated entirely by code, with real weather
and a destruction sandbox of 95 tools. Every mesh, texture, material, effect, vehicle and sound was made
for this project. Nothing was downloaded: no Fab, Megascans, City Sample or MetaHuman assets, no
Starter Content, HDRIs, photos or recordings, and no generative models. The only engine content used is
engine features and plugins, plus the basic cube shape as a hidden physics proxy and for balloon strings
and a magnet cable.

## Opening the project

1. Open `NYC/NYC.uproject` with Unreal Engine **5.8.4**. The main level `/Game/NYC/Maps/NYC_Midtown`
   is the default map.
2. Press **Play** to fly through the city.

The compiled editor module is included in `NYC/Binaries`. To rebuild it, run `source\build_cpp.bat`
(Visual Studio 2026 with C++). Destruction builds Chaos Geometry Collections at runtime with
editor-only code, so it works in Play-in-Editor and in `-game` runs started from the editor binaries,
but it would not work in a packaged build.

## Keys in Play mode

| Keys | Action |
|---|---|
| W A S D, mouse, E / Q | fly and look, up / down |
| Shift, Z / X | fast, slower / faster flying |
| V | next viewpoint (5th Ave, library steps, 42nd St, Bryant Park, above the park, high over Midtown) |
| H | hide or show help |
| **P** | **pedestrians on / off** (the first destruction tool also clears them until you rebuild the city) |
| 1 – 9 | weather: clear day, golden hour, overcast, rain, thunderstorm, fog, snow, clear night, sunrise on snow (4 s transitions) |
| [ ] | time of day −/+ 30 min |
| , . · ; ' · - = · J K | rain, snowfall, cloud cover, wind −/+ |
| F · L · T · R | fog on/off, lightning strike, time-lapse, dry the streets (clear wetness and snow) |
| **Left mouse** | **use the selected destruction tool where the crosshair points** |
| **Mouse wheel** · PgUp / PgDn | **previous / next tool** · previous / next tier |
| **Tab** | **tool list: all 95 tools in 8 columns, one per tier; click one to take it** |
| **Backspace** | **rebuild the city** |

## The area, and what is accurate

**Accurate** (placed from real dimensions and coordinates):
- The street grid: real avenue spacing and widths, real block depth plus street width, 5th Avenue and
  42nd Street at the origin. Grid north is a true bearing of 29°.
- The sun: real solar position for the date and time at 40.7536° N, 73.9813° W, so sunsets, shadows and
  the December sunrise down the cross streets fall as they do in New York.
- Landmarks, modelled by hand in the generator at their real sites and heights: the New York Public
  Library with its two lions, steps and terrace; Bryant Park; Grand Central; the Chrysler Building; the
  Empire State Building; One Vanderbilt; the American Radiator Building; 500 Fifth; the Grace
  Building; the Bank of America Tower and 200 Park (shapes only, no logos); Chanin; Daily News; Tudor
  City; the UN Secretariat. Farther out are One World Trade Center, Woolworth, Flatiron, the MetLife
  clock tower, New York Life's gold pyramid, 30 Rockefeller Plaza, 432 Park, Central Park Tower,
  111 W 57th, Citigroup's sloped top and Hudson Yards. The East and Hudson rivers, Central Park,
  Queens, Brooklyn and New Jersey close the horizon.

**Invented or simplified:**
- Every ordinary building: each lot is filled by style (prewar brick, brick and stone lofts,
  brownstones, walk-ups, art deco setbacks, postwar slabs, ribbon-window and glass towers, cast iron).
  Their massing is plausible for the block but they are not the real buildings.
- All shop names, signs, banners, ads and vehicle liveries are invented. No real brands or companies.
- Details such as subway entrance positions, hydrants, trees, street furniture, scaffolding sheds,
  water towers and rooftop equipment are placed by rule, not surveyed.
- Interiors are interior-mapped (a shader fakes rooms behind glass). Real interior geometry appears
  only inside buildings that destruction opens up.
- The far boroughs and Central Park are simplified massing.

Counts: 2,284 detailed buildings (24 of them named landmarks), 35,425 distant buildings, 12,996 street
objects, about 400,000 mesh instances, 65 traffic lanes, 2,892 signal lamps and 2,120 pedestrians.

## How each part is built

- **Pipeline** (`source/pipeline.py`): Python in `venv` (numpy, scipy, pillow) generates meshes in
  my own binary `.nmesh` format, textures and a layout file. A C++ editor library turns these into
  Nanite meshes and instanced components, and Unreal Python builds the materials, level and
  sequences. `python source/pipeline.py gen cpp materials level` rebuilds everything.
- **Facades** (`source/gen/building.py`, `kits.py`, `landmarks.py`): modular bay-by-floor kits with
  real recesses, window frames, sills, lintels, cornices, AC units and fire escapes. Roofs carry
  bulkheads, wooden water towers and HVAC. Ground floors have invented storefronts, awnings and lit
  interiors; some blocks have scaffolding sheds.
- **Materials** (`source/ue/materials*.py`, `NYC/Shaders/*.ush`): custom HLSL material graphs for
  masonry, stone, metal, interior-mapped glass, asphalt with patches, cracks and worn paint,
  sidewalks, wetness and puddles with ripples, snow cover with slush tracks and footprints, signs,
  and lamps. Textures are procedural, generated in Python.
- **Streets**: curbs, sidewalks, crosswalks, bus lanes, manholes, grates, subway stairs, hydrants,
  mailboxes, news boxes, benches, shelters, trees (bare London planes in December), signals, street
  lamps, steam stacks.
- **Vehicles** (`source/gen/vehicles.py`, `NYCTraffic.cpp`): parametric lofted bodies for yellow
  cabs, sedans, SUVs, vans, buses and box trucks, with glass, interiors, turning wheels and working
  head, tail and brake lights. A C++ traffic simulation drives lanes with signal phases, car-following
  that keeps distance and stops at reds, and parked cars along the curbs. It is deterministic for
  renders.
- **People** (`NYCWalkers.cpp`, `Private/Walkers/`, `Shaders/Walker.ush`, `source/gen/walker_*.py`): the pedestrians
  were rebuilt in this pass by a second agent working in its own test project, then integrated here: 2,120 walkers
  with 16 bodies, procedural gait with planted feet, turning, waiting at crossing signals and umbrellas in rain, all a
  function of the weather clock so renders repeat. Film 1 was rendered with `nyc.Walkers.CameraHiding 1` (nobody
  within 9 m of a low camera), because faces and hands look like game characters closer than about 4 m. Play keeps the
  relaxed default (people fade only right at the lens). The walkers are not in the ray-tracing scene, so they do not
  appear in reflections. The replaced traffic files were kept beside the originals as `*.before_walkers` (not
  included in this copy).

- **Lighting**: Lumen hardware ray tracing (global illumination and reflections), MegaLights for the
  thousands of city lights, Sky Atmosphere, my own volumetric cloud material over a generated 128³
  Perlin–Worley noise volume, height and volumetric fog, and manual physically based exposure computed
  from the sun's elevation and the weather, with a canyon correction at street level.
- **Weather** (one actor, `NYCWeatherController`): time of day, cloud cover, storm, rain, snow, fog
  (low cloud that swallows tower tops), wetness, puddles, snow cover, wind and lightning, all
  continuous. It drives the sun, moon, sky, clouds, fog, exposure, a material parameter collection,
  city lights, window lights, GPU rain, snow, splashes and drips (my own instanced particles, lit by
  nearby lamps and headlights), and forked lightning bolts that light the sky and street.
- **Sound** (`source/sound/`): synthesized with numpy and scipy from noise, oscillators and filters.
  Film 1 is mixed from the shot timing, traffic positions (distance, Doppler-like pans) and lightning
  times, with thunder delayed by distance.
- **Destruction**: see `DESTRUCTION.md` (numbered list of all 95 tools and how each is built). The
  system is in `NYC/Source/NYC/Private/NYCDestruction*.cpp` and the tools in `NYCTools1..8*.cpp`.
  Its meshes come from `source/gen/destruct_fx.py` and its Niagara systems from
  `source/ue/niagara_build.py` (which needs the NiagaraToolsets plugin enabled while building).
  Sounds are synthesized by `source/sound/destruct_sounds.py` (122 distinct sounds).

## The films

### Film 1: `nyc_film.mp4` (the showcase)
86.5 s, one December day and night: clear afternoon → golden hour → sunset → overcast dusk → first
rain → night rain → thunderstorm → low cloud and fog → night snow → snow at first light on the library
lions → sunrise straight down 42nd Street → clear snowy morning.

- Movie Render Queue: 3840x2160, 24 fps, TSR, **4 temporal samples, 32 warm-up frames** (plus 32 engine warm-up), `r.VolumetricFog.GridPixelSize=4`, `r.Lumen.ScreenProbeGather.DownsampleFactor=8`, `nyc.Walkers.CameraHiding=1`. 2,076 frames in 798 s (0.34–0.43 s each); shot 2 was rendered again with 120 warm-up frames. All frames were scanned for missing, black or corrupt images: none. The first delivery used 8 samples and 64 warm-up frames.
- Encode (`source/tools/encode.py`): H.264 CRF 16, yuv420p, BT.709, +faststart, AAC 320k; the X copy is 1920x1080, two-pass 10 Mbit/s.
- Checks (`logs/verify_film1.json`): both files decode with no errors under `ffmpeg -v error`.
  - `nyc_film.mp4`: 439 MB, h264 3840x2160 yuv420p 24/1 fps, 40.28 Mbit/s video, 2076 frames, video 86.500 s / audio 86.500 s, -14.2 LUFS, true peak -1.3 dBTP, 0 clipped samples
  - `nyc_film_x.mp4`: 111 MB, h264 1920x1080 yuv420p 24/1 fps, 9.97 Mbit/s video, 2076 frames, video 86.500 s / audio 86.500 s, -14.2 LUFS, true peak -1.3 dBTP, 0 clipped samples
  - flash and flicker: frames 2076, seconds 86.5, whole frame flashes 11, worst flashes in one second 2, worst window frame 994, worst region "frame", flash limit ok true
- `stills/` holds 4K stills from the rendered frames; `contact_sheet.png` shows a frame every 3 s.

### Film 2: `nyc_destruction.mp4` (the destruction film)
83.7 s in 14 shots, smallest to biggest: firecrackers → sledgehammer → grenade → runaway garbage truck → wrecking
ball → gas main → controlled implosion → giant bowling ball → tornado → saucer death ray → pocket black hole →
great meteor → tactical nuclear warhead → asteroid. **No people appear in any shot.**

- Movie Render Queue playing back the recorded caches: 3840x2160, 24 fps, TSR, **4 temporal samples, 24 warm-up frames** (plus 32 engine warm-up), `r.VolumetricFog.GridPixelSize=4`, `r.Lumen.ScreenProbeGather.DownsampleFactor=8`. The record pass (960x540) took 10 minutes and the 4K pass 19 minutes (2,194 frames, 0.41–0.69 s each). All frames were scanned for missing, black or corrupt images (`source/tools/frame_check.py`): none. The first delivery used 8 samples and 48 warm-up frames; this pass cut them to meet the deadline.
- A showrunner actor fires real sandbox tools on each Level Sequence's clock (`source/film/destruction_data.py`).
  The record pass simulates and records Chaos caches; the final pass plays them back and simulates nothing.
  Fracture pieces and rigid bodies come from the caches; volumes, lights, gravel and camera shake are functions of
  the shot clock; Niagara sprites are re-simulated with fixed seeds. The sound mix places each synthesized sound as heard
  from the camera.
- Checks (`logs/verify_film2.json`): both files decode with no errors.
  - `nyc_destruction.mp4`: 526 MB, h264 3840x2160 yuv420p 24/1 fps, 49.90 Mbit/s video, 2009 frames, video 83.708 s / audio 83.708 s, -14.2 LUFS, true peak -1.7 dBTP, 0 clipped samples
  - `nyc_destruction_x.mp4`: 108 MB, h264 1920x1080 yuv420p 24/1 fps, 10.05 Mbit/s video, 2009 frames, video 83.708 s / audio 83.708 s, -14.2 LUFS, true peak -1.7 dBTP, 0 clipped samples
  - flash and flicker: frames 2009, seconds 83.71, whole frame flashes 0, worst flashes in one second 1, worst window frame 297, worst region "r00", flash limit ok true
  - the brightness check noted one 2 % step at frame 173, during the grenade shot (frames 146–227); it did not count it as a flash or a single-frame pop

## The destruction sandbox

All destruction uses Chaos. Buildings, vehicles and street objects break with material-aware
fracture; structure failure is simulated floor by floor, with falling mass damaging neighbours. Traffic
reacts to wrecks. The sandbox contains no aircraft and recreates no real attack or event.

**Audit:** `venv\Scripts\python.exe tools\destruction_audit.py` runs every tool on a freshly rebuilt
city in the game, checks that something broke and that the picture changed, saves before and after stills
to `stills/destruction/` and builds `destruction_sheet.png`. `stills/destruction/audit.json` holds the
numbers and any log problems.
Last full run: **95 of 95 tools passed**, none failed or crashed. One log problem: an engine ensure
(`bCouldComputeCell`, `Voronoi.cpp` line 180, while Chaos links fragment clusters) during the plasma cutter; the tool still
works. The audit ran before the last changes to the dust shader, small dust bursts, the walkers and the grade.

**Films and caches:** each destruction shot is first simulated while Chaos Cache Managers record every
geometry collection and rigid body into `/Game/NYC/Cache/CC_<shot>`. The final Movie Render Queue pass
simulates nothing: it reads those caches at exact times, so renders repeat frame for frame.
`source/render_destruction.py record` and then `play` do this. Three engine details mattered: cache
managers silently skip transient components, so debris is temporarily un-flagged when registered;
`MaxPhysicsDeltaTime` must be at least 1/24 s or recorded physics runs slow against the film; and volume
dithering had to be reseeded per temporal sample.

## Rebuilding everything from scratch

```
python -m venv venv && venv\Scripts\pip install numpy scipy pillow
venv\Scripts\python.exe source\pipeline.py gen cpp materials level
(Niagara: add NiagaraToolsets and ToolsetRegistry to NYC.uproject, start source\editor.ps1,
 venv\Scripts\python.exe source\ue_run.py niagara_build "run()" 900, remove them again)
venv\Scripts\python.exe source\sound\destruct_sounds.py
venv\Scripts\python.exe source\ue_run.py import_audio "run()"
venv\Scripts\python.exe source\ue_run.py materials_walkers "run()" 900
venv\Scripts\python.exe source\ue_run.py import_walkers "run()" 900
film 1:     source\render_film.py --build ... ; source\sound\film1_audio.py ; source\tools\encode.py
destruction film:  source\render_destruction.py record --build ; source\render_destruction.py play ;
            source\sound\destruction_audio.py ; source\tools\encode_destruction.py
```

## Second pass: before and after

The first delivery is kept for comparison in `build/before/` (both films, the stills and the destruction sheet).

### "Everything looks like cardboard"
- **Thick, broken pieces.** Before, a broken facade was a thin front skin with its backing 20–35 cm behind it, and
  tower shells were open 18 cm sheets. Now masonry is a solid body about 34 cm thick or more, shell walls are 38 cm (24 cm
  concrete) with closed rough edges, and floor slabs are 25 cm. Break lines are crooked. Broken faces show brick core
  with lime mortar, raw concrete with aggregate, or cracked plaster, and slabs and concrete walls have bent rebar.
- **Weight.** Real densities (masonry 1,950, concrete 2,350 kg/m³), almost no damping, big pieces turn slowly, window
  frames break bar by bar so that no invisible collision panel holds them upright. Every stony break also drops up to
  240 loose stones (9,000 live at most) that fall, bounce, skid and stay.
- **Chaos anchors** now do real work: after a local blow the rim of the struck bay stays in a wholly anchored
  collection (a lone anchored fragment is let go by Chaos when its cluster releases, so it needs its own collection).
- **Surfaces.** Per-building tone and roughness, drip streaks under sills, rain-wash stains, street splash grime,
  hairline cracks, pores and repair patches (shader work, not decal actors), 12 mm bevels on kit boxes, smears and
  sill dust on glass, haze and road film on car paint, deeper brick and stone relief.
- **Lighting and lens.** 32 cm sun contact shadows, a filmic grade with 8.5 % less
  saturation, cool shadows and warm highlights, a little more grain, corner chromatic aberration, hand-held camera in the
  destruction film's street shots, shallow focus where it fits.
- **Dust.** Darker earth-coloured dust, denser, folded into round billows with creases, heavier near the ground,
  four-step self-shadowing (three while playing) with a soft multiple-scattering share, and bounce light from the street. Small knocks give
  thin wisps.
- **The five biggest tools.** The fireball now rolls into a mushroom cloud with a stem, a turning vortex cap and a
  base surge. Added: a condensation ring, a brighter pressure dome with a band where it meets the city, a radial scorch
  decal, dust pouring along the real avenues and cross streets, and blocks laid over away from ground zero that stay
  down.

### The low-sun "z-fighting" (found, fixed)
It was not shadow acne: with shadows, virtual shadow maps, contact shadows and AO each switched off the stripes stayed,
and they vanished mostly with Lumen reflections off. Two causes:
1. **The sloped tower (Grace Building)** uses the flat distant-facade material. Its window grid was filtered with the
   pixel footprint clamped at a viewing angle far less grazing than the real one (about 88°), so it aliased into moiré,
   and it showed full-width mirror glass edge-on. Fix: an anisotropic pixel footprint from the true angle, window
   recesses that hide glass at grazing angles, and rougher glass edge-on (`Far.ush`).
2. **The ribbon-window block at the left edge** had near-mirror aluminium mullions standing 15 cm proud of the glass;
   each caught the sun as a one or two pixel slit. Fix: flush, satin anodized mullions on all window kits, and a
   roughness floor for metal as it shrinks toward a pixel (`kits.py`, `Surface.ush`).

`source/tools/shimmer.py` is the new flicker scan for small shimmer: it lines up neighbouring frames tile by tile,
drops tiles with fast motion, high-passes what is left over and scores the worst 2 % of tiles (8-bit levels, lower is
steadier). The old film and the new one, same frame windows:

| Window (12 consecutive frames) | before: worst 2 % | after: worst 2 % | before: mean | after: mean |
|---|---|---|---|---|
| S02 | 8.38 | 8.28 | 1.27 | 1.33 |
| S03 | 1.66 | 1.48 | 0.85 | 0.89 |
| S04 | 3.56 | 3.99 | 1.11 | 1.22 |
| S05 | 2.17 | 2.39 | 0.79 | 0.82 |
| S14 | 5.55 | 6.45 | 1.28 | 1.36 |
| S15 | 2.77 | 3.05 | 0.91 | 0.98 |
| S14 sloped tower | 2.93 | 2.48 | 1.46 | 1.05 |
| S14 ribbon block | 4.34 | 6.27 | 2.10 | 2.14 |

**What the numbers and the full-resolution consecutive crops show** (`build/shimmer/consecutive_tower.png`,
`consecutive_ribbon.png`):
- **Sloped tower: fixed.** The blazing diagonal stripes and moiré are gone. Faint, steady window bands remain. The
  region's mean score fell from 1.46 to 1.05.
- **Ribbon-window block: only partly fixed.** The long bright slits down every mullion are gone, but a row of short
  bright glints remains along the window heads. They hold their places from frame to frame, yet the scan scores that
  region worse than before (worst 2 % up from 4.34 to 6.27, mean about the same). I did not find their source.
- Several whole-frame windows (S04, S05, S14, S15) also score slightly higher than before, and S02 and S03 are about
  level. The new film has more grain and 4 temporal samples instead of 8, which both add frame-to-frame noise; I did not
  separate those effects from real shimmer, so I do not claim an overall improvement.

### People
- **No people in any destruction scene.** The first tool used clears the pedestrians (and skaters) until the city is
  rebuilt with Backspace. The destruction film and the audit never show them. **P** toggles pedestrians in Play.
- The walking-man icon on signals, the statues and the coat billboard are unchanged.
- Re-tested in Play after the new walkers were installed: people are there before a tool is used, gone after it,
  still gone after pressing P twice, and back after Backspace.

### Play-mode frame rate
`source/tools/perf.py`: the game offscreen in real time at 2560x1440, Epic scalability, frame cap and vsync off, on
the RTX 5090. Numbers are in `build/perf/before.json` and `after.json`.

| Scene (2560x1440) | before: avg fps | after: avg fps | before: p95 ms | after: p95 ms | before: p99 ms | after: p99 ms |
|---|---|---|---|---|---|---|
| 5th Avenue, day | 52.8 | 73.4 | 21.6 | 15.5 | 22.6 | 18.0 |
| 42nd Street, day | 58.2 | 73.3 | 19.6 | 15.2 | 20.4 | 16.0 |
| above Bryant Park | 67.3 | 84.1 | 16.9 | 14.4 | 17.7 | 15.8 |
| high over Midtown | 91.1 | 97.1 | 12.8 | 13.1 | 14.0 | 14.0 |
| library, night thunderstorm | 51.4 | 66.0 | 21.9 | 16.4 | 23.1 | 17.4 |
| Bryant Park, night snow | 52.8 | 70.9 | 21.8 | 16.1 | 24.6 | 17.9 |
| wrecking ball in use | 49.0 | 65.6 | 22.4 | 16.4 | 31.4 | 20.3 |
| gas main explosion | 51.7 | 57.2 | 21.4 | 22.2 | 39.4 | 29.5 |
| tactical nuke (whole 12 s) | 14.2 | 25.4 | 286.8 | 166.2 | 1155.0 | 368.4 |

- **Where it came from.** The render thread was the limit, not the GPU. The traffic moved 5,250 wheel and spray
  components one at a time every frame; wheels are now instances uploaded once a frame, with previous transforms for
  motion vectors. (Asking Unreal to rebuild an instance component's render state threw that motion history away and
  left speckled trails under cars, so changes are now sent as instance updates.) The destruction system also stopped
  searching 16,570 mesh groups by name for every felled building.
- **Big tools.** Far-off fragments are now simple solids (some collections had reached 3.9 million vertices), and while
  playing, a very large blast breaks into fewer pieces and is spread over several frames. Film takes keep full detail.
- **The 60 fps target is not fully met.** Flying with no destruction averaged above 60 fps in all six scenes, and so
  did the wrecking ball. The gas main averaged 57 fps, and the tactical nuke averaged 25 fps over its 12 s, with long
  hitches at detonation.
- **Caveats on the "after" run.** The walker agent's test game was running on the same GPU. The run was made before
  the new walkers, the final dust shader, the wheel motion vectors and the last debris fixes, and was not repeated.

### Delivery checks on the project
`source/tools/load_check.py` opened the finished project in a fresh editor on its default map and quit: it exited cleanly,
loaded `NYC_Midtown`, and logged no project, material or asset errors. The only `Failed to load` lines are the engine
looking for four profiler DLLs that are not installed (`logs/load_check.log`).

## Build time

One session, from 21:31 on 26 November to about 10:05 on 27 November (local time), roughly 12.5 hours of wall
clock. That includes the first delivery, the user's feedback pass, the renders, and waiting on them. The pedestrians'
replacement was built by a separate agent in its own folder.

## Weak spots (honest)

**Film 1: three weakest shots**
1. **Fifth Avenue to the Empire State (6.0 s).** The library front starts with a bright glow that settles in the first
   half second (the first delivery had it too; a longer warm-up and a lead-in did not remove it). The reflection on the
   dark glass tower reads as a blotchy gold mosaic.
2. **Rooftop at dusk (21–28 s).** A mostly empty roof, a blank party wall and a washed-out sky: it looks like a set.
3. **Fog takes the towers (57–62 s).** One fairly even veil. Real low cloud would be layered, with torn edges moving
   through the towers.

**City, general**
- Aerials show their construction: distant buildings are plain boxes, far windows form regular grids at night, and
  Queens, Brooklyn and New Jersey are low, repetitive massing.
- Sunrise down 42nd Street: the ribbon-window block at the far left still shows a row of bright glints along its window
  heads (the low-sun fix is only partial there). On the sloped tower the stripes are gone, but it now looks flat, with
  faint slanted window bands.
- Vehicles look smooth and toy-like up close, and street clutter is far sparser than real Midtown.
- Interiors are interior-mapped. Trees are bare and simpler than real London planes.
- The grade is moodier than the first delivery: canyon shade is deeper.
- The new walkers look right from a few metres out. Closer than about 4 m their faces and hands look like game
  characters, so the film keeps people at least 9 m from low cameras. They do not show up in reflections.

**Destruction: three weakest moments**
1. **Wrecking ball.** A five-tonne ball reads as a small hit: two dust clumps and little visible brickwork coming away.
2. **Sledgehammer.** The blows are small in frame, the dust shows as pale lumps, and little happens before the cut.
3. **Tornado.** A driven volume with soft streaks that reads as a column of dark smoke more than a funnel, with thin
   debris and little visible damage to the walls beside it.

**Destruction, general**
- Dust is ray-marched round volumes: heavier and self-shadowed now, but it does not flow round walls or through
  openings, and small puffs (death ray, black hole, grenade) can still read as separate pale lumps.
- Loose gravel ignores roofs and ledges: it always comes to rest at street level.
- Many large fragments still look like flat cartons, and the brick core on broken faces looks like neat brickwork.
- In the biggest blasts, distant buildings tip over as whole boxes and can pass through each other.
- Water (hydrant, flood, tsunami) is shaded meshes and sprites. Fire is volumes and embers and does not spread.
- Building failure is staged by a floor-by-floor structure solver; Chaos simulates the pieces.
- In Play, nuclear-class tools still hitch at detonation, and one engine ensure (Voronoi, fragment connectivity)
  was logged during the audit.
- On a few shots, indirect light settles over the first half second.

**Skipped in this pass, to meet the deadline**
- No new round of realism tweaks or critique passes after the final dust fix. The food cart was not added.
- The destruction audit (and so the destruction sheet) was not repeated after the last changes: the dust shader, small
  dust wisps, the new walkers and a softer grade. The frame-rate "after" run is older still (see above).
- The ribbon-window glints were not fixed.
- Both films were rendered at 4 temporal samples (first delivery: 8) with shorter warm-up.
