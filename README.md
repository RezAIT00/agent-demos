# Agent Demos

Fixed prompts for coding agents, and what different models built from them. Every model gets the same prompt, word for word, so the results can be compared side by side.

## Prompts

| Prompt | What it builds | Generations |
|---|---|---|
| [New York](prompts/new-york/) | A voxel diorama of New York City on a floating island at blue hour: one three.js HTML file and a 12-second looping video | 2 |
| [Creates Everything](prompts/creates-everything/) | A 40–50 second one-shot film, all in code with synthesized sound, in which the model types code and the world transforms | 1 |
| [Ultra-Realistic Blockworld](prompts/ultra-realistic-blockworld/) | A playable, photoreal first-person voxel sandbox game in one three.js HTML file, and a 30-second 1080p60 cinematic | 1 |

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
