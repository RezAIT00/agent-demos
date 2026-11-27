# The destruction arsenal

95 tools, listed smallest to biggest. This is the order of the in-game selector (Tab) and of the audit.
This file is generated from the code by `tools/make_destruction_md.py`.

## How destruction works (shared by every tool)

- **Buildings** switch to a destructible form the first time something touches them. The 2,284 detailed buildings keep their look: each facade bay stays an instance until hit, and the shell is cut into pieces when needed. Behind the facades is a steel frame (slabs, columns, I-beams), inner walls, partitions and furniture.
- **Fracture** happens at runtime as Chaos Geometry Collections, built in C++ from the struck parts. Break lines are crooked (neighbouring cells share the same crooked edge). Masonry pieces are 34 cm thick or more, shell walls 38 cm (24 cm for concrete), floor slabs 25 cm. Broken faces show their own finish: brick core with lime mortar, raw concrete with aggregate, or cracked plaster on the room side, and slabs and concrete walls carry bent rebar stubs. Densities are real (masonry 1,950, concrete 2,350 kg/m3), damping is near zero, and large pieces turn slowly while small ones tumble. Window frames break bar by bar. This uses editor binaries (see NOTES.md). Falling clusters break again when they land, and radial and vortex physics fields push or pull loose pieces. This uses editor binaries (see NOTES.md).
- **Anchors:** after a local blow, the wall pieces on the rim of the struck bay stay in a second, wholly anchored Chaos collection, so the hole keeps a ragged edge. They are released if the building later comes down.
- **Gravel:** every stony break also throws fist- to suitcase-sized lumps on computed paths (fall, bounce, skid, rest), which stay where they land and repeat exactly in film takes.
- **Played live,** very large blasts break into fewer, larger pieces, and their collections are built over several frames to keep the frame rate up. Film takes keep every piece.
- **No people:** the first tool used clears the pedestrians until the city is rebuilt; the destruction film and the audit never show them.
- **Structure** is checked floor by floor. When a floor loses too much support, or support becomes badly off centre, the building fails as a pancake, a topple or a shear. Falling floors damage neighbours, which can cascade.
- **Street objects** (cars, trees, poles, hydrants, mailboxes, bags, shelters, stalls, manhole lids) become rigid bodies or fragments. Cars crumple, lose glass and can burn. Hydrants spray water. Traffic treats wrecks as obstacles. Big blasts also fell distant buildings, out to the far-district boxes.
- **Effects** are 14 Niagara systems built by script (sparks, embers, dust, smoke, flame, shock ring, water, water jet, chips, glass, splinters, paper, motes) and ray-marched volumes (dust, smoke, flame, fireball, mist, mushroom cloud, tornado funnel, energy) that are lit by the sun and sky and shaded by nearby buildings.
- **Flash limit:** no more than two bright onsets in any one-second window. Extra flashes are softened into slow swells.
- **Sound:** every event plays a synthesized sound (`source/sound/destruct_sounds.py`).
- **Reset:** Backspace restores every building, object, car and light.

'Audit' lines are what one use broke on a fresh scene in `tools/destruction_audit`: building parts removed, fragments made, window panes broken, street objects, vehicles and craters. Before and after stills are in `stills/destruction/`, and all of them are on `destruction_sheet.png`.

## Tier 1: Hand tools

### 1. Slingshot pebble
*Hand tool · `pebble` · NYCTools1Hand.cpp*

- **Does:** Cracks a single window.
- **Built:** A pebble mesh flown on a ballistic arc; the window it strikes is swapped for its broken twin, with a small Niagara glass burst.
- **Audit:** 1 fragment, 1 pane

### 2. Fistful of marbles
*Hand tool · `marbles` · NYCTools1Hand.cpp*

- **Does:** A spray of marbles that pocks the wall and stars several panes.
- **Built:** Eighteen small projectiles in a cone, each leaving a scar or breaking a pane.
- **Audit:** 18 fragments, 3 panes

### 3. Line-drive baseball
*Hand tool · `baseball` · NYCTools1Hand.cpp*

- **Does:** Smashes a window, then bounces off walls and the street breaking whatever else it clips.
- **Built:** Bouncing projectile with restitution; each contact shatters the nearest window and can knock over light street objects.
- **Audit:** 2 panes

### 4. Firecrackers
*Explosive · `firecracker` · NYCTools1Hand.cpp*

- **Does:** A string of sharp little pops that scatters litter and bags.
- **Built:** Thrown bundle with a sparking fuse; a train of tiny flashes with red paper confetti (Niagara) and a light push on loose objects.
- **Audit:** 6 fragments, 1 street object, 1 crater

### 5. Cherry bomb
*Explosive · `cherry_bomb` · NYCTools1Hand.cpp*

- **Does:** One hard bang that blows a mailbox or news box apart.
- **Built:** Fused projectile; a small flash, a knot of smoke and a force strong enough to fracture street boxes into pieces.
- **Audit:** 6 fragments, 1 street object, 1 crater

### 6. Claw hammer
*Hand tool · `claw_hammer` · NYCTools1Hand.cpp*

- **Does:** Chips fist-sized bites out of the masonry.
- **Built:** Animated hammer mesh; each blow spawns a few Chaos fragments of the wall's own material, a scar and chips.
- **Audit:** 18 fragments, 1 pane

### 7. Crowbar
*Hand tool · `crowbar` · NYCTools1Hand.cpp*

- **Does:** Pries a window out of its frame.
- **Built:** Two levering strokes; the pane breaks and bent lengths of frame fall as rigid metal fragments.
- **Audit:** 10 fragments, 2 panes

### 8. Hydrant wrench
*Hand tool · `hydrant_wrench` · NYCTools1Hand.cpp*

