"""Level Sequence helpers (editor side)."""
import unreal

AT = unreal.AssetToolsHelpers.get_asset_tools()
EAL = unreal.EditorAssetLibrary
EXT = unreal.MovieSceneSequenceExtensions


def fresh_sequence(path, frames, fps=24):
    """Returns an empty sequence asset at `path` (reusing it if it already exists)."""
    folder, name = path.rsplit("/", 1)
    seq = unreal.load_asset(path) if EAL.does_asset_exist(path) else None
    if seq is None:
        seq = AT.create_asset(name, folder, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    else:
        for t in list(seq.get_tracks()):
            seq.remove_track(t)
        for b in list(seq.get_bindings()):
            b.remove()
    seq.set_display_rate(unreal.FrameRate(fps, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(frames)
    return seq


def _key_channels(channels, keys, interp):
    """keys: list of (frame, [values...])."""
    for frame, vals in keys:
        for ch, val in zip(channels, vals):
            ch.add_key(unreal.FrameNumber(int(frame)), float(val), 0.0, unreal.MovieSceneTimeUnit.DISPLAY_RATE, interp)


def add_transform_keys(binding, frames, keys, interp=unreal.MovieSceneKeyInterpolation.LINEAR):
    """keys: list of (frame, (x_cm, y_cm, z_cm, roll, pitch, yaw))."""
    track = binding.add_track(unreal.MovieScene3DTransformTrack)
    sec = track.add_section()
    sec.set_range(0, frames)
    ch = sec.get_all_channels()[:6]
    _key_channels(ch, keys, interp)
    return track


def add_float(binding, prop, frames, keys, interp=unreal.MovieSceneKeyInterpolation.LINEAR):
    """keys: list of (frame, value) for a float UPROPERTY."""
    track = binding.add_track(unreal.MovieSceneFloatTrack)
    track.set_property_name_and_path(prop.split(".")[-1], prop)
    sec = track.add_section()
    sec.set_range(0, frames)
    _key_channels(sec.get_all_channels()[:1], [(f, [v]) for f, v in keys], interp)
    return track


def add_camera(seq, frames, xf_keys, focal, aperture=8.0, focus_cm=None, sensor=(36.0, 20.25), start=0):
    """A spawnable cine camera with its own cut section.  Lens and focus are fixed per camera
    (each shot has its own); movement comes from per-frame transform keys."""
    cam = seq.add_spawnable_from_class(unreal.CineCameraActor)
    add_transform_keys(cam, seq.get_playback_end(), xf_keys)
    tmpl = cam.get_object_template()
    cc = tmpl.get_editor_property("camera_component")
    fb = cc.get_editor_property("filmback")
    fb.set_editor_property("sensor_width", sensor[0])
    fb.set_editor_property("sensor_height", sensor[1])
    cc.set_editor_property("filmback", fb)
    ls = cc.get_editor_property("lens_settings")
    ls.set_editor_property("min_focal_length", 4.0)
    ls.set_editor_property("max_focal_length", 1000.0)
    ls.set_editor_property("min_f_stop", 0.7)
    ls.set_editor_property("max_f_stop", 32.0)
    cc.set_editor_property("lens_settings", ls)
    cc.set_editor_property("current_focal_length", float(focal))
    cc.set_editor_property("current_aperture", float(aperture))
    fs = cc.get_editor_property("focus_settings")
    if focus_cm:
        fs.set_editor_property("focus_method", unreal.CameraFocusMethod.MANUAL)
        fs.set_editor_property("manual_focus_distance", float(focus_cm))
    else:
        fs.set_editor_property("focus_method", unreal.CameraFocusMethod.DISABLE)
    cc.set_editor_property("focus_settings", fs)

    tracks = seq.find_tracks_by_type(unreal.MovieSceneCameraCutTrack)
    cut = tracks[0] if tracks else seq.add_track(unreal.MovieSceneCameraCutTrack)
    cs = cut.add_section()
    cs.set_range(start, start + frames)
    cs.set_camera_binding_id(EXT.get_binding_id(seq, cam))
    return cam
