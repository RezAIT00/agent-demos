// Writes (or replaces) the "Sound" section of ../NOTES.md. The cue table comes
// straight from cues.json and the numbers from check_report.json / mix_report.json.
const fs = require('fs');
const path = require('path');
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const sheet = read('cues.json'), chk = read('check_report.json'), mix = read('mix_report.json');
const tc = (f) => (f / 30).toFixed(3);

const grouped = ['glint', 'band', 'sheen', 'bubble', 'arm'];
const rows = sheet.cues.filter((c) => !grouped.includes(c.id)).map((c) => ({ f: c.frame, t: tc(c.frame), fr: String(c.frame), ev: c.label, snd: c.sound }));
const group = (id, ev, snd) => {
  const g = sheet.cues.filter((c) => c.id === id);
  rows.push({ f: g[0].frame, t: g.map((c) => tc(c.frame)).join(', '), fr: g.map((c) => c.frame).join(', '), ev, snd });
};
group('glint', 'the dust grain flashes', 'tiny mineral tink');
group('band', 'a layer boundary sweeps up through the mist (thickest frame)', 'wind whoosh that peaks there');
group('sheen', 'light slides across the faces (brightest frame)', 'faint airy shimmer that peaks there');
group('bubble', 'the lattice seals a hollow: a bubble appears', 'small round air blip');
group('arm', 'the lamp flares one arm after another (arms 5, 6, 1, 2, 3, 4, 5)', 'seven celesta notes rising from A5 to B6, each panned to its arm');
rows.sort((a, b) => a.f - b.f);
const table = ['| time (s) | frame | on screen | sound |', '|---|---|---|---|', ...rows.map((r) => `| ${r.t} | ${r.fr} | ${r.ev.replace(/\|/g, '/')} | ${r.snd} |`)].join('\n');

