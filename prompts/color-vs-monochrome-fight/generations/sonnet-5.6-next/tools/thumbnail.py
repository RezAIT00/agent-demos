"""thumbnail.png: frame 767 of the lossless master (the meteor axe heel) with the title in our own lettering."""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from sheets import read_frames, draw_text, text_width

FRAME = 767


def main():
    img = read_frames(os.path.join(ROOT, 'work', 'master.mkv'), [FRAME], 1920, 1080)[FRAME]
    size, gap = 150, 62
    w1, wx, w2 = text_width('IRO', size), text_width('×', size), text_width('SUMI', size)
    x = 1920 - (w1 + wx + w2 + 2 * gap) - 74
    y = 1080 - size - 66
    draw_text(img, 'IRO', x, y, size, (255, 40, 126), weight=0.155, outline=(255, 246, 228))
    draw_text(img, '×', x + w1 + gap, y, size, (8, 8, 8), weight=0.155, outline=(246, 246, 246))
    draw_text(img, 'SUMI', x + w1 + wx + 2 * gap, y, size, (8, 8, 8), weight=0.155, outline=(246, 246, 246))
    out = os.path.join(ROOT, 'thumbnail.png')
    img.save(out)
    print('wrote', out, img.size)


if __name__ == '__main__':
    main()
