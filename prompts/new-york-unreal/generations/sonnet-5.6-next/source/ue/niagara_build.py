"""Builds the project's Niagara systems from an empty emitter, module by module, through the engine's
own NiagaraToolsets plugin (needed only while this runs; the saved assets do not depend on it).

Every system takes its look and motion from user parameters, so one asset serves many effects:
  Count / Rate, LifeMin, LifeMax, SpeedMin, SpeedMax, Axis, Spread (cone half angle, deg),
  SpawnRadius, Gravity, Drag, SizeMin, SizeMax, Tint
"""
import json

import unreal

R = unreal.ToolsetRegistry
SYS = "NiagaraToolsets.NiagaraToolset_System"
DIR = "/Game/NYC/FX"
M = "/Niagara/Modules/"


def call(tool, quiet=False, **kw):
    res = R.execute_tool(SYS, tool, json.dumps(kw))
    v = res.get_editor_property("value")
    try:
        err = res.get_editor_property("error")
    except Exception:
        err = None
    if err and not quiet:
        raise RuntimeError("%s: %s" % (tool, str(err)[:600]))
    return v


class Sys:
    def __init__(self, name):
        full = "%s/%s" % (DIR, name)
        if unreal.EditorAssetLibrary.does_asset_exist(full):
            unreal.EditorAssetLibrary.delete_asset(full)
        call("CreateNiagaraSystem", assetName=name, assetPath=DIR,
             templateSystem={"refPath": "/Niagara/DefaultAssets/DefaultSystem.DefaultSystem"})
        self.name = name
        self.ref = {"refPath": "%s.%s" % (full, name)}
        call("RemoveEmitter", emitterToRemove=self.at(emitter="Fountain"), quiet=True)
        call("AddEmitter", system=self.ref, templateEmitter={"refPath": "/Niagara/DefaultAssets/Templates/Emitters/Minimal.Minimal"}, emitterName="E")

    def at(self, script="", module="", inputs=(), renderer=-1, emitter="E"):
        return {"system": self.ref, "emitterName": emitter, "scriptName": script, "moduleName": module, "rendererIndex": renderer,
                "inputNameStack": list(inputs)}

    def add(self, script, asset):
        call("AddModule", moduleLocationRef=self.at(script), moduleAsset={"refPath": M + asset + "." + asset.split("/")[-1]})

    def enum(self, script, module, name, index):
        cur = json.loads(call("GetStackInputData", stackInputRef=self.at(script, module, [name])))["returnValue"]
        e = cur["value"]["enum"]
        call("SetStackInputData", stackInputRef=self.at(script, module, [name]), inputData={
            "struct": {"refPath": "/Script/NiagaraEditor.NiagaraExt_StackInputData_Enum"},
            "value": {"enum": e, "enumName": "%s::NewEnumerator%d" % (e["refPath"].split(".")[-1], index), "displayName": ""}})

    def link(self, script, module, name, param, kind):
        call("SetStackInputData", stackInputRef=self.at(script, module, [name]), inputData={
            "struct": {"refPath": "/Script/NiagaraEditor.NiagaraExt_StackInputData_Linked"},
            "value": {"linkedVariable": {"name": "User." + param, "type": {"classStructOrEnum": {"refPath": TYPES[kind][0]}}}}})

    def hlsl(self, script, module, name, expression):
        call("SetStackInputData", stackInputRef=self.at(script, module, [name]), inputData={
            "struct": {"refPath": "/Script/NiagaraEditor.NiagaraExt_StackInputData_HlslExpression"},
            "value": {"hlslExpression": expression}})

    def value(self, script, module, name, struct, value):
        call("SetStackInputData", stackInputRef=self.at(script, module, [name]),
             inputData={"struct": {"refPath": struct}, "value": value})

    def users(self, items):
        out = []
        for name, kind, default in items:
            struct, wrap = TYPES[kind]
            out.append({"name": "User." + name, "type": {"classStructOrEnum": {"refPath": struct}},
                        "defaultValue": {"struct": {"refPath": struct}, "value": wrap(default)}})
        call("AddUserVariables", system=self.ref, variablesToAdd=out)

    def renderer_data(self, index=0):
        return json.loads(call("GetRendererData", rendererRef=self.at(renderer=index)))["returnValue"]

    def set_renderer(self, props, index=0):
        data = self.renderer_data(index)
        current = json.loads(data["propertyValues"]) if isinstance(data.get("propertyValues"), str) else data.get("propertyValues", {})
        merged = dict(current)
        merged.update(props)
        data["propertyValues"] = json.dumps(merged) if isinstance(data.get("propertyValues"), str) else merged
        call("SetRendererData", renderer=self.at(renderer=index), rendererData=data)


