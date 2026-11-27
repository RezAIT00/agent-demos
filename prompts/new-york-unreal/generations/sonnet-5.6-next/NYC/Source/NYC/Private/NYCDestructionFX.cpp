#include "NYCDestructionFX.h"
#include "HAL/IConsoleManager.h"
#include "NYC.h"
#include "NYCDestruction.h"
#include "NYCWeatherController.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Components/DecalComponent.h"

static FLinearColor RawDustColour(const FString& Wall);

static const int32 MaxVolumes = 260;
static const int32 MaxLights = 28;

ANYCDestructionFX::ANYCDestructionFX()
{
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void ANYCDestructionFX::Init(ANYCDestruction* InDirector)
{
	Director = InDirector;
	Rand.Initialize(4242);
}

float ANYCDestructionFX::GlowScale() const
{
	const ANYCWeatherController* W = Director ? Director->Weather() : nullptr;
	return FMath::Lerp(1.f, 0.16f, W ? FMath::Clamp(W->GetDarkness(), 0.f, 1.f) : 0.f);
}

FLinearColor ANYCDestructionFX::DustColour(const FString& Wall)
{
	// pulverised masonry is a dull, earthy grey-brown, never white
	const FLinearColor Raw = RawDustColour(Wall);
	return FLinearColor(Raw.R * 0.47f, Raw.G * 0.43f, Raw.B * 0.38f);
}

static FLinearColor RawDustColour(const FString& Wall)
{
	if (Wall.Contains(TEXT("brick_red"))) return FLinearColor(0.34f, 0.22f, 0.16f);
	if (Wall.Contains(TEXT("brick_brown")) || Wall.Contains(TEXT("brownstone"))) return FLinearColor(0.3f, 0.22f, 0.17f);
	if (Wall.Contains(TEXT("brick_black"))) return FLinearColor(0.17f, 0.16f, 0.15f);
	if (Wall.Contains(TEXT("brick"))) return FLinearColor(0.42f, 0.34f, 0.26f);
	if (Wall.Contains(TEXT("limestone")) || Wall.Contains(TEXT("marble")) || Wall.Contains(TEXT("terracotta"))) return FLinearColor(0.52f, 0.47f, 0.39f);
	if (Wall.Contains(TEXT("asphalt"))) return FLinearColor(0.2f, 0.18f, 0.16f);
	if (Wall.Contains(TEXT("soil"))) return FLinearColor(0.22f, 0.15f, 0.09f);
	return FLinearColor(0.46f, 0.43f, 0.39f);
}

void ANYCDestructionFX::Sound(const FName& Name, const FVector& At, float Volume, float Pitch)
{
	SoundLog.Add({ Clock, Name, At, Volume, Pitch });
	if (Director) Director->PlaySound(Name, At, Volume, Pitch);
}

// ------------------------------------------------------------------ volumes
int32 ANYCDestructionFX::SpawnVolume(const FNYCPuff& P, bool bDriven)
{
	int32 Slot = INDEX_NONE;
	for (int32 i = 0; i < Volumes.Num(); ++i)
		if (Volumes[i].bDead) { Slot = i; break; }
	if (Slot == INDEX_NONE && Volumes.Num() < MaxVolumes)
	{
		Slot = Volumes.AddDefaulted();
	}
	if (Slot == INDEX_NONE)
	{
		// recycle whichever cloud is closest to gone
		float Best = -1.f;
		for (int32 i = 0; i < Volumes.Num(); ++i)
		{
			if (Volumes[i].bDriven) continue;
			const float U = (float)(Clock - Volumes[i].Born) / FMath::Max(Volumes[i].P.Life, 0.1f);
			if (U > Best) { Best = U; Slot = i; }
		}
		if (Slot == INDEX_NONE) return INDEX_NONE;
	}
	FVolume& V = Volumes[Slot];
	if (!V.Comp)
	{
		UStaticMesh* Sphere = Director->CityMesh(TEXT("fx_volsphere"));
		if (!Sphere) return INDEX_NONE;
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(Sphere);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->CastShadow = false;
		C->bVisibleInRayTracing = false;
		C->bAffectDistanceFieldLighting = false;
		C->bAffectDynamicIndirectLighting = false;
		C->bVisibleInReflectionCaptures = false;
		C->SetupAttachment(RootComponent);
		C->RegisterComponent();
		VolumePool.Add(C);
		V.Comp = C;
	}
	V.Comp->SetTranslucentSortPriority(0);
	V.P = P;
	V.Born = Clock;
	V.bDead = false;
	V.bDriven = bDriven;
	V.FadeFrom = -1.f;
	V.Seed = Rand.FRandRange(0.f, 40.f);
	V.DrivenPos = P.Pos;
	V.DrivenRadius = P.R0;
	V.DrivenSquash = P.Squash;
	V.Looked = -10.0;
	UStaticMeshComponent* C = V.Comp;
	C->SetCustomPrimitiveDataFloat(0, (float)P.Kind);
	C->SetCustomPrimitiveDataFloat(2, V.Seed);
	C->SetCustomPrimitiveDataFloat(4, P.Albedo.R);
	C->SetCustomPrimitiveDataFloat(5, P.Albedo.G);
	C->SetCustomPrimitiveDataFloat(6, P.Albedo.B);
	C->SetCustomPrimitiveDataFloat(8, P.NoiseM);
	C->SetVisibility(true);
	UpdateVolume(V);
	return Slot;
}

void ANYCDestructionFX::UpdateVolume(FVolume& V)
{
	const FNYCPuff& P = V.P;
	const float Age = (float)(Clock - V.Born);
	const float U = FMath::Clamp(Age / FMath::Max(P.Life, 0.05f), 0.f, 1.f);
	FVector Pos;
	float Radius, Squash = P.Squash, Density, Glow = P.Glow, Life = U;
	if (V.bDriven)
	{
		Pos = V.DrivenPos;
		Radius = V.DrivenRadius;
		Squash = V.DrivenSquash;
		Density = P.Density * FMath::SmoothStep(0.f, 1.f, Age / FMath::Max(P.FadeIn, 0.01f));
		if (V.FadeFrom >= 0.f)
		{
			const float F = (float)(Clock - V.FadeFrom) / FMath::Max(V.FadeFor, 0.05f);
			Density *= FMath::Clamp(1.f - F, 0.f, 1.f);
			Glow *= FMath::Clamp(1.f - F, 0.f, 1.f);
			if (F >= 1.f) { V.bDead = true; V.Comp->SetVisibility(false); return; }
		}
		Life = P.Kind == ENYCVol::Mushroom ? FMath::SmoothStep(0.f, 1.f, FMath::Max(0.f, Age - 0.5f) / FMath::Clamp(P.Life * 0.11f, 4.2f, 8.f)) : 0.f;
	}
	else
	{
		if (Age >= P.Life) { V.bDead = true; V.Comp->SetVisibility(false); return; }
		const float Travel = P.Drag > 0.01f ? (1.f - FMath::Exp(-P.Drag * Age)) / P.Drag : Age;
		Pos = P.Pos + P.Vel * Travel + P.Rise * Age;
		const float Grow = 1.f - FMath::Exp(-Age / FMath::Max(P.Life * P.GrowTau, 0.03f));
		Radius = FMath::Lerp(P.R0, P.R1, Grow) * (1.f + 0.18f * U);
		if (P.bGroundHug) Pos.Z = FMath::Max(Pos.Z, Radius * Squash * 0.42f);
		const float In = FMath::SmoothStep(0.f, 1.f, Age / FMath::Max(P.FadeIn, 0.01f));
		const float Out = 1.f - FMath::SmoothStep(0.5f, 1.f, U);
		Density = P.Density * In * Out;
		if (P.Kind == ENYCVol::Fireball || P.Kind == ENYCVol::Flame) Glow = P.Glow * FMath::Clamp(1.15f - U * 0.9f, 0.f, 1.f) * FMath::Min(1.f, Age / 0.06f);
	}
	UStaticMeshComponent* C = V.Comp;
	// how much light reaches it changes slowly: look again now and then
	if (Clock - V.Looked > 0.45)
	{
		const ANYCWeatherController* W = Director->Weather();
		const FVector ToSun = W ? W->GetSunDirection() : FVector(0.3, 0.3, 0.9);
		float Sun = 1.f, Sky = 1.f;
		Director->Exposure(Pos + FVector(0, 0, Radius * Squash * 0.35), ToSun, Sun, Sky);
		const bool bFirst = V.Looked < -5.0;
		V.Sun = bFirst ? Sun : FMath::Lerp(V.Sun, Sun, 0.35f);
		V.Sky = bFirst ? Sky : FMath::Lerp(V.Sky, Sky, 0.35f);
		if (bFirst && IConsoleManager::Get().FindConsoleVariable(TEXT("nyc.LogVolumes")) && IConsoleManager::Get().FindConsoleVariable(TEXT("nyc.LogVolumes"))->GetInt() > 0)
			UE_LOG(LogNYC, Display, TEXT("volume kind %d at (%.0f, %.0f, %.0f) r %.0f sun %.2f sky %.2f toSun (%.2f, %.2f, %.2f)"), P.Kind, Pos.X, Pos.Y, Pos.Z, Radius, Sun, Sky, ToSun.X, ToSun.Y, ToSun.Z);
		V.Looked = Clock;
		// the three sun rays miss a lot of the clutter of a street: trust them less where little sky shows
		const float Open = FMath::Clamp((V.Sky - 0.3f) / 0.5f, 0.f, 1.f);
		C->SetCustomPrimitiveDataFloat(12, P.Kind == ENYCVol::Mushroom ? 1.f : V.Sun * FMath::Lerp(0.3f, 1.f, Open));
		C->SetCustomPrimitiveDataFloat(13, P.Kind == ENYCVol::Mushroom ? 1.f : V.Sky);
	}
	C->SetWorldLocation(Pos);
	C->SetWorldScale3D(FVector(Radius / 100.f, Radius / 100.f, Radius * Squash / 100.f));
	C->SetCustomPrimitiveDataFloat(1, Density);
	C->SetCustomPrimitiveDataFloat(3, Age);
	C->SetCustomPrimitiveDataFloat(7, Glow);
	C->SetCustomPrimitiveDataFloat(9, Life);
	C->SetCustomPrimitiveDataFloat(10, Radius);
	C->SetCustomPrimitiveDataFloat(11, Squash);
	const ANYCWeatherController* Weather_ = Director->Weather();
	C->SetCustomPrimitiveDataFloat(14, Weather_ && Weather_->IsExternalClock() ? 1.f : 0.62f);
}

void ANYCDestructionFX::SetVolumeOrder(int32 Id, int32 Order)
{
	if (Volumes.IsValidIndex(Id) && !Volumes[Id].bDead && Volumes[Id].Comp) Volumes[Id].Comp->SetTranslucentSortPriority(Order);
}

int32 ANYCDestructionFX::AddPuff(const FNYCPuff& P)
{
	return SpawnVolume(P, false);
}

int32 ANYCDestructionFX::DrivenVolume(const FNYCPuff& Look)
{
	return SpawnVolume(Look, true);
}

void ANYCDestructionFX::DriveVolume(int32 Id, const FVector& Pos, float Radius, float Squash, float Density, float Glow)
{
	if (!Volumes.IsValidIndex(Id) || Volumes[Id].bDead || !Volumes[Id].bDriven) return;
	FVolume& V = Volumes[Id];
	V.DrivenPos = Pos;
	V.DrivenRadius = Radius;
	V.DrivenSquash = Squash;
	if (Density >= 0.f) V.P.Density = Density;
	if (Glow >= 0.f) V.P.Glow = Glow;
}

void ANYCDestructionFX::EndVolume(int32 Id, float FadeSeconds)
{
	if (!Volumes.IsValidIndex(Id) || Volumes[Id].bDead) return;
	Volumes[Id].FadeFrom = (float)Clock;
	Volumes[Id].FadeFor = FadeSeconds;
}

// ------------------------------------------------------------------ Niagara
UNiagaraSystem* ANYCDestructionFX::System(const FString& Name)
{
	if (UNiagaraSystem** Found = Systems.Find(Name)) return *Found;
	UNiagaraSystem* S = LoadObject<UNiagaraSystem>(nullptr, *FString::Printf(TEXT("/Game/NYC/FX/%s.%s"), *Name, *Name));
	Systems.Add(Name, S);
	return S;
}

UNiagaraComponent* ANYCDestructionFX::Particles(const FString& Name, const FVector& At)
{
	UNiagaraSystem* S = System(Name);
	if (!S) return nullptr;
	UNiagaraComponent* C = NewObject<UNiagaraComponent>(this, NAME_None, RF_Transient);
	C->SetAsset(S);
	C->SetAutoDestroy(false);
	C->bAutoActivate = false;
	C->SetupAttachment(RootComponent);
	C->SetWorldLocation(At);
	C->SetForceSolo(false);
	C->RegisterComponent();
	// the same seed for the same spawn order, so renders repeat
	C->SetRandomSeedOffset(NextId++);
	return C;
}

static void SetCommon(UNiagaraComponent* C, float LifeMin, float LifeMax, float SpeedMin, float SpeedMax, const FVector& Axis, float Spread,
	float Radius, const FVector& Gravity, float Drag, float SizeMin, float SizeMax, const FLinearColor& Tint)
{
	C->SetVariableFloat(TEXT("User.LifeMin"), LifeMin);
	C->SetVariableFloat(TEXT("User.LifeMax"), LifeMax);
	C->SetVariableFloat(TEXT("User.SpeedMin"), SpeedMin);
	C->SetVariableFloat(TEXT("User.SpeedMax"), SpeedMax);
	C->SetVariableVec3(TEXT("User.Axis"), Axis.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector));
	C->SetVariableFloat(TEXT("User.Spread"), Spread);
	C->SetVariableFloat(TEXT("User.SpawnRadius"), FMath::Max(Radius, 0.5f));
	C->SetVariableVec3(TEXT("User.Gravity"), Gravity);
	C->SetVariableFloat(TEXT("User.Drag"), Drag);
	C->SetVariableFloat(TEXT("User.SizeMin"), SizeMin);
	C->SetVariableFloat(TEXT("User.SizeMax"), SizeMax);
	C->SetVariableLinearColor(TEXT("User.Tint"), Tint);
}

