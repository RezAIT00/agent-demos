# Task: an ULTRA-REALISTIC, photoreal HDR voxel sandbox game in ONE HTML file

You are the sole engineer on this build: you write all the code, run it, test it, render it and fix it. Nobody else will touch the code.

Build a complete, playable first-person voxel sandbox game (explore, mine, build, craft, survive the night) as ONE self-contained HTML file with three.js. The twist that defines this project: it is the **ultra-realistic** take on the block-sandbox genre. The world is still made of 1 m cubes you can mine and place one by one, but it must look like a photograph of a real place that happens to be built from blocks: real-looking stone, soil, bark, sand, snow, water, sky, light and weather. Think "a AAA photoreal engine renders a block world", not "pixel art with bloom". It is a public showcase posted on X: the kind of shot where people ask "this is a block game? in a browser?". It must also be a real, comprehensive game, not a tech demo with a camera.

Make it an original game: invent its name, block set, creatures, items and UI. Do not copy any existing game's name, logo, textures, characters, creatures, sounds or menus. No blocky green exploding creatures, no famous block-game mob silhouettes, no famous block-game default-character look. Your creatures, items and menus are your own designs.

## Your folder
Work ONLY inside `{{FOLDER}}` (create it if missing). Apart from tool installs and caches, touch nothing outside it. If you need a local HTTP server, use a random high port (4xxxx).

## Hard rules
- One file, `blockworld.html`. The only external dependency allowed is three.js (core plus `examples/jsm` addons) from an exact pinned version on jsdelivr or unpkg via an import map. No downloaded models, image textures, HDRIs, sound files or fonts: every texture, material, model, sound and the sky is generated in code. Web Workers from Blob URLs are fine. GPU-side texture generation (render-to-texture with procedural shaders at startup) is encouraged.
- The voxel grid is sacred: blocks are 1 m cubes, every block is minable and placeable, chunks stream and remesh live. Realism comes from materials, lighting, detail geometry and post-processing layered on top of the grid, never from replacing it with a heightmap or a static mesh.
- Smooth: the default "High" preset holds 60 fps at 1080p with a generous render distance on a modern desktop GPU; an "Ultra" preset may go further for screenshots and the cinematic. Mesh chunks off the main thread or in time-sliced batches so streaming never stutters. Show a short loading screen while procedural materials bake.

## World
- Seeded, effectively endless terrain streamed in 16x16 chunks (tall world, deep underground): layered noise with continents, rolling hills, cliffs, eroded ridgelines, tall mountains with snow caps and scree slopes, rivers that carve valleys, lakes and oceans with beaches. Terrain shapes should read as geologically plausible: strata visible in cliff faces, talus at cliff bases, river gravel, wet sand at the waterline.
- At least 6 distinct biomes with smooth transitions (e.g. temperate broadleaf forest, birch/blossom grove, desert with dunes and layered sandstone mesas, snowy conifer taiga, swamp or jungle, ocean with reefs), each with its own blocks, foliage colour, tree species and props.
- Caves and ravines with ore veins (several ores at different depths, each with a convincing mineral look: metallic glints, crystalline facets, oxidised stains), underground lava and water pools, glowing crystals or bioluminescent fungi.
- Several tree species with believable silhouettes (trunk taper, branching, canopy shape built from leaf blocks plus detail foliage), dense tall grass, flowers, ferns, bushes, cacti, reeds, lily pads, fallen logs, rocks and pebbles.
- Many block types (aim for 40+), including transparent (glass, leaves, ice, water), emissive (lava, lamps, torches, crystals) and functional ones (crafting table, furnace, chest, door, ladder). Functional blocks get modelled detail (a furnace with a glowing mouth and soot, a chest with planks, iron bands and a hinged lid that animates, a door that swings).

