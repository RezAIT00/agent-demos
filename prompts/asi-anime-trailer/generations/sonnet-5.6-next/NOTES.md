# BETWEEN BLINKS (間): production notes

An 87.5 s anime trailer about artificial superintelligence, 1920×1080 at
24 fps. One of her blinks is 9,000 years to the ASI. While she says one word,
it imagines ten billion ways her sentence could end. It misses the real one:
*"do you get lonely?"*

## Calls I made

- **Angle.** No takeover. ASI is treated as *speed*, so the story is about
  patience. All of its montage is thought. Nothing physical could happen in
  0.3 s.
- **Title.** I used 間 ("the gap between"), not 一瞬 ("an instant"). It is a gate
  with the sun in the gap, it is also the unspoken name of the ASI, and its 12
  strokes are ones I could draw correctly by hand. They are written in standard
  order.
- **Characters.** Both are original: Nagi and MA. I left Clawd out so the film
  would not read as a brand piece. No logos and no likenesses.
- **No voice acting.** All lines are on screen. The only voices are wordless
  formant synthesis: choir pads, plus one stretched vowel for her "hey".
- **Length.** 87.5 s, at 120 BPM (one beat is 12 frames). Cuts are snapped to
  whole frames.
- **X copy.** About **6.9 Mbit/s, not 8**. Flat cel colour compresses so well
  that the crf 16 master came out at only 7.7 Mbit/s, so an 8 Mbit/s copy was
  *larger* than the master. SSIM against the master is 0.995 (PSNR 49.8 dB). To
  change it, edit `-b:v` in `tools/finish.sh`.
- **X copy audio** is copied from the master. Encoding AAC a second time pushed
  true peak to −0.2 dBTP, which broke the −1 limit.
- **Software 2D canvas during capture** (`--disable-accelerated-2d-canvas`).
  This is what makes frames bit-exact. It costs about 3× in render time. WebGL
  still runs on the RTX 5090.
- **Contact sheet** samples at 1.75 s and every 2 s after that (43 tiles), so
  that it does not land on cut frames.

## What is in the folder

```
index.html           self-contained film: window.DURATION, window.renderAt(t)
asi_trailer.mp4      H.264 crf 16, yuv420p, bt709, faststart, AAC 320k
asi_trailer_x.mp4    smaller copy for X
soundtrack.wav       48 kHz, 24-bit, stereo
contact_sheet.png  thumbnail.png  TREATMENT.md  NOTES.md
src/00..99_*.js      picture source (concatenated into index.html)
src/audio/*.mjs      synth kit, instruments, score
tools/               build, capture, finish.sh, three audit scripts
out/                 check logs, frame hashes, critique-pass sheets, luma plot
```

## How it renders

- **Picture.** Canvas2D draws the characters, ink and type. A small WebGL2
  "painter" makes the cumulus skies, nebulae and underwater light with shaders.
  A WebGL2 post pass adds bloom, grade, chromatic aberration, shake, zoom blur,
  impact frames and fades.
- **Cel look.** Two or three hard tones are clipped inside each shape. Ink is
  built as filled polygons that taper. Rim light is a mask minus a shifted copy
  of itself.
- **Timing.** Character drawings change on twos (`on2(t)`). Cameras, rain and
  effects run on ones. Smear drawings: MA's dashes between raindrops, the pinky
  hook, the mural brush, and squash and stretch when the nose drop lands.
- **Rain.** One 3D field of drops with a "rain clock" that stops at 2.0 s and
  starts again at 73.0 s. Parallax and depth of field come from the projection.
- **The match cut.** The cosmic web at 40–45 s and the fibres in her iris are
  the same array of points (`WEB` in `40_eye.js`), drawn through one camera.
  Frame 0 contains the image the reveal lands on.
- **The ring.** Its angle is the exact integral of a keyframed speed curve. It
  stops at 68.95 s and then ticks once a second. The score reads the same
  keyframes and clicks once per tick mark.
- **Lettering.** Every glyph is a hand-written stroke path (`30_type.js`,
  `70_title_kanji.js`). There is no `fillText` and no font file.
- **Determinism.** All randomness is seeded and there is no simulation state.
  Caches depend only on their key.
