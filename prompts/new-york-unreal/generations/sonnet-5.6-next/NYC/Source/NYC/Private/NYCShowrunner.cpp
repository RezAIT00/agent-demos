#include "NYCShowrunner.h"
#include "NYC.h"
#include "NYCArsenal.h"
#include "NYCDestruction.h"
#include "NYCDestructionFX.h"
#include "Chaos/CacheCollection.h"
#include "Camera/PlayerCameraManager.h"
#include "Dom/JsonObject.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

static TAutoConsoleVariable<int32> CVarFilmCache(TEXT("nyc.FilmCache"), 0, TEXT("Destruction film physics: 0 live, 1 record into the shot's Chaos cache, 2 play it back"));

ANYCShowrunner::ANYCShowrunner()
{
	PrimaryActorTick.bCanEverTick = true;
	// after Sequencer has set this frame's properties and camera, before physics steps
	PrimaryActorTick.TickGroup = TG_PrePhysics;
}

static TSharedPtr<FJsonObject> LoadShot(int32 Index)
{
	const FString Path = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("../source/film/destruction_shots.json"));
	FString Text;
	TSharedPtr<FJsonObject> Root;
	if (!FFileHelper::LoadFileToString(Text, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Root) || !Root) return nullptr;
	const TArray<TSharedPtr<FJsonValue>>* Shots = nullptr;
	if (!Root->TryGetArrayField(TEXT("shots"), Shots) || !Shots->IsValidIndex(Index)) return nullptr;
	return (*Shots)[Index]->AsObject();
}

bool ANYCShowrunner::Begin()
{
	const TSharedPtr<FJsonObject> Data = LoadShot(Shot);
	if (!Data)
	{
		UE_LOG(LogNYC, Error, TEXT("Showrunner: no shot %d in destruction_shots.json"), Shot);
		return false;
	}
	Director = ANYCDestruction::Get(GetWorld());
	if (!Director || !Director->EnsureLoaded()) return false;
	ShotName = Data->GetStringField(TEXT("id"));
	Director->bNoPeopleEver = true;
	Director->ResetCity();
	Director->SetExternalClock(true);
	Director->bQuiet = true;
	const int32 Mode = CVarFilmCache.GetValueOnGameThread();
	Director->CacheMode = Mode == 1 ? ENYCCacheMode::Record : Mode == 2 ? ENYCCacheMode::Playback : ENYCCacheMode::Off;
	Cache = nullptr;
	if (Mode != 0)
	{
		const FString Asset = FString::Printf(TEXT("/Game/NYC/Cache/CC_%s.CC_%s"), *ShotName, *ShotName);
		Cache = LoadObject<UChaosCacheCollection>(nullptr, *Asset);
		if (!Cache)
		{
			UE_LOG(LogNYC, Error, TEXT("Showrunner: missing cache asset %s"), *Asset);
			Director->CacheMode = ENYCCacheMode::Off;
		}
	}
	Director->CacheCollection = Cache;
	const TArray<TSharedPtr<FJsonValue>>* Events = nullptr;
	if (Data->TryGetArrayField(TEXT("events"), Events))
	{
		for (const TSharedPtr<FJsonValue>& V : *Events)
		{
			const TSharedPtr<FJsonObject> E = V->AsObject();
			auto Vector = [&E](const TCHAR* Name)
			{
				const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
				if (!E->TryGetArrayField(Name, A) || A->Num() < 3) return FVector::ZeroVector;
				return FVector((*A)[0]->AsNumber(), (*A)[1]->AsNumber(), (*A)[2]->AsNumber());
			};
			const FString Id = E->GetStringField(TEXT("tool"));
			const FVector From = Vector(TEXT("from")), At = Vector(TEXT("at"));
			ANYCDestruction* D = Director;
			Director->After(FMath::Max(0.001f, (float)E->GetNumberField(TEXT("t"))), [D, Id, From, At]()
			{
				NYCArsenal::Use(*D, Id, NYCArsenal::MakeAim(*D, From, At - From));
			});
		}
	}
	Frames.Reset();
	LastTime = -1.0;
	Running = Shot;
	UE_LOG(LogNYC, Display, TEXT("Showrunner: shot %d '%s', cache mode %d"), Shot, *ShotName, (int32)Director->CacheMode);
	return true;
}

void ANYCShowrunner::Tick(float Dt)
{
	Super::Tick(Dt);
	if (ShotTime < 0.f) return;
	if (Running != Shot && !Begin()) return;
	if (!Director) return;
	Director->ClearStreetsOfPeople();
	// the clock only ever runs forward: warm-up frames hold on the first value
	if (ShotTime > LastTime)
	{
		Director->AdvanceTo(ShotTime);
		LastTime = ShotTime;
	}
	else if (Director->CacheMode == ENYCCacheMode::Playback) Director->AdvanceTo(FMath::Max((double)ShotTime, LastTime));
	APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (!PC || !PC->PlayerCameraManager) return;
	FVector Eye;
	FRotator Look;
	PC->GetPlayerViewPoint(Eye, Look);
	Frames.Add(FString::Printf(TEXT("%.4f,%.1f,%.1f,%.1f,%.2f,%.2f"), ShotTime, Eye.X, Eye.Y, Eye.Z, Look.Yaw, Look.Pitch));
	// blast shake moves the film camera itself; Sequencer puts it back each frame before this runs
	if (AActor* View = PC->GetViewTarget())
	{
		const FVector Jolt = Director->ShakeOffset(View->GetActorLocation());
		if (!Jolt.IsNearlyZero()) View->AddActorWorldOffset(Jolt * 0.7);
	}
}

void ANYCShowrunner::WriteLog()
{
	if (Running < 0 || !Director || !Director->FX()) return;
	TArray<FString> Lines;
	for (const FNYCSoundEvent& E : Director->FX()->SoundLog)
	{
		Lines.Add(FString::Printf(TEXT("S,%.4f,%s,%.1f,%.1f,%.1f,%.3f,%.3f"), E.Time, *E.Name.ToString(), E.Pos.X, E.Pos.Y, E.Pos.Z, E.Volume, E.Pitch));
	}
	for (const FString& F : Frames) Lines.Add(TEXT("C,") + F);
	const FNYCDestructionStats& S = Director->Stats;
	Lines.Add(FString::Printf(TEXT("T,elements=%d,pieces=%d,windows=%d,props=%d,vehicles=%d,craters=%d,collapses=%d,flashes_full=%d,flashes_softened=%d"),
		S.Elements, S.Pieces, S.Windows, S.Props, S.Vehicles, S.Craters, S.Collapses, Director->FX()->FlashesFull, Director->FX()->FlashesSoftened));
	const FString Path = FPaths::ProjectSavedDir() / FString::Printf(TEXT("NYCDestructionAudio_%s.csv"), *ShotName);
	FFileHelper::SaveStringArrayToFile(Lines, *Path);
	UE_LOG(LogNYC, Display, TEXT("Showrunner: %d sound events written to %s"), Director->FX()->SoundLog.Num(), *Path);
}

void ANYCShowrunner::EndPlay(const EEndPlayReason::Type Reason)
{
	WriteLog();
	// dropping the managers closes their recordings and writes them into the collection
	if (Director && Director->CacheMode == ENYCCacheMode::Record) Director->ResetCity();
	Running = -1;
	Super::EndPlay(Reason);
}
