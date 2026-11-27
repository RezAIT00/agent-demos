"""Movie Render Queue driver (runs inside the dev-loop editor).

render(seq, out_dir, ...) starts an asynchronous PIE render; when it finishes a file
build/cmd/render.json is written with the result, which source/render_client.py waits for.
"""
import json
import os
import time

import unreal

ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
STATUS = os.path.join(ROOT, "build", "render_status.json")
MAP = "/Game/NYC/Maps/NYC_Midtown"

_keep = {}

# console variables used for every cinematic render
BASE_CVARS = {
    "r.MotionBlurQuality": 4,
    "r.DepthOfFieldQuality": 4,
    "r.BloomQuality": 5,
    "r.Tonemapper.Sharpen": 0.35,
    "r.ScreenPercentage": 100,
    # Lumen
    "r.Lumen.HardwareRayTracing": 1,
    "r.Lumen.HardwareRayTracing.LightingMode": 2,
    "r.Lumen.ScreenProbeGather.DownsampleFactor": 12,
    "r.Lumen.ScreenProbeGather.TracingOctahedronResolution": 10,
    "r.Lumen.ScreenProbeGather.RadianceCache.ProbeResolution": 32,
    "r.Lumen.Reflections.DownsampleFactor": 1,
    "r.Lumen.Reflections.MaxRoughnessToTrace": 0.55,
    "r.Lumen.TranslucencyReflections.FrontLayer.Enable": 1,
    "r.LumenScene.SurfaceCache.MeshCardsMinSize": 4,
    # MegaLights
    "r.MegaLights.Allowed": 1,
    "r.MegaLights.NumSamplesPerPixel": 4,
    "r.MegaLights.DownsampleMode": 0,
    # ray tracing scene
    "r.RayTracing.Culling": 3,
    "r.RayTracing.Culling.Radius": 90000,
    "r.RayTracing.Culling.Angle": 0.35,
    # shadows
    "r.Shadow.Virtual.ResolutionLodBiasDirectional": -0.5,
    "r.Shadow.Virtual.SMRT.RayCountDirectional": 12,
    "r.Shadow.Virtual.SMRT.SamplesPerRayDirectional": 6,
    "r.Shadow.Virtual.MaxPhysicalPages": 8192,
    # atmosphere, clouds, fog
    "r.SkyAtmosphere.AerialPerspectiveLUT.SampleCountMaxPerSlice": 4,
    "r.SkyAtmosphere.FastSkyLUT": 0,
    "r.VolumetricCloud.ViewRaySampleMaxCount": 768,
    "r.VolumetricCloud.ShadowMap": 1,
    "r.VolumetricRenderTarget.Mode": 3,
    "r.VolumetricFog.GridPixelSize": 6,
    "r.VolumetricFog.GridSizeZ": 160,
    "r.VolumetricFog.HistoryWeight": 0.92,
    "r.SkyLight.RealTimeReflectionCapture.TimeSlice": 0,
    "r.Streaming.PoolSize": 6000,
    "r.Nanite.MaxPixelsPerEdge": 1.0,
}


def _status(**kw):
    with open(STATUS + ".tmp", "w") as f:
        json.dump(kw, f)
    os.replace(STATUS + ".tmp", STATUS)


def render(jobs, res=(1920, 1080), tsamples=1, ssamples=1, warmup=32, engine_warmup=32, cvars=None, aa="tsr",
           shutter=180.0, fmt="png"):
    """jobs: list of dict(seq=asset path, out=directory, name=file prefix, start=None, end=None)."""
    sub = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    if sub.is_rendering():
        raise RuntimeError("a render is already running")
    queue = sub.get_queue()
    for j in list(queue.get_jobs()):
        queue.delete_job(j)
    allcv = dict(BASE_CVARS)
    allcv.update(cvars or {})
    for spec in jobs:
        job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
        job.set_editor_property("sequence", unreal.SoftObjectPath(spec["seq"]))
        job.set_editor_property("map", unreal.SoftObjectPath(spec.get("map", MAP)))
        job.set_editor_property("job_name", spec.get("name", "job"))
        cfg = job.get_configuration()
        cfg.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
        cfg.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG if fmt == "png"
                                         else unreal.MoviePipelineImageSequenceOutput_JPG)
        out = cfg.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
        d = unreal.DirectoryPath()
        d.set_editor_property("path", spec["out"].replace("\\", "/"))
        out.set_editor_property("output_directory", d)
        out.set_editor_property("output_resolution", unreal.IntPoint(*res))
        out.set_editor_property("file_name_format", spec.get("name", "f") + ".{frame_number}")
        out.set_editor_property("zero_pad_frame_numbers", 4)
        out.set_editor_property("override_existing_output", True)
        out.set_editor_property("flush_disk_writes_per_shot", True)
        if spec.get("start") is not None:
            out.set_editor_property("use_custom_playback_range", True)
            out.set_editor_property("custom_start_frame", int(spec["start"]))
            out.set_editor_property("custom_end_frame", int(spec["end"]))
        a = cfg.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
        a.set_editor_property("spatial_sample_count", ssamples)
        a.set_editor_property("temporal_sample_count", tsamples)
        a.set_editor_property("override_anti_aliasing", True)
        a.set_editor_property("anti_aliasing_method", {
            "tsr": unreal.AntiAliasingMethod.AAM_TSR, "none": unreal.AntiAliasingMethod.AAM_NONE,
            "taa": unreal.AntiAliasingMethod.AAM_TEMPORAL_AA}[aa])
        a.set_editor_property("render_warm_up_count", warmup)
        a.set_editor_property("engine_warm_up_count", engine_warmup)
        a.set_editor_property("use_camera_cut_for_warm_up", False)
        cam = cfg.find_or_add_setting_by_class(unreal.MoviePipelineCameraSetting)
        cam.set_editor_property("shutter_timing", unreal.MoviePipelineShutterTiming.FRAME_CENTER)
        go = cfg.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
        go.set_editor_property("cinematic_quality_settings", True)
        go.set_editor_property("use_lod_zero", True)
        go.set_editor_property("disable_hlods", True)
        go.set_editor_property("flush_streaming_managers", True)
        cv = cfg.find_or_add_setting_by_class(unreal.MoviePipelineConsoleVariableSetting)
        for k, val in allcv.items():
            cv.add_or_update_console_variable(k, float(val))

    t0 = time.time()
    _status(state="running", started=t0)

    def finished(executor, success):
        _status(state="done", success=bool(success), seconds=time.time() - t0)
        unreal.log("NYC render finished success=%s in %.1f s" % (success, time.time() - t0))

    def errored(executor, pipeline, fatal, text):
        unreal.log_error("NYC render error: %s" % text)

    ex = unreal.MoviePipelinePIEExecutor()
    ex.on_executor_finished_delegate.add_callable_unique(finished)
    ex.on_executor_errored_delegate.add_callable_unique(errored)
    _keep["executor"] = ex
    sub.render_queue_with_executor_instance(ex)
    print("render started:", len(jobs), "job(s)")