- **Capture.** `tools/cap.mjs` is adapted from the reference for plumbing only.
  It drives headless Edge over CDP and pipes raw RGBA through a
  127.0.0.1-only server into ffmpeg. No asset is fetched from anywhere.

```
bash tools/finish.sh                  # audio, picture, mux, X copy, sheet, thumbnail, checks
bash tools/finish.sh --no-render      # remux and recheck only
node tools/cap.mjs --times 45.3 --out out/s
node tools/cap.mjs --verify out/hashes.json --step 23
```

To preview, open `index.html` and click or press space. It plays
`soundtrack.wav` if the file is next to it, and `#t=45` jumps to a time. Live
playback may drop frames. It uses the GPU 2D canvas, so a few anti-aliased
pixels can differ from the MP4.

**Sound.** Everything is synthesized in Node, sample by sample:

- additive piano with stretched partials, music box and glass
- detuned-saw strings and lead
- five-band formant choir
- synthesized kick, snare, hats, taiko and cymbals
- booms, risers and whooshes
- two rain beds, with a tape stop on the freeze
- an 8-line feedback delay reverb and an echo
- bus compression, then a 4× true-peak limiter

The motif is A–D–E–F♯–E, and the drop uses G–A–F♯m–Bm. The blink contains
1.68 s of digital zero.

## Critique passes

I judged these on stills, contact sheets, frame strips and frame-difference
measurements.

**Pass 0 (asset tests).** The first rain drops were invisible, the dawn sky
bloomed to white, puddles looked like stickers, MA's ribbons looked like clipped
bars, and her profile had a gap behind the ear and zigzag "teeth" for hair
shine. All fixed.

**Pass 1** (`out/sheet_pass1.png`). Weakest:

- A dead black dip at 5 s, now a dive into the pupil.
- MA half out of frame while naming.
- The key question held on one framing for 6 s, so I added a punch-in on "do
  you get lonely?".
- "then blink with me" repeated that framing, so it is now over MA's shoulder.
- The flash washed out the jaw-drop frame.
- The solar ship read as a surfboard.
- The kanji had bulb-ended strokes.
- The god rays were hard wedges.
- The search readout collided with "MATCHES: 0".

**Pass 2** (`out/sheet_pass2.png`).

- The no-match stretch was 7 s of one flat MA shot. I added the close-up of
  MA's eyes with her reflected in them, which answers the first frame. My first
  version looked like two clip-art stickers, so I rebuilt it from her real
  drawing.
- The iris reveal arrived early and sat still, so I retimed it to land on the
  hit.

**Pass 3** (delivered file plus the luma audit).

- The audit found MA's body swapping pose mid-zoom at 53.2 s.
- It also found that the same zoom had been eased twice and snapped in about
  two frames.
- By eye: her shorts read as a black pipe, her dawn back view as a white blob,
  and two captions collided with the art. All fixed.

