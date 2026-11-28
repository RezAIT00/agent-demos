# Agent Demos

Fixed prompts for coding agents, and what different models built from them. Every model gets the same prompt, word for word, so the results can be compared side by side.

## Prompts

| Prompt | What it builds | Generations |
|---|---|---|
| [New York](prompts/new-york/) | A voxel diorama of New York City on a floating island at blue hour: one three.js HTML file and a 12-second looping video | 2 |
| [Creates Everything](prompts/creates-everything/) | A 40–50 second one-shot film, all in code with synthesized sound, in which the model types code and the world transforms | 1 |
| [Ultra-Realistic Blockworld](prompts/ultra-realistic-blockworld/) | A playable, photoreal first-person voxel sandbox game in one three.js HTML file, and a 30-second 1080p60 cinematic | 1 |
| [ASI Anime Trailer](prompts/asi-anime-trailer/) | A 60–90 second anime trailer about artificial superintelligence, with an original story and a synthesized score, all in code | 1 |
| [Pelican Anime Trailer](prompts/pelican-anime-trailer/) | A 60–75 second action-anime trailer starring the pelican from the "pelican riding a bicycle" benchmark, with believable riding and a synthesized score, all in code | 1 |
| [Humanity in 80 Seconds](prompts/humanity-in-80-seconds/) | An 80-second animated history from the first humans to the year 2100, in which every second is a stated number of years, with a synthesized score, all in code | 1 |
| [New York in Unreal](prompts/new-york-unreal/) | An ultra-realistic Midtown Manhattan in Unreal Engine 5.8, built entirely in code, with real weather, about 2,000 walking pedestrians and at least 80 destruction tools from tiny to world-ending, plus a 4K city film and a 4K destruction film | 1 |
| [Color vs. Monochrome Fight](prompts/color-vs-monochrome-fight/) | A 50-second anime fight between a full-colour fighter and a pure black-and-white one, built around making every hit feel insanely heavy and destructive, with a synthesized score, all in code | 1 |
| [Voice-Noise Music Video](prompts/voice-noise-music-video/) | A popular song recreated, sung lines included, using only a 7.7-second recording of six voice noises, plus a 100% original anime-style music video that opens with the raw recording | 1 |
| [Slow Light](prompts/slow-light/) | A physically exact 20-second three.js film of a night street where light travels at 5 m/s: every shadow, reflection and switch-off is delayed by its path length, and a synthesized soundtrack lets sound outrun the light | 1 |

## Layout

```
prompts/
  <prompt-name>/
    prompt.md              the exact prompt given to every model
    README.md              what the prompt asks for, and a gallery of results
    generations/
      <model>-<harness>/
        generation.json    model, harness, reasoning effort, date, build time, GPU
        NOTES.md           the agent's own notes on what it built and how
        ...                the files the prompt asks for
```

## Adding a generation

1. Start a fresh agent session and give it `prompt.md` exactly as written. If the prompt has a `{{FOLDER}}` placeholder, replace it with an empty output folder.
2. Copy the delivered files into `prompts/<prompt-name>/generations/<model>-<harness>/`. If that name is taken, add `-2`, `-3` and so on.
3. Add a `generation.json` (copy one from another generation) and a row in the prompt's README.

## Adding a prompt

Create `prompts/<prompt-name>/` with `prompt.md`, a `README.md` and an empty `generations/` folder, then add a row to the table above.
