#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCCityActor.generated.h"

class UInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;

/** Owns the instanced geometry of the city. Components are created by the build scripts and saved with the map. */
UCLASS()
class NYC_API ANYCCityActor : public AActor
{
	GENERATED_BODY()
public:
	ANYCCityActor();

	UFUNCTION(BlueprintCallable, Category = "NYC")
	void ClearAll();

	UInstancedStaticMeshComponent* AddGroup(const FString& Name, UStaticMesh* Mesh,
		const TArray<FTransform>& Transforms, const TArray<float>& CustomData, int32 NumCustom,
		bool bCastShadow, bool bInRayTracing, const TMap<int32, UMaterialInterface*>& SlotOverrides);

	UPROPERTY(VisibleAnywhere, Category = "NYC")
	USceneComponent* Root;

	UPROPERTY(VisibleAnywhere, Category = "NYC")
	TArray<UInstancedStaticMeshComponent*> Groups;

	/** Components of city.nlayout by their index in that file (null where a mesh was missing).
	 *  The destruction data refers to instances as (group index, instance index). */
	UPROPERTY(VisibleAnywhere, Category = "NYC")
	TArray<UInstancedStaticMeshComponent*> LayoutGroups;
};
