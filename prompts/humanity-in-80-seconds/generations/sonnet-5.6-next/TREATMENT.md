# THE SAME FIRE
*300,000 BCE to 2100 CE in 80 seconds. 1,920 frames at 24 fps, 1920x1080.*

## 1. The idea

**One small fire is carried through the film, and it is always in somebody's keeping.**

It starts as an ember in a pair of cupped hands, which tip it into a child's hands. After that it
is a campfire, a torch, the light in a painter's cave, a hearth in the snow and beside the first
fields, an oil lamp by the first writing, a lantern on a long road, a hearth on a canoe, a lantern in
a plague street, a furnace, a filament, a candle, the glow of a television, and the lamp a newborn is
held under. On the planet seen from space it is the points of light. In the finished cut there are
three gaps: about a second in the pan across the early cities (near 36-37 s), after the oil lamp has left
the frame; about 56.5-58.2 s, where the flame has become electric light and the lights then go out for
war, until one candle; and the Moon (about 0.8 s), where nothing can burn. In 2100 an old person,
born in 2026, tips an ember into a child's hands. It is **the opening shot again**: same gesture, same
tune. Then the old hands let go.

Rules that hold the film together:

* **Left is the past, right is the future.** The ember is passed left to right, people walk left to
  right, the camera travels left to right, and the 2026 line sweeps left to right.
* **One long day.** All of prehistory is the first night. The first dawn arrives with farming. History
  is daylight. Plague and the slave ships are dusk and dark. 2100 is night again, under the same sky.
* **The sky is the gearbox.** The faster the counter runs, the longer the star trails and the faster
  they wheel. By the end, at one year per second, the stars are still points. You can see time slow down.
* **The hand.** A hand left on a cave wall, hands pressing seed into soil, **the same hand outline**
  reaching up from a ship's hold, a footprint lifted from the Moon, a child's hands in 2100.
* **Rhymes.** The family around the television sits where the first family sat round the fire. The
  ochre red of the cave wall is the newborn's blanket, then the scarf that person wears all their life.
* **No cuts to nothing.** Where the story has to cross a hard break (plague, the ships, the engines,
  1945), the dark closes round the flame, **one ember crosses the black**, and the next age opens
  around it. Elsewhere the camera travels, pushes in, or pulls back.
* **Ordinary people.** No famous face, no real living person, no brand. Everyone is a silhouette or a
  pair of hands, so they can be anyone.
* **The future is drawn differently.** After the 2026 line, solid things become *drawn light*: dotted
  contours, thin hatching, cool colour, and faint offset "ghost" outlines that drift further apart the
  further the year is from 2026 (the uncertainty grows). The flame stays solid. A PROJECTION tag sits
  under the counter to the last frame.

## 2. The time rule

### Start year and arithmetic

* Start: **300,000 BCE** (the oldest *Homo sapiens* fossils, Jebel Irhoud, are about 300,000 years old).
* End: **2100 CE** at t = 80.000 s.
* There is no year 0. From 300,000 BCE to 1 BCE is 299,999 years; 1 BCE to 1 CE is 1 year;
  1 CE to 2100 CE is 2,099 years.
  **Span = 299,999 + 1 + 2,099 = 302,099 years.**
* The counter uses astronomical numbering, which is continuous: 1 CE = 1, 1 BCE = 0, N BCE = 1 - N.
  So `yearAt(0) = -299999`, `yearAt(80) = 2100`, and 2100 - (-299999) = **302,099**.

### The curve (the film's rhythm)

The rate **never rises**. It only shifts down, like a long braking run from deep time to human time.

