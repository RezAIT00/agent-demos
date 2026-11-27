#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "NYCWalkers.generated.h"

class UMaterialInstanceDynamic;
class UMaterialInterface;
class UStaticMesh;
class UTexture2D;

/** Instanced walkers move every frame.  Fixed bounds spare the engine a pass over every instance of every
 *  component to refit them each time; instances are still culled one by one on the GPU. */
UCLASS()
class NYC_API UNYCWalkerInstances : public UInstancedStaticMeshComponent
{
	GENERATED_BODY()
public:
	virtual FBoxSphereBounds CalcBounds(const FTransform& LocalToWorld) const override
	{
		return FBoxSphereBounds(FVector::ZeroVector, FVector(600000.0, 600000.0, 100000.0), 860000.0);
	}
};

/** What the walkers need to know about the camera. */
struct FNYCWalkerView
{
	FVector Location = FVector::ZeroVector;
	FRotator Rotation = FRotator::ZeroRotator;
	float FovDegrees = 90.f;      // horizontal
	float Aspect = 16.f / 9.f;
	float ResolutionY = 1440.f;
	bool bCull = false;           // false: no camera, treat everyone as visible
};

/** Numbers from the last Update, for performance reports. */
struct FNYCWalkerStats
{
	int32 Total = 0;
	int32 Drawn = 0;
	int32 PerLod[4] = { 0, 0, 0, 0 };
	int32 Triangles = 0;
	double UpdateMs = 0.0;       // game thread, whole update
	double ParallelMs = 0.0;     // of which: waiting on the worker threads (both passes)
	double WhereMs = 0.0;        // of which: the first pass, finding everybody
	double SubmitMs = 0.0;       // of which: instance and texture submission
};

/**
 * The city's pedestrians.  Skinned crowd on instanced static meshes: poses are solved on worker threads from
 * a footstep plan, written to a bone texture, and applied in the vertex shader (Walker.ush).  Everything a
 * walker does is a function of the weather controller's clock, so film renders repeat exactly.
 */
UCLASS(ClassGroup = (NYC))
class NYC_API UNYCWalkerComponent : public USceneComponent
{
	GENERATED_BODY()
public:
	UNYCWalkerComponent();
	virtual ~UNYCWalkerComponent() override;

	/** Folder with the walker meshes and M_Walker. */
	UPROPERTY(EditAnywhere, Category = "NYC") FString AssetFolder = TEXT("/Game/NYC/Walkers");
	/** walkers.json written by the generator, relative to Content. */
	UPROPERTY(EditAnywhere, Category = "NYC") FString BodiesFile = TEXT("NYC/Data/walkers.json");
	/** Fades out anyone about to pass through the lens, cm from the walker's centre line. */
	UPROPERTY(EditAnywhere, Category = "NYC") float LensClearance = 62.f;
	/** Walkers this close to the camera when a film shot starts stay out of that shot (0 = off). */
	UPROPERTY(EditAnywhere, Category = "NYC") float ShotStartClearance = 0.f;

	/** TrafficFile is the same traffic.json the traffic uses (walking loops, crosswalks, signal timing). */
	bool Load(const FString& TrafficFile, float PedestrianDensity);
	void Update(double Time, int32 Shot, const FNYCWalkerView& View, float Rain, float Snow, float Wind);

	/** Fades everyone out (or back) over FadeSeconds of the weather clock, starting at the next update. */
	void SetHidden(bool bHidden, float FadeSeconds = 1.6f);
	/** People fade away as they near this circle, and stay away. */
	void AddObstacle(const FVector& Centre, float Radius);
	/** Removes all obstacles and shows everyone again at once. */
	void Reset();

	int32 NumWalkers() const;
	const FNYCWalkerStats& GetStats() const { return Stats; }

	/** For tools and tests: where walker Index is at Time, and its speed in cm/s. */
	bool Locate(int32 Index, double Time, FVector& OutPosition, FVector& OutDirection, float& OutSpeed) const;
	/** Indices of walkers who use a crossing within Radius of Point at some time in [From, To]. */
	void FindCrossers(const FVector& Point, float Radius, double From, double To, TArray<int32>& Out) const;

	virtual void OnUnregister() override;

private:
	struct FImpl;
	TSharedPtr<FImpl> Impl;
	FNYCWalkerStats Stats;

	UPROPERTY(Transient) TArray<UInstancedStaticMeshComponent*> Meshes;
	UPROPERTY(Transient) UMaterialInstanceDynamic* Material = nullptr;
	UPROPERTY(Transient) UTexture2D* BoneTexture = nullptr;
};
