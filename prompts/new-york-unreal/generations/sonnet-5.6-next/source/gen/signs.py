"""Sign artwork.  Every business, paper, show and advertiser here is invented."""
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "tex")
FONTS = r"C:\Windows\Fonts"

SHOPS = [
    "MARLOWE DELI", "PICKET & HAYE", "SUNRISE PHARMACY", "GOLDEN LANTERN NOODLE", "KEENWOOD OPTICAL", "BELLAMY BOOKS",
    "SAL'S SLICE HOUSE", "EMBER & OAK COFFEE", "LUMA ELECTRONICS", "ORCHID NAILS & SPA", "BORO HARDWARE", "NIGHT OWL MARKET",
    "COPPER KETTLE CAFE", "STELLAR FRAMING", "CALDER LUGGAGE", "PAPER LANTERN GIFTS", "VELA SHOES", "ATLAS WATCH REPAIR",
    "KOVAC TAILORS", "GREEN FORK SALADS", "LA ESTRELLA GROCERY", "JUNO WIRELESS", "HALDEN & CO", "ROSEWOOD FLORIST",
    "SPARROW BAKERY", "ZENITH PRINT & COPY", "OLIVE BRANCH DINER", "KITE TOY SHOP", "NORTHBANK TRUST", "LARK EYEWEAR",
    "THE AMBER ROOM", "QUILL STATIONERY", "PINEWOOD WINES", "CASCADE JUICE BAR", "IRONSIDE FITNESS", "MAISON PERRIN",
    "KOBALT CAMERA", "WILLOW & VINE", "BLUE HERON SUSHI", "TALLOW CANDLE CO", "DUNMORE JEWELERS", "FERRIS SANDWICH",
    "ASTER CLEANERS", "VANTAGE TRAVEL", "OKAPI ART SUPPLY", "REDWING SPORTS", "CORVID RECORDS", "HONEYCOMB BAGELS",
]
SIGN_STYLES = [
    ((16, 54, 40), (222, 190, 120), "georgiab.ttf"), ((236, 232, 222), (176, 28, 24), "ariblk.ttf"),
    ((14, 14, 16), (238, 236, 230), "bahnschrift.ttf"), ((166, 26, 22), (250, 214, 80), "impact.ttf"),
    ((20, 34, 74), (240, 238, 232), "trebucbd.ttf"), ((242, 190, 20), (24, 20, 16), "ariblk.ttf"),
    ((58, 20, 24), (234, 216, 180), "timesbd.ttf"), ((226, 224, 218), (22, 22, 24), "georgiab.ttf"),
    ((8, 8, 10), (255, 86, 60), "bahnschrift.ttf"), ((10, 10, 14), (90, 220, 255), "trebucbd.ttf"),
    ((30, 90, 56), (246, 244, 236), "arialbd.ttf"), ((196, 150, 96), (40, 22, 10), "georgiab.ttf"),
]
NEWS = ["THE DAILY LEDGER", "METRO BUGLE", "UPTOWN COURIER", "THE GOTHIC POST", "EVENING SIGNAL", "BOROUGH WEEKLY", "CITY SCROLL", "AM DISPATCH"]
GHOSTS = ["WHITLOCK'S\nFINE HATS", "J. ORMSBY & SONS\nFURRIERS", "ACME STEAM\nLAUNDRY CO.", "PEERLESS\nSEWING MACHINES",
          "KRAMER'S\nSTORAGE WAREHOUSE", "BELVOIR\nPIANOS · ORGANS", "THE HARTLEY\nBUTTON WORKS", "ROSNER\nWOOLENS"]

AVE_NAMES = {"5th": "5 AV", "6th": "6 AV", "7th": "7 AV", "8th": "8 AV", "Madison": "MADISON AV", "Park": "PARK AV",
             "Lexington": "LEXINGTON AV", "3rd": "3 AV", "2nd": "2 AV", "1st": "1 AV", "Vanderbilt": "VANDERBILT AV",
             "9th": "9 AV", "10th": "10 AV", "11th": "11 AV"}
