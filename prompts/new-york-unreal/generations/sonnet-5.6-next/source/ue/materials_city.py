"""Signs, small emitters, distant facades, ground and water."""
import os
import sys
import importlib

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import matlib
importlib.reload(matlib)
from matlib import *  # noqa

FAR_INC = ("/NYC/Far.ush",)


def surface_variants():
    """Extra finishes built on M_Surface."""
    def paint(name, col, rough, metal=0.0, grime=0.2, emis=0.0, ecol=(1, 1, 1), night=0.0, porosity=0.15, spec=0.45):
        instance("MI_" + name, "M_Surface",
                 scalars={"AlbedoMix": 0.04, "RoughMul": 0.0, "RoughAdd": rough, "Metallic": metal, "Grime": grime, "Porosity": porosity,
                          "NormalStrength": 0.3, "EmissiveNits": emis, "NightOnly": night, "Specular": spec},
                 vectors={"TileSize": (2.0, 2.0), "Tint": col, "EmissiveColor": ecol},
                 textures={"Albedo": "metal_paint_a", "NormalMap": "metal_paint_n", "RoughAoH": "metal_paint_r"})

    paint("roofing_dark", (0.028, 0.03, 0.034), 0.6, 0.2)
    paint("ac_case", (0.36, 0.34, 0.29), 0.5, 0.3, 0.45)
    paint("shed_wood", (0.17, 0.11, 0.055), 0.8, 0.0, 0.5, porosity=0.8)
    paint("basket_green", (0.015, 0.075, 0.04), 0.4, 0.4)
    paint("tactile_red", (0.19, 0.04, 0.025), 0.6, 0.0, 0.5, porosity=0.4)
    paint("solar_panel", (0.01, 0.014, 0.03), 0.18, 0.3)
    paint("kiosk_roof", (0.02, 0.07, 0.045), 0.45, 0.2)
    paint("carousel_roof", (0.2, 0.02, 0.02), 0.5)
    paint("castiron_road", (0.05, 0.045, 0.042), 0.46, 0.55, 0.65)
    paint("bag_clear", (0.16, 0.19, 0.2), 0.22, 0.0, 0.1, spec=0.6)
    paint("twig", (0.055, 0.04, 0.03), 0.85, 0.0, 0.0, porosity=0.7)
    paint("farbark", (0.075, 0.057, 0.042), 0.92, 0.0, 0.0, porosity=0.5)
    paint("farroof", (0.09, 0.085, 0.078), 0.85, 0.0, 0.4, porosity=0.5)
    paint("farridge", (0.032, 0.036, 0.03), 0.97, 0.0, 0.2, porosity=0.3)
    paint("chrysler_steel", (0.62, 0.64, 0.66), 0.27, 1.0, 0.06)
    paint("gold_roof", (0.9, 0.6, 0.2), 0.34, 1.0, 0.1, emis=14.0, ecol=(1.0, 0.62, 0.2), night=1.0)
    paint("stair_lit", (0.16, 0.15, 0.13), 0.8)
    paint("stair_mid", (0.05, 0.047, 0.042), 0.85)
    paint("stair_dark", (0.008, 0.008, 0.008), 0.9, 0.0, 0.0, emis=0.6, ecol=(1.0, 0.8, 0.5))
    paint("globe_green", (0.05, 0.35, 0.12), 0.2, emis=420.0, ecol=(0.1, 1.0, 0.3))
    paint("globe_white", (0.7, 0.7, 0.66), 0.2, emis=260.0, ecol=(1.0, 0.95, 0.8), night=1.0)
    paint("lamp_globe", (0.75, 0.7, 0.58), 0.2, emis=520.0, ecol=(1.0, 0.72, 0.4), night=1.0)
    paint("street_lens", (0.65, 0.65, 0.6), 0.15, emis=5200.0, ecol=(1.0, 0.8, 0.58), night=1.0)
    paint("tube_light", (0.8, 0.8, 0.76), 0.3, emis=700.0, ecol=(1.0, 0.9, 0.7))
    paint("canopy_light", (0.8, 0.78, 0.7), 0.3, emis=620.0, ecol=(1.0, 0.86, 0.62), night=1.0)
    paint("porch_light", (0.7, 0.65, 0.5), 0.25, emis=800.0, ecol=(1.0, 0.68, 0.34), night=1.0)
    paint("kiosk_light", (0.8, 0.75, 0.6), 0.3, emis=420.0, ecol=(1.0, 0.72, 0.4), night=1.0)
    paint("fairy_light", (0.7, 0.55, 0.3), 0.3, emis=620.0, ecol=(1.0, 0.66, 0.28), night=1.0)
    paint("fairy_blue", (0.2, 0.35, 0.7), 0.3, emis=520.0, ecol=(0.25, 0.5, 1.0), night=1.0)
    paint("fairy_red", (0.7, 0.1, 0.08), 0.3, emis=520.0, ecol=(1.0, 0.12, 0.06), night=1.0)
    paint("clockface", (0.72, 0.66, 0.5), 0.3, emis=130.0, ecol=(1.0, 0.86, 0.56), night=1.0)
    paint("crown_glow", (0.5, 0.5, 0.48), 0.35, 0.5, emis=210.0, ecol=(1.0, 0.94, 0.82), night=1.0)
    paint("mast_glow", (0.2, 0.22, 0.25), 0.3, 0.5, emis=90.0, ecol=(1.0, 0.92, 0.78), night=1.0)
    paint("chrysler_window", (0.03, 0.035, 0.04), 0.12, 0.4, emis=330.0, ecol=(0.94, 0.97, 1.0), night=1.0)
    instance("MI_ice", "M_Surface",
             scalars={"AlbedoMix": 0.3, "RoughMul": 0.0, "RoughAdd": 0.085, "Metallic": 0.0, "Grime": 0.08, "Porosity": 0.0, "NormalStrength": 0.12, "Specular": 0.32, "SnowScale": 0.22},
             vectors={"TileSize": (9.0, 9.0), "Tint": (0.68, 0.76, 0.82)},
             textures={"Albedo": "concrete_a", "NormalMap": "snow_n", "RoughAoH": "concrete_r"})
    t = (1.524 * 2, 1.524 * 2)
    instance("MI_curbstone", "MI_granite" if False else "M_Surface",
             scalars={"RoughMul": 1.4, "Porosity": 0.35, "Grime": 0.75, "NormalStrength": 0.6},
             vectors={"TileSize": (2.4, 2.4), "Tint": (1.45, 1.45, 1.42)},
             textures={"Albedo": "granite_a", "NormalMap": "granite_n", "RoughAoH": "granite_r"})
    instance("MI_park_paving", "M_Sidewalk", scalars={"GumAmt": 0.15}, vectors={"Tint": (0.9, 0.84, 0.74), "TileSize": (2.2, 2.2)})


