"""Editor-side helpers: build materials whose logic lives in HLSL (NYC/Shaders/*.ush).

A material is described as a dict of Custom-node inputs plus named outputs; `build()` wires it.
"""
import unreal

MEL = unreal.MaterialEditingLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
EAL = unreal.EditorAssetLibrary

MAT_DIR = "/Game/NYC/Materials"
TEX_DIR = "/Game/NYC/Textures"
MPC_PATH = MAT_DIR + "/MPC_Weather"

OUT_TYPES = {1: unreal.CustomMaterialOutputType.CMOT_FLOAT1, 2: unreal.CustomMaterialOutputType.CMOT_FLOAT2,
             3: unreal.CustomMaterialOutputType.CMOT_FLOAT3, 4: unreal.CustomMaterialOutputType.CMOT_FLOAT4}
PROP = {
    "BaseColor": unreal.MaterialProperty.MP_BASE_COLOR,
    "Metallic": unreal.MaterialProperty.MP_METALLIC,
    "Specular": unreal.MaterialProperty.MP_SPECULAR,
    "Roughness": unreal.MaterialProperty.MP_ROUGHNESS,
    "Emissive": unreal.MaterialProperty.MP_EMISSIVE_COLOR,
    "Normal": unreal.MaterialProperty.MP_NORMAL,
    "WPO": unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET,
    "Opacity": unreal.MaterialProperty.MP_OPACITY,
    "OpacityMask": unreal.MaterialProperty.MP_OPACITY_MASK,
    "AO": unreal.MaterialProperty.MP_AMBIENT_OCCLUSION,
    "Extinction": unreal.MaterialProperty.MP_SUBSURFACE_COLOR,

}


def load(path):
    return EAL.load_asset(path) if EAL.does_asset_exist(path) else None


# --------------------------------------------------------------------- parameter collection
SCALARS = {
    # weather state written by ANYCWeatherController every frame
    "Wetness": 0.0, "Puddles": 0.0, "Rain": 0.0, "Snow": 0.0, "SnowFall": 0.0, "Wind": 0.2,
    "SimTime": 0.0, "Night": 0.0, "LitOffice": 0.25, "LitHome": 0.15, "LitShop": 0.85,
    "InteriorDay": 220.0, "CityGlow": 0.0, "Flash": 0.0, "CloudCover": 0.3, "Fog": 0.0,
    "Holiday": 1.0, "NearRain": 1.0, "SunLux": 100000.0, "SkyNits": 4000.0, "StreetLights": 0.0,
}
VECTORS = {
    "WindDir": (1.0, 0.3, 0.0, 0.0),
    "SunDir": (0.0, 0.0, 1.0, 0.0),
    "SunColor": (1.0, 0.95, 0.9, 1.0),
    "SkyColor": (0.4, 0.55, 0.8, 1.0),
    "FogColor": (0.5, 0.55, 0.6, 1.0),
    "FlashPos": (0.0, 0.0, 40000.0, 0.0),
    "CarvePos": (0.0, 0.0, 0.0, 0.0),
    # nearest city lights for precipitation lighting: xyz + intensity, colour + cone
}
NUM_FX_LIGHTS = 16
for _i in range(NUM_FX_LIGHTS):
    VECTORS["FxPos%d" % _i] = (0.0, 0.0, -1.0e7, 0.0)
    VECTORS["FxCol%d" % _i] = (0.0, 0.0, 0.0, 0.0)
    VECTORS["FxDir%d" % _i] = (0.0, 0.0, -1.0, -1.0)


