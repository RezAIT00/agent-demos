# NOTES: Opus 5.5 creates (full film, stage 2)

Stage 2 ran from 2026-11-25 17:07 to 18:26 local time. Stage 1 (the proof) ran 15:59–16:41. A fix pass (the 18.7 s pop, a lighting-pop audit and the new ending line) ran 19:08–19:31; see "Fix pass" at the end.

## Deliverables
- `opus55_creates.mp4`: 55.0 s, H.264 High yuv420p 1920×1080 60 fps, crf 16, AAC-LC 320 kb/s 48 kHz, faststart.
- `opus55_creates_x.mp4`: the same cut for X, two-pass H.264 at about 7.8 Mb/s, under 60 MB.
- `contact_sheet.png`: 2 fps, 110 frames.
- `thumbnail.png`: 1920×1080, rendered at 96 sub-frames.
- `soundtrack.wav`: 24-bit 48 kHz.
- `index.html`: live WebGPU renderer, which also exposes `renderAt` and `DURATION`.
- `proof.mp4`: stage 1, unchanged.

## Shot list (one unbroken shot)
| time | what you see |
|---|---|
| 0.00–1.00 | Black mirror water. `sea.wind = 38` types itself, reflected upside-down in the water. The cursor sits where the sun will rise. |
| 1.00 | **Enter.** The cursor ignites into the sun. A crown of water 300 m high and a white column burst from the point, and the sky unrolls outward from the sun. |
| 1.0–2.4 | A 100 m ring wall of backlit green water races at the camera. The camera climbs its face, crests through the spray and dives. |
| 2.4–5.0 | Storm sea between waterspouts, flown 5–10 m over real FFT crests; clean low-sun colour. `wave.height = 54` types at 4.05. |
| 5.00 | **Enter.** The sea on the right stands up 110 m and curls over the camera into a barrel. |
| 5.0–9.0 | Inside the barrel, sun behind the emerald wall; `water = glass` types at 8.3. |
| 9.00 | **Enter.** Time stops. A crystallisation front runs down the tube and the barrel becomes a stained-glass cathedral: same mesh, ribs growing along it. |
| 9.0–12.9 | Flight down the nave: floor skim, vault climb. Live edit at 10.28–10.88: `sky.hour = 6`, the 6 is deleted, then `1` and `8` are typed. |
| 11.00 | **Enter.** A whole day passes in 1.4 s. Coloured shafts sweep the nave and the sun sets through the rose window. |
| 12.935 | Smash through the rose (on the beat). |
| 12.9–14.0 | Slow-motion hang: translucent glass glinting in the sunset while the plain stone pieces drop away. `shards.fly()` types at 13.25. |
| 14.00 | **Enter.** 6,144 glass shards unfold into articulated stained-glass birds. A murmuration wheels over the sunset sea as night falls, and the birds begin to burn. |
| 19.00 | **Enter** `city.floors = 160`. The burning flock dives, and where the birds hit the sea, towers rise out of it, water heaping and pouring off them, windows lighting floor by floor. |
| 19.5–27.0 | Night flight down the avenue between 2,640 towers. Live edit at 25.4–26.72: `gravity = 9.8`; the cursor walks back three places and a minus goes in front of the 9. |
| 27.00 | **Enter.** Gravity flips: every window's light, the sea's water and finally the towers fall upward, converging into a river of light that spirals to one point. |
| 33.45 | `time.scale = 1e15` types. |
| 35.00 | **Enter.** The river of lights becomes stars. The camera climbs out of it and pulls back as 1.1M stars wheel into a spiral galaxy (37–43 s). |
| 43.00 | **Enter** `collapse()`. The galaxy spirals into a single point (43–45). |
| 45.00–45.93 | One point of light on black, in true digital silence (0.93 s of zero samples). |
| 45.95 | The point is the cursor. It slides into place and types `I'm Opus.` / `What should we make?` (47.05–49.85), then keeps blinking for 5 s. |

## The exact code typed
In `src/script.js` each line is executed with `new Function('world','glass','with(world){'+code+'}')`. The engine reads only the resulting values; a sanity check in the same file throws if the program did not run.

