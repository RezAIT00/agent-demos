Create a single self-contained HTML file using three.js that renders the complete life of one snowflake, from a speck of dust to landing on a dark wool mitten. Its shape is a diary of the air it fell through, and the growth must follow real ice physics.

THE PHYSICS (keep to this)
Ice grows as a hexagonal prism. The shape it grows into depends on temperature and humidity (the Nakaya diagram):
- thin plates near −2 °C
- needles and hollow columns near −5 °C
- plates again from about −10 °C to −22 °C, branching into stellar dendrites near −15 °C when the air is very humid
- columns again below about −22 °C
As the crystal falls through layers of the cloud, each layer changes how it grows. Plates sprout arms, the arms sprout side branches when humidity spikes, and the tips grow into sectored plates when it drops. All six arms grow identically because they live through the same history; that is why a snowflake is symmetric.
Use a real growth model: a 3D or 2.5D diffusion-limited growth simulation on a hexagonal lattice (in the spirit of the Gravner–Griffeath model), driven by a scripted temperature and humidity timeline. Run it at fixed timesteps from t=0 and cache it, rather than animating a hand-drawn shape.

THE FILM (20 s, 30 fps, motion from the first frame)
0–3 s: inside a cold cloud, a microscopic dust grain glints in the light. Water vapour condenses, freezes, and a tiny hexagonal prism appears.
3–15 s: one continuous macro shot following the tumbling crystal as it falls through the cloud. The background mist shifts colour and density with each layer, and the crystal grows in visible stages: plate, then six arms, side branches, sectored tips, and a ridged, faceted centre. Tiny air bubbles are trapped inside.
15–18 s: it falls out of the cloud base into gentle snowfall over a quiet pine valley at dusk.
18–20 s: it lands on a dark wool mitten beside dozens of other flakes, every one different. The camera rests in macro on our flake, its six arms catching the light.

LOOK
Glassy ice with refraction, faceted reflections, sparkling edges and subtle thin-film interference where it is thinnest. Cold blue light with a warm rim light, deep macro depth of field with soft bokeh, filmic tone mapping. The wool fibres are crisp and fuzzy.

SOUND
Give the film a complete sound design: ambience, sound effects synced to the on-screen events, and a music score where it helps. Derive cue times from the same timing code the film uses, so every hit lands on the exact frame it belongs to.
Delicate and crystalline:
- The cloud: soft wind inside it.
- The growth: tiny glassy, shimmering tones as the crystal grows. Give each growth stage a new chime or texture, with the arms sprouting as bright little arpeggios.
- The landing: muffled snowfall over a calm valley at dusk, then a tiny soft tick when the flake lands on the mitten.
- The score: gentle and sparse, piano or celesta-like.

---

## Delivery

Work ONLY inside `{{FOLDER}}` (create it if missing); apart from tool installs and caches, touch nothing outside it. If you need a local HTTP server, use a random high port (4xxxx).

1. `snowflake.html`: the single self-contained file. The only external dependency allowed is three.js (core plus `examples/jsm` addons) from an exact pinned version on jsdelivr or unpkg via an import map. No downloaded models, image textures, HDRIs or fonts: everything is generated in code. Opened normally it plays the film live. With `?render=1` it exposes `window.renderAt(t)` (t in seconds), which poses everything for time t and renders exactly one frame. It must not depend on wall-clock time or on the order frames are rendered in, so re-rendering a frame gives the identical image. Anything simulated (physics, particles, flocks, fluids) is stepped with a fixed timestep from t=0 and cached or replayed.
2. `snowflake.mp4`: rendered from that same file. 1080x1080, 30 fps, exactly 20.0 s (600 frames), H.264 High, yuv420p, CRF 18 or lower, `-movflags +faststart`, no audio, no text or UI in frame.
   - Capture deterministically frame by frame through `renderAt` with a locally installed `playwright-core` or `puppeteer-core` driving the machine's Chrome or Edge, and pipe the frames into ffmpeg. Never screen-record in real time.
   - Make sure WebGL runs on the real GPU (`WEBGL_debug_renderer_info` must not report SwiftShader), e.g. `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` on Windows, or run headed.
   - Render supersampled (e.g. 2x) and downscale for crisp edges. Verify with ffprobe.
3. `stills/`: 4 PNG frames from the video.
4. `NOTES.md`: what you built, key techniques, the exact render command, how long it took, and a Sound section with the cue sheet (time → sound) and the exact audio commands.
5. `audio/` and `snowflake-sound.mp4`: the soundtrack, muxed onto the film.
   - Generate everything yourself, free and locally: procedural synthesis in code (a Node or Python script, or an OfflineAudioContext), and/or local audio-generation tools if you have them. Don't use paid services, voices or cloned voices, downloaded samples or copyrighted music.
   - Make the audio render reproducible (seeded) and keep its source in an `audio/` folder. Export a 48 kHz stereo WAV, `audio/snowflake.wav`, exactly as long as the video.
   - Mix for X: integrated loudness about −16 LUFS, true peak at or below −1 dBTP, no clipping, and short fades at the start and end.
   - Add the audio without re-encoding the picture: `ffmpeg -i snowflake.mp4 -i audio/snowflake.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart snowflake-sound.mp4`. Keep the silent `snowflake.mp4` as well.

Quality bar: look at your renders (open the PNGs with your image-reading tool) again and again while you build, and critique them harshly. Does the final shape plainly record the growth stages it went through, with all six arms identical? Is growth produced by the simulation rather than by morphing a hand-drawn shape? Does the ice look like real ice in macro? Any flat lighting, z-fighting, holes, aliasing, flicker, floating objects or dead, static areas? Fix and re-render. Before calling it done, extract and review frames from the finished MP4 (start, every ~3 s, end).

Check the sound too. You can't listen, so measure: loudness and peak (ffmpeg ebur128), matching duration, and an AAC stream present (ffprobe). Render a spectrogram and a waveform image (ffmpeg showspectrumpic and showwavespic), look at them, and compare them with your cue sheet. Every big event should line up with its frame, with no unintended gaps, clicks or clipping.

Final reply: absolute paths to `snowflake.html`, `snowflake.mp4` and `snowflake-sound.mp4`, the ffprobe stats (resolution, fps, frame count, duration, file size, and the audio stream), the loudness and true-peak numbers, a short cue-sheet summary, a 3-5 line summary, and the total build time. Say plainly that a human should listen before posting.
