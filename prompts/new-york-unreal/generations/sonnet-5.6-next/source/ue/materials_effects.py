"""Materials for the destruction effects: ray-marched volumes, shock front, beams, craters, water,
Niagara particles and the glowing finishes on the more exotic tools."""
import importlib

import matlib
importlib.reload(matlib)
from matlib import *  # noqa

VOL = ("VolTex", T("VolumeNoise", "VT_Cloud"))
LIGHT = [("SkyColor", CV("SkyColor")), ("SunColor", CV("SunColor")), ("SunLux", C("SunLux"))]
SCENE = [("SceneDepth", SCENEDEPTH), ("PixelDepth", PIXDEPTH)]


def fx_lights():
    out = []
    for i in range(16):
        out += [("P%d" % i, CV("FxPos%d" % i)), ("C%d" % i, CV("FxCol%d" % i)), ("D%d" % i, CV("FxDir%d" % i))]
    return out


def volume():
    code = """
float4 r = NycVolumeMain(WP, CamPos, Centre, SceneDepth, PixelDepth, Parameters.SvPosition.xy, View.GameTime,
	VolTex, VolTexSampler, VType, VDensity, VSeed, VAge, float3(VR, VG, VB), VGlow, VNoise, VLife, VRadius, VSquash,
	SunDir.xyz, SunColor.rgb, SunLux, SkyColor.rgb, SkyNits, FogColor.rgb, CityGlow, Flash, VSun, VSky, VQuality, NYC_FX_PASS);
Alpha = r.a;
return r.rgb;
"""
    inputs = [("WP", WPOS), ("CamPos", CAMPOS), ("Centre", OBJPOS)] + SCENE + [VOL,
        ("VType", CPD("VType", 0, 0.0)), ("VDensity", CPD("VDensity", 1, 1.0)), ("VSeed", CPD("VSeed", 2, 0.0)), ("VAge", CPD("VAge", 3, 0.0)),
        ("VR", CPD("VR", 4, 0.4)), ("VG", CPD("VG", 5, 0.38)), ("VB", CPD("VB", 6, 0.35)), ("VGlow", CPD("VGlow", 7, 0.0)),
        ("VNoise", CPD("VNoise", 8, 4.0)), ("VLife", CPD("VLife", 9, 0.0)), ("VRadius", CPD("VRadius", 10, 100.0)), ("VSquash", CPD("VSquash", 11, 1.0)),
        ("VSun", CPD("VSun", 12, 1.0)), ("VSky", CPD("VSky", 13, 1.0)), ("VQuality", CPD("VQuality", 14, 0.65)),
        ("SunDir", CV("SunDir"))] + LIGHT + [("SkyNits", C("SkyNits")), ("FogColor", CV("FogColor")), ("CityGlow", C("CityGlow")),
        ("Flash", C("Flash"))] + fx_lights()
    build("M_Volume", code, inputs, [("Alpha", 1)], {"Emissive": "", "Opacity": "Alpha"}, include=("/NYC/Volume.ush",),
          blend="alphacomposite", shading="unlit", usage=(), props={"disable_depth_test": True})


def shock():
    code = """
float4 r = NycShockMain(WP, VN, CamPos, SceneDepth, PixelDepth, Strength, float3(R, G, B), Age, VolTex, VolTexSampler,
	SkyColor.rgb, SkyNits, SunColor.rgb, SunLux);
Alpha = r.a;
return r.rgb;
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS)] + SCENE + [VOL, ("Strength", CPD("Strength", 0, 0.5)), ("Age", CPD("Age", 3, 0.0)),
        ("R", CPD("R", 4, 1.0)), ("G", CPD("G", 5, 0.97)), ("B", CPD("B", 6, 0.92))] + LIGHT + [("SkyNits", C("SkyNits"))]
    build("M_Shock", code, inputs, [("Alpha", 1)], {"Emissive": "", "Opacity": "Alpha"}, include=("/NYC/Volume.ush",),
          blend="alphacomposite", shading="unlit", two_sided=True, usage=())


def scorch():
    """Burnt, ash-covered ground raked outward from ground zero; Front (0..1) is how far the wave has got."""
    code = """