**Pass 4.** The brief asks for smear frames and the film had almost none (only
the falling drop's trail). I added the four listed above.

**Bugs the determinism test caught.** The first run matched only 14 of 57
frames. GPU Canvas2D anti-aliasing varies from run to run. Separately, the
shader painter leaked an earlier painting into the edge of a scaled one; this
showed on the right edge of the underwater shot. Both are fixed.

### Is it striking, or generic?

**Striking:**

- The premise and its arithmetic, which hold up all the way through.
- The first five seconds.
- The web becoming her iris.
- "do you get lonely?" followed by MATCHES: 0.
- The silence, and the dawn.
- The raindrop that is named at 20 s and lands on her nose at 77.5 s.
- The painted skies and the rooftop wide shot, which look best.

**Closer to generic:** the drop. It is five postcards with caption cards, using
a familiar "possible lives" montage shape. Across the whole film, the character
animation reads as clean vector work with good compositing. It would not pass for
studio sakuga.

## Checks (final delivered files; log in `out/checks_log.txt`)

| Check | Result |
|---|---|
| Full decode, `ffmpeg -v error` | clean on both MP4s, exit 0, 2100 / 2100 frames |
| Duration | video 87.500 s and audio 87.500 s on both; WAV 87.500 s |
| Format | H.264 High, 1920×1080, 24 fps, yuv420p, `moov` before `mdat`, AAC 48 kHz |
| Loudness | master **−14.1 LUFS**, X **−14.1**, WAV −14.1; LRA 11.3 LU |
| True peak (ebur128) | master **−1.2 dBTP**, X **−1.2**, WAV −1.6 |
| Clipping | 0 samples at or above −0.01 dBFS; sample peak −1.70 dBFS; 0 click candidates |
| Flashes | worst 1 s window holds **1** flash, whole frame and by area blocks, on both files; limit 3; impact frames included |
| Saturated red | at most 0.10 % of any frame |
| Luma audit | 63 steps over 5 levels, **all on listed cuts, impact frames or declared fades; 0 unexplained**; 0 one-frame spikes; elsewhere the largest change is 4.78 levels |
| Fades | all 7 are monotonic, largest step 16.7 levels (title fade-out) |
| Determinism | **91 / 91** frames bit-identical when re-rendered in scrambled order |
| Self-contained | no URLs, `fetch`, images, fonts, `fillText` or `Math.random` calls in `index.html`; it renders from `file://` |

**Hit sync.** In 13 of 15 sampled hits, the measured audio onset is within one
frame of the picture time (median 0.03 frames). The other two are measuring a
louder neighbouring sound. At 19.56 s the onset found is the cut's thud at
19.50, 60 ms before the nose chime. At 40.0 s it is the last snare of the fill.

The flash and luma checks are my own scripts. They follow WCAG 2.3.1 thresholds
but are not a certified Harding test.

## Build time

About **1 h 25 min** wall clock, from an empty folder to final files. That
includes four full-film renders. One final pass is 2100 frames at 0.14 s each
(about 5 min), plus about 30 s for the soundtrack and the encodes. I ran one
headless browser at a time, and each run closed only the browser it had
started.

## Weak spots

**The three weakest moments**

1. **The figures in the drop, 28–40 s.** The silhouettes are built from capsule
   limbs and move like paper dolls. The moon walker and sail pilot are carried
   by their backgrounds. The classroom flash at 39.0–39.5 s is the worst half
   second: the students are blobs. This should be the most impressive stretch.
   It is mostly camera moves and particles over illustrations.
2. **The pinky close-up, 65.6–67 s.** This is a key emotional beat, but both
   hands read as rubbery mittens. The fingers lack knuckle and nail structure,
   and MA's hooked finger looks a bit like a loose ring.
3. **The profile two-shot, 11–15 s** (reprised at 78.75–80 s). It is the
   stiffest drawing in the film, and it comes right after the hook, where
   viewers leave. For four seconds little moves apart from MA leaning in, hair
   sway and the playhead. Her profile and collar look flat.

**Other weak spots**

- **I have not heard the soundtrack or watched the film in real time.** Audio
  was checked by loudness, peaks, spectrogram, tonal balance, onset timing and
  click detection. None of those tells whether it sounds *good*. The synth
  piano, strings and choir are the likeliest to sound artificial. Motion was
  checked with frame strips and frame differences. Please listen once before
  posting.
- **Phone legibility.** Raindrop names at 15–19 s, the "future no." lines, the
  year counter and the small guesses are tiny in a feed. The guess cloud is
  meant to be unreadable. The names reward pausing but will be missed on a
  phone. The nose-drop tag is large on purpose.
- **Quiet middle.** 46–63 s sits near −21 LUFS and the blink near −33. The
  contrast is deliberate, but phone speakers may lose the piano.
- **MA's full body** (naming, and 52–57 s) reads as a soft mascot with tube
  limbs, with less mystery than its close-ups. Its dash smears stretch the whole
  silhouette; they are not redrawn.
- **Acting is limited.** There are holds, blinks, mouth flaps, hair sway, a
  recoil and a laugh. Mouth shapes do not follow phonemes, and there are no
  head turns.
- **The reveal's crossfade** (about 42.5–44 s) briefly looks like a double
  exposure before the eye takes over.
- **Dawn back view** (74.6–76.9 s): it is better backlit, but she is still the
  simplest drawing in an otherwise rich frame.
