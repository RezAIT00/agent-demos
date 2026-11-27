#include "NYCLightField.h"
#include "NYC.h"
#include "Components/SpotLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/RectLightComponent.h"
#include "Misc/FileHelper.h"

ANYCLightField::ANYCLightField()
{
	PrimaryActorTick.bCanEverTick = false;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Movable);
	RootComponent = Root;
}

int32 ANYCLightField::LoadFile(const FString& Path)
{
	TArray64<uint8> Data;
	if (!FFileHelper::LoadFileToArray(Data, *Path) || Data.Num() < 8)
	{
		UE_LOG(LogNYC, Error, TEXT("Cannot read lights %s"), *Path);
		return 0;
	}
	const uint8* P = Data.GetData();
	uint32 Magic = 0, Count = 0;
	FMemory::Memcpy(&Magic, P, 4);
	FMemory::Memcpy(&Count, P + 4, 4);
	P += 8;
	if (Magic != 0x5447494C || Data.Num() < 8 + (int64)Count * 20 * 4)
	{
		UE_LOG(LogNYC, Error, TEXT("Bad lights file %s"), *Path);
		return 0;
	}
	Lights.Reset(Count);
	for (uint32 i = 0; i < Count; ++i)
	{
		float V[20];
		FMemory::Memcpy(V, P, sizeof(V));
		P += sizeof(V);
		FNYCLight L;
		L.Position = FVector(V[0], V[1], V[2]);
		L.Direction = FVector(V[3], V[4], V[5]);
		L.Color = FLinearColor(V[6], V[7], V[8]);
		L.Intensity = V[9];
		L.Radius = V[10];
		L.Cone = V[11];
		L.RectSize = FVector2D(V[12], V[13]);
		L.Kind = static_cast<ENYCLightKind>(FMath::Clamp(FMath::RoundToInt(V[14]), 0, 6));
		L.bShadows = V[15] > 0.5f;
		L.SourceRadius = V[16];
		L.Volumetric = V[17];
		Lights.Add(L);
	}
	Rebuild();
	return Lights.Num();
}

void ANYCLightField::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	Rebuild();
}

void ANYCLightField::PostRegisterAllComponents()
{
	Super::PostRegisterAllComponents();
	if (!bBuilt && !IsTemplate() && GetWorld())
	{
		Rebuild();
	}
}

void ANYCLightField::Rebuild()
{
	for (ULocalLightComponent* C : Components)
	{
		if (C && IsValid(C)) C->DestroyComponent();
	}
	Components.Reset(Lights.Num());
	LastGains.Reset();
	LastVolumetric = -1.f;
	if (!GetWorld() || IsTemplate()) return;

	for (int32 i = 0; i < Lights.Num(); ++i)
	{
		const FNYCLight& L = Lights[i];
		ULocalLightComponent* Comp = nullptr;
		if (L.Cone < 0.f)
		{
			URectLightComponent* R = NewObject<URectLightComponent>(this, NAME_None, RF_Transient);
			R->SourceWidth = L.RectSize.X;
			R->SourceHeight = L.RectSize.Y;
			R->BarnDoorAngle = 88.f;
			R->IntensityUnits = ELightUnits::Lumens;
			Comp = R;
		}
		else if (L.Cone > 0.f)
		{
			USpotLightComponent* S = NewObject<USpotLightComponent>(this, NAME_None, RF_Transient);
			S->OuterConeAngle = FMath::Min(L.Cone, 89.f);
			S->InnerConeAngle = FMath::Min(L.Cone, 89.f) * 0.55f;
			S->IntensityUnits = ELightUnits::Candelas;
			S->SourceRadius = L.SourceRadius;
			Comp = S;
		}
		else
		{
			UPointLightComponent* Pt = NewObject<UPointLightComponent>(this, NAME_None, RF_Transient);
			Pt->IntensityUnits = ELightUnits::Candelas;
			Pt->SourceRadius = L.SourceRadius;
			Comp = Pt;
		}
		Comp->SetMobility(EComponentMobility::Movable);
		Comp->SetupAttachment(Root);
		Comp->SetWorldLocationAndRotation(L.Position, L.Direction.Rotation());
		Comp->AttenuationRadius = L.Radius;
		Comp->LightColor = L.Color.ToFColor(true);
		Comp->Intensity = L.Intensity;
		Comp->CastShadows = L.bShadows;
		Comp->VolumetricScatteringIntensity = L.Volumetric;
		Comp->MaxDrawDistance = 0.f;
		Comp->RegisterComponent();
		Components.Add(Comp);
	}
	bBuilt = true;
}

void ANYCLightField::SetKindGains(const TArray<float>& Gains, float VolumetricGain)
{
	if (!bBuilt || Components.Num() != Lights.Num())
	{
		Rebuild();
	}
	if (LastGains == Gains && FMath::IsNearlyEqual(LastVolumetric, VolumetricGain)) return;
	LastGains = Gains;
	LastVolumetric = VolumetricGain;
	for (int32 i = 0; i < Components.Num(); ++i)
	{
		ULocalLightComponent* C = Components[i];
		if (!C) continue;
		const int32 Kind = static_cast<int32>(Lights[i].Kind);
		const float G = Gains.IsValidIndex(Kind) ? Gains[Kind] : 1.f;
		const bool bOn = G > 0.004f && !Killed.Contains(i);
		C->SetVisibility(bOn);
		if (bOn)
		{
			C->SetIntensity(Lights[i].Intensity * G);
			C->SetVolumetricScatteringIntensity(Lights[i].Volumetric * VolumetricGain);
		}
	}
}

void ANYCLightField::KillLights(const FVector& Centre, float Radius)
{
	const double R2 = (double)Radius * Radius;
	for (int32 i = 0; i < Lights.Num(); ++i)
	{
		if (FVector::DistSquared(Lights[i].Position, Centre) > R2) continue;
		Killed.Add(i);
		if (Components.IsValidIndex(i) && Components[i]) Components[i]->SetVisibility(false);
	}
}

void ANYCLightField::ReviveLights()
{
	if (Killed.Num() == 0) return;
	Killed.Reset();
	// force the gains to be applied again
	LastVolumetric = -1.f;
	LastGains.Reset();
}
