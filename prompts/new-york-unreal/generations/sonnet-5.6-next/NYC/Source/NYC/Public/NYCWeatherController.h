#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCWeatherController.generated.h"

class UDirectionalLightComponent;
class USkyAtmosphereComponent;
class USkyLightComponent;
class UVolumetricCloudComponent;
class UExponentialHeightFogComponent;
class UPostProcessComponent;
class UStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UMaterialParameterCollection;
class UProceduralMeshComponent;
class UPointLightComponent;
class ANYCLightField;
class ANYCTraffic;

/** One scripted lightning strike on the shot clock. */
USTRUCT(BlueprintType)
struct FNYCStrike
{
	GENERATED_BODY()

	/** Film shot this strike belongs to (matched against ShotId). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") int32 Shot = 0;
	/** Seconds on the shot clock (SimTime - ShotStart). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Time = 0.f;
	/** Cloud end and ground end of the channel, cm. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector From = FVector(0, 0, 90000);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector To = FVector(0, 0, 0);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") int32 Seed = 1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Power = 1.f;
	/** Cloud-only strikes light the sky without a visible channel. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") bool bVisibleBolt = true;
};

/** Full weather state, used for the Play-mode presets. */
USTRUCT(BlueprintType)
struct FNYCWeather
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float TimeOfDay = 14.5f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float CloudCover = 0.25f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Storm = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Rain = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Snow = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Fog = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Wind = 0.25f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float LightningPerMinute = 0.f;
};

/**
 * The single weather and time-of-day controller. Every visual that depends on weather reads from
 * here, either directly or through the MPC_Weather material parameter collection.
 */
UCLASS()
class NYC_API ANYCWeatherController : public AActor
{
	GENERATED_BODY()
public:
	ANYCWeatherController();

	// ---- the few parameters that drive everything -------------------------------------------
	/** Local standard time (EST), hours. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "24"))
	float TimeOfDay = 14.8f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float CloudCover = 0.25f;
	/** 0 = fair weather cloud, 1 = heavy dark storm deck. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Storm = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Rain = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Snow = 0.f;
	/** Fog and low cloud that swallows tower tops. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Fog = 0.f;
	/** Surface wetness. In Play mode it integrates from Rain; sequences key it directly. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Wetness = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Puddles = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float SnowCover = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather", meta = (ClampMin = "0", ClampMax = "1"))
	float Wind = 0.25f;
	/** Random lightning in Play mode. Films use the scripted Strikes list. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Weather")
	float LightningPerMinute = 0.f;

	// ---- camera / look ----------------------------------------------------------------------
	/** Stops added on top of the physically based exposure. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float ExposureBias = 0.f;
	/** Multiplies the haze that the base weather produces. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float HazeScale = 1.f;
	/** Height of the low cloud base in metres. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float FogCeiling = 215.f;
	/** Kilometres beyond which the height fog is not applied (0 = no limit).  From high up, a limit that
	 *  lies past all geometry keeps the fog off the sky, where it otherwise draws a flat band. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float FogCutoffKm = 0.f;
	/** Pushes the white balance (positive = warmer). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float Warmth = 0.f;
	/** Rain falling close to the lens, independent of the wide-shot density. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Look")
	float NearRain = 1.f;

	// ---- clock ------------------------------------------------------------------------------
	/** Shot clock in seconds. Rain, traffic, signals and lightning are pure functions of it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Clock")
	float SimTime = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Clock")
	float ShotStart = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Clock")
	int32 ShotId = 0;
	/** When true, SimTime is driven externally (Sequencer). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Clock")
	bool bExternalClock = false;

	// ---- calendar ---------------------------------------------------------------------------
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Calendar") int32 Month = 12;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Calendar") int32 Day = 5;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Lightning")
	TArray<FNYCStrike> Strikes;

	// ---- assets, assigned by the build script ----------------------------------------------
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UMaterialParameterCollection* Collection = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UMaterialInterface* CloudMaterial = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* RainMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* SnowMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* SplashMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UStaticMesh* DripMesh = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UMaterialInterface* BoltMaterial = nullptr;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Assets") UMaterialInterface* FogPostMaterial = nullptr;

	/** Applies the current parameters immediately (also usable from the editor). */
	UFUNCTION(BlueprintCallable, CallInEditor, Category = "Weather")
	void ApplyWeather();

