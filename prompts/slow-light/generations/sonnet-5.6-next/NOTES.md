# Slow Light — a street where c = 5 m/s

`slow-light.html` (single file, three.js 0.170.0 from jsdelivr) and `slow-light.mp4` (1080×1080, 30 fps, 20 s).
Open the HTML normally for live playback (click or press space to restart). `?render=1` exposes `window.renderAt(t)`.

## What is in the film
| time on screen | event |
|---|---|
| 0–2 s | Blue moonlit lane. The figure in the window reaches for the switch, seen about 2 s late. |
| 2.00 s | Hand flicks and bulb ignites together. At t = 2 s the camera is exactly 10.000 m from the bulb. |
| 2–9 s | The lit ellipsoid leaves the window, crosses the cobbles and climbs the café front. A warm shell shows in the mist. |
| ~4.5 s | **The bare bulb appears in the café mirror**, 2.5 s after the real one (22.5 m bounce path). |
| ~9.3 s | The old street lantern lights (green-white gas colour). |
| ~10.9 s | The neon coffee cup stutters on. Each stutter leaves the sign as a band of pink that travels across the wall. |
| ~13.9 s | The bulb goes out and darkness runs down the lane. Lantern and neon follow, each with its own front. |
| ~16.6 s | The bulb finally goes out **in the mirror**. Puddles and the mirror still hold the lit street after the street itself is dark. |
| 20 s | Moonlight again. |

## The physics: one law, applied everywhere
Each lamp has a single source-intensity function `I(τ)` of **emission** time (`lampProfile` in the shader).
Everything the camera shows evaluates it at `τ = t − pathLength / 5`:

- **Surfaces:** `|L−P| + |P−C|`. The lit region is the inside of an ellipsoid with the lamp and the camera as foci. `C` is the camera's current position. Aberration and Doppler are ignored, as specified.
- **Shadows:** cube shadow maps from each lamp with contact-hardening (PCSS) filtering. A shadowed point never receives the term at all.
- **Planar reflections** (puddles / wet stone on y = 0, and the café mirror): rendered from a mirrored virtual camera `C'` with the same shader. Since `|P−C'|` equals `|P→mirror| + |mirror→C|`, the same formula gives the exact bounce delay. Reflected mist and emitters follow automatically.
- **One-bounce fill:** 101 virtual point lights placed by ray-casting each lamp against rectangle proxies of the walls, ground and room. Each carries its own path `|L−Q| + |Q−P| + |P−C|`.
- **Mist:** `|L−X| + s` only ever increases along a view ray, so the lit part of a ray is exactly the interval between the darkness front and the light front. Both are solved in closed form: `s = (R² − |C−L|²) / (2(R + d·(C−L)))`. The steady part uses equiangular sampling. The shell is sampled uniformly **in path length** and mapped back to the ray, so it cannot band.
- **Emitters** (bulb, lantern glass, neon tubes): `|P−C| / 5`. **Window-pane glints:** `|L−X| + |X−C|`.
- **Objects** (figure, switch lever, cat, laundry, moths, drips, ripples) are posed at `t − distance / 5`. The cat turns its head only after the light has reached it.
- **Moonlight, sky and haze** are constant and never read the clock for lamp light.
- **Motion blur:** every frame averages 16 sub-frames spread over a 1/60 s shutter, so the fronts move smoothly.

### Measured, not assumed (`tools/audit.mjs`, results in `tools/audit-result.json`)
The renderer shows one lamp's direct light only, then binary-searches in time for the moment a given pixel switches on or off.
The result is compared with `t_switch + path / 5`, plus the point inside the 16–22 ms switching ramp where the threshold sits.
All 18 measurements (surfaces, laundry, a second lamp, the bulb in the mirror, a puddle bounce; both edges each) agree **within 10 ms**.
A frame is 33 ms. Selected rows:

