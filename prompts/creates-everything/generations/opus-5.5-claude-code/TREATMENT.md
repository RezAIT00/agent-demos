# OPUS 5.5 CREATES: treatment (as built)

**The film:** one unbroken 55 s shot, 1920×1080, 60 fps. A cursor types real code; on Enter the world turns into what the line says, mid-flight, with no cut. Each world is made from the one before it: the same sea sheet, the same shards, the same lights.

**The rhyme:** the cursor ignites into the sun in the first second. In the last seconds everything collapses back into one point, and that point is the cursor.

**The code is real:** every line on screen is a string in `src/script.js` (`PROGRAM`) that the engine executes with `new Function` against a `world` object. The picture reads only the values that execution produces. Every Enter lands on a beat of the 120 BPM score.

## Beats

| # | time | typed + executed | metamorphosis | camera | light | sound |
|---|---|---|---|---|---|---|
| 1 | 0.0–1.0 | `sea.wind = 38` | A black mirror sea reflects the line as it types itself. | locked | none | key clicks, sub drone, a 25 ms vacuum before Enter |
| 2 | 1.0–4.0 | (Enter 1.0) | The cursor ignites into the sun. A 300 m crown of water and a white column detonate under it, a 100 m ring wall races outward, and the sky is thrown open from the sun point. | launched at the wall, climbs its face, crests through the spray and dives | black → golden hour | braam, sub, taiko, the wall's roar, spray on the crest |
| 3 | 1.5–5.0 | (wind 38 drives a JONSWAP FFT sea) | Storm sea with waterspouts, run 5–10 m over real crests. | slalom between spouts, banking | low sun to the right, cumulonimbus towers | D-minor ostinato, wind, spout roars passing |
| 4 | 5.0–9.0 | `wave.height = 54` | The sea on the right stands up 110 m and curls into a barrel around the camera (curl radius = 54/2). | rides inside the tube toward the eye | the sun behind the wall: emerald transmission | wall roar, riser |
| 5 | 9.0–12.9 | `water = glass`, then the live edit `sky.hour = 6` → `18` | Time stops. A freeze front crystallises the barrel into a stained-glass cathedral: same mesh, ribs growing along it, mirror floor, rose window. Typing 18 over the 6 passes a whole day in 1.4 s: the shafts sweep the nave and the sun sets through the rose. | skims the floor, climbs the vault, banks, then a straight run at the rose | coloured shadow-mapped god rays | glass crystallising, organ and choir, bells following the sun, 30 ms gate |
| 6 | 12.9–19.0 | `shards.fly()` | The camera smashes through the rose. Glass hangs in slow motion; the plain stone falls away. On Enter each glass shard unfolds into a stained-glass bird (6,144 boids baked from code) and the flock wheels over the sunset sea as night falls and the birds start to burn. | slow-motion hang, then flies with the flock | sunset → blue hour → night | shatter (700 modal grains), wings, D-major pads |
| 7 | 19.0–27.0 | `city.floors = 160` | The burning flock dives into the sea, and **where each bird hits, a tower rises** (2,640 of them), pouring water, its windows lighting floor by floor as they clear the surface. | flies down the main avenue between the towers | tungsten windows, night haze, starfield | sub boom, rising rumble, cascades, 16th-note city pulse in C minor |
| 8 | 27.0–35.0 | `gravity = 9.8` → `-9.8` (live edit: the cursor walks back and a minus goes in) | **Gravity flips.** Every window's light lets go and falls upward, the sea rains upward and the towers tumble into the sky. The lights converge into a river spiralling up to one point. | rises with the city, pitched up into the stream | 422k lights, stars | reverse cymbal, rising sub glissando, choir, glass plucks |
| 9 | 35.0–43.0 | `time.scale = 1e15` | 10^15× faster: the river of lights becomes stars, and the stars wheel into a spiral galaxy (1.1M stars) as the camera pulls back across thousands of kilometres. | climbs out of the stream and pulls back above the disc | starlight, galactic core | the biggest hit, 30 Hz sub, cosmic pads in a 10 s hall |
| 10 | 43.0–45.0 | `collapse()` | Everything spirals into one point. | locked on the core | one white point | a 2 s suck, reversed choir |
| 11 | 45.0–45.95 | | **True digital silence; one point of light on black.** | | | 0.93 s of zero samples |
| 12 | 45.95–55.0 | `I'm Opus.` / `What should we make?` | The point is the blinking cursor. It slides into place, types the two lines, and keeps blinking for 5 s. | locked | black | key clicks in silence, one low D tail |

## How it is built

Everything is code, with no asset files. The renderer is custom WebGPU (WGSL), inlined into `index.html`. Capture is frame-exact: `renderAt(t)` / `DURATION`, seeded hashes, and 32 jittered sub-frames per frame give motion blur, anti-aliasing, soft shadows, converged volumetrics and stochastic glass transparency.

- **Sea:** a 4-cascade FFT ocean evaluated analytically at t, with the JONSWAP spectrum set by `sea.wind`.
- **The sheet:** one heading-integrated cross-section, `profile.js`. Stage 0 is the sea, stage 1 a barrel whose radius is `wave.height`/2, stage 2 the gothic nave.
- **Cathedral:** ribs and tracery are instanced tubes in the sheet's own (z, s) coordinates. Stained glass is procedural. The sun casts a coloured transmittance shadow map.
- **Crown:** a parametric torn sheet plus 140k ballistic droplets and plume sprites.
- **Spouts:** per-pixel marched rotating volumes.
- **Birds:** a 22-triangle articulated rig (body, tail, two-joint wings with flap, glide and tuck). The flock is a deterministic boids simulation baked at 60 Hz into a GPU buffer.
- **City:** a hashed tower grid, rising in order from where the flock hits the water. Water heaps and foams around each base, and windows switch on as their floor clears the surface.
- **Gravity, lights, galaxy:** the gravity flip is a closed-form `½gt²` with the typed value. One shared point field carries city windows → rising lights → logarithmic spiral galaxy → a single point.
- **Type:** stroke letterforms baked to an SDF.
- **Score:** `tools/score2.py` (numpy): additive braams and strings, formant choir, organ ranks, modal glass, synthetic convolution halls, look-ahead limiter. Mastered to −14 LUFS.