| seconds | years per second | years covered | running total |
|---|---|---:|---:|
| 0-6 | 25,000 | 150,000 | 150,000 |
| 6-11 | 12,000 | 60,000 | 210,000 |
| 11-18 | 7,000 | 49,000 | 259,000 |
| 18-23 | 3,500 | 17,500 | 276,500 |
| 23-26 | 3,000 | 9,000 | 285,500 |
| 26-27 | 2,500 | 2,500 | 288,000 |
| 27-31 | 1,500 | 6,000 | 294,000 |
| 31-33 | 1,000 | 2,000 | 296,000 |
| 33-38 | 600 | 3,000 | 299,000 |
| 38-42 | 400 | 1,600 | 300,600 |
| 42-44 | 250 | 500 | 301,100 |
| 44-45 | 230 | 230 | 301,330 |
| 45-52 | 60 | 420 | 301,750 |
| 52-55 | 34 | 102 | 301,852 |
| 55-56 | 33 | 33 | 301,885 |
| 56-61 | 16 | 80 | 301,965 |
| 61-65 | 15 | 60 | 302,025 |
| 65-67 | 12 | 24 | 302,049 |
| 67-69 | 10 | 20 | 302,069 |
| 69 | 8 | 8 | 302,077 |
| 70 | 6 | 6 | 302,083 |
| 71 | 5 | 5 | 302,088 |
| 72 | 4 | 4 | 302,092 |
| 73-80 | 1 | 7 | **302,099** |

**2026 falls exactly on t = 65.000.** The last seven seconds run at one year per second, so each
heartbeat in the score is one year.

### Display rounding

1. `y = floor(yearAt(t) + 0.5)`: nearest whole year, halves up.
2. If `y <= 0` it is shown as BCE, `N = 1 - y`, always with "c.".
3. If `N >= 10,000`, N is rounded to the nearest 100 and written with commas; shorter BCE years have no
   comma.
4. If `y >= 1` the exact integer is shown with "CE".

The last frame is at t = 79.958 s, where the counter is 2099.958, so it reads **2100 CE**.

### The gear change on screen

The rate line is redrawn on the exact frame the slot begins (it never shows a stale or half-rolled
number). The new text drops into place, flashes warm, a log-scale gear bar under it steps down, the
star trails shorten, and the soundtrack gives a ratchet click and low thud.

## 3. Rate table (all 80 slots)

Counter columns show the on-screen text, then the exact astronomical value in brackets.