float2 c = (UV - 0.5) * 2.0;
float r = length(c);
float a = atan2(c.y, c.x) / 6.2831853;
float rays = NycValueNoise(float2(a * 190.0, r * 3.1)) * 0.62 + NycValueNoise(float2(a * 530.0 + 7.0, r * 9.0)) * 0.38;
float blot = NycValueNoise(c * 17.0) * 0.6 + NycValueNoise(c * 71.0) * 0.4;
float core = 1.0 - smoothstep(0.16, 0.42, r + (blot - 0.5) * 0.22);
float streak = smoothstep(0.46, 0.78, rays + (blot - 0.5) * 0.35) * (1.0 - smoothstep(0.35, 1.0, r));
float seen = saturate((Front * 1.08 - r) * 14.0);
Alpha = saturate(core * 0.92 + streak * 0.72 + (1.0 - smoothstep(0.3, 0.95, r)) * 0.18 * blot) * seen * saturate((1.0 - r) * 9.0);
Rough = 0.96;
float ash = smoothstep(0.62, 0.82, blot) * (1.0 - core * 0.5);
return lerp(float3(0.018, 0.015, 0.013), float3(0.17, 0.15, 0.128), ash);
"""
    build("M_Scorch", code, [("UV", UV0), ("Front", S("Front", 1.0))], [("Alpha", 1), ("Rough", 1)],
          {"BaseColor": "", "Roughness": "Rough", "Opacity": "Alpha"}, include=("/NYC/Common.ush",),
          blend="translucent", domain="decal", usage=())


def beam():
    code = """
float4 r = NycBeamMain(WP, VN, CamPos, float3(R, G, B), Nits, Age, Fade, VolTex, VolTexSampler);
Alpha = r.a;
return r.rgb;
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), VOL, ("Fade", CPD("Fade", 0, 1.0)), ("Age", CPD("Age", 3, 0.0)),
              ("R", CPD("R", 4, 0.3)), ("G", CPD("G", 5, 0.8)), ("B", CPD("B", 6, 1.0)), ("Nits", CPD("Nits", 7, 20000.0))]
    build("M_Beam", code, inputs, [("Alpha", 1)], {"Emissive": "", "Opacity": "Alpha"}, include=("/NYC/Volume.ush",),
          blend="alphacomposite", shading="unlit", usage=())


def particles():
    simple = {"M_NSpark": "float4 r = NycNSpark(UV, PCol, 26000.0 * (0.35 + 0.65 * saturate(SunLux / 60000.0)) + 2500.0);",
              "M_NEmber": "float4 r = NycNEmber(UV, PCol, 5200.0 * (0.3 + 0.7 * saturate(SunLux / 60000.0)) + 500.0);"}
    for name, line in simple.items():
        build(name, line + "\nAlpha = r.a;\nreturn r.rgb;\n", [("UV", UV0), ("PCol", ("pcolor",)), ("SunLux", C("SunLux"))], [("Alpha", 1)],
              {"Emissive": "", "Opacity": "Alpha"}, include=("/NYC/Particles.ush",), blend="alphacomposite", shading="unlit",
              usage=("niagara_sprite",))
    lit = {"M_NDust": ("float4 r = NycNDust(UV, PCol, WP, SceneDepth, PixelDepth, SkyColor.rgb, SunColor.rgb, SunLux, VolTex, VolTexSampler);",
                       [("UV", UV0), ("PCol", ("pcolor",)), ("WP", WPOS)] + SCENE + LIGHT + [VOL]),
           "M_NFlame": ("float4 r = NycNFlame(UV, PCol, WP, SceneDepth, PixelDepth, 3400.0 * (0.4 + 0.6 * saturate(SunLux / 60000.0)) + 350.0, SimTime, VolTex, VolTexSampler);",
                        [("UV", UV0), ("PCol", ("pcolor",)), ("WP", WPOS)] + SCENE + [("SunLux", C("SunLux")), ("SimTime", C("SimTime")), VOL]),
           "M_NWater": ("float4 r = NycNWater(UV, PCol, SceneDepth, PixelDepth, SkyColor.rgb, SunColor.rgb, SunLux);",
                        [("UV", UV0), ("PCol", ("pcolor",))] + SCENE + LIGHT)}
    for name, (line, inputs) in lit.items():
        build(name, line + "\nAlpha = r.a;\nreturn r.rgb;\n", inputs, [("Alpha", 1)], {"Emissive": "", "Opacity": "Alpha"},
              include=("/NYC/Particles.ush",), blend="alphacomposite", shading="unlit", usage=("niagara_sprite",))
    build("M_NChip", "Roughness = 0.82;\nreturn NycNChip(WP, PCol, VolTex, VolTexSampler);\n",
          [("WP", WPOS), ("PCol", ("pcolor",)), VOL], [("Roughness", 1)], {"BaseColor": "", "Roughness": "Roughness"},
          include=("/NYC/Particles.ush",), two_sided=True, usage=("niagara_mesh",))
    build("M_NGlass", "Roughness = 0.05;\nMetallic = 0.75;\nreturn PCol.rgb;\n", [("PCol", ("pcolor",))],
          [("Roughness", 1), ("Metallic", 1)], {"BaseColor": "", "Roughness": "Roughness", "Metallic": "Metallic"},
          include=("/NYC/Particles.ush",), two_sided=True, usage=("niagara_mesh",))


