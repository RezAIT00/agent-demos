# Take On Me, performed by six voice noises

Compiled from the agents' own final reports and project notes.

An 82-second, 1080p, 24 fps anime music video for a cover of **"Take On Me" by a-ha**. Every sound in it comes from the 7.7-second input recording of six noises: Ahh, Ooo, Mmm, Nyaa, Dum and Eee.

## The video

- **Opening (0:00–0:09):** the recording plays unchanged, while each noise hatches its own spirit character.
- **Story:** Koe, an original heroine in headphones, brings sound back to a silent city and defeats a monster called the Hush. There's a stroll through the city with the six spirits, a rooftop chase, a flight into space, a transformation, a giant voice beam and a dance finale.
- **Song:** a quiet intro, the riff, a sung verse, a muffled breakdown, the chorus and a final riff.
- **Sync:** the animation is driven by the song's note events. The spirits react to their own noises, and Koe's mouth follows the lead vocal.
- **Captions:** a plate at the bottom spells each sung syllable in noises ("Eee Dum Eee Nyaa Eee"), and the noise being sung lights up. The real lyrics aren't on screen.
- **Original art:** everything is drawn by code written for this video, with no stock footage, borrowed art or AI-generated images.

## The sound

- **Melody, chords and bass:** the six held notes, cut into pitch-period grains and re-spaced to play any note at any length (`source/tools/sampler.py`).
- **Lyrics:** the noises can't say words, so each sung syllable uses the noise whose vowel is closest. The vowels were measured as F1/F2 formants: Eee 260/2380, Ooo 310/890, Dum 640/1090, Nyaa 720/1360 and Ahh 745/1250 Hz. Mmm is a hum. The score stores only pitch, length and noise for each syllable, never the words (`VERSE` and `CHORUS_SYL` in `source/tools/arrange.py`).
- **Drums:** the recording has no percussive noises, so every drum is built from the six (`source/tools/kit.py`).
  - Kick: the "o" of Dum bent sharply down in pitch, with its "D" as the click.
  - Snare: a pitched-up piece of Ahh, plus the "D" and a hiss.
  - Hats and cymbals: the hiss is made of thousands of very short slices of all six noises, shuffled and high-passed. Random numbers only choose which slice goes where. No noise generator is used.
- **Effects:** reverb and echo are delayed copies of the song itself. Filtering, saturation and limiting shape the mix. No synthesizer, sample or audio from the original song is used.

## How it renders

- `python -B source/tools/arrange.py` writes `source/out/song.wav`, `soundtrack.wav` (the recording, then the song), the stems and `events.json`. That last file drives the animation. It needs numpy and scipy, and ffmpeg on the PATH.
- `cd source/video && npm install && node render.mjs` opens `index.html` in headless Edge, writes `data.js` from `events.json`, and renders every frame. The frames are piped to ffmpeg with the soundtrack and encoded as H.264 crf 20. `stage.mjs` expects Edge at its default Windows path.
- `node still.mjs <dir> --sheet <name> t1 t2 ...` renders test frames.

## Checks

- Melody notes measured within 4 cents of their targets, and the six noises still sound distinct at the verse pitches.
- The original recording at the start is unchanged.
- The video decodes cleanly with no black or frozen frames. The audio is −13.6 LUFS integrated and doesn't clip.
- The agents can't hear audio, so they checked the song by measuring it and checked the video with still frames, not by watching it with sound.

## Weak spots, in the agents' own words

- **Verse and chorus timing:** the pitches follow a published transcription, but the note lengths were set from memory. This is the likeliest part to sound wrong.
- **High notes:** some are about three octaves above how they were recorded, so expect them to sound squeaky or synthetic.
- **Missing sections:** only verse 1 and the chorus are sung. Verse 2, the bridge and the later choruses aren't in the arrangement.
- **Flashes:** the video has rapid flashes.