1. `sea.wind = 38`: typed 0.10–0.80, Enter 1.00. Sets the JONSWAP U10 (m/s) of the FFT ocean.
2. `wave.height = 54`: typed 4.05–4.65, Enter 5.00. The barrel's curl radius is 54/2 m.
3. `water = glass`: typed 8.30–8.78, Enter 9.00. Freeze; the barrel → nave stage.
4. `sky.hour = 6` → `sky.hour = 18`: typed 10.28–10.58, then the 6 is deleted (10.68) and 1 and 8 typed (10.78, 10.88). Enter 11.00. The sun's azimuth and elevation follow the hour.
5. `shards.fly()`: typed 13.25–13.62, Enter 14.00. Shards → birds.
6. `city.floors = 160`: typed 18.22–18.78, Enter 19.00. Tower height = floors × 3.6 m × a per-tower factor.
7. `gravity = 9.8` → `gravity = -9.8`: typed 25.40–25.80; the cursor walks back (26.10, 26.20, 26.30), the minus goes in (26.52), the cursor returns to the end (26.72). Enter 27.00. The lights, water, towers and camera follow ½·g·t² with the typed g.
8. `time.scale = 1e15`: typed 33.45–34.10, Enter 35.00. Galaxy rotation = (t − 35) × 1e15 / 1e15 rad.
9. `collapse()`: typed 41.90–42.30, Enter 43.00. Everything collapses into one point.
10. Finale, not executed, just typed: `I'm Opus.` / `What should we make?`, 47.05–49.85. The lines live in `FINALE.lines` in `src/script.js`; the score's key clicks are generated from the same string.

Every Enter is on a 120 BPM beat (1, 5, 9, 11, 14, 19, 27, 35, 43 s). The rose smash, 12.935 s, sits one 16th early on purpose, behind a 30 ms gate.

## What changed from the proof (the user's fix list)
1. **Opening, 0–4 s:**
   - Rebuilt the detonation at 420 m instead of 820 m. It now has a parametric 300 m crown sheet that tears into fingers, a white column, and 140k ballistic droplets torn off the crown rim.
   - The camera rides the ring wall: its height comes from the same wall function the GPU uses, evaluated on the CPU, so it crests the real wall.
   - Fixed a bug that shaded the wall as a mirror (it read as a cream veil).
   - The storm run now has clean colour: the sun was moved out of the lens, the brown storm veil removed, spray scattering cut, and the spouts lightened into translucent water ropes.
2. **Mirrored text:** the reflection is now drawn into the water's real planar-reflection pass, so it sits on the mirror sea correctly inverted and rippled.
3. **Birds:** each bird is a 22-triangle rig with body, tail and two-joint wings (flap, glide, tuck), banking into turns. The flock is a deterministic boids simulation (separation, alignment, cohesion, swirl, dive) baked at 60 Hz from the shards' slow-motion positions.
   - Shards → birds morph: the flat bird silhouette lies inside its shard and unfolds.
   - Non-bird shards fall away early, and the flying glass is rendered stochastically translucent with glints so it reads as glass, not confetti.
4. **Barrel mound and haze:** not specifically reworked; both are still faintly visible (see the weak spots).

## Critique passes on the whole cut (as a bored X viewer)
1. **Pass 1** (first full 2 fps sheet):
   - The opening was a cream whiteout for about 1 s; fixed the cause above.
   - The ocean run was sepia: sun moved off-lens, brown veil removed.
   - Galaxy birth was a full-frame whiteout (35–36 s): 1.1M additive stars passed through the camera. Fixed by depth-testing the stars, handing lanterns over only once the morph starts, and dimming stars by their density near the camera.
   - Bright ghost lantern copies removed.
2. **Pass 2:**
   - The city was a flat wall of uniformly lit windows: tower styles (punched, ribbon, fin), dark floors, fewer lit windows, night haze, a darker exposure, rivulets instead of white blotches.
   - The rising-towers road was cream: the foam and glow terms were cut back.
   - The cosmic camera looked above the galaxy and missed it; re-keyed to climb out of the river of light and pull back over the disc.
