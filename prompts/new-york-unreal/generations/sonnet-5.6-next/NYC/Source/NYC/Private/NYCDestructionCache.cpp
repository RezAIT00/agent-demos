// Chaos Caching: every simulated component gets its own cache manager from the moment it is created.
// While recording, the manager writes the physics thread's results into the shot's cache collection.
// While playing back nothing is simulated: each manager is asked for the state at an exact time, so the
// movie render queue sees the same frame however often and however fast it asks.
#include "NYCDestruction.h"
#include "NYC.h"
#include "Chaos/CacheManagerActor.h"
#include "Chaos/CacheCollection.h"
#include "Components/PrimitiveComponent.h"
#include "Engine/World.h"

void ANYCDestruction::RegisterForCache(UPrimitiveComponent* Comp, const FString& CacheName, TWeakObjectPtr<AChaosCacheManager>& OutManager)
{
	if (CacheMode == ENYCCacheMode::Off || !CacheCollection || !Comp) return;
	FActorSpawnParameters P;
	P.ObjectFlags |= RF_Transient;
	P.bDeferConstruction = true;
	AChaosCacheManager* M = GetWorld()->SpawnActor<AChaosCacheManager>(AChaosCacheManager::StaticClass(), FTransform::Identity, P);
	if (!M) return;
	M->CacheCollection = CacheCollection;
	M->CacheMode = CacheMode == ENYCCacheMode::Record ? ECacheMode::Record : ECacheMode::None;
	M->StartMode = EStartMode::Timed;
	M->bStartOnBeginPlay = false;
	M->bReplayEventsInStaticPoseMode = false;
	M->FinishSpawning(FTransform::Identity);
	// the cache manager silently skips transient components, and every piece of debris is one
	const bool bTransient = Comp->HasAnyFlags(RF_Transient);
	Comp->ClearFlags(RF_Transient);
	M->FindOrAddObservedComponent(Comp, FName(*CacheName), false);
	if (bTransient) Comp->SetFlags(RF_Transient);
	if (CacheMode == ENYCCacheMode::Record)
	{
		M->Start(0.f);
	}
	SpawnedActors.Add(M);
	OutManager = M;
	CacheBorn.Add(M, Clock);
}

void ANYCDestruction::EvaluateCaches()
{
	if (CacheMode != ENYCCacheMode::Playback) return;
	for (const TPair<TWeakObjectPtr<AChaosCacheManager>, double>& It : CacheBorn)
	{
		if (AChaosCacheManager* M = It.Key.Get())
		{
			M->SetCurrentTime(FMath::Max(0.f, (float)(PlaybackTime - It.Value)));
		}
	}
}
