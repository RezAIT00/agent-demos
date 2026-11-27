# PLAN: Midtown Manhattan, 5th Avenue and 42nd Street (UE 5.8.4)

## Area
Origin = centre of 5th Ave x 42nd St. Grid axes: **UE +X = uptown (grid north), UE +Y = grid east**, cm.
Grid north is true bearing 29 deg, so the sun is computed from real astronomy (lat 40.7536 N,
lon 73.9813 W) and rotated by -29 deg. Distant landmarks are placed from lat/lon.

Hero: 5th Ave 39th-43rd, 42nd St 6th Ave-Lexington, NYPL with lions, Bryant Park, 40th St.
Mid: 33rd-48th St, 7th-3rd Ave. Far: all Manhattan, East River, Hudson, Queens, Brooklyn, NJ.
Landmarks: Empire State, Chrysler, Grand Central, One Vanderbilt, NYPL, American Radiator,
500 Fifth, Grace Building, Bank of America Tower shape, 200 Park (MetLife shape, no logo),
Chanin, Daily News, Tudor City, UN Secretariat; far: One WTC, MetLife clock tower, NY Life gold
pyramid, Flatiron, 30 Rock, 432 Park, Central Park Tower, Steinway, Citigroup slant, Hudson Yards.

## The day (early December, 5-6 Dec)
Date chosen because the 5 Dec sunrise lines up with the cross streets ("reverse Manhattanhenge").
Bare London planes, steam from the street, holiday lights in Bryant Park all fit the season.

afternoon clear -> golden hour -> overcast blue hour -> rain -> night thunderstorm ->
low cloud/fog -> snow -> snow settled -> sunrise down 42nd Street -> clear snowy morning

## Shot list (about 84 s, 24 fps, 3840x2160)
| # | s | time | shot |
|---|---|------|------|
|01| 6.0 |14:50 clear | aerial from NW: ESB right, Chrysler left |
|02| 5.5 |15:35 golden | 5th Ave street level, long lens to ESB, cabs and bus |
|03| 4.5 |15:45 golden | NYPL steps and lion, low angle |
|04| 5.0 |16:05 sunset | 42nd St looking east: Grand Central, Chrysler crown |
|05| 7.0 |16:20->17:10 | rooftop with water tower, clouds close in, city lights switch on |
|06| 5.0 |17:20 rain starts | 42nd St, pavement darkens, umbrellas |
|07| 7.0 |20:00 rain | low crosswalk, cab stops close to camera, headlights through rain, steam |
|08| 6.0 |21:00 storm | aerial, lightning strikes the ESB mast |
|09| 6.0 |21:05 storm | close: cab, rain, lightning flash lights the street |
|10| 5.0 |21:30 storm | rooftop, wind-driven rain, bolt behind Chrysler |
|11| 5.0 |23:30 fog | towers vanish into glowing low cloud |
|12| 6.0 |01:00 snow | Bryant Park, lights in bare trees, gold crown of American Radiator |
|13| 4.5 |06:20 settled | library lions with snow, blue hour |
|14| 7.0 |07:18 sunrise | sun straight down 42nd Street on snow |
|15| 6.0 |07:45 clear | final aerial, snow-covered city to the horizon |

## How each system is built
- **Pipeline**: Python (venv, numpy) generates meshes (`.nmesh`, own binary format), textures
  (PNG) and a layout file. A C++ editor library turns them into Nanite static meshes and
  instanced components; Unreal Python builds materials, the level and sequences. Everything
  regenerates with one script.
- **City**: real avenue spacing and widths, street pitch from real block depth + street width.
  Landmarks hand-modelled in the generator. Other lots filled by style (prewar masonry, art deco
  setback, glass curtain wall, brownstone, walk-up, cast iron).
- **Facades**: modular bay-by-floor kits with real recesses, frames, sills, lintels, cornices,
  AC units, fire escapes; instanced Nanite. Roofs get bulkheads, water towers, HVAC.
  Glass is interior-mapped in HLSL (rooms, blinds, furniture, per-room lights).
- **Streets**: geometry curbs and sidewalks, asphalt with patches/cracks, worn paint, manholes,
  grates, subway stairs, furniture, signals, signs.
- **Vehicles**: parametric lofted bodies (cab, sedan, SUV, bus, box truck, van), glass, wheels.
  C++ traffic sim: lanes, signal phases, IDM car following, brake lights, deterministic.
- **People**: only mid/far, walking via vertex animation, umbrellas in rain. An empty Midtown
  sidewalk gives CG away more than soft distant figures do. Nothing closer than ~15 m on camera.
- **Weather**: one `ANYCWeatherController` actor; parameters TimeOfDay, CloudCover, Rain, Snow,
  Fog, Wetness, Puddles, SnowCover, Wind, Lightning. It drives sun/moon/sky/clouds/fog/exposure,
  a material parameter collection, lights, precipitation and lightning.
- **Rain/snow**: GPU-driven instanced particles (world position offset in own materials),
  deterministic under Movie Render Queue; lit from the nearest city lights and headlights.
- **Lighting**: Lumen HWRT GI + reflections, MegaLights, Sky Atmosphere, own volumetric cloud
  material and noise, height + volumetric fog, manual physically based exposure per time of day.
- **Sound**: numpy synthesis, driven by exported shot timing, traffic positions and lightning times.

