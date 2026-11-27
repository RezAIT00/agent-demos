#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCTraffic.generated.h"

class UStaticMesh;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class USpotLightComponent;
class UPointLightComponent;
class ANYCWeatherController;
class UNYCWalkerComponent;

/** A moving light that precipitation effects should be lit by (headlights, tail lamps). */
struct FNYCFxLight
{
	FVector Position;
	FVector Direction;
	FLinearColor Color;
	float Candela;
	float ConeDeg;
};

USTRUCT(BlueprintType)
struct FNYCVehicleType
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FName Name;
	/** 0 cab, 1 sedan, 2 suv, 3 van, 4 box truck, 5 bus */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") int32 Kind = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") UStaticMesh* Body = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") UStaticMesh* Wheel = nullptr;
	/** x, y in cm and side (+1 right, -1 left) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") TArray<FVector> Wheels;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float WheelRadius = 34.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Length = 486.f;
	/** Right-hand headlamp and tail lamp, cm (mirrored for the left). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector HeadLamp = FVector(245, 60, 74);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector TailLamp = FVector(-245, 65, 95);
};

/** A vehicle choreographed for one shot: keys are (shot seconds, x cm, y cm, yaw deg). */
USTRUCT(BlueprintType)
struct FNYCHeroCar
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") int32 Shot = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FName TypeName;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FLinearColor Color = FLinearColor(0.82f, 0.45f, 0.004f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") TArray<FVector4> Keys;
};

/** Removes simulated traffic from a rectangle (cm) during one shot, to clear a hero car's path or a camera. */
USTRUCT(BlueprintType)
struct FNYCClearZone
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") int32 Shot = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector2D Min = FVector2D::ZeroVector;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector2D Max = FVector2D::ZeroVector;
};

/** Traffic, signals and pedestrians.  State is a function of the weather controller's clock. */
/** A car in the traffic as it is drawn right now, for the destruction system to take over. */
struct FNYCCarInfo
{
	int64 Key = 0;
	FString Mesh, WheelMesh;
	FTransform Xf;
	TArray<FTransform> Wheels;      // relative to Xf
	FLinearColor Color = FLinearColor::Gray;
	float Speed = 0.f;
};

