@echo off
rem Compiles the NYC editor module. Usage: source\build_cpp.bat
set UE=C:\Program Files\Epic Games\UE_5.8
call "%UE%\Engine\Build\BatchFiles\Build.bat" NYCEditor Win64 Development -Project="%~dp0..\NYC\NYC.uproject" -WaitMutex -NoHotReloadFromIDE