## Addendum: everything is destroyable (added mid-build, 22:40)

### What changes
Play mode gains a destruction sandbox with 80+ tools; new deliverables DESTRUCTION.md,
`tools/destruction_audit`, `stills/destruction/`, `destruction_sheet.png`, `nyc_destruction.mp4`
and its X copy.  Film 1 stays the city/weather/lighting showcase.  Priority if squeezed: realism of
the city and of the breaking over polish on mid-list tools; every tool must still work.
Sandbox only: no aircraft, no vehicle-bomb or other attack scenarios, no real events.

### Architecture
- **Tagging**: the generator records, per building, its instance (group, row) refs, its own shell
  meshes, tiers, bay/floor pitch and materials, so one building can be swapped out cleanly.
- **Swap on hit**: intact buildings stay as Nanite instances.  When damaged, that building's
  instances are hidden and replaced by structural cells.
- **Cells = Chaos geometry collections** built in C++ at the building's real dimensions: Voronoi
  fractured wall panels around the real window openings, radial-shard glass, frame bars, fractured
  floor slabs with exposed rebar, steel columns and beams (so the frame shows once the skin fails).
  Clustered (cell -> panel/glass/frame -> pieces), anchored until released, strain thresholds per
  material, damage-from-collision on, fields for radial impulses and anchors.  Identical cells share
  one cached collection.  Debris uses UVs baked from the rest pose so textures match the wall it
  came from and never swim.
- **Structure solver** (C++): load paths cell to cell down to the ground.  Losing support makes the
  floors above pancake (staggered releases), topple (damage off-centre) or shear (lateral loads).
  Fast debris that reaches a neighbour damages it, so failures cascade.  Distant or huge-scale
  damage uses coarse cells to stay affordable.
- **Other breakables**: cars (runtime dent deformation, wheels and glass come off, flip, burn),
  signals/streetlights/trees/furniture (break into rigid pieces), hydrants (spray), roadway
  (crater cut with a mask in the road materials, crater bowl and asphalt slabs).
- **Niagara** systems authored from script (Niagara toolset API + engine modules) with my own
  materials and procedural sprite textures: dust, smoke, fire, sparks, embers, glass, grit, water,
  shockwave.  Rolling street dust, fireballs and the mushroom cloud are my own ray-marched
  volumes, driven by the clock (deterministic).
- **Tools**: data-driven table in C++ composed from behaviour primitives (thrown, ballistic,
  hitscan, beam, placed charge, vehicle, field, weather, wave, orbital, creature-scale), each tool
  with its own delivery, physics, visuals, synthesized sound and damage scale.
- **Flash rule**: every light burst goes through one gate that allows at most 3 per second.
- **Chaos caches for the films**: per destruction shot, (1) dry run logs which cells are swapped in
  and when, (2) a shot map is saved with those collections and a Chaos Cache Manager, (3) record,
  (4) Movie Render Queue renders cache playback.
- **Audit**: a driver in a `-game` process triggers each tool on a fresh scene, counts broken
  pieces/cells/craters/fires/vehicles, saves before/after stills, fails any tool that broke nothing.

### Arsenal draft (smallest to biggest, final list in DESTRUCTION.md)
Hand: pebble, baseball, slingshot, firecracker, brick, crowbar, hammer, fire axe, sledgehammer, flare.
Tools and small arms: nail gun, pistol, shotgun, chainsaw, cutting torch, jackhammer, molotov,
rifle burst, rotary cannon, pipe charge.  Explosives: grenade, thermite, breaching charge, dynamite,
satchel, C4, linear cutting charge, rocket, mortar, controlled implosion.  Machines: excavator claw,
demolition shears, wrecking ball, bulldozer, steamroller, runaway truck, runaway bus, tank,
beam drop, container drop, derailed subway.  Ordnance: autocannon run, artillery, naval salvo,
rocket barrage, cluster, bunker buster, fuel-air bomb, blockbuster.  Absurd: anvil, grand piano,
giant spring, giant bowling ball, rubber ball, wrecking snowball, giant magnet, giant fist, titan
footstep, inflating balloon, gravity flip.  Sci-fi: plasma bolt, laser slicer, sonic resonator,
cryo charge, nanite swarm, disintegrator, rail slug, tractor beam, antigravity field, black hole
grenade, antimatter charge, orbital rod, saucer death ray.  Nature: lightning, hail, windstorm,
sinkhole, fissure, flash flood, tornado, fire whirl, earthquake, volcano, tsunami, meteor,
meteor shower.  World-ending: tactical nuclear, thermonuclear, singularity, asteroid, falling moon,
vacuum decay.

### Order of work from here
A. Finish city FX (rain, snow, steam, spray), vehicle materials, first critique pass.
B. Building tagging, destructible cells, structure solver, tool framework, a few tools end to end.
C. Niagara, volumetrics, full arsenal, play-mode UI.  D. Film 1 critiques and final render.
E. Audit, destruction film via Chaos caches, sound, checks, documents.

## Passes
1. Pipeline proof: C++ builds, one mesh, one material, one MRQ still.
2. Lighting/sky/weather on a blockout.
3. Streets. 4. Facades + landmarks. 5. Far city. 6. Vehicles + traffic. 7. Rain/snow/lightning.
8. Three or more whole-film critique passes, each listing the five biggest CG tells and fixing them.
9. Final render, sound, encode, checks, notes.