def signs():
    code = """
return NycSignMain(UV, Cell, Glow, Grid.xy, Atlas, AtlasSampler, WP, CamPos, VN, DayNits, NightNits, Night, Wetness, Snow, Emissive, Roughness);
"""
    inputs = [("UV", UV0), ("Cell", PIC(0, 0.0)), ("Glow", PIC(1, 1.0)), ("Grid", V("Grid", (4, 16, 0, 0))),
              ("Atlas", T("Atlas", "sg_shop")), ("WP", WPOS), ("CamPos", CAMPOS), ("VN", VNORMAL),
              ("DayNits", S("DayNits", 0.0)), ("NightNits", S("NightNits", 260.0)), ("Night", C("Night")),
              ("Wetness", C("Wetness")), ("Snow", C("Snow"))]
    m = build("M_Sign", code, inputs, [("Emissive", 3), ("Roughness", 1)],
              {"BaseColor": "", "Emissive": "Emissive", "Roughness": "Roughness"}, include=FAR_INC)
    table = {
        "sign_shop": ("sg_shop", (4, 16), 0.0, 95.0), "sign_street": ("sg_street", (4, 16), 0.0, 34.0),
        "sign_news": ("sg_news", (4, 2), 0.0, 30.0), "sign_subway": ("sg_subway", (1, 1), 60.0, 190.0),
        "sign_cart": ("sg_cart", (1, 1), 0.0, 120.0), "sign_ad": ("sg_poster", (4, 1), 40.0, 150.0),
        "sign_billboard": ("sg_billboard", (2, 2), 900.0, 520.0),
    }
    for name, (tex, grid, day, night) in table.items():
        instance("MI_" + name, m, scalars={"DayNits": day, "NightNits": night}, vectors={"Grid": (grid[0], grid[1], 0, 0)},
                 textures={"Atlas": tex})
    gcode = """
return NycGhostMain(UV, Cell, WP, CamPos, VN, Atlas, AtlasSampler, BrickTex, BrickTexSampler, NoiseTex, NoiseTexSampler, Wetness, Roughness);
"""
    g = build("M_Ghost", gcode, [("UV", UV0), ("Cell", PIC(0, 0.0)), ("WP", WPOS), ("CamPos", CAMPOS), ("VN", VNORMAL),
                                 ("Atlas", T("Atlas", "sg_ghost")), ("BrickTex", T("Brick", "brick_brown_a")),
                                 ("NoiseTex", T("NoiseMask", "noise")), ("Wetness", C("Wetness"))],
              [("Roughness", 1)], {"BaseColor": "", "Roughness": "Roughness"}, include=FAR_INC)
    instance("MI_sign_ghost", g)
    pcode = "return NycPedSignalMain(UV, State, Count, Atlas, AtlasSampler, Emissive);"
    p = build("M_PedSignal", pcode, [("UV", UV0), ("State", PIC(0, 0.0)), ("Count", PIC(1, 0.0)), ("Atlas", T("Atlas", "sg_ped"))],
              [("Emissive", 3)], {"BaseColor": "", "Emissive": "Emissive"}, include=FAR_INC)
    instance("MI_ped_signal", p)


