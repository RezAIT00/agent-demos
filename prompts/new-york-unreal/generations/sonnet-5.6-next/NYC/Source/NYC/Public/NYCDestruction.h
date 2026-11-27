#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCFracture.h"
#include "NYCDestruction.generated.h"

class ANYCCityActor;
class ANYCDestructionFX;
class ANYCTraffic;
class ANYCLightField;
class ANYCWeatherController;
class UInstancedStaticMeshComponent;
class UProceduralMeshComponent;
class UGeometryCollectionComponent;
class UBoxComponent;
class UStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UChaosCacheCollection;
class AChaosCacheManager;

/** A destructible building, read from destruction.json. */
struct FNYCBuildingInfo
{
	FString Kind, Name, Style, Wall, Trim, Glass, Frame, Party;
	FBox2D Rect;                // cm
	float Height = 0.f;         // cm
	float FloorH = 350.f;
	float Bay = 220.f;
	TArray<FBox> Tiers;         // cm
	TArray<FIntPoint> Refs;     // (layout group, instance)
	TArray<FString> Shells;
	FBox Box;                   // everything
	bool bMasonry = true;       // bearing walls, as opposed to a bare frame with a curtain wall
};

enum class ENYCElement : uint8 { Module, Chunk, Slab, Column, Beam, Fitout, RoofProp };

struct FNYCElement
{
	ENYCElement Type = ENYCElement::Module;
	FBox Box = FBox(ForceInit);
	int32 Floor = 0;
	bool bAlive = true;
	bool bGlassBroken = false;
	// instanced elements
	TWeakObjectPtr<UInstancedStaticMeshComponent> Comp;
	int32 Index = INDEX_NONE;
	FTransform Xf;
	// shell chunks
	int32 Chunk = INDEX_NONE;
	float Support = 0.f;
};

struct FNYCShellChunk
{
	TArray<int32> Sections;                     // procedural mesh sections
	TArray<TPair<int32, FNYCSoup>> Parts;       // (material slot in the building's table, world geometry)
};

struct FNYCBuildingState
{
	bool bActive = false;       // swapped to the destructible representation
	bool bFallen = false;
	TArray<FNYCElement> Elements;
	TArray<TArray<int32>> ByFloor;
	TArray<FNYCShellChunk> Chunks;
	TArray<UMaterialInterface*> ShellMats;
	TWeakObjectPtr<UProceduralMeshComponent> ShellMesh;
	TArray<TWeakObjectPtr<UInstancedStaticMeshComponent>> Skeleton;   // components this system owns
	TArray<TWeakObjectPtr<UInstancedStaticMeshComponent>> HiddenShells;
	TArray<float> Support0, Support;
	TArray<FVector2D> Centre0;
	int32 NumFloors = 0;
	float FloorH = 350.f;
	int32 CollapsingFrom = MAX_int32;   // floors at and above this are already coming down
};

/** What one hit does. */
struct FNYCDamage
{
	FVector Center = FVector::ZeroVector;
	FVector End = FVector::ZeroVector;      // when bCapsule, the other end of the swept volume
	bool bCapsule = false;
	float Radius = 400.f;                   // structure inside this breaks
	float GlassRadius = 900.f;              // windows break out to here
	float Speed = 900.f;                    // how fast fragments leave, cm/s
	FVector Push = FVector::ZeroVector;     // added to every fragment's velocity
	float UpKick = 0.f;
	bool bRadial = true;                    // fragments fly away from the centre
	bool bStructural = true;                // can start a collapse
	bool bFrame = true;                     // also severs steel and slabs (false: facade only)
	float Dust = 1.f;
	float Fire = 0.f;
	float PropRadius = -1.f;                // street furniture, trees and vehicles (defaults to Radius*1.4)
	float PropForce = 1.f;
	bool bCrater = false;
	float CraterRadius = 0.f;
	int32 MaxElements = 900;
	int32 ForceLOD = -1;
	/** A local strike: wall pieces beyond the blow that touch the edge of their bay stay anchored there, so the
	 *  hole has a ragged outline.  The anchors are released if the building later comes down. */
	bool bRagged = false;
	/** Used while playing: a very large blow is dealt to one building per frame. */
	int32 OnlyBuilding = INDEX_NONE;
	/** Replaces every material on the fragments (ice, char). */
	FString Skin;
};

