# IRO × SUMI — build notes

A 50.0 s anime fight at 1920×1080, 24 fps (1,200 frames). The picture is a custom WebGL2 renderer in one `index.html`. The sound is synthesized in numpy. No asset files, fonts, libraries, models or network requests.

**Colour rule:** the world is born grey; whatever IRO touches becomes her paint and whatever SUMI touches becomes his ink. Debris, shockwaves, sparks and smears wear the colour of whoever caused them.

**Biggest hit:** H13, ONE STROKE against PRISM COMET, contact at **frame 1084 (45.17 s)**.

## Deliverables

| File | What it is |
|---|---|
| `fight.mp4` | H.264 CRF 16, yuv420p, bt709, +faststart, AAC 320k. 260.8 MB (41 Mbit/s; grain is expensive) |
| `fight_x.mp4` | Two-pass 7.93 Mbit/s, AAC 320k. 51.6 MB |
| `soundtrack.wav` | 48 kHz, 24-bit stereo, 50.000 s |
| `index.html` | Self-contained film. `window.DURATION`, `window.renderAt(t)`. Opened directly it previews without sound (space pauses, arrows step, click seeks) |
| `contact_sheet.png`, `impact_sheet.png`, `character_sheet.png`, `thumbnail.png` | Sheets and thumbnail |
| `TREATMENT.md` | Rule, designs, beats, hit list, sound plan, rewatch moments |
| `checks/` | Raw audit reports, level plot, and a short clip around each major hit |
| `src/`, `tools/` | All source (about 8,900 lines) |

## How it is built

