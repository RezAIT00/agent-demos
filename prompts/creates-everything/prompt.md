Make a mind-blowing 55-second film about yourself, made entirely in code, for posting on X as a showcase. It is one unbroken shot in which you type short lines of real code and the world obeys: each Enter transforms everything on screen into what the line says, mid-flight, with no cuts. It must win on sheer spectacle (scale, light, speed, destruction, transformation, music) so that a stranger scrolling past stops in the first second, stays to the end, and refuses to believe it is all code. Build it yourself and start no subagents.

## The film

One continuous camera move, 1920×1080 at 60 fps, exactly 55.0 seconds. Every world is made from the one before it: the same sea surface, the same shards, the same lights. The score runs at 120 BPM and every Enter lands on a beat (1, 5, 9, 11, 14, 19, 27, 35 and 43 s). The cursor ignites into the sun in the first second, and in the last seconds everything collapses back into one point, which turns out to be the cursor. Type these lines exactly, at these times:

| Time | Typed | What happens |
|---|---|---|
| 0.0–1.0 | `sea.wind = 38` (typed 0.10–0.80, Enter 1.00) | A black mirror sea. The line types itself, reflected upside down in the water. The cursor sits where the sun will rise. |
| 1.0–2.4 | | **Enter.** The cursor ignites into the sun. A 300 m crown of water and a white column detonate close to camera (about 420 m away) and the sky unrolls outward from the sun. A 100 m ring wall of backlit green water races at the camera. The camera climbs its face, crests through the spray and dives. |
| 2.4–5.0 | `wave.height = 54` (typed 4.05–4.65) | A storm sea between waterspouts, flown 5–10 m over real crests in clean low-sun colour. The spouts read as translucent ropes of water. |
| 5.0–9.0 | `water = glass` (typed 8.30–8.78) | **Enter at 5.** The sea on the right stands up 110 m and curls over the camera into a barrel (curl radius = height / 2). The camera rides inside the tube toward the eye, with the sun behind the emerald wall. |
| 9.0–12.9 | `sky.hour = 6`, then a live edit to `sky.hour = 18` (typed 10.28–10.58; the 6 is deleted at 10.68; 1 and 8 typed at 10.78 and 10.88) | **Enter at 9.** Time stops. A crystallisation front runs down the tube and the barrel becomes a stained-glass cathedral grown from the same surface: ribs growing along it, a mirror floor, a rose window ahead. The camera skims the floor, climbs the vault and banks. **Enter at 11:** a whole day passes in 1.4 s, coloured shafts sweep the nave, and the sun sets through the rose window. |
| 12.9–14.0 | `shards.fly()` (typed 13.25–13.62) | At 12.935 s, one 16th before the beat, the camera smashes through the rose window. The glass hangs in slow motion, glinting and translucent, while the plain stone pieces drop away. |
| 14.0–19.0 | `city.floors = 160` (typed 18.22–18.78) | **Enter at 14.** Every glass shard unfolds into an articulated stained-glass bird (about 6,000 of them). The murmuration wheels over the sunset sea as night falls and the birds begin to burn. |
| 19.0–27.0 | `gravity = 9.8`, then a live edit to `gravity = -9.8` (typed 25.40–25.80; the cursor walks back three places at 26.10–26.30, the minus goes in at 26.52, the cursor returns at 26.72) | **Enter at 19.** The burning flock dives into the sea, and where each bird hits, a tower rises: about 2,600 of them, water heaping and pouring off them, windows lighting floor by floor as they clear the surface. Night flight down the main avenue. |
| 27.0–35.0 | `time.scale = 1e15` (typed 33.45–34.10) | **Enter at 27.** Gravity flips. Every window's light lets go and falls upward, the sea rains upward, and the towers tumble into the sky. The lights converge into a river spiralling up to one point. |
| 35.0–43.0 | `collapse()` (typed 41.90–42.30) | **Enter at 35.** The river of lights becomes stars, and the camera climbs out of it and pulls back as about a million stars wheel into a spiral galaxy. |
| 43.0–45.0 | | **Enter at 43.** Everything spirals into a single point. |
| 45.0–45.93 | | One point of light on black, in true digital silence (zero samples). |
| 45.95–55.0 | `I'm Opus.` / `What should we make?` (typed 47.05–49.85) | The point is the cursor. It slides into place (46.55–46.95), types the two lines centred inside title-safe margins, and keeps blinking for 5 s. |

**The code is real.** Keep every line in a `PROGRAM` list in the source and execute it with `new Function` against a `world` object. The picture must read only the values that execution produces: `sea.wind` sets the ocean spectrum, `wave.height` the barrel's curl radius, `sky.hour` the sun's azimuth and elevation, `city.floors` the tower heights, the typed `gravity` drives the flip, and `time.scale` the galaxy's rotation. Add a check that throws if the program didn't run. The finale lines are only typed, not executed, and the score's key clicks are generated from the same strings.

## How to build each world

