Create a single self-contained HTML file using three.js that renders an ultra-detailed voxel diorama of New York City on a floating island at blue hour. The first frame looks in from New York Harbor. The Statue of Liberty leads the eye toward Lower Manhattan, the Brooklyn Bridge cuts across the East River, and the lit Empire State Building anchors Midtown farther back. Build enough depth between these silhouettes that all four read clearly as the camera moves.

## Island and composition

- Shape Manhattan into a long, tapered peninsula with a recognizable southern tip. Run the Hudson along its western shore and the East River along its eastern shore. Let them meet in a broad wedge of harbor in the foreground. Put a compact Brooklyn waterfront on the far side of the East River and Liberty Island out in the harbor. Compress distances while preserving those relationships.
- Cut the island into layered voxel strata of grey schist, weathered brown soil, and pale fractured stone. Add stepped ledges, slivers of roots below Central Park, dark pier pilings below the streets, and a jagged underside. Let the harbor spill over the front in broad ribbons, with thinner falls along the sides and mist beneath the lip. Keep the channels wide enough for moving boats and their wakes.
- Let the density change from the tight streets and piers of Lower Manhattan to Midtown's taller street grid, then open into Central Park. Scatter water towers, fire escapes, rooftop vents and lit windows across the surrounding mid-rise blocks. Leave gaps and lower roofs around the landmark silhouettes.

## Landmarks

- **Empire State Building and Chrysler Building.** Model the Empire State Building with a limestone shaft, vertical window bands, stepped Art Deco shoulders, a lit crown, and a slim mast. Give the Chrysler Building enough separation to show its silver crown, stacked triangular windows, and narrow spire.
- **One World Trade Center.** Use a square base, tapered triangular glass faces, and a slender antenna. Give it room above the clustered Financial District towers so its silhouette stays legible.
- **Brooklyn Bridge.** Build two stone towers with paired, open Gothic arches, a roadway and raised promenade, looping suspension cables, vertical hangers, and diagonal stays. Show the deck and cables against the open water. On the Brooklyn bank, put brick warehouses, a cobbled DUMBO street, and a waterfront park at the bridge approach.
- **Statue of Liberty.** Render the oxidized copper figure in stepped voxels with a seven-ray crown, sculpted robe, tablet, and a raised torch. Set it on a stone pedestal within Fort Wood's star-shaped walls. Angle the figure and camera so the face, torch arm, and tablet are readable at island scale.
- **Times Square and Central Park.** Carve out Broadway's diagonal through the grid with the red steps, colored billboard panels, a pedestrian plaza, and yellow taxis at its edges. Give Central Park an elongated footprint, layered fall foliage, curving paths, a lake, and the pale arch of Bow Bridge.

## Street and harbor life

- Move yellow cabs and city buses along the avenues, stop and release traffic at signals, and animate tiny pedestrians on the Brooklyn Bridge promenade, in Times Square, and along park paths. Add rooftop steam, gently changing billboard graphics, and enough movement on side streets to feel like a lived-in city.
- Run an orange Staten Island Ferry past Liberty Island and a smaller water taxi below the Brooklyn Bridge. Give each a bow wave, a V-shaped wake, and warm cabin lights reflected on the water. Move gulls above the piers and animate chop, waterfall spray, and mist. Hide route resets behind piers, buildings, or the edge of the primary view.

## Camera and lighting

- Set the scene just after sunset. Use a deep blue sky with a band of peach at the horizon, cool stone and water, warm apartment windows, and amber bridge lights. Let colored reflections break up across the harbor. Use soft shadows, ambient occlusion, ACES tone mapping, restrained bloom, and clean antialiasing. Preserve detail in the dark cliff faces and the bridge's stonework.
- Make a seamless 12-second loop at 30 fps with visible movement from frame one. Use a slow raised orbit that sweeps across roughly 40 degrees total and returns with a subtle push-in and pullback. Keep the Statue of Liberty, tallest spires, East River span, and rock underside comfortably inside the square frame throughout. Match camera position and velocity across the seam and keep traffic, ferries, and effects moving continuously through it.

## Delivery

Work only inside `{{FOLDER}}` (create it if missing), apart from tool installs and caches. If you need a local HTTP server, use a random high port (4xxxx).

1. `new-york.html` is the single self-contained file. The only external dependency allowed is three.js (core plus `examples/jsm` addons) from an exact pinned version on jsDelivr or unpkg via an import map. Generate all models, textures, lighting and lettering in code. Opened normally, the page plays the loop live. With `?render=1`, expose `window.renderAt(t)` with time in seconds. It must pose the whole scene and render exactly one frame independent of the wall clock or previously rendered frames. `renderAt(12)` must produce the same image as `renderAt(0)`.
2. `new-york.mp4` is rendered from that same file at 1080×1080, 30 fps, and exactly 12.0 seconds (360 frames). Encode H.264 High, yuv420p, CRF 18 or lower, and `-movflags +faststart`. The video is silent and contains no added titles, overlays, or UI.
   - Capture frames at `t = frame / 30` for frame indices 0 through 359. Drive the machine's Chrome or Edge with locally installed `playwright-core` or `puppeteer-core`, call `renderAt` for each frame, and pipe the frames into ffmpeg.
   - Verify the WebGL renderer uses the real GPU with `WEBGL_debug_renderer_info`. If Chrome falls back to SwiftShader on Windows, try `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` or run headed.
   - Capture at a higher resolution and downscale for crisp edges. Verify the output with `ffprobe`.
3. `stills/` contains 3–4 PNG frames extracted from the finished video.
4. `NOTES.md` records what you built, key techniques, the exact render command, and total build time.

Inspect renders during the build. Check that the Brooklyn Bridge arches and cables read against the water, Liberty's torch stays clear of the skyline, and the Midtown crowns remain distinct through the orbit. Fix visible z-fighting, clipping, aliasing and motion discontinuities. Verify that seeking to a time twice gives the same image and that the endpoint matches the opening frame. Watch the encoded loop across its seam and review frames from the start, every three seconds and the end.

In your final reply, provide the absolute paths to `new-york.html` and `new-york.mp4`, the `ffprobe` resolution, fps, frame count, duration and file size, and a 3–5 line summary.
