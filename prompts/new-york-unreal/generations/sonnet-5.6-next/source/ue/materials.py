"""Builds textures, master materials and instances for architecture and ground.  Run in the editor."""
import json
import os
import sys

import unreal

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else None
ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import importlib
import matlib
importlib.reload(matlib)
from matlib import *  # noqa

TEXDIR = os.path.join(ROOT, "build", "tex")


def import_all(force=False):
    with open(os.path.join(TEXDIR, "textures.json")) as f:
        data = json.load(f)
    files = [tuple(x) for x in data["files"]]
    extra = os.path.join(TEXDIR, "extra.json")
    if os.path.exists(extra):
        with open(extra) as f:
            files += [tuple(x) for x in json.load(f)["files"]]
    # the shelter and ground-height maps change whenever the city is regenerated
    todo = [x for x in files if force or x[1] in ("cover", "groundz") or not EAL.does_asset_exist(TEX_DIR + "/" + x[1])]
    if todo:
        import_textures(todo)
    return data["meta"]


META = {}

WEATHER_SURF = [("Wetness", C("Wetness")), ("Snow", C("Snow")), ("SimTime", C("SimTime")), ("Night", C("Night"))]
SHARED_MASKS = [("GrimeTex", T("GrimeMask", "grime")), ("NoiseTex", T("NoiseMask", "noise")),
                ("SnowNTex", T("SnowNormal", "snow_n", normal=True)), ("CoverTex", T("CoverMap", "cover"))]