<!-- TABLE:START -->
| slot | seconds | years per second | counter at start | counter at end | on screen |
|---:|---|---:|---|---|---|
| 0 | [0, 1) | 25,000 | c. 300,000 BCE (-299999) | c. 275,000 BCE (-274999) | Black. A dim ember in a pair of hands; it is breathed on |
| 1 | [1, 2) | 25,000 | c. 275,000 BCE (-274999) | c. 250,000 BCE (-249999) | The glow finds the hands. "AFRICA" |
| 2 | [2, 3) | 25,000 | c. 250,000 BCE (-249999) | c. 225,000 BCE (-224999) | A child's smaller hands rise to meet them |
| 3 | [3, 4) | 25,000 | c. 225,000 BCE (-224999) | c. 200,000 BCE (-199999) | The adult tips the ember across |
| 4 | [4, 5) | 25,000 | c. 200,000 BCE (-199999) | c. 175,000 BCE (-174999) | The child holds it; sparks lift |
| 5 | [5, 6) | 25,000 | c. 175,000 BCE (-174999) | c. 150,000 BCE (-149999) | Pull back: the ember is feeding a campfire |
| 6 | [6, 7) | 12,000 | c. 150,000 BCE (-149999) | c. 138,000 BCE (-137999) | A band around the fire, acacias, star trails racing |
| 7 | [7, 8) | 12,000 | c. 138,000 BCE (-137999) | c. 126,000 BCE (-125999) | A flint knapper, a mother and infant, ochre |
| 8 | [8, 9) | 12,000 | c. 126,000 BCE (-125999) | c. 114,000 BCE (-113999) | One stands and lifts a burning branch |
| 9 | [9, 10) | 12,000 | c. 114,000 BCE (-113999) | c. 102,000 BCE (-101999) | They walk; the camera follows the torch |
| 10 | [10, 11) | 12,000 | c. 102,000 BCE (-101999) | c. 90,000 BCE (-89999) | The torch shrinks to a point as we leave the ground |
| 11 | [11, 12) | 7,000 | c. 90,000 BCE (-89999) | c. 83,000 BCE (-82999) | Night Earth over Africa: one point of light |
| 12 | [12, 13) | 7,000 | c. 83,000 BCE (-82999) | c. 76,000 BCE (-75999) | Gold threads leave Africa |
| 13 | [13, 14) | 7,000 | c. 76,000 BCE (-75999) | c. 69,000 BCE (-68999) | Across Arabia. "ARABIA" |
| 14 | [14, 15) | 7,000 | c. 69,000 BCE (-68999) | c. 62,000 BCE (-61999) | Along the coasts of South Asia. "ASIA" |
| 15 | [15, 16) | 7,000 | c. 62,000 BCE (-61999) | c. 55,000 BCE (-54999) | Island by island through Southeast Asia |
| 16 | [16, 17) | 7,000 | c. 55,000 BCE (-54999) | c. 48,000 BCE (-47999) | Boats cross to Sahul. "AUSTRALIA" |
| 17 | [17, 18) | 7,000 | c. 48,000 BCE (-47999) | c. 41,000 BCE (-40999) | North into Europe. "EUROPE". Dive toward Indonesia |
| 18 | [18, 19) | 3,500 | c. 41,000 BCE (-40999) | c. 37,500 BCE (-37499) | Torch in a cave: lit rock, older paintings. A bone flute enters |
| 19 | [19, 20) | 3,500 | c. 37,500 BCE (-37499) | c. 34,000 BCE (-33999) | A hand pressed flat to the wall; ochre blown over it |
| 20 | [20, 21) | 3,500 | c. 34,000 BCE (-33999) | c. 30,500 BCE (-30499) | The blown ochre builds up round the hand |
| 21 | [21, 22) | 3,500 | c. 30,500 BCE (-30499) | c. 27,000 BCE (-26999) | The hand lifts away: a stencil remains |
| 22 | [22, 23) | 3,500 | c. 27,000 BCE (-26999) | c. 23,500 BCE (-23499) | Rest on the stencil; drift toward the mouth of the cave |
| 23 | [23, 24) | 3,000 | c. 23,500 BCE (-23499) | c. 20,500 BCE (-20499) | Ice-age night, aurora, mammoths on the snow |
| 24 | [24, 25) | 3,000 | c. 20,500 BCE (-20499) | c. 17,500 BCE (-17499) | Hide tent with someone inside, hearth, dog, snow. "into the Americas / by c. 13,000 BCE" |
| 25 | [25, 26) | 3,000 | c. 17,500 BCE (-17499) | c. 14,500 BCE (-14499) | Walkers set out with the fire; we rise to the planet: Siberia to Alaska |
| 26 | [26, 27) | 2,500 | c. 14,500 BCE (-14499) | c. 12,000 BCE (-11999) | The thread runs down the Americas to Chile |
| 27 | [27, 28) | 1,500 | c. 12,000 BCE (-11999) | c. 10,500 BCE (-10499) | The first dawn of the film |
| 28 | [28, 29) | 1,500 | c. 10,500 BCE (-10499) | c. 9000 BCE (-8999) | Hands press seed into soil beside a hearth. "farming begins". "SOUTHWEST ASIA / c. 9500 BCE" |
| 29 | [29, 30) | 1,500 | c. 9000 BCE (-8999) | c. 7500 BCE (-7499) | Wheat rises; the view widens |
| 30 | [30, 31) | 1,500 | c. 7500 BCE (-7499) | c. 6000 BCE (-5999) | "CHINA / c. 7000 BCE" (rice) and "MEXICO / c. 7000 BCE" (maize). "invented again and again, worlds apart" |
| 31 | [31, 32) | 1,000 | c. 6000 BCE (-5999) | c. 5000 BCE (-4999) | The same planting gesture in separate lands, one sunrise, a hearth in each |
| 32 | [32, 33) | 1,000 | c. 5000 BCE (-4999) | c. 4000 BCE (-3999) | "NEW GUINEA / c. 5000 BCE" (taro) and "ANDES / c. 5000 BCE" (potato) |
| 33 | [33, 34) | 600 | c. 4000 BCE (-3999) | c. 3400 BCE (-3399) | Pan to a mud-brick river city. "MESOPOTAMIA" |
| 34 | [34, 35) | 600 | c. 3400 BCE (-3399) | c. 2800 BCE (-2799) | Close on a reed stylus marking wet clay by an oil lamp. "writing / c. 3200 BCE" |
| 35 | [35, 36) | 600 | c. 2800 BCE (-2799) | c. 2200 BCE (-2199) | Pyramid ramps. "EGYPT". "millet in the Sahel / c. 2500 BCE" |
| 36 | [36, 37) | 600 | c. 2200 BCE (-2199) | c. 1600 BCE (-1599) | Brick streets and a great bath: "INDUS VALLEY". Platform mounds: "PERU" |
| 37 | [37, 38) | 600 | c. 1600 BCE (-1599) | c. 1000 BCE (-999) | Standing stones, a herd coming home, a fire. "BRITAIN" |
| 38 | [38, 39) | 400 | c. 1000 BCE (-999) | c. 600 BCE (-599) | The long road: a camel caravan behind a lantern |
| 39 | [39, 40) | 400 | c. 600 BCE (-599) | c. 200 BCE (-199) | Aqueduct and columns. "roads carry goods and ideas" |
| 40 | [40, 41) | 400 | c. 200 BCE (-199) | 201 CE (201) | Watchtowers and wall; a teacher with children under a banyan |
| 41 | [41, 42) | 400 | 201 CE (201) | 601 CE (601) | A stepped pyramid above the Maya forest |
| 42 | [42, 43) | 250 | 601 CE (601) | 851 CE (851) | Open ocean at sunset: a double-hulled canoe with a fire on deck. "Pacific voyagers reach Aotearoa / by c. 1300 CE" |
| 43 | [43, 44) | 250 | 851 CE (851) | 1101 CE (1101) | Temple towers and stone walls on far shores; the evening star |
| 44 | [44, 45) | 230 | 1101 CE (1101) | 1331 CE (1331) | A long, high island rises out of the starlight |
| 45 | [45, 46) | 60 | 1331 CE (1331) | 1391 CE (1391) | One ember crosses the dark. A town at dusk; windows go out. "1347-1351 / plague kills tens of millions" |
| 46 | [46, 47) | 60 | 1391 CE (1391) | 1451 CE (1451) | More windows go out; one lantern moves through |
| 47 | [47, 48) | 60 | 1451 CE (1451) | 1511 CE (1511) | Tall ships on a red dusk. "1492 / in the Americas, disease and conquest kill millions" |
| 48 | [48, 49) | 60 | 1511 CE (1511) | 1571 CE (1571) | The fire on the shore gutters and goes out |
| 49 | [49, 50) | 60 | 1571 CE (1571) | 1631 CE (1631) | Below the waterline. "12.5 million Africans / forced onto slave ships / 1500s - 1860s" |
| 50 | [50, 51) | 60 | 1631 CE (1631) | 1691 CE (1691) | One person reaches toward the grating: the hand from the cave wall |
| 51 | [51, 52) | 60 | 1691 CE (1691) | 1751 CE (1751) | The hold; the words stay; the light thins |
| 52 | [52, 53) | 34 | 1751 CE (1751) | 1785 CE (1785) | The ember crosses the dark into a furnace; a stoker, a shift going in |
| 53 | [53, 54) | 34 | 1785 CE (1785) | 1819 CE (1819) | The great wheel, mill windows, smoke |
| 54 | [54, 55) | 34 | 1819 CE (1819) | 1853 CE (1853) | A train on a viaduct; a lamplighter |
| 55 | [55, 56) | 33 | 1853 CE (1853) | 1886 CE (1886) | A gas flame gives way to a filament. "electric light, 1880s" |
| 56 | [56, 57) | 16 | 1886 CE (1886) | 1902 CE (1902) | A lamp-lit city with a tram |
| 57 | [57, 58) | 16 | 1902 CE (1902) | 1918 CE (1918) | Blackout, soldiers against a red sky, searchlights. "1914 - 1945 / two world wars" |
| 58 | [58, 59) | 16 | 1918 CE (1918) | 1934 CE (1934) | Everything recedes to one candle. "six million Jews murdered / in the Holocaust" |
| 59 | [59, 60) | 16 | 1934 CE (1934) | 1950 CE (1950) | The candle gutters; a bloom swells on the horizon without a flash. "1945" |
| 60 | [60, 61) | 16 | 1950 CE (1950) | 1966 CE (1966) | A family around a television, seated where the first family sat |
| 61 | [61, 62) | 15 | 1966 CE (1966) | 1981 CE (1981) | Into the screen: a boot lifts from its print. "1969" |
| 62 | [62, 63) | 15 | 1981 CE (1981) | 1996 CE (1996) | A health worker vaccinates a child. "1980: smallpox is gone" |
| 63 | [63, 64) | 15 | 1996 CE (1996) | 2011 CE (2011) | The night planet, cities lighting, threads between them |
| 64 | [64, 65) | 15 | 2011 CE (2011) | 2026 CE (2026) | Dive into Africa; a newborn wrapped in ochre red, under a lamp |
| 65 | [65, 66) | 12 | 2026 CE (2026) | 2038 CE (2038) | The 2026 line sweeps; the room becomes a projection. "2026 NOW / 8.3 billion of us". "A child born this year will be 74 in 2100." |
| 66 | [66, 67) | 12 | 2038 CE (2038) | 2050 CE (2050) | That child, in an ochre-red scarf with a lantern, walks past solar roofs and turbines |
| 67 | [67, 68) | 10 | 2050 CE (2050) | 2060 CE (2060) | Grown, walking a sea wall; the old street is under water, the coral below is white. "by 2100: about 2.5 degrees C hotter / higher seas, most coral reefs lost" |
| 68 | [68, 69) | 10 | 2060 CE (2060) | 2070 CE (2070) | The same walk along the drowned street, now with a child of their own |
| 69 | [69, 70) | 8 | 2070 CE (2070) | 2078 CE (2078) | They plant mangroves against the tide |
| 70 | [70, 71) | 6 | 2078 CE (2078) | 2084 CE (2084) | At work beside a lattice of light. "AI is everywhere. / Who it serves is our choice." |
| 71 | [71, 72) | 5 | 2084 CE (2084) | 2089 CE (2089) | A shaded, greener town. "2080s: about 10 billion of us, / perhaps the most ever" |
| 72 | [72, 73) | 4 | 2089 CE (2089) | 2093 CE (2093) | Older, with a stick and a grandchild; small lights on the Moon |
| 73 | [73, 74) | 1 | 2093 CE (2093) | 2094 CE (2094) | 2093: night on a hill by the sea; an elder and a child at a small fire |
| 74 | [74, 75) | 1 | 2094 CE (2094) | 2095 CE (2095) | The same stars as the first night, now still |
| 75 | [75, 76) | 1 | 2095 CE (2095) | 2096 CE (2096) | Push in to the fire and through it to the hands |
| 76 | [76, 77) | 1 | 2096 CE (2096) | 2097 CE (2097) | Old hands cup an ember: the first shot again |
| 77 | [77, 78) | 1 | 2097 CE (2097) | 2098 CE (2098) | The ember is tipped into a child's hands |
| 78 | [78, 79) | 1 | 2098 CE (2098) | 2099 CE (2099) | The old hands let go and leave the frame. "THE SAME FIRE" |
| 79 | [79, 80) | 1 | 2099 CE (2099) | 2100 CE (2100) | 2100 CE. The child holds the fire up to us. One last note |
<!-- TABLE:END -->

