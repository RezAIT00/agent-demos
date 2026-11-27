// "nyc.run <file.json>": drives the running game from a script - camera, weather, damage, tools and
// screenshots.  The destruction audit and the engineering checks are both scripts.
#include "NYCTestRunner.h"
#include "NYC.h"
#include "NYCDestruction.h"
#include "NYCDestructionFX.h"
#include "NYCGameMode.h"
#include "InputKeyEventArgs.h"
#include "RenderTimer.h"
#include "DynamicRHI.h"
#include "GameFramework/HUD.h"
#include "NYCWeatherController.h"
#include "NYCTraffic.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "UnrealClient.h"
#include "Engine/GameViewportClient.h"

static FVector JsonVector(const TSharedPtr<FJsonObject>& O, const TCHAR* Name, const FVector& Default = FVector::ZeroVector)
{
	const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
	if (!O->TryGetArrayField(Name, A) || A->Num() < 3) return Default;
	return FVector((*A)[0]->AsNumber(), (*A)[1]->AsNumber(), (*A)[2]->AsNumber());
}

static double JsonNumber(const TSharedPtr<FJsonObject>& O, const TCHAR* Name, double Default)
{
	double V = Default;
	O->TryGetNumberField(Name, V);
	return V;
}

ANYCTestRunner::ANYCTestRunner()
{
	PrimaryActorTick.bCanEverTick = true;
}

bool ANYCTestRunner::Load(const FString& Path)
{
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		UE_LOG(LogNYC, Error, TEXT("Test runner: cannot read %s"), *Path);
		return false;
	}
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Script) || !Script)
	{
		UE_LOG(LogNYC, Error, TEXT("Test runner: bad json"));
		return false;
	}
	if (!Script->TryGetField(TEXT("events")).IsValid()) Events.Reset();
	else Events = Script->GetArrayField(TEXT("events"));
	Events.StableSort([](const TSharedPtr<FJsonValue>& A, const TSharedPtr<FJsonValue>& B) { return A->AsObject()->GetNumberField(TEXT("t")) < B->AsObject()->GetNumberField(TEXT("t")); });
	Report.Reset();
	return true;
}

void ANYCTestRunner::SetCamera(const TSharedPtr<FJsonObject>& O)
{
	if (!Camera)
	{
		FActorSpawnParameters P;
		P.ObjectFlags |= RF_Transient;
		Camera = GetWorld()->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), FTransform::Identity, P);
		Camera->GetCameraComponent()->bConstrainAspectRatio = false;
	}
	const FVector Loc = JsonVector(O, TEXT("loc"), CameraBase);
	const FVector Rot = JsonVector(O, TEXT("rot"));
	CameraBase = Loc;
	FRotator R(Rot.X, Rot.Y, Rot.Z);
	const FVector Look = JsonVector(O, TEXT("look"), FVector(1e12, 0, 0));
	if (Look.X < 1e11) R = (Look - Loc).Rotation();
	Camera->SetActorLocationAndRotation(Loc, R);
	Camera->GetCameraComponent()->SetFieldOfView((float)JsonNumber(O, TEXT("fov"), 65.0));
	if (APlayerController* PC = GetWorld()->GetFirstPlayerController()) PC->SetViewTarget(Camera);
}

void ANYCTestRunner::SetWeather(const TSharedPtr<FJsonObject>& O)
{
	for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It)
	{
		for (const auto& Pair : O->Values)
		{
			const FName Name(*FString(Pair.Key.ToView()));
			if (FFloatProperty* P = FindFProperty<FFloatProperty>(It->GetClass(), Name))
			{
				P->SetPropertyValue_InContainer(*It, (float)Pair.Value->AsNumber());
			}
			else if (FIntProperty* Whole = FindFProperty<FIntProperty>(It->GetClass(), Name))
			{
				Whole->SetPropertyValue_InContainer(*It, (int32)Pair.Value->AsNumber());
			}
		}
	}
}