TYPES = {
    "float": ("/Script/Niagara.NiagaraFloat", lambda v: {"value": v}),
    "int": ("/Script/Niagara.NiagaraInt32", lambda v: {"value": v}),
    "vec": ("/Script/CoreUObject.Vector3f", lambda v: {"x": v[0], "y": v[1], "z": v[2]}),
    "color": ("/Script/CoreUObject.LinearColor", lambda v: {"r": v[0], "g": v[1], "b": v[2], "a": v[3]}),
}

COMMON = [("LifeMin", "float", 0.6), ("LifeMax", "float", 1.4), ("SpeedMin", "float", 200.0), ("SpeedMax", "float", 900.0),
          ("Axis", "vec", (0.0, 0.0, 1.0)), ("Spread", "float", 60.0), ("SpawnRadius", "float", 10.0),
          ("Gravity", "vec", (0.0, 0.0, -981.0)), ("Drag", "float", 0.4), ("SizeMin", "float", 2.0), ("SizeMax", "float", 6.0),
          ("Tint", "color", (1.0, 1.0, 1.0, 1.0))]


def build(name, material, stream=False, mesh=None, stretch=0.0, curl=0.0, grow=0.0, fade="saturate((1.0 - Particles.NormalizedAge) * 2.6)"):
    s = Sys(name)
    s.users(COMMON + ([("Rate", "float", 200.0)] if stream else [("Count", "int", 100)]))
    s.enum("EmitterUpdateScript", "EmitterState", "Life Cycle Mode", 1)
    if stream:
        s.add("EmitterUpdateScript", "Emitter/SpawnRate")
        s.link("EmitterUpdateScript", "SpawnRate", "SpawnRate", "Rate", "float")
    else:
        s.enum("EmitterUpdateScript", "EmitterState", "Loop Behavior", 1)
        s.add("EmitterUpdateScript", "Emitter/SpawnBurst_Instantaneous")
        s.link("EmitterUpdateScript", "SpawnBurst_Instantaneous", "Spawn Count", "Count", "int")
    sp = "ParticleSpawnScript"
    up = "ParticleUpdateScript"
    s.add(sp, "Spawn/Location/V2/ShapeLocation")
    s.add(sp, "Spawn/Velocity/AddVelocity")
    s.enum(sp, "InitializeParticle", "Lifetime Mode", 1)
    s.enum(sp, "InitializeParticle", "Color Mode", 1)
    s.link(sp, "InitializeParticle", "Lifetime Min", "LifeMin", "float")
    s.link(sp, "InitializeParticle", "Lifetime Max", "LifeMax", "float")
    s.link(sp, "InitializeParticle", "Color", "Tint", "color")
    if mesh:
        s.enum(sp, "InitializeParticle", "Mesh Scale Mode", 1)
        s.hlsl(sp, "InitializeParticle", "Mesh Uniform Scale Min", "User.SizeMin")
        s.hlsl(sp, "InitializeParticle", "Mesh Uniform Scale Max", "User.SizeMax")
    else:
        s.enum(sp, "InitializeParticle", "Sprite Size Mode", 1)
        s.link(sp, "InitializeParticle", "Uniform Sprite Size Min", "SizeMin", "float")
        s.link(sp, "InitializeParticle", "Uniform Sprite Size Max", "SizeMax", "float")
        s.enum(sp, "InitializeParticle", "Sprite Rotation Mode", 2)
    s.link(sp, "ShapeLocation", "Sphere Radius", "SpawnRadius", "float")
    s.enum(sp, "AddVelocity", "Velocity Mode", 2)
    s.link(sp, "AddVelocity", "Cone Axis", "Axis", "vec")
    s.link(sp, "AddVelocity", "Cone Angle", "Spread", "float")
    s.hlsl(sp, "AddVelocity", "Velocity Speed", "lerp(User.SpeedMin, User.SpeedMax, rand(1.0))")
    if mesh:
        s.add(sp, "Spawn/Orientation/V2/InitialMeshOrientation")
    s.add(up, "Update/Forces/GravityForce")
    s.link(up, "GravityForce", "Gravity", "Gravity", "vec")
    s.add(up, "Update/Forces/Drag")
    s.link(up, "Drag", "Drag", "Drag", "float")
    if curl > 0:
        s.add(up, "Update/Forces/CurlNoiseForce")
        s.value(up, "CurlNoiseForce", "Noise Strength", "/Script/Niagara.NiagaraFloat", {"value": curl})
    s.add(up, "Update/Color/ScaleColor")
    s.hlsl(up, "ScaleColor", "Scale Alpha", fade)
    if grow > 0:
        s.add(up, "Update/Size/ScaleSpriteSize")
        s.enum(up, "ScaleSpriteSize", "Scale Sprite Size Mode", 0)
        s.hlsl(up, "ScaleSpriteSize", "Uniform Scale Factor", "lerp(1.0, %f, 1.0 - pow(1.0 - Particles.NormalizedAge, 2.0))" % grow)
    s.add(up, "Solvers/SolveForcesAndVelocity")
    return s, material, mesh, stretch