| light path | length | predicted on / off | measured on / off |
|---|---|---|---|
| bulb seen directly | 10.00 / 9.62 m | 2.002 / 13.986 s | 1.992 / 13.976 s |
| foreground cobble | 14.37 / 14.69 m | 2.876 / 14.999 s | 2.876 / 14.998 s |
| café upper façade | 18.3 / 18.0 m | 3.658 / 15.656 s | 3.658 / 15.655 s |
| café tablecloth | 19.5 / 19.8 m | 3.912 / 16.022 s | 3.905 / 16.018 s |
| **bulb in the café mirror** | 22.55 / 22.73 m | 4.513 / 16.608 s | 4.503 / 16.599 s |
| lit surfaces seen in puddles (one probe per edge) | 24.20 / 24.52 m | 4.843 / 16.965 s | 4.842 / 16.962 s |

(On and off lengths differ because the camera moves between the two events.)
The same script re-renders frames out of order and confirms that the PNG bytes are identical.
For the ending, `tools/residual.mjs` subtracts a render in which no lamp ever switched on.
After the street has gone dark, what remains is the far lane, its puddle reflections and the café mirror.
At 19.97 s the average leftover outside the mirror is about 0.1 of an 8-bit level.
The mirror is last to fade (about 1.5 levels on average), because it shows long bounce paths over an extra leg.

## Where art direction bends strict physics (the timing and geometry are never bent)
- The lamp's emission includes a brief, whiter **ignition flare** (decay 42 ms, about 21 cm of path). This makes the soft warm-white edge. It is part of `I(τ)`, so every path shows it consistently.
- The mist **shell is brightened** with a gain that ramps up with the ellipsoid's size, and its distance falloff is flatter than inverse-square. Physically it would be nearly invisible. The ramp keeps the thin needle-shaped ellipsoid at 2.0 s from washing out the frame.
- Mist is thinner in a pocket around the camera. Direct-light falloff is softened very close to a lamp (`1/(d² + 0.22)`).
- The one-bounce virtual lights have no occlusion test, and their switching edge is widened (±90 ms) because each stands for an area. The audit times direct and mirrored light only.
- The lantern and neon switch off shortly after the bulb, so the street returns fully to moonlight.
- The neon uses one point light at the sign's centre for surfaces and mist; the visible tubes are timed point by point.

## Staging notes
- The café mirror is aimed by the law of reflection: its normal bisects the directions to the camera (at 4.45 s) and to the bulb. It hangs at that lean on two chains. A café window mullion was moved so that the sightline stays clear during the crane.
- The far end wall lies behind the plane of the lamp's own façade, so the bulb cannot light it directly. It gets bounce light, then the lantern.
- The bulb cannot be seen in a puddle from this camera (the reflection point falls below the frame). Puddles show the lit façades and the lantern.

## Techniques
Custom WebGL2 deferred renderer on three.js, with no downloaded assets.
- **Geometry:** all built in code. About 9,000 individually shaped cobble setts, walls with real openings and reveals, wrought iron, louvred shutters, tiled eaves, ivy, bottles and a bicycle. The cat and figure are surface-net meshes from signed distance functions, and the figure's arm uses two-bone IK.
- **Materials:** procedural weathered plaster with exposed brick, stone, timber, iron, old glass, wet stone with a tide line at each puddle, drip ripples, cloth, leaves and fur.
- **Finishing:** moon shadow map, screen-space ambient occlusion, night sky with stars and cloud, thin glass panes, bloom, ACES tone mapping, fine grain, and void-and-cluster blue-noise TPDF dither at the final 1080 px.
- **Supersampling:** 2160² internally, resolved in display-linear light to 1080².

## Render
```
cd tools && npm install            # playwright-core only
node build.mjs                     # src/*.js  ->  ../slow-light.html
node render.mjs                    # ../slow-light.mp4 + ../stills/
node audit.mjs                     # physics + determinism audit
```
Capture: `playwright-core` drives the installed Microsoft Edge, headless, with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`.
GPU reported by `WEBGL_debug_renderer_info`: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 … Direct3D11)`. SwiftShader is rejected by the script.
Frames are PNGs piped to ffmpeg: `libx264 -preset veryslow -crf 15 -profile:v high -pix_fmt yuv420p -x264-params aq-mode=3:deblock=-1,-1`, BT.709, `+faststart`, no audio.