/** One batch of loose pieces being assembled before it becomes a geometry collection. */
struct FNYCBatch
{
	int32 Building = INDEX_NONE;
	TArray<FNYCPiece> Pieces;
	TArray<UMaterialInterface*> Materials;
	TArray<FVector> GroupVelocity;          // per cluster
	TArray<FVector> GroupSpin;
	TArray<uint8> GroupCrumble;             // break the cluster at once
	bool bHeld = false;                     // what stays standing: every piece anchored
	FLinearColor Tint = FLinearColor::White;
	float Density = 1800.f;
	UMaterialInterface* Override = nullptr;
	int32 NewGroup(const FVector& Velocity, bool bCrumble, const FVector& Spin = FVector::ZeroVector);
	int32 MaterialSlot(UMaterialInterface* M);
};

/** Logs a step of the destruction that holds up a frame. */
struct FNYCSlowStep
{
	const TCHAR* What;
	double Began = FPlatformTime::Seconds();
	explicit FNYCSlowStep(const TCHAR* InWhat) : What(InWhat) {}
	~FNYCSlowStep()
	{
		const double Ms = (FPlatformTime::Seconds() - Began) * 1000.0;
		if (Ms > 20.0) UE_LOG(LogTemp, Display, TEXT("NYC slow step: %s %.0f ms"), What, Ms);
	}
};

/** A live geometry collection of debris. */
struct FNYCDebris
{
	TWeakObjectPtr<UGeometryCollectionComponent> Comp;
	TArray<int32> GroupXf, PieceXf;
	TArray<FVector> GroupVelocity, GroupSpin;
	TArray<uint8> GroupCrumble;
	TArray<float> PieceRadius, GroupRadius;     // half diagonals, cm
	bool bHeld = false;                         // anchored to the standing wall until the building comes down
	FBox Box;
	double Born = 0.0;
	int32 Stage = 0;
	FVector BlastCentre = FVector::ZeroVector;
	float BlastSpeed = 0.f, BlastRadius = 0.f;
	float HoldFor = 0.f;                    // stays one rigid block for this long
	int32 NumPieces = 0;
	TWeakObjectPtr<AChaosCacheManager> Cache;
	int32 Building = INDEX_NONE;
	bool bAnchors = false;
};

/** A loose rigid object: a car, a lamp post, a mailbox, a chunk of crane. */
struct FNYCBody
{
	TWeakObjectPtr<UStaticMeshComponent> Root;      // invisible box that is simulated
	TWeakObjectPtr<USceneComponent> Visual;
	FString Kind;
	FVector HalfSize;
	double Born = 0.0;
	bool bBurning = false;
	TWeakObjectPtr<AChaosCacheManager> Cache;
};

/** Street furniture, trees, parked cars: anything in the layout that is not part of a building. */
struct FNYCProp
{
	int32 Group = INDEX_NONE, Index = INDEX_NONE;
	FVector Pos = FVector::ZeroVector;
	uint8 Kind = 0;
	bool bAlive = true;
};

/** Counters the audit reads to check that a tool really broke something. */
USTRUCT(BlueprintType)
struct FNYCDestructionStats
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Elements = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Pieces = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Windows = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Props = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Vehicles = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Craters = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Buildings = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Collapses = 0;
	UPROPERTY(BlueprintReadOnly, Category = "NYC") int32 Collections = 0;
	int32 Total() const { return Elements + Windows + Props + Vehicles + Craters; }
};

UENUM()
enum class ENYCCacheMode : uint8 { Off, Record, Playback };

/**
 * Takes the city apart.  Buildings are swapped for a destructible representation the first time they are
 * touched; broken parts become Chaos geometry collections.  Everything it does can be undone with ResetCity.
 */
UCLASS()
class NYC_API ANYCDestruction : public AActor
{
	GENERATED_BODY()
public:
	ANYCDestruction();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void Tick(float Dt) override;

	/** The director for a world, created on first use. */
	static ANYCDestruction* Get(UWorld* World, bool bCreate = true);

	bool EnsureLoaded();
	void ResetCity();

