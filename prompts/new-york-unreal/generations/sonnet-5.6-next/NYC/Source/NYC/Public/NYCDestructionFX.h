#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCDestructionFX.generated.h"

class ANYCDestruction;
class UStaticMesh;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class UPointLightComponent;
class UNiagaraComponent;
class UNiagaraSystem;
class UMaterialInterface;

/** Ray-marched volume kinds; the numbers match Volume.ush. */
namespace ENYCVol
{
	enum Type { Dust = 0, Smoke = 1, Flame = 2, Fireball = 3, Mist = 4, Mushroom = 5, Funnel = 6, Energy = 7, Condensation = 8 };
}

/** One cloud: where it starts, how it grows and moves, and what it looks like. */
struct FNYCPuff
{
	FVector Pos = FVector::ZeroVector;
	FVector Vel = FVector::ZeroVector;      // slows down by drag
	float Drag = 0.7f;
	FVector Rise = FVector::ZeroVector;     // constant drift (buoyancy, wind)
	float R0 = 100.f, R1 = 300.f;
	float Squash = 1.f;
	float Life = 6.f;
	float FadeIn = 0.15f;
	float GrowTau = 0.18f;                  // fraction of life in which most growth happens
	float Density = 1.f;
	int32 Kind = ENYCVol::Dust;
	FLinearColor Albedo = FLinearColor(0.42f, 0.37f, 0.3f);
	float Glow = 0.f;                       // cd/m2
	float NoiseM = 3.f;
	bool bGroundHug = false;                // keeps its underside on the street as it grows
};

/** A request to play a sound, kept for the soundtrack and for live playback. */
struct FNYCSoundEvent
{
	double Time;
	FName Name;
	FVector Pos;
	float Volume;
	float Pitch;
};

/** Dust, smoke, fire, sparks, water, shock waves and light for the destruction system. */
UCLASS()
class NYC_API ANYCDestructionFX : public AActor
{
	GENERATED_BODY()
public:
	ANYCDestructionFX();
	void Init(ANYCDestruction* InDirector);
	void Advance(double Time, float Dt);
	void Clear();

	// ---- composed effects -----------------------------------------------------------------
	void DustBurst(const FVector& At, float Radius, float Amount, const FString& Wall);
	void DustSurge(const FBox& Footprint, float Height, const FString& Wall);
	void RubbleSmoke(const FVector& At, float Radius, float Duration);
	void RubbleMound(const FVector& At, const FVector2D& Extent, float Height, const FString& Wall);
	/** Loose stones on closed-form paths (fall, one bounce, skid, rest), so a replayed shot repeats exactly. */
	void Gravel(const TArray<FVector>& At, const TArray<FVector>& Velocity, bool bBrick, int32 Seed);
	void GlassBurst(const FVector& At, const FVector& Velocity, const FVector2D& Size);
	void Fire(const FVector& At, float Radius, float Duration);
	void Fireball(const FVector& At, float Radius, float Duration, float Flash = 1.f);
	void SmokeColumn(const FVector& At, float Radius, float Duration, float Darkness = 0.85f);
	void Splinters(const FVector& At, const FVector& Velocity, int32 Count);
	void Sparks(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint = FLinearColor(1.f, 0.55f, 0.18f), float Spread = 55.f);
	void Litter(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint = FLinearColor(0.72f, 0.7f, 0.62f));
	void Chips(const FVector& At, const FVector& Velocity, int32 Count, const FLinearColor& Tint, float MinSize = 1.5f, float MaxSize = 6.f, float Spread = 70.f);
	void WaterJet(const FVector& At, const FVector& Direction, float Duration, float Strength);
	void Splash(const FVector& At, float Radius, float Strength);
	void Motes(const FVector& At, int32 Count, const FLinearColor& Tint, float Radius, float Speed, float Life, float Size = 5.f, const FVector& Gravity = FVector::ZeroVector);
	void Crater(const FVector& At, float Radius, float Depth);
	/** A short-lived blast light.  Bright onsets are rationed so no second of film sees more than two. */
	void Flash(const FVector& At, const FLinearColor& Color, float Candela, float Radius, float Duration, float Flicker = 0.f);
	/** A steady or flickering light without the flash ration (it fades in). */
	int32 Glow(const FVector& At, const FLinearColor& Color, float Candela, float Radius, float Duration, float Flicker = 0.25f);
	void MoveLight(int32 Id, const FVector& At);
	/** The pressure front: a thin shell plus the ring of grit it lifts. */
	void ShockDome(const FVector& At, float MaxRadius, float Speed, float Strength, const FLinearColor& Color = FLinearColor(1.f, 0.97f, 0.92f));
	void GroundRing(const FVector& At, float Radius, float Speed, float Amount, const FString& Wall);
	/** A beam between two points; returns a handle for moving it. */
	int32 Beam(const FVector& A, const FVector& B, float Radius, const FLinearColor& Color, float Nits, float Duration);
	void MoveBeam(int32 Id, const FVector& A, const FVector& B, float Radius = -1.f);
	/** A fireball that becomes a mushroom cloud over ground point At.  BurstHeight: where the fireball is born. */
	void MushroomCloud(const FVector& At, float Radius, float Duration, float BurstHeight = 0.f);
	/** The brief white ring of cloud that runs out from a very large blast. */
	void CondensationRing(const FVector& At, float MaxRadius, float Duration, float Delay);
	/** Walls of dust that pour along the real avenues and cross streets, out from At. */
	void StreetSurge(const FVector& At, float From, float To, float Speed, float Size, const FString& Wall);
	/** A radial scorch burnt onto streets and roofs, uncovered as the front passes. */
	void BlastScorch(const FVector& At, float Radius, float Speed);
	/** A volume whose size and place the caller drives every step (tornado funnel, black hole...). */
	int32 DrivenVolume(const FNYCPuff& Look);
	void DriveVolume(int32 Id, const FVector& Pos, float Radius, float Squash, float Density = -1.f, float Glow = -1.f);
	void EndVolume(int32 Id, float FadeSeconds = 2.f);
	/** Draw order among overlapping clouds: higher draws in front. */
	void SetVolumeOrder(int32 Id, int32 Order);
	int32 AddPuff(const FNYCPuff& P);

