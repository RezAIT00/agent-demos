Create a single self-contained HTML file using three.js that renders a physically exact "what if" film: a quiet old-town street at night in a world where light travels at only 5 metres per second. Someone switches on a lamp, and we watch the light itself crawl through the scene. The light is the hero, and it must be correct.

THE PHYSICS (non-negotiable)
The speed of light is c = 5 m/s. Everything else (people, objects, the camera) moves slowly enough that only light travel time matters, so compute all delays from the camera's current position and ignore relativistic aberration and Doppler shift.
A surface point P lit by the lamp appears lit to the camera only when t − t_on ≥ (|lamp→P| + |P→camera|) / c. The visible lit region is therefore the inside of a growing ellipsoid with the lamp and the camera at its two foci, not a sphere around the lamp. Its edge is a soft warm-white front a few centimetres wide.
The bulb itself appears to switch on only after |lamp→camera| / c seconds, at the same instant as every point on the straight line between them. Before that, nothing changes.
Shadows arrive with the light: a shadowed point simply never receives it. Reflections use the full bounce path. A puddle or mirror shows the lamp, and the things it lights, only once the path lamp→surface→mirror→camera has been covered. Render planar reflections with a mirrored virtual camera and gate them by that path length. Longer paths arrive later and also linger later.
Thin mist in the air makes the front visible in mid-air as a glowing ellipsoidal shell sweeping outward, including through the open window.
Switching the lamp off sends out a front of darkness by exactly the same rule. Short paths go dark first, and distant reflections are the last thing to fade.
Moonlight and sky fill are steady and already arrived. They never change with the lamp.

THE STREET
A narrow cobbled lane after rain: wet stone setts with puddles, plastered and brick façades with shutters, wrought-iron balconies, laundry lines, flower boxes, and a café with tables and chairs and a large mirror behind the bar, seen through its window. Also a shop window full of glass bottles, an old street lamp, a bicycle leaning on a wall, a cat sitting on a wall, moths, ivy, gutters dripping slowly, and a church tower at the end of the lane.

FILM (20 s, 30 fps, motion from the first frame)
The camera stands about 10 m from a third-floor window with a bare bulb. A figure in the window flips the switch at t = 0. The camera sees the figure by moonlight about 2 s late, so the hand on the switch and the bulb igniting appear together, at about 2 s.
0–2 s: blue moonlit darkness, the camera drifting very slowly. Nothing seems to happen.
2–9 s: the bulb ignites. The lit ellipsoid swells out of the window, down the wet façade and across the cobbles, revealing objects one by one. The glowing shell passes through the mist. The café mirror and the puddles light up later than the surfaces beside them.
9–14 s: the old street lamp and a neon café sign switch on at different moments. Their fronts cross and overlap, and the camera cranes up very slowly.
14–20 s: the bulb switches off. A front of darkness chases the light out of the street, and the far puddle reflections glow last before they go dark.

LOOK
Moody, wet and beautiful: warm tungsten against cold moonlight, glossy reflections, soft shadows, filmic tone mapping, gentle bloom, fine grain. Dark scenes compress badly on X, so keep the darks clean with blue-noise dithering.

SOUND
Give the film a complete sound design: ambience, sound effects synced to the on-screen events, and a music score where it helps. Derive cue times from the same timing code the film uses, so every hit lands on the exact frame it belongs to.
Quiet night ambience: a distant city hush, a dripping gutter, faint moths, rain-wet stillness. Use the film's own physics for a twist. Sound travels at about 343 m/s, far faster than the 5 m/s light, so the switch click is heard about 2 s before the bulb is seen, and the click of switching off comes before the darkness arrives.
Under the light front, add a soft, warm tonal swell that grows as the lit region spreads and drains away with the darkness front. Add a small soft tone and a neon buzz when the street lamp and the neon sign come on.

---

## Delivery

Work ONLY inside `{{FOLDER}}` (create it if missing); apart from tool installs and caches, touch nothing outside it. If you need a local HTTP server, use a random high port (4xxxx).

1. `slow-light.html`: the single self-contained file. The only external dependency allowed is three.js (core plus `examples/jsm` addons) from an exact pinned version on jsdelivr or unpkg via an import map. No downloaded models, image textures, HDRIs or fonts: everything is generated in code. Opened normally it plays the film live. With `?render=1` it exposes `window.renderAt(t)` (t in seconds), which poses everything for time t and renders exactly one frame. It must not depend on wall-clock time or on the order frames are rendered in, so re-rendering a frame gives the identical image. Anything simulated (physics, particles, flocks, fluids) is stepped with a fixed timestep from t=0 and cached or replayed.
2. `slow-light.mp4`: rendered from that same file. 1080x1080, 30 fps, exactly 20.0 s (600 frames), H.264 High, yuv420p, CRF 18 or lower, `-movflags +faststart`, no audio, no text or UI in frame.
   - Capture deterministically frame by frame through `renderAt` with a locally installed `playwright-core` or `puppeteer-core` driving the machine's Chrome or Edge, and pipe the frames into ffmpeg. Never screen-record in real time.
   - Make sure WebGL runs on the real GPU (`WEBGL_debug_renderer_info` must not report SwiftShader), e.g. `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` on Windows, or run headed.
   - Render supersampled (e.g. 2x) and downscale for crisp edges. Verify with ffprobe.
3. `stills/`: 4 PNG frames from the video.
4. `NOTES.md`: what you built, key techniques, the exact render command, how long it took, and a Sound section with the cue sheet (time → sound) and the exact audio commands.
5. `audio/` and `slow-light-sound.mp4`: the soundtrack, muxed onto the film.
   - Generate everything yourself, free and locally: procedural synthesis in code (a Node or Python script, or an OfflineAudioContext), and/or local audio-generation tools if you have them. Don't use paid services, voices or cloned voices, downloaded samples or copyrighted music.
   - Make the audio render reproducible (seeded) and keep its source in an `audio/` folder. Export a 48 kHz stereo WAV, `audio/slow-light.wav`, exactly as long as the video.
   - Mix for X: integrated loudness about −16 LUFS, true peak at or below −1 dBTP, no clipping, and short fades at the start and end.
   - Add the audio without re-encoding the picture: `ffmpeg -i slow-light.mp4 -i audio/slow-light.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart slow-light-sound.mp4`. Keep the silent `slow-light.mp4` as well.

Quality bar: look at your renders (open the PNGs with your image-reading tool) again and again while you build, and critique them harshly. Is the light front an ellipsoid with the lamp and camera as foci? Are the reflections, shadows and switch-off delays all consistent with c = 5 m/s? Does it look like a gorgeous real street rather than a scan-line effect? Any flat lighting, z-fighting, holes, aliasing, flicker, floating objects or dead, static areas? Fix and re-render. Before calling it done, extract and review frames from the finished MP4 (start, every ~3 s, end).

Check the sound too. You can't listen, so measure: loudness and peak (ffmpeg ebur128), matching duration, and an AAC stream present (ffprobe). Render a spectrogram and a waveform image (ffmpeg showspectrumpic and showwavespic), look at them, and compare them with your cue sheet. Every big event should line up with its frame, with no unintended gaps, clicks or clipping.

Final reply: absolute paths to `slow-light.html`, `slow-light.mp4` and `slow-light-sound.mp4`, the ffprobe stats (resolution, fps, frame count, duration, file size, and the audio stream), the loudness and true-peak numbers, a short cue-sheet summary, a 3-5 line summary, and the total build time. Say plainly that a human should listen before posting.
