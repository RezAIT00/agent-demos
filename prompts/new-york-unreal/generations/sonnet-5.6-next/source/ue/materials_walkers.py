"""Builds M_Walker, the skinned crowd material.  Run inside the editor:  materials_walkers.run()

All the logic is in NYC/Shaders/Walker.ush.  This script only wires the graph:
  vertex:  bone texture -> skinned position (this frame / PreviousFrameSwitch for velocity) -> WPO
           bone texture -> skinned normal -> interpolator
  pixel:   NycWalkerShade, plus a dithered fade as the opacity mask
"""
import importlib
import os
import struct
import sys
import zlib

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
sys.path.insert(0, os.path.join(ROOT, "source", "ue"))
import matlib
importlib.reload(matlib)
from matlib import MEL, EAL, AT, custom_node, ensure_mpc  # noqa: E402

DIR = "/Game/NYC/Walkers"
INC = ["/NYC/Walker.ush"]


def bone_default():
    """A tiny 2D float texture, so the sampler type is right before the game binds the real bone texture."""
    path = DIR + "/T_WalkerBonesDefault"
    tex = unreal.load_asset(path) if EAL.does_asset_exist(path) else None
    if tex is not None and not isinstance(tex, unreal.Texture2D):
        EAL.delete_asset(path)
        tex = None
    if tex is None:
        tmp = os.path.join(ROOT, "build", "walkers")
        os.makedirs(tmp, exist_ok=True)
        png = os.path.join(tmp, "T_WalkerBonesDefault.png")

        def chunk(tag, data):
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        rows = b"".join(bytes([0]) + bytes(4 * 4) for _ in range(4))
        with open(png, "wb") as f:
            f.write(bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
            f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 6, 0, 0, 0)))
            f.write(chunk(b"IDAT", zlib.compress(rows)))
            f.write(chunk(b"IEND", b""))
        task = unreal.AssetImportTask()
        task.set_editor_property("filename", png)
        task.set_editor_property("destination_path", DIR)
        task.set_editor_property("destination_name", "T_WalkerBonesDefault")
        task.set_editor_property("automated", True)
        task.set_editor_property("replace_existing", True)
        task.set_editor_property("save", False)
        AT.import_asset_tasks([task])
        tex = unreal.load_asset(path)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_HDR)
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
        tex.set_editor_property("never_stream", True)
        tex.set_editor_property("filter", unreal.TextureFilter.TF_NEAREST)
        EAL.save_loaded_asset(tex)
    return tex