	void ApplyDamage(const FNYCDamage& D);
	/** The nearest unbroken pane of useful size within Radius, on a wall facing roughly `Facing` (or any, if zero). */
	bool FindWindow(const FVector& Near, float Radius, const FVector& Facing, FVector& OutPoint, FVector& OutNormal);
	/** A loose copy of one instance of a layout group, keeping its per-instance paint and variation. */
	UStaticMeshComponent* NewInstanceVisual(UInstancedStaticMeshComponent* Source, int32 Instance, const FTransform& Xf);
	/** Breaks windows only, cheaply, across a wide area. */
	void ShatterGlass(const FVector& Centre, float Radius, float Speed = 600.f, int32 MaxWindows = 4000);
	/** Brings a building down.  Mode: 0 chooses, 1 pancake, 2 topple, 3 shear, 4 explode outward. */
	void CollapseBuilding(int32 Building, int32 FromFloor, int32 Mode, const FVector& Toward, float Delay = 0.f);
	/** Loosens rubble that is already lying about and throws it. */
	void KickDebris(const FVector& Centre, float Radius, float Speed, float UpKick, bool bBreak);
	/** Flattens everything between two radii, nearest first, as a front of the given speed passes. */
	void Shockwave(const FVector& Centre, float InnerRadius, float OuterRadius, float FrontSpeed, float Strength, bool bFlattenCore = false);
	/** Moves whole buildings (far from the camera) through a collapse without simulating their parts. */
	void FellBuilding(int32 Building, const FVector& Away, float Delay, float Severity);

	/** Ray against buildings, ground, vehicles and props.  Returns the distance or -1. */
	float Trace(const FVector& Origin, const FVector& Dir, float MaxDist, FVector& OutPoint, FVector& OutNormal, int32* OutBuilding = nullptr) const;
	bool NearestBuilding(const FVector& P, float MaxDist, int32& OutBuilding) const;
	/** Rough share of direct sun and of open sky at a point, from the standing buildings around it. */
	void Exposure(const FVector& P, const FVector& ToSun, float& OutSun, float& OutSky) const;
	void BuildingsNear(const FVector& P, float Radius, TArray<int32>& Out) const;
	const FNYCBuildingInfo* Info(int32 Building) const { return Buildings.IsValidIndex(Building) ? &Buildings[Building] : nullptr; }
	float GroundZ(const FVector& P) const { return 0.f; }

	// street furniture, trees and vehicles (NYCDestructionProps.cpp)
	void HitProps(const FNYCDamage& D);
	void CollectProps(const FVector& Centre, float Radius, TArray<int32>& Out, uint32 KindMask = 0xFFFFFFFF) const;
	/** Turns a prop or car into a rigid body (or pieces) and gives it a velocity. */
	int32 LaunchProp(int32 Prop, const FVector& Velocity, const FVector& Spin, bool bBreak, bool bBurn);
	int32 WreckVehicle(const FString& MeshName, const FTransform& Xf, const FLinearColor& Paint, const FVector& Velocity, const FVector& Spin,
		const FVector& HitFrom, float Crush, bool bBurn);
	void HitTraffic(const FVector& Centre, float Radius, float Speed, float Crush, bool bBurn, const FVector& Push);
	void MakeCrater(const FVector& Centre, float Radius, float Depth);
	/** A free rigid body that shows a mesh; used for projectiles, crane parts, flung wreckage. */
	int32 SpawnBody(const FString& Kind, USceneComponent* Visual, const FTransform& Xf, const FVector& HalfSize, float MassKg,
		const FVector& Velocity, const FVector& Spin);
	UStaticMesh* CityMesh(const FString& Name);
	UMaterialInterface* CityMaterial(const FString& Name);
	UStaticMeshComponent* NewVisual(UStaticMesh* Mesh, const FTransform& Xf, bool bMovable = true);
	UStaticMesh* UnitCube();

	/** Runs Fn after Delay seconds of simulation time (deterministic). */
	void After(float Delay, TFunction<void()> Fn);
	/** Runs Fn every tick for Duration seconds; it gets the time since the start and the step. */
	void During(float Duration, TFunction<void(float, float)> Fn);

	ANYCDestructionFX* FX();
	/** Plays one of the synthesized sounds in the running game (films add theirs afterwards). */
	void PlaySound(const FName& Name, const FVector& At, float Volume, float Pitch);
	UPROPERTY() TMap<FName, class USoundBase*> Sounds;
	bool bQuiet = false;
	double Now() const { return Clock; }
	FRandomStream& Random() { return Rand; }
	ANYCTraffic* Traffic() const;
	/** Nobody stands in a destruction scene: called by anything that breaks the city; lasts until ResetCity. */
	void ClearStreetsOfPeople();
	/** The destruction film and the audit never show people at all, not even before the first tool. */
	bool bNoPeopleEver = false;
	ANYCWeatherController* Weather() const;
	FVector Wind() const;
	/** Camera shake request; decays by itself. */
	void Shake(const FVector& At, float Strength, float Duration);
	FVector ShakeOffset(const FVector& CameraPos) const;

	/** Stats since the last reset. */
	UPROPERTY(BlueprintReadOnly, Category = "NYC") FNYCDestructionStats Stats;

