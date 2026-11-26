# THE SAME FIRE: build notes

An 80.000 s film (1,920 frames, 24 fps, 1920x1080) from 300,000 BCE to 2100 CE, made entirely in code.

## What I built

**One small fire is carried from hand to hand through 302,099 years.** It opens on an adult tipping an
ember into a child's cupped hands under racing star trails. The fire then travels as a campfire, a
torch, the light on a cave wall, hearths beside the first fields, an oil lamp by the first writing, a
lantern on a road, a hearth on a Pacific canoe, a plague lantern, a furnace, a filament, one candle, a
TV set and the lamp over a newborn. In 2100 someone born in 2026 tips an ember into a child's hands,
which is the first shot again, with the same hummed tune. Then the old hands let go.

Other devices that tie it together:
* **The hand.** The outline sprayed on the cave wall is the same outline reaching up from the ship's hold.
* **The first circle.** The family round the television sits where the first family sat round the fire.
* **Ochre red.** The cave pigment returns as the newborn's blanket, then the scarf that person wears for life.
* **The sky is the gearbox.** Star trails are long when time runs fast and sharp points at 1 year per second.
* **No cuts to nothing.** At hard breaks the dark closes round a flame, one ember crosses the black, and
  the next age opens around it.
* **The future is drawn differently.** After 2026 things become dotted drawn light with "ghost" outlines
  that spread further the further we get from today. Only the area near the flame stays solid.

The look is Canvas2D silhouettes and landscapes. A WebGL2 compositor adds the sky, the planet (from
hand-typed coastlines), a lit rock wall, procedural fire, rim light, bloom and the projection look. The
opening and closing hands are ray-marched 3D shapes lit by the ember. All lettering is my own stroked
alphabet (`src/02_font.js`).

## Files

| file | what | size |
|---|---|---|
| `index.html` | the film, self-contained. `DURATION`, `renderAt(t)`, `yearAt(t)`, `rateAt(t)`. Opened normally it has a play button and scrubber (no audio) | 0.30 MiB |
| `humanity_2100.mp4` | master: H.264 High, crf 16, yuv420p, BT.709, +faststart, AAC 320k | 74.3 MiB, 7.79 Mbit/s |
| `humanity_2100_x.mp4` | copy for X: two-pass H.264, AAC 320k | 67.9 MiB, 7.12 Mbit/s |
| `soundtrack.wav` | 48 kHz, 24-bit stereo, 3,840,000 sample frames | 22.0 MiB |
| `contact_sheet.png` | one frame every 2 s, plus the final frame | 8.3 MiB |
| `thumbnail.png` | poster frame rendered by the film's own code | 3.0 MiB |
| `TREATMENT.md` | idea, 80-row rate table, arithmetic, every date, projection reasoning, music plan | |
| `year_audit.txt`, `luma_audit.txt`, `checks.txt`, `purity.txt` | audit outputs | |
| `src/`, `tools/` | source | about 6,700 lines |

## How it renders

Node 24 and ffmpeg only. There are **no packages**: no pip installs (so no venv) and no npm.
The DevTools client uses Node's built-in WebSocket. I used standard-library Python to patch source
while developing; the build does not need it.

```
node tools/build.mjs                # src/*.js -> index.html
node tools/make_table.mjs           # rate table into TREATMENT.md
node tools/audio/render_audio.mjs   # soundtrack.wav (about 8 s)
node tools/render.mjs               # headless Edge, PNG frames piped straight to ffmpeg (about 9 min)
node tools/encode_x.mjs             # the X copy
node tools/thumbnail.mjs
node tools/stills.mjs --sheet       # contact_sheet.png
node tools/year_audit.mjs           # about 10 min
node tools/luma_audit.mjs
node tools/checks.mjs
node tools/purity.mjs
```
`tools/remux_audio.mjs` swaps in a new soundtrack without re-encoding the picture, and
`tools/luma_probe.mjs` and `tools/audio/profile.mjs` are quick diagnostics.
No frame sequence is ever written to disk. Total GPU memory in use on the machine read about 4.5 GB
before the first render and after the last; I did not log it during a render. The film uses a handful of
1080p buffers. Another agent session shared the machine. My tools only closed the headless
browser they launched, on a private profile inside this folder, and x264 was limited to 12 threads.