UCLASS()
class NYC_API ANYCTraffic : public AActor
{
	GENERATED_BODY()
public:
	ANYCTraffic();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") TArray<FNYCVehicleType> Types;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* LampMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* PedFaceMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") TArray<UStaticMesh*> PedMeshes;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") TArray<UStaticMesh*> UmbrellaMeshes;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* SprayMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traffic") FString DataFile = TEXT("NYC/Data/traffic.json");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traffic") float Density = 1.0f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Traffic") float PedestrianDensity = 1.0f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Film") TArray<FNYCHeroCar> HeroCars;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Film") TArray<FNYCClearZone> ClearZones;
	/** Writes the positions of vehicles near the camera to Saved/NYCAudio_<shot>.csv for the sound design. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Film") bool bLogForAudio = true;

	void GatherFxLights(const FVector& Near, TArray<FNYCFxLight>& Out) const;

	// destruction hooks
	void CollectCars(const FVector& Centre, float Radius, TArray<FNYCCarInfo>& Out) const;
	void RemoveCar(int64 Key);
	/** Traffic stops short of this circle from now on, and people stay out of it. */
	void AddObstacle(const FVector& Centre, float Radius);
	/** Switches off the signal lamps mounted on a post that has gone. */
	void RemoveSignals(const FVector& Centre, float Radius);
	/** Takes everyone off the pavements (the city empties when destruction starts). */
	void SetPedestriansHidden(bool bHidden);
	/** Fades everyone out or back over Seconds of the weather clock (SetPedestriansHidden uses 1.6 s). */
	void FadePedestrians(bool bHidden, float Seconds);
	UNYCWalkerComponent* GetWalkers() const { return Walkers; }
	/** The player's own switch, independent of the destruction rule above. */
	void TogglePedestrians() { bPedestriansOff = !bPedestriansOff; }
	bool PedestriansShown() const { return !bNoPedestrians && !bPedestriansOff; }
	bool PedestriansBarred() const { return bNoPedestrians; }
	void ClearDestruction();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	struct FStop { float S; int32 Group; float Offset; };
	struct FCar
	{
		int32 Id = 0, Type = 0;
		float S = 0, V = 0, PrevS = 0, PrevV = 0, Accel = 0, Cruise = 1000;
		FLinearColor Color;
		bool bHazard = false;
	};
	struct FLane
	{
		FVector2D P0, Dir;
		float Length = 0;
		bool bBus = false;
		bool bAvenue = false;
		TArray<FStop> Stops;
		TArray<FCar> Cars;            // front of the queue first (largest S)
		FRandomStream Rng;
		float NextSpawn = 0;
		float Headway = 7;
	};
	struct FLamp { FVector Pos; float Yaw; int32 Kind, Group; float Offset; int32 Instance; int32 State = -1; int32 Count = -1; };
	struct FPed
	{
		int32 Variant = 0, Instance = 0, UInstance = -1, UVariant = 0;
		TArray<FVector2D> Path;       // closed loop, or two points for a crossing
		float PathLength = 0, S0 = 0, Speed = 130, Lateral = 0, Phase = 0, Hash = 0;
		bool bCrossing = false;
		int32 Group = 0;
		float Offset = 0, Delay = 0;
	};
	struct FVisual
	{
		UStaticMeshComponent* Body = nullptr;
		int32 WheelSet = -1;            // which wheel mesh's instance list
		TArray<int32> Wheels;           // this vehicle's instances in it
		UStaticMeshComponent* Spray = nullptr;
		int32 Type = -1;
		int64 Owner = -1;
		float Data[8] = { -1, -1, -1, -1, -1, -1, -1, -1 };
	};
	struct FDrawCar
	{
		int64 Key; int32 Type; FVector Pos; float Yaw; float Speed; float Travel; bool bBrake; bool bHazard; FLinearColor Color; float Dist;
	};

	TArray<FLane> Lanes;
	TArray<FLamp> Lamps;
	TArray<FPed> Peds;
	TArray<FDrawCar> Draw;
	TSet<int64> Gone;
	TArray<FSphere> Obstacles;
	TSet<int32> DeadLamps;
	bool bNoPedestrians = false;
	bool bPedestriansOff = false;
	TArray<FNYCFxLight> FxLights;
	float Cycle = 90, AveGreen = 45, Yellow = 3.5f, AllRed = 2;
	double SimClock = -1.0e12;
	int32 NextId = 1;
	int32 HiddenShot = -999;
	TSet<int32> HiddenPeds;
	FString AudioLog;
	int32 AudioShot = -999;
	double LastAudioTime = -1.0e12;

	UPROPERTY(Transient) USceneComponent* Root = nullptr;
	UPROPERTY(Transient) UInstancedStaticMeshComponent* LampISM = nullptr;
	UPROPERTY(Transient) UInstancedStaticMeshComponent* PedFaceISM = nullptr;
	UPROPERTY(Transient) TArray<UInstancedStaticMeshComponent*> PedISM;
	UPROPERTY(Transient) TArray<UInstancedStaticMeshComponent*> UmbrellaISM;
	UPROPERTY(Transient) TArray<USpotLightComponent*> HeadPool;
	UPROPERTY(Transient) TArray<UPointLightComponent*> TailPool;
	UPROPERTY(Transient) TArray<UPointLightComponent*> SignalPool;
	UPROPERTY(Transient) TArray<UStaticMeshComponent*> AllVisualComponents;
	TArray<TArray<FVisual>> Pools;
	/** All wheels of one mesh are instances of one component, uploaded together once a frame. */
	UPROPERTY(Transient) TArray<UInstancedStaticMeshComponent*> WheelISM;
	TArray<TArray<FTransform>> WheelXf, WheelPrev;     // this frame and the last, for motion vectors
	int32 WheelSetFor(UStaticMesh* Mesh);
	UPROPERTY(Transient) UNYCWalkerComponent* Walkers = nullptr;
	UPROPERTY(Transient) ANYCWeatherController* Weather = nullptr;

	bool bLoaded = false;
	bool LoadData();
	void CreateRuntimeComponents();
	void ResetSim(double Time);
	void StepSim(double Time, float Dt);
	int32 SignalState(double Time, int32 Group, float Offset) const;   // 0 red, 1 yellow, 2 green
	int32 PickType(FLane& Lane) const;
	FLinearColor PickColor(FRandomStream& R, int32 Kind) const;
	void Spawn(FLane& Lane, float S, double Time);
	void UpdateVehicles(double Time, const FVector& Cam, int32 Shot, float ShotTime, float Darkness, float Wet, float Rain, float Snow);
	void UpdateSignals(double Time, const FVector& Cam);
	void UpdatePeds(double Time, const FVector& Cam, int32 Shot, float Rain, float Snow);
	FVisual* AcquireVisual(int32 Type, int64 Key);
	void LogAudio(int32 Shot, double Time, float ShotTime, const FVector& Cam, const FRotator& CamRot);
	void FlushAudio();
};
