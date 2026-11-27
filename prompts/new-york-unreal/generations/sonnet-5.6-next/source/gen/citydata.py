"""The Midtown grid: one source of truth for streets, lanes, signals and landmark positions.

Coordinates in metres: +X uptown (grid north), +Y grid east, origin at 5th Avenue x 42nd Street.
"""
import math

ORIGIN_LAT, ORIGIN_LON = 40.75362, -73.98134
GRID_BEARING = 29.0


def geo(lat, lon):
    """Latitude/longitude to grid metres."""
    north = (lat - ORIGIN_LAT) * 111132.0
    east = (lon - ORIGIN_LON) * 111320.0 * math.cos(math.radians(ORIGIN_LAT))
    c, s = math.cos(math.radians(GRID_BEARING)), math.sin(math.radians(GRID_BEARING))
    return (north * c + east * s, east * c - north * s)


# ----------------------------------------------------------------------------- cross streets
WIDE_STREETS = {14, 23, 34, 42, 57, 72}
BLOCK_DEPTH = 60.96          # 200 ft
CURB_H = 0.15


def street_width(n):
    return 30.48 if n in WIDE_STREETS else 18.29     # 100 ft / 60 ft right of way


def street_x(n):
    x = 0.0
    if n >= 42:
        for s in range(43, n + 1):
            x += street_width(s - 1) / 2 + BLOCK_DEPTH + street_width(s) / 2
    else:
        for s in range(41, n - 1, -1):
            x -= street_width(s + 1) / 2 + BLOCK_DEPTH + street_width(s) / 2
    return x


def street_road_width(n):
    return 19.6 if n in WIDE_STREETS else 10.4


def street_dir(n):
    """+1 eastbound, -1 westbound, 0 two-way.  Even streets run east, odd run west."""
    if n in WIDE_STREETS:
        return 0
    return 1 if n % 2 == 0 else -1


# ----------------------------------------------------------------------------- avenues
# name: (centre y, right of way, roadway width, direction)  direction +1 uptown, -1 downtown, 0 two-way
AVENUES = {
    "11th": (-1785.0, 30.5, 19.0, 0),
    "10th": (-1500.0, 30.5, 19.0, 1),
    "9th": (-1215.0, 30.5, 19.0, -1),
    "8th": (-931.0, 30.5, 19.0, 1),
    "7th": (-621.0, 30.5, 19.0, -1),
    "6th": (-311.0, 30.5, 19.2, 1),
    "5th": (0.0, 30.5, 18.0, -1),
    "Madison": (155.0, 24.4, 15.2, 1),
    "Park": (320.0, 42.7, 31.0, 0),
    "Lexington": (470.0, 22.9, 14.4, -1),
    "3rd": (630.0, 30.5, 19.0, 1),
    "2nd": (845.0, 30.5, 19.0, -1),
    "1st": (1075.0, 30.5, 19.0, 1),
}
VANDERBILT_Y = 233.0          # short avenue between Madison and Park, 42nd to 47th