- **Does:** Wrenches a hydrant off: it pops loose and the main throws a column of water.
- **Built:** The hydrant becomes a rigid body; a Niagara water jet, spray splashes and mist run for half a minute.
- **Audit:** 1 street object

### 9. Pickaxe
*Hand tool · `pickaxe` · NYCTools1Hand.cpp*

- **Does:** Breaks a small hole in the roadway, throwing lumps of asphalt.
- **Built:** Two swings; a small crater is cut with the crater material and asphalt lumps are spawned as Chaos pieces.
- **Audit:** 29 fragments, 1 crater

### 10. Fire axe
*Hand tool · `fire_axe` · NYCTools1Hand.cpp*

- **Does:** Splits a storefront: glass sheets down along the line of the blows and whatever stands there splinters.
- **Built:** Three sweeping strokes walk along the wall, shattering storefront glazing and throwing splinters.
- **Audit:** 15 fragments, 5 panes

### 11. Cutting torch
*Hand tool · `cutting_torch` · NYCTools1Hand.cpp*

- **Does:** Burns through a steel post, which topples.
- **Built:** A hissing blue flame, a Niagara spark stream and molten drips, a flickering light; then the post falls as a rigid body and its lamp or signals go dark.
- **Audit:** 3 fragments, 1 street object

### 12. Chainsaw
*Hand tool · `chainsaw` · NYCTools1Hand.cpp*

- **Does:** Cuts through a street tree and fells it.
- **Built:** The saw bites with bursts of sawdust and splinters, then the tree becomes a rigid body given a topple about its stump.
- **Audit:** 23 fragments, 1 street object

### 13. Sledgehammer
*Hand tool · `sledgehammer` · NYCTools1Hand.cpp*

- **Does:** Knocks a bay out of a masonry wall.
- **Built:** Three heavy blows: scars and lumps, then the struck facade module is fractured (Voronoi chunks, frames, glass) with a puff of its dust.
- **Audit:** 1 part, 85 fragments, 1 pane

### 14. Jackhammer
*Demolition tool · `jackhammer` · NYCTools1Hand.cpp*

- **Does:** Hammers a trench into the pavement.
- **Built:** Thirty rapid blows walking forward: pavement lumps, grit, shake, and a line of overlapping breaks cut into the road.
- **Audit:** 65 fragments, 3 craters

## Tier 2: Charges and fire

### 15. Road flare
*Fire · `road_flare` · NYCTools2Charges.cpp*

- **Does:** Starts a fire that spreads: cars catch, litter burns, windows crack in the heat.
- **Built:** A red-burning flare; every two seconds the fire reaches the next car or object within range, which is wrecked burning in place.
- **Audit:** 8 panes, 4 street objects, 3 vehicles

### 16. Fireworks barrage
*Explosive · `fireworks` · NYCTools2Charges.cpp*

- **Does:** Rockets burst against the upper floors in coloured stars, breaking glass and setting awnings smoking.
- **Built:** Seven rockets with spark trails; each burst is a Niagara star shell in its own colour with a coloured light and a small glass-breaking pop.
- **Audit:** 18 panes

### 17. Fragmentation grenade
*Explosive · `grenade` · NYCTools2Charges.cpp*

- **Does:** A sharp crack that riddles walls with fragments and blows out nearby glass.
- **Built:** Bouncing fused body; a hard, mostly dry blast, then thirty fragment rays traced outward that scar walls and break the panes they hit.
- **Audit:** 3 parts, 138 fragments, 5 panes, 1 crater

### 18. Runaway propane tank
*Explosive · `propane_rocket` · NYCTools2Charges.cpp*

- **Does:** A ruptured cylinder skitters along the street spewing flame, then explodes against the storefront.
- **Built:** A tank mesh driven in a weaving path with a trailing jet of flame and sparks, ending in a medium blast.
- **Audit:** 3 parts, 125 fragments, 7 panes, 1 street object

### 19. Thermite pot
*Demolition charge · `thermite` · NYCTools2Charges.cpp*

- **Does:** White-hot metal pours into the base of the building, silently eating through the steel until something gives.
- **Built:** No blast: a five-second white spark fountain and molten drips; columns are removed one at a time with almost no debris speed, until the structural check fails.
- **Audit:** 11 parts, 265 fragments, 1 crater

### 20. Breaching charge
*Demolition charge · `breaching_charge` · NYCTools2Charges.cpp*

- **Does:** Punches a doorway straight into the building.
- **Built:** A placed charge with a beeping fuse; a narrow inward-directed blast (capsule into the wall) that drives all the debris inside.
- **Audit:** 2 parts, 116 fragments

### 21. Column-cutting charge
*Demolition charge · `shaped_charge` · NYCTools2Charges.cpp*

- **Does:** A focused jet shears the steel columns behind the wall; the floors above sag or come down.
- **Built:** Two narrow capsule cuts that sever columns, beams and slabs along a line into the building; the structural check then decides what falls.
- **Audit:** 7 parts, 389 fragments, 3 panes

### 22. Stick of dynamite
*Explosive · `dynamite` · NYCTools2Charges.cpp*

- **Does:** Blows a ragged hole in a wall and every window round it.
- **Built:** A thrown stick with a spitting fuse; a medium blast that fractures facade modules into Chaos pieces and throws them outward.
- **Audit:** 13 parts, 407 fragments, 16 panes, 1 street object, 1 crater

### 23. Gas leak and spark
*Explosion · `gas_leak` · NYCTools2Charges.cpp*

- **Does:** A floor full of gas goes off at once: every window on it blows out and flame rolls from all four sides.
- **Built:** All facade modules on one floor are found; the glazing is broken and jets of fire are placed round the perimeter at the same instant, with a floor-wide outward blast.
- **Audit:** 22 parts, 851 fragments, 28 panes

