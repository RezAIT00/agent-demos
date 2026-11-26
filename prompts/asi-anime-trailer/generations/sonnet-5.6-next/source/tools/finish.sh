#!/usr/bin/env bash
# Build everything from source, then run the delivery checks.
#   bash tools/finish.sh            (render + audio + mux + checks)
#   bash tools/finish.sh --no-render   (reuse out/video.mp4)
# Adapted for plumbing from opus55-creates/tools/finish.sh.
set -e
cd "$(dirname "$0")/.."
mkdir -p out
node tools/build.mjs
if [ "$1" != "--no-render" ]; then
  echo "== soundtrack"
  node src/audio/score.mjs soundtrack.wav | tee out/audio_log.txt
  echo "== picture (frame exact, 24 fps)"
  node tools/cap.mjs --from 0 --to 87.5 --out out/video.mp4 --hashes out/hashes.json
fi
node tools/cap.mjs --quiet --eval 'JSON.stringify(TIMELINE())' | grep '^{' > out/timeline.json

echo "== mux master (video stream copied, no second encode)"
ffmpeg -y -loglevel error -i out/video.mp4 -i soundtrack.wav -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart asi_trailer.mp4

echo "== X copy (two pass, about 7 Mbit/s total: the crf 16 master is only 7.7, so 8 would not be smaller)"
X="-c:v libx264 -preset slow -tune animation -b:v 6650k -maxrate 10000k -bufsize 15000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
ffmpeg -y -loglevel error -i asi_trailer.mp4 $X -pass 1 -passlogfile out/x2pass -an -f mp4 NUL
# audio is copied, not re-encoded: a second AAC pass pushed true peak to -0.2 dBTP
ffmpeg -y -loglevel error -i asi_trailer.mp4 $X -pass 2 -passlogfile out/x2pass -c:a copy -movflags +faststart asi_trailer_x.mp4
rm -f out/x2pass*

echo "== contact sheet (one frame every 2 s, from the delivered file) and thumbnail"
ffmpeg -y -loglevel error -i asi_trailer.mp4 -vf "select='eq(mod(n\,48)\,42)',scale=384:-1:flags=lanczos,tile=5x9:padding=6:margin=6:color=0x05060f" -frames:v 1 -fps_mode passthrough contact_sheet.png
node tools/cap.mjs --quiet --thumb thumbnail.png

echo "== streams"
for f in asi_trailer.mp4 asi_trailer_x.mp4; do
  echo "$f"
  ffprobe -v error -show_entries stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,sample_rate,channels,bit_rate,duration,nb_frames -show_entries format=duration,size,bit_rate -of compact "$f"
done
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of compact soundtrack.wav

echo "== full decode (must print nothing between the markers)"
for f in asi_trailer.mp4 asi_trailer_x.mp4; do
  echo "-- $f"; ffmpeg -v error -i "$f" -f null - ; echo "-- exit $?"
  echo -n "decoded video frames: "; ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f"
done

echo "== faststart"
python - <<'EOF'
for f in ['asi_trailer.mp4', 'asi_trailer_x.mp4']:
    d = open(f, 'rb').read()
    pos, order = 0, []
    while pos + 8 <= len(d):
        size = int.from_bytes(d[pos:pos + 4], 'big'); kind = d[pos + 4:pos + 8].decode('latin1')
        if size == 1: size = int.from_bytes(d[pos + 8:pos + 16], 'big')
        order.append(kind)
        if size <= 0: break
        pos += size
    print(f, order, 'faststart OK' if order.index('moov') < order.index('mdat') else 'NOT faststart')
EOF

echo "== loudness (ebur128, true peak)"
for f in asi_trailer.mp4 asi_trailer_x.mp4 soundtrack.wav; do
  echo "-- $f"; ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p' | grep -E "I:|LRA:|Peak:"
done

echo "== audio QA"
python tools/audiocheck.py soundtrack.wav
echo "== flashes"
python tools/flashcheck.py asi_trailer.mp4
echo "== flashes (X copy)"
python tools/flashcheck.py asi_trailer_x.mp4
echo "== luma"
python tools/lumaaudit.py asi_trailer.mp4 out/timeline.json --plot out/luma.png
