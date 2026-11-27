"""Joins the rendered destruction shots (with their head trims) into one frame folder list, a rough cut and a
one-frame-per-second sheet:  python animatic.py <render_dir> <out.mp4> <sheet.png> [wav]"""
import glob, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "film"))
import destruction_data
from PIL import Image, ImageDraw
root, out, sheet = sys.argv[1:4]
wav = sys.argv[4] if len(sys.argv) > 4 else None
frames = []
for i, s in enumerate(destruction_data.SHOTS):
    got = sorted(glob.glob(os.path.join(root, "D%02d" % (i + 1), "*.png")))
    frames += got[s.head:s.frames]
lst = os.path.join(os.path.dirname(os.path.abspath(out)), "animatic.txt")
with open(lst, "w") as f:
    for p in frames:
        f.write("file '%s'\nduration %.6f\n" % (os.path.abspath(p).replace("\\", "/"), 1 / 24))
cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst]
if wav:
    cmd += ["-i", wav]
cmd += ["-vf", "scale=960:540,fps=24", "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p"] + (["-c:a", "aac", "-b:a", "192k", "-shortest"] if wav else []) + [out]
subprocess.run(cmd, check=True)
picks = frames[::24]
cols, tw, th = 6, 400, 225
img = Image.new("RGB", (cols * tw, ((len(picks) + cols - 1) // cols) * th))
d = ImageDraw.Draw(img)
for k, p in enumerate(picks):
    x, y = (k % cols) * tw, (k // cols) * th
    img.paste(Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS), (x, y))
    d.text((x + 4, y + 3), "%ds" % k, fill=(255, 220, 60))
img.save(sheet)
print(len(frames), "frames,", round(len(frames) / 24, 2), "s ->", out, sheet)
