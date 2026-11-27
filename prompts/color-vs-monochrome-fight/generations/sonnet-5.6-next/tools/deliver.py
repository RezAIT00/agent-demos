"""Encodes the delivery files from the lossless master plus soundtrack.wav.

  deliver.py            fight.mp4 (CRF 16) and fight_x.mp4 (two-pass, about 8 Mbit/s)
"""
import os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
MASTER = os.path.join(ROOT, 'work', 'master.mkv')
WAV = os.path.join(ROOT, 'soundtrack.wav')
VF = 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p'
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
# ffmpeg's AAC encoder overshoots badly on dense transients when noise substitution is on
AAC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-aac_pns', '0', '-aac_tns', '0']
COMMON = ['-vf', VF, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] + TAGS


def run(cmd):
    subprocess.run(cmd, check=True, cwd=os.path.join(ROOT, 'work'))


def main():
    base = ['ffmpeg', '-y', '-v', 'error', '-i', MASTER, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0']
    tail = ['-t', '50', '-movflags', '+faststart']
    run(base + COMMON + ['-preset', 'slow', '-crf', '16'] + AAC + tail + [os.path.join(ROOT, 'fight.mp4')])
    print('fight.mp4 done')
    two = COMMON + ['-preset', 'slow', '-b:v', '8M', '-maxrate', '11M', '-bufsize', '16M', '-passlogfile', 'x264pass']
    run(['ffmpeg', '-y', '-v', 'error', '-i', MASTER] + two + ['-pass', '1', '-an', '-t', '50', '-f', 'null', os.devnull])
    run(base + two + ['-pass', '2'] + AAC + tail + [os.path.join(ROOT, 'fight_x.mp4')])
    print('fight_x.mp4 done')
    for f in os.listdir(os.path.join(ROOT, 'work')):
        if f.startswith('x264pass'):
            os.remove(os.path.join(ROOT, 'work', f))
    for name in ('fight.mp4', 'fight_x.mp4'):
        print('%-12s %.1f MB' % (name, os.path.getsize(os.path.join(ROOT, name)) / 1e6))


if __name__ == '__main__':
    main()