def ensure_mpc():
    mpc = load(MPC_PATH)
    if mpc is None:
        mpc = AT.create_asset("MPC_Weather", MAT_DIR, unreal.MaterialParameterCollection,
                              unreal.MaterialParameterCollectionFactoryNew())
    have_s = {str(p.get_editor_property("parameter_name")) for p in mpc.get_editor_property("scalar_parameters")}
    have_v = {str(p.get_editor_property("parameter_name")) for p in mpc.get_editor_property("vector_parameters")}
    if have_s == set(SCALARS) and have_v == set(VECTORS):
        return mpc
    sc = []
    for n, d in SCALARS.items():
        p = unreal.CollectionScalarParameter()
        p.set_editor_property("parameter_name", n)
        p.set_editor_property("default_value", d)
        sc.append(p)
    vc = []
    for n, d in VECTORS.items():
        p = unreal.CollectionVectorParameter()
        p.set_editor_property("parameter_name", n)
        p.set_editor_property("default_value", unreal.LinearColor(*d))
        vc.append(p)
    mpc.set_editor_property("scalar_parameters", sc)
    mpc.set_editor_property("vector_parameters", vc)
    EAL.save_loaded_asset(mpc)
    return mpc


# --------------------------------------------------------------------- input descriptors
def S(name, default):
    return ("scalar", name, float(default))


def V(name, default):
    d = tuple(default) + (1.0,) * (4 - len(default))
    return ("vector", name, d)


def T(name, tex, normal=False, srgb=True):
    return ("texture", name, tex, normal, srgb)


def C(name):
    return ("collection", name)


def CV(name):
    return ("collectionv", name)


def PIC(index, default=0.0):
    return ("pic", index, default)


def CPD(name, index, default=0.0):
    return ("cpd", name, index, default)


def N(expr_name, **props):
    return ("node", expr_name, props)


WPOS = ("node", "WorldPosition", {})
VCOLOR = ("vcolor",)
UV0 = ("uv", 0)
UV1 = ("uv", 1)
VNORMAL = ("node", "VertexNormalWS", {})
CAMPOS = ("node", "CameraPositionWS", {})
OBJPOS = ("node", "ObjectPositionWS", {})
RANDOM = ("node", "PerInstanceRandom", {})
PIXDEPTH = ("node", "PixelDepth", {})
SCENEDEPTH = ("node", "SceneDepth", {})