void ANYCTestRunner::Run(const TSharedPtr<FJsonObject>& E)
{
	const FString Do = E->GetStringField(TEXT("do"));
	ANYCDestruction* D = ANYCDestruction::Get(GetWorld());
	if (Do == TEXT("camera")) SetCamera(E);
	else if (Do == TEXT("weather")) SetWeather(E);
	else if (Do == TEXT("shot"))
	{
		const FString File = E->GetStringField(TEXT("file"));
		FScreenshotRequest::RequestScreenshot(File, false, false);
		UE_LOG(LogNYC, Display, TEXT("Test runner: screenshot %s at %.2f"), *File, Elapsed);
	}
	else if (Do == TEXT("reset")) D->ResetCity();
	else if (Do == TEXT("perf"))
	{
		// {"do":"perf","label":"x","seconds":6,"to":[x,y,z]} times real frames while the camera flies toward "to"
		bPerf = true;
		PerfLabel = E->GetStringField(TEXT("label"));
		PerfStart = Elapsed;
		PerfUntil = Elapsed + JsonNumber(E, TEXT("seconds"), 5.0);
		PerfFrom = CameraBase;
		PerfTo = JsonVector(E, TEXT("to"), CameraBase);
		PerfFrames.Reset();
		PerfGpu = PerfGame = PerfRender = 0.0;
		PerfLastReal = 0.0;
	}
	else if (Do == TEXT("key"))
	{
		// a real key or mouse button, through the player's own input bindings: {"do":"key","key":"LeftMouseButton"}
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			const FKey Key(*E->GetStringField(TEXT("key")));
			PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Pressed, 1.f));
			PC->InputKey(FInputKeyEventArgs::CreateSimulated(Key, IE_Released, 0.f));
		}
	}
	else if (Do == TEXT("click"))
	{
		// a click on a HUD hit box at screen position x, y
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			if (AHUD* Hud = PC->GetHUD())
			{
				const bool bHit = Hud->UpdateAndDispatchHitBoxClickEvents(FVector2D(JsonNumber(E, TEXT("x"), 0.0), JsonNumber(E, TEXT("y"), 0.0)), IE_Pressed);
				UE_LOG(LogNYC, Display, TEXT("Test runner: click %s"), bHit ? TEXT("hit a box") : TEXT("hit nothing"));
			}
		}
	}
	else if (Do == TEXT("playstate"))
	{
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			if (ANYCFlyPawn* Pawn = Cast<ANYCFlyPawn>(PC->GetPawn()))
			{
				float Time = -1.f, Rain = -1.f;
				for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It) { Time = It->TimeOfDay; Rain = It->Rain; }
				const FNYCDestructionStats& S = D->Stats;
				const FString Line = FString::Printf(TEXT("{\"label\":\"%s\",\"tool\":%d,\"selector\":%s,\"hour\":%.2f,\"rain\":%.2f,\"broken\":%d,\"pieces\":%d,\"view\":\"%s\"}"),
					*E->GetStringField(TEXT("label")), Pawn->ToolIndex + 1, Pawn->bSelector ? TEXT("true") : TEXT("false"), Time, Rain, S.Total(), S.Pieces, *Pawn->GetActorLocation().ToCompactString());
				Report.Add(Line);
				UE_LOG(LogNYC, Display, TEXT("Test runner playstate %s"), *Line);
				FString Out;
				if (Script->TryGetStringField(TEXT("report"), Out)) FFileHelper::SaveStringArrayToFile(Report, *Out);
			}
		}
	}
	else if (Do == TEXT("hud"))
	{
		// {"do":"hud","show":true,"selector":false,"tool":3} for checking the play-mode interface
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			if (ANYCFlyPawn* Pawn = Cast<ANYCFlyPawn>(PC->GetPawn()))
			{
				bool bShow = true, bList = false;
				E->TryGetBoolField(TEXT("show"), bShow);
				E->TryGetBoolField(TEXT("selector"), bList);
				Pawn->bHideHud = !bShow;
				Pawn->SelectTool((int32)JsonNumber(E, TEXT("tool"), 0.0));
				Pawn->SetSelector(bList);
			}
		}
	}
	else if (Do == TEXT("damage"))
	{
		FNYCDamage Hit;
		Hit.Center = JsonVector(E, TEXT("center"));
		Hit.Radius = (float)JsonNumber(E, TEXT("radius"), 400.0);
		Hit.GlassRadius = (float)JsonNumber(E, TEXT("glass"), Hit.Radius * 2.0);
		Hit.Speed = (float)JsonNumber(E, TEXT("speed"), 900.0);
		Hit.Fire = (float)JsonNumber(E, TEXT("fire"), 0.0);
		Hit.bCrater = E->HasField(TEXT("crater"));
		Hit.CraterRadius = (float)JsonNumber(E, TEXT("crater"), 0.0);
		D->ApplyDamage(Hit);
	}
	else if (Do == TEXT("collapse"))
	{
		int32 B = INDEX_NONE;
		if (D->EnsureLoaded() && D->NearestBuilding(JsonVector(E, TEXT("at")), 5000.f, B))
		{
			D->CollapseBuilding(B, (int32)JsonNumber(E, TEXT("floor"), 1.0), (int32)JsonNumber(E, TEXT("mode"), 1.0), JsonVector(E, TEXT("toward"), FVector(1, 0, 0)), 0.1f);
		}
	}
	else if (Do == TEXT("tool"))
	{
		UseTool(E);
	}
	else if (Do == TEXT("stats"))
	{
		const FNYCDestructionStats& S = D->Stats;
		const FString Line = FString::Printf(TEXT("{\"label\":\"%s\",\"t\":%.2f,\"elements\":%d,\"pieces\":%d,\"windows\":%d,\"props\":%d,\"vehicles\":%d,\"craters\":%d,\"buildings\":%d,\"collapses\":%d,\"collections\":%d,\"frame_ms\":%.1f}"),
			*E->GetStringField(TEXT("label")), Elapsed, S.Elements, S.Pieces, S.Windows, S.Props, S.Vehicles, S.Craters, S.Buildings, S.Collapses, S.Collections, AverageFrame * 1000.f);
		Report.Add(Line);
		UE_LOG(LogNYC, Display, TEXT("Test runner stats %s"), *Line);
		FString Out;
		if (Script->TryGetStringField(TEXT("report"), Out)) FFileHelper::SaveStringArrayToFile(Report, *Out);
	}
	else if (Do == TEXT("fx"))
	{
		D->EnsureLoaded();
		ANYCDestructionFX* F = D->FX();
		const FString N = E->GetStringField(TEXT("name"));
		const FVector At = JsonVector(E, TEXT("at"));
		const float R = (float)JsonNumber(E, TEXT("r"), 400.0);
		if (N == TEXT("fireball")) F->Fireball(At, R, 1.4f);
		else if (N == TEXT("fire")) F->Fire(At, R, 12.f);
		else if (N == TEXT("dust")) F->DustBurst(At, R, 1.f, TEXT("brick_white"));
		else if (N == TEXT("surge")) F->DustSurge(FBox(At - FVector(R, R, 0), At + FVector(R, R, R)), R * 4.f, TEXT("limestone"));
		else if (N == TEXT("mushroom")) F->MushroomCloud(At, R, 40.f);
		else if (N == TEXT("dome")) F->ShockDome(At, R, R * 1.4f, 0.8f);
		else if (N == TEXT("ring")) F->GroundRing(At, R, R * 0.8f, 1.f, TEXT("limestone"));
		else if (N == TEXT("crater")) D->MakeCrater(At, R, R * 0.34f);
		else if (N == TEXT("glass")) F->GlassBurst(At, FVector(600, 0, 200), FVector2D(300, 200));
		else if (N == TEXT("sparks")) F->Sparks(At, FVector(0, 0, 900), (int32)R);
		else if (N == TEXT("water")) F->WaterJet(At, FVector(0, 0, 1), 10.f, 1.2f);
		else if (N == TEXT("beam")) F->Beam(At, At + FVector(0, 0, 40000), R, FLinearColor(0.2f, 0.8f, 1.f), 40000.f, 6.f);
		else if (N == TEXT("mound")) F->RubbleMound(At, FVector2D(R, R), R * 0.4f, TEXT("brick_white"));
		else if (N == TEXT("smoke")) F->SmokeColumn(At, R, 14.f);
	}
	else if (Do == TEXT("debris")) D->LogDebris();
	else if (Do == TEXT("body"))
	{
		UStaticMeshComponent* Vis = D->NewVisual(D->UnitCube(), FTransform(FRotator::ZeroRotator, JsonVector(E, TEXT("at")), FVector(0.8)));
		D->SpawnBody(TEXT("test"), Vis, FTransform(JsonVector(E, TEXT("at"))), FVector(40, 40, 40), 100.f, FVector::ZeroVector, FVector(30, 60, 0));
	}
	else if (Do == TEXT("console"))
	{
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController()) PC->ConsoleCommand(E->GetStringField(TEXT("cmd")));
	}
	else if (Do == TEXT("quit"))
	{
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController()) PC->ConsoleCommand(TEXT("quit"));
	}
}

