#include "NYCCityActor.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"

ANYCCityActor::ANYCCityActor()
{
	PrimaryActorTick.bCanEverTick = false;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Static);
	RootComponent = Root;
}

void ANYCCityActor::ClearAll()
{
	for (UInstancedStaticMeshComponent* C : Groups)
	{
		if (C)
		{
			RemoveInstanceComponent(C);
			C->DestroyComponent();
		}
	}
	Groups.Reset();
	LayoutGroups.Reset();
}

UInstancedStaticMeshComponent* ANYCCityActor::AddGroup(const FString& Name, UStaticMesh* Mesh,
	const TArray<FTransform>& Transforms, const TArray<float>& CustomData, int32 NumCustom,
	bool bCastShadow, bool bInRayTracing, const TMap<int32, UMaterialInterface*>& SlotOverrides)
{
	if (!Mesh || Transforms.Num() == 0)
	{
		return nullptr;
	}
	const FName CompName = MakeUniqueObjectName(this, UInstancedStaticMeshComponent::StaticClass(), FName(*Name));
	UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, CompName, RF_Transactional);
	C->SetMobility(EComponentMobility::Static);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->SetGenerateOverlapEvents(false);
	C->SetCanEverAffectNavigation(false);
	C->NumCustomDataFloats = NumCustom;
	C->CastShadow = bCastShadow;
	C->bCastDynamicShadow = bCastShadow;
	C->bVisibleInRayTracing = bInRayTracing;
	C->bAffectDistanceFieldLighting = false;
	for (const TPair<int32, UMaterialInterface*>& It : SlotOverrides)
	{
		C->SetMaterial(It.Key, It.Value);
	}
	C->SetupAttachment(Root);
	C->PreAllocateInstancesMemory(Transforms.Num());
	C->AddInstances(Transforms, false, true);
	if (NumCustom > 0 && CustomData.Num() == Transforms.Num() * NumCustom)
	{
		for (int32 i = 0; i < Transforms.Num(); ++i)
		{
			C->SetCustomData(i, MakeArrayView(CustomData.GetData() + i * NumCustom, NumCustom), false);
		}
	}
	AddInstanceComponent(C);
	C->RegisterComponent();
	C->MarkRenderStateDirty();
	Groups.Add(C);
	return C;
}