_names = list(AVE_NAMES.keys()) + ["st%d" % n for n in range(28, 56)]
STREET_CELLS = {k: i for i, k in enumerate(_names)}
ONEWAY_CELL = {False: 48, True: 49}
NOSTAND_CELL = 50
SUBWAY_CELL = 0


def font(name, size):
    p = os.path.join(FONTS, name)
    if not os.path.exists(p):
        p = os.path.join(FONTS, "arialbd.ttf")
    return ImageFont.truetype(p, size)


def fit_text(d, box, text, fname, fill, max_size=200, spacing=4, stroke=0, stroke_fill=None):
    x0, y0, x1, y1 = box
    lo, hi = 6, max_size
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = font(fname, mid)
        bb = d.multiline_textbbox((0, 0), text, font=f, spacing=spacing, align="center", stroke_width=stroke)
        if bb[2] - bb[0] <= x1 - x0 and bb[3] - bb[1] <= y1 - y0:
            lo = mid
        else:
            hi = mid - 1
    f = font(fname, lo)
    bb = d.multiline_textbbox((0, 0), text, font=f, spacing=spacing, align="center", stroke_width=stroke)
    x = x0 + ((x1 - x0) - (bb[2] - bb[0])) / 2 - bb[0]
    y = y0 + ((y1 - y0) - (bb[3] - bb[1])) / 2 - bb[1]
    d.multiline_text((x, y), text, font=f, fill=fill, spacing=spacing, align="center", stroke_width=stroke, stroke_fill=stroke_fill)


def weather(img, amount=0.12, seed=0):
    a = np.asarray(img).astype(np.float32)
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (a.shape[0] // 16 + 1, a.shape[1] // 16 + 1)).astype(np.float32)
    n = np.asarray(Image.fromarray(n, mode="F").resize((a.shape[1], a.shape[0]), Image.BICUBIC))
    a[..., :3] *= (1 + n[..., None] * amount * 0.5)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), img.mode)