void ANYCTestRunner::TickPerf()
{
	const double Real = FPlatformTime::Seconds();
	if (PerfLastReal > 0.0)
	{
		PerfFrames.Add((float)((Real - PerfLastReal) * 1000.0));
		PerfGpu += FPlatformTime::ToMilliseconds(RHIGetGPUFrameCycles());
		PerfGame += FPlatformTime::ToMilliseconds(GGameThreadTime);
		PerfRender += FPlatformTime::ToMilliseconds(GRenderThreadTime);
	}
	PerfLastReal = Real;
	if (!PerfTo.Equals(PerfFrom))
	{
		CameraBase = FMath::Lerp(PerfFrom, PerfTo, FMath::Clamp((Elapsed - PerfStart) / FMath::Max(PerfUntil - PerfStart, 0.1), 0.0, 1.0));
	}
	if (Elapsed < PerfUntil || PerfFrames.Num() < 10) return;
	bPerf = false;
	TArray<float> Sorted = PerfFrames;
	Sorted.Sort();
	double Sum = 0.0;
	for (float F : Sorted) Sum += F;
	const int32 N = Sorted.Num();
	const double Mean = Sum / N;
	const FString Line = FString::Printf(TEXT("{\"label\":\"%s\",\"frames\":%d,\"avg_fps\":%.1f,\"median_ms\":%.2f,\"p95_ms\":%.2f,\"p99_ms\":%.2f,\"worst_ms\":%.1f,\"gpu_ms\":%.2f,\"game_ms\":%.2f,\"render_ms\":%.2f}"),
		*PerfLabel, N, 1000.0 / Mean, Sorted[N / 2], Sorted[FMath::Min(N - 1, N * 95 / 100)], Sorted[FMath::Min(N - 1, N * 99 / 100)], Sorted.Last(), PerfGpu / N, PerfGame / N, PerfRender / N);
	Report.Add(Line);
	UE_LOG(LogNYC, Display, TEXT("Test runner perf %s"), *Line);
	FString Out;
	if (Script->TryGetStringField(TEXT("report"), Out)) FFileHelper::SaveStringArrayToFile(Report, *Out);
}