# ----------------------------------------------------------------------------- lanes
# Each lane: (offset from road centre toward +Y or +X, direction, kind, width)
#   kind: drive | bus | park | bike | buffer | median
def avenue_lanes(name):
    y, row, road, d = AVENUES[name]
    if name == "5th":
        # southbound: the driver's right is the west (-Y) side, which carries the bus lane
        return [(-7.2, -1, "bus", 3.6), (-3.6, -1, "drive", 3.6), (0.0, -1, "drive", 3.6),
                (3.6, -1, "drive", 3.6), (7.25, -1, "park", 3.5)]
    if name == "6th":
        # northbound with the protected bike lane on the west kerb
        return [(-8.4, 1, "bike", 2.4), (-6.7, 0, "buffer", 1.0), (-5.0, 1, "park", 2.4),
                (-2.2, 1, "drive", 3.2), (1.0, 1, "drive", 3.2), (4.2, 1, "drive", 3.2), (7.7, 1, "bus", 3.8)]
    if name == "Madison":
        return [(-6.2, 1, "park", 2.8), (-3.1, 1, "drive", 3.3), (0.2, 1, "drive", 3.3),
                (3.5, 1, "bus", 3.3), (6.4, 1, "bus", 2.4)]
    if name == "Park":
        return [(-13.9, -1, "park", 3.0), (-10.6, -1, "drive", 3.4), (-7.2, -1, "drive", 3.4),
                (0.0, 0, "median", 10.6),
                (7.2, 1, "drive", 3.4), (10.6, 1, "drive", 3.4), (13.9, 1, "park", 3.0)]
    if d == 0:
        half = road / 2
        return [(-half + 1.4, -1, "park", 2.8), (-half + 4.6, -1, "drive", 3.4), (-half + 8.0, -1, "drive", 3.4),
                (half - 8.0, 1, "drive", 3.4), (half - 4.6, 1, "drive", 3.4), (half - 1.4, 1, "park", 2.8)]
    if road < 16:
        return [(-5.7, d, "park", 2.9), (-2.4, d, "drive", 3.4), (1.1, d, "drive", 3.5), (5.0, d, "park", 4.0)]
    lanes = [(-8.1, d, "park", 2.8), (-4.9, d, "drive", 3.4), (-1.5, d, "drive", 3.4), (1.9, d, "drive", 3.4),
             (5.2, d, "drive", 3.2), (8.2, d, "park", 2.6)]
    return lanes


def street_lanes(n):
    d = street_dir(n)
    if d == 0:
        # two-way wide street: eastbound on the south (-X) half
        return [(-8.1, 1, "bus", 3.4), (-4.7, 1, "drive", 3.3), (-1.5, 1, "drive", 3.0),
                (1.5, -1, "drive", 3.0), (4.7, -1, "drive", 3.3), (8.1, -1, "bus", 3.4)]
    return [(-3.8, d, "park", 2.8), (0.0, d, "drive", 4.6), (3.8, d, "park", 2.8)]


# ----------------------------------------------------------------------------- signals
CYCLE = 90.0
AVE_GREEN = 45.0
YELLOW = 3.5
ALL_RED = 2.0
ST_GREEN = CYCLE - AVE_GREEN - 2 * YELLOW - 2 * ALL_RED
PROGRESSION = 11.5          # m/s green wave along avenues


def signal_offset(ave_name, x):
    d = AVENUES[ave_name][3] if ave_name in AVENUES else -1
    d = d if d != 0 else 1
    return (d * x / PROGRESSION) % CYCLE


# ----------------------------------------------------------------------------- regions
SIM_X = (-780.0, 520.0)       # streets with signals and moving traffic
SIM_Y = (-640.0, 880.0)
DETAIL_X = (-1300.0, 900.0)   # roads built as real geometry
DETAIL_Y = (-1000.0, 1130.0)

# ----------------------------------------------------------------------------- landmark lots (x0, x1, y0, y1)
LOTS = {
    "library": (-155.2, -15.25, -112.0, -15.25),
    "bryant": (-155.2, -15.25, -295.75, -112.0),
    "esb": (-722.0, -661.0, -145.0, -15.25),
    "five_hundred": (15.25, 52.0, -49.0, -15.25),
    "salmon": (15.25, 76.2, -108.0, -50.0),
    "grace": (15.25, 76.2, -262.0, -172.0),
    "bofa": (15.25, 76.2, -405.0, -326.25),
    "radiator": (-204.0, -173.7, -214.0, -184.0),
    "onev": (15.25, 76.2, 167.4, 224.0),
    "gct": (15.25, 94.0, 242.0, 398.0),
    "hyatt": (15.25, 76.2, 400.0, 458.5),
    "chrysler": (15.25, 76.2, 481.4, 544.0),
    "metlife": (118.0, 190.0, 262.0, 382.0),
    "lincoln": (-76.2, -15.25, 170.0, 226.0),
    "bowery": (-76.2, -15.25, 345.0, 398.0),
    "chanin": (-76.2, -15.25, 402.0, 458.5),
    "dailynews": (-76.2, -15.25, 705.0, 775.0),
    "hsbc": (-243.0, -184.0, -58.0, -15.25),
}