### 24. Linear cutting charge
*Demolition charge · `linear_charge` · NYCTools2Charges.cpp*

- **Does:** Slices a horizontal line across the front; the band of wall peels off into the street.
- **Built:** A string of charges fired end to end: sequential thin cuts along the wall that push their pieces outward.
- **Audit:** 22 parts, 1,248 fragments, 9 panes

## Tier 3: Machines and demolition

### 25. Rocket shopping cart
*Vehicle · `rocket_cart` · NYCTools3Machines.cpp*

- **Does:** A shopping cart with boosters screams across the street, scatters everything and smashes into the shopfronts.
- **Built:** Driven mesh with flame and spark trails; capsule sweeps knock over street objects; ends in a small burst and the cart tumbling as a rigid body.
- **Audit:** 2 parts, 116 fragments, 2 vehicles

### 26. Runaway taxi
*Vehicle · `runaway_taxi` · NYCTools3Machines.cpp*

- **Does:** A yellow cab at full throttle ploughs into a storefront and crumples.
- **Built:** The project's own cab with turning wheels; on impact its mesh is deformed (crumple field along the blow), the glass is removed and it becomes a rigid wreck, sometimes burning.
- **Audit:** 3 parts, 256 fragments, 2 panes, 1 street object, 3 vehicles

### 27. Runaway garbage truck
*Vehicle · `garbage_truck` · NYCTools3Machines.cpp*

- **Does:** Twenty tonnes with no brakes: it crushes what is in the way and buries its cab in the building.
- **Built:** A purpose-built truck model on a driven path with wide capsule damage; it stops embedded in the broken front, trailing rubbish.
- **Audit:** 10 parts, 412 fragments, 1 street object

### 28. Runaway city bus
*Vehicle · `city_bus` · NYCTools3Machines.cpp*

- **Does:** Twelve metres of bus sweeps parked cars aside and rams deep into the ground floor.
- **Built:** The project's bus with its wheels, driven on a long shallow line so it side-swipes the kerb lane; cars it meets are wrecked.
- **Audit:** 21 parts, 1,009 fragments, 5 panes, 1 street object

### 29. Monster truck leap
*Vehicle · `monster_truck` · NYCTools3Machines.cpp*

- **Does:** Vaults through the air and flattens the cars it lands on, twice.
- **Built:** A giant-wheeled truck following two ballistic hops; each landing wrecks vehicles from directly above (roof crush) and slams street objects down.
- **Audit:** 15 fragments, 3 street objects, 1 vehicle, 2 craters

### 30. Falling steel
*Impact · `steel_beam_drop` · NYCTools3Machines.cpp*

- **Does:** A bundle of girders comes down and spears straight through roofs and floors.
- **Built:** Seven girders fall under gravity; each one that strikes a roof cuts a vertical capsule down through several floors, then comes to rest as a rigid body.
- **Audit:** 88 parts, 1,419 fragments, 15 panes

### 31. Road roller
*Vehicle · `road_roller` · NYCTools3Machines.cpp*

- **Does:** Grinds slowly down the kerb lane, pressing cars flat and crazing the pavement.
- **Built:** A slow driven roller; every car under the drum is rebuilt with a downward crumple, street objects are pushed over and the road is cracked behind it.
- **Audit:** 108 fragments, 3 street objects, 2 vehicles, 15 craters

### 32. Dropped shipping container
*Impact · `container_drop` · NYCTools3Machines.cpp*

- **Does:** Thirty tonnes of steel box lands flat on the traffic.
- **Built:** A falling container; on landing it crushes vehicles from above, throws a flat ring of dust and remains as a heavy rigid body.
- **Audit:** 18 fragments, 2 panes, 3 street objects, 1 vehicle, 1 crater

### 33. Bulldozer
*Demolition machine · `bulldozer` · NYCTools3Machines.cpp*

- **Does:** Pushes steadily into the ground floor, shoving the front and its contents inward.
- **Built:** A slow driven dozer; repeated forward capsule damage at blade height with debris pushed ahead rather than thrown.
- **Audit:** 6 parts, 149 fragments, 1 street object

### 34. Excavator claw
*Demolition machine · `excavator` · NYCTools3Machines.cpp*

- **Does:** Reaches up and tears bites out of the facade, one after another.
- **Built:** A tracked machine with a two-part arm solved to each target; each bite fractures a few modules and drags the pieces back and down.
- **Audit:** 16 parts, 539 fragments, 7 panes

### 35. Pile driver
*Demolition machine · `pile_driver` · NYCTools3Machines.cpp*

- **Does:** Hammers the street; each blow rings out as a ground wave that cracks windows further and further away.
- **Built:** A drop hammer on guides; every blow grows the crater, raises a dust ring, kicks loose objects upward and breaks glass over a widening radius.
- **Audit:** 55 fragments, 79 panes, 1 street object, 5 craters

### 36. High-reach demolition shear
*Demolition machine · `high_reach_shear` · NYCTools3Machines.cpp*

- **Does:** An enormous boom nibbles a building down from the parapet, floor by floor.
- **Built:** A long articulated boom to the roof line; ten bites step across and down the top floors, removing structure so the upper corner is eaten away.
- **Audit:** 23 parts, 113 fragments, 9 panes

### 37. Crane and wrecking ball
*Demolition machine · `wrecking_ball` · NYCTools3Machines.cpp*

- **Does:** A four-tonne ball swings into the wall three times.
- **Built:** A lattice crane with a chain of links and a pendulum ball integrated each step; every strike pushes a large bite of facade and frame into the building.
- **Audit:** 17 parts, 471 fragments, 17 panes

