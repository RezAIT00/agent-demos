"""Prints shader instruction counts for every master material; zero means it failed to compile."""
import unreal
unreal.NYCBuilderLibrary.finish_all_compilation()
bad = []
for path in unreal.EditorAssetLibrary.list_assets("/Game/NYC/Materials", recursive=True):
    a = unreal.load_asset(path.split(".")[0])
    if isinstance(a, unreal.Material):
        s = unreal.MaterialEditingLibrary.get_statistics(a)
        ps = s.get_editor_property("num_pixel_shader_instructions")
        vs = s.get_editor_property("num_vertex_shader_instructions")
        print("%-28s ps=%5d vs=%5d tex=%d" % (a.get_name(), ps, vs, s.get_editor_property("num_pixel_texture_samples")))
        if ps == 0:
            bad.append(a.get_name())
print("FAILED:", bad)