void ANYCDestructionFX::Burst(const FString& Name, const FVector& At, int32 Count, float LifeMin, float LifeMax, float SpeedMin, float SpeedMax,
	const FVector& Axis, float Spread, float Radius, const FVector& Gravity, float Drag, float SizeMin, float SizeMax, const FLinearColor& Tint)
{
	if (Count <= 0) return;
	UNiagaraComponent* C = Particles(Name, At);
	if (!C) return;
	SetCommon(C, LifeMin, LifeMax, SpeedMin, SpeedMax, Axis, Spread, Radius, Gravity, Drag, SizeMin, SizeMax, Tint);
	C->SetVariableInt(TEXT("User.Count"), Count);
	C->Activate(true);
	Streams.Add({ C, Clock + LifeMax + 0.5 });
}

void ANYCDestructionFX::Stream(const FString& Name, const FVector& At, float Duration, float Rate, float LifeMin, float LifeMax, float SpeedMin, float SpeedMax,
	const FVector& Axis, float Spread, float Radius, const FVector& Gravity, float Drag, float SizeMin, float SizeMax, const FLinearColor& Tint)
{
	UNiagaraComponent* C = Particles(Name, At);
	if (!C) return;
	SetCommon(C, LifeMin, LifeMax, SpeedMin, SpeedMax, Axis, Spread, Radius, Gravity, Drag, SizeMin, SizeMax, Tint);
	C->SetVariableFloat(TEXT("User.Rate"), Rate);
	C->Activate(true);
	TWeakObjectPtr<UNiagaraComponent> Weak(C);
	Director->After(Duration, [Weak]() { if (Weak.IsValid()) Weak->Deactivate(); });
	Streams.Add({ C, Clock + Duration + LifeMax + 0.5 });
}

// ------------------------------------------------------------------ composed effects
void ANYCDestructionFX::DustBurst(const FVector& At, float Radius, float Amount, const FString& Wall)
{
	if (Amount <= 0.f) return;
	const FLinearColor Colour = DustColour(Wall);
	const int32 N = FMath::Clamp(FMath::RoundToInt32(Radius / 170.f) + 3, 4, 8);
	for (int32 i = 0; i < N; ++i)
	{
		FNYCPuff P;
		const FVector Off(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-0.4f, 0.9f));
		P.Pos = At + Off * Radius * 0.55f;
		P.Pos.Z = FMath::Max(P.Pos.Z, Radius * 0.2);
		// heavy dust is thrown sideways and sags; it does not float up in balls
		P.Vel = FVector(Off.X * 1.75f, Off.Y * 1.75f, Off.Z * 0.3f + 0.05f) * Radius * 1.2f;
		P.Drag = 1.1f;
		P.Rise = FVector(0, 0, 7.f) + Director->Wind() * 0.35f;
		P.R0 = Radius * 0.24f;
		P.R1 = Radius * Rand.FRandRange(0.6f, 1.02f) * FMath::Clamp(0.55f + Radius / 500.f, 0.68f, 1.f);
		P.Squash = Rand.FRandRange(0.5f, 0.74f);
		P.Life = Rand.FRandRange(5.5f, 10.f) * FMath::Clamp(Radius / 500.f, 0.7f, 1.8f);
		P.FadeIn = 0.1f;
		P.GrowTau = 0.14f;
		P.Density = 0.95f * FMath::Min(Amount, 1.2f) * FMath::Clamp(Radius / 260.f, 0.42f, 1.f);
		P.Albedo = Colour * Rand.FRandRange(0.88f, 1.1f);
		P.NoiseM = FMath::Clamp(Radius / 100.f * 0.62f, 0.8f, 9.f);
		// a small knock raises a thin, broken wisp, not a solid ball
		const float Small = FMath::Clamp((Radius - 60.f) / 260.f, 0.f, 1.f);
		P.Density *= FMath::Lerp(0.34f, 1.f, Small);
		P.Albedo *= FMath::Lerp(0.72f, 1.f, Small);
		P.NoiseM = FMath::Lerp(0.38f, P.NoiseM, Small);
		P.Life *= FMath::Lerp(0.6f, 1.f, Small);
		P.bGroundHug = At.Z < Radius * 1.2f;
		AddPuff(P);
	}
	const float K = FMath::Clamp(Radius / 400.f, 0.35f, 3.f) * FMath::Min(Amount, 1.4f);
	Burst(TEXT("NS_Dust"), At, FMath::RoundToInt32(26.f * K), 1.1f, 3.4f, Radius * 0.35f, Radius * 1.7f, FVector::UpVector, 95.f, Radius * 0.45f,
		FVector(0, 0, -55.f), 1.5f, Radius * 0.09f + 14.f, Radius * 0.27f + 34.f, FLinearColor(Colour.R, Colour.G, Colour.B, 0.62f));
	Chips(At, FVector(0, 0, Radius * 0.9f), FMath::Min(260, FMath::RoundToInt32(90.f * K)), Colour * 0.62f, 1.2f, 7.5f, 105.f);
}

