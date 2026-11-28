# Diary of a Snowflake

A 20 s film of one snow crystal, from a dust grain to a dark wool mitten.
The whole thing is in `snowflake.html`. The only external dependency is three.js 0.180.0 from jsdelivr.
`snowflake.mp4` is the silent render; `snowflake-sound.mp4` adds the soundtrack described under **Sound**.
No models, textures, HDRIs or fonts are loaded; everything is generated in code.

## Running it

* **Live:** open `snowflake.html` in Chrome or Edge. It grows 65 crystals in Web Workers and builds the scenes (about 11 s here), then plays.
  Space pauses, a click restarts, `?t=14` starts at 14 s and `?res=1080` changes the render size.
* **Render mode:** `?render=1` (optionally `&res=2160`) exposes `window.renderAt(t)`.
  `window.__ready` turns true when it can be called.

## The film

| time | what happens |
|---|---|
| 0–2.0 s | A mineral dust grain tumbles and glints. Vapour streams in and condenses into a droplet. |
| 2.0–3.0 s | A freezing front crosses the droplet, which facets into a small hexagonal prism around the grain. |
| 3.0–5.3 s | Plate. Two dry pockets leave two hexagonal ribs in the centre. |
| 5.3–7.0 s | Six arms. |
| 7.0–8.5 s | Humidity spike: side branches. |
| 8.5–9.5 s | Dry layer: small waist plates on the arms. |
| 9.5–11.1 s | An updraught back into the −15 °C layer: a second round of branching. |
| 11.1–14.9 s | Humidity falls: sectored plates at the tips, then faceted rims. |
| 15–17.05 s | Out of the cloud base over a pine valley at dusk, with snowfall and one lit cabin. |
| 17.05–18.85 s | The mitten rises into frame. The camera follows the flake down onto the knit among dozens of others. |
| 18.85–19.65 s | Touchdown, then a push in to macro. A warm lamp circles the six arms (19.0–19.8 s). |
| 19.65–20 s | Macro rest with all six arms lit. |

## The physics

**Growth model.** `sim` is the Gravner–Griffeath mesoscopic lattice map on a hexagonal lattice.
Each cell holds an attached flag, quasi-liquid boundary mass, ice mass and vapour.
Each step runs diffusion (reflecting off the ice), freezing, attachment (different rules for 1–2, 3 and 4+ frozen neighbours) and melting.
It uses fixed steps from t = 0 with no noise term. The hero crystal takes 73,760 steps and reaches a radius of 422 cells.
The run is cached, and the film only chooses which step to show.
A cell is drawn only if the lattice had frozen it by that step.

**Weather script.** This is `HERO_TIMELINE`: each entry is (first step, temperature, supersaturation over ice).

| layer | T °C | supersat. % | records in the crystal |
|---|---|---|---|
| young plate, with two dry pockets | −19.4 | 13.8 (pockets 10.2) | faceted centre with two ribs |
| arms | −16.5 | 10.7 | six broad arms |
| humidity spike | −15.0 | 16.7 | side branches |
| dry layer | −13.3 | 8.9 | waist plates |
| updraught | −15.2 | 14.7 | second branches |
| humidity falls | −12.8 | 12.9 | sectored tip plates |
| dry cloud base | −11.2 | 10.4 | faceted rims |

**Mapping the weather to model parameters** (`nakaya(T, S)`):

* Far-field vapour is `rho = 0.045·S`.
* The attachment barrier `beta` is lowest at −15 °C, rises toward both plate shoulders, and rises further in drier air.

This mapping follows the Nakaya diagram's trend, but it is my own calibration, not a derived physical law.
I tuned the layer lengths by running the model and looking at the results.

**Ventilation.** Beyond a 70-cell boundary layer the vapour is held at the ambient value.
When the air changes, the vapour field is rescaled, because the crystal has fallen into new air.

**Symmetry.** The film simulates one 30° wedge, since every arm sees the same air.
I checked that this is only a speed-up. `work/verify_full.js` ran the same weather on the **full, unfolded** hexagonal lattice, with 216,193 ice cells.
Every ice cell had all six 60° rotations, and **no cell's frozen/not-frozen state differed from the wedge run**.