def crater():
    # a flat disc that draws a bowl below the street: the ray is carried on into an analytic crater
    code = """
return NycCraterMain(WP, CamPos, Centre, Radius, Depth, Seed, Heat, SimTime, PixelDepth, VolTex, VolTexSampler, SunColor.rgb, SunLux,
	Wetness, Snow, Roughness, Normal, Emissive, Mask, Offset);
"""
    inputs = [("WP", WPOS), ("CamPos", CAMPOS), ("Centre", OBJPOS), ("PixelDepth", PIXDEPTH), VOL,
              ("Radius", CPD("Radius", 0, 300.0)), ("Depth", CPD("Depth", 1, 90.0)), ("Seed", CPD("Seed", 2, 0.0)), ("Heat", CPD("Heat", 3, 0.0)),
              ("SimTime", C("SimTime")), ("SunColor", CV("SunColor")), ("SunLux", C("SunLux")), ("Wetness", C("Wetness")), ("Snow", C("Snow"))]
    build("M_Crater", code, inputs, [("Roughness", 1), ("Normal", 3), ("Emissive", 3), ("Mask", 1), ("Offset", 1)],
          {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Emissive": "Emissive", "OpacityMask": "Mask",
           }, include=("/NYC/Destruct.ush",), blend="masked", usage=())


