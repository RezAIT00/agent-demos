Work through this task to the finished video in this turn. Don't stop to ask questions; make your own calls and note them in NOTES.md.

# ASI: an anime trailer, made entirely in code

Output folder: `{{FOLDER}}` (create it; write only inside it).

## Goal
Make a 60–90 second anime-style trailer about **artificial superintelligence**. You have full creative freedom over the story, characters, tone, world and music. The bar is that people on anime and AI Twitter stop scrolling, feel something, and rewatch it.

It needs:
- a hook in the first 2 seconds
- an emotional turn
- at least one jaw-drop moment
- a title card and an ending that land

Avoid the obvious "evil robot takes over" cliché unless you subvert it.

## Characters
Characters are your own original designs. No existing anime, manga, game or film characters, and no lookalikes of them. You may use Clawd, the block creature from Claude Code's welcome screen, if you want to, but you don't have to.

Leave out real company logos and real people's likenesses.

## Anime look
- Cel shading with 2–3 tones, ink outlines with tapering line weight, and hand-painted-looking skies and backgrounds.
- Anime grammar: speed lines, smear frames, impact frames, camera shake, push-ins, lens flare, particles, held dramatic poses, and bold kinetic title type.
- Output 1920×1080 at **24 fps**. Animate the characters on twos (12 drawings per second) the way real anime does; camera moves and effects run on ones.
- All lettering is drawn by your code (stroked or SDF letterforms). Don't use font files or system fonts.

## Music and sound
- A trailer or anime-opening score synthesized in code, for example with numpy. Give it a real arc: sparse opening, build, drop, finale, with hits synced to the cuts.
- Add sound design synced to the picture.
- No TTS and no recorded or downloaded audio. A wordless vocal from code (formant synthesis) is fine if it sounds good; otherwise put any lines on screen.

## Rules
- Everything is made in code. No image, video, audio, font or 3D-model files, no generative models, and no network requests.
- Make one self-contained index.html exposing `window.DURATION` and `window.renderAt(t)`. Each frame must be a deterministic, pure function of t. The renderer is up to you: Canvas2D, WebGL2 or WebGPU, with no libraries.
- Capture frame-exact with headless Edge or Chrome and pipe the frames to ffmpeg.
- Keep VRAM use reasonable and never kill processes you didn't start.

## Process and checks
1. Write TREATMENT.md first: the logline, the beats with timings, character designs, the music plan, and the 3 moments meant to make people rewatch.
2. Build the film, then do at least 2 critique passes. Each pass:
   - render a contact sheet (one frame every 2 s) plus stills of the key moments, and look at them yourself
   - fix the weakest shots
   - be honest about whether it's striking, or generic
3. Before delivery:
   - Luma audit: no unintended brightness pops between frames.
   - Flashes: at most 3 per second, with impact frames counted.
   - Audio: about −14 LUFS integrated, true peak ≤ −1 dBTP, no clipping.
   - Decode: full decode with `ffmpeg -v error` comes back clean, and audio and video durations match.

## Deliver (all in the output folder)
- index.html, plus src/ and tools/ with your source.
- asi_trailer.mp4: H.264 crf 16, yuv420p, +faststart, AAC 320k.
- asi_trailer_x.mp4: a smaller copy for X, around 8 Mbit/s.
- soundtrack.wav, contact_sheet.png, thumbnail.png.
- TREATMENT.md and NOTES.md: what you built, how it renders, the checks and their numbers, build time, and your honest list of weak spots.

Finish with a short reply giving the file paths, duration, sizes, loudness, and the 3 weakest moments.
