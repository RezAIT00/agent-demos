Work through this task to the finished video in this turn. Don't stop to ask questions; make your own calls and note them in NOTES.md.

# "A pelican riding a bicycle": a badass anime trailer, made entirely in code

Output folder: `{{FOLDER}}` (create it; write only inside it).

## Goal
"Generate an SVG of a pelican riding a bicycle" is the famous meme benchmark for AI models: most of them draw a broken bike and a pelican that can't possibly ride it. Turn that pelican into the hero of a **badass anime trailer**, 60–75 seconds long. Play it completely straight, like a sports or action anime season trailer, with total sincerity and total hype. The joke is how seriously it takes itself.

## The hero
- An **original pelican** of your own design. No existing characters and no lookalikes.
- Big beak with a throat pouch, a long neck, webbed feet, and a strong anime silhouette: a determined eye with a highlight glint, and wind-swept feathers.
- Give it one signature accessory, such as a scarf, goggles or a headband, and maybe a scar.
- **Riding must be physically believable.** The bicycle is a correct diamond frame with two wheels, spokes, a chain, a crank and pedals, handlebars and a saddle. The pelican's feet are on the pedals, turning the crank in sync with the chain and the rear wheel. Its wings grip the bars. Getting this right is the whole point of the meme, so render a turnaround of the pelican on the bike and check the contact points before you animate.
- Optional: a rival of your own design, such as another bird on a sleeker bike.

## Suggested shape (change it if you have something better)
1. Cold open with a hook in the first 2 seconds: an extreme close-up of an eye opening, or a pedal clicking in.
2. Lore text cards (in code-drawn lettering, cut against the music), e.g. "They said a pelican could never ride."
3. Training montage: falling over, getting back up, rain, night roads.
4. The rival.
5. A mountain downhill race at a ridiculous speed: speed lines, sparks off the rim, sliding a hairpin, jumping a gap over a canyon or between rooftops.
6. The power-up moment: the aura ignites, wings spread, the beak opens in a silent scream.
7. Title card, then a short stinger gag after the title (for example, the pouch is full of fish).

## Anime look
- Cel shading with 2–3 tones, ink outlines with tapering line weight, and dramatic painted skies and backgrounds.
- Anime grammar:
  - speed lines, smear frames, and impact frames (ink-inverted, used sparingly)
  - camera shake, crash zooms and Dutch angles
  - held dramatic poses with a wind-blown hold
  - split-screen panels, and bold kinetic title typography
- Output 1920×1080 at **24 fps**. Animate the characters on twos (12 drawings per second) the way real anime does; camera moves and effects run on ones. The wheels must not look broken, so use motion blur or smear on the spokes.
- All lettering is drawn by your code (stroked or SDF letterforms). Don't use font files or system fonts. The title is yours to choose.

## Music and sound
- A hard-hitting, original anime-opening or trailer track synthesized in code, for example with numpy. Use no borrowed melodies.
- Arrangement: drums, distorted guitar (Karplus-Strong plus distortion), bass, strings and brass stabs, a riser into the drop, and a key change at the climax.
- Big hits synced to the cuts.
- Sound design: freewheel ticks, chain whir, wind roar, tire skids, whooshes and impacts.
- No TTS and no recorded or downloaded audio. A pelican squawk or a wordless battle cry synthesized in code is welcome if it sounds good.

## Rules
- Everything is made in code. No image, video, audio, font or 3D-model files, no generative models, no network requests, and no third-party characters.
- Make one self-contained index.html exposing `window.DURATION` and `window.renderAt(t)`. Each frame must be a deterministic, pure function of t. The renderer is up to you: Canvas2D, WebGL2 or WebGPU, with no libraries.
- Capture frame-exact with headless Edge or Chrome and pipe the frames to ffmpeg.
- Keep VRAM use reasonable and never kill processes you didn't start.

## Process and checks
1. Write TREATMENT.md first: the beats with timings, the pelican and bike design, the music plan, and the 3 moments meant to make people rewatch.
2. Render character_sheet.png: the pelican in 5 expressions, plus a pedal-cycle sheet showing the feet on the pedals across a full crank rotation. Check it before animating.
3. Build the film, then do at least 2 critique passes. Each pass:
   - render a contact sheet (one frame every 2 s) plus stills of the key moments, and look at them yourself
   - fix the weakest shots
   - be honest about whether it's actually badass and funny, or generic
4. Before delivery:
   - Luma audit: no unintended brightness pops between frames.
   - Flashes: at most 3 per second, with impact frames counted.
   - Audio: about −14 LUFS integrated, true peak ≤ −1 dBTP, no clipping.
   - Decode: full decode with `ffmpeg -v error` comes back clean, and audio and video durations match.

## Deliver (all in the output folder)
- index.html, plus src/ and tools/ with your source.
- pelican_trailer.mp4: H.264 crf 16, yuv420p, +faststart, AAC 320k.
- pelican_trailer_x.mp4: a smaller copy for X, around 8 Mbit/s.
- soundtrack.wav, contact_sheet.png, thumbnail.png, character_sheet.png.
- TREATMENT.md and NOTES.md: what you built, how it renders, the checks and their numbers, build time, and your honest list of weak spots.

Finish with a short reply giving the file paths, duration, sizes, loudness, and the 3 weakest moments.