**Neighbours.** The 58 flat crystals on the mitten each grow from their own randomly scripted layer sequence, using the same solver.
Six more lattice-grown plates form the end caps of three capped columns. With them lie three needle clusters and one solid column.

### What is *not* simulated (so nothing is overclaimed)

* **Thickness (the 2.5D part).** The outline, branching, ribs, spines and thin membranes come from the 2D lattice.
  Thickness is a mapping from the lattice's ice mass and freeze time, plus a crown, rim and bevel for the prism edges.
  The lattice does not solve for growth along the c-axis.
* **Nucleation (0–3.8 s).** The droplet, freezing front and faceting into a prism are an animated signed-distance shape.
  The lattice starts at 2.52 s. The prism's radius follows it, and the lattice height field cross-fades in from 3.3 to 3.8 s.
* **Columns and needles** (the below −22 °C and near −5 °C habits) are analytic hexagonal prisms.
* **Air bubbles** are drawn ellipsoids, but where and when they appear comes from the lattice. There are two kinds:
  * *Sealed hollows*: interior cells that froze 250 to 16,500 steps after the ice around them (7 sites per 30° wedge).
    They fall along the arm ridges, at branch junctions and at the bases of the tip plates. They become the larger bubbles, sized by how long they stayed open.
  * *Pockets and membranes*: clusters of cells that closed with 4 or more frozen neighbours, or froze as thin membranes. They become the small beads.
* The tumble, camera, approach to the mitten, lighting and finale lamp are directed. Scale and fall speed are cinematic.

## Rendering techniques

* **Crystal field, rebuilt each frame on the GPU.** The lattice history is resampled to a 2048² height field at step S (barycentric on the triangular lattice, then blurred at several scales). Spines and ribs come from the local contrast of the lattice ice mass.
* **Ice shader.** A ray-marched slab with refraction through both faces, slight dispersion, absorption, Fresnel reflection and total internal reflection.
  It uses a procedural studio with **dark-field backlighting**: straight-through rays stay clear, and only facets, ribs and bevels light up, cold from upper left and warm from lower right.
  It also has directional side-facet edge light, thin-film interference where the lattice grew thinnest, crystal-fixed facet glints and trapped bubbles.
* **Cloud.** Domain-warped 3D noise, with colour and density keyed to each layer, bands sweeping up at layer boundaries, and aperture-shaped bokeh.
* **Valley.** A procedural terrain with about 15,000 instanced pines, a broken frozen river, aerial haze, a dusk sky under the cloud base and a cabin.
* **Mitten.** Real stockinette: interlocking parametric loops in twisted three-ply yarn, 330,000 curved fibres on the knit plus 36,000 round the outline (anti-aliased with alpha-to-coverage), and snow crumbs.
  It is a closed mitten shape with a thumb, ribbed cuff and quilted sleeve. The detailed yarn cross-fades in as the camera closes. Flakes are fitted to the highest yarn under them and cast shadows.
* **Lens.** A gather depth of field. On landing, the focal plane tilts to lie along our flake, as with a tilt lens, so all six arms are sharp.
  Then bloom, a faint six-spoke glint, ACES tone mapping and a fixed per-frame dither.
* **Determinism.** Every pose, particle and light is a closed-form function of `t`; everything simulated is cached from step 0.

## Rendering the video

```
cd work
npm install                 # playwright-core 1.55.0 (the only package)
node build.js               # inlines work/sim.js and work/src/* into ../snowflake.html
node render.js              # 600 frames at 2160², downscaled to 1080² -> ../snowflake.mp4
```

`render.js` drives the installed **Microsoft Edge** (this machine has no Chrome) through playwright-core with
`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. It refuses to run on SwiftShader.
Each frame is read back as raw RGBA and posted to a local server on a random 4xxxx port, then piped to ffmpeg:

```
ffmpeg -f rawvideo -pix_fmt rgba -s 2160x2160 -r 30 -i - \
  -vf "vflip,scale=1080:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 17 -x264-params aq-mode=3:deblock=-1,-1 \
  -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -r 30 -an -movflags +faststart ../snowflake.mp4