	/** Film support: drive the clock from outside and record or replay physics. */
	// building blocks for the stranger tools (NYCDestructionExtras.cpp)
	void SpawnLumps(const FVector& At, const FVector& Direction, int32 Count, float Size, const FString& Material, float Speed,
		float Spread = 0.6f, float Elongation = 1.f);
	void Scar(const FVector& At, const FVector& Normal, float Radius);
	/** Removes building parts without debris, in a puff of motes.  Returns how many went. */
	int32 DissolveElements(const FVector& Centre, float Radius, int32 MaxCount, const FLinearColor& Tint, bool bCheckStructure = true, const FString& Dust = FString());
	int32 FindProp(const FVector& P, uint32 KindMask, float MaxDist) const;
	FVector PropLocation(int32 Index) const;
	void SinkProp(int32 Index, float Depth, float Duration);
	int32 NumBodies() const { return Bodies.Num(); }
	UStaticMeshComponent* BodyRoot(int32 Index) const { return Bodies.IsValidIndex(Index) ? Bodies[Index].Root.Get() : nullptr; }
	void SetBodiesGravity(const FVector& Centre, float Radius, bool bGravity, int32 FirstBody = 0);
	void DragBodies(const FVector& Target, float Radius, float Acceleration, float MaxSpeed, float Swirl, float SwallowRadius, float Dt);
	/** Physics fields on loose fragments: pulls toward the target and spins them about it. */
	void DragDebris(const FVector& Target, float Radius, float Speed, float Swirl, float Lift);
	/** Street-object kinds for CollectProps / FindProp masks. */
	enum EPropMask : uint32 { MCar = 1, MTree = 2, MPole = 4, MHydrant = 8, MBox = 16, MBag = 32, MShelter = 64, MPlate = 128, MStall = 512, MAll = 0xFFFFFEFF };

	void SetExternalClock(bool bExternal) { bExternalClock = bExternal; }
	void AdvanceTo(double Time);
	ENYCCacheMode CacheMode = ENYCCacheMode::Off;
	/** When each cache manager's component was created, on the director's clock. */
	TMap<TWeakObjectPtr<AChaosCacheManager>, double> CacheBorn;
	/** The exact time being shown during playback (may fall between simulation steps). */
	double PlaybackTime = 0.0;
	UPROPERTY() UChaosCacheCollection* CacheCollection = nullptr;
	void RegisterForCache(class UPrimitiveComponent* Comp, const FString& CacheName, TWeakObjectPtr<AChaosCacheManager>& OutManager);
	void EvaluateCaches();

	int32 NumBuildings() const { return Buildings.Num(); }
	int32 LivePieces() const;
	void LogDebris() const;

private:
	friend class UNYCDestructionTest;

	void Step(float Dt);
	void LoadMaterialsFor(UMaterialInterface* Source);
	UMaterialInterface* DebrisMaterial(UMaterialInterface* Source);

	FNYCBuildingState& Activate(int32 Building);
	void BuildShellChunks(int32 Building, FNYCBuildingState& S);
	void BuildSkeleton(int32 Building, FNYCBuildingState& S);
	/** Removes an element from the intact building and appends its fragments to the batch. */
	void BreakElement(int32 Building, int32 Element, FNYCBatch& Batch, int32 Group, int32 LOD, const FVector& Velocity, bool bCrumble);
	void HideElement(FNYCBuildingState& S, FNYCElement& E);
	void BreakGlassOnly(int32 Building, int32 Element, const FVector& From, float Speed);
	const TArray<FNYCPiece>& ModulePieces(UStaticMesh* Mesh, const TArray<UMaterialInterface*>& Mats, int32 LOD, int32 Variant);
	int32 SpawnBatch(FNYCBatch& Batch, const FVector& BlastCentre, float BlastSpeed, float BlastRadius, float HoldFor = 0.f);
	void ServiceDebris();
	void CheckStructure(int32 Building, const FVector& HitFrom);
	/** Frees the wall edges that ragged strikes left anchored on a building that is now failing. */
	void ReleaseAnchors(int32 Building);
	void ShedGravel(const FNYCBatch& Batch, const FVector& Origin, int32 Seed);
	/** Someone is playing: not a film take (recording or replaying) and not on a sequence's clock. */
	bool IsLive() const { return CacheMode == ENYCCacheMode::Off && !bExternalClock; }
	struct FPendingBatch { FNYCBatch Batch; FVector Centre; float Speed, Radius, HoldFor; };
	TArray<FPendingBatch> PendingBatches;
	bool bDrainingQueue = false;
	/** While playing, for a few seconds after a very large blast everything breaks into coarse pieces. */
	double CoarseUntil = -1.0;
	int32 FellStep = 0;
	void DrainBatches(double BudgetMs);
	static void FuseBatch(FNYCBatch& Batch, int32 MaxPieces);
	/** Takes the rooftop plant standing on a distant box (and marks it for rebuilding). */
	void CollectRoofClutter(const FBox& Box, TArray<TPair<UInstancedStaticMeshComponent*, TPair<int32, FTransform>>>& Out);
	TMap<FIntPoint, TArray<TPair<UInstancedStaticMeshComponent*, int32>>> RoofClutter;
	bool bRoofIndexed = false;
	/** The tower shells are one-instance groups found by mesh name. */
	UInstancedStaticMeshComponent* ShellGroup(const FString& MeshName);
	TMap<FString, TWeakObjectPtr<UInstancedStaticMeshComponent>> ShellGroups;
	TArray<TWeakObjectPtr<UStaticMeshComponent>> Scars;
	void UpdateColliders(const FVector& Around, float Radius);
	void SetBuildingCollider(int32 Building);
	void EnsureGround();
	void IndexProps();
	void RestoreProps();