LANDMARKS_FAR = {
    "wtc": geo(40.71274, -74.01338),
    "woolworth": geo(40.71245, -74.00840),
    "flatiron": geo(40.74106, -73.98970),
    "mettower": geo(40.74110, -73.98750),
    "nylife": geo(40.74270, -73.98600),
    "rock": geo(40.75874, -73.97868),
    "p432": geo(40.76158, -73.97188),
    "cpt": geo(40.76630, -73.98100),
    "steinway": geo(40.76480, -73.97760),
    "citi": geo(40.75840, -73.97028),
    "hy30": geo(40.75380, -74.00070),
    "hy10": geo(40.75280, -74.00130),
    "un": (90.0, 1190.0),
    "conde": (46.0, -470.0),
    "times": (-118.0, -962.0),
}

# ----------------------------------------------------------------------------- geography (lat, lon)
MANHATTAN = [
    (40.7003, -74.0170), (40.7080, -74.0180), (40.7180, -74.0135), (40.7270, -74.0115), (40.7370, -74.0105),
    (40.7440, -74.0090), (40.7520, -74.0075), (40.7620, -74.0020), (40.7720, -73.9945), (40.7830, -73.9870),
    (40.8000, -73.9720), (40.8180, -73.9610), (40.8340, -73.9500), (40.8520, -73.9440), (40.8750, -73.9330),
    (40.8720, -73.9110), (40.8350, -73.9350), (40.8100, -73.9340), (40.8000, -73.9290), (40.7880, -73.9380),
    (40.7760, -73.9430), (40.7660, -73.9530), (40.7580, -73.9600), (40.7500, -73.9665), (40.7430, -73.9710),
    (40.7330, -73.9735), (40.7220, -73.9735), (40.7110, -73.9775), (40.7090, -73.9990), (40.7030, -74.0080),
]
QUEENS_BROOKLYN = [
    (40.7950, -73.9270), (40.7760, -73.9355), (40.7640, -73.9460), (40.7540, -73.9530), (40.7440, -73.9590),
    (40.7370, -73.9620), (40.7290, -73.9610), (40.7180, -73.9645), (40.7100, -73.9700), (40.7050, -73.9800),
    (40.7040, -73.9930), (40.6950, -74.0020), (40.6760, -74.0200), (40.6400, -74.0300), (40.5900, -73.9500),
    (40.6000, -73.7000), (40.8000, -73.7000), (40.8100, -73.8800),
]
NEW_JERSEY = [
    (40.6500, -74.0900), (40.6900, -74.0560), (40.7080, -74.0340), (40.7170, -74.0320), (40.7270, -74.0300),
    (40.7380, -74.0280), (40.7500, -74.0235), (40.7640, -74.0140), (40.7780, -74.0030), (40.8000, -73.9880),
    (40.8250, -73.9720), (40.8500, -73.9620), (40.8900, -73.9450), (40.9100, -74.2000), (40.6500, -74.2400),
]
ROOSEVELT = [(40.7500, -73.9625), (40.7600, -73.9545), (40.7700, -73.9455), (40.7712, -73.9448),
             (40.7690, -73.9435), (40.7590, -73.9528), (40.7495, -73.9610)]
BRONX = [(40.8000, -73.9250), (40.8050, -73.9300), (40.8350, -73.9320), (40.8730, -73.9080),
         (40.9100, -73.9150), (40.9100, -73.7900), (40.8050, -73.8000)]
CENTRAL_PARK = [(40.7644, -73.9732), (40.7681, -73.9819), (40.8004, -73.9582), (40.7969, -73.9495)]


def poly_xy(poly):
    return [geo(a, b) for a, b in poly]


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                inside = not inside
    return inside


def rects_overlap(a, b, pad=0.0):
    return not (a[1] <= b[0] + pad or a[0] >= b[1] - pad or a[3] <= b[2] + pad or a[2] >= b[3] - pad)