const arms = chk.picture.arm_flares;
const faint = chk.too_faint_to_judge.length;
const a = chk.mp4_streams.find((s) => s.codec_type === 'audio');
const section = `## Sound

\`snowflake-sound.mp4\` is the same picture with a soundtrack. The video stream is copied, not re-encoded, and \`snowflake.mp4\` is unchanged.
**Nobody has listened to it.** Everything below was checked by measurement and by looking at spectrograms.
Measurements can show timing and level, not whether it sounds good. **A person should listen before it is posted.**

Everything is synthesised in \`audio/synth.js\` from sine partials and seeded noise. There are no samples, no generated-audio models, no voices and no outside music.

### Layers

| layer | what it is |
|---|---|
| cloud wind | stereo pink noise through moving filters. Each weather layer has its own pitch and hiss, and its strength follows the film's fall speed. It opens and fades as the cloud base lifts |
| mist whooshes and sheen | soft swells peaking on the frame the mist band or face light peaks |
| nucleation | vapour motes (their rate follows the film's vapour amount), grain tinks, a wet swell with droplet plips, ice crackle panned with the freezing front, gathering glass partials, a flash chord |
| lattice shimmer | in every video frame from the lattice fade-in, tiny grains. Their number rises with the cells the model froze in that frame (as the square root, 1 to 9). Pitch follows how far out they froze, and each weather layer has its own timbre |
| stage chimes | glass bells for the two ribs, a six-note celesta arpeggio for the six arms, and different figures for side branches, dry layer, updraught, sector plates and facets |
| valley | muffled snowfall noise, a faint distant air tone and very soft settling flakes |
| touchdown | a held breath, then a tiny tick with a faint wool thud |
| score | sparse felt piano on cue frames, a short melody over the valley, a quiet sine pad that changes chord with each layer, and a resting D add9 chord (D major / B minor colours) |
| space | one eight-line feedback delay reverb |

### How the cues are timed

\`audio/cues.js\` loads the timing code **from inside the delivered \`snowflake.html\`** (it records the file's SHA-1): the growth lattice, the growth clock and the director.
Each cue is the first or peak video frame of its event, and is placed on that frame's first sample (frame × 1600 at 48 kHz). A few figures are rolled on from there by a few milliseconds or frames.
Weather-layer cues are the first frame on which the displayed simulation step enters the layer.

### Cue sheet

Continuous beds: cloud wind from 0 s to ${tc(sheet.cues.find((c) => c.id === 'valley').frame)} s (fading from ${tc(sheet.cues.find((c) => c.id === 'exit').frame)} s), vapour motes while vapour is on screen, lattice shimmer while the crystal is growing,
valley snowfall from ${tc(sheet.cues.find((c) => c.id === 'exit').frame)} s to the end, and the pad throughout. Fades: 60 ms in, 300 ms out.

${table}

### Commands

\`\`\`
cd audio
npm install                      # three 0.180.0, only used to run the film's camera maths
node cues.js                     # -> cues.json
node synth.js --templates        # -> snowflake.wav (48 kHz, 24-bit stereo, 960,000 samples = 20.000 s)
cd ..
ffmpeg -i snowflake.mp4 -i audio/snowflake.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart snowflake-sound.mp4
cd audio
python check_audio.py > check_output.txt     # measurements, spectrogram.png, waveform.png, sheet_audio.png (needs numpy + pillow)
python zoom.py                   # -> sheet_zoom.png
\`\`\`

\`check_audio.py\` runs \`ffprobe\`, \`ffmpeg -af ebur128=peak=true\`, \`showspectrumpic\` and \`showwavespic\`.
\`node synth.js --stems\` writes each layer alone, and \`python levels.py\` prints levels around the hits.
Deleting every generated audio file and re-running these steps gave a **byte-identical** \`cues.json\`, WAV and MP4 on this machine.

### Mix

* Static gain (${mix.gainDb} dB on the final pass) to reach the loudness target. A look-ahead true-peak limiter with a −2 dBTP ceiling is in place and did **not** act on this mix (${mix.maxLimiterReductionDb} dB reduction). I tested it separately on a deliberately hot signal.
* The wind is high-passed at 70–85 Hz, and the pad and piano have a low shelf (about −5 dB under 190 Hz) to keep the mix light.

### Measurements

| check | result |
|---|---|
| integrated loudness | WAV ${chk.loudness_wav.integrated_LUFS} LUFS, MP4 ${chk.loudness_mp4.integrated_LUFS} LUFS (target about −16); loudness range ${chk.loudness_mp4.LRA_LU} LU |
| true peak | ${chk.loudness_mp4.true_peak_dBTP} dBTP (limit −1) |
| clipped samples | ${chk.wav_clipped_samples} in the WAV, ${chk.mp4_clipped_samples} in the decoded AAC |
| streams | H.264 High 1080×1080 30 fps, 600 frames, plus AAC-LC ${a.sample_rate} Hz ${a.channels}-channel at ${(a.bit_rate / 1000).toFixed(0)} kb/s; both 20.000 s; faststart |
| picture untouched | video stream MD5 equals the silent file's: ${chk.video_stream_identical_to_silent ? 'yes' : 'NO'} |
| AAC delay | ${chk.aac_lag_samples} samples; decoded length ${chk.decoded_samples.mp4_aac} samples |
| gaps | quietest 50 ms between the fades is ${chk.quietest_50ms.dBFS} dBFS at ${chk.quietest_50ms.at_s} s; no window below −55 dBFS |
| clicks | ${chk.transients_flagged} flagged. Self-test: ${chk.click_detector_selftest}. So it catches an obvious click, but may miss a very small one |
| hit timing in the MP4 | each hit rendered alone and searched for in the encoded audio: ${chk.clear_matches_within_half_a_frame} clear matches within half a frame (worst ${chk.worst_clear_match_offset_ms} ms). ${faint} of 29 were too masked to judge |
| arm flares against the picture | ${arms.filter((x) => x.difference_frames === 0).length} of ${arms.length} sound on the exact frame that arm is brightest relative to the others; the other differs by 1 frame (all arms are brightening then) |
| flash against the picture | cue frame ${chk.picture.flash.cue_frame}, brightest video frame ${chk.picture.flash.brightest_video_frame}; their mean brightness is equal to within 0.02 of 255 |
| mitten against the picture | cue frame ${chk.picture.mitten_enters.cue_frame}, first video frame with the mitten in the bottom strip ${chk.picture.mitten_enters.first_video_frame_with_new_dark_area} |
| touchdown motion | worked out from the film's camera maths, not from video pixels: an arm tip's on-screen motion changes abruptly at frame 565, the cue frame |

The images are \`audio/sheet_audio.png\` (whole film with cue lines) and \`audio/sheet_zoom.png\` (nucleation, the six arms, touchdown and finale).
The raw ffmpeg pictures are \`audio/spectrogram.png\` and \`audio/waveform.png\`.

### Known limits

* Not judged by ear: timbre, balance, whether the piano reads as a piano, and whether the tick feels soft.
* ${faint} of the 7 air-bubble blips are too quiet under the other layers to verify by measurement, and may not be audible.
* The mix still has a fair amount of energy at 80–160 Hz from the pad and low piano notes. Check it on phone speakers and headphones.
`;

const notesPath = path.join(__dirname, '..', 'NOTES.md');
let notes = fs.readFileSync(notesPath, 'utf8');
const start = notes.indexOf('\n## Sound\n');
if (start >= 0) notes = notes.slice(0, start + 1);
notes = notes.replace(/\s*$/, '\n\n') + section;
fs.writeFileSync(notesPath, notes);
console.log('NOTES.md updated:', rows.length, 'cue rows; faint bubbles', faint);