	// ---- meshes that belong to an effect or a tool ------------------------------------------
	UStaticMeshComponent* Mesh(const FString& Name, const FTransform& Xf, float Life = -1.f, UMaterialInterface* Override = nullptr);
	void RemoveMesh(UStaticMeshComponent* C);
	void Sound(const FName& Name, const FVector& At, float Volume = 1.f, float Pitch = 1.f);

	TArray<FNYCSoundEvent> SoundLog;
	/** Flash onsets that were allowed at full strength (for the audit and the notes). */
	int32 FlashesFull = 0, FlashesSoftened = 0;
	float GlowScale() const;
	static FLinearColor DustColour(const FString& Wall);

private:
	struct FVolume
	{
		UStaticMeshComponent* Comp = nullptr;
		FNYCPuff P;
		double Born = 0.0;
		bool bDriven = false;
		bool bDead = true;
		float FadeFrom = -1.f, FadeFor = 0.f;
		float DrivenRadius = 100.f, DrivenSquash = 1.f;
		FVector DrivenPos = FVector::ZeroVector;
		float Seed = 0.f;
		float Sun = 1.f, Sky = 1.f;
		double Looked = -10.0;
	};
	struct FStream { TWeakObjectPtr<UNiagaraComponent> Comp; double Until; };
	struct FLightFx { int32 Slot; double Born; float Life; float Candela; float Flicker; float Rise; bool bFlash; int32 Id; };
	struct FShellFx { UStaticMeshComponent* Comp; FVector At; float MaxR, Speed, Strength; double Born; };
	struct FBeamFx { int32 Id; UStaticMeshComponent* Comp; FVector A, B; float Radius, Life; double Born; };
	struct FCraterFx { UStaticMeshComponent* Comp; double Born; };
	struct FTimed { UStaticMeshComponent* Comp; double Until; };

	int32 SpawnVolume(const FNYCPuff& P, bool bDriven);
	void UpdateVolume(FVolume& V);
	UNiagaraSystem* System(const FString& Name);
	UNiagaraComponent* Particles(const FString& Name, const FVector& At);
	void Burst(const FString& Name, const FVector& At, int32 Count, float LifeMin, float LifeMax, float SpeedMin, float SpeedMax,
		const FVector& Axis, float Spread, float Radius, const FVector& Gravity, float Drag, float SizeMin, float SizeMax, const FLinearColor& Tint);
	void Stream(const FString& Name, const FVector& At, float Duration, float Rate, float LifeMin, float LifeMax, float SpeedMin, float SpeedMax,
		const FVector& Axis, float Spread, float Radius, const FVector& Gravity, float Drag, float SizeMin, float SizeMax, const FLinearColor& Tint);
	int32 LightSlot();
	bool AllowFlash();

	UPROPERTY() ANYCDestruction* Director = nullptr;
	UPROPERTY() TArray<UStaticMeshComponent*> VolumePool;
	UPROPERTY() TArray<UPointLightComponent*> LightPool;
	UPROPERTY() TArray<UStaticMeshComponent*> Meshes;
	UPROPERTY() TArray<UInstancedStaticMeshComponent*> Mounds;
	UPROPERTY() TMap<FString, UNiagaraSystem*> Systems;
	struct FGrain
	{
		int32 Comp = 0, Index = 0;
		double Born = 0.0;
		FVector P0, V0, P1, V1;
		float T1 = 0.f, T2 = 0.f, Scale = 1.f;
		FQuat Rot = FQuat::Identity;
		FVector Axis = FVector::UpVector;
		float Spin = 0.f;
		bool bMoving = false;
	};
	void UpdateGravel();
	UPROPERTY() TArray<UInstancedStaticMeshComponent*> GravelComps;
	TArray<FGrain> Grains;
	TArray<int32> MovingGrains;
	int32 NextGrain = 0;
	TArray<FVolume> Volumes;
	struct FScorch { TWeakObjectPtr<class UDecalComponent> Comp; TWeakObjectPtr<class UMaterialInstanceDynamic> Mat; double Born; float Radius, Speed; };
	TArray<FScorch> Scorches;
	TArray<FStream> Streams;
	TArray<FLightFx> Lights;
	TArray<bool> LightBusy;
	TArray<FShellFx> Shells;
	TArray<FBeamFx> Beams;
	TArray<FCraterFx> Craters;
	TArray<FTimed> Timed;
	TArray<double> FlashTimes;
	TMap<FString, UInstancedStaticMeshComponent*> MoundByKey;
	double Clock = 0.0;
	int32 NextId = 1;
	FRandomStream Rand;
};