## Gameplay
- First-person controller with pointer lock: walk, sprint, crouch, jump, swim, climb ladders, creative fly toggle; solid AABB collision and step-up; subtle, physically motivated head bob, camera inertia and FOV kick on sprint; landing impact.
- A realistic first-person viewmodel: hands/arm and held item (tool with wood grain handle and forged metal head, a torch with real flame, a held block) with idle sway, swing and mining animations, lit by the scene (shadows, torchlight).
- Mining with hardness, a break overlay that looks like real cracking/chipping (not pixel cracks), debris particles that are lit, shadowed, bounce and settle; dust puffs; block placement with a soft "thunk"; item drops that are small 3D objects which float, bob and get picked up.
- Hotbar (9 slots, mouse wheel / number keys), full inventory screen, chests, a crafting grid with real recipes (planks, sticks, tools of several tiers, torches, glass, lamps, doors...), furnace smelting with visible fire. Item icons are rendered from the real 3D materials.
- Survival and creative modes: health, hunger, fall, drowning and lava damage, respawn; creative has a searchable block palette.
- Full day/night cycle. Passive animals that wander, graze, flock and flee, with smooth procedural animation (legs, heads, tails) and natural-looking shading (fur/feather/scale approximations, not flat colour boxes). Original hostile night creatures with pathing that chase the player, telegraphed attacks and simple combat with knockback, hit flashes and death animations.
- Synthesized WebAudio sound with a realistic character (filtered noise, granular textures, convolution reverb that changes in caves): footsteps per material (grass, gravel, stone, sand, snow, wood, water), mining and placing, ambient wind that rises with altitude, birds by day, insects and crickets by night, rivers and surf, rain and thunder, cave drips and echoes, fire crackle.
- Title screen (a live 3D scene of the world behind it), pause menu, settings (render distance, shadow quality, FOV, mouse sensitivity, graphics preset Low/Medium/High/Ultra), a debug overlay with FPS, frame time, draw calls and coordinates, save/load of the world edits and player to localStorage. Clean, modern, original UI typography and layout.

## Graphics: ultra-realistic HDR (this is the showcase)
### Materials
- Physically based materials for every block, generated in code at startup: high-resolution procedural textures (at least 256x256 per face, 512x512 on Ultra) stored in texture arrays with full mipmaps and anisotropic filtering. Each material has albedo, normal, roughness, ambient occlusion and height channels. Linear filtering, not nearest: this is photoreal, not pixel art.
- Material work that sells realism: stone with mineral grain, fractures and lichen; soil with clods, roots and pebbles; grass-topped blocks whose top blends into the side with overhanging grass; bark with deep furrows; sand with ripples and grain sparkle; snow with sparkle and soft subsurface look; ice with internal cracks and refraction; planks with real grain and nail holes; metal ores with anisotropic glints; glass with subtle imperfections.
- Break the tiling: world-space macro variation, stochastic/hex tiling or texture bombing so no two neighbouring faces look identical; slope- and exposure-aware detail (moss on shaded north faces and cave ceilings, snow accumulating on block tops at altitude, wet darkening near water).
- Parallax occlusion mapping (with self-shadowing where it pays off) on stone, cobble, brick, bark and gravel, so flat faces show real depth at grazing angles.
- Soft bevelled block edges in the shader (edge normal rounding plus edge AO/wear) so blocks read as cut physical stone and timber, while silhouettes stay cubic.

### Vegetation
- Leaves are not opaque cubes: leaf blocks render as dense alpha-tested (alpha-to-coverage) clusters of individual leaf cards with translucency/subsurface backlighting, so the sun glows through canopies.
- Dense instanced grass blades, flowers and ferns on grass blocks with distance-based density falloff, all swaying in a shared wind field with gusts that ripple across meadows; trees sway at the canopy.