void ANYCTestRunner::Tick(float Dt)
{
	Super::Tick(Dt);
	if (!Script) return;
	const double Real = FPlatformTime::Seconds();
	if (LastReal > 0) AverageFrame = FMath::Lerp(AverageFrame, (float)(Real - LastReal), 0.1f);
	LastReal = Real;
	// give textures, shaders and Lumen a moment before the clock starts
	if (WarmFrames < (int32)JsonNumber(Script, TEXT("warmup_frames"), 60.0))
	{
		if (WarmFrames == 0)
		{
			const TSharedPtr<FJsonObject>* O = nullptr;
			if (Script->TryGetObjectField(TEXT("camera"), O)) SetCamera(*O);
			if (Script->TryGetObjectField(TEXT("weather"), O)) SetWeather(*O);
		}
		++WarmFrames;
		if (WarmFrames == (int32)JsonNumber(Script, TEXT("warmup_frames"), 60.0))
		{
			const TSharedPtr<FJsonObject>* A = nullptr;
			if (Script->TryGetObjectField(TEXT("audit"), A)) BeginAudit(*A);
		}
		return;
	}
	Elapsed += Dt;
	if (bPerf) TickPerf();
	if (Camera)
	{
		if (ANYCDestruction* D = ANYCDestruction::Get(GetWorld(), false)) Camera->SetActorLocation(CameraBase + D->ShakeOffset(CameraBase));
	}
	if (bAudit)
	{
		TickAudit(Dt);
		return;
	}
	while (Next < Events.Num() && Events[Next]->AsObject()->GetNumberField(TEXT("t")) <= Elapsed)
	{
		const TSharedPtr<FJsonObject> E = Events[Next++]->AsObject();
		Run(E);
		// one screenshot per frame at most
		if (E->GetStringField(TEXT("do")) == TEXT("shot")) break;
	}
}

static FAutoConsoleCommandWithWorldAndArgs GNYCRun(TEXT("nyc.run"), TEXT("Run an NYC test script (json)"),
	FConsoleCommandWithWorldAndArgsDelegate::CreateStatic([](const TArray<FString>& Args, UWorld* World)
	{
		if (!World || Args.Num() == 0) return;
		ANYCTestRunner* R = World->SpawnActor<ANYCTestRunner>();
		if (R && !R->Load(FString::Join(Args, TEXT(" ")))) R->Destroy();
	}));