## 4. Every date and number on screen

Besides the counter, these are the only dates or quantities the film draws. All other words on screen are
place names ("AFRICA", "ARABIA", "ASIA", "AUSTRALIA", "EUROPE", "SOUTHWEST ASIA", "CHINA", "MEXICO",
"NEW GUINEA", "ANDES", "MESOPOTAMIA", "EGYPT", "INDUS VALLEY", "PERU", "BRITAIN"), short undated lines
("farming begins", "invented again and again, worlds apart", "roads carry goods and ideas",
"AI is everywhere. Who it serves is our choice."), "PROJECTION" and the title.

| on screen (when) | year used | basis (mainstream estimate) |
|---|---|---|
| counter start "c. 300,000 BCE" (0 s) | 300,000 BCE | Oldest *H. sapiens* fossils, Jebel Irhoud, about 300,000 years old |
| "into the Americas, by c. 13,000 BCE" (24.7 s) | c. 13,000 BCE | About 15,000 years ago is a conservative floor. Some evidence (White Sands footprints) is much older, hence "by" |
| "SOUTHWEST ASIA c. 9500 BCE" (28.7 s) | c. 9500 BCE | First cultivation of cereals and pulses |
| "CHINA c. 7000 BCE" (30.4 s) | c. 7000 BCE | Rice and millet cultivation under way (domestication was gradual) |
| "MEXICO c. 7000 BCE" (30.4 s) | c. 7000 BCE | Maize domesticated about 9,000 years ago |
| "NEW GUINEA c. 5000 BCE" (32 s) | c. 5000 BCE | Kuk Swamp mounded fields (some evidence of cultivation is older) |
| "ANDES c. 5000 BCE" (32 s) | c. 5000 BCE | Potato domestication; estimates run about 7,000-10,000 years ago |
| "writing c. 3200 BCE" (34.4 s) | c. 3200 BCE | Earliest cuneiform. Egypt close behind; China and Mesoamerica later, independently |
| "millet in the Sahel c. 2500 BCE" (35.7 s) | c. 2500 BCE | Domesticated pearl millet in Mali |
| "Pacific voyagers reach Aotearoa by c. 1300 CE" (42.9 s) | c. 1300 CE | Polynesian settlement of New Zealand, about 1250-1300 |
| "1347-1351, plague kills tens of millions" (45.3 s) | 1347-1351 | Black Death in Europe. "Tens of millions" is safe against all mainstream estimates |
| "1492" (47.2 s) | 1492 | First Columbus voyage (no name on screen) |
| "in the Americas, disease and conquest kill millions" | after 1492 | Population collapse; totals are contested, so no figure is given |
| "12.5 million Africans forced onto slave ships, 1500s - 1860s" (49.2 s) | 1501-1866 | SlaveVoyages database: about 12.5 million people embarked |
| "electric light, 1880s" (55.5 s) | 1880s | Incandescent lamps 1879-80; first public central stations 1882 |
| "1914 - 1945, two world wars" (57.1 s) | 1914, 1945 | |
| "six million Jews murdered in the Holocaust" (58.2 s) | no year drawn | USHMM and Yad Vashem figure |
| "1945" over the bloom (59.7 s) | 1945 | First use of atomic bombs |
| "1969" (61.2 s) | 1969 | First people on the Moon |
| "1980: smallpox is gone" (62 s) | 1980 | WHO declaration of eradication |
| "2026 NOW" (65 s) | 2026 | Production date, late November 2026 |
| "8.3 billion of us" (65 s) | 2026 | UN World Population Prospects 2024, mid-2026 about 8.3 billion |
| "A child born this year will be 74 in 2100." (65.5 s) | 2026 to 2100 | 2100 - 2026 = 74 |
| "by 2100: about 2.5 degrees C hotter" (67.9 s) | 2100, projection | See section 5 |
| "2080s: about 10 billion of us, perhaps the most ever" (71.6 s) | 2080s, projection | UN WPP 2024 medium: peak about 10.3 billion in the mid-2080s |
| final counter "2100 CE" (79.5-80 s) | 2100 | |

