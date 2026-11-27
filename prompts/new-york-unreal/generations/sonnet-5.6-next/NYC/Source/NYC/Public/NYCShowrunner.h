#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCShowrunner.generated.h"

class UChaosCacheCollection;
class ANYCDestruction;

/**
 * Runs the destruction film's events.  A level sequence keys Shot and ShotTime; this actor sets the
 * destruction clock from them, fires the tools listed for that shot in source/film/destruction_shots.json,
 * and records the physics into the shot's Chaos cache collection or plays it back from there.  With ShotTime
 * below zero (Play mode, the first film) it does nothing.
 *
 * Console variable nyc.FilmCache: 0 simulate live, 1 record, 2 play back.
 */
UCLASS()
class NYC_API ANYCShowrunner : public AActor
{
	GENERATED_BODY()
public:
	ANYCShowrunner();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Film") int32 Shot = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Interp, Category = "Film") float ShotTime = -1.f;

	virtual void Tick(float Dt) override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	bool Begin();
	void WriteLog();

	UPROPERTY() ANYCDestruction* Director = nullptr;
	UPROPERTY() UChaosCacheCollection* Cache = nullptr;
	int32 Running = -1;
	FString ShotName;
	TArray<FString> Frames;
	double LastTime = -1.0;
};
