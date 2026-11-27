"""Materials for the particle carriers."""
import os
import sys
import importlib

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import matlib
importlib.reload(matlib)
from matlib import *  # noqa

INC = ("/NYC/FX.ush",)


def fx_light_inputs():
    out = []
    for i in range(NUM_FX_LIGHTS):
        for short, name in (("P", "FxPos"), ("C", "FxCol"), ("D", "FxDir")):
            out.append(("%s%d" % (short, i), CV("%s%d" % (name, i))))
    return out


FX_PASS = ", ".join("%s%d" % (s, i) for i in range(NUM_FX_LIGHTS) for s in ("P", "C", "D"))


def make(name, color_code, color_inputs, wpo_code, wpo_inputs, interps=(), blend="translucent"):
    """A particle material.  `interps` are extra values computed in the vertex stage:
    (pixel input name, hlsl expression body) pairs routed through vertex interpolators."""
    mat = build(name, color_code, color_inputs, [("Opacity", 1)], {"Emissive": "", "Opacity": "Opacity"}, include=INC,
                blend=blend, shading="unlit", two_sided=True, usage=(), props={"max_world_position_offset_displacement": 0.0})
    mpc = ensure_mpc()
    wnode = custom_node(mat, name + "_wpo", wpo_code, wpo_inputs, [], list(INC), -500, 1400, mpc, 3, None, None)
    MEL.connect_material_property(wnode, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    colour_node = MEL.get_material_property_input_node(mat, unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    y = 2200
    for pin, code, inputs in interps:
        src = custom_node(mat, name + "_" + pin, code, inputs, [], list(INC), -900, y, mpc, 1, None, None)
        vi = MEL.create_material_expression(mat, unreal.MaterialExpressionVertexInterpolator, -600, y)
        MEL.connect_material_expressions(src, "", vi, "")
        if not MEL.connect_material_expressions(vi, "", colour_node, pin):
            raise RuntimeError("interpolator %s not connected in %s" % (pin, name))
        y += 500
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    instance("MI_" + name[2:].lower(), mat)
    return mat


def run():
    ensure_mpc()
    ground = ("MaskTex", T("GroundMask", "groundz"))
    cover = ("CoverTex", T("CoverMap", "cover"))
    noise = ("NoiseTex", T("NoiseMask", "noise"))
    common_light = [("FogColor", CV("FogColor")), ("Flash", C("Flash"))]
    lens_seed = ("Seed3", ("node", "PreSkinnedPosition", {}))
    seed_expr = "frac(round(Seed3 / 4.0) * 4.0 / 2000.0 + 0.5)"

    # ---- rain
    make("M_Rain",
         "float4 c = NycRainColor(WP, CamPos, UV, FogColor.rgb, Flash, FlashPos.rgb, %s); Opacity = c.a; return c.rgb;" % FX_PASS,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0)] + common_light + [("FlashPos", CV("FlashPos"))] + fx_light_inputs(),
         "return NycRainOffset(WP, CamPos, UV, Rnd, float4(0,0,0,0), Rain, NearRain, Wind, SimTime, CoverTex, CoverTexSampler, %s);" % seed_expr,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Rnd", UV1), ("Rain", C("Rain")), ("NearRain", C("NearRain")), ("Wind", C("Wind")),
          ("SimTime", C("SimTime")), cover, lens_seed])

    # ---- snow
    make("M_Snow",
         "float4 c = NycSnowColor(WP, CamPos, UV, FogColor.rgb, Flash, %s); Opacity = c.a; return c.rgb;" % FX_PASS,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0)] + common_light + fx_light_inputs(),
         "return NycSnowOffset(WP, CamPos, UV, Rnd, SnowFall, Wind, SimTime, CoverTex, CoverTexSampler, %s);" % seed_expr,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Rnd", UV1), ("SnowFall", C("SnowFall")), ("Wind", C("Wind")),
          ("SimTime", C("SimTime")), cover, lens_seed])

    # ---- splashes
    splash_seed = ("Seed3", ("node", "PreSkinnedPosition", {}))
    splash_args = [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Kind", UV1), splash_seed, ("Rain", C("Rain")), ("SimTime", C("SimTime")), cover, ground]
    call = "NycSplashOffset(WP, CamPos, UV, Kind, frac(round(Seed3 / 4.0) * 4.0 / 2000.0 + 0.5), Rain, SimTime, CoverTex, CoverTexSampler, MaskTex, MaskTexSampler, a)"
    make("M_Splash",
         "float4 c = NycSplashColor(WP, CamPos, UV, Kind, Age, FogColor.rgb, Flash, %s); Opacity = c.a; return c.rgb;" % FX_PASS,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Kind", UV1), ("Age", S("AgeDefault", 0.0))] + common_light + fx_light_inputs(),
         "float a; return %s;" % call, splash_args,
         interps=[("Age", "float a; float3 o = %s; return a;" % call, splash_args)])

    # ---- drips
    drip_args = [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Rnd", UV1), ("Wetness", C("Wetness")), ("SimTime", C("SimTime")), ground]
    make("M_Drip",
         "float4 c = NycSplashColor(WP, CamPos, float2(0.5, 0.5), float2(0, 0), 0.0, FogColor.rgb, Flash, %s);\n"
         "float across = 1.0 - abs(UV.x - 0.5) * 2.0; Opacity = across * saturate(UV.y * 4.0) * saturate((1.0 - UV.y) * 4.0) * 0.75; return c.rgb * 1.2;" % FX_PASS,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0)] + common_light + fx_light_inputs(),
         "float f; return NycDripOffset(WP, CamPos, UV, Rnd, Wetness, SimTime, MaskTex, MaskTexSampler, f);", drip_args)

    # ---- steam
    steam_args = [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Puff", UV1), ("Rnd", VCOLOR), ("Wind", C("Wind")), ("SimTime", C("SimTime"))]
    call = "NycSteamOffset(WP, CamPos, UV, Puff, Rnd, Wind, SimTime, 0.0, a, sp)"
    make("M_Steam",
         "float4 c = NycSteamColor(WP, CamPos, UV, Age, Puff, Rnd, NoiseTex, NoiseTexSampler, FogColor.rgb, SunLux, SunColor.rgb, Flash, %s);\n"
         "Opacity = c.a * Fade; return c.rgb;" % FX_PASS,
         [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Puff", UV1), ("Rnd", VCOLOR), ("Age", S("AgeDefault", 0.5)), noise,
          ("SunLux", C("SunLux")), ("SunColor", CV("SunColor")), ("Fade", ("node", "DepthFade", {"fade_distance_default": 38.0}))] + common_light + fx_light_inputs(),
         "float a, sp; return %s;" % call, steam_args,
         interps=[("Age", "float a, sp; float3 o = %s; return a;" % call, steam_args)])

    # ---- tyre spray (attached to vehicles; custom primitive data 0 = amount, 1 = speed)
    spray = build("M_Spray",
                  "float2 q = (UV - 0.5) * 2.0;\n"
                  "float4 n = NoiseTex.SampleLevel(NoiseTexSampler, UV * 0.6 + Rnd * 9.0 + SimTime * float2(0.31, 0.17), 1.0);\n"
                  "float r = length(q) + (n.g - 0.5) * 0.9;\n"
                  "float age = frac(SimTime / (0.55 + 0.3 * Rnd.x) + Rnd.y);\n"
                  "Opacity = saturate(1.0 - smoothstep(0.2, 1.0, r)) * saturate(n.r * 1.8 - 0.35) * (1.0 - age) * saturate(age * 6.0) * Amount * 0.34 * Fade;\n"
                  "float3 V = normalize(CamPos - WP);\n"
                  "return FogColor.rgb * 1.2 + NycFxScatter(WP, V, 0.7, %s) * 2.6 + Flash * 30.0;" % FX_PASS,
                  [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Rnd", UV1), noise, ("SimTime", C("SimTime")),
                   ("Amount", CPD("Amount", 0, 0.0)), ("Fade", ("node", "DepthFade", {"fade_distance_default": 30.0}))] + common_light + fx_light_inputs(),
                  [("Opacity", 1)], {"Emissive": "", "Opacity": "Opacity"}, include=INC, blend="translucent", shading="unlit", two_sided=True, usage=())
    mpc = ensure_mpc()
    w = custom_node(spray, "spraywpo",
                    "float a; float3 f = normalize(CamPos - WP + float3(0, 0, 0.001)); float3 right = normalize(cross(float3(0, 0, 1), f)); "
                    "float3 up = cross(f, right); return NycSprayOffset(WP, UV, Rnd, Amount, Speed, SimTime, right, up, a);",
                    [("WP", WPOS), ("CamPos", CAMPOS), ("UV", UV0), ("Rnd", UV1), ("Amount", CPD("Amount", 0, 0.0)), ("Speed", CPD("Speed", 1, 0.0)),
                     ("SimTime", C("SimTime"))], [], list(INC), -500, 1400, mpc, 3)
    MEL.connect_material_property(w, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
    MEL.recompile_material(spray)
    EAL.save_loaded_asset(spray)
    instance("MI_spray", spray)