### 38. Tower crane collapse
*Disaster · `crane_collapse` · NYCTools3Machines.cpp*

- **Does:** A tower crane buckles and falls across the street, its jib raking down the fronts.
- **Built:** A mast and jib assembled from lattice sections, rotated about the foot under gravity; every section that meets a building cuts into it, and the end hits the ground in sparks and dust.
- **Audit:** 2,249 parts, 6,610 fragments, 50 panes, 1 street object, 1 crater, 2 buildings collapsed

### 39. Felling charges
*Demolition charge · `topple_charges` · NYCTools3Machines.cpp*

- **Does:** Charges cut one side of the base so the building goes over like a tree, into whatever stands across the street.
- **Built:** The street-side ground floor is blown, then the whole upper block is released as one rigid mass with an initial rotation about the cut edge; it breaks apart where it lands and damages what it reaches.
- **Audit:** 1,300 parts, 3,045 fragments, 24 panes, 2 street objects, 1 crater, 1 building collapsed

### 40. Controlled implosion
*Demolition charge · `implosion` · NYCTools3Machines.cpp*

- **Does:** Timed charges ripple through the lower floors and the whole building drops into its own footprint.
- **Built:** A sequence of sixteen charges with flashes and dust jets, then the progressive pancake collapse: the failing floor shatters, the mass above falls as floor clusters, lower floors give way in turn.
- **Audit:** 1,364 parts, 2,566 fragments, 16 panes, 1 building collapsed

## Tier 4: Artillery and ordnance

### 41. Old iron cannon
*Artillery · `cannonball` · NYCTools4Ordnance.cpp*

- **Does:** A solid iron ball punches straight through wall after wall without exploding.
- **Built:** A fast heavy ball; at the hit a capsule is cut deep along its line through several walls, fragments carried forward; the ball ends up rolling inside as a rigid body.
- **Audit:** 15 parts, 287 fragments, 1 pane

### 42. Mortar
*Artillery · `mortar` · NYCTools4Ordnance.cpp*

- **Does:** A bomb drops out of a steep arc and cratering the street.
- **Built:** Visible tube, a high lobbed finned bomb with a falling whistle, a ground blast with a crater cut into the road and thrown paving.
- **Audit:** 5 fragments, 3 panes, 1 crater

### 43. Tank gun
*Artillery · `tank_shell` · NYCTools4Ordnance.cpp*

- **Does:** A tracer round drills through the facade and bursts inside, blowing the floor out from within.
- **Built:** An instant tracer; a thin penetration capsule, then a delayed blast seven metres inside that throws walls and windows outward.
- **Audit:** 54 parts, 346 fragments, 54 panes

### 44. Howitzer battery
*Artillery · `howitzer` · NYCTools4Ordnance.cpp*

- **Does:** A single heavy round screams in: a deep crater, a column of earth and every window for a block.
- **Built:** Delayed arrival heard before it is seen; large ground blast with crater, soil fountain, shock shell and a lingering smoke column.
- **Audit:** 34 fragments, 204 panes, 1 street object, 1 crater

### 45. Rocket salvo
*Artillery · `rocket_salvo` · NYCTools4Ordnance.cpp*

- **Does:** Sixteen rockets ripple in on smoke trails and stitch the whole front with blasts.
- **Built:** Rockets launched a tenth of a second apart with scatter, each with its own flame-and-smoke trail and a small blast.
- **Audit:** 115 parts, 2,316 fragments, 76 panes

### 46. Heavy plunging rocket
*Artillery · `plunging_rocket` · NYCTools4Ordnance.cpp*

- **Does:** One big rocket climbs out of sight, tips over and dives through the roof; the blast comes from floors below.
- **Built:** A guided path: boost, apex, steep dive; it cuts down through the roof, waits a fraction and detonates inside the building.
- **Audit:** 93 parts, 943 fragments, 104 panes

### 47. Buried charge grid
*Demolition charge · `ripple_charges` · NYCTools4Ordnance.cpp*

- **Does:** Thirty-six charges under the intersection fire outward in rings, leaving the roadway ploughed like a field.
- **Built:** A grid of small buried blasts timed by distance from the centre, each cutting its own crater and throwing paving; cars are tossed as the ripple passes.
- **Audit:** 263 fragments, 2 panes, 4 street objects, 3 vehicles, 12 craters

### 48. Earth-penetrating bomb
*Ordnance · `bunker_buster` · NYCTools4Ordnance.cpp*

- **Does:** A long steel bomb vanishes into the street. Then the ground heaves from underneath and the buildings around lose their footings.
- **Built:** Penetrator punches a small hole; after a pause a buried blast lifts pavement over a wide disc and removes the ground-floor structure of the buildings in reach, which collapse.
- **Audit:** 11,333 parts, 14,405 fragments, 203 panes, 5 street objects, 2 vehicles, 2 craters, 3 buildings collapsed

### 49. Fuel-air bomb
*Ordnance · `thermobaric` · NYCTools4Ordnance.cpp*

- **Does:** A mist of fuel fills the intersection, then ignites: a vast soft fireball, a pressure wave that sucks glass out and slams back.
- **Built:** A canister bursts into a spreading aerosol (mist volumes), then a huge slow fireball with two glass waves, outward then inward, and interior damage to every front around.
- **Audit:** 1,186 parts, 1,300 fragments, 209 panes, 7 street objects, 1 vehicle, 1 building collapsed

### 50. Naval broadside
*Artillery · `naval_broadside` · NYCTools4Ordnance.cpp*