def emitters():
    # traffic signal lamps: colour and intensity arrive per instance from ANYCTraffic
    m = build("M_SignalLamp", """
float3 c = float3(R, G, B);
Emissive = c * Lum;
return c * 0.06 + 0.008;
""", [("R", PIC(0, 0.05)), ("G", PIC(1, 0.01)), ("B", PIC(2, 0.01)), ("Lum", PIC(3, 0.0))], [("Emissive", 3)],
              {"BaseColor": "", "Emissive": "Emissive"}, include=FAR_INC)
    instance("MI_signal_lamp", m)
    # aviation beacons and bridge necklace lamps (PIC rgb + brightness)
    b = build("M_Beacon", """
float n = smoothstep(0.25, 0.6, Night);
float pulse = lerp(1.0, 0.25 + 0.75 * smoothstep(-0.2, 0.5, sin(SimTime * 2.6 + Phase * 6.28)), step(R * 0.9, 1.0 - G));
Emissive = float3(R, G, Bl) * n * pulse * 1400.0;
return float3(0.02, 0.02, 0.02);
""", [("R", PIC(0, 1.0)), ("G", PIC(1, 0.05)), ("Bl", PIC(2, 0.02)), ("Phase", PIC(3, 0.0)), ("Night", C("Night")), ("SimTime", C("SimTime"))],
              [("Emissive", 3)], {"BaseColor": "", "Emissive": "Emissive"}, include=FAR_INC)
    instance("MI_beacon_red", b)
    gl = build("M_GlassClear", """
float3 N = normalize(VN);
float3 D = normalize(WP - CamPos);
float f = 0.04 + 0.96 * pow(1.0 - saturate(abs(dot(D, N))), 5.0);
Opacity = lerp(0.12, 0.9, f);
Roughness = 0.04;
Specular = 0.5;
return float3(0.02, 0.03, 0.03);
""", [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS)], [("Opacity", 1), ("Roughness", 1), ("Specular", 1)],
               {"BaseColor": "", "Opacity": "Opacity", "Roughness": "Roughness", "Specular": "Specular"}, include=FAR_INC,
               blend="translucent", two_sided=True,
               props={"translucency_lighting_mode": unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING})
    instance("MI_glass_clear", gl)
    net = build("M_Netting", """
float fp = NycFootprint(WP, CamPos, normalize(VN));
float2 uvm; float3 T, B;
NycBoxFrame(WP, normalize(VN), uvm, T, B);
float2 g = abs(frac(uvm / 0.045) - 0.5);
float thread = step(0.36, max(g.x, g.y));
float dither = frac(52.9829189 * frac(dot(Parameters.SvPosition.xy, float2(0.06711056, 0.00583715))));
float cover = lerp(thread, 0.36, saturate(fp / 0.018));
Mask = cover > lerp(0.5, dither, saturate(fp / 0.018)) ? 1.0 : 0.0;
return float3(0.015, 0.05, 0.032);
""", [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS)], [("Mask", 1)], {"BaseColor": "", "OpacityMask": "Mask"},
                include=FAR_INC, blend="masked", two_sided=True)
    instance("MI_netting", net)