void ANYCDestructionFX::DustSurge(const FBox& Footprint, float Height, const FString& Wall)
{
	// after a fall the dust has nowhere to go but along the streets, which run along x and y
	const FVector Centre = Footprint.GetCenter();
	const FVector2D Half(Footprint.GetExtent().X, Footprint.GetExtent().Y);
	const float Size = FMath::Clamp(Height / 4200.f, 0.55f, 2.2f);
	const FLinearColor Colour = DustColour(Wall);
	const int32 N = FMath::Clamp(FMath::RoundToInt32(18.f + 16.f * Size), 20, 52);
	for (int32 i = 0; i < N; ++i)
	{
		const int32 Side = i % 4;
		const FVector Dir = Side == 0 ? FVector(1, 0, 0) : Side == 1 ? FVector(-1, 0, 0) : Side == 2 ? FVector(0, 1, 0) : FVector(0, -1, 0);
		const FVector Across(-Dir.Y, Dir.X, 0);
		const double Reach = FMath::Abs(Dir.X) * Half.X + FMath::Abs(Dir.Y) * Half.Y;
		const double Width = FMath::Abs(Across.X) * Half.X + FMath::Abs(Across.Y) * Half.Y;
		FNYCPuff P;
		const float Lead = Rand.GetFraction();
		P.Pos = FVector(Centre.X, Centre.Y, 120.0) + Dir * (Reach * Rand.FRandRange(0.5f, 1.05f)) + Across * Rand.FRandRange(-1.f, 1.f) * FMath::Min(Width, 900.0);
		P.Vel = Dir * FMath::Lerp(500.f, 2100.f, Lead) * Size + Across * Rand.FRandRange(-120.f, 120.f);
		P.Drag = 0.5f;
		P.Rise = FVector(0, 0, Rand.FRandRange(4.f, 40.f)) + Director->Wind() * 0.4f;
		P.R0 = 210.f * Size;
		P.R1 = FMath::Lerp(720.f, 1550.f, Rand.GetFraction()) * Size;
		P.Squash = Rand.FRandRange(0.55f, 0.85f);
		P.Life = Rand.FRandRange(13.f, 26.f);
		P.FadeIn = 0.35f + 0.5f * Lead;
		P.GrowTau = 0.2f;
		P.Density = Rand.FRandRange(0.82f, 1.05f);
		P.Albedo = Colour * Rand.FRandRange(0.86f, 1.12f);
		P.NoiseM = 4.2f * Size + 1.f;
		P.bGroundHug = true;
		AddPuff(P);
	}
	// a boiling column over the site itself
	for (int32 i = 0; i < 6; ++i)
	{
		FNYCPuff P;
		P.Pos = FVector(Centre.X + Rand.FRandRange(-0.6f, 0.6f) * Half.X, Centre.Y + Rand.FRandRange(-0.6f, 0.6f) * Half.Y, 300.0 + i * 150.0 * Size);
		P.Vel = FVector(0, 0, 260.f + i * 130.f) * Size;
		P.Drag = 0.35f;
		P.Rise = Director->Wind() * 0.6f;
		P.R0 = 450.f * Size;
		P.R1 = (1100.f + 160.f * i) * Size;
		P.Life = Rand.FRandRange(14.f, 24.f);
		P.Density = 0.8f;
		P.Albedo = Colour * 0.92f;
		P.NoiseM = 5.5f * Size + 1.f;
		AddPuff(P);
	}
	const FVector Base(Centre.X, Centre.Y, 160.0);
	Burst(TEXT("NS_ShockRing"), Base, FMath::RoundToInt32(150.f * Size), 2.0f, 5.5f, 600.f * Size, 2400.f * Size, FVector(1, 0, 0.12), 180.f,
		FMath::Max(Half.X, Half.Y), FVector(0, 0, -30.f), 0.75f, 90.f * Size, 240.f * Size, FLinearColor(Colour.R, Colour.G, Colour.B, 0.55f));
	Litter(Base, FVector(0, 0, 900.f), 200);
	Sound(TEXT("dust_surge"), Base, FMath::Clamp(Size, 0.5f, 1.6f), 1.f);
}

void ANYCDestructionFX::RubbleSmoke(const FVector& At, float Radius, float Duration)
{
	const int32 Beats = FMath::Clamp(FMath::RoundToInt32(Duration / 1.6f), 1, 26);
	for (int32 i = 0; i < Beats; ++i)
	{
		Director->After(0.4f + i * Duration / Beats, [this, At, Radius]()
		{
			FNYCPuff P;
			P.Pos = At + FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), 0) * Radius * 0.55f + FVector(0, 0, 130);
			P.Rise = FVector(0, 0, Rand.FRandRange(90.f, 190.f)) + Director->Wind() * 0.7f;
			P.R0 = Radius * 0.14f + 60.f;
			P.R1 = Radius * 0.42f + 160.f;
			P.Life = Rand.FRandRange(8.f, 13.f);
			P.FadeIn = 1.2f;
			P.Density = 0.5f;
			P.Kind = ENYCVol::Smoke;
			P.Albedo = FLinearColor(0.24f, 0.22f, 0.2f);
			P.NoiseM = Radius / 230.f + 1.2f;
			AddPuff(P);
		});
	}
}

void ANYCDestructionFX::RubbleMound(const FVector& At, const FVector2D& Extent, float Height, const FString& Wall)
{
	const double Area = Extent.X * Extent.Y * 4.0 / 10000.0;       // m2
	const int32 Count = FMath::Clamp(FMath::RoundToInt32(Area / 3.2), 24, 520);
	auto Comp = [this, &Wall](int32 Kind) -> UInstancedStaticMeshComponent*
	{
		const FString Key = FString::Printf(TEXT("%d_%s"), Kind, Kind < 4 ? *Wall : TEXT(""));
		if (UInstancedStaticMeshComponent** Found = MoundByKey.Find(Key)) return *Found;
		UStaticMesh* M = Director->CityMesh(FString::Printf(TEXT("rubble%d"), Kind));
		if (!M) return nullptr;
		UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(M);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->bAffectDistanceFieldLighting = false;
		if (Kind < 4)
		{
			if (UMaterialInterface* Mat = Director->CityMaterial(Wall))
				for (int32 i = 0; i < M->GetStaticMaterials().Num(); ++i) C->SetMaterial(i, Mat);
		}
		C->SetupAttachment(RootComponent);
		C->RegisterComponent();
		Mounds.Add(C);
		MoundByKey.Add(Key, C);
		return C;
	};
	TArray<TArray<FTransform>> Batches;
	Batches.SetNum(6);
	FRandomStream R((int32)(At.X * 3 + At.Y));
	for (int32 i = 0; i < Count; ++i)
	{
		const double A = R.FRandRange(0.f, 2.f * PI), K = FMath::Sqrt(R.GetFraction());
		const FVector2D P(FMath::Cos(A) * K * Extent.X * 1.18, FMath::Sin(A) * K * Extent.Y * 1.18);
		const double Pile = Height * FMath::Pow(FMath::Max(0.0, 1.0 - K * K * 0.92), 0.8);
		const int32 Kind = R.GetFraction() < 0.1f ? 5 : R.GetFraction() < 0.2f ? 4 : R.RandRange(0, 3);
		const float Scale = R.FRandRange(0.55f, 1.9f) * (K < 0.5f ? 1.35f : 0.9f);
		const double Z = Pile * R.FRandRange(0.35f, 1.f);
		Batches[Kind].Add(FTransform(FRotator(R.FRandRange(-38.f, 38.f), R.FRandRange(0.f, 360.f), R.FRandRange(-38.f, 38.f)),
			FVector(At.X + P.X, At.Y + P.Y, Z + 10.0), FVector(Scale)));
		// fill beneath the surface so that the heap has no hollows
		if (Z > 160.0)
		{
			Batches[R.RandRange(0, 3)].Add(FTransform(FRotator(R.FRandRange(-20.f, 20.f), R.FRandRange(0.f, 360.f), R.FRandRange(-20.f, 20.f)),
				FVector(At.X + P.X, At.Y + P.Y, Z * 0.45), FVector(Scale * 1.7f, Scale * 1.7f, FMath::Max(1.f, (float)Z / 110.f))));
		}
	}
	for (int32 k = 0; k < 6; ++k)
	{
		if (Batches[k].Num() == 0) continue;
		if (UInstancedStaticMeshComponent* C = Comp(k)) C->AddInstances(Batches[k], false, true);
	}
}