- **Does:** Nine battleship shells walk down the avenue in a rolling line of explosions.
- **Built:** Nine very large shells arriving in sequence along a straight line, each a heavy blast with crater, shock shell and structural damage.
- **Audit:** 79 parts, 1,781 fragments, 632 panes, 25 street objects, 10 vehicles, 8 craters

## Tier 5: Hazards, weather and ground

### 51. Burst water main
*City hazard · `water_main` · NYCTools5Hazards.cpp*

- **Does:** The pavement splits and a six-storey geyser tears it apart, flipping the car above.
- **Built:** Crater, thrown paving, a manhole lid, vehicles launched from below, and a long Niagara water column with splashes and drifting spray.
- **Audit:** 46 fragments, 1 street object, 1 crater

### 52. Manhole cascade
*City hazard · `manhole_cascade` · NYCTools5Hazards.cpp*

- **Does:** An underground fault runs down the street and one manhole after another launches its lid on a jet of fire.
- **Built:** The real manhole and grate instances along the street, sorted by distance, fire in sequence: spinning lids, flame jets, smoke and glass.
- **Audit:** 67 fragments, 6 street objects, 8 craters

### 53. Transformer arc storm
*City hazard · `arc_storm` · NYCTools5Hazards.cpp*

- **Does:** A vault blows and raw current leaps from post to post, bursting lamps and setting cars alight.
- **Built:** Jagged blue arcs built from beam segments hop between nearby poles and cars with spark showers; the lamps they touch go dark, posts fall, vehicles ignite.
- **Audit:** 7 fragments, 2 panes, 1 street object, 1 crater

### 54. Giant hail
*Weather · `hailstorm` · NYCTools5Hazards.cpp*

- **Does:** Ice the size of footballs hammers the block: windows burst everywhere, cars are pounded, ice bounces in the street.
- **Built:** Two hundred falling ice meshes with their own flights; each impact breaks glass, dents or knocks over what it hits and bursts into ice chips; the sky darkens.
- **Audit:** 182 fragments, 26 panes

### 55. Earthquake, magnitude 5
*Natural disaster · `tremor` · NYCTools5Hazards.cpp*

- **Does:** Everything shakes: windows crack across the block, parapet bricks and rooftop tanks come loose.
- **Built:** Sustained camera and ground shake with random light damage: glass failing, falling roof equipment, chunks off cornices, dust off every ledge; no collapses.
- **Audit:** 57 parts, 373 fragments, 70 panes

### 56. Microburst
*Weather · `microburst` · NYCTools5Hazards.cpp*

- **Does:** A column of cold air slams down and spreads flat: trees and lamps go over outward, signs and glass fly.
- **Built:** A downward blast: a dust ring racing out along the ground, street objects flattened radially with distance-timed delays, windows broken on the faces turned to the centre.
- **Audit:** 36 fragments, 132 panes, 5 street objects, 11 vehicles

### 57. Gas main explosion
*City hazard · `gas_main` · NYCTools5Hazards.cpp*

- **Does:** Sixty metres of street erupt in a running line, leaving a burning trench and gutted storefronts.
- **Built:** Blasts every four metres along the street axis timed as a travelling wave; asphalt slabs heaved upward, a chain of craters and standing flames.
- **Audit:** 216 fragments, 3 vehicles, 9 craters

### 58. Superbolt
*Weather · `super_lightning` · NYCTools5Hazards.cpp*

- **Does:** Three enormous strokes hit the same tower: the crown explodes, windows burst down its whole height and the roof burns.
- **Built:** Forked bolts built from beam segments, rationed to stay within the flash limit; each stroke blasts the roof, showers sparks down the facade and starts fires.
- **Audit:** 22 parts, 108 fragments, 72 panes

### 59. Crushing blizzard
*Weather · `blizzard` · NYCTools5Hazards.cpp*

- **Does:** Wet snow piles up fast until things give way under it: branches, lamp arms, awnings, rooftop tanks.
- **Built:** The weather controller is driven into a whiteout that settles on every surface; trees, posts and roof equipment fail one by one and slump (gentle velocities, heavy fall), with icy fragments.
- **Audit:** 95 parts, 741 fragments, 3 street objects

### 60. Flash flood
*Natural disaster · `flash_flood` · NYCTools5Hazards.cpp*

- **Does:** A chest-high surge of brown water races down the avenue, floating cars and carrying everything loose.
- **Built:** A moving wave mesh with the flood shader and foam, Niagara spray and mist; everything in its band is pushed along with the flow, ground floors are breached.
- **Audit:** 10 street objects, 3 vehicles

### 61. Hurricane gust front
*Weather · `hurricane` · NYCTools5Hazards.cpp*

- **Does:** A screaming horizontal gale with driving rain strips the windward fronts, sheet by sheet.
- **Built:** Sustained wind: rain and wind pushed to maximum, windows on faces turned into the wind failing in waves, loose objects and roof gear dragged downwind, debris streaming horizontally.
- **Audit:** 8 parts, 262 fragments, 23 panes, 5 street objects

### 62. Sinkhole
*Natural disaster · `sinkhole` · NYCTools5Hazards.cpp*

- **Does:** The street gives way. The hole widens, swallowing cars and posts, until the corner of a building slides in.
- **Built:** A crater regrown in stages; props and cars that fall inside the rim are animated sinking and tilting out of sight; footings of the nearest building are removed so it leans in.
- **Audit:** 1,298 parts, 3,219 fragments, 25 panes, 3 street objects, 8 craters, 1 building collapsed

### 63. Tornado
*Natural disaster · `tornado` · NYCTools5Hazards.cpp*

- **Does:** A twisting funnel walks up the avenue, lifting cars and street furniture and peeling the fronts.
- **Built:** A ray-marched funnel volume driven along a wandering path; loose bodies are dragged into orbit, physics fields swirl the debris, props are torn up and facades stripped where it touches; Niagara litter and splinters orbit it.
- **Audit:** 86 parts, 2,904 fragments, 119 panes, 6 street objects, 9 vehicles

