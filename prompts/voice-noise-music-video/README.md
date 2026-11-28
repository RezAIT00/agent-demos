# Voice-Noise Music Video

[`prompt.md`](prompt.md) gives a coding agent [`noises.m4a`](noises.m4a), a 7.7-second recording of someone making six basic noises with their voice: "Ahh", "Ooo", "Mmm", "Nyaa", "Dum" and "Eee". Using only those noises, the agent has to recreate a popular song of its choice, including the sung vocal line, not just the backing music. It then makes a 100% animated, original, anime-style music video that opens with the raw recording.

The prompt sets no rules on tools, format, length or checks. It's written casually, the way a person would ask.

Before sending the prompt, `{{RECORDING}}` is replaced with the path of a copy of `noises.m4a`, and `{{FOLDER}}` with the path of an empty output folder.

## Generations

| Generation | Still | Harness | Effort | Build time | Files |
|---|---|---|---|---|---|
| [Sonnet 5.6 (next)](generations/sonnet-5.6-next/) | <img src="generations/sonnet-5.6-next/stills/t_19.5s.png" width="260" alt="Sonnet 5.6 (next), Koe smiling over the night city with the six noise spirits at 19.5 s"> | Claude Code (T3 Code) | xhigh | 47 min | [video](generations/sonnet-5.6-next/music_video.mp4) · [song](generations/sonnet-5.6-next/song.m4a) · [notes](generations/sonnet-5.6-next/NOTES.md) |

Build time is the agent's working time. Unlike the other generations in this repo, this one was made over several messages, not from `prompt.md` in one go. [`generation.json`](generations/sonnet-5.6-next/generation.json) has the details.

The Sonnet 5.6 (next) generation covers **"Take On Me" by a-ha** in an 82-second, 1080p, 24 fps video:
- **Opening:** the recording plays unchanged while each noise hatches a spirit character.
- **Story:** Koe, an original heroine in headphones, brings sound back to a silent city and defeats a monster called the Hush.
- **Sung lines:** the noises sing the verse and the chorus. Each syllable uses the noise with the closest vowel, and on-screen captions spell what's sung in noises ("Eee Dum Eee Nyaa Eee").

Every sound comes from the recording:
- The melody, chords and bass are the held notes, re-pitched.
- The drums are built from slices of the six noises.
- The reverb and echo are delayed copies of the song.

No synthesizer, sample or audio from the original song is used.

The agents' [`NOTES.md`](generations/sonnet-5.6-next/NOTES.md) lists their own weak spots:
- The verse and chorus note lengths were set from memory.
- Some high notes are about three octaves above the recording and sound squeaky.
- Only verse 1 and the chorus are sung.

The code is in [`source/`](generations/sonnet-5.6-next/source/):
- `source/tools/arrange.py` builds the song, with `sampler.py` and `kit.py`.
- `source/video/` holds the animation engine and `render.mjs`, which captures it in headless Edge.

The repo copy of the video is a 91 MB two-pass re-encode of the agent's 136 MB master, to fit under GitHub's 100 MB file limit.
