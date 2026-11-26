#!/usr/bin/env bash
# mux + derivatives + checks.  bash tools/finish.sh
set -e
cd "$(dirname "$0")/.."
cp out/st2.wav soundtrack.wav
ffmpeg -y -loglevel error -i out/video_full.mp4 -i soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart opus55_creates.mp4
# X version: two-pass to stay under 60 MB at the same length
ffmpeg -y -loglevel error -i opus55_creates.mp4 -c:v libx264 -preset slow -b:v 7600k -maxrate 11000k -bufsize 16000k -pass 1 -passlogfile out/x2p -an -f mp4 NUL
ffmpeg -y -loglevel error -i opus55_creates.mp4 -c:v libx264 -preset slow -b:v 7600k -maxrate 11000k -bufsize 16000k -pass 2 -passlogfile out/x2p -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart opus55_creates_x.mp4
rm -f out/x2p*
ffmpeg -y -loglevel error -i opus55_creates.mp4 -vf "fps=2,scale=320:-1,tile=10x11" -frames:v 1 contact_sheet.png
echo "== ffprobe"; for f in opus55_creates.mp4 opus55_creates_x.mp4; do ffprobe -v error -show_entries stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,bit_rate,sample_rate,channels,duration -show_entries format=duration,size -of compact "$f"; done
echo "== decode"; for f in opus55_creates.mp4 opus55_creates_x.mp4; do ffmpeg -v error -i "$f" -f null - && echo "$f decode ok"; ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$f"; done
echo "== loudness"; for f in opus55_creates.mp4 opus55_creates_x.mp4 soundtrack.wav; do echo "$f"; ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):"; done
echo "== faststart"; python -c "
for f in ['opus55_creates.mp4','opus55_creates_x.mp4']:
  d=open(f,'rb').read(1<<16); print(f,'moov before mdat:', d.find(b'moov')!=-1 and (d.find(b'mdat')==-1 or d.find(b'moov')<d.find(b'mdat')))"
echo "== flashes"; python tools/flashcheck.py opus55_creates.mp4
echo "== motion"; python tools/metrics.py opus55_creates.mp4 | head -6
