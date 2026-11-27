Work through this task to the finished video in this turn. Don't stop to ask questions; make your own calls and note them in NOTES.md.

# Color vs. monochrome: a 50-second anime fight where every hit lands, made entirely in code

Output folder: `{{FOLDER}}` (create it; write only inside it).

## Goal
Make an extremely cinematic 50-second anime fight between two original characters:
- one is in **full colour**
- the other is **not in colour at all**: pure black, white and greys, like living ink

The whole point is **impact**. Every hit must feel insanely heavy and insanely destructive, so a viewer flinches, rewinds and sends it to a friend. Story, lore and dialogue are secondary. If you have to choose between a nicer drawing and a harder hit, choose the harder hit.

## The two fighters
- Both are **original designs** of your own. No existing characters and no lookalikes.
- Give each a strong, instantly readable silhouette, a fighting style, and one signature move, and make the two contrast: fast against heavy, wild against precise, or whatever you choose.
- **Colour versus no colour is the core visual idea, and the rule must stay consistent and readable in every frame.** You decide how the world relates to them, for example:
  - a grey world that the coloured fighter paints as they fight
  - a colour world that the monochrome fighter drains
  - debris and shockwaves that take the colour of whoever caused them

  Write the rule in TREATMENT.md and keep it all the way through. The audience must always know who is who, even in a blur.
- Stylized violence only: no gore and no blood.

## Impact: the most important part of this brief
Every contact is built like a punchline. Use all of this, and use it with intent:

- **Anticipation, contact, follow-through.** Each big hit has a wind-up that the viewer can read: the coil, the eyes, the gathered energy, sometimes a beat of silence. Then contact, then the follow-through, where the victim is launched, the attacker over-rotates, and debris flies.
- **Hit-stop.** At contact, freeze or nearly freeze both fighters for 2–8 frames, scaled to the hit's size, while shockwaves and debris keep moving. This single trick sells weight more than anything else.
- **Impact frames.** On the biggest hits, use 1–3 frame impact frames: ink-inverted, two-tone or silhouette frames, sometimes cracked like broken glass. They must stay within the flash limit.
- **Camera.** Use crash zooms, whip pans, Dutch angles and push-ins. Shake is directional, along the hit's force, with fast decay, never random jitter. Pull the camera way back after a hit so the viewer sees how far someone flew and what they destroyed.
- **Time.** Ramp speed: slow motion into contact, a hard snap back to full speed, and occasionally a held frame. Contrast is everything, so put quiet before loud and stillness before violence.
- **Shockwaves.** Use radial rings that distort the image behind them, ground ripples, dust walls, air shock (a visible condensation-like disc), radial speed lines and smear frames.
- **Destruction that escalates.** The setting gets wrecked, and every major hit breaks something bigger than the last: a wall, then a street, then a building, then the ground itself. End in a crater or a skyline that is gone. Debris has real physics: chunks with mass, spin and parabolic arcs, bouncing and settling, plus gravel, dust and smoke that hang in the air. Craters and cracks stay; nothing resets between shots.
- **Escalation curve.** Plan a hit list in TREATMENT.md with at least 10 major impacts. For each, give its time, its scale from 1 to 10, what breaks and its sound. The scale only goes up overall. Mark the 3 hero impacts that get the full treatment, and make the final hit the biggest moment in the film by far.
- **Sound is half of the impact.** Each hit gets:
  - a sharp transient crack
  - a sub-bass thump you feel
  - a body or material layer: stone, metal, glass or air
  - a debris tail
  - for the big ones, a bass drop or a moment of near silence just before contact

  Duck the music hard on every hit. Each hit's transient must land on its contact frame, within ±1 frame. Check this with an audit.
- **Readability at speed.** In flurries of fast blows, the viewer must still understand who hit whom. Clear staging, colour contrast and screen direction beat chaos.

## Suggested shape (change it if you have something better)
1. **0–3 s:** a hook, such as an extreme close-up, a single drop of colour hitting a grey floor, or the first blow already landing.
2. **Stare-down:** both fighters, the colour rule obvious at a glance, wind, dust and one beat of silence.
3. **First clash:** both strike at once and the shockwave blows out the whole environment.
4. **Escalating exchanges:** through walls, down streets, into and out of buildings, up into the sky and back down.
5. **The lull:** both damaged, breathing. Silence. One small sound.
6. **The final exchange:** the two signature moves meet. It is the biggest impact in the film, with the colour rule paying off visually.
7. **Aftermath:** the camera pulls back over the destruction, and a final image that resolves the colour versus monochrome idea. A title card is optional and yours to choose.