def shop_atlas():
    W, H, cols, rows = 2048, 2048, 4, 16
    img = Image.new("RGB", (W, H), (30, 30, 30))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(5)
    for i in range(cols * rows):
        name = SHOPS[i % len(SHOPS)]
        bg, fg, fn = SIGN_STYLES[int(rng.integers(len(SIGN_STYLES)))]
        cx, cy = (i % cols) * 512, (i // cols) * 128
        d.rectangle([cx, cy, cx + 511, cy + 127], fill=bg)
        if rng.random() < 0.6:
            d.rectangle([cx + 7, cy + 7, cx + 504, cy + 120], outline=fg, width=3)
        sub = ["EST. 1962", "OPEN 24 HOURS", "SINCE 1987", "NEW YORK", "FINE QUALITY", "WE DELIVER", "", ""][int(rng.integers(8))]
        if sub:
            fit_text(d, (cx + 22, cy + 12, cx + 490, cy + 86), name, fn, fg)
            fit_text(d, (cx + 60, cy + 90, cx + 452, cy + 113), sub, "arialbd.ttf", fg, max_size=24)
        else:
            fit_text(d, (cx + 22, cy + 22, cx + 490, cy + 106), name, fn, fg)
    return weather(img, 0.07, 1)


def street_atlas():
    img = Image.new("RGB", (2048, 2048), (0, 92, 56))
    d = ImageDraw.Draw(img)

    def cell(i):
        return (i % 4) * 512, (i // 4) * 128

    for key, i in STREET_CELLS.items():
        cx, cy = cell(i)
        label = AVE_NAMES.get(key) or ("W %s ST" % key[2:])
        d.rectangle([cx + 5, cy + 5, cx + 506, cy + 122], outline=(240, 240, 236), width=4)
        fit_text(d, (cx + 26, cy + 24, cx + 486, cy + 104), label, "arialbd.ttf", (244, 244, 240), max_size=88)
    for flag, i in ONEWAY_CELL.items():
        cx, cy = cell(i)
        d.rectangle([cx, cy, cx + 511, cy + 127], fill=(12, 12, 12))
        d.rectangle([cx + 6, cy + 6, cx + 505, cy + 121], outline=(240, 240, 240), width=4)
        if flag:
            poly = [(60, 46), (380, 46), (380, 22), (468, 64), (380, 106), (380, 82), (60, 82)]
        else:
            poly = [(452, 46), (132, 46), (132, 22), (44, 64), (132, 106), (132, 82), (452, 82)]
        d.polygon([(cx + x, cy + y) for x, y in poly], fill=(244, 244, 244))
        fit_text(d, (cx + 150, cy + 48, cx + 362, cy + 80), "ONE WAY", "arialbd.ttf", (12, 12, 12), max_size=40)
    cx, cy = cell(NOSTAND_CELL)
    d.rectangle([cx, cy, cx + 511, cy + 127], fill=(238, 236, 230))
    # drawn wide, then squeezed by the portrait quad
    fit_text(d, (cx + 20, cy + 6, cx + 492, cy + 122), "NO STANDING\nANYTIME", "arialbd.ttf", (178, 24, 20), max_size=64)
    return weather(img, 0.05, 2)


def news_atlas():
    img = Image.new("RGB", (1024, 512), (20, 20, 20))
    d = ImageDraw.Draw(img)
    bgs = [(235, 232, 224), (20, 30, 70), (236, 180, 20), (170, 24, 20), (240, 238, 232), (18, 70, 44), (22, 22, 22), (225, 100, 20)]
    for i, name in enumerate(NEWS):
        cx, cy = (i % 4) * 256, (i // 4) * 256
        bg = bgs[i]
        fg = (20, 20, 20) if sum(bg) > 400 else (240, 238, 232)
        d.rectangle([cx, cy, cx + 255, cy + 255], fill=bg)
        fit_text(d, (cx + 10, cy + 50, cx + 246, cy + 160), name.replace(" ", "\n", 1), "timesbd.ttf", fg, max_size=60)
        fit_text(d, (cx + 40, cy + 180, cx + 216, cy + 215), "FREE · TAKE ONE", "arialbd.ttf", fg, max_size=26)
    return weather(img, 0.1, 3)


def subway_sign():
    img = Image.new("RGB", (1024, 256), (12, 12, 14))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 18, 1023, 24], fill=(240, 240, 240))
    fit_text(d, (30, 40, 760, 140), "42 St – Bryant Park", "arialbd.ttf", (244, 244, 244), max_size=92)
    fit_text(d, (30, 160, 560, 220), "Downtown & Uptown Trains", "arialbd.ttf", (220, 220, 220), max_size=48)
    for i, col in enumerate([(235, 100, 30), (235, 100, 30), (235, 100, 30), (140, 60, 150)]):
        x = 640 + i * 90
        d.rectangle([x, 156, x + 66, 222], fill=col)
    return img


def cart_sign():
    img = Image.new("RGB", (1024, 170), (24, 20, 14))
    d = ImageDraw.Draw(img)
    fit_text(d, (14, 6, 1010, 100), "KING'S CART  ·  HALAL PLATTERS", "impact.ttf", (255, 214, 60), max_size=100)
    fit_text(d, (14, 106, 1010, 162), "GYRO · CHICKEN OVER RICE · HOT COFFEE · PRETZELS", "arialbd.ttf", (255, 120, 80), max_size=48)
    return img


def _gradient(w, h, c0, c1, angle=90):
    t = np.linspace(0, 1, h if angle == 90 else w)
    a = np.array(c0, float)[None, :] + (np.array(c1, float) - np.array(c0, float))[None, :] * t[:, None]
    if angle == 90:
        a = np.repeat(a[:, None, :], w, axis=1)
    else:
        a = np.repeat(a[None, :, :], h, axis=0)
    return Image.fromarray(a.astype(np.uint8))


def billboard_atlas():
    out = Image.new("RGB", (2048, 1024))
    ads = []
    # 1: sparkling drink
    im = _gradient(1024, 512, (250, 150, 20), (230, 40, 90), 0)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(7)
    for _ in range(130):
        x, y, r = rng.uniform(560, 1000), rng.uniform(20, 490), rng.uniform(3, 22)
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 236, 200), width=3)
    d.rounded_rectangle([700, 60, 860, 470], 40, fill=(255, 236, 120))
    d.rectangle([700, 190, 860, 340], fill=(250, 250, 244))
    fit_text(d, (710, 200, 850, 330), "SOLA\nRAY", "ariblk.ttf", (230, 40, 90), max_size=64)
    fit_text(d, (40, 90, 640, 300), "SOLARAY", "ariblk.ttf", (255, 255, 250), max_size=180)
    fit_text(d, (50, 320, 620, 390), "sparkling blood orange", "georgiab.ttf", (255, 244, 220), max_size=64)
    ads.append(im)
    # 2: a musical that does not exist
    im = _gradient(1024, 512, (8, 10, 40), (60, 12, 70))
    d = ImageDraw.Draw(im)
    for _ in range(260):
        x, y = rng.uniform(0, 1023), rng.uniform(0, 260)
        d.point((x, y), fill=(255, 250, 220))
    d.ellipse([760, 60, 900, 200], fill=(255, 228, 140))
    d.ellipse([725, 40, 865, 180], fill=(14, 10, 46))
    fit_text(d, (60, 130, 960, 330), "THE LAST\nLAMPLIGHTER", "georgiab.ttf", (255, 206, 96), max_size=120)
    fit_text(d, (200, 360, 830, 420), "A NEW MUSICAL  ·  NOW PLAYING", "arialbd.ttf", (240, 240, 250), max_size=42)
    ads.append(im)
    # 3: winter fashion
    im = _gradient(1024, 512, (214, 220, 226), (150, 162, 176))
    d = ImageDraw.Draw(im)
    d.polygon([(690, 512), (730, 200), (800, 150), (870, 200), (920, 512)], fill=(122, 26, 30))
    d.ellipse([765, 70, 835, 160], fill=(46, 36, 34))
    fit_text(d, (50, 120, 620, 250), "HOLLOWAY & FINCH", "timesbd.ttf", (24, 26, 30), max_size=90)
    fit_text(d, (100, 290, 560, 350), "THE WINTER COAT", "bahnschrift.ttf", (60, 62, 70), max_size=56)
    ads.append(im)
    # 4: phone network
    im = _gradient(1024, 512, (4, 40, 60), (2, 150, 140), 0)
    d = ImageDraw.Draw(im)
    for k in range(7):
        r = 60 + k * 62
        d.arc([830 - r, 400 - r, 830 + r, 400 + r], 180, 330, fill=(120, 255, 220), width=14 - k)
    fit_text(d, (50, 110, 700, 280), "veyra mobile", "trebucbd.ttf", (244, 255, 252), max_size=120)
    fit_text(d, (60, 300, 640, 370), "coverage under every street", "arialbd.ttf", (180, 255, 230), max_size=44)
    ads.append(im)
    for i, a in enumerate(ads):
        out.paste(a, ((i % 2) * 1024, (i // 2) * 512))
    return out


def poster_atlas():
    """Portrait ads for the bus shelters."""
    bill = billboard_atlas()
    out = Image.new("RGB", (1280, 512), (240, 238, 230))
    for i in range(4):
        src = bill.crop(((i % 2) * 1024 + 620, (i // 2) * 512, (i % 2) * 1024 + 940, (i // 2) * 512 + 512))
        out.paste(src, (i * 320, 0))
        d = ImageDraw.Draw(out)
        names = ["SOLARAY", "THE LAST\nLAMPLIGHTER", "HOLLOWAY\n& FINCH", "veyra\nmobile"]
        fit_text(d, (i * 320 + 20, 380, i * 320 + 300, 490), names[i], "ariblk.ttf", (250, 250, 246), max_size=56, stroke=2, stroke_fill=(20, 20, 20))
    return out


def ghost_atlas():
    """RGBA: faded painted wall advertisements; alpha is paint coverage."""
    out = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    rng = np.random.default_rng(11)
    cols = [(224, 214, 186), (200, 180, 140), (225, 222, 205), (180, 190, 170)]
    for i, text in enumerate(GHOSTS):
        im = Image.new("RGBA", (1024, 512), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c = cols[int(rng.integers(len(cols)))]
        bg = (34, 40, 52, 190) if i % 2 == 0 else (92, 30, 24, 170)
        d.rectangle([20, 20, 1003, 491], fill=bg)
        d.rectangle([40, 40, 983, 471], outline=c + (230,), width=10)
        fit_text(d, (80, 80, 944, 430), text, "georgiab.ttf" if i % 3 else "impact.ttf", c + (235,), max_size=190, spacing=26)
        a = np.asarray(im).astype(np.float32)
        small = rng.random((20, 40)).astype(np.float32)
        big = np.asarray(Image.fromarray(small, mode="F").resize((1024, 512), Image.BICUBIC))
        fine = rng.random((512, 1024)).astype(np.float32)
        fade = np.clip(big * 1.5 - 0.18, 0, 1) * (0.7 + 0.5 * fine)
        a[..., 3] = np.clip(a[..., 3] * fade, 0, 255)
        out.paste(Image.fromarray(a.astype(np.uint8), "RGBA"), ((i % 2) * 1024, (i // 2) * 512))
    return out


def ped_atlas():
    """4 x 4: 0 hand, 1 walking figure, 2.. countdown digits drawn small beside a hand."""
    S = 256
    out = Image.new("RGB", (S * 4, S * 4), (0, 0, 0))
    orange, white = (255, 108, 8), (232, 240, 255)

    def hand(d, ox, oy, s=1.0):
        def P(x, y):
            return (ox + x * s, oy + y * s)
        d.rounded_rectangle([P(70, 112), P(176, 222)], int(26 * s), fill=orange)
        for k, (x, top) in enumerate([(72, 62), (99, 40), (126, 48), (153, 70)]):
            d.rounded_rectangle([P(x, top), P(x + 22, 140)], int(10 * s), fill=orange)
        d.polygon([P(76, 168), P(36, 120), P(54, 106), P(98, 136)], fill=orange)

    def walker(d, ox, oy):
        def L(a, b, w=24):
            d.line([(ox + a[0], oy + a[1]), (ox + b[0], oy + b[1])], fill=white, width=w)
            for p in (a, b):
                d.ellipse([ox + p[0] - w / 2, oy + p[1] - w / 2, ox + p[0] + w / 2, oy + p[1] + w / 2], fill=white)
        d.ellipse([ox + 122, oy + 22, ox + 166, oy + 66], fill=white)
        L((130, 86), (112, 146), 34)
        L((112, 146), (150, 186))
        L((150, 186), (152, 232))
        L((108, 146), (92, 192))
        L((92, 192), (58, 228))
        L((132, 92), (172, 128), 17)
        L((172, 128), (198, 132), 17)
        L((122, 94), (86, 118), 17)
        L((86, 118), (78, 150), 17)

    d = ImageDraw.Draw(out)
    hand(d, 0, 0)
    walker(d, S, 0)
    for n in range(14):
        i = n + 2
        ox, oy = (i % 4) * S, (i // 4) * S
        hand(d, ox - 18, oy + 26, 0.68)
        fit_text(d, (ox + 130, oy + 40, ox + 246, oy + 216), str(n), "arialbd.ttf", orange, max_size=150)
    return out


def vehicle_atlas():
    """4 x 8 of 512 x 128: taxi roof ads, door lettering, fleet liveries, bus destination and plates."""
    out = Image.new("RGB", (2048, 1024), (0, 0, 0))
    d = ImageDraw.Draw(out)

    def cell(i, bg):
        cx, cy = (i % 4) * 512, (i // 4) * 128
        d.rectangle([cx, cy, cx + 511, cy + 127], fill=bg)
        return cx, cy

    def text(i, s, bg, fg, fn="arialbd.ttf", pad=14):
        cx, cy = cell(i, bg)
        fit_text(d, (cx + pad, cy + pad, cx + 512 - pad, cy + 128 - pad), s, fn, fg, max_size=110)

    yellow = (244, 178, 4)
    for i, num in enumerate(["5K42", "2M18", "7J63", "9D27"]):
        text(i, "TAXI   " + num, yellow, (14, 14, 14), "ariblk.ttf")
    text(4, "SOLARAY SPARKLING", (235, 90, 40), (255, 250, 240), "ariblk.ttf")
    text(5, "THE LAST LAMPLIGHTER", (14, 10, 46), (255, 206, 96), "georgiab.ttf")
    text(6, "veyra mobile", (4, 90, 100), (230, 255, 250), "trebucbd.ttf")
    text(7, "HOLLOWAY & FINCH", (220, 224, 230), (24, 26, 30), "timesbd.ttf")
    text(8, "HUDSON PARCEL CO.", (232, 232, 226), (24, 50, 100), "ariblk.ttf")
    text(9, "BRIGHTWAY LINEN SERVICE", (232, 232, 226), (22, 110, 64), "ariblk.ttf")
    text(10, "ORCHARD FRESH PRODUCE", (232, 232, 226), (150, 60, 20), "impact.ttf")
    text(11, "KESTREL MOVERS", (232, 232, 226), (150, 20, 20), "ariblk.ttf")
    text(12, "M42  42 St Crosstown", (4, 4, 4), (255, 176, 30), "consolab.ttf")
    text(13, "M5  Midtown via 5 Av", (4, 4, 4), (255, 176, 30), "consolab.ttf")
    text(14, "METRO LINE BUS 6204", (222, 226, 232), (18, 44, 96), "ariblk.ttf")
    text(15, "NOT IN SERVICE", (4, 4, 4), (255, 176, 30), "consolab.ttf")
    rng = np.random.default_rng(13)
    letters = "ABCDEFGHJKLMNPRSTUVWXYZ"
    for i in range(16, 32):
        cx, cy = cell(i, (232, 170, 40))
        d.rectangle([cx + 128, cy + 8, cx + 383, cy + 119], outline=(16, 20, 50), width=4)
        plate = "".join(letters[int(rng.integers(len(letters)))] for _ in range(3)) + "-%04d" % int(rng.integers(10000))
        fit_text(d, (cx + 136, cy + 12, cx + 376, cy + 40), "EMPIRE STATE", "arialbd.ttf", (16, 20, 50), max_size=28)
        fit_text(d, (cx + 138, cy + 46, cx + 374, cy + 112), plate, "ariblk.ttf", (16, 20, 50), max_size=62)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    items = [("sg_shop", shop_atlas(), "color_hq"), ("sg_street", street_atlas(), "color_hq"), ("sg_news", news_atlas(), "color"),
             ("sg_subway", subway_sign(), "color_hq"), ("sg_cart", cart_sign(), "color"), ("sg_billboard", billboard_atlas(), "color_hq"),
             ("sg_poster", poster_atlas(), "color"), ("sg_ghost", ghost_atlas(), "color"), ("sg_ped", ped_atlas(), "color"),
             ("sg_vehicle", vehicle_atlas(), "color_hq")]
    files = []
    for name, img, kind in items:
        p = os.path.join(OUT, name + ".png")
        # UE wants power-of-two textures for mips
        w = 2 ** int(round(math.log2(img.width)))
        h = 2 ** int(round(math.log2(img.height)))
        if (w, h) != img.size:
            img = img.resize((w, h), Image.LANCZOS)
        img.save(p)
        files.append([p, name, kind])
    cover = os.path.join(OUT, "cover.png")
    if os.path.exists(cover):
        files.append([cover, "cover", "gray"])
    with open(os.path.join(OUT, "extra.json"), "w") as f:
        json.dump({"files": files}, f, indent=1)
    print("sign textures:", len(items))


if __name__ == "__main__":
    main()