static const int32 MaxGrains = 9000;

void ANYCDestructionFX::Gravel(const TArray<FVector>& At, const TArray<FVector>& Velocity, bool bBrick, int32 Seed)
{
	if (!Director || At.Num() == 0) return;
	// 0/1: brick ends and mortar; 2/3: concrete lumps.  Even = pebble mesh, odd = a scaled-down broken block.
	if (GravelComps.Num() == 0)
	{
		const TCHAR* Meshes_[4] = { TEXT("tl_pebble"), TEXT("rubble2"), TEXT("tl_pebble"), TEXT("rubble0") };
		const TCHAR* Mats_[4] = { TEXT("core_brick"), TEXT("core_brick"), TEXT("core_concrete"), TEXT("core_concrete") };
		for (int32 k = 0; k < 4; ++k)
		{
			UStaticMesh* M = Director->CityMesh(Meshes_[k]);
			if (!M) { GravelComps.Reset(); return; }
			UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
			C->SetMobility(EComponentMobility::Movable);
			C->SetStaticMesh(M);
			C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			C->bAffectDistanceFieldLighting = false;
			C->bVisibleInRayTracing = false;
			C->SetHasPerInstancePrevTransforms(true);
			if (UMaterialInterface* Mat = Director->CityMaterial(Mats_[k]))
				for (int32 i = 0; i < M->GetStaticMaterials().Num(); ++i) C->SetMaterial(i, Mat);
			C->SetupAttachment(RootComponent);
			C->RegisterComponent();
			GravelComps.Add(C);
		}
	}
	FRandomStream R(Seed * 104729 + 3);
	const double G = 980.0;
	for (int32 i = 0; i < At.Num(); ++i)
	{
		FGrain Grain;
		const bool bBlock = R.GetFraction() < 0.28f;
		Grain.Comp = (bBrick ? 0 : 2) + (bBlock ? 1 : 0);
		// most are fist sized, a few are the size of a suitcase
		const float Roll = R.GetFraction();
		Grain.Scale = bBlock ? 0.07f + 0.2f * Roll * Roll : 0.7f + 3.4f * Roll * Roll * Roll;
		Grain.Born = Clock;
		Grain.P0 = At[i];
		Grain.V0 = Velocity[i];
		const double Rest = 7.0 + R.FRandRange(0.f, 9.f);
		const double Drop = FMath::Max(Grain.P0.Z - Rest, 0.0);
		Grain.T1 = (float)((Grain.V0.Z + FMath::Sqrt(FMath::Max(Grain.V0.Z * Grain.V0.Z + 2.0 * G * Drop, 0.0))) / G);
		Grain.P1 = Grain.P0 + Grain.V0 * Grain.T1;
		Grain.P1.Z = Rest;
		const double Down = FMath::Abs(Grain.V0.Z - G * Grain.T1);
		Grain.V1 = FVector(Grain.V0.X * 0.3, Grain.V0.Y * 0.3, FMath::Min(Down * 0.17, 420.0));
		Grain.T2 = (float)(2.0 * Grain.V1.Z / G);
		Grain.Rot = FRotator(R.FRandRange(0.f, 360.f), R.FRandRange(0.f, 360.f), R.FRandRange(0.f, 360.f)).Quaternion();
		Grain.Axis = R.GetUnitVector();
		Grain.Spin = R.FRandRange(3.f, 11.f);
		Grain.bMoving = true;
		const FTransform Xf(Grain.Rot, Grain.P0, FVector(Grain.Scale));
		int32 Slot;
		if (Grains.Num() < MaxGrains)
		{
			Grain.Index = GravelComps[Grain.Comp]->AddInstance(Xf, true);
			Slot = Grains.Add(Grain);
			MovingGrains.Add(Slot);
		}
		else
		{
			// the oldest stone is taken up again
			Slot = NextGrain;
			NextGrain = (NextGrain + 1) % MaxGrains;
			Grain.Comp = Grains[Slot].Comp;
			Grain.Index = Grains[Slot].Index;
			if (!Grains[Slot].bMoving) MovingGrains.Add(Slot);
			Grains[Slot] = Grain;
		}
	}
}

void ANYCDestructionFX::UpdateGravel()
{
	if (MovingGrains.Num() == 0) return;
	TArray<bool> Dirty;
	Dirty.Init(false, GravelComps.Num());
	const FVector Fall(0, 0, -980.0);
	for (int32 m = MovingGrains.Num() - 1; m >= 0; --m)
	{
		FGrain& G = Grains[MovingGrains[m]];
		const float Age = (float)FMath::Max(Clock - G.Born, 0.0);
		FVector Pos;
		float Turned;
		const float Skid = 0.35f;
		if (Age < G.T1)
		{
			Pos = G.P0 + G.V0 * Age + 0.5 * Fall * Age * Age;
			Turned = G.Spin * Age;
		}
		else if (Age < G.T1 + G.T2)
		{
			const float T = Age - G.T1;
			Pos = G.P1 + G.V1 * T + 0.5 * Fall * T * T;
			Turned = G.Spin * (G.T1 + T * 0.55f);
		}
		else
		{
			const float T = FMath::Min(Age - G.T1 - G.T2, Skid);
			const FVector Land = G.P1 + FVector(G.V1.X, G.V1.Y, 0) * G.T2;
			Pos = Land + FVector(G.V1.X, G.V1.Y, 0) * 0.5 * (T - 0.5 * T * T / Skid);
			Turned = G.Spin * (G.T1 + G.T2 * 0.55f + T * 0.2f);
			if (T >= Skid) G.bMoving = false;
		}
		const FTransform Xf(FQuat(G.Axis, Turned) * G.Rot, Pos, FVector(G.Scale));
		FTransform Before;
		if (!GravelComps[G.Comp]->GetInstanceTransform(G.Index, Before, true) || FVector::DistSquared(Before.GetLocation(), Pos) > FMath::Square(400.0)) Before = Xf;
		const TArray<FTransform> Now_ = { Xf }, Prev_ = { Before };
		GravelComps[G.Comp]->BatchUpdateInstancesTransforms(G.Index, Now_, Prev_, true, false, false);
		Dirty[G.Comp] = true;
		if (!G.bMoving) MovingGrains.RemoveAtSwap(m);
	}
	for (int32 k = 0; k < Dirty.Num(); ++k)
		if (Dirty[k]) GravelComps[k]->MarkRenderInstancesDirty();
}

void ANYCDestructionFX::GlassBurst(const FVector& At, const FVector& Velocity, const FVector2D& Size)
{
	const int32 Count = FMath::Clamp(FMath::RoundToInt32(Size.X * Size.Y / 260.0), 24, 150);
	const float Speed = FMath::Max(120.f, (float)Velocity.Size());
	Burst(TEXT("NS_Glass"), At, Count, 0.9f, 2.2f, Speed * 0.25f, Speed * 1.25f, Velocity, 58.f, FMath::Max(Size.X, Size.Y) * 0.35f,
		FVector(0, 0, -981.f), 0.25f, 2.2f, 9.5f, FLinearColor(0.5f, 0.66f, 0.63f, 1.f));
	Burst(TEXT("NS_Sparks"), At, Count / 7, 0.25f, 0.7f, Speed * 0.3f, Speed, Velocity, 70.f, FMath::Max(Size.X, Size.Y) * 0.35f,
		FVector(0, 0, -981.f), 0.5f, 1.2f, 3.2f, FLinearColor(0.45f, 0.62f, 0.7f, 0.55f));
	Sound(TEXT("glass"), At, FMath::Clamp(Count / 90.f, 0.35f, 1.f), Rand.FRandRange(0.85f, 1.18f));
}