def _make_input(mat, spec, x, y, mpc):
    kind = spec[0]
    if kind == "node":
        e = MEL.create_material_expression(mat, getattr(unreal, "MaterialExpression" + spec[1]), x, y)
        for k, val in spec[2].items():
            e.set_editor_property(k, val)
        return e, ""
    if kind == "vinterp":
        # a vertex-stage value carried to the pixel shader
        src = MEL.create_material_expression(mat, getattr(unreal, "MaterialExpression" + spec[1]), x - 200, y)
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionVertexInterpolator, x, y)
        MEL.connect_material_expressions(src, "", e, "")
        return e, ""
    if kind == "scalar":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, x, y)
        e.set_editor_property("parameter_name", spec[1])
        e.set_editor_property("default_value", spec[2])
        return e, ""
    if kind == "cpd":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, x, y)
        e.set_editor_property("parameter_name", spec[1])
        e.set_editor_property("default_value", spec[3])
        e.set_editor_property("use_custom_primitive_data", True)
        e.set_editor_property("primitive_data_index", spec[2])
        return e, ""
    if kind == "vector":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, x, y)
        e.set_editor_property("parameter_name", spec[1])
        e.set_editor_property("default_value", unreal.LinearColor(*spec[2]))
        return e, ""
    if kind == "texture":
        _, pname, tex, is_normal, srgb = spec
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureObjectParameter, x, y)
        e.set_editor_property("parameter_name", pname)
        if isinstance(tex, str):
            tex = unreal.load_asset(tex if tex.startswith("/") else TEX_DIR + "/" + tex)
        e.set_editor_property("texture", tex)
        if isinstance(tex, unreal.VolumeTexture):
            e.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
        elif is_normal:
            e.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        elif tex.get_editor_property("compression_settings") == unreal.TextureCompressionSettings.TC_GRAYSCALE:
            e.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_GRAYSCALE)
        elif not tex.get_editor_property("srgb"):
            e.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
        else:
            e.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_COLOR)
        return e, ""
    if kind in ("collection", "collectionv"):
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionCollectionParameter, x, y)
        e.set_editor_property("collection", mpc)
        e.set_editor_property("parameter_name", spec[1])
        return e, ""
    if kind == "pic":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionPerInstanceCustomData, x, y)
        e.set_editor_property("data_index", spec[1])
        e.set_editor_property("const_default_value", spec[2])
        return e, ""
    if kind in ("debriswp", "debrisvn"):
        # debris carries its rest pose in UV2 and UV3, so textures stay put on tumbling pieces
        u2 = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate, x - 420, y)
        u2.set_editor_property("coordinate_index", 2)
        u3 = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate, x - 420, y + 60)
        u3.set_editor_property("coordinate_index", 3)
        node = MEL.create_material_expression(mat, unreal.MaterialExpressionCustom, x, y)
        node.set_editor_property("output_type", OUT_TYPES[3])
        names = ["U2", "U3"] + (["OX", "OY", "OZ"] if kind == "debriswp" else [])
        ins = []
        for nm in names:
            ci = unreal.CustomInput()
            ci.set_editor_property("input_name", nm)
            ins.append(ci)
        node.set_editor_property("inputs", ins)
        if kind == "debriswp":
            node.set_editor_property("code", "return float3(U2.x, U2.y, U3.x) * 100.0 + float3(OX, OY, OZ);")
        else:
            node.set_editor_property("code", "int c = (int)(U3.y + 0.5);\n"
                                     "if (c == 0) return float3(1, 0, 0);\nif (c == 1) return float3(-1, 0, 0);\n"
                                     "if (c == 2) return float3(0, 1, 0);\nif (c == 3) return float3(0, -1, 0);\n"
                                     "if (c == 5) return float3(0, 0, -1);\nreturn float3(0, 0, 1);")
        MEL.connect_material_expressions(u2, "", node, "U2")
        MEL.connect_material_expressions(u3, "", node, "U3")
        if kind == "debriswp":
            for k, nm in enumerate(("OX", "OY", "OZ")):
                pr = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, x - 420, y + 130 + 50 * k)
                pr.set_editor_property("parameter_name", "Rest" + nm)
                pr.set_editor_property("default_value", 0.0)
                pr.set_editor_property("use_custom_primitive_data", True)
                pr.set_editor_property("primitive_data_index", 4 + k)
                MEL.connect_material_expressions(pr, "", node, nm)
        return node, ""
    if kind == "pcolor":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionParticleColor, x, y)
        a = MEL.create_material_expression(mat, unreal.MaterialExpressionAppendVector, x + 150, y)
        MEL.connect_material_expressions(e, "", a, "A")
        MEL.connect_material_expressions(e, "A", a, "B")
        return a, ""
    if kind == "vcolor":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionVertexColor, x, y)
        # RGBA as a float4
        a = MEL.create_material_expression(mat, unreal.MaterialExpressionAppendVector, x + 150, y)
        MEL.connect_material_expressions(e, "", a, "A")
        MEL.connect_material_expressions(e, "A", a, "B")
        return a, ""
    if kind == "uv":
        e = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate, x, y)
        e.set_editor_property("coordinate_index", spec[1])
        return e, ""
    raise ValueError(kind)