def far_materials():
    code = """
return NycFarFacadeMain(WP, VN, CamPos, PicStyle, PicVar, PicA, PicB, NoiseTex, NoiseTexSampler,
    UseInstance, WallColor.rgb, CellWin, GlassColor.rgb, Reflect, Office, WallRough, CrownZ, CrownNits,
    Wetness, Snow, Night, LitOffice, LitHome, InteriorDay, Roughness, Normal, Metallic, Specular, Emissive);
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("PicStyle", PIC(0, 0.0)), ("PicVar", PIC(1, 0.5)),
              ("PicA", PIC(2, 0.5)), ("PicB", PIC(3, 0.5)), ("NoiseTex", T("NoiseMask", "noise")),
              ("UseInstance", S("UseInstance", 0.0)), ("WallColor", V("WallColor", (0.4, 0.36, 0.28))),
              ("CellWin", ("vector", "CellWin", (2.4, 3.6, 0.5, 0.55))), ("GlassColor", V("GlassColor", (0.2, 0.34, 0.46))),
              ("Reflect", S("Reflect", 0.3)), ("Office", S("Office", 1.0)), ("WallRough", S("WallRough", 0.5)),
              ("CrownZ", S("CrownZ", 10000.0)), ("CrownNits", S("CrownNits", 0.0)),
              ("Wetness", C("Wetness")), ("Snow", C("Snow")), ("Night", C("Night")), ("LitOffice", C("LitOffice")),
              ("LitHome", C("LitHome")), ("InteriorDay", C("InteriorDay"))]
    # the vector parameter feeding CellWin must deliver all four channels
    outs = [("Roughness", 1), ("Normal", 3), ("Metallic", 1), ("Specular", 1), ("Emissive", 3)]
    code4 = code.replace("CellWin,", "float4(CellWin.xyz, CellW2),")
    inputs4 = inputs + [("CellW2", S("WinHeight", 0.55))]
    m = build("M_FarFacade", code4, inputs4, outs,
              {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Metallic": "Metallic", "Specular": "Specular", "Emissive": "Emissive"},
              include=FAR_INC)
    instance("MI_farbox", m, scalars={"UseInstance": 1.0})

    def far(name, wall, cell, win, glass, reflect, office, rough, crown_z=10000.0, crown=0.0):
        instance("MI_" + name, m,
                 scalars={"UseInstance": 0.0, "Reflect": reflect, "Office": office, "WallRough": rough, "CrownZ": crown_z, "CrownNits": crown,
                          "WinHeight": win[1]},
                 vectors={"WallColor": wall, "CellWin": (cell[0], cell[1], win[0], 1.0), "GlassColor": glass})

    far("far_onev", (0.32, 0.27, 0.2), (1.52, 4.4), (0.93, 0.72), (0.34, 0.52, 0.62), 0.52, 1.0, 0.35, 330.0, 9.0)
    far("far_crystal", (0.3, 0.34, 0.37), (1.5, 4.1), (0.95, 0.76), (0.4, 0.56, 0.68), 0.56, 1.0, 0.3, 10000.0, 0.0)
    far("far_grace", (0.66, 0.62, 0.52), (2.35, 3.9), (0.56, 0.66), (0.08, 0.09, 0.1), 0.18, 1.0, 0.6)
    far("far_metlife", (0.4, 0.365, 0.3), (1.65, 3.8), (0.62, 0.5), (0.1, 0.12, 0.12), 0.2, 1.0, 0.75)
    far("far_un", (0.2, 0.28, 0.28), (1.2, 3.65), (0.92, 0.66), (0.22, 0.42, 0.4), 0.48, 1.0, 0.35)
    far("far_stone", (0.45, 0.39, 0.29), (2.3, 3.6), (0.46, 0.58), (0.05, 0.06, 0.07), 0.06, 0.8, 0.82)
    far("far_wtc", (0.36, 0.42, 0.47), (1.6, 4.0), (0.97, 0.86), (0.42, 0.56, 0.7), 0.62, 1.0, 0.25, 400.0, 16.0)
    far("far_deco", (0.47, 0.41, 0.31), (2.2, 3.7), (0.44, 0.74), (0.05, 0.055, 0.065), 0.06, 0.9, 0.8)
    far("far_432", (0.72, 0.71, 0.68), (4.75, 4.75), (0.64, 0.64), (0.1, 0.14, 0.17), 0.35, 0.2, 0.6)
    far("far_bronze", (0.3, 0.2, 0.11), (1.3, 3.9), (0.72, 0.7), (0.2, 0.17, 0.13), 0.4, 0.2, 0.4)
    far("far_citi", (0.62, 0.64, 0.65), (1.6, 3.7), (0.98, 0.46), (0.1, 0.13, 0.17), 0.45, 1.0, 0.3)
    far("far_nyt", (0.4, 0.41, 0.42), (1.5, 4.1), (0.8, 0.5), (0.24, 0.3, 0.34), 0.3, 1.0, 0.55)

    gcode = "return NycFarGroundMain(WP, CamPos, NoiseTex, NoiseTexSampler, Grid, Wetness, Snow, Night, Roughness, Emissive);"
    g = build("M_FarGround", gcode, [("WP", WPOS), ("CamPos", CAMPOS), ("NoiseTex", T("NoiseMask", "noise")), ("Grid", S("Grid", 1.0)),
                                     ("Wetness", C("Wetness")), ("Snow", C("Snow")), ("Night", C("Night"))],
              [("Roughness", 1), ("Emissive", 3)], {"BaseColor": "", "Roughness": "Roughness", "Emissive": "Emissive"}, include=FAR_INC)
    instance("MI_farground", g, scalars={"Grid": 1.0})
    instance("MI_farground_boro", g, scalars={"Grid": 0.0})
    wcode = "return NycWaterMain(WP, CamPos, WaveTex, WaveTexSampler, SimTime, Wind, Rain, Roughness, Normal, Specular);"
    w = build("M_Water", wcode, [("WP", WPOS), ("CamPos", CAMPOS), ("WaveTex", T("Waves", "water_n", normal=True)),
                                 ("SimTime", C("SimTime")), ("Wind", C("Wind")), ("Rain", C("Rain"))],
              [("Roughness", 1), ("Normal", 3), ("Specular", 1)], {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Specular": "Specular"},
              include=FAR_INC)
    instance("MI_water", w)


def run(which=("variants", "signs", "emitters", "far")):
    import materials
    importlib.reload(materials)
    materials.import_all()
    ensure_mpc()
    if "variants" in which:
        surface_variants()
    if "signs" in which:
        signs()
    if "emitters" in which:
        emitters()
    if "far" in which:
        far_materials()
    unreal.NYCBuilderLibrary.finish_all_compilation()
    print("city materials done")