void ANYCDestructionFX::Fire(const FVector& At, float Radius, float Duration)
{
	const float R = FMath::Max(Radius, 18.f);
	if (R > 65.f)
	{
		FNYCPuff P;
		P.Pos = At + FVector(0, 0, R * 0.5f);
		P.Rise = FVector(0, 0, R * 0.55f) + Director->Wind() * 0.15f;
		P.R0 = R * 0.62f;
		P.R1 = R * 1.05f;
		P.Squash = 1.45f;
		P.Life = FMath::Min(Duration, 1.7f);
		P.FadeIn = 0.1f;
		P.Density = 0.75f;
		P.Kind = ENYCVol::Flame;
		P.Albedo = FLinearColor(0.03f, 0.025f, 0.022f);
		P.Glow = 30000.f * GlowScale();
		P.NoiseM = R / 140.f + 0.35f;
		AddPuff(P);
	}
	Stream(TEXT("NS_FlameStream"), At, Duration, FMath::Clamp(R * 0.45f, 14.f, 110.f), 0.35f, 0.95f, R * 0.6f, R * 1.9f, FVector::UpVector, 16.f, R * 0.45f,
		FVector(0, 0, 130.f), 0.7f, R * 0.34f + 8.f, R * 0.74f + 16.f, FLinearColor(1.f, 0.9f, 0.82f, 0.95f));
	if (Duration > 1.5f)
	{
		Stream(TEXT("NS_SmokeStream"), At + FVector(0, 0, R * 1.2f), Duration, FMath::Clamp(R * 0.07f, 3.f, 18.f), 2.4f, 5.f, R * 0.8f, R * 1.7f, FVector::UpVector, 14.f, R * 0.3f,
			FVector(Director->Wind().X * 0.18f, Director->Wind().Y * 0.18f, 60.f), 0.3f, R * 0.5f + 20.f, R * 0.9f + 40.f, FLinearColor(0.05f, 0.045f, 0.04f, 0.5f));
		Stream(TEXT("NS_Embers"), At, Duration, FMath::Clamp(R * 0.09f, 3.f, 26.f), 1.2f, 3.2f, R * 0.7f, R * 2.4f, FVector::UpVector, 30.f, R * 0.5f,
			FVector(0, 0, 110.f), 0.5f, 1.6f, 4.5f, FLinearColor(1.f, 0.42f, 0.08f, 1.f));
		Sound(TEXT("fire"), At, FMath::Clamp(R / 150.f, 0.2f, 1.f), Rand.FRandRange(0.9f, 1.1f));
	}
	Glow(At + FVector(0, 0, R * 0.8f), FLinearColor(1.f, 0.45f, 0.14f), 14.f * R * R * GlowScale() + 250.f, R * 14.f + 500.f, Duration, 0.35f);
}

void ANYCDestructionFX::Fireball(const FVector& At, float Radius, float Duration, float FlashScale)
{
	const bool bBright = AllowFlash();
	const float Soft = bBright ? 1.f : 0.45f;
	const int32 N = FMath::Clamp(FMath::RoundToInt32(Radius / 260.f) + 2, 2, 7);
	for (int32 i = 0; i < N; ++i)
	{
		FNYCPuff P;
		const FVector Off = i == 0 ? FVector::ZeroVector : FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-0.25f, 1.f)).GetSafeNormal() * Radius * 0.55f;
		P.Pos = At + Off * 0.45f;
		P.Vel = Off * 1.7f + FVector(0, 0, Radius * 0.25f);
		P.Drag = 1.9f;
		P.Rise = FVector(0, 0, Radius * 0.22f) + Director->Wind() * 0.25f;
		P.R0 = Radius * (i == 0 ? 0.34f : 0.22f);
		P.R1 = Radius * (i == 0 ? 1.0f : Rand.FRandRange(0.52f, 0.8f));
		P.Life = Duration * Rand.FRandRange(2.1f, 3.1f);
		P.FadeIn = bBright ? 0.025f : 0.35f;
		P.GrowTau = 0.075f;
		P.Density = 1.35f;
		P.Kind = ENYCVol::Fireball;
		P.Albedo = FLinearColor(0.045f, 0.036f, 0.03f);
		P.Glow = 82000.f * GlowScale() * Soft;
		P.NoiseM = Radius / 190.f + 0.5f;
		AddPuff(P);
	}
	if (FlashScale > 0.f)
	{
		Flash(At + FVector(0, 0, Radius * 0.4f), FLinearColor(1.f, 0.62f, 0.3f), 34.f * Radius * Radius * FlashScale * GlowScale(), Radius * 22.f + 1500.f, 0.35f + Radius / 2500.f, 0.3f);
	}
	// the smoke left behind rises as the glow dies
	const int32 Smokes = FMath::Clamp(N - 1, 1, 4);
	for (int32 i = 0; i < Smokes; ++i)
	{
		Director->After(Duration * (0.45f + 0.22f * i), [this, At, Radius, i]()
		{
			FNYCPuff P;
			P.Pos = At + FVector(Rand.FRandRange(-0.35f, 0.35f) * Radius, Rand.FRandRange(-0.35f, 0.35f) * Radius, Radius * (0.4f + 0.22f * i));
			P.Rise = FVector(0, 0, Radius * 0.2f + 90.f) + Director->Wind() * 0.5f;
			P.R0 = Radius * 0.45f;
			P.R1 = Radius * 0.95f;
			P.Life = 7.f + Radius / 300.f;
			P.FadeIn = 0.5f;
			P.Density = 0.72f;
			P.Kind = ENYCVol::Smoke;
			P.Albedo = FLinearColor(0.055f, 0.048f, 0.043f);
			P.NoiseM = Radius / 220.f + 0.7f;
			AddPuff(P);
		});
	}
	Sparks(At, FVector(0, 0, Radius * 2.2f), FMath::Clamp(FMath::RoundToInt32(Radius * 0.55f), 30, 460), FLinearColor(1.f, 0.55f, 0.18f), 130.f);
}

void ANYCDestructionFX::SmokeColumn(const FVector& At, float Radius, float Duration, float Darkness)
{
	const float Tone = FMath::Lerp(0.42f, 0.035f, Darkness);
	Stream(TEXT("NS_SmokeStream"), At, Duration, 9.f, 3.5f, 7.f, Radius * 1.4f, Radius * 2.6f, FVector::UpVector, 13.f, Radius * 0.4f,
		FVector(Director->Wind().X * 0.22f, Director->Wind().Y * 0.22f, 45.f), 0.22f, Radius * 0.75f, Radius * 1.35f, FLinearColor(Tone, Tone * 0.94f, Tone * 0.88f, 0.55f));
	const int32 Beats = FMath::Clamp(FMath::RoundToInt32(Duration / 2.2f), 1, 14);
	for (int32 i = 0; i < Beats; ++i)
	{
		Director->After(i * Duration / Beats + 0.2f, [this, At, Radius, Tone]()
		{
			FNYCPuff P;
			P.Pos = At + FVector(0, 0, Radius * 0.8f);
			P.Rise = FVector(0, 0, Radius * 1.25f + 60.f) + Director->Wind() * 0.65f;
			P.R0 = Radius * 0.7f;
			P.R1 = Radius * 2.2f;
			P.Life = 9.f;
			P.FadeIn = 0.9f;
			P.Density = 0.55f;
			P.Kind = ENYCVol::Smoke;
			P.Albedo = FLinearColor(Tone, Tone * 0.94f, Tone * 0.9f);
			P.NoiseM = Radius / 110.f + 0.8f;
			AddPuff(P);
		});
	}
}

void ANYCDestructionFX::Splinters(const FVector& At, const FVector& Velocity, int32 Count)
{
	const float Speed = FMath::Max(150.f, (float)Velocity.Size());
	Burst(TEXT("NS_Splinters"), At, Count, 0.8f, 2.0f, Speed * 0.3f, Speed * 1.3f, Velocity, 75.f, 30.f, FVector(0, 0, -981.f), 0.7f,
		3.f, 14.f, FLinearColor(0.24f, 0.15f, 0.075f, 1.f));
}

void ANYCDestructionFX::Sparks(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint, float Spread)
{
	const float Speed = FMath::Max(150.f, (float)Velocity.Size());
	Burst(TEXT("NS_Sparks"), At, Count, 0.25f, 1.25f, Speed * 0.25f, Speed * 1.35f, Velocity, Spread, 6.f, FVector(0, 0, -981.f), 0.45f,
		2.4f, 8.5f, FLinearColor(Tint.R, Tint.G, Tint.B, 1.f));
}

void ANYCDestructionFX::Litter(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint)
{
	const float Speed = FMath::Max(100.f, (float)Velocity.Size());
	Burst(TEXT("NS_Paper"), At, Count, 2.5f, 6.f, Speed * 0.15f, Speed * 0.9f, Velocity, 100.f, 90.f, FVector(Director->Wind().X * 0.25f, Director->Wind().Y * 0.25f, -150.f), 1.9f,
		5.f, 19.f, FLinearColor(Tint.R, Tint.G, Tint.B, 1.f));
}

void ANYCDestructionFX::Chips(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint, float MinSize, float MaxSize, float Spread)
{
	const float Speed = FMath::Max(100.f, (float)Velocity.Size());
	Burst(TEXT("NS_Chips"), At, Count, 0.9f, 2.4f, Speed * 0.25f, Speed * 1.35f, Velocity, Spread, 20.f, FVector(0, 0, -981.f), 0.2f,
		MinSize, MaxSize, FLinearColor(Tint.R, Tint.G, Tint.B, 1.f));
}

