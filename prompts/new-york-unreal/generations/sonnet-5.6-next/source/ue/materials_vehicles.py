"""Vehicle, lamp and pedestrian materials."""
import os
import sys
import importlib

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import matlib
importlib.reload(matlib)
from matlib import *  # noqa

INC = ("/NYC/Vehicle.ush",)
LPOS = ("vinterp", "PreSkinnedPosition")
LNRM = ("vinterp", "PreSkinnedNormal")
VLNRM = ("node", "PreSkinnedNormal", {})

# Custom primitive data written by ANYCTraffic:
#   0-2 paint colour, 3 headlamps, 4 brake, 5 hazard/turn blink, 6 seed, 7 snow scale


def paint_material(name, color_inputs, snow_scale_input):
    code = """
return NycCarPaintMain(WP, VN, CamPos, LP, LN, float3(CR, CG, CB), SnowScale, Drops, DropsSampler, NoiseTex, NoiseTexSampler,
    Wetness, Rain, Snow, Metal, BaseRough, Roughness, Normal, Metallic, Specular);
"""
    inputs = [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("LP", LPOS), ("LN", LNRM)] + color_inputs + [
        ("SnowScale", snow_scale_input), ("Drops", T("Drops", "drops")), ("NoiseTex", T("NoiseMask", "noise")),
        ("Wetness", C("Wetness")), ("Rain", C("Rain")), ("Snow", C("Snow")), ("Metal", S("Metal", 0.55)), ("BaseRough", S("BaseRough", 0.19))]
    wpo = dict(code="return NycCarSnowOffset(LN, WN, WP, Snow, SnowScale);",
               inputs=[("LN", VLNRM), ("WN", VNORMAL), ("WP", WPOS), ("Snow", C("Snow")), ("SnowScale", snow_scale_input)])
    return build(name, code, inputs, [("Roughness", 1), ("Normal", 3), ("Metallic", 1), ("Specular", 1)],
                 {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Metallic": "Metallic", "Specular": "Specular"},
                 include=INC, wpo=wpo, props={"max_world_position_offset_displacement": 12.0})


def run():
    ensure_mpc()
    moving = paint_material("M_CarPaint", [("CR", CPD("PaintR", 0, 0.7)), ("CG", CPD("PaintG", 1, 0.4)), ("CB", CPD("PaintB", 2, 0.01))],
                            CPD("SnowScale", 7, 0.25))
    parked = paint_material("M_CarPaintParked", [("CR", PIC(0, 0.2)), ("CG", PIC(1, 0.2)), ("CB", PIC(2, 0.22))], S("SnowScale", 1.0))
    instance("MI_carpaint", moving)
    instance("MI_carpaint_parked", parked)

    glass_code = """
float3 N = normalize(VN);
float fp = NycFootprint(WP, CamPos, N);
Roughness = 0.028;
Normal = N;
Metallic = 0.28;
Specular = 0.65;
float3 base = float3(0.012, 0.016, 0.02);
if (Wetness > 0.01)
{
    float beads = Wetness * saturate(Rain * 2.5) * saturate(1.2 - fp / 0.012);
    if (beads > 0.01) Normal = NycBeadNormal(LP, normalize(LN), N, Drops, DropsSampler, beads, 1.8);
}
float m = smoothstep(0.5, 0.78, LN.z) * saturate(Snow * 1.8 - 0.45);
base = lerp(base, float3(0.78, 0.81, 0.86), m);
Roughness = lerp(Roughness, 0.6, m);
Metallic *= 1.0 - m;
return base;
"""
    g = build("M_CarGlass", glass_code, [("WP", WPOS), ("VN", VNORMAL), ("CamPos", CAMPOS), ("LP", LPOS), ("LN", LNRM),
                                         ("Drops", T("Drops", "drops")), ("Wetness", C("Wetness")), ("Rain", C("Rain")), ("Snow", C("Snow"))],
              [("Roughness", 1), ("Normal", 3), ("Metallic", 1), ("Specular", 1)],
              {"BaseColor": "", "Roughness": "Roughness", "Normal": "Normal", "Metallic": "Metallic", "Specular": "Specular"}, include=INC)
    instance("MI_carglass", g)

    # lamps: colour and brightness from parameters, switched by custom primitive data
    lamp = build("M_VehicleLamp", """
float on = saturate(Head * UseHead + UseTail * (Head * 0.12 + Brake) + UseTurn * Turn + UseTaxi * Head);
float lum = UseHead * Head * HeadNits + UseTail * (Head * TailNits + Brake * BrakeNits) + UseTurn * Turn * TurnNits + UseTaxi * Head * HeadNits;
Emissive = LampColor.rgb * lum;
return BaseCol.rgb;
""", [("Head", CPD("HeadOn", 3, 0.0)), ("Brake", CPD("BrakeOn", 4, 0.0)), ("Turn", CPD("TurnOn", 5, 0.0)),
      ("UseHead", S("UseHead", 0)), ("UseTail", S("UseTail", 0)), ("UseTurn", S("UseTurn", 0)), ("UseTaxi", S("UseTaxi", 0)),
      ("HeadNits", S("HeadNits", 0)), ("TailNits", S("TailNits", 0)), ("BrakeNits", S("BrakeNits", 0)), ("TurnNits", S("TurnNits", 0)),
      ("LampColor", V("LampColor", (1, 1, 1))), ("BaseCol", V("BaseCol", (0.5, 0.5, 0.5)))],
                 [("Emissive", 3)], {"BaseColor": "", "Emissive": "Emissive", "Roughness": "R", "Metallic": "M"} if False else {"BaseColor": "", "Emissive": "Emissive"},
                 include=INC)
    rough = MEL.create_material_expression(lamp, unreal.MaterialExpressionScalarParameter, -200, 500)
    rough.set_editor_property("parameter_name", "Rough")
    rough.set_editor_property("default_value", 0.1)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.recompile_material(lamp)
    EAL.save_loaded_asset(lamp)
    instance("MI_headlight", lamp, scalars={"UseHead": 1, "HeadNits": 3200, "Rough": 0.06}, vectors={"LampColor": (1.0, 0.92, 0.8), "BaseCol": (0.55, 0.58, 0.6)})
    instance("MI_taillight", lamp, scalars={"UseTail": 1, "TailNits": 110, "BrakeNits": 1500, "Rough": 0.12}, vectors={"LampColor": (1.0, 0.012, 0.006), "BaseCol": (0.16, 0.004, 0.003)})
    instance("MI_turnlight", lamp, scalars={"UseTurn": 1, "TurnNits": 1100, "Rough": 0.15}, vectors={"LampColor": (1.0, 0.42, 0.02), "BaseCol": (0.5, 0.2, 0.01)})
    instance("MI_taxilamp", lamp, scalars={"UseTaxi": 1, "HeadNits": 420, "Rough": 0.2}, vectors={"LampColor": (1.0, 0.72, 0.28), "BaseCol": (0.7, 0.62, 0.3)})

    def finish(n, col, rough_, metal=0.0, grime=0.2, porosity=0.1):
        instance("MI_" + n, "M_Surface",
                 scalars={"AlbedoMix": 0.04, "RoughMul": 0.0, "RoughAdd": rough_, "Metallic": metal, "Grime": grime, "Porosity": porosity, "NormalStrength": 0.2},
                 vectors={"TileSize": (2.0, 2.0), "Tint": col},
                 textures={"Albedo": "metal_paint_a", "NormalMap": "metal_paint_n", "RoughAoH": "metal_paint_r"})

    # these live on moving objects, so grime is left at zero (it is world-space)
    finish("car_trim", (0.013, 0.013, 0.014), 0.44, 0.0, 0.0)
    finish("wheelwell", (0.004, 0.004, 0.004), 0.92, 0.0, 0.0)
    finish("tire", (0.011, 0.011, 0.012), 0.78, 0.0, 0.0)
    finish("rim", (0.5, 0.51, 0.53), 0.3, 1.0, 0.0)
    finish("rim_dark", (0.11, 0.115, 0.12), 0.38, 0.9, 0.0)
    finish("buspaint", (0.62, 0.64, 0.66), 0.28, 0.1, 0.0)
    finish("busstripe", (0.008, 0.07, 0.32), 0.28, 0.1, 0.0)
    finish("truckbox", (0.6, 0.6, 0.57), 0.42, 0.15, 0.0)
    for n, col in (("ped_coat_black", (0.012, 0.012, 0.014)), ("ped_coat_navy", (0.012, 0.022, 0.06)), ("ped_coat_tan", (0.2, 0.12, 0.055)),
                   ("ped_coat_gray", (0.09, 0.092, 0.1)), ("ped_coat_red", (0.2, 0.014, 0.012)), ("ped_coat_olive", (0.05, 0.06, 0.025)),
                   ("ped_pants_dark", (0.014, 0.014, 0.018)), ("ped_pants_denim", (0.028, 0.055, 0.12)), ("ped_shoe", (0.012, 0.009, 0.007)),
                   ("ped_skin", (0.3, 0.17, 0.11)), ("ped_hair", (0.03, 0.018, 0.01)), ("ped_bag", (0.03, 0.022, 0.016))):
        walker(n, col, 0.82 if "skin" not in n else 0.6)
    for n, col in (("umbrella_black", (0.01, 0.01, 0.011)), ("umbrella_red", (0.24, 0.012, 0.012)), ("umbrella_clear", (0.16, 0.18, 0.2))):
        finish(n, col, 0.22, 0.0, 0.0, 0.0)

    bus = unreal.load_asset(MAT_DIR + "/M_Glass")
    instance("MI_busglass", bus, scalars={"RoomKind": 2, "DepthScale": 0.36, "BlindChance": 0.0, "CurtainChance": 0.0, "Reflect": 0.2, "PaneW": 1.34,
                                          "Warp": 0.3, "LitBias": 2.2, "Transmit": 0.55}, vectors={"GlassTint": (0.45, 0.55, 0.55)})
    decals()


def walker(name, color, rough):
    """Each pedestrian colour is its own small material because the walk happens in the vertex shader."""
    master = load(MAT_DIR + "/M_Pedestrian")
    if not getattr(walker, "built", False):
        walker.built = True
        master = build("M_Pedestrian", """
Roughness = lerp(RoughIn, 0.25, Wetness * 0.6);
return Tint.rgb * lerp(1.0, 0.62, Wetness);
""", [("Tint", V("Tint", (0.05, 0.05, 0.05))), ("RoughIn", S("RoughIn", 0.82)), ("Wetness", C("Wetness"))], [("Roughness", 1)],
                       {"BaseColor": "", "Roughness": "Roughness"}, include=INC, usage=("ism",), two_sided=True)
        mpc = ensure_mpc()
        node = custom_node(master, "walk", "return NycWalkOffset(VCol, UV1v, Phase, Speed, SimTime);",
                           [("VCol", VCOLOR), ("UV1v", UV1), ("Phase", PIC(0, 0.0)), ("Speed", PIC(1, 1.3)), ("SimTime", C("SimTime"))],
                           [], list(INC), -500, 900, mpc)
        xf = MEL.create_material_expression(master, unreal.MaterialExpressionTransform, -150, 900)
        xf.set_editor_property("transform_source_type", unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_INSTANCE)
        xf.set_editor_property("transform_type", unreal.MaterialVectorCoordTransform.TRANSFORM_WORLD)
        MEL.connect_material_expressions(node, "", xf, "")
        MEL.connect_material_property(xf, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET)
        master.set_editor_property("max_world_position_offset_displacement", 90.0)
        MEL.recompile_material(master)
        EAL.save_loaded_asset(master)
    instance("MI_" + name, master, scalars={"RoughIn": rough}, vectors={"Tint": color})


def decals():
    code = """
float3 c = Atlas.Sample(AtlasSampler, UV).rgb;
Emissive = c * (DayNits + NightNits * smoothstep(0.35, 0.6, Night));
return c * 0.8;
"""
    # lettering uses hardware derivatives, which only exist when rasterising
    code = code.replace("Atlas.Sample(AtlasSampler, UV)", "NycSample(Atlas, AtlasSampler, UV, 0.001)")
    m = build("M_VehicleDecal", code, [("UV", UV0), ("Atlas", T("Atlas", "sg_vehicle")), ("DayNits", S("DayNits", 0.0)), ("NightNits", S("NightNits", 0.0)), ("Night", C("Night")),
                                       ("Rough", S("Rough", 0.3))], [("Emissive", 3)], {"BaseColor": "", "Emissive": "Emissive"}, include=INC, usage=("ism", "nanite"))
    r = MEL.create_material_expression(m, unreal.MaterialExpressionConstant, -200, 500)
    r.set_editor_property("r", 0.32)
    MEL.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    instance("MI_veh_decal_flat", m)
    instance("MI_plate", m)
    instance("MI_veh_ad", m, scalars={"NightNits": 80.0})
    instance("MI_veh_sign", m, scalars={"DayNits": 700.0, "NightNits": 0.0})
