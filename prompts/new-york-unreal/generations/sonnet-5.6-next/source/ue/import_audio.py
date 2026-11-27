"""Imports the synthesized destruction sounds (build/audio/destruction/*.wav) as SoundWave assets in
/Game/NYC/Audio, where the running game looks them up by name.  Editor side."""
import glob
import os

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
DEST = "/Game/NYC/Audio"


def run():
    files = sorted(glob.glob(os.path.join(ROOT, "build", "audio", "destruction", "*.wav")))
    if not files:
        raise RuntimeError("no sounds: run source/sound/destruct_sounds.py first")
    tasks = []
    for path in files:
        t = unreal.AssetImportTask()
        t.set_editor_property("filename", path)
        t.set_editor_property("destination_path", DEST)
        t.set_editor_property("destination_name", os.path.splitext(os.path.basename(path))[0])
        t.set_editor_property("automated", True)
        t.set_editor_property("replace_existing", True)
        t.set_editor_property("save", True)
        tasks.append(t)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    done = sum(1 for p in files if unreal.EditorAssetLibrary.does_asset_exist("%s/%s" % (DEST, os.path.splitext(os.path.basename(p))[0])))
    print("sounds imported: %d of %d" % (done, len(files)))