## Anime look
- Cel shading with 2–3 tones, ink outlines with tapering line weight, and dramatic painted skies and backgrounds. The monochrome fighter's ink and greys must hold up against any background.
- Output 1920×1080 at **24 fps**, exactly **50.0 s (1,200 frames)**. Animate the characters on twos (12 drawings per second) the way real anime does. Camera, effects and debris run on ones, and the big hits can go on ones.
- Any lettering is drawn by your code, as stroked or SDF letterforms. Don't use font files or system fonts.

## Music and sound
- Synthesize a hard-hitting original score in code, for example with numpy: drums, distorted guitar (Karplus-Strong plus distortion), bass, strings and brass stabs, risers, and a key change or lift at the climax. Use no borrowed melodies.
- The impacts dominate the mix. The score drives the energy between hits and gets out of the way at contact.
- Sound design: whooshes, cloth snaps, footsteps, rubble, wind, debris rain, glass, metal groans and a ringing tinnitus tone after the biggest hit.
- No TTS and no recorded or downloaded audio. Wordless efforts or battle cries synthesized in code are welcome if they sound good.

## Rules
- Everything is made in code. No image, video, audio, font or 3D-model files, no generative models, no network requests, and no third-party characters.
- Make one self-contained index.html that exposes `window.DURATION` and `window.renderAt(t)`. Each frame must be a deterministic, pure function of t. The renderer is up to you: Canvas2D, WebGL2 or WebGPU, with no libraries.
- Capture frame-exact with headless Edge or Chrome and pipe the frames to ffmpeg.
- Do all of the work yourself in this session. Don't start subagents, delegate tasks or call other models.
- Keep VRAM use reasonable and never kill processes you didn't start.

## Process and checks
1. **Write TREATMENT.md first:**
   - the colour rule
   - both fighters' designs and styles
   - the beats with timings
   - the full hit list with scales
   - the music and sound plan
   - the 3 moments meant to make people rewatch
2. **Render character_sheet.png:** both fighters in a turnaround and 4 key poses each, including their signature moves. Check it before animating.
3. **Block the whole film in rough form first, with the sound,** and judge the rhythm of the hits before polishing. Then build the film.
4. **Render impact_sheet.png:** for each of the 3 hero impacts, the frames from 8 before contact to 16 after. Use it to check the anticipation, the hit-stop, the impact frames, the shake and the debris.
5. **Do at least 3 critique passes.** In each one:
   - render a contact sheet (one frame every 2 s), the impact sheet and clips of the big hits, and watch them in motion
   - find the 3 hits that feel weakest and make them hit harder
   - be honest about whether a stranger would flinch, or whether it looks like generic effects
6. **Before delivery:**
   - **Sync audit:** every major hit's audio transient is within ±1 frame of its contact frame. List them.
   - **Flashes:** at most 3 per second, counting impact frames. Count them in the frames.
   - **Luma audit:** no unintended brightness pops between frames.
   - **Audio:** about −14 LUFS integrated, true peak ≤ −1 dBTP, no clipping.
   - **Decode:** a full decode with `ffmpeg -v error` comes back clean, the frame count is 1,200, and the audio and video durations match.

## Deliver (all in the output folder)
- index.html, plus src/ and tools/ with your source.
- fight.mp4: H.264 crf 16, yuv420p, +faststart, AAC 320k.
- fight_x.mp4: a smaller copy for X, around 8 Mbit/s.
- soundtrack.wav, contact_sheet.png, thumbnail.png, character_sheet.png, impact_sheet.png.
- TREATMENT.md and NOTES.md: what you built, how it renders, the hit list with frame numbers, the checks and their numbers, build time, and your honest list of weak spots.

Finish with a short reply giving:
- the file paths, duration, sizes and loudness
- the colour rule in one line
- the biggest hit and when it lands
- the 3 weakest moments