- **Characters:** a 3D skeleton with two-bone IK. Bodies, hair, cloth, hands and faces are lofted meshes rebuilt for every drawing. They are cel shaded in 3 tones with rim light, inverted-hull ink lines that taper (SUMI's are dry-brushed) and screen-space interior lines. Hair, sashes and mantle use length-preserving chains pushed by wind, velocity and impact pressure.
- **Twos and ones:** poses and secondary motion update on twos. Camera, effects and debris run on ones. Fast flights slide the held drawing on ones. These ranges are fully on ones: f204–213, 284–291, 334–349, 404–413, 544–565, 598–635, 704–715, 764–795, 794–805 and 1070–1100.
- **Close-ups** (eyes, faces, title) are separate 2D vector drawings in Canvas2D. **Lettering** is my own stroke glyphs.
- **World:** 6,450 rigid pieces in all, including Voronoi-fractured walls, storefront, tower and paving. Debris is simulated once at load into ballistic, bounce and settle segments, so `renderAt` only samples it. The world clock slows during hit-stop, so debris creeps while the fighters freeze.
- **Colour field:** paint and ink splats are evaluated in the world shader and stick to flying chunks. A final pass forces SUMI's mask to neutral grey, after distortion and inside impact frames.
- **Effects:** merged sphere-impostor smoke with its own cel shading and outline; shock rings that bend the picture; condensation discs; hit stars; paint and ink droplets; brush-stroke smears; radial speed lines; cracked-glass overlays; damped directional camera shake.
- **Sound:** `tools/audio.py` makes the score (144 BPM, so 1 beat = 10 frames; D minor, E minor for the last exchange, E major at the end) and all effects. Every contact layers a transient, a sub thump, a material layer and debris. `src/hits.json` drives both picture timing and sound.

## How to render

```
.venv\Scripts\python tools\build.py                       # src/ -> index.html
.venv\Scripts\python tools\capture.py video 0:1200 --out work\master.mkv --ss 2 --audit
.venv\Scripts\python tools\audio.py --stems               # soundtrack.wav
.venv\Scripts\python tools\deliver.py                     # fight.mp4, fight_x.mp4
.venv\Scripts\python tools\sheets.py contact work\master.mkv contact_sheet.png
.venv\Scripts\python tools\sheets.py impact  work\master.mkv impact_sheet.png
.venv\Scripts\python tools\thumbnail.py
.venv\Scripts\python tools\capture.py sheet character --out character_sheet.png
.venv\Scripts\python tools\audit.py sync fight.mp4        # also: picture, colour, media, purity
```

- Capture runs headless Edge on the RTX 5090 (ANGLE/D3D11) at 2× supersampling. The page posts raw frames to a local server, which pipes them to a lossless x264 RGB master.
- It renders in independent 240-frame chunks. A single long browser session stalled once at frame 1016 while blocking the pipe; chunking with retry ended that.
- A full render with the colour audit takes about 5 minutes. I did not measure peak VRAM; the render targets come to roughly 0.5 GB by estimate.
- It only ends the Edge process it started, matched by its own profile folder.
- The venv uses `--system-site-packages` to reuse the installed numpy and Pillow, so nothing was downloaded.
- The 4.4 GB lossless master and other working files in `work/` were deleted after delivery. The commands above recreate them.

## Hit list (contact frames)

| # | Frame | s | Scale | Owner | Hit-stop | Impact frames | What breaks |
|---|---|---|---|---|---|---|---|
| H1 | 18 | 0.750 | 1 | IRO | 0 | 0 | floor tile (paint drop) |
| H2 | 54 | 2.250 | 2 | SUMI | 3 | 0 | floor tiles |
| **H3** (hero 1) | **204** | 8.500 | 5 | both | 8 | 205–207 | all plaza windows, a ring of paving |
| H4 | 284 | 11.833 | 5 | IRO | 4 | 0 | obelisk (he hits it at f292) |
| H5 | 334 | 13.917 | 5.5 | SUMI | 4 | 335 | brick wall (strike f342, burst f345–347) |
| H6 | 404 | 16.833 | 6 | IRO | 5 | 405–406 | storefront f414, second wall f424 |
| H7 | 474 | 19.750 | 6.5 | SUMI | 5 | 0 | the street splits |
| H8 | 544 | 22.667 | 7 | IRO | 5 | 545 | car, lamp posts, tower base |
| H9 | 624 | 26.000 | 7.5 | SUMI | 6 | 625 | through the tower; stroke f650–652; top slides from f655 |
| H10 | 704 | 29.333 | 8 | both | 6 | 705–706 | hole in the cloud sea, split sky |
| H11 | 764 | 31.833 | 8 | IRO | 5 | 765 | the air; SUMI spiked |
| **H12** (hero 2) | **794** | 33.083 | 9 | IRO | 8 | 795–797 | crater; towers topple |
| **H13** (hero 3) | **1084** | 45.167 | 10 | both | 8 | 1085–1087 | detonation f1092: skyline and ground |

Minor contacts, all with sound: f244, 254, 264, 274 (flurry), 292, 342, 414, 424, 550, 556, 564, 598, 636, 652, 692, 832, and 946 (the single drop).

## Checks (final files)

**Sync** (`checks/sync_*.txt`)
- Method: the sharpest level jump in the 1.5 kHz high-passed audio, searched within ±3 frames of each contact.
- `fight.mp4`, `fight_x.mp4` and `soundtrack.wav` each give **13/13 majors at 0.00 ms** and **17/17 minors within 0.27 ms**.
- The zero error is expected, because each transient's first sample is written on the contact sample.
- Negative control: delaying the audio by 2 frames gives 0/30 passes, all 30 reported between +2.000 and +2.006 frames. So the detector can fail.
- The audit tests sound against the shared hit table. The picture comes from the same table, and I checked it by eye on the impact sheet and frame strips.

| H1 18 | H2 54 | H3 204 | H4 284 | H5 334 | H6 404 | H7 474 | H8 544 | H9 624 | H10 704 | H11 764 | H12 794 | H13 1084 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 ms |

**Flashes** (WCAG definition, counted on decoded frames of `fight.mp4`, impact frames included)
- Whole-frame mean luminance: at most **2** flashes in any 1 s window.
- Large-area test (at least 25% of 96 tiles swinging together): at most **3** in any window, the worst starting at f384. That is at the limit, with no margin.
- Saturated-red flashes: 0.
- An earlier pass failed with 4 around the crater (f786). I fixed it by darkening the sky during the fall and making one H12 impact frame dark.
- This is my own implementation, not a certified photosensitivity tool such as PEAT or Harding. Run one before relying on it for broadcast.

**Luma:** 36 frame-to-frame steps above 0.07 mean relative luminance: 18 cuts, 11 impact frames in or out, 5 in the single detonation white-out, 1 hit-stop release and 1 speed-line onset. **0 unexplained**, no black frames. The classes are assigned by matching frames against the shot, impact and speed-line tables.

**Audio**

| File | Integrated | True peak | Full-scale samples |
|---|---|---|---|
| `soundtrack.wav` | −14.1 LUFS | −2.2 dBTP | 0 |
| `fight.mp4` | −14.2 LUFS | −1.6 dBTP | 0 |
| `fight_x.mp4` | −14.2 LUFS | −1.6 dBTP | 0 |

- Loudness range is 17.1 LU, wide on purpose for the silences.
- The first X encode peaked at **+3.9 dBTP**: ffmpeg's AAC encoder at 256k spiked inside the detonation. Both files now use 320k with PNS and TNS off, and the master limiter leaves extra headroom.
- Mix check: H13 carries the most energy in the 1.5 s after contact, **3.1 dB above H12**. It arrives from −45 dB.
- Escalation in level is a trend, not strictly monotonic: H4 (32.8 dB) sits below H3 (33.8), and H9 (35.1) below H8 (35.9). H7 and H11 are also a hair (0.1–0.2 dB) under the hit before. H4 and H10 arrive with less contrast than the other big hits.

**Decode:** `ffmpeg -v error` is clean for both MP4s. Each has 1,200 frames, with video and audio both 50.000 s.

**Colour rule, measured on pixels:** 136,236,918 pixels of SUMI across 866 frames, checked after distortion and blur, skipping pixels covered by effects. Mean channel spread **0.000/255**, worst 6/255, **0 pixels above 8**. This is measured on the rendered frames before 4:2:0 encoding.

**Purity:** frames re-rendered out of order in a fresh browser match the master **bit for bit** (17 frames in one run, 14 after the last cleanup). The first run failed on a close-up and the title: Canvas2D state leaked between frames and GPU canvas antialiasing varied. The context is now reset every frame and rasterised on the CPU.

## Critique passes

I cannot play video or hear audio. "Watching in motion" meant reading consecutive-frame strips, impact sheets and full-size stills. Judging sound meant numbers: onsets, per-hit level, sub-bass and a level plot. Please watch and listen yourself; `checks/clips/` has a clip for each major hit.

| Pass | Three weakest hits or problems | What I changed |
|---|---|---|
| Blocking | Paint looked like flat stickers; rubble and dust buried the fighters; pull-backs lost them | Organic splats, line-of-sight clearing, calmer windows, ash, a halo behind SUMI |
| 1 | **H3** wind-up (tiny figures), **H7** (street lost in coloured rubble), **H12** (SUMI invisible at landing) | New H3 close-ups and approach; take-off clears the street; black canyon with a white lip; SUMI sprawled on a torn white flash, effects kept clear of him |
| 2 | **H13** (stroke covered him, moon vanished), **H7** pull-back, **H12** approach (a speck) | Stroke moved behind him and held through the freeze; camera down the canyon; long lens on the fall |
| Mix | H4, H10 and H12 did not arrive out of quiet; H13 only 2 dB above H12 | Pockets of silence, a second and third wave on H13 |
| 3 | **Flurry** (sparks too small to feel), **H5** (you never saw her hit the wall), **H10/H11** (IRO cropped) | Bigger stars, rings, speed lines and zoom kicks; new wall shot with a two-frame stop on the bricks; both fighters framed |
| Look | Lull read as muddy camouflage; sky paint as stickers; rubble as cubes; spray as pencils; **the tower never visibly fell** | Neutral ash, thrown-paint sky, angular rock, teardrops, a new crown splash; the top now slides metres in a held wide shot |

**Would a stranger flinch?** This is my judgement from stills, not a test.
- Probably: the three heroes (silence, then an 8-frame freeze with impact frames), H8 and H6.
- Probably not much: the flurry and H4, which still read as skilled but ordinary action effects.
- H7 is loud and large, but it reads as clutter more than weight.

## Decisions I made

- **3D cel rig instead of drawn 2D.** It gives consistent turnarounds, real foreshortening and debris that correctly passes in front of and behind the fighters. The cost is a less hand-drawn feel.
- **Readability cheat.** Debris that would block a fighter or the lens is shrunk away. Smoke and sparks crossing them are thinned or hidden. The physics is real, but not everything it throws stays visible.
- **World rule bends.** Ash mutes paint and ink in the lull and the ending. The final blast scours cracks and sky paint inside its reach.
- **No synthesized battle cries.** I couldn't hear them, so I didn't ship them. The lull has synthesized breathing.
- **Screen direction:** IRO is left and SUMI right in the staged exchanges. The throw (f600–636) turns the axis, and the tower climb is shot from the other side.
- Impact frames never exceed 3 frames. There is exactly one sustained white-out (f1094–1100).

## Honest weak spots

**The three weakest moments**
1. **f414–450 (17.3–18.8 s), the storefront wreck.** The rubble reads as painted toy blocks and SUMI gets lost in it. The two wall smashes (f414, f424) share one wide shot and don't land as two separate hits.
2. **f600–638 (25.0–26.6 s), the catch, swing, throw and exit.** Both are small against busy rubble, so who is holding whom is hard to read. When she bursts out the far side she is a red speck.
3. **f474–500 (19.8–20.8 s), the street split.** Black ink on grey turns the destruction into noisy rubble that half hides the canyon. It doesn't feel clearly bigger than the hit before it, although its scale is higher.

**Also**
- The characters look like cel-shaded 3D more than hand-drawn anime. At mid distance faces are plain, hands are stiff and some in-betweens tween like 3D. Smears are ribbons and stretch, not redrawn smear drawings.
- The 2D close-up faces don't exactly match the 3D heads.
- The paint bursts in the sky can look like flowers or fireworks. SUMI's rising ink in the charge (f980–1030) looks a bit like leaves, and IRO's gathering strokes are thin.
- The ending is a clean ensō on pale ash. It reads well, but from above the ruined city becomes flat texture and the skyline is simply gone.
- The tower top is heard breaking apart (f692) while the camera is looking up at IRO.
- **The sound has not been heard by anyone.** The synth guitar, choir and some effects may sound thin or artificial even though the numbers pass.

## Build time

About 2 hours 15 minutes of wall-clock time in one session (started 11:47 on 2026-11-27), covering design, engine, animation, sound, repeated full renders and checks.