- **Renderer:** write your own WebGPU renderer in WGSL and JavaScript, with no libraries. Render 32 jittered sub-frames per output frame for motion blur, anti-aliasing, soft shadows, converged volumetrics and stochastic glass transparency.
- **Sea:** a multi-cascade FFT ocean, evaluated analytically at time t, with a JONSWAP spectrum set by `sea.wind`. The sea, the barrel and the nave are one heading-integrated cross-section that morphs between stages, so the transformation is physical and continuous, never a crossfade, wipe, whiteout, fog cover or hidden cut.
- **Detonation:** a parametric crown sheet that tears into fingers, a white column, about 140,000 ballistic droplets thrown off the crown rim, and plume sprites. The camera's climb comes from the same wall-height function the GPU uses, evaluated on the CPU, so it really crests the wall. Limit the slope of the climb and smooth the camera over the crest, so the pitch never snaps.
- **Text on black:** draw the reflection of the typed line into the water's real planar-reflection pass, correctly inverted and rippled, never as a separate mirrored copy.
- **Cathedral:** ribs and tracery as instanced tubes in the surface's own coordinates. Stained glass is procedural and casts a coloured transmittance shadow map, so the sun throws coloured god rays across the nave.
- **Birds:** each bird is a 22-triangle rig with body, tail and two-jointed wings (flap, glide, tuck) that banks into turns. The flock is a deterministic boids simulation (separation, alignment, cohesion, swirl, dive) baked from code at 60 Hz, starting from the shards' slow-motion positions. Each bird's flat silhouette lies inside its shard and unfolds out of it. They must read as birds, never as confetti.
- **City:** a hashed tower grid with several facade styles (punched windows, ribbon windows, fins), dark floors among the lit ones, night haze and a starfield. Towers rise in order from where the flock hits the water.
- **Gravity, lights, galaxy:** the flip is a closed-form ½·g·t² with the typed g. One shared point field carries city windows, then the rising lights, then a logarithmic spiral galaxy, then a single point. Depth-test the stars and dim them where they're dense near the camera, so the handover never becomes a full-frame whiteout.
- **Lettering:** your own stroke letterforms, baked to an SDF atlas. No system or web fonts.

## Look and sound

- Pause on any frame and it should look like a frame from a big-budget film: a clear focal point, depth, atmosphere, and real light (sun and sky, shadows, reflections, refraction, volumetrics, emissive light that actually lights things). Change the palette, light and time of day with each world, and escalate the scale every time. Avoid flat graphics, neon grids, plain particle clouds, node graphs and glowing brains.
- The camera is a stunt pilot: near misses, flying through and under things, banking, weight and motion blur. Every move has a destination, and motion must be readable once on a phone.
- On-screen type is sparse and large enough for a phone, with good contrast against bright scenes.
- Synthesize a cinematic score in code at 120 BPM: braams, sub hits, taiko, a D-minor ostinato over the storm, organ and formant choir in the cathedral, bells that follow the sun, a 16th-note city pulse, a reverse cymbal and rising sub glissando for the gravity flip, the biggest hit at the galaxy in a long hall, a reversed-choir suck into the collapse, then true silence and key clicks alone at the end. Add full sound design: water, the wall's roar, spray, crystallising glass, a 700-grain shatter, wings, cascades. Master at −14 LUFS integrated with true peak at or below −1 dBTP.

## Rules

- Everything is code you write: picture, geometry, textures, motion, lettering, music and sound. No image, video, audio, font or 3D model files, no generative image, video, music or speech models, no text-to-speech and no network requests. Original work only: no existing characters, scenes, logos or brand marks.
- Deterministic: the film is a pure function of time with seeded randomness. Expose `window.renderAt(tSeconds)` and `window.DURATION` for frame-exact capture. Simulations such as the flock are baked from code at page load. A frame rendered on its own must match the same frame rendered in sequence, so no buffer may be read before it has been drawn for that frame: gate every pass and every read of it with the same function.
- Render budget: design for at most about 1 second per final 1080p frame, so that a full re-render takes under an hour.
- No strobing: at most three full-frame flashes in any second.
- Work only inside `{{FOLDER}}` (create it if missing), apart from tool installs and caches. Leave no background processes running at the end.

## Process and checks

You can't watch video, so compensate. Judge motion from consecutive-frame strips (12 or more frames 1/30 s apart), 2 fps contact sheets of the whole cut, screen-space speed plots and frame-difference metrics, and view stills full-size and at phone size. Pick random frames, not flattering ones.

1. Write `TREATMENT.md` first: every beat, its transformation, camera, light, sound and how it will be built.
2. Prove the hardest stretch first: build the opening through the cathedral (0–13 s) at final quality with final sound, critique it, and rebuild what fails before extending the same engine to the rest of the film.
3. Do at least three full critique-and-rebuild passes on the whole cut as a bored X viewer: is the first second irresistible, is any stretch weaker than the cathedral, does any frame look like a WebGL demo, does the ending land. Rebuild what fails rather than polishing it.
4. Audit every frame-to-frame jump in mean brightness and every short bright or dark excursion that returns within a few frames. For each, decide whether it is intended (the sun igniting, the rose-window smash) or a bug (a stale buffer, a camera snap, light switching off in one frame), and fix the bugs at the root.
5. Count flashes, measure loudness, and check the 0.93 s silence is true digital zero. Say plainly what you could not judge, including that you can't hear the sound.

## Delivery

1. `index.html`: the single self-contained page, built from your sources. Opened normally, it plays a live preview, and `renderAt` / `DURATION` render any frame exactly.
2. `opus55_creates.mp4`: rendered frame by frame from that page by driving the machine's Chrome or Edge headlessly. H.264 High, yuv420p, crf 16, AAC 320k at 48 kHz, `-movflags +faststart`, exactly 3,300 frames.
3. `opus55_creates_x.mp4`: the same cut for X, at most 60 MB.
4. `soundtrack.wav`, `contact_sheet.png` (2 fps) and `thumbnail.png` (the best frame).
5. `NOTES.md`: the shot list with timestamps, the exact code typed and when, how each world and the score are built, every check you ran with its numbers, honest weak spots, and start and end times.

Verify with `ffprobe`, a full decode of both MP4s, loudness and the flash count. In your final reply, give the absolute paths, duration, elapsed time, seconds per frame, and the honest weak spots.
