Work through this task to the finished video in this turn. Don't stop to ask questions; make your own calls and note them in NOTES.md.

# From the first humans to 2100: an 80-second animated history, made entirely in code

Output folder: `{{FOLDER}}` (create it; write only inside it).

## Goal
Make one animated film, exactly 1 minute 20 seconds long. It runs from the birth of our species, about 300,000 years ago in Africa, to what the year 2100 might look like. It should feel like one continuous journey, not a slideshow of eras. It should also move people: the last few seconds have to land. The title is yours to choose.

## The time rule (the most important constraint)
Every second of the film is a stated number of years.
- The film is exactly 80.000 s, which is 1,920 frames at 24 fps. Split it into 80 one-second slots: [0,1), [1,2) … [79,80).
- Each slot n has one rate R_n: a whole number of years per second, at least 1. There are no holds, so years pass in every second.
  - Inside a slot, the year counter moves linearly at that rate.
  - Rates change only at whole-second boundaries.
- The rates must add up exactly to the film's span. The counter starts on your chosen start year at t = 0 and reaches 2100 CE at t = 80, and the final frame shows 2100 CE.
  - Pick the exact start year, about 300,000 years ago.
  - Show the arithmetic in TREATMENT.md, minding that there is no year 0 between 1 BCE and 1 CE.
  - Document how you round the displayed year.
- A plain linear scale doesn't work: about 3,800 years per second puts all of written history in the last 1.5 seconds. You choose the schedule, fast through deep prehistory and slowing as history speeds up. That curve is the film's rhythm, so design it deliberately.
- Two numbers stay on screen for the whole film:
  - the current year, for example "c. 300,000 BCE" through "2100 CE"
  - the current rate, for example "1 second = 10,000 years"
  - Both are drawn by your code and must be readable on a phone. When the rate changes, the viewer should feel the gear change.
- Mark the present, 2026; it is now late November 2026. Everything after it is a projection, and the film should show that visually.
- Expose `window.yearAt(t)` (the exact counter value, in a convention you document) and `window.rateAt(t)` from index.html.
- Write `tools/year_audit` (Python or Node) and save its output as `year_audit.txt`. It checks every one of the 1,920 frames:
  - the counter never goes backwards
  - each slot's rate is a whole number, at least 1, and constant through the slot
  - the values at slot boundaries are exact
  - the final frame shows 2100 CE
  - the year and rate drawn on screen match `yearAt(t)` and `rateAt(t)`

## What to show
- All of humanity, not one region's story:
  - the African origins
  - the spread across every continent
  - farming invented independently in several places
  - the first cities and writing
  - and on to the present
- You choose what gets screen time. Tell it mostly through ordinary people and places rather than famous faces.
- Be honest. Wars, plagues and slavery are part of the story; show them with weight but not gore.
- Every date the film shows must be correct to the precision it shows. Contested dates get a mainstream round estimate and "c.". List every date shown on screen, with the year you used, in TREATMENT.md.
- For 2026 to 2100, make a plausible projection from today's trends: population, climate and energy, AI, medicine and space. It should be neither a utopia poster nor a collapse cliché. Make it feel earned, and hopeful only where hope is honest.
- No living real people, no brand logos and no copyrighted characters.

## Look
- The style is yours. Pick one strong visual idea that ties 300,000 years into a single journey. For example:
  - one continuous camera move
  - one place watched across time
  - one object or gesture passed from hand to hand
- Commit to the idea and make it beautiful, not an infographic.
- Keep on-screen text to what a viewer can read at the speed it appears.
- Output 1920×1080 at 24 fps.
- All lettering and numerals are drawn by your code, as stroked or SDF letterforms. Don't use font files or system fonts.

## Music and sound
- Synthesize an original score in code, with no borrowed melodies. It should evolve with the eras (instruments can arrive as humans invent them) and hit the rate changes and the 2026 marker.
- Add sound design where it helps, such as fire, wind, crowds and machines, all synthesized.
- No TTS and no recorded or downloaded audio.

## Rules
- Everything is made in code. No image, video, audio, font or 3D-model files, no generative models, no network requests and no libraries. Canvas2D, WebGL2 or WebGPU are all fine.
- Make one self-contained index.html exposing `window.DURATION` (80), `window.renderAt(t)`, `window.yearAt(t)` and `window.rateAt(t)`. Every frame must be a deterministic, pure function of t.
- Capture frame-exact with headless Edge or Chrome, and pipe the frames straight to ffmpeg.
- Do all of the work yourself in this session. Don't start subagents, delegate tasks or call other models.
- Don't keep full frame sequences on disk, and keep the output folder under 3 GB.
- Keep VRAM use reasonable and never kill processes you didn't start.

## Process and checks
1. Write TREATMENT.md first. It should cover:
   - the visual idea
   - the full 80-row rate table: second, years per second, counter at the start and end of the slot, and what's on screen
   - the start-year arithmetic
   - the list of dates shown on screen
   - the 2026–2100 projection and its reasoning
   - the music plan
2. Build the film and run the year audit.
3. Do at least 2 critique passes. In each pass:
   - render a contact sheet (one frame every 2 s) plus stills of the key moments, and look at them yourself
   - fix the weakest shots
   - be honest about whether it's moving, or just a timeline with pictures
4. Before delivery:
   - Year audit: passes on all 1,920 frames.
   - Luma audit: no unintended brightness pops between frames.
   - Flashes: at most 3 per second.
   - Audio: about −14 LUFS integrated, true peak ≤ −1 dBTP, no clipping.
   - Decode: a full decode with `ffmpeg -v error` comes back clean. The video is exactly 1,920 frames and 80.000 s, and the audio duration matches.

## Deliver (all in the output folder)
- index.html, plus src/ and tools/ with your source.
- humanity_2100.mp4: H.264 crf 16, yuv420p, +faststart, AAC 320k.
- humanity_2100_x.mp4: a smaller copy for X, around 8 Mbit/s.
- soundtrack.wav, contact_sheet.png, thumbnail.png and year_audit.txt.
- TREATMENT.md and NOTES.md: what you built, how it renders, the checks and their numbers, build time, and your honest list of weak spots.

Finish with a short reply giving the file paths, duration, sizes, loudness, the rate schedule in one line, and the 3 weakest moments.