def finish(s, material, mesh, stretch):
    if mesh:
        # swap the sprite renderer for a mesh renderer
        call("AddRenderer", newRendererLocation=s.at(), rendererClass={"refPath": "/Script/Niagara.NiagaraMeshRendererProperties"})
        call("RemoveRenderer", rendererToRemove=s.at(renderer=0))
        s.set_renderer({"Meshes": [{"Mesh": {"refPath": mesh}}], "bOverrideMaterials": True,
                        "OverrideMaterials": [{"ExplicitMat": {"refPath": material}}]})
    else:
        props = {"Material": {"refPath": material}}
        if stretch > 0:
            props["Alignment"] = "VelocityAligned"
        s.set_renderer(props)
    asset = unreal.load_asset(s.ref["refPath"])
    unreal.EditorAssetLibrary.save_loaded_asset(asset)


def mat(name):
    return "/Game/NYC/Materials/%s.%s" % (name, name)


def mesh_ref(name):
    return "/Game/NYC/Meshes/%s.%s" % (name, name)


SPECS = {
    # sparks and glowing grit: stretched along their flight
    "NS_Sparks": dict(material=mat("M_NSpark"), stretch=1.0),
    "NS_SparkStream": dict(material=mat("M_NSpark"), stream=True, stretch=1.0),
    # embers drifting up out of fires
    "NS_Embers": dict(material=mat("M_NEmber"), curl=260.0),
    # soft dust and smoke billows that grow as they age
    "NS_Dust": dict(material=mat("M_NDust"), grow=3.2, curl=60.0, fade="saturate(Particles.NormalizedAge * 9.0) * pow(saturate(1.0 - Particles.NormalizedAge), 1.3)"),
    "NS_SmokeStream": dict(material=mat("M_NDust"), stream=True, grow=3.6, curl=110.0, fade="saturate(Particles.NormalizedAge * 7.0) * saturate(1.0 - Particles.NormalizedAge)"),
    "NS_FlameStream": dict(material=mat("M_NFlame"), stream=True, grow=0.35, curl=170.0, fade="saturate((1.0 - Particles.NormalizedAge) * 2.0)"),
    # the ring of grit a pressure front throws up along the ground
    "NS_ShockRing": dict(material=mat("M_NDust"), grow=2.6, fade="saturate(Particles.NormalizedAge * 12.0) * pow(saturate(1.0 - Particles.NormalizedAge), 1.6)"),
    # water: spray in a burst or a jet
    "NS_Water": dict(material=mat("M_NWater"), stretch=1.0),
    "NS_WaterJet": dict(material=mat("M_NWater"), stream=True, stretch=1.0),
    # solid bits: masonry crumbs, glass, splinters, paper, ice
    "NS_Chips": dict(material=mat("M_NChip"), mesh=mesh_ref("fx_chip"), fade="1.0"),
    "NS_Glass": dict(material=mat("M_NGlass"), mesh=mesh_ref("fx_shard"), fade="1.0"),
    "NS_Splinters": dict(material=mat("M_NChip"), mesh=mesh_ref("fx_splinter"), fade="1.0"),
    "NS_Paper": dict(material=mat("M_NChip"), mesh=mesh_ref("fx_paper"), curl=420.0, fade="1.0"),
    # points of light for energy weapons and magic-looking science
    "NS_Motes": dict(material=mat("M_NEmber"), curl=380.0),
}


def run(only=()):
    unreal.EditorAssetLibrary.make_directory(DIR)
    done, failed = [], []
    for name, spec in SPECS.items():
        if only and name not in only:
            continue
        try:
            s, material, mesh, stretch = build(name, **spec)
            finish(s, material, mesh, stretch)
            done.append(name)
        except Exception as e:      # report and go on: one bad system should not lose the others
            failed.append((name, str(e)[:900]))
    print("niagara built:", done)
    for f in failed:
        print("niagara FAILED:", f[0], f[1])