def make_surface_master(name="M_Surface", two_sided=False, wpo=None, debris=False):
    code = """
return NycSurfaceMain(WP, VN, CamPos, VCol, float3(IR, IG, IB), Tag,
    AlbedoTex, AlbedoTexSampler, NormalTex, NormalTexSampler, RhaTex, RhaTexSampler, GrimeTex, GrimeTexSampler,
    NoiseTex, NoiseTexSampler, SnowNTex, SnowNTexSampler, CoverTex, CoverTexSampler,
    TileSize.xy, Tint.rgb, AlbedoMix, RoughMul, RoughAdd, MetalIn, NormalStrength, GrimeAmt, Porosity, SpecIn,
    EmissiveNits, EmissiveColor.rgb, NightOnly, SnowScale, Core, Wetness, Snow, SimTime, Night,
    Roughness, Normal, Metallic, Specular, Emissive, OutAO);
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("VCol", VCOLOR), ("Tag", UV1),
              ("IR", PIC(0, 1.0)), ("IG", PIC(1, 1.0)), ("IB", PIC(2, 1.0)),
              ("AlbedoTex", T("Albedo", "limestone_a")), ("NormalTex", T("NormalMap", "limestone_n", normal=True)),
              ("RhaTex", T("RoughAoH", "limestone_r"))] + SHARED_MASKS + [
        ("TileSize", V("TileSize", (3.6, 3.6, 0, 0))), ("Tint", V("Tint", (1, 1, 1))),
        ("AlbedoMix", S("AlbedoMix", 1.0)), ("RoughMul", S("RoughMul", 1.0)), ("RoughAdd", S("RoughAdd", 0.0)),
        ("MetalIn", S("Metallic", 0.0)), ("NormalStrength", S("NormalStrength", 1.0)), ("GrimeAmt", S("Grime", 0.55)),
        ("Porosity", S("Porosity", 0.7)), ("SpecIn", S("Specular", 0.45)), ("EmissiveNits", S("EmissiveNits", 0.0)),
        ("EmissiveColor", V("EmissiveColor", (1, 1, 1))), ("NightOnly", S("NightOnly", 0.0)), ("SnowScale", S("SnowScale", 1.0)),
        ("Core", S("Core", 0.0))] + WEATHER_SURF
    outs = [("Roughness", 1), ("Normal", 3), ("Metallic", 1), ("Specular", 1), ("Emissive", 3), ("OutAO", 1)]
    mapping = {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Metallic": "Metallic",
               "Specular": "Specular", "Emissive": "Emissive", "AO": "OutAO"}
    usage = ("ism", "nanite")
    if debris:
        # pieces of a geometry collection: textures follow the rest pose, tint comes per component
        swap = {"WP": ("debriswp",), "VN": ("debrisvn",), "IR": CPD("DTintR", 0, 1.0), "IG": CPD("DTintG", 1, 1.0),
                "IB": CPD("DTintB", 2, 1.0)}
        inputs = [(k, swap.get(k, v_)) for k, v_ in inputs]
        del mapping["Normal"]
        usage = ("geomcollection",)
    return build(name, code, inputs, outs, mapping, include=("/NYC/Surface.ush",), two_sided=two_sided, wpo=wpo, usage=usage)


# name: (texture set, dict of overrides)
SURFACES = {
    "brick_red": ("brick_red", {}), "brick_buff": ("brick_buff", {}), "brick_brown": ("brick_brown", {}),
    "brick_white": ("brick_white", {"Porosity": 0.5}), "brick_black": ("brick_black", {"Porosity": 0.35, "Grime": 0.25}),
    "brick_gray": ("brick_gray", {}),
    "limestone": ("limestone", {}), "limestone_dark": ("limestone_dark", {}),
    "limestone_trim": ("limestone", {"Tint": (1.08, 1.06, 1.02), "TileSize": (1.8, 1.8), "NormalStrength": 0.5}),
    "marble": ("marble", {"Grime": 0.42, "Porosity": 0.45}),
    "marble_trim": ("marble", {"TileSize": (2.2, 2.2), "Tint": (1.04, 1.03, 1.01), "Grime": 0.38, "Porosity": 0.4, "NormalStrength": 0.4}),
    "stone_lion": ("concrete", {"SnowScale": 1.7, "Tint": (2.05, 1.72, 1.52), "TileSize": (1.1, 1.1), "Grime": 0.85, "NormalStrength": 2.6, "Porosity": 0.6, "RoughMul": 0.9}),
    "granite": ("granite", {"Porosity": 0.2, "Grime": 0.35}), "granite_pink": ("granite_pink", {"Porosity": 0.25}),
    "granite_black": ("granite", {"Tint": (0.32, 0.31, 0.32), "Porosity": 0.1, "RoughMul": 0.62, "Grime": 0.2}),
    "brownstone": ("brownstone", {}), "brownstone_dark": ("brownstone", {"Tint": (0.72, 0.68, 0.66)}),
    "terracotta": ("terracotta", {"Porosity": 0.35}), "terracotta_white": ("terracotta_white", {"Porosity": 0.35}),
    "concrete": ("concrete", {}), "concrete_light": ("concrete", {"Tint": (1.22, 1.2, 1.16)}),
    "concrete_panel": ("concrete_panel", {}), "stucco": ("stucco", {}),
    "stucco_tint": ("stucco", {"Tint": (0.82, 0.66, 0.5)}),
    "roof": ("roof", {"Porosity": 0.6, "Grime": 0.25}), "wood": ("wood", {"Porosity": 0.9, "Grime": 0.3}),
    "bark": ("bark", {"Grime": 0.15, "Porosity": 0.8}),
    "rust": ("metal_rust", {"Metallic": 0.35, "Porosity": 0.2}),
    "steel": ("steel", {"Metallic": 1.0, "Porosity": 0.0, "Grime": 0.15}),
    "steel_bright": ("steel", {"Metallic": 1.0, "RoughMul": 0.6, "Tint": (1.2, 1.2, 1.22), "Porosity": 0.0, "Grime": 0.08}),
    "chrome": ("steel", {"Metallic": 1.0, "RoughMul": 0.25, "Tint": (1.25, 1.25, 1.27), "Porosity": 0.0, "Grime": 0.05, "NormalStrength": 0.1}),
    "gold": ("steel", {"Metallic": 1.0, "RoughMul": 0.85, "Tint": (1.55, 1.08, 0.42), "Porosity": 0.0, "Grime": 0.12}),
    "copper_green": ("concrete", {"Tint": (0.52, 0.98, 0.8), "Metallic": 0.15, "RoughMul": 0.8, "Porosity": 0.2}),
    "bronze": ("steel", {"Metallic": 0.9, "Tint": (0.42, 0.28, 0.15), "RoughMul": 1.2, "Porosity": 0.0}),
    "aluminium": ("steel", {"Metallic": 0.85, "RoughMul": 1.15, "Porosity": 0.0, "Grime": 0.3}),
    # weathered anodized extrusions for window frames and mullions: satin, not mirror
    "anodized": ("steel", {"Metallic": 0.4, "RoughMul": 0.8, "RoughAdd": 0.3, "Tint": (0.62, 0.63, 0.65), "Porosity": 0.0, "Grime": 0.35, "NormalStrength": 0.25}),
    # what a break exposes (Core picks the pattern in Surface.ush)
    "core_brick": ("brick_brown", {"Core": 1.0, "Grime": 0.14, "Porosity": 0.8, "NormalStrength": 1.0}),
    "core_concrete": ("concrete", {"Core": 2.0, "Grime": 0.14, "Porosity": 0.7, "NormalStrength": 1.0}),
    "core_plaster": ("stucco", {"Core": 3.0, "Grime": 0.22, "Porosity": 0.8, "NormalStrength": 0.7}),
    "anodized_bronze": ("steel", {"Metallic": 0.45, "RoughMul": 0.8, "RoughAdd": 0.3, "Tint": (0.25, 0.18, 0.11), "Porosity": 0.0, "Grime": 0.3, "NormalStrength": 0.25}),
}
# painted / plain finishes: (colour in linear space, roughness, metallic, grime)
PAINTS = {
    "paint_black": ((0.018, 0.018, 0.02), 0.42, 0.0, 0.2), "paint_darkgreen": ((0.018, 0.055, 0.038), 0.45, 0.0, 0.3),
    "paint_white": ((0.62, 0.61, 0.57), 0.48, 0.0, 0.35), "paint_cream": ((0.56, 0.47, 0.30), 0.52, 0.0, 0.35),
    "paint_gray": ((0.19, 0.20, 0.21), 0.48, 0.0, 0.35), "paint_darkgray": ((0.055, 0.058, 0.062), 0.45, 0.0, 0.3),
    "paint_brown": ((0.075, 0.038, 0.02), 0.5, 0.0, 0.3), "paint_red": ((0.31, 0.022, 0.012), 0.38, 0.0, 0.25),
    "paint_blue": ((0.012, 0.07, 0.26), 0.36, 0.0, 0.3), "paint_yellow": ((0.72, 0.40, 0.006), 0.4, 0.0, 0.3),
    "paint_orange": ((0.78, 0.17, 0.008), 0.45, 0.0, 0.35), "paint_navy": ((0.008, 0.016, 0.05), 0.4, 0.0, 0.25),
    "paint_olive": ((0.075, 0.085, 0.04), 0.52, 0.0, 0.3), "paint_burgundy": ((0.12, 0.01, 0.018), 0.45, 0.0, 0.25),
    "plastic_black": ((0.012, 0.012, 0.012), 0.62, 0.0, 0.15), "rubber": ((0.014, 0.014, 0.015), 0.82, 0.0, 0.1),
    "trash_bag": ((0.008, 0.008, 0.009), 0.26, 0.0, 0.1), "cardboard": ((0.24, 0.15, 0.075), 0.9, 0.0, 0.4),
    "fabric_green": ((0.012, 0.09, 0.05), 0.75, 0.0, 0.4), "fabric_red": ((0.30, 0.018, 0.015), 0.72, 0.0, 0.35),
    "fabric_navy": ((0.01, 0.022, 0.075), 0.74, 0.0, 0.35), "fabric_black": ((0.012, 0.012, 0.013), 0.74, 0.0, 0.35),
    "fabric_cream": ((0.52, 0.42, 0.25), 0.76, 0.0, 0.45), "fabric_stripe": ((0.45, 0.30, 0.06), 0.74, 0.0, 0.4),
    "shed_green": ((0.02, 0.085, 0.052), 0.62, 0.0, 0.55), "shed_white": ((0.55, 0.55, 0.52), 0.55, 0.0, 0.55),
    "galvanized": ((0.30, 0.32, 0.33), 0.42, 0.75, 0.45), "iron_black": ((0.014, 0.014, 0.015), 0.38, 0.3, 0.2),
    "soil": ((0.035, 0.022, 0.012), 0.95, 0.0, 0.1), "grass": ((0.045, 0.062, 0.018), 0.93, 0.0, 0.25),
    "grass_dry": ((0.12, 0.10, 0.038), 0.93, 0.0, 0.2), "needle": ((0.012, 0.045, 0.018), 0.82, 0.0, 0.1),
    "skin": ((0.28, 0.16, 0.10), 0.65, 0.0, 0.0),
    "interior_dark": ((0.022, 0.019, 0.017), 0.92, 0.0, 0.6),
}


RELIEF = {"brick": 1.75, "limestone": 1.45, "granite": 1.3, "brownstone": 1.55, "concrete": 1.5, "terracotta": 1.35, "stucco": 1.5, "marble": 0.9}


def make_surface_instances(master, meta, suffix="", path=MAT_DIR):
    for name, (texset, over) in SURFACES.items():
        tile = meta[texset]["tile"]
        for key, strength in RELIEF.items():
            if name.startswith(key) and "NormalStrength" not in over:
                over = dict(over, NormalStrength=strength)
        sc = {k: v_ for k, v_ in over.items() if k not in ("Tint", "TileSize")}
        vec = {"TileSize": over.get("TileSize", tile), "Tint": over.get("Tint", (1, 1, 1))}
        instance("MI_" + name + suffix, master, scalars=sc, vectors=vec,
                 textures={"Albedo": texset + "_a", "NormalMap": texset + "_n", "RoughAoH": texset + "_r"}, path=path)
    for name, (col, rough, metallic, grime_amt) in PAINTS.items():
        # AlbedoMix 0 turns the texture into pure tint (see Surface.ush)
        sc = {"AlbedoMix": 0.04, "RoughMul": 0.0, "RoughAdd": rough, "Metallic": metallic, "Grime": grime_amt,
              "Porosity": 0.75 if name.startswith(("fabric", "cardboard", "soil", "grass")) else 0.12,
              "NormalStrength": 0.35}
        instance("MI_" + name + suffix, master, scalars=sc, vectors={"TileSize": (2.0, 2.0), "Tint": col},
                 textures={"Albedo": "metal_paint_a", "NormalMap": "metal_paint_n", "RoughAoH": "metal_paint_r"}, path=path)


def make_glass(meta):
    code = """