Event labels appear while the running counter is near their year but not always exactly on it (a
label has to stay long enough to be read). The counter is the clock; a label names an event.

## 5. 2026 to 2100: the projection and why

The film follows **one life**: someone born in 2026 is 74 in 2100. That turns a forecast into
something a viewer can feel, and it is honest about scale: 2100 is not a far-off age, it is one lifetime.

* **Climate.** 2024 was the first calendar year about 1.5 degrees C above the pre-industrial level.
  Recent assessments (UNEP Emissions Gap, Climate Action Tracker) put current policies near
  2.6-2.8 degrees by 2100 and full pledges near 2.3-2.5. The film says **"about 2.5"**: it assumes
  policy keeps tightening somewhat, and the true value could well be higher or lower.
* **Seas.** IPCC AR6, intermediate emissions: about 0.4-0.8 m of rise by 2100. Shown as a flooded old
  street, a sea wall, and people moving and planting. Only the words "higher seas" are drawn.
* **Coral.** IPCC SR1.5: warm-water reefs lose more than 99% at 2 degrees. "Most coral reefs lost" is,
  if anything, mild. It is the film's plain, unsoftened cost, drawn as a cut-away of white coral
  under the walker's feet.
* **Energy.** Solar and wind are already the cheapest new power in much of the world. The film shows
  solar roofs and turbines as ordinary background and claims no number.