## Checks (final files)

**Year audit: PASS, 23/23, all 1,920 frames** (`year_audit.txt`)
* Expected values come from the table printed in TREATMENT.md, formatted by a second formatter written in the audit.
* Rates are whole, at least 1 and constant in each slot. They never rise and sum to 302,099. All 81
  boundary values are exactly equal. The counter strictly rises. Frame 1919 reads "2100 CE".
* Drawn strings match on every frame. Counter pixels equal a reference render (0.000% mismatch).
* In the **finished MP4**, the expected counter text is found on all 1,920 frames (lowest correlation
  0.934; lowest ink-to-surround contrast 177/255).
* Negative control: a year with one wrong digit scored lower than the right year in 49/49 tests
  (smallest margin 0.0275). This is a comparative test, not text recognition.

**Luma and flashes: PASS** (`luma_audit.txt`)
* No one-frame pops. The largest frame-to-frame step is 18.75/255, at 62.208 s, an ember crossing opening into daylight.
* Steps above 5/255 all fall in listed, deliberate light changes. That list is hand-kept. The no-pop
  test and the 20/255 ceiling do not depend on it.
* Flashes in the worst one-second window: 1 (whole frame), 1 (worst of 48 tiles), 2 (saturated red). The limit is 3.

**Delivery: PASS, 23/23** (`checks.txt`)

| | master | X copy | WAV |
|---|---|---|---|
| frames / video / audio | 1,920 / 80.000 s / 80.000 s | 1,920 / 80.000 s / 80.000 s | 80.000 s |
| integrated loudness | -14.1 LUFS | -14.1 LUFS | -14.0 LUFS |
| true peak | -2.2 dBTP | -2.2 dBTP | -2.4 dBTP |
| clipped samples | 0 | 0 | 0 |
| `ffmpeg -v error` full decode | clean | clean | |

Total folder size is 176 MiB (limit 3 GB).

**Purity: PASS** (`purity.txt`). 45 sample frames rendered in two separate browser sessions, one in
order and one shuffled with unrelated frames between them, were pixel-identical (45/45). This is a
sample, not all 1,920 frames. It holds on this machine and browser; another GPU could round differently.

## Critique passes

I judged these from stills, contact sheets, transition midpoints and frames decoded from the MP4.

**While building:** the first fire blew people out to flat yellow. The cave stencil, the key image, was
invisible on rough rock, so I added a pale limestone panel. The first dawn rendered black (a colour
parsing bug). Fixed the lantern walking out of frame on the road.

**Pass 1:** muddy cross-fades; the 1945 cloud was a white blob; soldiers vanished into the ground;
industry looked like a repeating window texture; the Americas line was on screen for 0.9 s (merged
with "1492"); the 2026-2100 walk was a neon tangle where the one life got lost, so I enlarged the
person, spaced out the places, softened the lines and moved the words into the sky. In the ending, the
old hands now leave the frame instead of tangling with the child's.

**Pass 2:** four fades to pure black in seven seconds broke the "one journey" idea, so I replaced them
with the ember crossing the dark. Farming and early cities had **no flame**, which broke my own rule,
so I added hearths. I redrew the newborn (it looked like an orange egg) and removed banding on the hands.

**Found by the checks, which I had missed by eye:**
* Frames were not pure functions of t. Causes: Chrome's GPU path anti-aliasing, two different
  canvas-upload paths, and a float-based grain hash. Fixed with CPU-rasterised layers, byte uploads and an integer hash.
* Background windows glowed **through people** (the "see-through" plague walker).
* The luma audit caught a bad first frame on pull-backs, a Moon boot that blinked out, a jump of 45/255
  and a sharp crest on the 1945 light.