void ANYCDestructionFX::WaterJet(const FVector& At, const FVector& Direction, float Duration, float Strength)
{
	const FVector Dir = Direction.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);
	const float S = FMath::Clamp(Strength, 0.2f, 4.f);
	Stream(TEXT("NS_WaterJet"), At, Duration, 640.f * S, 0.9f, 2.0f, 850.f * FMath::Sqrt(S), 1550.f * FMath::Sqrt(S), Dir, 6.5f, 9.f * S,
		FVector(Director->Wind().X * 0.3f, Director->Wind().Y * 0.3f, -981.f), 0.25f, 5.f, 17.f * FMath::Sqrt(S), FLinearColor(0.82f, 0.88f, 0.92f, 0.75f));
	Stream(TEXT("NS_SmokeStream"), At + Dir * 420.f * S, Duration, 9.f, 1.2f, 2.6f, 60.f, 220.f, Dir, 55.f, 90.f * S,
		FVector(Director->Wind().X * 0.5f, Director->Wind().Y * 0.5f, -60.f), 0.9f, 60.f * S, 150.f * S, FLinearColor(0.4f, 0.43f, 0.46f, 0.17f));
	const int32 Beats = FMath::Clamp(FMath::RoundToInt32(Duration / 0.45f), 1, 70);
	for (int32 i = 0; i < Beats; ++i)
	{
		Director->After(i * Duration / Beats, [this, At, S]() { Splash(At + FVector(Rand.FRandRange(-260.f, 260.f), Rand.FRandRange(-260.f, 260.f), 8.f) * S, 70.f * S, 0.4f); });
	}
	Sound(TEXT("water"), At, FMath::Clamp(S, 0.3f, 1.4f), 1.f);
}

void ANYCDestructionFX::Splash(const FVector& At, float Radius, float Strength)
{
	Burst(TEXT("NS_Water"), At, FMath::Clamp(FMath::RoundToInt32(Radius * 0.9f * Strength), 12, 600), 0.4f, 1.3f, Radius * 1.4f, Radius * 4.2f, FVector::UpVector, 62.f,
		Radius * 0.35f, FVector(0, 0, -981.f), 0.35f, 3.f, 12.f, FLinearColor(0.8f, 0.86f, 0.9f, 0.7f));
}

void ANYCDestructionFX::Motes(const FVector& At, int32 Count, const FLinearColor& Tint, float Radius, float Speed, float Life, float Size, const FVector& Gravity)
{
	Burst(TEXT("NS_Motes"), At, Count, Life * 0.55f, Life, Speed * 0.3f, Speed, FVector::UpVector, 180.f, Radius, Gravity, 0.8f, Size * 0.5f, Size * 1.5f, Tint);
}

// ------------------------------------------------------------------ crater
void ANYCDestructionFX::Crater(const FVector& At, float Radius, float Depth)
{
	UStaticMeshComponent* C = Mesh(TEXT("fx_craterdisc"), FTransform(FRotator::ZeroRotator, FVector(At.X, At.Y, 17.0 + Craters.Num() * 0.07),
		FVector(Radius * 1.75 / 100.0, Radius * 1.75 / 100.0, 1.0)));
	if (!C) return;
	C->SetCustomPrimitiveDataFloat(0, Radius);
	C->SetCustomPrimitiveDataFloat(1, Depth);
	C->SetCustomPrimitiveDataFloat(2, Rand.FRandRange(0.f, 30.f));
	C->SetCustomPrimitiveDataFloat(3, 1.f);
	C->CastShadow = false;
	Craters.Add({ C, Clock });
	// broken paving heaved up around the rim
	const int32 N = FMath::Clamp(FMath::RoundToInt32(Radius / 22.f), 10, 90);
	for (int32 i = 0; i < N; ++i)
	{
		const double A = (i + Rand.GetFraction() * 0.8) / N * 2.0 * PI;
		const double R = Radius * Rand.FRandRange(0.9f, 1.18f);
		const FVector P(At.X + FMath::Cos(A) * R, At.Y + FMath::Sin(A) * R, Rand.FRandRange(8.f, 26.f));
		const float Scale = FMath::Clamp(Radius / 330.f, 0.22f, 2.3f) * Rand.FRandRange(0.45f, 1.1f);
		const FRotator Rot(Rand.FRandRange(-34.f, 34.f), FMath::RadiansToDegrees(A) + Rand.FRandRange(-30.f, 30.f), Rand.FRandRange(-34.f, 34.f));
		Mesh(Rand.GetFraction() < 0.3f ? TEXT("rubble4") : FString::Printf(TEXT("rubble%d"), Rand.RandRange(0, 3)),
			FTransform(Rot, P, FVector(Scale, Scale, Scale * 0.5f)), -1.f, Director->CityMaterial(Rand.GetFraction() < 0.6f ? TEXT("granite_black") : TEXT("concrete")));
	}
}

// ------------------------------------------------------------------ lights and flashes
static TAutoConsoleVariable<int32> CVarLogVolumes(TEXT("nyc.LogVolumes"), 0, TEXT("Log how much light each new cloud gets"));

bool ANYCDestructionFX::AllowFlash()
{
	FlashTimes.RemoveAll([this](double T) { return Clock - T > 1.05; });
	// several blasts in the same instant read as one flash
	if (FlashTimes.Num() && Clock - FlashTimes.Last() < 0.07)
	{
		++FlashesFull;
		return true;
	}
	if (FlashTimes.Num() >= 2)
	{
		++FlashesSoftened;
		return false;
	}
	FlashTimes.Add(Clock);
	++FlashesFull;
	return true;
}

int32 ANYCDestructionFX::LightSlot()
{
	for (int32 i = 0; i < LightBusy.Num(); ++i)
		if (!LightBusy[i]) return i;
	if (LightPool.Num() >= MaxLights) return INDEX_NONE;
	UPointLightComponent* L = NewObject<UPointLightComponent>(this, NAME_None, RF_Transient);
	L->SetMobility(EComponentMobility::Movable);
	L->IntensityUnits = ELightUnits::Candelas;
	L->SetupAttachment(RootComponent);
	L->SourceRadius = 40.f;
	L->CastShadows = LightPool.Num() < 8;
	L->VolumetricScatteringIntensity = 0.7f;
	L->RegisterComponent();
	LightPool.Add(L);
	LightBusy.Add(false);
	return LightPool.Num() - 1;
}

void ANYCDestructionFX::Flash(const FVector& At, const FLinearColor& Color, float Candela, float Radius, float Duration, float Flicker)
{
	const bool bBright = AllowFlash();
	const int32 Slot = LightSlot();
	if (Slot == INDEX_NONE) return;
	LightBusy[Slot] = true;
	UPointLightComponent* L = LightPool[Slot];
	L->SetWorldLocation(At);
	L->SetLightColor(Color);
	L->SetAttenuationRadius(Radius);
	L->SetVisibility(true);
	L->SetIntensity(0.f);
	// a rationed flash swells and fades instead of snapping on
	Lights.Add({ Slot, Clock, bBright ? Duration : Duration * 2.2f, bBright ? Candela : Candela * 0.28f, Flicker, bBright ? 0.02f : 0.4f, true, NextId++ });
}

int32 ANYCDestructionFX::Glow(const FVector& At, const FLinearColor& Color, float Candela, float Radius, float Duration, float Flicker)
{
	const int32 Slot = LightSlot();
	if (Slot == INDEX_NONE) return 0;
	LightBusy[Slot] = true;
	UPointLightComponent* L = LightPool[Slot];
	L->SetWorldLocation(At);
	L->SetLightColor(Color);
	L->SetAttenuationRadius(Radius);
	L->SetVisibility(true);
	L->SetIntensity(0.f);
	const int32 Id = NextId++;
	Lights.Add({ Slot, Clock, Duration, Candela, Flicker, FMath::Min(0.5f, Duration * 0.2f), false, Id });
	return Id;
}

void ANYCDestructionFX::MoveLight(int32 Id, const FVector& At)
{
	for (const FLightFx& F : Lights)
		if (F.Id == Id) LightPool[F.Slot]->SetWorldLocation(At);
}

// ------------------------------------------------------------------ shock and beams
void ANYCDestructionFX::ShockDome(const FVector& At, float MaxRadius, float Speed, float Strength, const FLinearColor& Color)
{
	UStaticMeshComponent* C = Mesh(TEXT("fx_dome"), FTransform(FRotator::ZeroRotator, At, FVector(1.0)));
	if (!C) return;
	C->CastShadow = false;
	C->bVisibleInRayTracing = false;
	C->SetCustomPrimitiveDataFloat(4, Color.R);
	C->SetCustomPrimitiveDataFloat(5, Color.G);
	C->SetCustomPrimitiveDataFloat(6, Color.B);
	C->SetCustomPrimitiveDataFloat(0, 0.f);
	Shells.Add({ C, At, MaxRadius, Speed, Strength, Clock });
}