3. **Pass 3** (full-resolution random frames):
   - Double crown in the mirror pass.
   - Jagged "mountain range" ring wall: height noise halved.
   - Confetti shards: translucency and an early fall for the stone pieces.
   - Bird motion blur: shorter shutter, 0.26 frame, during the flock.
   - Mullion grid on facades softened.

## Checks (final file)
Run by `tools/finish.sh`:
- **Container and streams** (`ffprobe`):
  - `opus55_creates.mp4`: H.264 High, yuv420p, 1920×1080, 60/1, 55.000 s, 56.1 Mb/s, 388.1 MB; AAC-LC 48 kHz stereo, about 306 kb/s average (encoded at 320k). 3,300 frames with uniform 1/60 s timestamps across the splices.
  - `opus55_creates_x.mp4`: H.264 High, yuv420p, 1920×1080, 60/1, 55.000 s, 7.66 Mb/s, **54.5 MB**; AAC 256k.
- **Faststart:** moov before mdat in both files.
- **Decode:** a full `ffmpeg -v error -i … -f null -` decode passes on both files with no errors; 3,300 frames read from each.
- **Loudness** (EBU R128, measured on the muxed files): integrated **−14.1 LUFS**, true peak **−1.5 dBTP**, LRA 9.1 LU. `soundtrack.wav`: −14.1 LUFS, −1.6 dBTP.
- **Silence:** 44,641 consecutive zero samples (0.93 s) at 45.00–45.93 s.
- **Flashes** (`tools/flashcheck.py`; WCAG 2.3.1-style pairs of opposing ≥10% relative-luminance changes with the darker state below 0.8):
  - Whole frame: at most **1 flash in any 1 s** (the sun igniting at 1.0 s). Before the fix pass it was 2.
  - Worst 25% quarter: 2 in any 1 s (1.4–2.5 s). Before the fix pass it was 3.
  - Result: **PASS**.
  - The first full render failed this check: the camera dipped in and out of the shock wall at 1.7–2.4 s, giving 4–6 flashes a second. It was fixed (a slope-limited camera climb over a conservative wall bound) and the whole film re-rendered.
- **Motion and pops:** see the fix pass below. The stage 2 claim that there were "no pops elsewhere" was wrong: `tools/metrics.py` ranked mean frame differences and missed the 18.7 s pop and the 15.83 s step. `tools/lumapops.py` now checks every frame-to-frame mean-luma jump and every short excursion that returns.
- **Render cost:** final pass 0.201 s per 1080p frame at 32 sub-frames (3,300 frames in about 11 min while sharing the GPU). The thumbnail took 0.81 s at 96 sub-frames.

## Honest weak spots
- **Sound:**
  - I cannot hear it. It was balanced only by spectrum, short-term loudness per second and event timing in code. The choir and organ are additive synthesis and may sound synthetic.
  - The low end is heavy throughout (sub drones under every section).
  - There is no voice.
- **Motion:** I cannot watch video. Speed, nausea risk (the nave weave and the 2.0–2.7 s dive) and whether each metamorphosis reads in real time were judged from 1/60 s strips, 2 fps sheets and frame-difference metrics.
- **Opening, 1.5–2.7 s:**
  - The ring wall still reads partly as dark craggy ridges rather than water.
  - Around 1.6 s the near and far sides of the crown are both visible and can read as two fans.
  - The dive over the crest (about 2.0–2.6 s) is a motion-blurred downward view. Since the fix pass it pitches over in about 0.2 s instead of snapping, but it is still about half a second that is hard to read.
- **12.95–14.0 s:** the slow-motion glass hang is much less confetti-like than before (translucent glints, and the stone falls away), but in a still it is still a dense field of small flakes.
- **17.5–19.0 s:**
  - The night sea before the city is the lowest-energy stretch; the burning birds are small streaks.
  - "Birds dive in and towers rise where they hit" is not clearly legible at phone size.
