"""Copies chosen full-resolution frames of the 4K film render into stills/.  For lightning shots the
brightest frame around the stroke is taken, so the channel is caught.

  python source/tools/pick_stills.py renders/final stills
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image

# (shot, frame or (first, last) to search for the brightest, file name)
PICKS = [
    (1, 72, "01_aerial_clear_afternoon"), (2, 84, "02_fifth_avenue_to_empire_state"), (3, 70, "03_library_lion_golden_hour"),
    (4, 96, "04_east_on_42nd_sunset"), (5, 14, "05_rooftop_last_light"), (5, 160, "06_rooftop_overcast_dusk"),
    (6, 104, "07_first_rain_at_the_library"), (7, 132, "08_cab_in_night_rain"), (8, (31, 40), "09_lightning_on_empire_state"),
    (9, (50, 60), "10_lightning_flash_on_42nd"), (10, (25, 34), "11_storm_behind_chrysler"), (11, 40, "12_fog_over_midtown"),
    (12, 118, "13_snow_at_bryant_park"), (13, 88, "14_library_lion_in_snow"), (14, 52, "15_sunrise_down_42nd"),
    (15, 110, "16_clear_snowy_morning"),
]


def frame(root, shot, i):
    return os.path.join(root, "S%02d" % shot, "S%02d.%04d.png" % (shot, i))


def main():
    root, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for shot, pick, name in PICKS:
        if isinstance(pick, tuple):
            scores = []
            for i in range(pick[0], pick[1] + 1):
                a = np.asarray(Image.open(frame(root, shot, i)).convert("L").resize((480, 270)), np.float32)
                scores.append((float(np.mean(a[:160])), i))
            pick = max(scores)[1]
        shutil.copyfile(frame(root, shot, pick), os.path.join(out, name + ".png"))
        print(name, "<- shot", shot, "frame", pick)


if __name__ == "__main__":
    main()