## How long it took
- **Total build time:** about 50 minutes of wall-clock time (22:38:12 to 23:28) on 2026-11-25. This covers writing, look development, the audits and the renders.
- **Final render:** 600 frames in 167.7 s (about 0.25 s per frame including PNG transfer and x264 `veryslow`), on an RTX 5090 shared with three other renders.
- **Live mode:** about 56 fps in headless Edge, measured with one sample per frame.

## Delivered file (ffprobe)
H.264 High, 1080×1080, yuv420p, BT.709 (TV range), 30 fps, 600 frames, 20.000 s, 31,714,639 bytes (12.7 Mb/s), CRF 15, faststart, no audio.

## Sound
`slow-light-sound.mp4` is the same picture, stream-copied (identical video MD5), plus AAC from `audio/slow-light.wav` (48 kHz, stereo, 24-bit, 960,000 samples = 20.000 s).
The silent `slow-light.mp4` is unchanged. Everything is procedural synthesis in `audio/synth.mjs`: seeded, with no samples, voices or generative models.

### Two rules, both from the film's physics
- **Street sounds travel at 343 m/s** from the place they happen: `heard = event time + distance to camera / 343`. You hear them long before you see them. They are panned from the moving camera and get first bounces off the film's wall planes and wet ground, plus a short lane reverb.
- **The score voices the light**, which travels at 5 m/s. Each hit starts on the first video frame that shows its event. Those frames were measured from the pixels of `slow-light.mp4` (`measure_picture.py`) and agree with `switch time + path / 5` to within one frame.

### Cue sheet
Frame = for the score, the first frame that shows the event; for street sounds, the frame on screen when you hear it.

| time (s) | frame | sound | kind / timing |
|---|---|---|---|
| 0–20 | all | City hush, downpipe trickle, open-fifth moonlight drone (D, A, E). Constant, like the moonlight. | bed |
| 0.028 | 0 | **Switch clicks ON** | street; the bulb is seen 1.97 s later |
| 0.029–12.079 | | Bare filament hum, 100 Hz and harmonics | street |
| **2.000** | **60** | **Bulb seen:** warm bloom (sub D, soft struck D–A–F♯) | score |
| 2.000–20 | 60– | **Warm D-major swell.** Loudness follows the share of the scene inside the bulb's ellipsoid, puddle and mirror paths included. Voices join as it spreads (the F♯ arrives with the light), and the stereo image opens from the lamp outwards. It drains with the darkness front. | score |
| **4.500** | **135** | **The same bulb appears in the café mirror:** glass shimmer | score |
| 6.442 | 193 | Street lamp catches: soft gas "fwup", then a faint hiss | street; seen 2.82 s later |
| 8.535 | 256 | **Neon relay and transformer buzz, stuttering in the shader's own pattern** (re-strikes 8.710, 8.920, 9.030) | street; the same stutter is seen 2.35 s later |
| **9.267** | **278** | **Street lamp seen:** small soft bell (C♯), plus a quiet C♯/G♯ layer that follows its lit area | score |
| **10.867** | **326** | **Neon seen:** soft tone (B) that stutters with the sign on screen, plus a B/F♯ layer | score |
| 12.077 | 362 | **Switch clicks OFF** | street; darkness is seen 1.90 s later |
| 12.335 | 370 | Neon buzz cuts out with a tick | street; seen 2.35 s later |
| 12.462 | 373 | Street lamp gas puffs out | street; seen 2.82 s later |
| **14.000** | **420** | **Bulb seen to go dark:** low drop and falling breath | score |
| **14.700** | **441** | Neon seen to go dark: tone falls | score |
| **15.300** | **459** | Street lamp seen to go dark: bell falls | score |
| **16.633** | **499** | **The bulb finally goes out in the mirror:** last glass note | score |

Also running:
- **Drips:** 125 impacts from the film's own 13-source drip schedule. Water gets a bubble "plink" and stone a splat. Three sources with splashes in view lead (28 hits) and the other ten sit far back, so it reads as a gutter rather than rain. Each is heard 0.8–3.5 s before its ripple is seen.
- **Moths:** wing-beats at each moth's flap rate, panned along its path. They come forward as they close on a lamp and settle after it goes out. Glass taps are at 3.429, 5.969, 6.889, 8.149, 10.049 and 11.829 s.
- **Front air:** soft noise that follows the moving fronts across the stereo field, brighter for light and lower for darkness.