- **City, 19–27 s:**
  - Towers are two-tier boxes with procedural window grids; there is no street-level detail.
  - About 6 s of corridor flight is visually similar throughout.
  - The live-edit type over bright facades (25–26.7 s) loses contrast.
- **35.6–36.6 s:** the lights → galaxy handover passes through about 1 s of dim grey star haze.
- **Galaxy:** points plus dust only; no volumetric nebulae, and the core is a bloom blob.
- **Not specifically reworked from the proof** (now at 5–12.9 s):
  - The barrel's landing mound at lower left is still faintly visible.
  - The nave's orange haze (now 9.8–10.9 s) is still faintly visible.
- **Birds:** articulated and flocking, but the nearest birds smear into coloured ribbons when they cross the lens.

## Engine and process
- Custom WebGPU renderer, about 2,500 lines of JS/WGSL in `src/`, inlined by `tools/build.mjs` into `index.html`. No libraries, assets or network: the capture harness's local server only serves the page and receives frames.
- `tools/cap.mjs` captures frame-exactly through headless Edge over CDP, now retrying a frame after reloading the page if a frame upload ever fails. That happened once (frame ~250 of the first final attempt), and the render was restarted from zero.
- `tools/score2.py` builds the score; `tools/flashcheck.py` and `tools/metrics.py` run the checks.
- Determinism: everything is a pure function of t. The flock is baked from code at page load (about 8 s). Re-rendered stills match the sequence frames (checked in stage 1 at 36–38 dB PSNR, H.264-limited).

## Fix pass (19:08–19:31)
### 1. The pop at 18.70–18.80 s
- **What you saw:** for 6 frames while `city.floors = 160` finished typing, the dark night sea showed the golden sunset reflection.
- **Root cause:** two gates for the planar-reflection buffer disagreed, and the buffer was stale.
  - The sea shader started mixing in the city reflection at `t - T_CITY >= -0.3`, i.e. 18.70 s (`cityK=step(-0.3,u.seg.y)` in `surface.wgsl`).
  - The pass that renders that buffer only started at `t > T_CITY - 0.2`, i.e. 18.80 s (`main.js`).
  - In between, the sea sampled the reflection texture as last written: in a sequential render, the last cathedral frame before the camera left the nave, about 13.18 s, i.e. the sunset.
  - It was also a determinism bug: a single frame rendered on its own at 18.75 s did not show the pop, because the buffer then held whatever that session had drawn last.
- **Fix:**
  - One function, `reflPass(w)` in `main.js`, decides whether the pass runs, and passes the answer to the shaders as `u.ext.x`.
  - Every read of `tRefl` (city sea, barrel floor, nave floor, birth mirror) is multiplied by it.
  - The city reflection now ramps in over 18.8–19.35 s instead of switching on.
  - The pass also now runs for the whole birth (`R < 9e4`), so the "unborn" mirror sea at 2.7–6.7 s reflects the live scene instead of the frame from 2.68 s.
- **Mean frame luma (0–255, 160×90 decode):**

| time | 18.67 | 18.68 | 18.70 | 18.72 | 18.73 | 18.75 | 18.77 | 18.78 | 18.80 | 18.82 | 18.83 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 37.0 | 37.0 | **52.3** | **62.2** | **62.8** | **63.5** | **64.2** | **64.9** | **55.1** | 37.6 | 38.0 |
| after | 37.0 | 37.0 | 37.4 | 37.8 | 38.0 | 38.4 | 38.8 | 39.4 | 39.5 | 39.5 | 39.8 |