void ANYCDestructionFX::GroundRing(const FVector& At, float Radius, float Speed, float Amount, const FString& Wall)
{
	const FLinearColor Colour = DustColour(Wall);
	const int32 Rings = FMath::Clamp(FMath::RoundToInt32(Radius / 1600.f) + 1, 2, 7);
	for (int32 k = 1; k <= Rings; ++k)
	{
		const float R = Radius * k / Rings;
		Director->After(R / FMath::Max(Speed, 100.f), [this, At, R, Speed, Amount, Colour, k, Rings]()
		{
			const int32 N = FMath::Clamp(FMath::RoundToInt32(2.f * PI * R / 900.f), 7, 26);
			for (int32 i = 0; i < N; ++i)
			{
				const double A = (i + Rand.GetFraction() * 0.7) / N * 2.0 * PI;
				const FVector Out(FMath::Cos(A), FMath::Sin(A), 0);
				FNYCPuff P;
				P.Pos = FVector(At.X, At.Y, 140.0) + Out * R;
				P.Vel = Out * Speed * 0.22f;
				P.Drag = 0.9f;
				P.Rise = FVector(0, 0, 28.f) + Director->Wind() * 0.4f;
				P.R0 = 150.f + R * 0.03f;
				P.R1 = FMath::Min(1500.f, 380.f + R * 0.11f);
				P.Squash = 0.62f;
				P.Life = Rand.FRandRange(6.f, 13.f);
				P.FadeIn = 0.14f;
				P.Density = 0.78f * Amount * (1.f - 0.35f * k / Rings);
				P.Albedo = Colour * Rand.FRandRange(0.9f, 1.1f);
				P.NoiseM = P.R1 / 260.f;
				P.bGroundHug = true;
				AddPuff(P);
			}
		});
	}
	Burst(TEXT("NS_ShockRing"), FVector(At.X, At.Y, 60.0), FMath::Clamp(FMath::RoundToInt32(Radius / 9.f), 60, 700), 0.9f, 2.6f, Speed * 0.55f, Speed * 1.05f,
		FVector(1, 0, 0.05), 180.f, 90.f, FVector(0, 0, 0), 0.55f, 55.f, 170.f, FLinearColor(Colour.R, Colour.G, Colour.B, 0.5f));
}

int32 ANYCDestructionFX::Beam(const FVector& A, const FVector& B, float Radius, const FLinearColor& Color, float Nits, float Duration)
{
	UStaticMeshComponent* C = Mesh(TEXT("fx_beam"), FTransform::Identity);
	if (!C) return 0;
	C->CastShadow = false;
	C->bVisibleInRayTracing = false;
	C->SetCustomPrimitiveDataFloat(4, Color.R);
	C->SetCustomPrimitiveDataFloat(5, Color.G);
	C->SetCustomPrimitiveDataFloat(6, Color.B);
	C->SetCustomPrimitiveDataFloat(7, Nits * GlowScale());
	const int32 Id = NextId++;
	Beams.Add({ Id, C, A, B, Radius, Duration, Clock });
	MoveBeam(Id, A, B, Radius);
	return Id;
}

void ANYCDestructionFX::MoveBeam(int32 Id, const FVector& A, const FVector& B, float Radius)
{
	for (FBeamFx& F : Beams)
	{
		if (F.Id != Id) continue;
		F.A = A;
		F.B = B;
		if (Radius > 0.f) F.Radius = Radius;
		const FVector D = B - A;
		const double Len = FMath::Max(D.Size(), 1.0);
		F.Comp->SetWorldTransform(FTransform(FQuat::FindBetweenNormals(FVector::UpVector, D / Len), A, FVector(F.Radius / 100.0, F.Radius / 100.0, Len / 100.0)));
	}
}

void ANYCDestructionFX::MushroomCloud(const FVector& At, float Radius, float Duration, float BurstHeight)
{
	const bool bBright = AllowFlash();
	FNYCPuff Look;
	Look.Pos = At + FVector(0, 0, Radius * 0.3f);
	Look.R0 = Radius * 0.22f;
	Look.Kind = ENYCVol::Mushroom;
	Look.Albedo = FLinearColor(0.245f, 0.198f, 0.162f);
	Look.Glow = 105000.f * GlowScale() * (bBright ? 1.f : 0.5f);
	Look.NoiseM = Radius / 380.f;
	Look.Density = 1.35f;
	Look.Life = Duration;
	Look.FadeIn = bBright ? 0.14f : 0.7f;
	const int32 Id = DrivenVolume(Look);
	const FVector Base = At;
	Director->During(Duration, [this, Id, Base, Radius, Duration, BurstHeight](float T, float)
	{
		// a violent first swelling, then a long climb that keeps spreading
		const float Pop = 1.f - FMath::Exp(-T / 0.42f);
		const float Grow = 1.f - FMath::Exp(-T / 3.6f);
		const float R = Radius * (0.2f + 0.2f * Pop + 0.6f * Grow) * (1.f + 0.18f * FMath::Min(T / Duration, 1.f));
		const float Squash = 1.12f;
		const float Heat = 105000.f * GlowScale() * (0.22f + 0.78f * FMath::Exp(-T / 3.0f));
		// the volume's floor sits on the ground; an airburst's ball starts at its own height and settles onto it
		const float Grounded = R * Squash * 0.93f + FMath::Max(0.f, T - 5.f) * Radius * 0.012f;
		float Z = Grounded;
		if (BurstHeight > 0.f)
		{
			const float Ball = BurstHeight + 0.44f * R * Squash;
			Z = FMath::Lerp(FMath::Max(Ball, Grounded), Grounded, FMath::SmoothStep(0.25f, 2.6f, T));
		}
		DriveVolume(Id, Base + FVector(0, 0, Z), R, Squash, -1.f, Heat);
	});
	Director->After(Duration, [this, Id]() { EndVolume(Id, 6.f); });
	SetVolumeOrder(Id, 3);
	Glow(At + FVector(0, 0, Radius * 0.9f), FLinearColor(1.f, 0.5f, 0.2f), 0.32f * Radius * Radius * GlowScale(), Radius * 6.f, 7.f, 0.15f);
}

void ANYCDestructionFX::CondensationRing(const FVector& At, float MaxRadius, float Duration, float Delay)
{
	Director->After(Delay, [this, At, MaxRadius, Duration]()
	{
		FNYCPuff Look;
		Look.Pos = At;
		Look.R0 = MaxRadius * 0.2f;
		Look.Kind = ENYCVol::Condensation;
		Look.Albedo = FLinearColor(0.78f, 0.8f, 0.83f);
		Look.Density = 1.f;
		Look.Life = Duration;
		Look.FadeIn = 0.25f;
		const int32 Id = DrivenVolume(Look);
		Director->During(Duration, [this, Id, At, MaxRadius, Duration](float T, float)
		{
			const float U = FMath::Clamp(T / Duration, 0.f, 1.f);
			const float R = MaxRadius * (0.2f + 0.8f * (1.f - FMath::Square(1.f - U)));
			const float Strength = FMath::SmoothStep(0.f, 0.12f, U) * (1.f - FMath::SmoothStep(0.45f, 1.f, U));
			DriveVolume(Id, At, R, 0.72f, Strength, 0.f);
		});
		Director->After(Duration, [this, Id]() { EndVolume(Id, 0.1f); });
		SetVolumeOrder(Id, 4);
	});
}

void ANYCDestructionFX::StreetSurge(const FVector& At, float From, float To, float Speed, float Size, const FString& Wall)
{
	// Midtown's grid in this model: avenues run along x at these y, cross streets along y at these x (metres)
	static const float Avenues[] = { -1785.f, -1500.f, -1215.f, -931.f, -621.f, -311.f, 0.f, 155.f, 320.f, 470.f, 630.f, 845.f, 1075.f };
	static const float Streets[] = { -1444.8f, -1365.5f, -1286.3f, -1207.f, -1127.8f, -1048.5f, -969.3f, -890.f, -810.8f, -731.5f, -646.2f, -560.8f, -481.6f,
		-402.3f, -323.1f, -243.8f, -164.6f, -85.3f, 0.f, 85.3f, 164.6f, 243.8f, 323.1f, 402.3f, 481.6f, 560.8f, 640.1f, 719.3f, 798.6f, 877.8f, 957.1f, 1036.3f,
		1115.6f, 1200.9f, 1286.3f, 1365.5f, 1444.8f, 1524.f };
	struct FLine { bool bAlongX; double Off; double Gap; };
	TArray<FLine> Lines;
	auto Nearest = [&](const float* List, int32 Num, double Coordinate, bool bAlongX, int32 Take)
	{
		TArray<FLine> Found;
		for (int32 i = 0; i < Num; ++i) Found.Add({ bAlongX, List[i] * 100.0, FMath::Abs(List[i] * 100.0 - Coordinate) });
		Found.Sort([](const FLine& A, const FLine& B) { return A.Gap < B.Gap; });
		for (int32 i = 0; i < FMath::Min(Take, Found.Num()); ++i) Lines.Add(Found[i]);
	};
	// a bigger blast fills streets further to the side, spaced out so the fronts stay separate
	Nearest(Avenues, UE_ARRAY_COUNT(Avenues), At.Y, true, 3);
	Nearest(Streets, UE_ARRAY_COUNT(Streets), At.X, false, 5);
	const FLinearColor Colour = DustColour(Wall) * 1.1f;
	const int32 Beats = 5;
	for (int32 l = 0; l < Lines.Num(); ++l)
	{
		const FLine& Line = Lines[l];
		for (int32 Sign = -1; Sign <= 1; Sign += 2)
		{
			const FVector Along = Line.bAlongX ? FVector(Sign, 0, 0) : FVector(0, Sign, 0);
			for (int32 k = 0; k < Beats; ++k)
			{
				const float Reach = FMath::Lerp(From, To, (k + 0.35f + 0.3f * ((l + k) % 3) / 3.f) / Beats);
				const double Along2 = FMath::Sqrt(FMath::Max(0.0, (double)Reach * Reach - Line.Gap * Line.Gap));
				if (Along2 <= 0.0) continue;
				const FVector Pos = Line.bAlongX ? FVector(At.X + Sign * Along2, Line.Off, Size * 0.22f) : FVector(Line.Off, At.Y + Sign * Along2, Size * 0.22f);
				// the dust is pushed faster early on and slows as it spreads
				Director->After((Reach - From) / FMath::Max(Speed, 100.f) * (1.f + 0.35f * k / Beats), [this, Pos, Along, Size, Speed, Colour, k]()
				{
					FNYCPuff Q;
					Q.Pos = Pos;
					Q.Vel = Along * Speed * 0.3f;
					Q.Drag = 0.75f;
					Q.Rise = FVector(0, 0, Rand.FRandRange(25.f, 90.f)) + Director->Wind() * 0.35f;
					Q.R0 = Size * 0.4f;
					Q.R1 = Size * Rand.FRandRange(0.95f, 1.4f);
					Q.Squash = Rand.FRandRange(0.5f, 0.68f);
					Q.Life = Rand.FRandRange(16.f, 30.f);
					Q.FadeIn = 0.18f;
					Q.GrowTau = 0.1f;
					Q.Density = 1.12f - k * 0.08f;
					Q.Kind = ENYCVol::Dust;
					Q.Albedo = Colour * Rand.FRandRange(0.82f, 1.14f);
					Q.NoiseM = Size / 360.f + 1.f;
					Q.bGroundHug = true;
					AddPuff(Q);
				});
			}
		}
	}
}