def run():
    mpc = ensure_mpc()
    tex = bone_default()
    full = DIR + "/M_Walker"
    mat = matlib.load(full)
    if mat is None:
        mat = AT.create_asset("M_Walker", DIR, unreal.Material, unreal.MaterialFactoryNew())
    MEL.delete_all_material_expressions(mat)
    mat.set_editor_property("material_domain", unreal.MaterialDomain.MD_SURFACE)
    mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_DEFAULT_LIT)
    mat.set_editor_property("two_sided", False)
    mat.set_editor_property("tangent_space_normal", False)
    mat.set_editor_property("opacity_mask_clip_value", 0.5)
    mat.set_editor_property("max_world_position_offset_displacement", 150.0)

    bones = ("texture", "BoneTex", tex, False, False)
    uva, uvb = ("uv", 0), ("uv", 1)
    row, fade = ("pic", 0, 0.0), ("pic", 1, 1.0)
    vcol = ("vcolor",)
    rest_vs = ("node", "PreSkinnedPosition", {})
    normal_vs = ("node", "PreSkinnedNormal", {})
    cache = {}

    def expr(cls, x, y):
        return MEL.create_material_expression(mat, cls, x, y)

    def link(a, b, pin="", out=""):
        if not MEL.connect_material_expressions(a, out, b, pin):
            raise RuntimeError("could not connect %s -> %s.%s" % (a.get_name(), b.get_name(), pin))

    # ---- vertex: position -------------------------------------------------------------------------
    wpo_inputs = [("Tex", bones), ("UVa", uva), ("UVb", uvb), ("VCol", vcol), ("Row", row), ("Rest", rest_vs)]
    now = custom_node(mat, "WalkerOffset", "return NycWalkerOffset(Tex, UVa, UVb, VCol, Row, 0, Rest);",
                      wpo_inputs, [], INC, -700, 1100, mpc, 3, cache)
    before = custom_node(mat, "WalkerOffsetPrevious", "return NycWalkerOffset(Tex, UVa, UVb, VCol, Row, NYCW_PREV, Rest);",
                         wpo_inputs, [], INC, -700, 1500, mpc, 3, cache)
    switch = expr(unreal.MaterialExpressionPreviousFrameSwitch, -350, 1250)
    link(now, switch, "Current Frame")
    link(before, switch, "Previous Frame")
    to_world = expr(unreal.MaterialExpressionTransform, -150, 1250)
    to_world.set_editor_property("transform_source_type", unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_INSTANCE)
    to_world.set_editor_property("transform_type", unreal.MaterialVectorCoordTransform.TRANSFORM_WORLD)
    link(switch, to_world)
    if not MEL.connect_material_property(to_world, "", unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET):
        raise RuntimeError("WPO")

    # ---- vertex: normal ---------------------------------------------------------------------------
    nrm = custom_node(mat, "WalkerNormal", "return NycWalkerNormal(Tex, UVa, UVb, Row, N);",
                      [("Tex", bones), ("UVa", uva), ("UVb", uvb), ("Row", row), ("N", normal_vs)], [], INC, -700, 700, mpc, 3, cache)
    nrm_world = expr(unreal.MaterialExpressionTransform, -400, 700)
    nrm_world.set_editor_property("transform_source_type", unreal.MaterialVectorCoordTransformSource.TRANSFORMSOURCE_INSTANCE)
    nrm_world.set_editor_property("transform_type", unreal.MaterialVectorCoordTransform.TRANSFORM_WORLD)
    link(nrm, nrm_world)
    nrm_interp = expr(unreal.MaterialExpressionVertexInterpolator, -250, 700)
    link(nrm_world, nrm_interp)

    # ---- pixel ------------------------------------------------------------------------------------
    code = ("return NycWalkerShade(Tex, Row, UVa, VCol, Rest, RestN, SkinN, WP, CamPos, Wetness, Rain, SnowFall, Night, "
            "Roughness, Normal, Specular, Metallic, Emissive, AO);")
    shade_inputs = [("Tex", bones), ("Row", row), ("UVa", uva), ("VCol", vcol),
                    ("Rest", ("vinterp", "PreSkinnedPosition")), ("RestN", ("vinterp", "PreSkinnedNormal")),
                    ("SkinN", ("node", "VertexNormalWS", {})), ("WP", ("node", "WorldPosition", {})),
                    ("CamPos", ("node", "CameraPositionWS", {})), ("Wetness", ("collection", "Wetness")),
                    ("Rain", ("collection", "Rain")), ("SnowFall", ("collection", "SnowFall")), ("Night", ("collection", "Night"))]
    shade = custom_node(mat, "WalkerShade", code, shade_inputs,
                        [("Roughness", 1), ("Normal", 3), ("Specular", 1), ("Metallic", 1), ("Emissive", 3), ("AO", 1)],
                        INC, -100, 0, mpc, 3, cache)
    link(nrm_interp, shade, "SkinN")
    for prop, out in ((unreal.MaterialProperty.MP_BASE_COLOR, ""), (unreal.MaterialProperty.MP_ROUGHNESS, "Roughness"),
                      (unreal.MaterialProperty.MP_NORMAL, "Normal"), (unreal.MaterialProperty.MP_SPECULAR, "Specular"),
                      (unreal.MaterialProperty.MP_METALLIC, "Metallic"), (unreal.MaterialProperty.MP_EMISSIVE_COLOR, "Emissive"),
                      (unreal.MaterialProperty.MP_AMBIENT_OCCLUSION, "AO")):
        if not MEL.connect_material_property(shade, out, prop):
            raise RuntimeError("could not connect %s" % out)
    mask = custom_node(mat, "WalkerFade",
                       "return NycWalkerFade(Fade, Parameters.SvPosition.xy, (float)View.StateFrameIndexMod8);",
                       [("Fade", fade)], [], INC, -100, 450, mpc, 1, cache)
    if not MEL.connect_material_property(mask, "", unreal.MaterialProperty.MP_OPACITY_MASK):
        raise RuntimeError("opacity mask")

    MEL.set_base_material_usage(mat, unreal.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES) if hasattr(MEL, "set_base_material_usage") \
        else MEL.set_material_usage(mat, unreal.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    unreal.NYCBuilderLibrary.finish_all_compilation()
    s = MEL.get_statistics(mat)
    ps = s.get_editor_property("num_pixel_shader_instructions")
    vs = s.get_editor_property("num_vertex_shader_instructions")
    print("M_Walker: pixel %d, vertex %d instructions" % (ps, vs))
    if ps == 0:
        raise RuntimeError("M_Walker failed to compile: see the editor log")