def custom_node(mat, name, code, inputs, outputs, include, x, y, mpc, main_type=3, cache=None, defines=None):
    """inputs: list of (hlsl_name, spec). outputs: list of (name, components) additional outputs."""
    node = MEL.create_material_expression(mat, unreal.MaterialExpressionCustom, x, y)
    node.set_editor_property("description", name)
    node.set_editor_property("code", code)
    node.set_editor_property("include_file_paths", include)
    node.set_editor_property("output_type", OUT_TYPES[main_type])
    ins = []
    for hlsl, _ in inputs:
        ci = unreal.CustomInput()
        ci.set_editor_property("input_name", hlsl)
        ins.append(ci)
    node.set_editor_property("inputs", ins)
    outs = []
    for oname, comps in outputs:
        co = unreal.CustomOutput()
        co.set_editor_property("output_name", oname)
        co.set_editor_property("output_type", OUT_TYPES[comps])
        outs.append(co)
    node.set_editor_property("additional_outputs", outs)
    if defines:
        ds = []
        for k, val in defines.items():
            d = unreal.CustomDefine()
            d.set_editor_property("define_name", k)
            d.set_editor_property("define_value", str(val))
            ds.append(d)
        node.set_editor_property("additional_defines", ds)
    yy = y - 40 * len(inputs) // 2
    for hlsl, spec in inputs:
        key = repr(spec)
        if cache is not None and key in cache:
            e, out = cache[key]
        else:
            e, out = _make_input(mat, spec, x - 700, yy, mpc)
            if cache is not None:
                cache[key] = (e, out)
        if not MEL.connect_material_expressions(e, out, node, hlsl):
            raise RuntimeError("could not connect %s in %s" % (hlsl, name))
        yy += 60
    return node


def build(name, code, inputs, outputs, mapping, include=("/NYC/Common.ush",), blend="opaque", shading="default",
          two_sided=False, wpo=None, domain="surface", usage=("ism", "nanite"), props=None, defines=None, path=MAT_DIR):
    """Create or rebuild a material.

    code      : HLSL body; `return` gives the first output.
    outputs   : additional outputs [(name, comps)].
    mapping   : {material property: output name, or "" for the return value}.
    wpo       : optional dict(code=..., inputs=[...]) for a vertex-shader world position offset.
    """
    mpc = ensure_mpc()
    full = "%s/%s" % (path, name)
    mat = load(full)
    if mat is None:
        mat = AT.create_asset(name, path, unreal.Material, unreal.MaterialFactoryNew())
    MEL.delete_all_material_expressions(mat)
    mat.set_editor_property("material_domain", {
        "surface": unreal.MaterialDomain.MD_SURFACE, "volume": unreal.MaterialDomain.MD_VOLUME,
        "post": unreal.MaterialDomain.MD_POST_PROCESS, "light": unreal.MaterialDomain.MD_LIGHT_FUNCTION,
        "decal": unreal.MaterialDomain.MD_DEFERRED_DECAL}[domain])
    mat.set_editor_property("blend_mode", {
        "opaque": unreal.BlendMode.BLEND_OPAQUE, "masked": unreal.BlendMode.BLEND_MASKED,
        "translucent": unreal.BlendMode.BLEND_TRANSLUCENT, "additive": unreal.BlendMode.BLEND_ADDITIVE,
        "alphacomposite": unreal.BlendMode.BLEND_ALPHA_COMPOSITE}[blend])
    if domain == "surface":
        mat.set_editor_property("shading_model", {
            "default": unreal.MaterialShadingModel.MSM_DEFAULT_LIT, "unlit": unreal.MaterialShadingModel.MSM_UNLIT,
            "clearcoat": unreal.MaterialShadingModel.MSM_CLEAR_COAT,
            "foliage": unreal.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE}[shading])
    mat.set_editor_property("two_sided", two_sided)
    if "Normal" in mapping:
        mat.set_editor_property("tangent_space_normal", False)
    cache = {}
    main_type = 3
    node = custom_node(mat, name, code, inputs, outputs, list(include), -500, 0, mpc, main_type, cache, defines)
    sizes = dict(outputs)
    for prop, out in mapping.items():
        if not MEL.connect_material_property(node, out, PROP[prop]):
            raise RuntimeError("could not connect property %s of %s" % (prop, name))
    if wpo:
        wnode = custom_node(mat, name + "_wpo", wpo["code"], wpo["inputs"], wpo.get("outputs", []),
                            list(include), -500, 900, mpc, 3, None, defines)
        MEL.connect_material_property(wnode, "", PROP["WPO"])
    if usage:
        flags = {"ism": unreal.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES,
                 "nanite": unreal.MaterialUsage.MATUSAGE_NANITE,
                 "skel": unreal.MaterialUsage.MATUSAGE_SKELETAL_MESH,
                 "vcloud": unreal.MaterialUsage.MATUSAGE_VOLUMETRIC_CLOUD,
                 "geomcollection": unreal.MaterialUsage.MATUSAGE_GEOMETRY_COLLECTIONS,
                 "niagara_sprite": unreal.MaterialUsage.MATUSAGE_NIAGARA_SPRITES,
                 "niagara_mesh": unreal.MaterialUsage.MATUSAGE_NIAGARA_MESH_PARTICLES}
        for u in usage:
            try:
                MEL.set_base_material_usage(mat, flags[u])
            except Exception:
                MEL.set_material_usage(mat, flags[u])
    if props:
        for k, val in props.items():
            mat.set_editor_property(k, val)
    MEL.recompile_material(mat)
    EAL.save_loaded_asset(mat)
    return mat