void ANYCDestructionFX::BlastScorch(const FVector& At, float Radius, float Speed)
{
	UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/NYC/Materials/M_Scorch.M_Scorch"), nullptr, LOAD_NoWarn | LOAD_Quiet);
	if (!Base) return;
	UDecalComponent* C = NewObject<UDecalComponent>(this, NAME_None, RF_Transient);
	C->SetupAttachment(RootComponent);
	UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(Base, C);
	M->SetScalarParameterValue(TEXT("Front"), 0.f);
	C->SetDecalMaterial(M);
	// projected straight down through streets and low roofs
	C->DecalSize = FVector(3500.f, Radius, Radius);
	C->SetWorldLocationAndRotation(At + FVector(0, 0, 1500.f), FRotator(-90.f, 0.f, 0.f));
	C->FadeScreenSize = 0.f;
	C->RegisterComponent();
	Scorches.Add({ C, M, Clock, Radius, Speed });
}


// ------------------------------------------------------------------ meshes
UStaticMeshComponent* ANYCDestructionFX::Mesh(const FString& Name, const FTransform& Xf, float Life, UMaterialInterface* Override)
{
	UStaticMesh* M = Director->CityMesh(Name);
	if (!M)
	{
		UE_LOG(LogNYC, Warning, TEXT("Effect mesh missing: %s"), *Name);
		return nullptr;
	}
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, NAME_None, RF_Transient);
	C->SetMobility(EComponentMobility::Movable);
	C->SetStaticMesh(M);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->bAffectDistanceFieldLighting = false;
	if (Override)
		for (int32 i = 0; i < M->GetStaticMaterials().Num(); ++i) C->SetMaterial(i, Override);
	C->SetupAttachment(RootComponent);
	C->SetWorldTransform(Xf);
	C->RegisterComponent();
	Meshes.Add(C);
	if (Life > 0.f) Timed.Add({ C, Clock + Life });
	return C;
}

void ANYCDestructionFX::RemoveMesh(UStaticMeshComponent* C)
{
	if (!C) return;
	Meshes.Remove(C);
	Timed.RemoveAll([C](const FTimed& T) { return T.Comp == C; });
	if (IsValid(C)) C->DestroyComponent();
}

// ------------------------------------------------------------------ time
void ANYCDestructionFX::Advance(double Time, float Dt)
{
	Clock = Time;
	UpdateGravel();
	for (FVolume& V : Volumes)
		if (!V.bDead) UpdateVolume(V);
	for (int32 i = Streams.Num() - 1; i >= 0; --i)
	{
		if (Clock > Streams[i].Until)
		{
			if (UNiagaraComponent* C = Streams[i].Comp.Get()) C->DestroyComponent();
			Streams.RemoveAtSwap(i);
		}
	}
	for (int32 i = Lights.Num() - 1; i >= 0; --i)
	{
		const FLightFx& F = Lights[i];
		const float Age = (float)(Clock - F.Born);
		UPointLightComponent* L = LightPool[F.Slot];
		if (Age >= F.Life)
		{
			L->SetVisibility(false);
			LightBusy[F.Slot] = false;
			Lights.RemoveAt(i);
			continue;
		}
		const float In = FMath::SmoothStep(0.f, 1.f, Age / FMath::Max(F.Rise, 0.005f));
		const float Out = F.bFlash ? FMath::Square(1.f - Age / F.Life) : FMath::Min(1.f, (F.Life - Age) / FMath::Max(F.Life * 0.22f, 0.2f));
		// flicker stays small and slow enough that it never counts as flashing
		const float Wob = 1.f + F.Flicker * 0.22f * (FMath::Sin(Age * 23.0f + F.Slot) * 0.6f + FMath::Sin(Age * 37.0f) * 0.4f);
		L->SetIntensity(F.Candela * In * Out * Wob);
	}
	for (int32 i = Shells.Num() - 1; i >= 0; --i)
	{
		FShellFx& S = Shells[i];
		const float Age = (float)(Clock - S.Born);
		const float R = 150.f + S.Speed * Age;
		if (R >= S.MaxR)
		{
			RemoveMesh(S.Comp);
			Shells.RemoveAt(i);
			continue;
		}
		S.Comp->SetWorldScale3D(FVector(R / 100.f));
		const float K = R / S.MaxR;
		S.Comp->SetCustomPrimitiveDataFloat(0, S.Strength * FMath::Min(1.f, Age / 0.12f) * FMath::Square(1.f - K));
		S.Comp->SetCustomPrimitiveDataFloat(3, Age);
	}
	for (const FScorch& F : Scorches)
	{
		if (UMaterialInstanceDynamic* M = F.Mat.Get()) M->SetScalarParameterValue(TEXT("Front"), FMath::Min((float)(Clock - F.Born) * F.Speed / F.Radius, 1.f));
	}
	for (int32 i = Beams.Num() - 1; i >= 0; --i)
	{
		FBeamFx& F = Beams[i];
		const float Age = (float)(Clock - F.Born);
		if (Age >= F.Life)
		{
			RemoveMesh(F.Comp);
			Beams.RemoveAt(i);
			continue;
		}
		const float Fade = FMath::Min3(1.f, Age / 0.12f, (F.Life - Age) / 0.3f);
		F.Comp->SetCustomPrimitiveDataFloat(0, Fade);
		F.Comp->SetCustomPrimitiveDataFloat(3, Age);
	}
	for (const FCraterFx& C : Craters)
	{
		if (IsValid(C.Comp)) C.Comp->SetCustomPrimitiveDataFloat(3, FMath::Exp(-(float)(Clock - C.Born) / 16.f));
	}
	for (int32 i = Timed.Num() - 1; i >= 0; --i)
	{
		if (Clock >= Timed[i].Until)
		{
			UStaticMeshComponent* C = Timed[i].Comp;
			Timed.RemoveAt(i);
			Meshes.Remove(C);
			if (IsValid(C)) C->DestroyComponent();
		}
	}
}

void ANYCDestructionFX::Clear()
{
	for (FVolume& V : Volumes)
	{
		V.bDead = true;
		if (V.Comp) V.Comp->SetVisibility(false);
	}
	for (FStream& S : Streams)
		if (UNiagaraComponent* C = S.Comp.Get()) C->DestroyComponent();
	Streams.Reset();
	for (const FLightFx& F : Lights)
	{
		LightPool[F.Slot]->SetVisibility(false);
		LightBusy[F.Slot] = false;
	}
	Lights.Reset();
	for (UStaticMeshComponent* C : Meshes)
		if (C && IsValid(C)) C->DestroyComponent();
	Meshes.Reset();
	for (UInstancedStaticMeshComponent* C : Mounds)
		if (C && IsValid(C)) C->DestroyComponent();
	Mounds.Reset();
	MoundByKey.Reset();
	for (UInstancedStaticMeshComponent* C : GravelComps)
		if (C && IsValid(C)) C->DestroyComponent();
	GravelComps.Reset();
	Grains.Reset();
	MovingGrains.Reset();
	NextGrain = 0;
	Shells.Reset();
	Beams.Reset();
	for (const FScorch& F : Scorches)
		if (UDecalComponent* C = F.Comp.Get()) C->DestroyComponent();
	Scorches.Reset();
	Craters.Reset();
	Timed.Reset();
	FlashTimes.Reset();
	SoundLog.Reset();
	FlashesFull = FlashesSoftened = 0;
	Clock = 0.0;
	NextId = 1;
	Rand.Initialize(4242);
}