* AAC pushed the true peak to -0.3 dBTP, so I lowered the master ceiling. AAC at 256k still overshot, so both MP4s use 320k.
* Two audit bugs of mine: a cut-off that invented red flashes (the real value was steady), and a
  reference drawn by a different rasteriser. I fixed the audits and re-ran them.
* A last review of decoded frames found window lights outside their window in the newborn shot (a fix
  I had written but never run).

## Is it moving, or a timeline with pictures?

My honest read, with the limit that I cannot test it on a viewer:
* **The first 27 s and the last 16 s work as a film.** The ember, the hand on the cave wall, then the
  newborn, "will be 74 in 2100", and the old hands letting go give them one subject.
* **The hard middle beats carry weight** because they go quiet: the hand in the hold, and one candle for
  the Holocaust line.
* **About 34-45 s drifts toward a timeline with pictures.** The camera passes monuments and labels. The
  flame is there, but nothing happens to it. The canoe shot is beautiful but is still a place, not a moment.

## Judgement calls

* Start year exactly 300,000 BCE. The rate **only ever falls**.
* Rounding is to the nearest year, so "2100 CE" shows from t = 79.5 s, for the last 12 frames.
* "2026 NOW" lands exactly at t = 65.000. The marker stays on screen while the counter moves on.
* The climate line says "about 2.5 degrees C", which assumes policy tightens somewhat from today's
  roughly 2.6-2.8. I recalled the sources from training and did **not** look them up for this build
  (the film itself makes no network requests either). Check them before publishing.
* The Holocaust is named. No figure is given for deaths in the Americas, because totals are contested.
* No famous faces or names. The astronaut and the boot are anonymous.
* The fire is **not** on screen every second. It is missing for about 1 s in the early-cities pan (near
  36-37 s, which is simply a miss), from about 56.5 to 58.2 s (electric light, then blackout, until the
  candle, which is intended), and on the Moon (about 0.8 s).
* The X copy is about 7.1 Mbit/s, not 8: the crf 16 master came out at only 7.8, and the copy had to be smaller.

## Build time

About **2 h 12 min** of wall-clock time on 26 November 2026, 13:59 to 16:12 (Central), all in one thread with
no subagents or other models. That includes five full master renders and several partial or repeated audit runs.

## Weak spots (honest list, worst first)

1. **38-42 s, the long road.** Mediterranean columns, a Chinese wall and a Maya pyramid stand side by
   side, which is geographically impossible. There is one general caption and no human moment. This is the most "pictures on a timeline" shot.
2. **66-73 s, the projected life.** Four captions in 7.5 s compete with the person you are meant to
   follow. The sea wall, coral, mangroves and AI go by too fast, and the AI "lattice" is abstract sparkle.
3. **59.5-60.3 s, 1945.** The mushroom cloud is stylised and close to an icon. Silence and the candle
   carry the weight more than the picture does.
4. **Nobody has listened to the soundtrack.** I checked it only with loudness meters, per-second
   profiles and a spectrogram. The synthesized voice and flute may sound artificial, and balance or
   harshness needs a human ear. The limiter reaches about -7.5 dB on a few hits (57 s and 64 s).
5. **Two styles.** The sculpted 3D hands are far richer than the flat silhouette people, whose faces are
   barely there. Skin is one warm-brown family throughout, so places carry "all of humanity" more than people do.
6. **Reading on a phone.** The five farming labels are small in portrait, and New Guinea and the Andes
   stay up for only about 1.4 s. The early-city names last about 1 s each.
7. **52-56 s, industry** is still the flattest set, and the large light bulb looks like clip art.
8. **Compression of history.** The dispersal routes are schematic, and coastlines are hand-typed and
   coarse. Antarctica appears only on the planet near 2000. Some event labels run ahead of or behind the
   counter by a few years or more. The lyre is heard at about 3700 BCE, a few centuries before the oldest evidence.
