#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "NYCBuilderLibrary.generated.h"

class UStaticMesh;
class UMaterialInterface;
class UTexture2D;
class UVolumeTexture;
class ANYCCityActor;

/** Editor-time asset building used by the Python build scripts in source/. */
UCLASS()
class NYC_API UNYCBuilderLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
public:
	/** Builds (or rebuilds) a static mesh asset from a .nmesh file written by the Python generator. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	static UStaticMesh* ImportNMesh(const FString& FilePath, const FString& PackagePath,
		const TMap<FName, UMaterialInterface*>& SlotMaterials, bool bNanite, int32 LumenCards, bool bPreserveArea);

	/** Creates a volume texture from a 2D slice atlas. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	static UVolumeTexture* MakeVolumeTexture(const FString& PackagePath, UTexture2D* Atlas, int32 TileSize);

	/** Adds instanced components to the city actor from a binary .nlayout file. Returns instance count. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	static int32 LoadLayout(ANYCCityActor* City, const FString& FilePath, const FString& MeshFolder,
		const TMap<FName, UMaterialInterface*>& OverrideMaterials);

	/** Saves a package that was created by one of the functions above. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	static bool SaveAssetObject(UObject* Asset);

	/** Blocks until all queued shader and asset compilation is finished. */
	UFUNCTION(BlueprintCallable, Category = "NYC")
	static void FinishAllCompilation();
};