### 64. Eruption in Bryant Park
*Natural disaster · `eruption` · NYCTools5Hazards.cpp*

- **Does:** A vent breaks open, hurling glowing bombs across the blocks under a black ash column.
- **Built:** A spatter cone with glowing throat, a towering driven ash plume, lava-rock bombs on ballistic arcs each exploding on impact and starting fires, lava light flickering.
- **Audit:** 56 parts, 2,106 fragments, 86 panes, 1 street object, 6 craters

### 65. Great quake and fissure
*Natural disaster · `megaquake` · NYCTools5Hazards.cpp*

- **Does:** The ground splits along the street and, one after another, buildings pancake and topple into the dust.
- **Built:** Violent shake; a fissure of overlapping craters opens progressively with heaved slabs; six surrounding buildings fail with differing collapse modes, staggered, with dust surges.
- **Audit:** 6,322 parts, 10,081 fragments, 27 panes, 2 street objects, 1 vehicle, 19 craters, 5 buildings collapsed

### 66. Wedge tornado
*Natural disaster · `wedge_tornado` · NYCTools5Hazards.cpp*

- **Does:** A funnel wider than the avenue grinds across several blocks and brings buildings down in its path.
- **Built:** A far larger, lower, darker funnel with structural damage and whole-building collapses along its track, and a debris cloud at its foot.
- **Audit:** 1,295 parts, 6,815 fragments, 693 panes, 51 street objects, 8 vehicles, 1 building collapsed

### 67. Tsunami down 42nd Street
*Natural disaster · `tsunami` · NYCTools5Hazards.cpp*

- **Does:** A wall of water five storeys high comes in off the river and fills the street, ripping out the lower floors.
- **Built:** A very large wave with heavy structural damage along both fronts, cars and wreckage carried with it, huge spray and a thunderous roar.
- **Audit:** 1,436 parts, 9,878 fragments, 272 panes, 32 street objects, 10 vehicles, 1 building collapsed

## Tier 6: Absurd

### 68. Anvil rain
*Absurd · `anvil_rain` · NYCTools6Absurd.cpp*

- **Does:** A cartoon cloudburst of iron: dozens of anvils bang into the street, car roofs and parapets, and stay stuck there.
- **Built:** Forty tumbling anvil meshes with staggered falls; each rings on impact, punches a small crater or hole, flattens what is below and remains embedded at a crooked angle.
- **Audit:** 174 fragments, 2 street objects, 13 craters

### 69. Falling grand piano
*Absurd · `piano_drop` · NYCTools6Absurd.cpp*

- **Does:** A concert grand whistles down from the sky and detonates into black lacquer, keys and one enormous wrong chord.
- **Built:** A tumbling grand piano model; on impact it is replaced by lacquered lumps, white and black keys and wooden splinters, crushes the car beneath and rings a discord.
- **Audit:** 102 fragments, 3 street objects, 1 vehicle

### 70. Party balloon airlift
*Absurd · `balloon_lift` · NYCTools6Absurd.cpp*

- **Does:** Bunches of giant balloons carry off cars, mailboxes and a hydrant, which burst one by one and let their cargo drop.
- **Built:** Real bodies made weightless and steered gently upward with balloon clusters following them; balloons pop in sequence and gravity returns to each object when its last one goes.
- **Audit:** 5 street objects, 4 vehicles

### 71. Street pinball
*Absurd · `pinball` · NYCTools6Absurd.cpp*

- **Does:** A mirror-bright steel ball ricochets between the buildings, ringing a bell and gouging a wall at every bounce.
- **Built:** A chrome sphere with its own velocity, reflected off real facade normals found by ray casts; every bounce damages the front, flashes a coloured bumper light and rings a rising bell.
- **Audit:** 90 parts, 3,146 fragments, 50 panes, 3 street objects, 16 vehicles

### 72. Colossal rubber duck
*Absurd · `rubber_duck` · NYCTools6Absurd.cpp*

- **Does:** A twelve metre bath toy bounces down the avenue, squeaking, and flattens whatever it lands on.
- **Built:** The duck follows a decaying hop curve with squash and stretch on landing; each landing crushes cars, flings furniture, cracks glass and squeaks.
- **Audit:** 28 fragments, 4 vehicles, 4 craters

### 73. Gravity flip
*Absurd · `gravity_flip` · NYCTools6Absurd.cpp*

- **Does:** For five seconds down is up: cars, benches, rubble and chunks of wall drift into the sky, and then everything falls at once.
- **Built:** Gravity is switched off on every loose body in range and a gentle upward field applied to rubble; props and traffic are cut loose, then gravity returns with a downward kick.
- **Audit:** 68 parts, 3,703 fragments, 55 panes, 6 street objects, 2 vehicles

### 74. Giant magnet
*Absurd · `giant_magnet` · NYCTools6Absurd.cpp*

- **Does:** A horseshoe magnet the size of a house lowers over the street; cars, lamp posts and steel from the walls fly up and cling, then drop.
- **Built:** Bodies are made weightless and accelerated toward the poles each step; steel is ripped from fronts as long thin lumps and drawn up by a physics field; on shut-off everything falls in one heap.
- **Audit:** 53 parts, 2,085 fragments, 33 panes, 7 street objects, 1 vehicle

### 75. Giant bowling ball
*Absurd · `bowling_ball` · NYCTools6Absurd.cpp*

