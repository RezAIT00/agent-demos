#!/usr/bin/env bash
# Soundtrack -> mux -> X copy -> checks.   bash tools/finish.sh      (expects tmp/video.mp4 from tools/cap.mjs)
# Plumbing adapted from an earlier project's finishing script.
set -e
cd "$(dirname "$0")/.."
node tools/synth.mjs soundtrack.wav
ffmpeg -y -loglevel error -i tmp/video.mp4 -i soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart pelican_trailer.mp4
# X copy: two-pass at about 8 Mbit/s
ffmpeg -y -loglevel error -i pelican_trailer.mp4 -c:v libx264 -preset slow -b:v 7800k -maxrate 11000k -bufsize 16000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -pass 1 -passlogfile tmp/x2p -an -f mp4 NUL
ffmpeg -y -loglevel error -i pelican_trailer.mp4 -c:v libx264 -preset slow -b:v 7800k -maxrate 11000k -bufsize 16000k -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -pass 2 -passlogfile tmp/x2p -c:a aac -b:a 256k -ar 48000 -movflags +faststart pelican_trailer_x.mp4
rm -f tmp/x2p*
python tools/audit.py pelican_trailer.mp4 pelican_trailer_x.mp4 | tee tmp/audit.txt