return NycGlassMain(WP, VN, CamPos, UV, Size, RoomSeed, VCol, float3(1, 1, 1),
    NoiseTex, NoiseTexSampler, DropsTex, DropsTexSampler, SnowNTex, SnowNTexSampler,
    RoomKind, DepthScale, GlassTint.rgb, Reflect, Transmit, InteriorOn, PaneW, Warp, BlindChance, CurtainChance, LitBias, LampScale,
    Wetness, Snow, Rain, SimTime, LitHome, LitOffice, LitShop, InteriorDay, Flash,
    Roughness, Normal, Metallic, Specular, Emissive);
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("UV", UV0), ("Size", UV1), ("RoomSeed", PIC(3, 0.37)),
              ("VCol", VCOLOR), ("NoiseTex", T("NoiseMask", "noise")), ("DropsTex", T("Drops", "drops")),
              ("SnowNTex", T("SnowNormal", "snow_n", normal=True)),
              ("RoomKind", S("RoomKind", 0)), ("DepthScale", S("DepthScale", 1.0)),
              ("GlassTint", V("GlassTint", (0.75, 0.82, 0.80))), ("Reflect", S("Reflect", 0.06)),
              ("Transmit", S("Transmit", 0.82)), ("InteriorOn", S("InteriorOn", 1)), ("PaneW", S("PaneW", 1.4)),
              ("Warp", S("Warp", 1.0)), ("BlindChance", S("BlindChance", 0.55)), ("CurtainChance", S("CurtainChance", 0.4)),
              ("LitBias", S("LitBias", 1.0)), ("LampScale", S("LampScale", 1.0)),
              ("Wetness", C("Wetness")), ("Snow", C("Snow")), ("Rain", C("Rain")), ("SimTime", C("SimTime")),
              ("LitHome", C("LitHome")), ("LitOffice", C("LitOffice")), ("LitShop", C("LitShop")),
              ("InteriorDay", C("InteriorDay")), ("Flash", C("Flash"))]
    outs = [("Roughness", 1), ("Normal", 3), ("Metallic", 1), ("Specular", 1), ("Emissive", 3)]
    m = build("M_Glass", code, inputs, outs,
              {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Metallic": "Metallic",
               "Specular": "Specular", "Emissive": "Emissive"}, include=("/NYC/Glass.ush",))
    G = {
        "glass_home": {"s": {"RoomKind": 0, "LampScale": 0.52, "Reflect": 0.05, "BlindChance": 0.6, "CurtainChance": 0.42}},
        "glass_office": {"s": {"RoomKind": 1, "LampScale": 0.36, "Reflect": 0.12, "BlindChance": 0.45, "CurtainChance": 0.0, "DepthScale": 1.2}},
        "glass_shop": {"s": {"RoomKind": 2, "LampScale": 0.17, "Reflect": 0.04, "BlindChance": 0.04, "CurtainChance": 0.0, "Warp": 0.45, "PaneW": 2.2, "Transmit": 0.9}},
        "glass_kiosk": {"s": {"RoomKind": 2, "Reflect": 0.03, "BlindChance": 0.0, "CurtainChance": 0.0, "Warp": 0.3, "PaneW": 1.0, "Transmit": 0.9, "LampScale": 0.12, "DepthScale": 0.4, "LitBias": 1.4}},
        "glass_lobby": {"s": {"RoomKind": 2, "LampScale": 0.2, "Reflect": 0.08, "BlindChance": 0.0, "CurtainChance": 0.0, "Warp": 0.4, "DepthScale": 1.6, "LitBias": 1.1}},
        "glass_dark": {"s": {"InteriorOn": 0, "Reflect": 0.12, "Warp": 0.8}},
        "curtain_blue": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.40, "BlindChance": 0.3, "CurtainChance": 0, "PaneW": 1.5, "Transmit": 0.55, "Warp": 0.62},
                          "v": {"GlassTint": (0.28, 0.45, 0.62)}},
        "curtain_green": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.34, "BlindChance": 0.35, "CurtainChance": 0, "PaneW": 1.5, "Transmit": 0.6, "Warp": 0.6},
                           "v": {"GlassTint": (0.30, 0.54, 0.47)}},
        "curtain_bronze": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.38, "BlindChance": 0.3, "CurtainChance": 0, "PaneW": 1.4, "Transmit": 0.4, "Warp": 0.72},
                            "v": {"GlassTint": (0.42, 0.28, 0.17)}},
        "curtain_dark": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.24, "BlindChance": 0.35, "CurtainChance": 0, "PaneW": 1.5, "Transmit": 0.34, "Warp": 0.6},
                          "v": {"GlassTint": (0.15, 0.18, 0.22)}},
        "curtain_silver": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.66, "BlindChance": 0.2, "CurtainChance": 0, "PaneW": 1.5, "Transmit": 0.28, "Warp": 0.55},
                            "v": {"GlassTint": (0.62, 0.68, 0.74)}},
        "curtain_clear": {"s": {"RoomKind": 1, "LampScale": 0.55, "Reflect": 0.22, "BlindChance": 0.25, "CurtainChance": 0, "PaneW": 1.5, "Transmit": 0.8, "Warp": 0.8},
                           "v": {"GlassTint": (0.62, 0.74, 0.78)}},
        "spandrel_blue": {"s": {"InteriorOn": 0, "Reflect": 0.34, "Warp": 1.0}, "v": {"GlassTint": (0.2, 0.34, 0.46)}},
        "spandrel_dark": {"s": {"InteriorOn": 0, "Reflect": 0.2, "Warp": 1.0}, "v": {"GlassTint": (0.08, 0.1, 0.12)}},
    }
    for name, d in G.items():
        instance("MI_" + name, m, scalars=d.get("s"), vectors=d.get("v"))
    return m