def water():
    code = """
return NycFloodMain(WP, CamPos, SimTime, Foam, VolTex, VolTexSampler, Roughness, Normal, Specular);
"""
    inputs = [("WP", WPOS), ("CamPos", CAMPOS), ("SimTime", C("SimTime")), ("Foam", CPD("Foam", 0, 0.3)), VOL]
    wpo = dict(code="return NycFloodOffset(WP, VN, SimTime, Foam, VolTex, VolTexSampler);",
               inputs=[("WP", WPOS), ("VN", VNORMAL), ("SimTime", C("SimTime")), ("Foam", CPD("Foam", 0, 0.3)), VOL])
    build("M_Flood", code, inputs, [("Roughness", 1), ("Normal", 3), ("Specular", 1)],
          {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Specular": "Specular"},
          include=("/NYC/Destruct.ush",), two_sided=True, wpo=wpo, usage=())


def finishes():
    glow = """
Roughness = 0.4;
Emissive = Col.rgb * Nits * (0.85 + 0.15 * sin(SimTime * 9.0 + WP.x * 0.013));
return Col.rgb * 0.05;
"""
    m = build("M_Glow", glow, [("Col", V("GlowColor", (0.2, 0.9, 1.0))), ("Nits", S("GlowNits", 9000.0)), ("SimTime", C("SimTime")), ("WP", WPOS)],
              [("Roughness", 1), ("Emissive", 3)], {"BaseColor": "", "Roughness": "Roughness", "Emissive": "Emissive"}, include=())
    for name, col, nits in (("cyan", (0.18, 0.85, 1.0), 9000.0), ("green", (0.3, 1.0, 0.25), 9000.0), ("red", (1.0, 0.08, 0.03), 12000.0),
                            ("violet", (0.55, 0.2, 1.0), 14000.0), ("orange", (1.0, 0.4, 0.05), 16000.0)):
        instance("MI_glow_" + name, m, scalars={"GlowNits": nits}, vectors={"GlowColor": col})
    rock = """
float n = VolTex.SampleLevel(VolTexSampler, LP * 0.0062, 0).r;
float n2 = VolTex.SampleLevel(VolTexSampler, LP * 0.019 + 0.37, 0).g;
float crack = saturate(1.0 - abs(n - 0.56) * 17.0) * saturate(n2 * 2.2 - 0.55);
Roughness = 0.9;
Emissive = float3(1.0, 0.3, 0.035) * crack * crack * 42000.0;
return lerp(float3(0.025, 0.02, 0.017), float3(0.09, 0.075, 0.062), n2);
"""
    r = build("M_MeteorRock", rock, [("LP", ("node", "WorldPosition", {})), VOL], [("Roughness", 1), ("Emissive", 3)],
              {"BaseColor": "", "Roughness": "Roughness", "Emissive": "Emissive"}, include=())
    instance("MI_meteor_rock", r)
    hull = """
float3 q = floor(WP / 140.0);
float panel = frac(sin(dot(q, float3(17.1, 31.7, 11.9))) * 917.3);
Roughness = 0.2 + 0.16 * panel;
Metallic = 1.0;
return float3(0.3, 0.32, 0.36) * (0.82 + 0.3 * panel);
"""
    h = build("M_AlienHull", hull, [("WP", WPOS)], [("Roughness", 1), ("Metallic", 1)],
              {"BaseColor": "", "Roughness": "Roughness", "Metallic": "Metallic"}, include=())
    instance("MI_alien_hull", h)
    dome = """
Roughness = 0.04;
Metallic = 0.9;
Emissive = float3(0.04, 0.3, 0.22) * 140.0;
return float3(0.03, 0.12, 0.11);
"""
    d = build("M_AlienDome", dome, [], [("Roughness", 1), ("Metallic", 1), ("Emissive", 3)],
              {"BaseColor": "", "Roughness": "Roughness", "Metallic": "Metallic", "Emissive": "Emissive"}, include=())
    instance("MI_alien_dome", d)
    ice = """
float s = step(0.9, frac(sin(dot(floor(WP / 4.0), float3(12.7, 78.2, 37.7))) * 4375.5));
Roughness = 0.08 + 0.2 * (1.0 - s);
Specular = 1.0;
Metallic = 0.25 + 0.6 * s;
return float3(0.52, 0.68, 0.8);
"""
    i = build("M_Ice", ice, [("WP", WPOS)], [("Roughness", 1), ("Specular", 1), ("Metallic", 1)],
              {"BaseColor": "", "Roughness": "Roughness", "Specular": "Specular", "Metallic": "Metallic"}, include=(), usage=("ism", "nanite"))
    instance("MI_ice_clear", i)


def slots():
    """Material instances named after the mesh slots that use these masters."""
    for slot, master in (("fx_volume", "M_Volume"), ("fx_shock", "M_Shock"), ("fx_beam", "M_Beam"), ("fx_crater", "M_Crater"),
                         ("fx_water", "M_Flood"), ("fx_particle", "M_NChip")):
        if load(MAT_DIR + "/" + master) is not None:
            instance("MI_" + slot, master)


def run(which=()):
    ensure_mpc()
    for fn in (volume, shock, scorch, beam, particles, crater, water, finishes):
        if not which or fn.__name__ in which:
            fn()
    slots()
    unreal.NYCBuilderLibrary.finish_all_compilation()
    print("effect materials done")
