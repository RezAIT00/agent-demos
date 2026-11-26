// Writes the 80-row rate table into TREATMENT.md (between the TABLE markers).
// Counter values come straight from src/00_timeline.js so they cannot drift.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TL = createRequire(import.meta.url)(path.join(root, 'src', '00_timeline.js'));

const ON_SCREEN = [
  'Black. A dim ember in a pair of hands; it is breathed on',
  'The glow finds the hands. "AFRICA"',
  'A child\'s smaller hands rise to meet them',
  'The adult tips the ember across',
  'The child holds it; sparks lift',
  'Pull back: the ember is feeding a campfire',
  'A band around the fire, acacias, star trails racing',
  'A flint knapper, a mother and infant, ochre',
  'One stands and lifts a burning branch',
  'They walk; the camera follows the torch',
  'The torch shrinks to a point as we leave the ground',
  'Night Earth over Africa: one point of light',
  'Gold threads leave Africa',
  'Across Arabia. "ARABIA"',
  'Along the coasts of South Asia. "ASIA"',
  'Island by island through Southeast Asia',
  'Boats cross to Sahul. "AUSTRALIA"',
  'North into Europe. "EUROPE". Dive toward Indonesia',
  'Torch in a cave: lit rock, older paintings. A bone flute enters',
  'A hand pressed flat to the wall; ochre blown over it',
  'The blown ochre builds up round the hand',
  'The hand lifts away: a stencil remains',
  'Rest on the stencil; drift toward the mouth of the cave',
  'Ice-age night, aurora, mammoths on the snow',
  'Hide tent with someone inside, hearth, dog, snow. "into the Americas / by c. 13,000 BCE"',
  'Walkers set out with the fire; we rise to the planet: Siberia to Alaska',
  'The thread runs down the Americas to Chile',
  'The first dawn of the film',
  'Hands press seed into soil beside a hearth. "farming begins". "SOUTHWEST ASIA / c. 9500 BCE"',
  'Wheat rises; the view widens',
  '"CHINA / c. 7000 BCE" (rice) and "MEXICO / c. 7000 BCE" (maize). "invented again and again, worlds apart"',
  'The same planting gesture in separate lands, one sunrise, a hearth in each',
  '"NEW GUINEA / c. 5000 BCE" (taro) and "ANDES / c. 5000 BCE" (potato)',
  'Pan to a mud-brick river city. "MESOPOTAMIA"',
  'Close on a reed stylus marking wet clay by an oil lamp. "writing / c. 3200 BCE"',
  'Pyramid ramps. "EGYPT". "millet in the Sahel / c. 2500 BCE"',
  'Brick streets and a great bath: "INDUS VALLEY". Platform mounds: "PERU"',
  'Standing stones, a herd coming home, a fire. "BRITAIN"',
  'The long road: a camel caravan behind a lantern',
  'Aqueduct and columns. "roads carry goods and ideas"',
  'Watchtowers and wall; a teacher with children under a banyan',
  'A stepped pyramid above the Maya forest',
  'Open ocean at sunset: a double-hulled canoe with a fire on deck. "Pacific voyagers reach Aotearoa / by c. 1300 CE"',
  'Temple towers and stone walls on far shores; the evening star',
  'A long, high island rises out of the starlight',
  'One ember crosses the dark. A town at dusk; windows go out. "1347-1351 / plague kills tens of millions"',
  'More windows go out; one lantern moves through',
  'Tall ships on a red dusk. "1492 / in the Americas, disease and conquest kill millions"',
  'The fire on the shore gutters and goes out',
  'Below the waterline. "12.5 million Africans / forced onto slave ships / 1500s - 1860s"',
  'One person reaches toward the grating: the hand from the cave wall',
  'The hold; the words stay; the light thins',
  'The ember crosses the dark into a furnace; a stoker, a shift going in',
  'The great wheel, mill windows, smoke',
  'A train on a viaduct; a lamplighter',
  'A gas flame gives way to a filament. "electric light, 1880s"',
  'A lamp-lit city with a tram',
  'Blackout, soldiers against a red sky, searchlights. "1914 - 1945 / two world wars"',
  'Everything recedes to one candle. "six million Jews murdered / in the Holocaust"',
  'The candle gutters; a bloom swells on the horizon without a flash. "1945"',
  'A family around a television, seated where the first family sat',
  'Into the screen: a boot lifts from its print. "1969"',
  'A health worker vaccinates a child. "1980: smallpox is gone"',
  'The night planet, cities lighting, threads between them',
  'Dive into Africa; a newborn wrapped in ochre red, under a lamp',
  'The 2026 line sweeps; the room becomes a projection. "2026 NOW / 8.3 billion of us". "A child born this year will be 74 in 2100."',
  'That child, in an ochre-red scarf with a lantern, walks past solar roofs and turbines',
  'Grown, walking a sea wall; the old street is under water, the coral below is white. "by 2100: about 2.5 degrees C hotter / higher seas, most coral reefs lost"',
  'The same walk along the drowned street, now with a child of their own',
  'They plant mangroves against the tide',
  'At work beside a lattice of light. "AI is everywhere. / Who it serves is our choice."',
  'A shaded, greener town. "2080s: about 10 billion of us, / perhaps the most ever"',
  'Older, with a stick and a grandchild; small lights on the Moon',
  '2093: night on a hill by the sea; an elder and a child at a small fire',
  'The same stars as the first night, now still',
  'Push in to the fire and through it to the hands',
  'Old hands cup an ember: the first shot again',
  'The ember is tipped into a child\'s hands',
  'The old hands let go and leave the frame. "THE SAME FIRE"',
  '2100 CE. The child holds the fire up to us. One last note',
];
if (ON_SCREEN.length !== 80) throw new Error('need 80 descriptions, got ' + ON_SCREEN.length);

let rows = '| slot | seconds | years per second | counter at start | counter at end | on screen |\n';
rows += '|---:|---|---:|---|---|---|\n';
const show = (c) => `${TL.formatYear(c)} (${c})`;
for (let n = 0; n < 80; n++) {
  rows += `| ${n} | [${n}, ${n + 1}) | ${TL.group(TL.RATES[n])} | ${show(TL.BOUNDS[n])} | ${show(TL.BOUNDS[n + 1])} | ${ON_SCREEN[n]} |\n`;
}

const file = path.join(root, 'TREATMENT.md');
const text = fs.readFileSync(file, 'utf8');
const out = text.replace(/<!-- TABLE:START -->[\s\S]*<!-- TABLE:END -->/,
  () => `<!-- TABLE:START -->\n${rows}<!-- TABLE:END -->`);
fs.writeFileSync(file, out);
console.log('table written: 80 rows, sum of rates =', TL.RATES.reduce((a, b) => a + b, 0));