### Light and atmosphere
- Full HDR pipeline: render into half-float targets, AgX or ACES tone mapping with automatic exposure (eye adaptation: walking out of a dark cave into daylight blooms, then settles), filmic colour grading per time of day, physically scaled bloom driven by real HDR intensities (sun, lava, lamps, crystals, lightning).
- Physically based sky with Rayleigh/Mie atmospheric scattering (precomputed LUTs welcome) that changes from dawn to noon to golden hour to night; sun and moon discs with limb darkening, moonlight, stars and a faint galaxy band at night.
- Raymarched volumetric clouds (cumulus by day, storm towers when weather turns) that cast shadows on the terrain and catch sunset colours.
- Sun shadows with cascaded shadow maps (4 cascades, stable texel snapping, PCSS-style or soft PCF filtering), contact shadows for small detail; crisp up close and stable while moving.
- Ambient occlusion at every scale: per-vertex voxel AO, plus screen-space AO (GTAO/SAO quality) for detail geometry.
- Indirect light: smooth voxel light propagation for sky light and block light (caves are truly dark, torchlight falls off softly and colours walls warm), plus cheap colour bleed / bounce approximation so sunlit sand lights the underside of overhangs warm.
- Volumetric fog and light shafts that are actually shadowed (raymarched against the shadow map): god rays through forest canopies and cave openings, glowing haze in lava caves; height fog and aerial perspective so distant mountains turn blue and soft.
- Water: Gerstner/FFT-style waves on the ocean, calmer flow on rivers that follow the current, animated normals, Fresnel, screen-space reflections with sky fallback, refraction with depth-based absorption (turquoise shallows to deep blue), foam at shorelines and around obstacles, caustics on the bottom, underwater fog, colour shift, light shafts and muffled audio.
- Torches, lava, furnaces and lamps flicker with dynamic shadowless point lights (with a budget and culling); lava has a convincing crust that glows through cracks.
- Weather: rain with streaks, splashes, puddles and wet glossy darkened surfaces with reflections (wetness raises specular, lowers roughness) in some biomes; snow with accumulation in cold ones; thunderstorms with forked lightning that lights the whole world and the clouds from inside.
- Clean anti-aliasing (TAA with good history rejection, or SMAA plus supersampling on Ultra), no shimmering on edges, foliage or specular highlights. Sharpening after TAA.
- Camera realism used with taste: subtle lens flare from the sun, physically based depth of field and motion blur, chromatic aberration, vignette and film grain only in the cinematic.

## Cinematic mode and video
- `blockworld.html?demo=1` runs a scripted cinematic flythrough of a fixed seed on the Ultra preset and exposes `window.renderAt(t)` (t in seconds) that poses camera, sun, clouds, weather, water, wind, foliage, creatures and particles for time t and renders exactly one frame, with no dependence on wall-clock time; re-rendering a frame gives the identical image. TAA/temporal effects must converge deterministically (e.g. render a fixed number of jittered sub-frames per output frame).
- The film is 30.0 s: sunrise over mountains and ocean with volumetric clouds, a low glide across a forest meadow with grass waving and light shafts through the canopy, dive into a cave lit by lava and crystals with the exposure adapting, out over a desert at golden hour, a thunderstorm rolling in with lightning and rain-soaked reflective ground, ending on a night sky over a torch-lit village or build. Slow, confident camera moves with easing, no clipping.
- `blockworld.mp4`: 1920x1080, 60 fps, exactly 30.0 s (1800 frames), H.264 High, yuv420p, CRF 18 or lower, `-movflags +faststart`, no audio, no text or UI in frame. Capture deterministically frame by frame through `renderAt` with a locally installed `playwright-core` or `puppeteer-core` driving the machine's Chrome or Edge, piped into ffmpeg; never screen-record in real time. Make sure WebGL runs on the real GPU (`WEBGL_debug_renderer_info` must not report SwiftShader), e.g. `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` on Windows, or run headed. Render supersampled (e.g. 2x) and downscale. Verify with ffprobe.
- `stills/`: 4-6 PNG frames from the film plus 2 gameplay screenshots with the HUD.
- `NOTES.md`: what you built, controls, key rendering techniques, the exact render command, how long it took.

## Quality bar
Play the game yourself through the browser (move, mine, build, craft, survive a night) and fix every bug you find. Look at your renders (open the PNGs with your image-reading tool) again and again and critique them harshly, like a lead graphics engineer at a AAA studio judging photorealism: does this look like a photograph? Hunt for anything that betrays "game": flat or plastic-looking materials, obvious texture tiling, banding, shadow acne, peter-panning, light leaks into caves, chunk seams, z-fighting on water, shimmering or aliasing, flat lighting, blown-out or crushed highlights, over-saturated colours, fog that looks like a wall, foliage that looks like cardboard. Fix and re-render. Before calling it done, extract and review frames from the finished MP4 (start, every ~3 s, end).

Do not cut scope or settle for a quick version: this is a flagship showcase. If something has to be simplified for performance, keep it on Ultra and scale it down only in lower presets.

## Final reply
Absolute paths to `blockworld.html` and `blockworld.mp4`, the ffprobe stats (resolution, fps, frame count, duration, file size), the controls, the total build time, and a 3-5 line summary of what makes it look realistic.