```

Other tools in `work/`:

| file | purpose |
|---|---|
| `shot.js` | preview single frames |
| `determinism.js` | same time, same pixels, across frame orders and browser sessions |
| `verify_full.js` | full-lattice symmetry check |
| `nanhunt.js` | scans the HDR buffers for NaN, infinite or negative pixels |
| `flicker.py` | frame-to-frame change in the finished MP4 (pops, flicker, dead stretches) |
| `hollows.js` | maps the sealed hollows used for bubbles |
| `livetest.js` | opens the HTML from disk and checks that it plays |
| `explore*.js`, `hero.js` | growth-model tuning sheets |

## Checks on the delivered build

| check | result |
|---|---|
| `ffprobe` | H.264 High, 1080×1080, yuv420p, 30 fps, 600 frames, 20.000 s, 22,097,175 bytes (about 8.8 Mb/s), faststart, no audio (the sound version is a separate file, see Sound) |
| WebGL renderer | ANGLE, NVIDIA GeForce RTX 5090, Direct3D 11 (real GPU) |
| Determinism during capture | 32 frames re-rendered out of order, **0** pixel mismatches; 600 of 600 frames unique |
| `determinism.js` | 14 comparisons across shuffled orders and a second browser session, **0** mismatches |
| `nanhunt.js` | 150 frames sampled, **0** with NaN, infinite or negative pixels |
| `flicker.py` on the MP4 | no pops and no single-frame flicker; the stillest frame still changes |
| `verify_full.js` | six-fold symmetry holds on the unfolded lattice (see above) |
| `livetest.js` | opened from disk: starts in about 11 s, plays at about 57 fps on this machine, no errors |
| Review | frames from the MP4 at 0, 3, 6, 9, 12, 15, 18 and 19.97 s, plus dense strips at nucleation and landing |

## Bugs found by looking and measuring, then fixed

* Wedge key table stored array offsets instead of cell indices, so nothing grew at first.
* Vapour streaks were built on a mirrored basis and were all back-face culled.
* Rounding the crystal radius to whole cells made growth stutter between about 2.9 and 4.3 s.
* Overlapping time windows made a mist band and a light sweep vanish within one frame.
* Multisampled pine trees did not resolve bit-identically, so the valley is now supersampled and box filtered.
* Multisample extrapolation gave hair-thin fibres negative colour. The lens spread one such pixel into a black dotted disc.
  The thin-film term could go negative too. Both are now clamped at the source.

## Timing

* **Total build time: 115 min 41 s** of wall-clock time (2026-11-26, 01:01:37 to 02:57:18 −0600), including growth-model tuning, all test and final renders, and review.
  Other demos were rendering on the same GPU throughout.
* Final capture: 559 s for 600 frames at 2160² (about 0.9 s a frame, including readback, transfer and the x264 `slow` encode).
* Page start: about 5 s to grow all 65 crystals in workers, and about 11 s until the first frame.

## Sound

`snowflake-sound.mp4` is the same picture with a soundtrack. The video stream is copied, not re-encoded, and `snowflake.mp4` is unchanged.
**Nobody has listened to it.** Everything below was checked by measurement and by looking at spectrograms.
Measurements can show timing and level, not whether it sounds good. **A person should listen before it is posted.**

Everything is synthesised in `audio/synth.js` from sine partials and seeded noise. There are no samples, no generated-audio models, no voices and no outside music.

### Layers

| layer | what it is |
|---|---|
| cloud wind | stereo pink noise through moving filters. Each weather layer has its own pitch and hiss, and its strength follows the film's fall speed. It opens and fades as the cloud base lifts |
| mist whooshes and sheen | soft swells peaking on the frame the mist band or face light peaks |
| nucleation | vapour motes (their rate follows the film's vapour amount), grain tinks, a wet swell with droplet plips, ice crackle panned with the freezing front, gathering glass partials, a flash chord |
| lattice shimmer | in every video frame from the lattice fade-in, tiny grains. Their number rises with the cells the model froze in that frame (as the square root, 1 to 9). Pitch follows how far out they froze, and each weather layer has its own timbre |
| stage chimes | glass bells for the two ribs, a six-note celesta arpeggio for the six arms, and different figures for side branches, dry layer, updraught, sector plates and facets |
| valley | muffled snowfall noise, a faint distant air tone and very soft settling flakes |
| touchdown | a held breath, then a tiny tick with a faint wool thud |
| score | sparse felt piano on cue frames, a short melody over the valley, a quiet sine pad that changes chord with each layer, and a resting D add9 chord (D major / B minor colours) |
| space | one eight-line feedback delay reverb |

### How the cues are timed

`audio/cues.js` loads the timing code **from inside the delivered `snowflake.html`** (it records the file's SHA-1): the growth lattice, the growth clock and the director.
Each cue is the first or peak video frame of its event, and is placed on that frame's first sample (frame × 1600 at 48 kHz). A few figures are rolled on from there by a few milliseconds or frames.
Weather-layer cues are the first frame on which the displayed simulation step enters the layer.

### Cue sheet

Continuous beds: cloud wind from 0 s to 16.533 s (fading from 14.733 s), vapour motes while vapour is on screen, lattice shimmer while the crystal is growing,
valley snowfall from 14.733 s to the end, and the pad throughout. Fades: 60 ms in, 300 ms out.

| time (s) | frame | on screen | sound |
|---|---|---|---|
| 0.000 | 0 | first frame: grain already tumbling, vapour streaming | cloud wind, vapour whisper, pad (D open fifth) |
| 0.167, 0.533 | 5, 16 | the dust grain flashes | tiny mineral tink |
| 0.633 | 19 | droplet starts to condense on the grain | watery swell with droplet plips |
| 2.000 | 60 | freezing front starts across the droplet | ice crackle, panning with the front |
| 2.433 | 73 | facets begin to form | rising glass shing |
| 2.900 | 87 | facet flash: the hexagonal prism | bright glass chord and sparkle burst |
| 3.000 | 90 | prism widens into a plate | soft falling glass glide |
| 3.333 | 100 | lattice-grown plate fades in | faint shimmer |
| 3.367 | 101 | layer: dry pocket: first rib (-19.4 °C, 10.2 %) | single glass bell (first rib) |
| 4.500 | 135 | layer: dry pocket: second rib (-19.4 °C, 10.2 %) | second glass bell, a step higher |
| 4.933, 7.000, 8.567, 9.567, 11.167, 13.833 | 148, 210, 257, 287, 335, 415 | a layer boundary sweeps up through the mist (thickest frame) | wind whoosh that peaks there |
| 5.300 | 159 | layer: six arms (-16.5 °C, 10.7 %) | six-note celesta arpeggio, one note per arm |
| 5.733, 7.633, 9.567, 10.833, 12.167, 13.433, 14.733, 16.233 | 172, 229, 287, 325, 365, 403, 442, 487 | light slides across the faces (brightest frame) | faint airy shimmer that peaks there |
| 6.233, 6.800, 9.567, 11.000, 11.400, 11.600, 14.200 | 187, 204, 287, 330, 342, 348, 426 | the lattice seals a hollow: a bubble appears | small round air blip |
| 7.133 | 214 | layer: humidity spike: side branches (-15 °C, 16.7 %) | quick high glittering arpeggio (side branches) |
| 8.500 | 255 | layer: dry layer: waist plates (-13.3 °C, 8.9 %) | hollow, dry two-note chime (waist plates) |
| 9.567 | 287 | layer: updraught: second branches (-15.2 °C, 14.7 %) | second arpeggio in a new mode with shimmer |
| 11.100 | 333 | layer: humidity falls: sectored plates (-12.8 °C, 12.9 %) | broad rolled glass chord (sector plates) |
| 13.767 | 413 | layer: dry cloud base: facets (-11.2 °C, 10.4 %) | high crystal polish bells |
| 14.733 | 442 | falling out of the cloud base | cloud wind opens and falls away; valley hush and muffled snowfall fade in |
| 15.000 | 450 | growth complete | resolving celesta chord |
| 16.533 | 496 | valley fully clear | muffled snowfall, calm; felt-piano melody |
| 17.300 | 519 | the mitten rises into the picture | soft descending air; the world grows more muffled |
| 18.833 | 565 | the flake touches the wool (0.63 mm of travel left, wobble starts) | tiny soft tick with a faint wool thud |
| 19.133, 19.233, 19.333, 19.433, 19.500, 19.600, 19.733 | 574, 577, 580, 583, 585, 588, 592 | the lamp flares one arm after another (arms 5, 6, 1, 2, 3, 4, 5) | seven celesta notes rising from A5 to B6, each panned to its arm |
| 19.667 | 590 | lamp settles: all six arms rest lit | soft final D add9 chord |

### Commands

```
cd audio
npm install                      # three 0.180.0, only used to run the film's camera maths
node cues.js                     # -> cues.json
node synth.js --templates        # -> snowflake.wav (48 kHz, 24-bit stereo, 960,000 samples = 20.000 s)
cd ..
ffmpeg -i snowflake.mp4 -i audio/snowflake.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart snowflake-sound.mp4
cd audio
python check_audio.py > check_output.txt     # measurements, spectrogram.png, waveform.png, sheet_audio.png (needs numpy + pillow)
python zoom.py                   # -> sheet_zoom.png
```

`check_audio.py` runs `ffprobe`, `ffmpeg -af ebur128=peak=true`, `showspectrumpic` and `showwavespic`.
`node synth.js --stems` writes each layer alone, and `python levels.py` prints levels around the hits.
Deleting every generated audio file and re-running these steps gave a **byte-identical** `cues.json`, WAV and MP4 on this machine.

### Mix

* Static gain (4.2 dB on the final pass) to reach the loudness target. A look-ahead true-peak limiter with a −2 dBTP ceiling is in place and did **not** act on this mix (0 dB reduction). I tested it separately on a deliberately hot signal.
* The wind is high-passed at 70–85 Hz, and the pad and piano have a low shelf (about −5 dB under 190 Hz) to keep the mix light.

### Measurements

| check | result |
|---|---|
| integrated loudness | WAV -16 LUFS, MP4 -16.1 LUFS (target about −16); loudness range 2.3 LU |
| true peak | -3.3 dBTP (limit −1) |
| clipped samples | 0 in the WAV, 0 in the decoded AAC |
| streams | H.264 High 1080×1080 30 fps, 600 frames, plus AAC-LC 48000 Hz 2-channel at 194 kb/s; both 20.000 s; faststart |
| picture untouched | video stream MD5 equals the silent file's: yes |
| AAC delay | 0 samples; decoded length 960000 samples |
| gaps | quietest 50 ms between the fades is -30.9 dBFS at 2.485 s; no window below −55 dBFS |
| clicks | 0 flagged. Self-test: 3/3 planted 0.2 clicks found. So it catches an obvious click, but may miss a very small one |
| hit timing in the MP4 | each hit rendered alone and searched for in the encoded audio: 24/24 clear matches within half a frame (worst 3.38 ms). 5 of 29 were too masked to judge |
| arm flares against the picture | 6 of 7 sound on the exact frame that arm is brightest relative to the others; the other differs by 1 frame (all arms are brightening then) |
| flash against the picture | cue frame 87, brightest video frame 88; their mean brightness is equal to within 0.02 of 255 |
| mitten against the picture | cue frame 519, first video frame with the mitten in the bottom strip 519 |
| touchdown motion | worked out from the film's camera maths, not from video pixels: an arm tip's on-screen motion changes abruptly at frame 565, the cue frame |

The images are `audio/sheet_audio.png` (whole film with cue lines) and `audio/sheet_zoom.png` (nucleation, the six arms, touchdown and finale).
The raw ffmpeg pictures are `audio/spectrogram.png` and `audio/waveform.png`.

### Known limits

* Not judged by ear: timbre, balance, whether the piano reads as a piano, and whether the tick feels soft.
* 5 of the 7 air-bubble blips are too quiet under the other layers to verify by measurement, and may not be audible.
* The mix still has a fair amount of energy at 80–160 Hz from the pad and low piano notes. Check it on phone speakers and headphones.