	/** Starts a smooth Play-mode transition toward a preset. */
	UFUNCTION(BlueprintCallable, Category = "Weather")
	void TransitionTo(const FNYCWeather& Target, float Seconds);

	UFUNCTION(BlueprintCallable, Category = "Weather")
	void TriggerLightning();

	UFUNCTION(BlueprintCallable, Category = "Weather")
	FVector GetSunDirection() const { return SunDir; }

	/** Sun elevation and compass azimuth in degrees for a given local hour. */
	UFUNCTION(BlueprintCallable, Category = "Weather")
	FVector2D SolarPosition(float Hours) const;

	/** How dark it is outside, 0 (day) to 1 (night or black storm). */
	bool IsExternalClock() const { return bExternalClock; }
	float GetDarkness() const { return Darkness; }
	float GetClock() const { return SimTime; }

	virtual void Tick(float DeltaSeconds) override;
	virtual bool ShouldTickIfViewportsOnly() const override { return true; }
	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

private:
	UPROPERTY(VisibleAnywhere, Category = "Components") USceneComponent* Root;
	UPROPERTY(VisibleAnywhere, Category = "Components") UDirectionalLightComponent* Sun;
	UPROPERTY(VisibleAnywhere, Category = "Components") UDirectionalLightComponent* Moon;
	UPROPERTY(VisibleAnywhere, Category = "Components") UDirectionalLightComponent* FlashLight;
	UPROPERTY(VisibleAnywhere, Category = "Components") USkyAtmosphereComponent* Atmosphere;
	UPROPERTY(VisibleAnywhere, Category = "Components") USkyLightComponent* SkyLight;
	UPROPERTY(VisibleAnywhere, Category = "Components") UVolumetricCloudComponent* Clouds;
	UPROPERTY(VisibleAnywhere, Category = "Components") UExponentialHeightFogComponent* HeightFog;
	UPROPERTY(VisibleAnywhere, Category = "Components") UPostProcessComponent* PostProcess;
	UPROPERTY(VisibleAnywhere, Category = "Components") UStaticMeshComponent* RainComp;
	UPROPERTY(VisibleAnywhere, Category = "Components") UStaticMeshComponent* SnowComp;
	UPROPERTY(VisibleAnywhere, Category = "Components") UStaticMeshComponent* SplashComp;
	UPROPERTY(VisibleAnywhere, Category = "Components") UStaticMeshComponent* DripComp;
	UPROPERTY(VisibleAnywhere, Category = "Components") UProceduralMeshComponent* Bolt;
	UPROPERTY(VisibleAnywhere, Category = "Components") UPointLightComponent* BoltLight;

	UPROPERTY(Transient) UMaterialInstanceDynamic* CloudMID = nullptr;
	UPROPERTY(Transient) UMaterialInstanceDynamic* BoltMID = nullptr;
	UPROPERTY(Transient) ANYCLightField* LightField = nullptr;
	UPROPERTY(Transient) ANYCTraffic* Traffic = nullptr;

	FVector SunDir = FVector(0, 0, 1);
	float Darkness = 0.f;
	float FlashValue = 0.f;
	FVector FlashPos = FVector(0, 0, 80000);
	int64 BoltKey = -1;
	FVector CamPos = FVector::ZeroVector;
	FVector CamDir = FVector(1, 0, 0);

	// Play-mode transition and random lightning
	bool bBlending = false;
	FNYCWeather BlendFrom, BlendTo;
	float BlendT = 0.f, BlendDuration = 1.f;
	TArray<FNYCStrike> LiveStrikes;
	float NextRandomStrike = 4.f;

	void FindPeers();
	bool GetViewCamera(FVector& OutPos, FVector& OutDir) const;
	void UpdateSunAndSky();
	void UpdateExposure();
	void UpdatePrecipitation();
	void UpdateLightning();
	void UpdateCollection();
	void BuildBolt(const FNYCStrike& S);
	float StrikeEnvelope(float Tau) const;
	FNYCWeather Capture() const;
};
