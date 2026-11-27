"""Cloud volume texture, volumetric cloud material and lightning material."""
import os
import sys
import importlib

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import matlib
importlib.reload(matlib)
from matlib import *  # noqa


def make_volume():
    atlas = unreal.load_asset(TEX_DIR + "/cloudvol_atlas")
    atlas.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
    atlas.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_VECTOR_DISPLACEMENTMAP)
    atlas.set_editor_property("srgb", False)
    EAL.save_loaded_asset(atlas)
    vol = unreal.NYCBuilderLibrary.make_volume_texture(TEX_DIR + "/VT_Cloud", atlas, 128)
    unreal.NYCBuilderLibrary.save_asset_object(vol)
    return vol


def make_cloud():
    vol = make_volume()
    code = """
float3 Extinction_; float3 Emis_;
float3 a = NycCloudMain(WP, Vol, VolSampler, NoiseTex, NoiseTexSampler, Coverage, StormAmt, LowDeck, DeckBase, Drift,
    OvercastColor.rgb, GlowColor.rgb, Flash, FlashPosition.rgb, Extinction_, Emis_);
Extinction = Extinction_; Emis = Emis_;
return a;
"""
    inputs = [("WP", WPOS), ("Vol", T("CloudVolume", vol, srgb=False)), ("NoiseTex", T("NoiseMask", "noise")),
              ("Coverage", S("Coverage", 0.3)), ("StormAmt", S("StormAmt", 0.0)), ("LowDeck", S("LowDeck", 0.0)),
              ("DeckBase", S("DeckBase", 220.0)), ("Drift", S("Drift", 0.0)),
              ("OvercastColor", V("OvercastColor", (0, 0, 0))), ("GlowColor", V("GlowColor", (0, 0, 0))),
              ("Flash", S("Flash", 0.0)), ("FlashPosition", V("FlashPosition", (0, 0, 90000)))]
    m = build("M_Cloud", code, inputs, [("Extinction", 3), ("Emis", 3)],
              {"BaseColor": "", "Emissive": "Emis", "Extinction": "Extinction"},
              include=("/NYC/Sky.ush",), domain="volume", blend="additive", usage=("vcloud",))
    adv = MEL.create_material_expression(m, unreal.MaterialExpressionVolumetricAdvancedMaterialOutput, 300, 400)
    for k, v_ in (("const_phase_g", 0.62), ("const_phase_g2", -0.25), ("const_phase_blend", 0.35),
                  ("multi_scattering_approximation_octave_count", 2), ("const_multi_scattering_contribution", 0.62),
                  ("const_multi_scattering_occlusion", 0.42), ("const_multi_scattering_eccentricity", 0.55),
                  ("ground_contribution", False)):
        try:
            adv.set_editor_property(k, v_)
        except Exception as ex:
            print("advanced output:", k, ex)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


def make_bolt():
    return build("M_Bolt", "return NycBoltMain(UV, VCol, Envelope);",
                 [("UV", UV0), ("VCol", VCOLOR), ("Envelope", S("Envelope", 0.0))], [], {"Emissive": ""},
                 include=("/NYC/Sky.ush",), shading="unlit", blend="additive", two_sided=True, usage=())


def run(which=("cloud", "bolt")):
    ensure_mpc()
    if "cloud" in which:
        make_cloud()
    if "bolt" in which:
        make_bolt()
    unreal.NYCBuilderLibrary.finish_all_compilation()
    print("sky materials done")