def make_ground(meta):
    weather = [("Wetness", C("Wetness")), ("Puddles", C("Puddles")), ("Rain", C("Rain")), ("Snow", C("Snow")),
               ("SimTime", C("SimTime"))]
    base_in = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("VCol", VCOLOR)]
    outs = [("Roughness", 1), ("Normal", 3), ("Specular", 1), ("Emissive", 3)]
    mapping = {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Specular": "Specular", "Emissive": "Emissive"}

    def texset(n):
        return [("AlbedoTex", T("Albedo", n + "_a")), ("NormalTex", T("NormalMap", n + "_n", normal=True)),
                ("RhaTex", T("RoughAoH", n + "_r"))]

    road_code = """
return NycRoadMain(WP, VN, CamPos, VCol, AlbedoTex, AlbedoTexSampler, NormalTex, NormalTexSampler, RhaTex, RhaTexSampler,
    GrimeTex, GrimeTexSampler, NoiseTex, NoiseTexSampler, SnowNTex, SnowNTexSampler, CoverTex, CoverTexSampler,
    Tint.rgb, PaintMix, PaintColor.rgb, PaintWear, Wetness, Puddles, Rain, Snow, SimTime,
    Roughness, Normal, Specular, Emissive);
"""
    road = build("M_Road", road_code, base_in + texset("asphalt") + SHARED_MASKS + [
        ("Tint", V("Tint", (1, 1, 1))), ("PaintMix", S("PaintMix", 0)), ("PaintColor", V("PaintColor", (0.6, 0.6, 0.56))),
        ("PaintWear", S("PaintWear", 0.38))] + weather, outs, mapping, include=("/NYC/Ground.ush",))
    instance("MI_road", road)
    paints = {"road_white": ((0.55, 0.55, 0.52), 0.40), "road_yellow": ((0.62, 0.38, 0.015), 0.40),
              "road_buslane": ((0.22, 0.035, 0.024), 0.46), "road_bikelane": ((0.028, 0.17, 0.075), 0.40)}
    for n, (col, wear) in paints.items():
        instance("MI_" + n, road, scalars={"PaintMix": 1, "PaintWear": wear}, vectors={"PaintColor": col})
    instance("MI_road_dark", road, vectors={"Tint": (0.78, 0.78, 0.8)})

    walk_code = """
return NycSidewalkMain(WP, VN, CamPos, VCol, AlbedoTex, AlbedoTexSampler, NormalTex, NormalTexSampler, RhaTex, RhaTexSampler,
    GrimeTex, GrimeTexSampler, NoiseTex, NoiseTexSampler, SnowNTex, SnowNTexSampler, CoverTex, CoverTexSampler,
    GumTex, GumTexSampler, Tint.rgb, TileSize.xy, GumAmt, Wetness, Puddles, Rain, Snow, SimTime,
    Roughness, Normal, Specular, Emissive);
"""
    walk = build("M_Sidewalk", walk_code, base_in + texset("sidewalk") + SHARED_MASKS + [
        ("GumTex", T("Gum", "gum")), ("Tint", V("Tint", (1, 1, 1))),
        ("TileSize", V("TileSize", (meta["sidewalk"]["tile"][0], meta["sidewalk"]["tile"][1], 0, 0))),
        ("GumAmt", S("GumAmt", 1.0))] + weather, outs, mapping, include=("/NYC/Ground.ush",))
    instance("MI_sidewalk", walk)
    instance("MI_sidewalk_dark", walk, vectors={"Tint": (0.78, 0.78, 0.77)})
    instance("MI_curb", walk, scalars={"GumAmt": 0.15}, vectors={"Tint": (0.9, 0.88, 0.86)})
    gt = meta["granite"]["tile"]
    instance("MI_plaza", walk, scalars={"GumAmt": 0.5}, vectors={"Tint": (1.25, 1.2, 1.12), "TileSize": (gt[0], gt[1])},
             textures={"Albedo": "granite_a", "NormalMap": "granite_n", "RoughAoH": "granite_r"})
    bt = meta["brick_red"]["tile"]
    instance("MI_paver_brick", walk, scalars={"GumAmt": 0.3}, vectors={"Tint": (0.85, 0.82, 0.8), "TileSize": (bt[0], bt[1])},
             textures={"Albedo": "brick_brown_a", "NormalMap": "brick_brown_n", "RoughAoH": "brick_brown_r"})


def flush_shader_cache():
    """Make the editor re-read edited .ush files."""
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    unreal.SystemLibrary.execute_console_command(world, "recompileshaders changed")


def run(which=("surface", "glass", "ground")):
    meta = import_all()
    ensure_mpc()
    if "surface" in which:
        m = make_surface_master("M_Surface")
        make_surface_instances(m, meta)
    if "glass" in which:
        make_glass(meta)
    if "ground" in which:
        make_ground(meta)
    unreal.NYCBuilderLibrary.finish_all_compilation()
    print("materials done:", which)
