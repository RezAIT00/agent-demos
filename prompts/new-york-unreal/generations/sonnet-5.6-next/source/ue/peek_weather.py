import unreal
def run():
    import sys, os
    import shots
    shots.ensure_map()
    found = 0
    for a in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
        if "Weather" in a.get_class().get_name():
            found += 1
            unreal.log_warning("PEEK " + " ".join("%s=%s" % (p, a.get_editor_property(p)) for p in ("month", "day", "time_of_day", "exposure_bias", "cloud_cover", "fog_cutoff_km", "haze_scale")))
    unreal.log_warning("PEEK actors %d" % found)