- **Does:** An eight metre bowling ball thunders down the avenue and sends cars flying like pins.
- **Built:** A rolling sphere with true rolling rotation and accelerating speed; swept damage along its path, cars launched high, posts snapped, a final crash into whatever stands at the end.
- **Audit:** 107 fragments, 6 vehicles, 15 craters

### 76. Giant boot
*Absurd · `giant_boot` · NYCTools6Absurd.cpp*

- **Does:** An enormous boot comes down out of the sky three times, stamping craters across the block.
- **Built:** A twenty metre boot animated through lift, travel and an accelerating stamp; each footfall makes a crater, a ground shock ring, crushed cars and a camera jolt.
- **Audit:** 313 fragments, 258 panes, 5 street objects, 3 craters

### 77. Giant spring
*Absurd · `giant_spring` · NYCTools6Absurd.cpp*

- **Does:** A huge coil squeezes flat against the foot of a building, lets go, and flings the whole thing into the air.
- **Built:** An animated coil compresses with a creak and releases with a boing; the building's floors are launched upward and outward as separate Chaos clusters that tumble back down.
- **Audit:** 1,357 parts, 2,556 fragments, 24 panes, 5 street objects, 3 vehicles, 1 crater, 1 building collapsed

## Tier 7: Alien technology

### 78. Cryo bomb
*Alien technology · `cryo_bomb` · NYCTools7Alien.cpp*

- **Does:** A burst of impossible cold: frost mist rolls out, crystals erupt over the street and the frozen storefront shatters like glass.
- **Built:** A lobbed canister, ground-hugging mist volumes, ice crystal meshes that grow over the surfaces found by ray casts, then a low-velocity brittle fracture whose pieces take an ice material.
- **Audit:** 7 parts, 294 fragments, 3 panes

### 79. Gravity gun
*Alien technology · `gravity_gun` · NYCTools7Alien.cpp*

- **Does:** Plucks a parked car off the kerb, holds it hovering in a cyan field and fires it through the nearest wall; then does it again.
- **Built:** A real simulated car body is made weightless and servoed to a hold point with a tether beam, then launched at over 200 km/h; its path is ray-tested each step so it smashes the front it reaches.
- **Audit:** 60 parts, 1,805 fragments, 64 panes, 3 street objects, 3 vehicles

### 80. Sonic disruptor
*Alien technology · `sonic_disruptor` · NYCTools7Alien.cpp*

- **Does:** A resonance dish pulses a rising note: first the panes burst, then loose things walk and buzz, then the masonry itself shakes apart.
- **Built:** Visible pressure rings built from beam segments travel from the dish to the wall; each pulse widens the window-breaking radius and the last two turn into structural damage.
- **Audit:** 21 parts, 438 fragments, 71 panes, 1 street object

### 81. Plasma lance
*Alien technology · `plasma_cutter` · NYCTools7Alien.cpp*

- **Does:** A white-hot lance slices clean through a building at one floor; the glowing cut sags, and everything above slides off.
- **Built:** A moving beam ray-cast onto the front, cutting a narrow band of elements and leaving a cooling molten line with dripping sparks; then the storeys above the cut shear sideways as rigid clusters.
- **Audit:** 842 parts, 2,444 fragments, 19 panes, 1 building collapsed

### 82. Grey swarm
*Alien technology · `nanite_swarm` · NYCTools7Alien.cpp*

- **Does:** A humming cloud of machines eats the city from one point outward: stone and steel turn to glittering dust and the unsupported floors come down.
- **Built:** A growing driven mist volume; every step it deletes the building parts at its advancing edge in a shower of motes, sinks street objects into powder and lets the structural check bring down what is left unsupported.
- **Audit:** 1,409 parts, 1,593 fragments, 13 panes, 2 street objects, 2 buildings collapsed

### 83. Antimatter capsule
*Alien technology · `antimatter` · NYCTools7Alien.cpp*

- **Does:** A tiny violet capsule drifts into the wall and annihilates a perfect sphere of building out of existence.
- **Built:** Charge-up energy volume collapsing to a point, then every element inside a sphere is removed at once, rubble is first sucked into the void and then thrown out, and the structure left above fails.
- **Audit:** 1,411 parts, 2,738 fragments, 140 panes, 1 building collapsed

### 84. Saucer death ray
*Alien technology · `ufo_death_ray` · NYCTools7Alien.cpp*

- **Does:** The saucer circles the block raking a green beam across street and fronts, leaving a smoking, burning, glowing trail.
- **Built:** An orbiting craft whose beam is ray-cast against the city at every step; where it lands elements burst, scorch scars and fires are left, and cars explode.
- **Audit:** 1,416 parts, 11,655 fragments, 159 panes, 4 street objects, 1 crater, 2 buildings collapsed

### 85. Saucer tractor beam
*Alien technology · `ufo_tractor` · NYCTools7Alien.cpp*

- **Does:** A thirty metre saucer slides in over the rooftops and drinks up the street: cars, posts and pieces of buildings spiral up into its belly.
- **Built:** An animated craft with a soft volumetric beam; bodies inside the beam are made weightless and pulled up on a spiral until swallowed, while a field lifts loose rubble.
- **Audit:** 105 parts, 3,564 fragments, 41 panes, 6 street objects

### 86. Tripod walker
*Alien technology · `alien_tripod` · NYCTools7Alien.cpp*

- **Does:** A thirty metre three-legged machine strides up the avenue, crushing what it steps on and burning the fronts with a red heat ray.
- **Built:** A procedurally walking tripod: each leg is two segments re-solved every step with a bulging knee; foot plants make craters; the eye fires ray-cast beams that explode where they land.
- **Audit:** 124 parts, 5,253 fragments, 192 panes, 4 street objects, 5 vehicles, 9 craters

### 87. Pocket black hole
*Alien technology · `black_hole` · NYCTools7Alien.cpp*