### 2. Pop audit of the whole film (`tools/lumapops.py`: every jump >= 8 luma, every excursion >= 10 that returns within 12 frames)
| time | before → after | verdict |
|---|---|---|
| 1.00–1.08 | +31, +22, +21, +19, +11 (17 → 121), unchanged | **Intended**: Enter; the cursor ignites into the sun. |
| 1.60 | 91 → 110 in one frame → **removed** (102 → 118 smoothly) | **Bug**: camera pitch snapped 33° in one frame because velocity-pitch was hard-gated on at `t > 1.6`. Now faded in over 1.25–1.6 s. |
| 2.03 | 147 → 91 → 73 in two frames → **removed** (151 → 104 over 9 frames) | **Bug**: a 66° whip-pan as the camera's clearance cone flipped from climbing to diving at 170 m/s. The cone is now smoothed (Gaussian, 0.1 s), and pitch follows a ±0.18 s velocity. |
| 2.69 | 105 → 88 → 65 in two frames → **removed** (77–78 flat) | **Bug**: the same cone's foot. The camera's vertical speed jumped from 0 to −170 m/s; peak vertical acceleration fell from 8,883 to 1,230 m/s². |
| 12.95 | 93 → 120 → 122 → 114 → 107, unchanged | **Intended**: the camera breaks through the rose window into the open sunset on the beat, then exposure settles. |
| 15.83 | 89 → 70 in one frame, then stays → **removed** (89 → 86 smoothly) | **Bug**: the clouds' sunlight cut out in one frame. The sky's earth-shadow test treated "ray misses the earth" as "in shadow", so the clouds (lit by one sample at 4 km) lost the sun the moment it dropped below 2.03°. Fixed in `sunTc` (`sky.wgsl`). The clouds now keep a fading red light until the sun really sets for them (about 17.5 s). |
| 18.70–18.80 | the pop above → removed | **Bug**: fixed above. |
| 27.00 | 73 → 82, unchanged | **Intended**: the Enter on `gravity = -9.8`; the typed line flashes as it is sent (every Enter does this) on the hit. |
| 35.53–35.75 | 70 → 104 → 64 over about 14 frames, unchanged | **Intended**, not a pop: the camera climbs out through the densest part of the river of lights as they turn into stars. Smooth in a 1/30 s strip. |

- **Mean luma changed** only at 1.23–3.58 s (camera), 15.83–17.55 s (cloud light), 18.70–19.13 s (the bug) and 46.68–54.98 s (new text). Every other frame is within 0.6 luma of the approved cut.
- The camera path was dumped at 240 Hz before and after: it differs only inside 1.004–3.596 s; elsewhere it is identical to 5 decimals.

### 3. New ending line
- `FINALE.lines` in `src/script.js` is now `"I'm Opus."` / `"What should we make?"`. Same cursor, slide (46.55–46.95), typing window (47.05–49.85) and blink.
- Text size went from 0.066 to 0.055 of frame height so both lines sit inside title-safe:
  - Final frame: ink spans x 241–1666 (margins 12.6% / 13.2%). The line centres are within 11 px of frame centre.
  - With the blinking cursor lit, the right margin is 9.0%.
  - On a 390 px-wide phone the x-height is about 9 px.
- **Score:** `tools/score2.py` now reads the finale text from `src/script.js`, so the key clicks match the 29 typed characters.
  - It replays the old line's random draws into a scratch bus, so every later random draw (the reverb impulse responses) is unchanged.
  - The new `soundtrack.wav` is identical to the approved one up to 46.77 s; differences before 47.0 s are at most 1 LSB of 24-bit, from the zero-phase master filter. Still −14.1 LUFS, −1.6 dBTP.

### 4. How it was re-rendered (only what changed)
- Same settings as the master: 32 sub-frames, 1080p60, x264 slow crf 16, bt709.
- Only the keyframe-aligned GOP ranges containing changes were re-rendered: frames 0–466, 780–1179 and 2542–3299.
  - Each segment started from a warm-up of the 5 preceding frames, so the sky-dome cache matched the sequential render.
  - 1,625 frames at 0.10–0.18 s/frame.
- They were spliced by stream copy with the untouched GOPs 467–779 and 1180–2541; the concat decodes cleanly with uniform 1/60 s timestamps.
- Unchanged frames inside re-rendered segments match the original encode at 41–61 dB PSNR (codec-limited). The splice points show no luma steps beyond the scene's own motion (max 0.8, plus 8.2 at 13.0 s, which is the rose-smash decay already present).
- `opus55_creates_x.mp4` and `contact_sheet.png` were re-encoded from the new master. `thumbnail.png` (9.45 s) is unaffected and was kept. `index.html` was rebuilt from `src/`.
