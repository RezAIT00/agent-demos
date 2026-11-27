Work through this task to a finished, rendered result in this turn. It is a long build, so take the hours it needs. Don't stop to ask questions; make your own calls and note them in NOTES.md.

# New York, built from nothing in Unreal Engine 5, and everything in it destroyable

Output folder: `{{FOLDER}}` (create it; write only inside it, apart from Unreal's own caches).

## Goal
Build an ultra-realistic replica of a piece of Manhattan in Unreal Engine 5.8, as a real Unreal project, and film it. A New Yorker should recognize it at street level and from the air. Someone watching the film on a phone should wonder for a second whether it's real footage.

You make everything: the street grid and buildings, the cars and traffic, the pedestrians, the street furniture, the materials and textures, the sky and weather, the effects and the sound. The lighting has to be the best thing about it. The weather has to be real weather, not a filter.

Then make everything in the city destroyable with realistic physics, and give the player an arsenal of at least 80 destructive tools, from tiny to world-ending. The city and its destruction must both look solid and heavy. Nothing may look like it's made of cardboard.

## Where
Pick one real area of Manhattan that reads as New York instantly. For example:
- Midtown around 5th Avenue and 42nd Street, with the Empire State and Chrysler Buildings in view
- the approach to Times Square
- SoHo's cast-iron streets with the Midtown skyline behind

Lay it out from your own knowledge of the real grid: avenue and street widths, block lengths, one-way directions, setback towers, and the real landmark silhouettes in the right places. Hero blocks get full detail. The rest of the city runs to the horizon at lower detail, so no shot ever shows the edge of the world. In NOTES.md, name the area and list what's accurate and what's invented.

## The city
- **Buildings:** a real mix of prewar masonry, setback art deco towers, glass curtain walls, brownstones, walk-ups and cast iron. They need depth, not flat boxes with window textures:
  - recessed windows and frames, cornices
  - fire escapes, water towers, rooftop mechanical, window AC units
  - awnings, storefronts with lit interiors (interior mapping or real geometry)
  - scaffolding and sidewalk sheds
- **Streets:**
  - asphalt with patches and cracks, worn lane paint and crosswalks
  - manholes (some steaming), subway entrances and grates
  - curbs and sidewalks with grime and gum
  - hydrants, mailboxes, newspaper boxes, trash cans and bags
  - traffic lights on mast arms that cycle, walk signals, streetlights, signs
  - bike lanes, planters and trees
- **Vehicles:** build them yourself: yellow cabs, sedans, SUVs, a city bus, box trucks and delivery vans.
  - Give them real proportions, glass and chrome, working headlights, taillights and brake lights, and wheels that turn.
  - They drive in lanes, stop at red lights and keep their distance.
  - Add parked cars too.
- **Lighting:**
  - Lumen, with hardware ray tracing, for global illumination and reflections
  - Sky Atmosphere, Volumetric Clouds, volumetric fog and physically based exposure
  - At night, thousands of lights light the city: streetlights, windows, signs and headlights. Use MegaLights or whatever makes that work.
  - Glass, wet asphalt and car paint must reflect the city correctly.
- **Weather and time of day:** one controller actor drives everything from a few parameters: time of day, cloud cover, rain, snow, fog, wetness, wind and lightning. It must cover at least:
  - clear day, golden hour, night and overcast
  - rain, with wet streets, puddles, ripples, splashes and dripping
  - a thunderstorm whose lightning lights up the city
  - fog that swallows the tops of the towers
  - snow that settles

  Transitions are continuous: streets get wet and dry, puddles grow and snow builds up.
- **Signs and billboards:** invented names and graphics only, with no real brands, logos or company names. Landmark buildings are fine. No living real people.

## Pedestrians who really walk
The sidewalks carry about 2,000 pedestrians, and their walking has to look real. Stiff, sliding mannequins ruin a city, so this needs proper work.
- **Bodies.** Articulated figures with believable adult proportions, dressed for a New York December:
  - coats, jackets, scarves, hats and hoods
  - bags, backpacks and a few briefcases
  - at least 12 variants in height, build, clothing and colour

  Faces stay simple and not uncanny: hats, hoods, scarves and soft features beat a detailed face that looks wrong.
- **Gait.** Real biomechanics:
  - heel strike, roll-through and toe-off
  - knee flexion in swing
  - pelvis rotation and tilt, with shoulders counter-rotating
  - arms swinging opposite the legs, with elbows slightly bent
  - a small vertical bob twice per cycle

  Stride length and cadence match each walker's speed, so planted feet don't slide. Measure foot slip and report it. Vary speeds from about 1.1 to 1.6 m/s, plus stride, posture and start phase, so nobody walks in lockstep. Give a few a distinct style, such as a brisk commuter, a slow stroller or someone on their phone.
- **Behaviour.**
  - Ease into starts and stops, with no instant halts.
  - Wait at crossings with idle motion such as weight shifts, then cross on the walk phase of the real signal timing. Nobody walks in the roadway outside a crosswalk or crosses against the signal; check this with a test.
  - Turn corners on curves with gradual yaw.
  - Avoid each other and obstacles. Some walk in pairs.
  - In rain, umbrellas are held properly with the arm raised. In cold or snow, some have their hands in pockets.
  - Nobody pops in or out of existence in view. Fade or spawn out of sight.
- **Up close.** They should hold up at 3–5 m in Play mode, not just at a distance. If a figure can't hold up at a given distance, say so honestly in NOTES.md. In the film, keep walkers farther from the lens than the distance where they hold up.
- **Performance.** About 2,000 walkers at once must cost at most about 1.5 ms of GPU time and 1 ms of game thread at 1440p on this machine's GPU. Use LODs and pick the cheapest technique that looks right, for example walk cycles baked into vertex animation textures on instanced meshes, or a procedural gait evaluated in the vertex shader. Measure and report the cost.
- **Determinism.** Film renders must repeat exactly, so each pedestrian's state is a pure function of time.
- **No people in destruction.** The destruction film shows no human figure in any shot. In Play mode, all pedestrians fade out the moment any destruction tool is first used and stay gone until the city is reset. A key toggles pedestrians. Non-3D figures are fine and should stay: the walking-person icon on the crossing signals, statues and sculpture.

## Everything is destroyable, with realistic physics
- Everything in the city can be destroyed: buildings, cars, glass, streetlights, traffic lights, hydrants, trees, street furniture and the street itself.
- The breaking has to look real and be material-aware:
  - glass shatters into shards
  - masonry and concrete break into chunks and crumble into dust
  - steel frames show through once facades fail
  - cars crumple, flip, lose glass and catch fire
  - hydrants burst into a water spray
- Buildings fail structurally. When supports go, floors give way and the building pancakes, topples or shears. Falling mass hits its neighbours and they fail in turn, so damage cascades. Collapses throw out rolling dust clouds that fill the streets, plus smoke, fire and sparks. Rubble and debris stay where they land.
- Use Chaos Destruction: geometry collections, fracture and clustering, connection and strain, anchors and fields. Pair it with Niagara for dust, smoke, fire, sparks and shockwaves. Swapping a static mesh for a fractured version near an impact is fine if it keeps the city fast.
- For the films, record the simulations with Chaos caches so the Movie Render Queue renders are deterministic.

## The destruction arsenal: at least 80 tools, from small to big
- Design at least 80 distinct destructive tools, ordered from tiny to world-ending. For example, a firecracker → a sledgehammer → a grenade → demolition charges → an artillery shell → a wrecking ball → a meteor → an earthquake → a tornado → alien tech → a nuke, and beyond.
- Mix the kinds:
  - weapons and explosives
  - demolition tools
  - vehicles and impacts
  - natural disasters
  - sci-fi and alien tech
  - absurd ones, such as a gravity flip or a giant bowling ball
- Each tool must look and behave differently: its own physics, effects, sound and scale of damage. 80 recolours of one explosion doesn't count.
- The biggest tools need large-scale effects, and the destruction film ends on them, so they must be its best shots. Each of the top 5 needs:
  - a bright onset that stays within the flash limit
  - a visible shockwave and condensation ring traveling outward
  - blocks visibly flattened outward from ground zero
  - a fireball that rises and becomes a real mushroom cloud built from volumetrics, with a stem, a turning cap and self-shadowing
  - dust and debris surging through the streets
- Keep the flash rule of at most 3 flashes per second everywhere, including for the nuke.
- Keep it a sandbox. Nothing may recreate a real attack: no aircraft flown into buildings, and no named real-world events.

## Realism: nothing made of cardboard
The usual giveaways are things that read as light, thin, clean and flat. Design against them from the start, and hunt for others in your own renders:
- **Thickness.** Broken walls, slabs and facade pieces have real thickness: masonry walls about 30–60 cm, floor slabs about 20–30 cm. Broken faces get their own rough interior material (raw concrete, brick core, rebar stubs, plaster), and the edges are jagged, not clean planes.
- **Weight.** Real densities and real gravity at real scale; concrete is about 2,400 kg/m³. Keep damping low. Use a believable size spread: a few huge slabs, many chunks, lots of gravel, then dust. Big pieces break again when they land. Nothing floats or drifts.
- **Surfaces.** Add surface detail and weathering everywhere:
  - brick and mortar relief, stone grain, concrete pores
  - grime streaks under sills and cornices, water stains, soot near roofs and vents
  - edge wear, darker dirt at street level
  - per-building colour and roughness variation
  - roughness breakup on glass and car paint, and decals for stains, cracks and patches
  - bevelled edges, so corners catch light instead of looking razor sharp
- **Lighting and camera.** Proper contact shadows and ambient occlusion, so objects sit in the world, not on it. A filmic grade with slight desaturation, plus restrained lens effects: motion blur, depth of field where it fits, subtle grain, light bloom, faint chromatic aberration, and a little handheld camera motion at street level.
- **Dust and smoke.** Dense, heavy and self-shadowed, never puffy like cotton. It rolls along the ground and through the streets, and the volume turns over and dissipates slowly. Shadowed dust in a street canyon is still lit by the sky and the pavement, so it stays brown, not black.
- **Low sun.** At golden hour, sunset and sunrise, grazing light exposes z-fighting, shadow acne, moiré on facades, and light leaking through thin mullions or fins. Check every low-sun shot in both films with full-resolution crops of several consecutive frames, not just single stills, so shimmer shows up. When you find stripes or shimmer, find the actual cause by isolating it: hide facade layers one at a time and test the shadow settings. Fix the cause rather than masking it.

Keep Play mode smooth: 60 fps or better at 1440p on this machine's GPU, both flying around and while tools are used. Prefer realism wins that cost little at runtime: materials, textures, decals, Nanite detail, post-processing and better effects, not simply heavier simulation. Measure the frame rate and put the numbers in NOTES.md.

## Rules
- You make every mesh, material, texture, vehicle, person, animation, effect and sound yourself, in code or in Unreal's own tools. That includes:
  - Python editor scripting, C++ and Blueprints
  - PCG, Geometry Script and Modeling Tools
  - material graphs and Niagara
  - meshes, textures and animation that your own code generates and imports
- Don't use any downloaded or pre-made content:
  - no Fab or Marketplace assets, Quixel or Megascans, City Sample or MetaHumans
  - no Starter Content, template meshes, template mannequins or template animations
  - no Mixamo, motion capture or downloaded animations
  - no HDRIs, photos, scanned textures or sound files
  - no generative models (image, video, 3D or audio)

  Engine features and plugins are fine, and so are the engine's basic primitive shapes.
- Use the network only to install tooling, such as pip packages for your build scripts. Never use it for content or reference images.
- Do all of the work yourself in this session. Don't start subagents, delegate tasks or call other models.
- Keep the output folder under 100 GB and leave at least 100 GB free on the drive. Delete frame sequences once they're encoded.
- Keep VRAM use reasonable and run one editor instance at a time when rendering. Never kill processes you didn't start.

## Deliver (all in the output folder)
1. **The project:** `NYC/NYC.uproject` opens in UE 5.8 without errors, with the main level set as the default map. In Play mode:
   - you fly around the city, and keys switch the weather and time of day
   - a tool selector lists every destruction tool by tier; you pick a tool and use it with the mouse (aim, fire or place, depending on the tool)
   - a reset key restores the city, and a key toggles pedestrians

   List all the controls in NOTES.md.
2. **The city film:** `nyc_film.mp4` is a 60–90 second cinematic, the city, weather and lighting showcase.
   - Render it with Movie Render Queue at 3840×2160 and 24 fps. Encode H.264 crf 16, yuv420p, +faststart, AAC 320k.
   - It shows the city through a weather and time arc of your design. One continuous day into night, or night into day, works.
   - It has street-level, rooftop and aerial shots, and at least once it has cars, rain and lightning close to the camera. Pedestrians walk the sidewalks.
   - Synthesize the sound design in code: rain, traffic, horns, thunder, wind, city hum and subway rumble.
   - Also deliver `nyc_film_x.mp4`, a 1920×1080 copy for X at about 10 Mbit/s.
3. **The destruction film:** `nyc_destruction.mp4`, 60–90 seconds, with the same render and encode settings. It escalates from the smallest tool to the biggest, with synthesized sound, and ends on the biggest. No people appear in it. Also deliver `nyc_destruction_x.mp4`, a 1920×1080 copy for X at about 10 Mbit/s.
4. **Stills:**
   - `stills/` holds at least 12 stills at 3840×2160 across different times of day and weather
   - `contact_sheet.png` has one frame from every 3 s of the city film
   - `gait_sheet.png` shows one full gait cycle of a pedestrian from the side
5. **The destruction audit:** `tools/destruction_audit` triggers every tool on a freshly reset city, checks that something actually broke and that the picture changed, and saves a before/after still for each tool to `stills/destruction/`. Add `destruction_sheet.png` showing all of them on one sheet.
6. **DESTRUCTION.md:** the full numbered list, smallest to biggest. For each tool give its tier, what it does and how it's built.
7. **Notes and source:** `NOTES.md` covers:
   - the area, and what's accurate
   - how each part was built: city layout, buildings, vehicles, traffic, pedestrians, materials, weather, lighting, destruction and sound
   - the render settings, the checks and their numbers, and the build time
   - Play-mode frame rates at 1440p, flying and with several tools including the biggest
   - for the pedestrians: foot slip, their cost, and the closest distance at which they hold up
   - what the low-sun checks found and how you fixed it
   - your honest list of weak spots

   Put your build scripts and source in `source/` so the city can be regenerated. They may also live inside the project.

## Process
1. Plan first in PLAN.md: the area, the shot lists for both films, the weather arc, the tool list, and how you'll build each system.
2. Build in passes, and look at your own renders all the time, including moving clips, not just stills: walking errors, debris that floats and flicker only show in motion. After each major system:
   - render stills and clips
   - compare them honestly with what real photos and footage of that spot look like, from memory
   - list the five things that most give it away as CG, and fix them
3. Do at least 3 critique passes on the whole thing before the final renders. In each one, ask what still looks like cardboard, check the low-sun shots with full-resolution crops, and measure Play mode's frame rate.
4. Before delivery:
   - **Decode:** a full decode of both films with `ffmpeg -v error` comes back clean. The frame count and duration match, and so does the audio duration.
   - **Audio:** about −14 LUFS integrated, true peak ≤ −1 dBTP, no clipping.
   - **Flashes:** lightning, explosions and other flashes stay at 3 per second or fewer.
   - **Flicker:** no unintended brightness pops or flicker between frames, from Lumen temporal artifacts, exposure jumps or streaming pop-in. Add a scan that catches small high-frequency shimmer, not just whole-frame brightness, and record its numbers.
   - **Audit:** every tool passes the destruction audit.
   - **Project:** it opens and the default map loads with no errors in the log.

Finish with a short reply giving:
- the file paths, both films' durations and file sizes, and their loudness
- the weather arc in one line
- the number of tools, and the smallest and biggest
- Play-mode frame rates
- the 3 weakest shots of the city film and the 3 weakest destruction moments