def instance(name, parent, scalars=None, vectors=None, textures=None, path=MAT_DIR):
    full = "%s/%s" % (path, name)
    mi = load(full)
    if mi is None:
        mi = AT.create_asset(name, path, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    if isinstance(parent, str):
        parent = unreal.load_asset(parent if parent.startswith("/") else MAT_DIR + "/" + parent)
    MEL.set_material_instance_parent(mi, parent)
    MEL.clear_all_material_instance_parameters(mi)
    for k, val in (scalars or {}).items():
        MEL.set_material_instance_scalar_parameter_value(mi, k, float(val))
    for k, val in (vectors or {}).items():
        d = tuple(val) + (1.0,) * (4 - len(val))
        MEL.set_material_instance_vector_parameter_value(mi, k, unreal.LinearColor(*d))
    for k, val in (textures or {}).items():
        tex = unreal.load_asset(val if val.startswith("/") else TEX_DIR + "/" + val)
        MEL.set_material_instance_texture_parameter_value(mi, k, tex)
    MEL.update_material_instance(mi)
    EAL.save_loaded_asset(mi)
    return mi


# --------------------------------------------------------------------- textures
def import_textures(files, dest=TEX_DIR):
    """files: list of (png_path, asset_name, kind) with kind in color|linear|normal|gray|data."""
    tasks = []
    for png, name, kind in files:
        t = unreal.AssetImportTask()
        t.set_editor_property("filename", png)
        t.set_editor_property("destination_path", dest)
        t.set_editor_property("destination_name", name)
        t.set_editor_property("automated", True)
        t.set_editor_property("replace_existing", True)
        t.set_editor_property("save", False)
        tasks.append(t)
    AT.import_asset_tasks(tasks)
    CS = unreal.TextureCompressionSettings
    for png, name, kind in files:
        tex = unreal.load_asset("%s/%s" % (dest, name))
        if tex is None:
            print("texture import failed", name)
            continue
        if kind == "normal":
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("compression_settings", CS.TC_NORMALMAP)
        elif kind == "linear":
            tex.set_editor_property("compression_settings", CS.TC_BC7)
            tex.set_editor_property("srgb", False)
        elif kind == "gray":
            tex.set_editor_property("compression_settings", CS.TC_GRAYSCALE)
            tex.set_editor_property("srgb", False)
        elif kind == "data":
            tex.set_editor_property("compression_settings", CS.TC_HDR if False else CS.TC_VECTOR_DISPLACEMENTMAP)
            tex.set_editor_property("srgb", False)
        elif kind == "color_hq":
            tex.set_editor_property("compression_settings", CS.TC_BC7)
            tex.set_editor_property("srgb", True)
        else:
            tex.set_editor_property("compression_settings", CS.TC_DEFAULT)
            tex.set_editor_property("srgb", True)
        EAL.save_loaded_asset(tex)
