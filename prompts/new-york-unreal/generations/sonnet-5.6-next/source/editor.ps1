# Starts the long-lived dev-loop editor (offscreen) and records its PID so only it is ever stopped.
param([switch]$Stop)
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root "logs\editor.pid"
$cmdDir = Join-Path $root "build\cmd"
if ($Stop) {
    if (Test-Path $pidFile) {
        $id = [int](Get-Content $pidFile)
        $p = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -like "UnrealEditor*") { Stop-Process -Id $id -Force; $null = $p.WaitForExit(60000); Write-Output "stopped editor $id" }
        Remove-Item $pidFile -Force
    }
    return
}
# never two dev-loop editors at once: both would pick up the same commands
if (Test-Path $pidFile) {
    $old = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
    if ($old -and $old.ProcessName -like "UnrealEditor*") { Write-Output "editor already running (pid $($old.Id))"; return }
}
New-Item -ItemType Directory -Force $cmdDir | Out-Null
Get-ChildItem $cmdDir -File | Remove-Item -Force
$env:NYC_DEVLOOP = "1"
$proj = Join-Path $root "NYC\NYC.uproject"
# Start on an engine map: redrawing the whole city in the editor viewport between asset
# operations makes every save take seconds and has tripped the GPU watchdog.
$p = Start-Process -FilePath "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList "`"$proj`" /Engine/Maps/Entry -RenderOffScreen -unattended -nosplash -nopause -log -abslog=`"$root\logs\editor.log`"" -PassThru
$env:NYC_DEVLOOP = $null
$p.Id | Out-File -Encoding ascii $pidFile
$ready = Join-Path $cmdDir "ready.flag"
$t0 = Get-Date
while (-not (Test-Path $ready)) {
    if ($p.HasExited) { Write-Output "editor exited early (code $($p.ExitCode))"; return }
    if (((Get-Date) - $t0).TotalSeconds -gt 560) { Write-Output "still starting after 560 s (pid $($p.Id))"; return }
    Start-Sleep -Seconds 2
}
Write-Output ("editor ready, pid {0}, {1:N0} s" -f $p.Id, ((Get-Date) - $t0).TotalSeconds)
