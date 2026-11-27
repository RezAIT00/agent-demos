#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCLightField.generated.h"

class ULocalLightComponent;

/** Categories let the weather controller switch groups of city lights independently. */
UENUM(BlueprintType)
enum class ENYCLightKind : uint8
{
	Street,     // street lamps: on at dusk
	Shop,       // storefront spill: follows shop hours
	Sign,       // signs and marquees: always on, dim in daylight
	Landmark,   // crown and facade floodlights
	Holiday,    // winter-village strings
	Lobby,      // entrance canopies
	Park        // park lamps
};

USTRUCT(BlueprintType)
struct FNYCLight
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector Position = FVector::ZeroVector;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector Direction = FVector(0, 0, -1);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FLinearColor Color = FLinearColor::White;
	/** Candela for spot and point lights, lumens for rect lights. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Intensity = 1000.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Radius = 2500.f;
	/** Outer cone half angle; 0 makes a point light, negative a rect light. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Cone = 65.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") FVector2D RectSize = FVector2D(100, 50);
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") ENYCLightKind Kind = ENYCLightKind::Street;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") bool bShadows = true;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float SourceRadius = 8.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC") float Volumetric = 1.f;
};

/** Thousands of static city lights, rebuilt from data on load and rendered with MegaLights. */
UCLASS()
class NYC_API ANYCLightField : public AActor
{
	GENERATED_BODY()
public:
	ANYCLightField();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "NYC")
	TArray<FNYCLight> Lights;

	/** Reads the binary .nlights file written by the city generator. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	int32 LoadFile(const FString& Path);

	UFUNCTION(BlueprintCallable, CallInEditor, Category = "NYC")
	void Rebuild();

	/** Puts out the lamps within a radius (a toppled post, a fallen facade) until ReviveLights. */
	void KillLights(const FVector& Centre, float Radius);
	void ReviveLights();

	/** Gains per ENYCLightKind, in enum order. */
	void SetKindGains(const TArray<float>& Gains, float VolumetricGain);

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void PostRegisterAllComponents() override;

private:
	UPROPERTY(Transient, DuplicateTransient)
	TArray<ULocalLightComponent*> Components;

	UPROPERTY(VisibleAnywhere, Category = "NYC") USceneComponent* Root;

	TSet<int32> Killed;
	TArray<float> LastGains;
	float LastVolumetric = -1.f;
	bool bBuilt = false;
};