- **Does:** A point of nothing opens above the street and pulls in cars, posts, masonry and finally a whole building, then winks out with a shock.
- **Built:** A dark core volume with a glowing accretion disc; rigid bodies and Chaos fragments are pulled in on spirals by per-step forces and physics fields and swallowed at the horizon; fronts are torn off progressively.
- **Audit:** 10,972 parts, 21,307 fragments, 165 panes, 10 street objects, 4 vehicles, 1 crater, 9 buildings collapsed

### 88. Orbital ion cannon
*Alien technology · `ion_cannon` · NYCTools7Alien.cpp*

- **Does:** Six guide beams spiral together; then a column of light from orbit bores straight down through whatever is underneath.
- **Built:** Converging beams animated into a point, then a widening sky-high column that removes building parts in a vertical cylinder, melts a deep crater and throws a flat shock ring.
- **Audit:** 10,642 parts, 9,179 fragments, 222 panes, 6 street objects, 1 vehicle, 1 crater, 7 buildings collapsed

## Tier 8: World ending

### 89. Orbital kinetic rod
*World ending · `kinetic_rod` · NYCTools8Cataclysm.cpp*

- **Does:** A tungsten pole dropped from orbit arrives faster than its own sound: a deep crater, a ring of flattened blocks and a towering plume of earth, with no fire at all.
- **Built:** A hypersonic rod mesh with a white plasma streak; on impact a deep crater, a great fan of thrown paving and soil, a fast shock ring with distance-timed damage and a vertical dust column.
- **Audit:** 37,539 parts, 32,558 fragments, 269 panes, 118 street objects, 40 vehicles, 1 crater, 18 buildings collapsed

### 90. Meteor
*World ending · `meteor_small` · NYCTools8Cataclysm.cpp*

- **Does:** A six metre stone arrives on a pillar of fire and takes out the middle of a block.
- **Built:** A cracked glowing rock with a burning smoke tail; impact fireball, crater, heaved ground, a travelling shock ring and burning ejecta that land and start fires.
- **Audit:** 30,557 parts, 16,058 fragments, 344 panes, 80 street objects, 34 vehicles, 2 craters, 21 buildings collapsed

### 91. Great meteor
*World ending · `meteor_large` · NYCTools8Cataclysm.cpp*

- **Does:** A rock the size of a brownstone row strikes: several blocks vanish and a brown mushroom of earth climbs over Midtown.
- **Built:** A twenty four metre body with a vast tail; a fireball that turns itself into a rising mushroom (stem, turning cap, self-shadow), a condensation ring, a radial scorch, a hundred-metre-wide crater, a visible pressure dome and a shock front that lays buildings over away from the strike, dust pouring down the real avenues and cross streets, and a rain of burning rock.
- **Audit:** 105,439 parts, 27,553 fragments, 469 panes, 556 street objects, 193 vehicles, 1 crater, 94 buildings collapsed

### 92. Tactical nuclear warhead
*World ending · `tactical_nuke` · NYCTools8Cataclysm.cpp*

- **Does:** A single white swell of light, a rising fireball, then the blast front rolls out flattening the blocks one ring after another under a mushroom cloud.
- **Built:** Airburst: one rationed, swelling flash; a white-hot ray-marched ball that rolls itself into a mushroom cloud (stem, turning vortex cap, base surge, self-shadow); a condensation ring and pressure dome racing outward; a radial scorch; distance-timed destruction that lays blocks over away from ground zero; dust surging along the real streets; thermal fires and the delayed roar.
- **Audit:** 185,470 parts, 31,574 fragments, 487 panes, 555 street objects, 265 vehicles, 1 crater, 274 buildings collapsed

### 93. Strategic nuclear warhead
*World ending · `strategic_nuke` · NYCTools8Cataclysm.cpp*

- **Does:** A burst high over Midtown: the cloud top climbs past every tower and the front runs to the rivers, leaving a flattened, burning bowl.
- **Built:** The same design at several times the scale: a far larger fireball-to-mushroom, condensation ring and scorch; far-district towers are laid over by the front as well as the detailed buildings; street surges, a wide fire field and a longer rumble.
- **Audit:** 375,276 parts, 40,678 fragments, 284 panes, 619 street objects, 23 vehicles, 1 crater, 2,201 buildings collapsed

### 94. World cracker
*World ending · `planet_cracker` · NYCTools8Cataclysm.cpp*

- **Does:** A mothership blots out the sky and drills into the island; the ground splits into glowing fissures that race outward, erupting and bringing towers down along their length.
- **Built:** A 250 m craft with a drilling beam; seven fissure lines grow as chains of deep craters with lava light, spatter eruptions and thrown rock; buildings along each crack collapse in turn; a final heave with a mushroom cloud, condensation ring, street surges, scorch and shock.
- **Audit:** 161,677 parts, 120,318 fragments, 1,124 panes, 364 street objects, 126 vehicles, 95 craters, 109 buildings collapsed

### 95. Asteroid
*World ending · `asteroid` · NYCTools8Cataclysm.cpp*

- **Does:** A rock a hundred and fifty metres across crosses the whole sky, strikes Midtown and erases it: the shock runs to the horizon and a cloud rises into the stratosphere.
- **Built:** The largest event: an enormous burning body visible for seconds; at impact a single swelling flash, a giant fireball that rises into a mushroom with a turning cap, a condensation ring and a pressure dome sweeping the horizon, a radial scorch, every building and far-district tower laid over away from the strike, dust surging down the streets, burning ejecta and a darkened sky.
- **Audit:** 372,833 parts, 25,426 fragments, 405 panes, 815 street objects, 80 vehicles, 1 crater, 2,282 buildings collapsed