### Exact commands (run from the demo folder)
```
node audio/extract-cues.mjs      # film code + renderer -> audio/cues.json   (headless Edge on the GPU)
python audio/measure_picture.py  # pixels of slow-light.mp4 -> audio/picture-events.json
node audio/synth.mjs             # -> audio/slow-light.wav + audio/cue-sheet.json   (--stems, --no-drips: diagnostics into audio/_work/)
ffmpeg -i slow-light.mp4 -i audio/slow-light.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart slow-light-sound.mp4
python audio/verify.py           # every check below -> audio/verify-report.json and the three images
```
`verify.py` makes the two requested images with:
```
ffmpeg -i audio/slow-light.wav -lavfi "showspectrumpic=s=1800x900:mode=combined:scale=log:fscale=log:start=30:stop=12000:color=intensity:drange=96:legend=1" audio/spectrogram.png
ffmpeg -i audio/slow-light.wav -filter_complex "showwavespic=s=1800x500:split_channels=1:colors=0x7fc8ff|0xffc27f:scale=lin" -frames:v 1 audio/waveform.png
ffmpeg -i slow-light-sound.mp4 -af ebur128=peak=true -f null -
ffprobe -v error -show_streams -show_format slow-light-sound.mp4
```
It also writes `audio/alignment.png`: cue lines over the spectrogram, the waveform and the film's lit-area curves.
Needs: Node 24, Python 3 with NumPy and Pillow, ffmpeg 9, and Edge (cue extraction only). `extract-cues.mjs` reuses `tools/node_modules`.
It adds a read-only export line to a temporary copy of the HTML; the delivered HTML is not modified.

### Measured (2026-11-26)
- **File:** H.264 1080×1080, 30 fps, 600 frames, plus AAC-LC 48 kHz stereo (about 194 kb/s). Both streams 20.000 s; 32,215,763 bytes.
- **Loudness:** MP4 −16.1 LUFS integrated, −1.9 dBTP, LRA 10.9 LU. WAV −16.0 LUFS, −1.9 dBTP. Limiter gain reduction peaks at 2.7 dB. 12 ms fade in, 0.55 s fade out.
- **Health:** no samples at full scale and no unexplained transients. `silencedetect` (−55 dB, 0.1 s) finds no gaps.
- **AAC against WAV:** 0 samples of offset.
- **Score hits:** all 8 are on their measured picture frames, and their audio onsets are within 2.8 ms (WAV and decoded MP4).
- **Neon stutter**, pattern-fitted: buzz in the MP4 audio 8.534 s (−1 ms), tone 10.885 s (+1 ms), sign in the MP4 picture 10.883 s (−1 ms). You hear it 2.349 s before you see it.
- **Swell:** chord-band amplitude against the lit share of the scene, 2.75–18 s: r = 0.96.
- **Weaker single-onset readings:** neon start −11 ms (a small 3 dB step) and gas catch −5 ms (5 dB).
  The neon cut reads −12 ms in the WAV and +28 ms in the MP4, because it is mostly a level *drop* and drips are nearby.
  With the drips muted, its tick peaks +1.1 ms from the cue, 14 dB above the buzz (`neon_cut_without_drips`).
- **Reproducible:** two renders, and a from-scratch rebuild including the GPU measurements, gave the same WAV (SHA-256 `f48f4663…cad151`, same machine).

### Judgement calls, and what has not been checked
- **Nobody has listened to it.** Every check above is a measurement. It cannot tell whether the sound is pleasant, whether the quieter details are audible on a phone, or whether the mix feels right.
- The neon buzz, gas sounds and drips arrive well before their pictures. That follows the physics, but a viewer could take it for bad sync.
- The first click is at 28 ms, so check that X's player does not swallow it.
- Moth and drip levels are raised for storytelling; real moths 10–14 m away would be inaudible. The score is not a sound in the street.