	TArray<FNYCBuildingInfo> Buildings;
	TArray<FNYCBuildingState> States;
	struct FFar { FBox Box; int32 Group, Index; bool bAlive; };
	TArray<FFar> FarBoxes;
	TMap<uint64, TArray<int32>> BuildingGrid;
	TMap<FString, TPair<FVector2D, TArray<FVector4f>>> ModuleInfo;     // name -> size (cm), openings (x0, x1, z0, z1)
	TMap<FString, float> ModuleDepth;
	TArray<FNYCProp> Props;
	TMap<uint64, TArray<int32>> PropGrid;
	/** Instances hidden by this system, with the transform to put back. */
	TMap<TPair<UInstancedStaticMeshComponent*, int32>, FTransform> Hidden;
	void HideInstance(UInstancedStaticMeshComponent* C, int32 Index);
	void FlushHidden();
	TSet<TWeakObjectPtr<UInstancedStaticMeshComponent>> Dirty;

	TArray<FNYCDebris> Debris;
	TArray<FNYCBody> Bodies;
	/** Where each following visual sits relative to its simulated box. */
	TMap<USceneComponent*, FTransform> FollowOffsets;
	void SyncBodies();
	TMap<int32, TArray<TWeakObjectPtr<UBoxComponent>>> Colliders;
	TWeakObjectPtr<UBoxComponent> Ground;
	struct FTimer { double At; int32 Order; TFunction<void()> Fn; };
	TArray<FTimer> Timers;
	struct FOngoing { double From, Until; TFunction<void(float, float)> Fn; };
	TArray<FOngoing> Ongoing;
	int32 TimerOrder = 0;
	struct FShakeSource { FVector At; float Strength; double From; float Duration; };
	TArray<FShakeSource> Shakes;
	struct FFelled { int32 Building; double From; float Duration; FVector Away; float Severity; bool bDone; TArray<TPair<UInstancedStaticMeshComponent*, int32>> Parts; TArray<FTransform> Start; };
	TArray<FFelled> Felling;
	void TickFelled();
	struct FCrater { FVector Centre; float Radius, Depth; };
	TArray<FCrater> Craters;

	TMap<FString, TArray<FNYCPiece>> PieceCache;
	TMap<UStaticMesh*, FNYCSoup> SoupCache;
	const FNYCSoup& Soup(UStaticMesh* Mesh);

	UPROPERTY() TArray<UObject*> KeepAlive;
	UPROPERTY() TArray<UActorComponent*> Spawned;
	UPROPERTY() TArray<AActor*> SpawnedActors;
	UPROPERTY() TMap<FString, UStaticMesh*> MeshByName;
	UPROPERTY() TMap<FString, UMaterialInterface*> MaterialByName;
	UPROPERTY() TMap<UMaterialInterface*, UMaterialInterface*> DebrisByMaterial;
	UPROPERTY() ANYCCityActor* City = nullptr;
	UPROPERTY() ANYCDestructionFX* Effects = nullptr;
	UPROPERTY() UStaticMesh* Cube = nullptr;

	double Clock = 0.0;
	bool bLoaded = false;
	bool bExternalClock = false;
	FRandomStream Rand;
	int32 NextDebrisId = 0;
	int32 NextBodyId = 0;
	int32 StepCount = 0;
};