* **People.** UN medium projection: a peak of about 10.3 billion in the mid-2080s. Other groups put the
  peak earlier and lower, hence "about" and "perhaps".
* **AI.** The least predictable item, so the film makes no forecast about capability. It shows it as a
  presence beside a working person and says the part that is still open: **who it serves is our choice**.
* **Health.** The hopeful part that has a track record: the newborn of 2026 can expect to reach old age.
  It is shown by the life itself, not by a claim.
* **Space.** A few small lights on the Moon: plausible by mid-century, and drawn as projection. No Mars
  city, no space elevator.
* **Not claimed.** No end of war, no end of poverty, no solved climate, and no collapse.

The honest hope is small and specific: a person can still grow old, and still hand something to a child.

## 6. Music and sound (all synthesized in code, no samples)

* **Pulse = the time rule.** The tempo is 60 BPM, so **one beat is one slot**. Drum and plucked patterns
  get denser as history gets denser (1, 2, 4, then 8 notes per second), then everything falls back to
  **one heartbeat per second** for the last seven seconds: one beat, one year.
* **One original tune, the "ember theme"**, in D, handed on the way the flame is. Instruments arrive
  roughly in the order people made them (skin drums leave no trace, so their place is a guess):
  breath and fire (0 s); a humming voice (1.7 s); stone knapping and footsteps; a skin drum (9 s);
  **bone flute** (18.5 s, in the cave: the oldest known flutes are about that old); plucked **lyre**
  (33.5 s, first cities); bronze **bells** (38 s); **bowed strings** (43 s, when the counter reads about
  860 CE); a tolling church bell (plague); one bare voice (the hold); piston rhythm and **piano**
  (52 s, counter about 1760); snare and drones (war), then near-silence and one low bowed note for the
  Holocaust line; synth pads and radio tones (1969); a digital arpeggio; a soft hum to the newborn;
  glassy pads for the projection; and at the end **the same hummed voice, same notes, same octave as the
  beginning**, joined by the flute, resolving to D major.
* The key is D minor / modal until **the first dawn**, where it turns to **D major**.
* **Gear changes**: three ratchet clicks and a low thud on every change of rate, pitched lower with
  each downshift.
* **2026**: a rising swell, then a deep soft hit and one clear bell at t = 65.000, and space.
* **Ambience**: fire crackle, wind, crickets (the first and last nights only), cave drips, snow wind,
  dawn birds, surf, hull creaks, engines, distant booms.
* **Delivery**: 48 kHz stereo, -14 LUFS integrated, true peak below -1 dBTP after AAC encoding.

## 7. How it is made

One self-contained `index.html` (built from `src/` by `tools/build.mjs`). Canvas2D draws the layers; a
WebGL2 compositor adds the sky, the planet, the rock wall, the fire, rim light from the flame, bloom,
the projection look and grain. The close-up hands are ray-marched 3D shapes. All lettering is a
stroked alphabet written for this film. No libraries, fonts, images or audio files.
`renderAt(t)` is a pure function of t.
