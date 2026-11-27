#include "NYCDestruction.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "NYCDestructionFX.h"
#include "NYCLightField.h"
#include "NYCTraffic.h"
#include "NYCWeatherController.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"
#include "GameFramework/PlayerController.h"
#include "Components/BoxComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "ProceduralMeshComponent.h"
#include "GeometryCollection/GeometryCollectionComponent.h"
#include "GeometryCollection/GeometryCollectionObject.h"
#include "GeometryCollection/GeometryCollection.h"
#include "GeometryCollection/GeometryCollectionSimulationCoreTypes.h"
#include "GeometryCollection/ManagedArray.h"
#include "PhysicsProxy/GeometryCollectionPhysicsProxy.h"
#include "Field/FieldSystemObjects.h"
#include "Chaos/CacheManagerActor.h"
#include "Chaos/CacheCollection.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstance.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

static TAutoConsoleVariable<int32> CVarNoBuildingColliders(TEXT("nyc.NoBuildingColliders"), 0, TEXT("Debug: debris collides with the ground only"));

namespace
{
	const float GridCell = 4000.f;
	uint64 GridKey(int32 X, int32 Y) { return (uint64(uint32(X)) << 32) | uint32(Y); }
}

// ------------------------------------------------------------------ batches
int32 FNYCBatch::NewGroup(const FVector& Velocity, bool bCrumble, const FVector& Spin)
{
	GroupVelocity.Add(Velocity);
	GroupSpin.Add(Spin);
	GroupCrumble.Add(bCrumble ? 1 : 0);
	return GroupVelocity.Num() - 1;
}

int32 FNYCBatch::MaterialSlot(UMaterialInterface* M)
{
	int32 Found = Materials.Find(M);
	return Found != INDEX_NONE ? Found : Materials.Add(M);
}

// ------------------------------------------------------------------ lifecycle
ANYCDestruction::ANYCDestruction()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

ANYCDestruction* ANYCDestruction::Get(UWorld* World, bool bCreate)
{
	if (!World) return nullptr;
	for (TActorIterator<ANYCDestruction> It(World); It; ++It) return *It;
	if (!bCreate) return nullptr;
	FActorSpawnParameters P;
	P.ObjectFlags |= RF_Transient;
	return World->SpawnActor<ANYCDestruction>(FVector::ZeroVector, FRotator::ZeroRotator, P);
}

void ANYCDestruction::BeginPlay()
{
	Super::BeginPlay();
	Rand.Initialize(1789);
}

void ANYCDestruction::EndPlay(const EEndPlayReason::Type Reason)
{
	Super::EndPlay(Reason);
}

void ANYCDestruction::PlaySound(const FName& Name, const FVector& At, float Volume, float Pitch)
{
	if (bExternalClock || bQuiet) return;
	USoundBase** Found = Sounds.Find(Name);
	if (!Found)
	{
		const FString N = Name.ToString();
		USoundBase* S = LoadObject<USoundBase>(nullptr, *FString::Printf(TEXT("/Game/NYC/Audio/%s.%s"), *N, *N), nullptr, LOAD_NoWarn | LOAD_Quiet);
		Found = &Sounds.Add(Name, S);
	}
	if (!*Found) return;
	// distance attenuation done by hand: loud things carry across several blocks
	double Dist = 0.0;
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		FVector Eye;
		FRotator Look;
		PC->GetPlayerViewPoint(Eye, Look);
		Dist = FVector::Dist(Eye, At);
	}
	const float Near = 1800.f + 5200.f * FMath::Clamp(Volume, 0.f, 2.f);
	const float Gain = Volume * FMath::Clamp(Near / (float)FMath::Max(Dist, (double)Near), 0.04f, 1.f);
	UGameplayStatics::PlaySound2D(this, *Found, Gain, Pitch);
}

ANYCTraffic* ANYCDestruction::Traffic() const
{
	for (TActorIterator<ANYCTraffic> It(GetWorld()); It; ++It) return *It;
	return nullptr;
}

ANYCWeatherController* ANYCDestruction::Weather() const
{
	for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It) return *It;
	return nullptr;
}

FVector ANYCDestruction::Wind() const
{
	const ANYCWeatherController* W = Weather();
	return FVector(1.0, 0.35, 0.0).GetSafeNormal() * (80.0 + 500.0 * (W ? W->Wind : 0.2f));
}

ANYCDestructionFX* ANYCDestruction::FX()
{
	if (!Effects)
	{
		FActorSpawnParameters P;
		P.ObjectFlags |= RF_Transient;
		Effects = GetWorld()->SpawnActor<ANYCDestructionFX>(FVector::ZeroVector, FRotator::ZeroRotator, P);
		Effects->Init(this);
	}
	return Effects;
}

// ------------------------------------------------------------------ data
bool ANYCDestruction::EnsureLoaded()
{
	if (bLoaded) return true;
	const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("NYC/Data/destruction.json"));
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		UE_LOG(LogNYC, Error, TEXT("Destruction data missing: %s"), *Path);
		return false;
	}
	TSharedPtr<FJsonObject> Root;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Root) || !Root)
	{
		UE_LOG(LogNYC, Error, TEXT("Destruction data unreadable"));
		return false;
	}
	for (TActorIterator<ANYCCityActor> It(GetWorld()); It; ++It)
	{
		if (It->LayoutGroups.Num() > 0) { City = *It; break; }
	}
	if (!City)
	{
		UE_LOG(LogNYC, Error, TEXT("No city actor with layout groups in this level"));
		return false;
	}

	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("buildings")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FNYCBuildingInfo B;
		B.Kind = O->GetStringField(TEXT("kind"));
		B.Name = O->GetStringField(TEXT("name"));
		B.Style = O->GetStringField(TEXT("style"));
		B.Wall = O->GetStringField(TEXT("wall"));
		B.Trim = O->GetStringField(TEXT("trim"));
		B.Glass = O->GetStringField(TEXT("glass"));
		B.Frame = O->GetStringField(TEXT("frame"));
		B.Party = O->GetStringField(TEXT("party"));
		B.FloorH = O->GetNumberField(TEXT("fh")) * 100.0;
		B.Bay = O->GetNumberField(TEXT("bay")) * 100.0;
		B.Height = O->GetNumberField(TEXT("h")) * 100.0;
		const TArray<TSharedPtr<FJsonValue>>& R = O->GetArrayField(TEXT("rect"));
		B.Rect = FBox2D(FVector2D(R[0]->AsNumber(), R[2]->AsNumber()) * 100.0, FVector2D(R[1]->AsNumber(), R[3]->AsNumber()) * 100.0);
		for (const TSharedPtr<FJsonValue>& T : O->GetArrayField(TEXT("tiers")))
		{
			const TArray<TSharedPtr<FJsonValue>>& A = T->AsArray();
			B.Tiers.Add(FBox(FVector(A[0]->AsNumber(), A[2]->AsNumber(), A[4]->AsNumber()) * 100.0,
				FVector(A[1]->AsNumber(), A[3]->AsNumber(), A[5]->AsNumber()) * 100.0));
		}
		const TArray<TSharedPtr<FJsonValue>>& Refs = O->GetArrayField(TEXT("refs"));
		B.Refs.Reserve(Refs.Num() / 2);
		for (int32 i = 0; i + 1 < Refs.Num(); i += 2) B.Refs.Add(FIntPoint((int32)Refs[i]->AsNumber(), (int32)Refs[i + 1]->AsNumber()));
		for (const TSharedPtr<FJsonValue>& S : O->GetArrayField(TEXT("shells"))) B.Shells.Add(S->AsString());
		B.Box = FBox(FVector(B.Rect.Min.X, B.Rect.Min.Y, 0.0), FVector(B.Rect.Max.X, B.Rect.Max.Y, B.Height));
		for (const FBox& T : B.Tiers) B.Box += T;
		B.bMasonry = B.Style != TEXT("glass") && B.Style != TEXT("ribbon");
		const int32 Index = Buildings.Add(MoveTemp(B));
		const FBox& Box = Buildings[Index].Box;
		for (int32 x = FMath::FloorToInt32(Box.Min.X / GridCell); x <= FMath::FloorToInt32(Box.Max.X / GridCell); ++x)
			for (int32 y = FMath::FloorToInt32(Box.Min.Y / GridCell); y <= FMath::FloorToInt32(Box.Max.Y / GridCell); ++y)
				BuildingGrid.FindOrAdd(GridKey(x, y)).Add(Index);
	}
	States.SetNum(Buildings.Num());

	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("far")))
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		const FVector Min(A[0]->AsNumber() * 100.0, A[1]->AsNumber() * 100.0, A[4]->AsNumber() * 100.0);
		const FVector Size(A[2]->AsNumber() * 100.0, A[3]->AsNumber() * 100.0, A[5]->AsNumber() * 100.0);
		const double Yaw = A[6]->AsNumber();
		const FBox Box = FBox(FVector::ZeroVector, Size).TransformBy(FTransform(FRotator(0, Yaw, 0), Min));
		FarBoxes.Add({ Box, (int32)A[7]->AsNumber(), (int32)A[8]->AsNumber(), true });
	}
	for (const auto& Pair : Root->GetObjectField(TEXT("modules"))->Values)
	{
		const TSharedPtr<FJsonObject> M = Pair.Value->AsObject();
		TArray<FVector4f> Openings;
		float Depth = 20.f;
		for (const TSharedPtr<FJsonValue>& W : M->GetArrayField(TEXT("windows")))
		{
			const TArray<TSharedPtr<FJsonValue>>& A = W->AsArray();
			Openings.Add(FVector4f(A[0]->AsNumber() * 100.0, A[1]->AsNumber() * 100.0, A[2]->AsNumber() * 100.0, A[3]->AsNumber() * 100.0));
			if (A.Num() > 4) Depth = FMath::Max(Depth, (float)A[4]->AsNumber() * 100.f);
		}
		const FString Name(Pair.Key.ToView());
		ModuleInfo.Add(Name, TPair<FVector2D, TArray<FVector4f>>(FVector2D(M->GetNumberField(TEXT("w")), M->GetNumberField(TEXT("h"))) * 100.0, Openings));
		ModuleDepth.Add(Name, Depth);
	}
	bLoaded = true;
	IndexProps();
	UE_LOG(LogNYC, Log, TEXT("Destruction: %d buildings, %d distant boxes, %d street objects"), Buildings.Num(), FarBoxes.Num(), Props.Num());
	return true;
}

void ANYCDestruction::BuildingsNear(const FVector& P, float Radius, TArray<int32>& Out) const
{
	Out.Reset();
	const float R2 = Radius * Radius;
	if (Radius > 20000.f)
	{
		for (int32 i = 0; i < Buildings.Num(); ++i)
			if (Buildings[i].Box.ComputeSquaredDistanceToPoint(P) <= R2) Out.Add(i);
		return;
	}
	TSet<int32> Seen;
	for (int32 x = FMath::FloorToInt32((P.X - Radius) / GridCell); x <= FMath::FloorToInt32((P.X + Radius) / GridCell); ++x)
	{
		for (int32 y = FMath::FloorToInt32((P.Y - Radius) / GridCell); y <= FMath::FloorToInt32((P.Y + Radius) / GridCell); ++y)
		{
			const TArray<int32>* List = BuildingGrid.Find(GridKey(x, y));
			if (!List) continue;
			for (int32 i : *List)
			{
				bool bSeen = false;
				Seen.Add(i, &bSeen);
				if (!bSeen && Buildings[i].Box.ComputeSquaredDistanceToPoint(P) <= R2) Out.Add(i);
			}
		}
	}
	Out.Sort();
}

bool ANYCDestruction::NearestBuilding(const FVector& P, float MaxDist, int32& OutBuilding) const
{
	TArray<int32> Near;
	BuildingsNear(P, MaxDist, Near);
	double Best = TNumericLimits<double>::Max();
	OutBuilding = INDEX_NONE;
	for (int32 i : Near)
	{
		if (States[i].bFallen) continue;
		const double D = Buildings[i].Box.ComputeSquaredDistanceToPoint(P);
		if (D < Best) { Best = D; OutBuilding = i; }
	}
	return OutBuilding != INDEX_NONE;
}

float ANYCDestruction::Trace(const FVector& O, const FVector& D, float MaxDist, FVector& OutPoint, FVector& OutNormal, int32* OutBuilding) const
{
	double Best = MaxDist;
	int32 BestBuilding = INDEX_NONE;
	FVector BestNormal(0, 0, 1);
	auto RayBox = [&](const FBox& B, double& T, FVector& N)
	{
		double T0 = 0.0, T1 = Best;
		int32 Axis = -1;
		for (int32 k = 0; k < 3; ++k)
		{
			if (FMath::Abs(D[k]) < 1e-9)
			{
				if (O[k] < B.Min[k] || O[k] > B.Max[k]) return false;
				continue;
			}
			double A = (B.Min[k] - O[k]) / D[k], C = (B.Max[k] - O[k]) / D[k];
			if (A > C) Swap(A, C);
			if (A > T0) { T0 = A; Axis = k; }
			T1 = FMath::Min(T1, C);
			if (T0 > T1) return false;
		}
		if (Axis < 0) return false;
		T = T0;
		N = FVector::ZeroVector;
		N[Axis] = D[Axis] > 0 ? -1.0 : 1.0;
		return true;
	};
	if (D.Z < -1e-4)
	{
		const double T = -O.Z / D.Z;
		if (T > 0 && T < Best) Best = T;
	}
	double T;
	FVector N;
	for (int32 i = 0; i < Buildings.Num(); ++i)
	{
		const FNYCBuildingInfo& B = Buildings[i];
		if (!RayBox(B.Box, T, N) && !B.Box.IsInside(O)) continue;
		const FNYCBuildingState& S = States[i];
		if (S.bActive)
		{
			for (const FNYCElement& E : S.Elements)
			{
				if (E.bAlive && E.Type != ENYCElement::Fitout && RayBox(E.Box, T, N)) { Best = T; BestNormal = N; BestBuilding = i; }
			}
		}
		else if (!S.bFallen)
		{
			for (const FBox& Tier : B.Tiers)
			{
				if (RayBox(Tier.ExpandBy(FVector(12, 12, 0)), T, N)) { Best = T; BestNormal = N; BestBuilding = i; }
			}
		}
	}
	for (const FFar& F : FarBoxes)
	{
		if (F.bAlive && RayBox(F.Box, T, N)) { Best = T; BestNormal = N; BestBuilding = INDEX_NONE; }
	}
	if (OutBuilding) *OutBuilding = BestBuilding;
	if (Best >= MaxDist) return -1.f;
	OutPoint = O + D * Best;
	OutNormal = BestNormal;
	return (float)Best;
}

void ANYCDestruction::Exposure(const FVector& P, const FVector& ToSun, float& OutSun, float& OutSky) const
{
	auto Blocked = [this](const FVector& Q)
	{
		const TArray<int32>* List = BuildingGrid.Find(GridKey(FMath::FloorToInt32(Q.X / GridCell), FMath::FloorToInt32(Q.Y / GridCell)));
		if (!List) return false;
		for (int32 i : *List)
		{
			if (States[i].bFallen) continue;
			for (const FBox& T : Buildings[i].Tiers)
				if (T.IsInside(Q)) return true;
		}
		return false;
	};
	// three parallel rays toward the sun
	const FVector Side = FVector::CrossProduct(ToSun, FVector::UpVector).GetSafeNormal(UE_SMALL_NUMBER, FVector::RightVector);
	float Clear = 0.f;
	for (int32 k = -1; k <= 1; ++k)
	{
		bool bHit = false;
		// fine steps close by, so the wall beside a cloud shades it
		for (double T = 140.0; T < 36000.0 && !bHit; T += FMath::Clamp(T * 0.22, 160.0, 800.0))
		{
			const FVector Q = P + Side * (k * 260.0) + ToSun * T;
			if (Q.Z > 40000.0) break;
			bHit = Blocked(Q);
		}
		Clear += bHit ? 0.f : 1.f / 3.f;
	}
	OutSun = ToSun.Z > -0.02 ? FMath::Lerp(0.07f, 1.f, Clear) : 0.f;
	// the sky: look up and out at a few angles
	float Open = 0.f;
	static const FVector Looks[] = { FVector(0, 0, 1), FVector(0.64, 0, 0.77), FVector(-0.64, 0, 0.77), FVector(0, 0.64, 0.77), FVector(0, -0.64, 0.77) };
	for (const FVector& L : Looks)
	{
		bool bHit = false;
		for (double T = 600.0; T < 12000.0 && !bHit; T += 700.0) bHit = Blocked(P + L * T);
		Open += bHit ? 0.f : 0.2f;
	}
	OutSky = FMath::Lerp(0.2f, 1.f, Open);
}

// ------------------------------------------------------------------ assets
UStaticMesh* ANYCDestruction::CityMesh(const FString& Name)
{
	if (UStaticMesh** Found = MeshByName.Find(Name)) return *Found;
	UStaticMesh* M = LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("/Game/NYC/Meshes/%s.%s"), *Name, *Name), nullptr, LOAD_NoWarn | LOAD_Quiet);
	MeshByName.Add(Name, M);
	return M;
}

UMaterialInterface* ANYCDestruction::CityMaterial(const FString& Name)
{
	if (UMaterialInterface** Found = MaterialByName.Find(Name)) return *Found;
	UMaterialInterface* M = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/NYC/Materials/MI_%s.MI_%s"), *Name, *Name), nullptr, LOAD_NoWarn | LOAD_Quiet);
	if (!M) M = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/NYC/Materials/%s.%s"), *Name, *Name), nullptr, LOAD_NoWarn | LOAD_Quiet);
	MaterialByName.Add(Name, M);
	return M;
}

UMaterialInterface* ANYCDestruction::DebrisMaterial(UMaterialInterface* Source)
{
	// every surface material has a twin that maps its textures by rest pose, so they do not swim on moving pieces
	if (UMaterialInterface** Found = DebrisByMaterial.Find(Source)) return *Found;
	UMaterialInterface* Result = Source;
	if (Source)
	{
		const FString Name = Source->GetName();
		UMaterialInterface* Twin = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/NYC/Materials/Debris/%s_D.%s_D"), *Name, *Name), nullptr, LOAD_NoWarn | LOAD_Quiet);
		if (!Twin && Name.Contains(TEXT("glass")))
		{
			Twin = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/NYC/Materials/Debris/MI_shard.MI_shard"), nullptr, LOAD_NoWarn | LOAD_Quiet);
		}
		if (Twin) Result = Twin;
	}
	if (!Result || Result == Source)
	{
		// no twin was built for this one: a plain dark finish that works on geometry collections
		UMaterialInterface* Fallback = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/NYC/Materials/Debris/MI_paint_darkgray_D.MI_paint_darkgray_D"), nullptr, LOAD_NoWarn | LOAD_Quiet);
		if (Fallback && !(Source && Source->GetName().EndsWith(TEXT("_D")))) Result = Fallback;
	}
	DebrisByMaterial.Add(Source, Result);
	return Result;
}

const FNYCSoup& ANYCDestruction::Soup(UStaticMesh* Mesh)
{
	if (const FNYCSoup* Found = SoupCache.Find(Mesh)) return *Found;
	FNYCSoup S;
	NYCFracture::ReadMesh(Mesh, S);
	KeepAlive.AddUnique(Mesh);
	return SoupCache.Add(Mesh, MoveTemp(S));
}

UStaticMesh* ANYCDestruction::UnitCube()
{
	if (!Cube) Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	return Cube;
}

UStaticMeshComponent* ANYCDestruction::NewVisual(UStaticMesh* Mesh, const FTransform& Xf, bool bMovable)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, NAME_None, RF_Transient);
	C->SetMobility(EComponentMobility::Movable);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->bAffectDistanceFieldLighting = false;
	C->SetupAttachment(RootComponent);
	C->SetWorldTransform(Xf);
	C->RegisterComponent();
	Spawned.Add(C);
	return C;
}

// ------------------------------------------------------------------ hiding
void ANYCDestruction::HideInstance(UInstancedStaticMeshComponent* C, int32 Index)
{
	if (!C || Index < 0 || Index >= C->GetInstanceCount()) return;
	const TPair<UInstancedStaticMeshComponent*, int32> Key(C, Index);
	if (Hidden.Contains(Key)) return;
	FTransform Xf;
	C->GetInstanceTransform(Index, Xf, true);
	Hidden.Add(Key, Xf);
	FTransform Gone(Xf.GetRotation(), Xf.GetLocation() - FVector(0, 0, 200000.0), FVector(0.0001));
	C->UpdateInstanceTransform(Index, Gone, true, false, true);
	Dirty.Add(C);
}

void ANYCDestruction::FlushHidden()
{
	for (const TWeakObjectPtr<UInstancedStaticMeshComponent>& C : Dirty)
	{
		if (C.IsValid()) C->MarkRenderInstancesDirty();
	}
	Dirty.Reset();
}

// ------------------------------------------------------------------ activation
UInstancedStaticMeshComponent* ANYCDestruction::ShellGroup(const FString& MeshName)
{
	if (ShellGroups.Num() == 0)
	{
		for (TActorIterator<ANYCCityActor> It(GetWorld()); It; ++It)
		{
			for (UInstancedStaticMeshComponent* C : It->Groups)
			{
				if (!C || !C->GetStaticMesh()) continue;
				const FString Name = C->GetStaticMesh()->GetName();
				if (!ShellGroups.Contains(Name)) ShellGroups.Add(Name, C);
			}
		}
	}
	const TWeakObjectPtr<UInstancedStaticMeshComponent>* Found = ShellGroups.Find(MeshName);
	return Found ? Found->Get() : nullptr;
}

void ANYCDestruction::BuildShellChunks(int32 Index, FNYCBuildingState& S)
{
	const FNYCBuildingInfo& B = Buildings[Index];
	if (B.Shells.Num() == 0) return;
	TMap<FIntVector, int32> CellToChunk;
	const float CellXY = FMath::Max(450.f, FMath::Sqrt((float)(B.Rect.GetArea())) / 9.f);
	const float CellZ = FMath::Max(S.FloorH, 330.f);
	const FVector3f Origin(B.Rect.Min.X - 137.f, B.Rect.Min.Y - 211.f, -17.f);
	for (const FString& ShellName : B.Shells)
	{
		UInstancedStaticMeshComponent* Comp = ShellGroup(ShellName);
		if (!Comp) continue;
		UStaticMesh* Mesh = Comp->GetStaticMesh();
		const FNYCSoup& Source = Soup(Mesh);
		TArray<int32> SlotMap;
		for (int32 m = 0; m < Mesh->GetStaticMaterials().Num(); ++m) SlotMap.Add(S.ShellMats.AddUnique(Comp->GetMaterial(m)));
		for (int32 t = 0; t < Source.NumTris(); ++t)
		{
			const FIntVector& T = Source.Tris[t];
			FBox3f Box(ForceInit);
			Box += Source.Pos[T.X]; Box += Source.Pos[T.Y]; Box += Source.Pos[T.Z];
			const int32 Mat = SlotMap.IsValidIndex(Source.Mat[t]) ? SlotMap[Source.Mat[t]] : 0;
			auto CellOf = [&](const FVector3f& P) { return FIntVector(FMath::FloorToInt32((P.X - Origin.X) / CellXY), FMath::FloorToInt32((P.Y - Origin.Y) / CellXY), FMath::FloorToInt32((P.Z - Origin.Z) / CellZ)); };
			// shrink slightly so that a face lying on a cell border counts as one cell
			const FIntVector Lo = CellOf(Box.Min + FVector3f(1.f)), Hi = CellOf(FVector3f::Max(Box.Max - FVector3f(1.f), Box.Min + FVector3f(1.f)));
			for (int32 x = Lo.X; x <= Hi.X; ++x)
			{
				for (int32 y = Lo.Y; y <= Hi.Y; ++y)
				{
					for (int32 z = Lo.Z; z <= Hi.Z; ++z)
					{
						const FVector3f CMin = Origin + FVector3f(x * CellXY, y * CellXY, z * CellZ);
						const FBox3f Cell(CMin, CMin + FVector3f(CellXY, CellXY, CellZ));
						FNYCSoup Piece;
						if (Lo == Hi)
						{
							const int32 Base = Piece.Pos.Num();
							const int32 V[3] = { T.X, T.Y, T.Z };
							for (int32 k = 0; k < 3; ++k) Piece.AddVertex(Source.Pos[V[k]], Source.Nrm[V[k]], Source.UV0[V[k]], Source.UV1[V[k]], Source.Col[V[k]]);
							Piece.AddTri(Base, Base + 1, Base + 2, 0);
						}
						else
						{
							NYCFracture::ClipTriangleToBox(Source, t, Cell, Piece, 0);
						}
						if (Piece.IsEmpty()) continue;
						int32* Found = CellToChunk.Find(FIntVector(x, y, z));
						const int32 Chunk = Found ? *Found : CellToChunk.Add(FIntVector(x, y, z), S.Chunks.AddDefaulted());
						TArray<TPair<int32, FNYCSoup>>& Parts = S.Chunks[Chunk].Parts;
						int32 Part = INDEX_NONE;
						for (int32 p = 0; p < Parts.Num(); ++p) if (Parts[p].Key == Mat) { Part = p; break; }
						if (Part == INDEX_NONE) Part = Parts.Add(TPair<int32, FNYCSoup>(Mat, FNYCSoup()));
						Parts[Part].Value.Append(Piece);
					}
				}
			}
		}
		S.HiddenShells.Add(Comp);
		Comp->SetVisibility(false);
	}
	if (S.Chunks.Num() == 0) return;
	UProceduralMeshComponent* PM = NewObject<UProceduralMeshComponent>(this, NAME_None, RF_Transient);
	PM->SetupAttachment(RootComponent);
	PM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PM->bUseAsyncCooking = true;
	PM->RegisterComponent();
	Spawned.Add(PM);
	S.ShellMesh = PM;
	int32 Section = 0;
	for (FNYCShellChunk& Chunk : S.Chunks)
	{
		FBox Box(ForceInit);
		for (TPair<int32, FNYCSoup>& Part : Chunk.Parts)
		{
			const FNYCSoup& G = Part.Value;
			TArray<FVector> Verts, Normals;
			TArray<int32> Tris;
			TArray<FVector2D> U0, U1, Empty;
			TArray<FLinearColor> Colors;
			TArray<FProcMeshTangent> Tangents;
			for (int32 i = 0; i < G.Pos.Num(); ++i)
			{
				Verts.Add(FVector(G.Pos[i]));
				Normals.Add(FVector(G.Nrm[i]));
				U0.Add(FVector2D(G.UV0[i]));
				U1.Add(FVector2D(G.UV1[i]));
				Colors.Add(FLinearColor(G.Col[i].X, G.Col[i].Y, G.Col[i].Z, G.Col[i].W));
				const FVector3f N = G.Nrm[i];
				const FVector3f Tg = FVector3f::CrossProduct(FMath::Abs(N.Z) < 0.9f ? FVector3f(0, 0, 1) : FVector3f(1, 0, 0), N).GetSafeNormal();
				Tangents.Add(FProcMeshTangent(FVector(Tg), false));
				Box += FVector(G.Pos[i]);
			}
			Tris.Reserve(G.NumTris() * 3);
			for (const FIntVector& T : G.Tris) { Tris.Add(T.X); Tris.Add(T.Y); Tris.Add(T.Z); }
			PM->CreateMeshSection_LinearColor(Section, Verts, Tris, Normals, U0, U1, Empty, Empty, Colors, Tangents, false);
			PM->SetMaterial(Section, S.ShellMats[Part.Key]);
			Chunk.Sections.Add(Section++);
		}
		FNYCElement E;
		E.Type = ENYCElement::Chunk;
		E.Box = Box;
		E.Chunk = (int32)(&Chunk - S.Chunks.GetData());
		E.Floor = FMath::Clamp(FMath::FloorToInt32(Box.GetCenter().Z / S.FloorH), 0, S.NumFloors - 1);
		E.Support = B.bMasonry ? 0.35f : 0.05f;
		S.Elements.Add(E);
	}
}

void ANYCDestruction::BuildSkeleton(int32 Index, FNYCBuildingState& S)
{
	const FNYCBuildingInfo& B = Buildings[Index];
	TMap<FString, UInstancedStaticMeshComponent*> Comps;
	auto Comp = [&](const FString& Name) -> UInstancedStaticMeshComponent*
	{
		if (UInstancedStaticMeshComponent** Found = Comps.Find(Name)) return *Found;
		FString MeshName = Name, Finish;
		if (!Name.Split(TEXT("|"), &MeshName, &Finish)) MeshName = Name;
		UStaticMesh* Mesh = CityMesh(MeshName);
		if (!Mesh) return nullptr;
		UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(Mesh);
		if (!Finish.IsEmpty())
		{
			if (UMaterialInterface* M = CityMaterial(Finish))
				for (int32 m = 0; m < Mesh->GetStaticMaterials().Num(); ++m) C->SetMaterial(m, M);
		}
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->bAffectDistanceFieldLighting = false;
		C->SetupAttachment(RootComponent);
		C->RegisterComponent();
		Spawned.Add(C);
		S.Skeleton.Add(C);
		Comps.Add(Name, C);
		return C;
	};
	FRandomStream R(7000 + Index);
	auto Add = [&](const FString& Name, const FTransform& Xf, ENYCElement Type, int32 Floor, float Support, const TCHAR* Finish = nullptr)
	{
		UInstancedStaticMeshComponent* C = Comp(Finish ? Name + TEXT("|") + Finish : Name);
		if (!C) return;
		FNYCElement E;
		E.Type = Type;
		E.Comp = C;
		E.Index = C->AddInstance(Xf, true);
		E.Xf = Xf;
		E.Box = C->GetStaticMesh()->GetBoundingBox().TransformBy(Xf);
		E.Floor = FMath::Clamp(Floor, 0, S.NumFloors - 1);
		E.Support = Support;
		S.Elements.Add(E);
	};
	const float FH = S.FloorH;
	for (const FBox& Tier : B.Tiers)
	{
		const FVector Min = Tier.Min + FVector(45, 45, 0), Max = Tier.Max - FVector(45, 45, 0);
		const double W = Max.X - Min.X, D = Max.Y - Min.Y;
		if (W < 200 || D < 200) continue;
		const double Tile = FMath::Max(430.0, FMath::Sqrt(W * D / 36.0));
		const int32 NX = FMath::Max(1, FMath::RoundToInt32(W / Tile)), NY = FMath::Max(1, FMath::RoundToInt32(D / Tile));
		const double ColSpace = FMath::Max(620.0, FMath::Sqrt(W * D / 16.0));
		const int32 CX = FMath::Max(1, FMath::RoundToInt32(W / ColSpace)), CY = FMath::Max(1, FMath::RoundToInt32(D / ColSpace));
		const int32 FirstLevel = FMath::RoundToInt32(Tier.Min.Z / FH), LastLevel = FMath::Max(FirstLevel + 1, FMath::RoundToInt32(Tier.Max.Z / FH));
		for (int32 Level = FirstLevel; Level < LastLevel; ++Level)
		{
			const double Z = Level * FH;
			const double Top = FMath::Min((Level + 1) * (double)FH, Tier.Max.Z);
			if (Top - Z < 120) continue;
			if (Level > 0)
			{
				for (int32 i = 0; i < NX; ++i)
					for (int32 j = 0; j < NY; ++j)
						Add(TEXT("skel_slab"), FTransform(FRotator::ZeroRotator, FVector(Min.X + i * W / NX, Min.Y + j * D / NY, Z + 4.0), FVector(W / NX / 100.0, D / NY / 100.0, 1.0)), ENYCElement::Slab, Level, 0.f);
			}
			for (int32 i = 0; i <= CX; ++i)
				for (int32 j = 0; j <= CY; ++j)
					Add(TEXT("skel_column"), FTransform(FRotator::ZeroRotator, FVector(Min.X + 30 + i * (W - 60) / CX, Min.Y + 30 + j * (D - 60) / CY, Z), FVector(1.0, 1.0, (Top - Z) / 100.0)), ENYCElement::Column, Level, B.bMasonry ? 0.7f : 2.0f);
			for (int32 j = 0; j <= CY; ++j)
				for (int32 i = 0; i < CX; ++i)
					Add(TEXT("skel_beam"), FTransform(FRotator::ZeroRotator, FVector(Min.X + 30 + i * (W - 60) / CX, Min.Y + 30 + j * (D - 60) / CY, Top - 18.0), FVector((W - 60) / CX / 100.0, 1.0, 1.0)), ENYCElement::Beam, Level, 0.f);
			{
				// rooms behind the fronts: without an inner wall a hole shows straight out of the far side
				const double Inset = FMath::Clamp(FMath::Min(W, D) * 0.27, 160.0, 460.0);
				const double Height = Top - Z - 22.0;
				const double RunX = W - 2.0 * Inset, RunY = D - 2.0 * Inset;
				static const TCHAR* Finishes[] = { TEXT("interior_dark"), TEXT("interior_dark"), TEXT("interior_dark"), TEXT("paint_darkgray"), TEXT("paint_gray"), TEXT("paint_brown") };
				for (int32 Side = 0; Side < 4; ++Side)
				{
					const double Run = Side < 2 ? RunX : RunY;
					if (Run < 100.0) continue;
					const int32 N = FMath::Max(1, FMath::RoundToInt32(Run / 480.0));
					for (int32 i = 0; i < N; ++i)
					{
						const FVector At = Side == 0 ? FVector(Min.X + Inset + i * Run / N, Min.Y + Inset, Z + 4)
							: Side == 1 ? FVector(Min.X + Inset + i * Run / N, Max.Y - Inset, Z + 4)
							: Side == 2 ? FVector(Min.X + Inset, Min.Y + Inset + i * Run / N, Z + 4)
							: FVector(Max.X - Inset, Min.Y + Inset + i * Run / N, Z + 4);
						Add(TEXT("skel_partition"), FTransform(FRotator(0, Side < 2 ? 0 : 90, 0), At, FVector(Run / N / 100.0, 1.0, Height / 100.0)), ENYCElement::Fitout, Level, 0.f,
							Finishes[R.RandRange(0, UE_ARRAY_COUNT(Finishes) - 1)]);
					}
				}
			}
			if (Level > 0)
			{
				// a core and a few partitions, desks and shelves so that opened floors look lived in
				const FVector2D Mid((Min.X + Max.X) * 0.5, (Min.Y + Max.Y) * 0.5);
				const double CoreW = FMath::Min(W * 0.34, 900.0), CoreD = FMath::Min(D * 0.34, 900.0);
				Add(TEXT("skel_partition"), FTransform(FRotator::ZeroRotator, FVector(Mid.X - CoreW / 2, Mid.Y - CoreD / 2, Z + 4), FVector(CoreW / 100, 1.5, (Top - Z - 25) / 100)), ENYCElement::Fitout, Level, 0.f);
				Add(TEXT("skel_partition"), FTransform(FRotator(0, 90, 0), FVector(Mid.X + CoreW / 2, Mid.Y - CoreD / 2, Z + 4), FVector(CoreD / 100, 1.5, (Top - Z - 25) / 100)), ENYCElement::Fitout, Level, 0.f);
				const int32 Furn = FMath::Clamp((int32)(W * D / 900000.0), 2, 12);
				for (int32 k = 0; k < Furn; ++k)
				{
					const bool bWallSide = R.GetFraction() < 0.7f;
					FVector P(R.FRandRange(Min.X + 120, Max.X - 120), R.FRandRange(Min.Y + 120, Max.Y - 120), Z + 4);
					if (bWallSide)
					{
						const int32 Side = R.RandRange(0, 3);
						if (Side == 0) P.X = Min.X + 110; else if (Side == 1) P.X = Max.X - 110; else if (Side == 2) P.Y = Min.Y + 110; else P.Y = Max.Y - 110;
					}
					Add(R.GetFraction() < 0.65f ? TEXT("skel_desk") : TEXT("skel_shelf"), FTransform(FRotator(0, R.RandRange(0, 3) * 90.0, 0), P), ENYCElement::Fitout, Level, 0.f);
				}
			}
		}
	}
}

FNYCBuildingState& ANYCDestruction::Activate(int32 Index)
{
	const FNYCSlowStep Slow_(TEXT("Activate"));
	FNYCBuildingState& S = States[Index];
	if (S.bActive) return S;
	const FNYCBuildingInfo& B = Buildings[Index];
	S.bActive = true;
	Stats.Buildings++;
	S.FloorH = FMath::Clamp(B.FloorH, 300.f, 900.f);
	S.NumFloors = FMath::Clamp(FMath::CeilToInt32(B.Height / S.FloorH), 1, 140);

	for (const FIntPoint& Ref : B.Refs)
	{
		UInstancedStaticMeshComponent* C = City->LayoutGroups.IsValidIndex(Ref.X) ? City->LayoutGroups[Ref.X] : nullptr;
		if (!C || !C->GetStaticMesh()) continue;
		const TPair<UInstancedStaticMeshComponent*, int32> Key(C, Ref.Y);
		if (Hidden.Contains(Key)) continue;
		FNYCElement E;
		if (!C->GetInstanceTransform(Ref.Y, E.Xf, true)) continue;
		E.Comp = C;
		E.Index = Ref.Y;
		E.Box = C->GetStaticMesh()->GetBoundingBox().TransformBy(E.Xf);
		const bool bModule = ModuleInfo.Contains(C->GetStaticMesh()->GetName());
		E.Type = bModule ? ENYCElement::Module : ENYCElement::RoofProp;
		E.Floor = FMath::Clamp(FMath::FloorToInt32((E.Box.Min.Z + 60.0) / S.FloorH), 0, S.NumFloors - 1);
		E.Support = bModule ? (B.bMasonry ? FMath::Min(E.Box.GetSize().GetMax() / 300.0, 2.0) : 0.08f) : 0.f;
		S.Elements.Add(E);
	}
	BuildShellChunks(Index, S);
	BuildSkeleton(Index, S);

	S.ByFloor.SetNum(S.NumFloors);
	S.Support0.Init(0.f, S.NumFloors);
	S.Centre0.Init(FVector2D::ZeroVector, S.NumFloors);
	for (int32 e = 0; e < S.Elements.Num(); ++e)
	{
		const FNYCElement& E = S.Elements[e];
		S.ByFloor[E.Floor].Add(e);
		S.Support0[E.Floor] += E.Support;
		const FVector C = E.Box.GetCenter();
		S.Centre0[E.Floor] += FVector2D(C.X, C.Y) * E.Support;
	}
	for (int32 f = 0; f < S.NumFloors; ++f)
	{
		if (S.Support0[f] > 0) S.Centre0[f] /= S.Support0[f];
	}
	S.Support = S.Support0;
	SetBuildingCollider(Index);
	return S;
}

// ------------------------------------------------------------------ breaking elements
void ANYCDestruction::HideElement(FNYCBuildingState& S, FNYCElement& E)
{
	E.bAlive = false;
	if (E.Type == ENYCElement::Chunk)
	{
		if (UProceduralMeshComponent* PM = S.ShellMesh.Get())
		{
			for (int32 Section : S.Chunks[E.Chunk].Sections) PM->SetMeshSectionVisible(Section, false);
		}
	}
	else if (E.Comp.IsValid())
	{
		HideInstance(E.Comp.Get(), E.Index);
	}
}

const TArray<FNYCPiece>& ANYCDestruction::ModulePieces(UStaticMesh* Mesh, const TArray<UMaterialInterface*>& Mats, int32 LOD, int32 Variant)
{
	const FString Name = Mesh->GetName();
	const FString Key = FString::Printf(TEXT("%s_%d_%d"), *Name, LOD, Variant);
	if (const TArray<FNYCPiece>* Found = PieceCache.Find(Key)) return *Found;
	TArray<FNYCPiece> Out;
	const FNYCSoup& Source = Soup(Mesh);
	FString Plain = Name;
	Plain.RemoveFromEnd(TEXT("_broken"));
	const TPair<FVector2D, TArray<FVector4f>>* Info = ModuleInfo.Find(Plain);
	const FVector2f Size = Info ? FVector2f(Info->Key) : FVector2f(Source.Bounds().Max.X, Source.Bounds().Max.Z);
	const float Depth = ModuleDepth.FindRef(Plain);

	// sort triangles by what they are made of
	TArray<int32> Wall, Glass, Frame;
	TArray<uint8> SlotClass;
	const TArray<FStaticMaterial>& Slots = Mesh->GetStaticMaterials();
	for (const FStaticMaterial& SM : Slots)
	{
		const FString Slot = SM.MaterialSlotName.ToString().ToLower();
		uint8 Class = 0;
		if (Slot.Contains(TEXT("glass")) && !Slot.Contains(TEXT("spg"))) Class = 1;
		else if (Slot.Contains(TEXT("frame")) || Slot.Contains(TEXT("mullion"))) Class = 2;
		SlotClass.Add(Class);
	}
	float GlassArea = 0.f;
	for (int32 t = 0; t < Source.NumTris(); ++t)
	{
		const uint8 Class = SlotClass.IsValidIndex(Source.Mat[t]) ? SlotClass[Source.Mat[t]] : 0;
		if (LOD >= 1 && Source.UV1[Source.Tris[t].X].Y < -0.5f) continue;
		(Class == 1 ? Glass : Class == 2 ? Frame : Wall).Add(t);
		if (Class == 1)
		{
			const FIntVector& T = Source.Tris[t];
			GlassArea += 0.5f * FVector3f::CrossProduct(Source.Pos[T.Y] - Source.Pos[T.X], Source.Pos[T.Z] - Source.Pos[T.X]).Size();
		}
	}
	const bool bCurtain = GlassArea > 0.45f * Size.X * Size.Y;
	const float Thick = bCurtain ? 9.f : FMath::Max(34.f, Depth + 12.f);
	const float BackStart = bCurtain ? -2.f : -FMath::Min(Depth + 1.f, Thick - 4.f);     // distant pieces only
	FRandomStream R(GetTypeHash(Key));
	TArray<FVector4f> Openings = Info ? Info->Value : TArray<FVector4f>();

	// ---- masonry (or spandrel) chunks, each with a solid backing
	if (LOD >= 2)
	{
		// one solid bay: the wall in its main finish round the openings, a pane set back in each
		auto Dominant = [&](const TArray<int32>& List)
		{
			TMap<int32, float> Area;
			for (const int32 t : List)
			{
				const FIntVector& T = Source.Tris[t];
				Area.FindOrAdd(Source.Mat[t]) += FVector3f::CrossProduct(Source.Pos[T.Y] - Source.Pos[T.X], Source.Pos[T.Z] - Source.Pos[T.X]).Size();
			}
			int32 Best = INDEX_NONE;
			float Most = 0.f;
			for (const TPair<int32, float>& Pair : Area)
				if (Pair.Value > Most) { Most = Pair.Value; Best = Pair.Key; }
			return Best;
		};
		const int32 WallSlot = Dominant(Wall), FrameSlot = Dominant(Frame), PaneSlot = Dominant(Glass);
		const int32 Face = WallSlot != INDEX_NONE ? WallSlot : FrameSlot != INDEX_NONE ? FrameSlot : -1;
		FNYCPiece P;
		const TArray<FVector2f> Whole = { FVector2f(0, 0), FVector2f(Size.X, 0), FVector2f(Size.X, Size.Y), FVector2f(0, Size.Y) };
		NYCFracture::AddPrismXZ(P.Geo, Whole, 0.f, -Thick, bCurtain && PaneSlot != INDEX_NONE ? PaneSlot : Face, -2, -1, true);
		if (!bCurtain && PaneSlot != INDEX_NONE)
		{
			for (int32 i = 0; i < FMath::Min(Openings.Num(), 6); ++i)
			{
				const FVector4f& O = Openings[i];
				P.Geo.AddQuad(FVector3f(O.X, 0.8f, O.Z), FVector3f(O.X, 0.8f, O.W), FVector3f(O.Y, 0.8f, O.W), FVector3f(O.Y, 0.8f, O.Z), PaneSlot);
			}
		}
		P.Stuff = bCurtain ? ENYCStuff::Glass : ENYCStuff::Masonry;
		if (!P.Geo.IsEmpty()) Out.Add(MoveTemp(P));
		return PieceCache.Add(Key, MoveTemp(Out));
	}
	const float Chunk = LOD == 0 ? 95.f : 175.f;
	TArray<TArray<FVector2f>> Cells;
	NYCFracture::Voronoi2D(FVector2f(-4.f, -4.f), Size + FVector2f(4.f, 4.f), FMath::Max(2, FMath::RoundToInt32(Size.X / Chunk)), FMath::Max(2, FMath::RoundToInt32(Size.Y / Chunk)), R, Cells);
	if (Wall.Num() > 0)
	{
		for (const TArray<FVector2f>& Cell : Cells)
		{
			TArray<TArray<FVector2f>> Regions;
			Regions.Add(Cell);
			for (const FVector4f& O : Openings)
			{
				TArray<TArray<FVector2f>> Next;
				for (const TArray<FVector2f>& Poly : Regions) NYCFracture::SubtractRect(Poly, FVector2f(O.X, O.Z), FVector2f(O.Y, O.W), Next);
				Regions = MoveTemp(Next);
			}
			for (const TArray<FVector2f>& Poly : Regions)
			{
				FNYCPiece P;
				if (bCurtain) NYCFracture::ClipToPrism(Source, Wall, Poly, 0, 2, P.Geo);
				else
				{
					// edges that are a window's own edges, or the edge of the bay, stay straight
					auto Pinned = [&](const FVector2f& Q)
					{
						if (Q.X < 1.f || Q.Y < 1.f || Q.X > Size.X - 1.f || Q.Y > Size.Y - 1.f) return true;
						for (const FVector4f& O : Openings)
						{
							if (Q.X > O.X - 1.5f && Q.X < O.Y + 1.5f && Q.Y > O.Z - 1.5f && Q.Y < O.W + 1.5f) return true;
						}
						return false;
					};
					TArray<FVector2f> Crooked;
					NYCFracture::JagOutline(Poly, LOD == 0 ? 19.f : 44.f, LOD == 0 ? 4.2f : 6.5f, Pinned, Crooked);
					NYCFracture::ClipToOutline(Source, Wall, Crooked, 0, 2, P.Geo);
					// the wall's body starts just behind its face, and stays clear of reveals round the openings
					float Face = 0.f;
					for (const FVector3f& Q : P.Geo.Pos)
					{
						bool bReveal = false;
						for (const FVector4f& O : Openings)
						{
							bReveal |= Q.X > O.X - 2.5f && Q.X < O.Y + 2.5f && Q.Z > O.Z - 2.5f && Q.Z < O.W + 2.5f;
						}
						if (!bReveal) Face = FMath::Min(Face, Q.Y);
					}
					const float Front = FMath::Max(Face - 1.3f, -Thick + 9.f);
					TArray<TArray<FVector2f>> Backings;
					Backings.Add(Poly);
					bool bAtOpening = false;
					for (const FVector4f& O : Openings)
					{
						TArray<TArray<FVector2f>> Next;
						for (const TArray<FVector2f>& Part : Backings) NYCFracture::SubtractRect(Part, FVector2f(O.X - 2.2f, O.Z - 2.2f), FVector2f(O.Y + 2.2f, O.W + 2.2f), Next);
						bAtOpening |= Next.Num() != Backings.Num() || (Next.Num() > 0 && Next[0] != Backings[0]);
						Backings = MoveTemp(Next);
					}
					const float Back = -Thick + R.FRandRange(-7.f, 7.f);
					if (!bAtOpening) NYCFracture::AddRoughSlab(P.Geo, Crooked, Front, Back, 1, 0, 2, -2, -1, false, 0, LOD == 0 ? 3.2f : 4.5f);
					else for (const TArray<FVector2f>& Body : Backings) NYCFracture::AddRoughSlab(P.Geo, Body, Front, Back, 1, 0, 2, -2, -1, false, 0, LOD == 0 ? 1.1f : 1.5f);
				}
				if (P.Geo.IsEmpty()) continue;
				P.Stuff = ENYCStuff::Masonry;
				for (const FVector2f& Q : Poly) P.bRim |= Q.X < 6.f || Q.Y < 6.f || Q.X > Size.X - 6.f || Q.Y > Size.Y - 6.f;
				Out.Add(MoveTemp(P));
			}
		}
	}
	// ---- window frames and mullions snap into short bars
	if (Frame.Num() > 0)
	{
		// bar by bar: a fragment holding two crossing bars would collide as the whole panel between them,
		// and sticks would stand on end propping things up
		TMap<FIntVector, int32> Weld;
		TArray<int32> Parent;
		auto Find = [&Parent](int32 i) { while (Parent[i] != i) { Parent[i] = Parent[Parent[i]]; i = Parent[i]; } return i; };
		TArray<FIntVector> Corner;
		for (const int32 t : Frame)
		{
			const FIntVector& T = Source.Tris[t];
			int32 Ids[3];
			const int32 V[3] = { T.X, T.Y, T.Z };
			for (int32 k = 0; k < 3; ++k)
			{
				const FVector3f& Q = Source.Pos[V[k]];
				const FIntVector At(FMath::RoundToInt32(Q.X * 2.f), FMath::RoundToInt32(Q.Y * 2.f), FMath::RoundToInt32(Q.Z * 2.f));
				if (const int32* Found = Weld.Find(At)) Ids[k] = *Found;
				else { Ids[k] = Parent.Num(); Parent.Add(Ids[k]); Weld.Add(At, Ids[k]); }
			}
			Parent[Find(Ids[1])] = Find(Ids[0]);
			Parent[Find(Ids[2])] = Find(Ids[0]);
			Corner.Add(FIntVector(Ids[0], Ids[1], Ids[2]));
		}
		TMap<int32, TArray<int32>> Bars;
		for (int32 i = 0; i < Frame.Num(); ++i) Bars.FindOrAdd(Find(Corner[i].X)).Add(Frame[i]);
		const float Bar = LOD == 0 ? 75.f : 160.f;
		for (const TPair<int32, TArray<int32>>& One : Bars)
		{
			FBox2f Ext(ForceInit);
			for (const int32 t : One.Value)
			{
				const FIntVector& T = Source.Tris[t];
				for (const int32 v : { T.X, T.Y, T.Z }) Ext += FVector2f(Source.Pos[v].X, Source.Pos[v].Z);
			}
			const bool bTall = Ext.GetSize().Y > Ext.GetSize().X;
			const int32 Parts_ = FMath::Max(1, FMath::CeilToInt32((bTall ? Ext.GetSize().Y : Ext.GetSize().X) / Bar));
			for (int32 i = 0; i < Parts_; ++i)
			{
				FVector2f A = Ext.Min - FVector2f(1.f, 1.f), C = Ext.Max + FVector2f(1.f, 1.f);
				if (Parts_ > 1)
				{
					const int32 Along = bTall ? 1 : 0;
					const float Length_ = Ext.Max[Along] - Ext.Min[Along];
					if (i > 0) A[Along] = Ext.Min[Along] + Length_ * i / Parts_;
					if (i + 1 < Parts_) C[Along] = Ext.Min[Along] + Length_ * (i + 1) / Parts_;
				}
				FNYCPiece P;
				NYCFracture::ClipToPrism(Source, One.Value, { A, FVector2f(C.X, A.Y), C, FVector2f(A.X, C.Y) }, 0, 2, P.Geo);
				if (P.Geo.IsEmpty()) continue;
				P.Stuff = ENYCStuff::Metal;
				Out.Add(MoveTemp(P));
			}
		}
	}
	// ---- glass breaks into shards that radiate from a point of impact
	if (Glass.Num() > 0)
	{
		FBox2f GBox(ForceInit);
		for (int32 t : Glass)
		{
			const FIntVector& T = Source.Tris[t];
			GBox += FVector2f(Source.Pos[T.X].X, Source.Pos[T.X].Z);
			GBox += FVector2f(Source.Pos[T.Y].X, Source.Pos[T.Y].Z);
			GBox += FVector2f(Source.Pos[T.Z].X, Source.Pos[T.Z].Z);
		}
		TArray<FVector4f> Panes = Openings;
		if (Panes.Num() == 0) Panes.Add(FVector4f(GBox.Min.X, GBox.Max.X, GBox.Min.Y, GBox.Max.Y));
		for (const FVector4f& O : Panes)
		{
			TArray<TArray<FVector2f>> Shards;
			const FVector2f Min(O.X, O.Z), Max(O.Y, O.W);
			const float Shard = LOD == 0 ? 42.f : 110.f;
			NYCFracture::Voronoi2D(Min, Max, FMath::Clamp(FMath::RoundToInt32((Max.X - Min.X) / Shard), 1, 5), FMath::Clamp(FMath::RoundToInt32((Max.Y - Min.Y) / Shard), 1, 6), R, Shards, 1.4f);
			for (const TArray<FVector2f>& Poly : Shards)
			{
				// split each cell into slivers about its centre so the pieces read as glass, not tiles
				FVector2f Mid(0, 0);
				for (const FVector2f& Q : Poly) Mid += Q / Poly.Num();
				const int32 Slivers = LOD == 0 ? 2 : 1;
				for (int32 s = 0; s < Slivers; ++s)
				{
					TArray<FVector2f> Tri = Poly;
					if (Slivers > 1)
					{
						const int32 Half = Poly.Num() / 2;
						Tri.Reset();
						Tri.Add(Mid);
						for (int32 q = 0; q <= (s == 0 ? Half : Poly.Num() - Half); ++q) Tri.Add(Poly[((s == 0 ? 0 : Half) + q) % Poly.Num()]);
					}
					FNYCPiece P;
					NYCFracture::ClipToPrism(Source, Glass, Tri, 0, 2, P.Geo);
					if (P.Geo.IsEmpty()) continue;
					// a shard needs thickness to collide
					NYCFracture::Thicken(P.Geo, 1.6f, P.Geo.Mat[0]);
					P.Stuff = ENYCStuff::Glass;
					Out.Add(MoveTemp(P));
				}
			}
		}
	}
	return PieceCache.Add(Key, MoveTemp(Out));
}

void ANYCDestruction::BreakElement(int32 Building, int32 ElementIndex, FNYCBatch& Batch, int32 Group, int32 LOD, const FVector& Velocity, bool bCrumble)
{
	FNYCBuildingState& S = States[Building];
	FNYCElement& E = S.Elements[ElementIndex];
	if (!E.bAlive) return;
	const FNYCBuildingInfo& B = Buildings[Building];
	if (IsLive() && Clock < CoarseUntil) LOD = 2;
	HideElement(S, E);
	S.Support[E.Floor] -= E.Support;
	Stats.Elements++;

	// what a break exposes: the wall's own core on the broken faces, plaster on the room side
	UMaterialInterface* Core = DebrisMaterial(CityMaterial(B.bMasonry ? TEXT("core_brick") : TEXT("core_concrete")));
	UMaterialInterface* Plaster = DebrisMaterial(CityMaterial(TEXT("core_plaster")));
	UMaterialInterface* Concrete = DebrisMaterial(CityMaterial(TEXT("concrete")));
	UMaterialInterface* RawConcrete = DebrisMaterial(CityMaterial(TEXT("core_concrete")));
	const int32 InteriorSlot = Batch.MaterialSlot(Plaster);
	const int32 SideSlot = Batch.MaterialSlot(Core);
	Batch.Density = B.bMasonry ? 1950.f : 2350.f;
	auto Emit = [&](FNYCPiece&& P)
	{
		P.Group = Group;
		Batch.Pieces.Add(MoveTemp(P));
		Stats.Pieces++;
	};

	if (E.Type == ENYCElement::Module && E.Comp.IsValid())
	{
		UInstancedStaticMeshComponent* C = E.Comp.Get();
		UStaticMesh* Mesh = C->GetStaticMesh();
		TArray<UMaterialInterface*> Mats;
		TArray<int32> Slot;
		for (int32 m = 0; m < Mesh->GetStaticMaterials().Num(); ++m)
		{
			Mats.Add(C->GetMaterial(m));
			Slot.Add(Batch.MaterialSlot(DebrisMaterial(Mats[m])));
		}
		const TArray<FNYCPiece>& Parts = ModulePieces(Mesh, Mats, LOD, (E.Index * 7 + E.Floor) % 3);
		const FTransform3f Xf(E.Xf);
		for (const FNYCPiece& Source : Parts)
		{
			if (E.bGlassBroken && Source.Stuff == ENYCStuff::Glass) continue;
			FNYCPiece P = Source;
			for (int32& M : P.Geo.Mat) M = M == -1 ? InteriorSlot : M == -2 ? SideSlot : (Slot.IsValidIndex(M) ? Slot[M] : InteriorSlot);
			P.Geo.Transform(Xf);
			Emit(MoveTemp(P));
		}
	}
	else if (E.Type == ENYCElement::Chunk)
	{
		// sort the faces by the way they look: a corner piece holds two walls and perhaps a bit of roof
		FNYCSoup Plane[3];
		float Area[3] = { 0.f, 0.f, 0.f };
		for (const TPair<int32, FNYCSoup>& Part : S.Chunks[E.Chunk].Parts)
		{
			const FNYCSoup& G = Part.Value;
			const int32 M = Batch.MaterialSlot(DebrisMaterial(S.ShellMats[Part.Key]));
			for (const FIntVector& T : G.Tris)
			{
				const FVector3f Cross = FVector3f::CrossProduct(G.Pos[T.Y] - G.Pos[T.X], G.Pos[T.Z] - G.Pos[T.X]);
				const FVector3f N = (G.Nrm[T.X] + G.Nrm[T.Y] + G.Nrm[T.Z]).GetAbs();
				const int32 Axis = N.Z > N.X && N.Z > N.Y ? 2 : N.X >= N.Y ? 0 : 1;
				FNYCSoup& To = Plane[Axis];
				if (LOD >= 1 && G.UV1[T.X].Y < -0.5f) continue;
				const int32 Base = To.Pos.Num();
				for (const int32 v : { T.X, T.Y, T.Z }) To.AddVertex(G.Pos[v], G.Nrm[v], G.UV0[v], G.UV1[v], G.Col[v]);
				To.AddTri(Base, Base + 1, Base + 2, M);
				Area[Axis] += Cross.Size() * 0.5f;
			}
		}
		if (LOD >= 2)
		{
			for (int32 Axis = 0; Axis < 3; ++Axis)
			{
				FNYCSoup& From = Plane[Axis];
				if (From.IsEmpty()) continue;
				TMap<int32, float> ByMaterial;
				float Facing = 0.f, Depth_ = 0.f, Sum = 0.f;
				for (int32 t = 0; t < From.NumTris(); ++t)
				{
					const FIntVector& T = From.Tris[t];
					const float A = FVector3f::CrossProduct(From.Pos[T.Y] - From.Pos[T.X], From.Pos[T.Z] - From.Pos[T.X]).Size();
					ByMaterial.FindOrAdd(From.Mat[t]) += A;
					Facing += From.Nrm[T.X][Axis] * A;
					Depth_ += From.Pos[T.X][Axis] * A;
					Sum += A;
				}
				int32 Finish = 0;
				float Most = -1.f;
				for (const TPair<int32, float>& Pair : ByMaterial)
					if (Pair.Value > Most) { Most = Pair.Value; Finish = Pair.Key; }
				const FBox3f Box = From.Bounds();
				const int32 U = Axis == 0 ? 1 : 0, W = Axis == 2 ? 1 : 2;
				const float At = Sum > 0.f ? Depth_ / Sum : Box.GetCenter()[Axis];
				const float Sign = Facing >= 0.f ? 1.f : -1.f;
				auto Corner = [&](float Cu, float Cw) { FVector3f Q; Q[U] = Cu; Q[W] = Cw; Q[Axis] = At; return Q; };
				FVector3f C0 = Corner(Box.Min[U], Box.Min[W]), C1 = Corner(Box.Max[U], Box.Min[W]), C2 = Corner(Box.Max[U], Box.Max[W]), C3 = Corner(Box.Min[U], Box.Max[W]);
				FVector3f Want(0, 0, 0);
				Want[Axis] = Sign;
				if (FVector3f::DotProduct(FVector3f::CrossProduct(C1 - C0, C3 - C0), Want) < 0.f) { Swap(C1, C3); }
				FNYCSoup Sheet;
				Sheet.AddQuad(C0, C1, C2, C3, Finish);
				From = MoveTemp(Sheet);
			}
		}
		const int32 Main = Area[0] >= Area[1] && Area[0] >= Area[2] ? 0 : Area[1] >= Area[2] ? 1 : 2;
		const float Depth = B.bMasonry ? 38.f : 24.f;
		FRandomStream R(Building * 131 + ElementIndex * 7);
		for (int32 Axis = 0; Axis < 3; ++Axis)
		{
			// slivers of ledge and sill ride along with the biggest wall rather than becoming slabs of their own
			if (Axis == Main || Plane[Axis].IsEmpty() || Area[Axis] > Area[Main] * 0.22f) continue;
			Plane[Main].Append(Plane[Axis]);
			Plane[Axis] = FNYCSoup();
		}
		for (int32 Axis = 0; Axis < 3; ++Axis)
		{
			const FNYCSoup& From = Plane[Axis];
			if (From.IsEmpty()) continue;
			const int32 U = Axis == 0 ? 1 : 0, W = Axis == 2 ? 1 : 2;
			const FBox3f Box = From.Bounds();
			const FVector2f Min(Box.Min[U], Box.Min[W]), Max(Box.Max[U], Box.Max[W]);
			const float Cell = LOD == 0 ? 175.f : 300.f;
			const int32 NX = LOD >= 2 ? 1 : FMath::Clamp(FMath::RoundToInt32((Max.X - Min.X) / Cell), 1, 3);
			const int32 NY = LOD >= 2 ? 1 : FMath::Clamp(FMath::RoundToInt32((Max.Y - Min.Y) / Cell), 1, 3);
			TArray<int32> All;
			for (int32 t = 0; t < From.NumTris(); ++t) All.Add(t);
			TArray<TArray<FVector2f>> Cells;
			if (NX * NY > 1) NYCFracture::Voronoi2D(Min - FVector2f(3.f, 3.f), Max + FVector2f(3.f, 3.f), NX, NY, R, Cells);
			const int32 Count = NX * NY > 1 ? Cells.Num() : 1;
			for (int32 c = 0; c < Count; ++c)
			{
				FNYCPiece P;
				if (NX * NY > 1)
				{
					TArray<FVector2f> Crooked;
					NYCFracture::JagOutline(Cells[c], 30.f, 8.5f, [](const FVector2f&) { return false; }, Crooked);
					NYCFracture::ClipToOutline(From, All, Crooked, U, W, P.Geo);
				}
				else P.Geo = From;
				if (P.Geo.IsEmpty()) continue;
				NYCFracture::ThickenSolid(P.Geo, Depth, InteriorSlot, SideSlot, LOD == 0 ? 4.f : LOD == 1 ? 5.5f : 0.f);
				if (!B.bMasonry && LOD == 0 && R.GetFraction() < 0.5f)
				{
					const int32 Rust = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("rust"))));
					const FBox3f Got = P.Geo.Bounds();
					for (int32 k = 0; k < 3; ++k)
					{
						FVector3f At = Got.GetCenter(), Way(0, 0, 0);
						const int32 Side = R.RandRange(0, 1) ? U : W;
						const float Sign = R.RandRange(0, 1) ? 1.f : -1.f;
						const int32 Other = Side == U ? W : U;
						At[Side] = Sign > 0 ? Got.Max[Side] - 3.f : Got.Min[Side] + 3.f;
						At[Other] = FMath::Lerp(Got.Min[Other], Got.Max[Other], R.FRandRange(0.3f, 0.7f));
						Way[Side] = Sign;
						NYCFracture::AddRebarStub(P.Geo, At, Way, R.FRandRange(8.f, 15.f), Rust, R);
					}
				}
				P.Stuff = ENYCStuff::Concrete;
				Emit(MoveTemp(P));
			}
		}
	}
	else if (E.Type == ENYCElement::Slab)
	{
		const FVector3f Min(E.Box.Min), Max(E.Box.Max);
		const int32 Concr = Batch.MaterialSlot(Concrete);
		TArray<TArray<FVector2f>> Cells;
		FRandomStream R(Building * 977 + ElementIndex);
		const int32 Split = LOD == 0 ? 3 : LOD == 1 ? 2 : 1;
		NYCFracture::Voronoi2D(FVector2f(Min.X, Min.Y), FVector2f(Max.X, Max.Y), Split, Split, R, Cells, Split > 1 ? 0.8f : 0.f);
		const int32 Broke = Batch.MaterialSlot(RawConcrete);
		const int32 Rust = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("rust"))));
		const float Bottom = FMath::Min(Min.Z, Max.Z - 24.f);
		for (const TArray<FVector2f>& Cell : Cells)
		{
			FNYCPiece P;
			if (LOD >= 2)
			{
				NYCFracture::AddPrismXY(P.Geo, Cell, Bottom, Max.Z, Concr, Broke, InteriorSlot);
				P.Stuff = ENYCStuff::Concrete;
				Emit(MoveTemp(P));
				continue;
			}
			TArray<FVector2f> Crooked;
			NYCFracture::JagOutline(Cell, LOD == 0 ? 34.f : 70.f, LOD == 0 ? 7.f : 9.f, [](const FVector2f&) { return false; }, Crooked);
			NYCFracture::AddRoughSlab(P.Geo, Crooked, Max.Z, Bottom, 2, 0, 1, Broke, InteriorSlot, true, Concr, LOD == 0 ? 3.6f : 4.5f);
			if (LOD <= 1)
			{
				FVector2f Mid(0, 0);
				for (const FVector2f& Q : Crooked) Mid += Q / Crooked.Num();
				for (int32 q = 0; q < Crooked.Num(); ++q)
				{
					if (R.GetFraction() > (LOD == 0 ? 0.16f : 0.1f)) continue;
					const FVector2f Way = (Crooked[q] - Mid).GetSafeNormal();
					NYCFracture::AddRebarStub(P.Geo, FVector3f(Crooked[q].X, Crooked[q].Y, FMath::Lerp(Bottom, Max.Z, R.FRandRange(0.25f, 0.75f))), FVector3f(Way.X, Way.Y, 0.f), R.FRandRange(8.f, 17.f), Rust, R);
				}
			}
			P.Stuff = ENYCStuff::Concrete;
			Emit(MoveTemp(P));
		}
	}
	else if (E.Type == ENYCElement::Column || E.Type == ENYCElement::Beam)
	{
		const int32 Steel = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("rust"))));
		const bool bColumn = E.Type == ENYCElement::Column;
		const FVector C = E.Box.GetCenter();
		const FVector A = bColumn ? FVector(C.X, C.Y, E.Box.Min.Z) : FVector(E.Box.Min.X, C.Y, C.Z);
		const FVector Z = bColumn ? FVector(C.X, C.Y, E.Box.Max.Z) : FVector(E.Box.Max.X, C.Y, C.Z);
		const int32 Parts = LOD == 0 ? 2 : 1;
		for (int32 i = 0; i < Parts; ++i)
		{
			FNYCPiece P;
			if (LOD >= 2) NYCFracture::AddBox(P.Geo, FVector3f(E.Box.Min), FVector3f(E.Box.Max), Steel);
			else NYCFracture::AddIBeam(P.Geo, FVector3f(FMath::Lerp(A, Z, (double)i / Parts)), FVector3f(FMath::Lerp(A, Z, (double)(i + 1) / Parts)), bColumn ? 30.f : 17.f, bColumn ? 30.f : 36.f, Steel);
			P.Stuff = ENYCStuff::Steel;
			Emit(MoveTemp(P));
		}
	}
	else if (E.Comp.IsValid())
	{
		// roof equipment, fire escapes, awnings and furniture: whole, or cut into a few lumps
		UInstancedStaticMeshComponent* C = E.Comp.Get();
		UStaticMesh* Mesh = C->GetStaticMesh();
		if (LOD >= 2)
		{
			// far off, plant and furniture are just lumps
			if (E.Type != ENYCElement::Fitout && Mesh->GetStaticMaterials().Num() > 0)
			{
				FNYCPiece P;
				const FVector Mid = E.Box.GetCenter(), Half = E.Box.GetExtent() * 0.72;
				NYCFracture::AddBox(P.Geo, FVector3f(Mid - Half), FVector3f(Mid + Half), Batch.MaterialSlot(DebrisMaterial(C->GetMaterial(0))));
				P.Stuff = ENYCStuff::Metal;
				Emit(MoveTemp(P));
			}
			return;
		}
		FNYCSoup G = Soup(Mesh);
		if (!G.IsEmpty())
		{
			TArray<int32> Slot;
			for (int32 m = 0; m < Mesh->GetStaticMaterials().Num(); ++m) Slot.Add(Batch.MaterialSlot(DebrisMaterial(C->GetMaterial(m))));
			for (int32& M : G.Mat) M = Slot.IsValidIndex(M) ? Slot[M] : InteriorSlot;
			G.Transform(FTransform3f(E.Xf));
			const FBox3f Box = G.Bounds();
			const FVector3f Sz = Box.GetSize();
			const int32 Cut = (LOD == 0 && Sz.GetMax() > 220.f && E.Type == ENYCElement::RoofProp) ? 3 : 1;
			const int32 Axis = Sz.X >= Sz.Y && Sz.X >= Sz.Z ? 0 : Sz.Y >= Sz.Z ? 1 : 2;
			for (int32 i = 0; i < Cut; ++i)
			{
				FNYCPiece P;
				if (Cut == 1) P.Geo = G;
				else
				{
					FBox3f Slice = Box;
					Slice.Min[Axis] = Box.Min[Axis] + Sz[Axis] * i / Cut;
					Slice.Max[Axis] = Box.Min[Axis] + Sz[Axis] * (i + 1) / Cut;
					for (int32 t = 0; t < G.NumTris(); ++t) NYCFracture::ClipTriangleToBox(G, t, Slice, P.Geo, G.Mat[t]);
				}
				if (P.Geo.IsEmpty()) continue;
				P.Stuff = E.Type == ENYCElement::Fitout ? ENYCStuff::Wood : ENYCStuff::Metal;
				Emit(MoveTemp(P));
			}
		}
	}
}

// ------------------------------------------------------------------ geometry collections
int32 ANYCDestruction::SpawnBatch(FNYCBatch& Batch, const FVector& BlastCentre, float BlastSpeed, float BlastRadius, float HoldFor)
{
	// slivers with no thickness would get no collision shape
	Batch.Pieces.RemoveAll([](const FNYCPiece& P)
	{
		if (P.Geo.IsEmpty() || P.Geo.Pos.Num() < 4) return true;
		const FVector3f Size = P.Geo.Bounds().GetSize();
		return Size.GetMin() < 0.35f || Size.GetMax() < 2.f;
	});
	if (Batch.Pieces.Num() == 0) return INDEX_NONE;
	if (!Batch.bHeld)
	{
		FNYCBatch Stays;
		Stays.bHeld = true;
		Stays.Building = Batch.Building;
		Stays.Materials = Batch.Materials;
		Stays.Density = Batch.Density;
		Stays.Tint = Batch.Tint;
		Stays.Override = Batch.Override;
		const int32 Group = Stays.NewGroup(FVector::ZeroVector, false);
		for (int32 i = Batch.Pieces.Num() - 1; i >= 0; --i)
		{
			if (!Batch.Pieces[i].bAnchored) continue;
			Batch.Pieces[i].Group = Group;
			Stays.Pieces.Add(MoveTemp(Batch.Pieces[i]));
			Batch.Pieces.RemoveAt(i);
		}
		if (Stays.Pieces.Num() > 0)
		{
			UE_LOG(LogNYC, Display, TEXT("%d pieces stay anchored round the hole"), Stays.Pieces.Num());
			SpawnBatch(Stays, BlastCentre, 0.f, BlastRadius, 0.f);
		}
		if (Batch.Pieces.Num() == 0) return INDEX_NONE;
	}
	if (IsLive() && !Batch.bHeld && !bDrainingQueue)
	{
		FuseBatch(Batch, 170);
		if (Batch.Pieces.Num() > 48 || PendingBatches.Num() > 0)
		{
			PendingBatches.Add({ MoveTemp(Batch), BlastCentre, BlastSpeed, BlastRadius, HoldFor });
			return INDEX_NONE;
		}
	}
	FBox All(ForceInit);
	for (const FNYCPiece& P : Batch.Pieces)
	{
		const FBox3f B = P.Geo.Bounds();
		All += FBox(FVector(B.Min), FVector(B.Max));
	}
	const FVector Origin(FMath::RoundToDouble(All.GetCenter().X), FMath::RoundToDouble(All.GetCenter().Y), FMath::RoundToDouble(All.GetCenter().Z));
	const FTransform3f ToLocal(FVector3f(-Origin));
	for (FNYCPiece& P : Batch.Pieces) P.Geo.Transform(ToLocal);

	TArray<int32> PieceXf, GroupXf;
	const int32 Id = NextDebrisId++;
	if (Batch.Override)
	{
		for (UMaterialInterface*& M : Batch.Materials) M = Batch.Override;
	}
	UGeometryCollection* Asset = NYCFracture::MakeCollection(this, *FString::Printf(TEXT("NYCDebrisAsset_%04d"), Id), Batch.Pieces, Batch.Materials, FVector::ZeroVector, Batch.Density, PieceXf, GroupXf);
	if (!Asset) return INDEX_NONE;
	KeepAlive.Add(Asset);

	UGeometryCollectionComponent* C = NewObject<UGeometryCollectionComponent>(this, *FString::Printf(TEXT("debris_%04d"), Id), RF_Transient);
	if (Debris.Num() > 90) C->bVisibleInRayTracing = false;
	C->SetupAttachment(RootComponent);
	C->SetWorldLocation(Origin);
	C->SetRestCollection(Asset);
	C->ObjectType = EObjectStateTypeEnum::Chaos_Object_Dynamic;
	C->SetCollisionProfileName(TEXT("PhysicsActor"));
	C->bAllowRemovalOnSleep = false;
	C->SetEnableDamageFromCollision(!Batch.bHeld);
	C->SetNotifyBreaks(false);
	const bool bPlayback = CacheMode == ENYCCacheMode::Playback;
	// set the flag, not SetSimulatePhysics: before registration that would create the proxy early and skip
	// the dynamic-state setup in OnCreatePhysicsState, leaving every piece frozen
	C->BodyInstance.bSimulatePhysics = !bPlayback;
	// fragments start out touching their neighbours: let them ease apart instead of exploding
	C->BodyInstance.SetMaxDepenetrationVelocity(60.f);
	C->BodyInstance.LinearDamping = 0.01f;
	C->BodyInstance.AngularDamping = 0.1f;
	C->RegisterComponent();
	Spawned.Add(C);
	C->SetCustomPrimitiveDataFloat(0, Batch.Tint.R);
	C->SetCustomPrimitiveDataFloat(1, Batch.Tint.G);
	C->SetCustomPrimitiveDataFloat(2, Batch.Tint.B);
	C->SetCustomPrimitiveDataFloat(4, Origin.X);
	C->SetCustomPrimitiveDataFloat(5, Origin.Y);
	C->SetCustomPrimitiveDataFloat(6, Origin.Z);

	FNYCDebris D;
	D.Comp = C;
	{
		TArray<FBox3f> GroupBox;
		GroupBox.Init(FBox3f(ForceInit), Batch.GroupVelocity.Num());
		for (const FNYCPiece& P : Batch.Pieces)
		{
			const FBox3f Ext = P.Geo.Bounds();
			D.PieceRadius.Add(Ext.GetExtent().Size());
			if (GroupBox.IsValidIndex(P.Group)) GroupBox[P.Group] += Ext;
		}
		for (const FBox3f& Ext : GroupBox) D.GroupRadius.Add(Ext.IsValid ? Ext.GetExtent().Size() : 0.f);
	}
	if (FX() && !Batch.Override && !Batch.bHeld) ShedGravel(Batch, Origin, Id);
	D.GroupXf = MoveTemp(GroupXf);
	D.PieceXf = MoveTemp(PieceXf);
	D.GroupVelocity = Batch.GroupVelocity;
	D.GroupSpin = Batch.GroupSpin;
	D.GroupCrumble = Batch.GroupCrumble;
	D.Box = All;
	D.Born = Clock;
	D.BlastCentre = BlastCentre;
	D.BlastSpeed = BlastSpeed;
	D.BlastRadius = BlastRadius;
	D.HoldFor = HoldFor;
	D.NumPieces = Batch.Pieces.Num();
	D.Building = Batch.Building;
	D.bHeld = Batch.bHeld;
	D.bAnchors = Batch.bHeld;
	// per piece group, so ServiceDebris can find a piece's velocity
	TArray<int32> PieceGroup;
	for (const FNYCPiece& P : Batch.Pieces) PieceGroup.Add(P.Group);
	D.PieceXf.SetNum(Batch.Pieces.Num());
	// pack (transform, group) pairs
	for (int32 i = 0; i < D.PieceXf.Num(); ++i) D.PieceXf[i] = D.PieceXf[i] < 0 ? -1 : (D.PieceXf[i] | (PieceGroup[i] << 16));
	RegisterForCache(C, FString::Printf(TEXT("debris_%04d"), Id), D.Cache);
	Stats.Collections++;
	return Debris.Add(MoveTemp(D));
}

/** The loose stuff every break throws off: stones and brick ends that fall, bounce and stay where they land. */
void ANYCDestruction::ShedGravel(const FNYCBatch& Batch, const FVector& Origin, int32 Seed)
{
	TArray<int32> Stony;
	for (int32 i = 0; i < Batch.Pieces.Num(); ++i)
	{
		const ENYCStuff Stuff = Batch.Pieces[i].Stuff;
		if (Stuff == ENYCStuff::Masonry || Stuff == ENYCStuff::Concrete || Stuff == ENYCStuff::Asphalt) Stony.Add(i);
	}
	if (Stony.Num() == 0) return;
	const FNYCBuildingInfo* B = Buildings.IsValidIndex(Batch.Building) ? &Buildings[Batch.Building] : nullptr;
	const bool bBrick = B && B->bMasonry;
	FRandomStream R(Seed * 7919 + 17);
	const int32 Count = FMath::Min(Stony.Num() * 3, 240);
	TArray<FVector> At, Vel;
	for (int32 k = 0; k < Count; ++k)
	{
		const FNYCPiece& P = Batch.Pieces[Stony[R.RandRange(0, Stony.Num() - 1)]];
		const FBox3f Box = P.Geo.Bounds();       // already moved to collection space
		At.Add(Origin + FVector(FMath::Lerp(Box.Min.X, Box.Max.X, R.GetFraction()), FMath::Lerp(Box.Min.Y, Box.Max.Y, R.GetFraction()), FMath::Lerp(Box.Min.Z, Box.Max.Z, R.GetFraction())));
		const FVector Base = Batch.GroupVelocity.IsValidIndex(P.Group) ? Batch.GroupVelocity[P.Group] : FVector::ZeroVector;
		Vel.Add(Base * R.FRandRange(0.45f, 1.25f) + FVector(R.FRandRange(-210.f, 210.f), R.FRandRange(-210.f, 210.f), R.FRandRange(-60.f, 260.f)));
	}
	FX()->Gravel(At, Vel, bBrick, Seed);
}

void ANYCDestruction::DrainBatches(double BudgetMs)
{
	const FNYCSlowStep Slow_(TEXT("DrainBatches"));
	if (PendingBatches.Num() == 0) return;
	const double Began = FPlatformTime::Seconds();
	TGuardValue<bool> Draining(bDrainingQueue, true);
	do
	{
		FPendingBatch Next = MoveTemp(PendingBatches[0]);
		PendingBatches.RemoveAt(0);
		SpawnBatch(Next.Batch, Next.Centre, Next.Speed, Next.Radius, Next.HoldFor);
	}
	while (PendingBatches.Num() > 0 && (FPlatformTime::Seconds() - Began) * 1000.0 < BudgetMs);
}

/** Joins neighbouring fragments of a cluster into one until there are no more than MaxPieces. */
void ANYCDestruction::FuseBatch(FNYCBatch& Batch, int32 MaxPieces)
{
	for (double Cell = 110.0; Batch.Pieces.Num() > MaxPieces && Cell < 2400.0; Cell *= 1.55)
	{
		TMap<FString, int32> Slot;
		TArray<FNYCPiece> Fused;
		for (FNYCPiece& P : Batch.Pieces)
		{
			if (P.Geo.IsEmpty()) continue;
			const FVector3f C = P.Geo.Bounds().GetCenter();
			const FString Key = FString::Printf(TEXT("%d_%d_%d_%d_%d_%d"), P.Group, FMath::FloorToInt32(C.X / Cell), FMath::FloorToInt32(C.Y / Cell), FMath::FloorToInt32(C.Z / Cell),
				P.Stuff == ENYCStuff::Glass ? 1 : 0, P.bAnchored ? 1 : 0);
			if (const int32* Found = Slot.Find(Key)) Fused[*Found].Geo.Append(P.Geo);
			else Slot.Add(Key, Fused.Add(MoveTemp(P)));
		}
		Batch.Pieces = MoveTemp(Fused);
	}
}

void ANYCDestruction::ReleaseAnchors(int32 Building)
{
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (FNYCDebris& D : Debris)
	{
		if (D.Building != Building || !D.bAnchors || !D.Comp.IsValid()) continue;
		D.Comp->RemoveAllAnchors();
		D.Comp->CrumbleCluster(D.Comp->GetRootIndex());
		for (const int32 g : D.GroupXf)
			if (g >= 0) D.Comp->CrumbleCluster(g);
		D.Comp->SetEnableDamageFromCollision(true);
		D.bAnchors = false;
		D.bHeld = false;
		D.Stage = 3;
	}
}

void ANYCDestruction::ServiceDebris()
{
	const FNYCSlowStep Slow_(TEXT("ServiceDebris"));
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (FNYCDebris& D : Debris)
	{
		UGeometryCollectionComponent* C = D.Comp.Get();
		if (!C || D.Stage >= 3 || D.bHeld) continue;
		if (D.Stage == 0)
		{
			// give the physics proxy one step to exist
			D.Stage = 1;
			continue;
		}
		if (D.Stage == 1)
		{
			if (Clock - D.Born < D.HoldFor)
			{
				// held together as one rigid mass: give the whole block its motion once
				if (D.GroupVelocity.Num() > 0)
				{
					C->ApplyLinearVelocity(C->GetRootIndex(), D.GroupVelocity[0]);
					C->ApplyAngularVelocity(C->GetRootIndex(), D.GroupSpin[0]);
				}
				D.Stage = 2;
				continue;
			}
			D.Stage = 2;
		}
		if (D.Stage == 2)
		{
			if (Clock - D.Born < D.HoldFor) continue;
			C->CrumbleCluster(C->GetRootIndex());
			for (int32 g = 0; g < D.GroupXf.Num(); ++g)
			{
				if (D.GroupXf[g] < 0) continue;
				if (D.GroupCrumble.IsValidIndex(g) && D.GroupCrumble[g]) C->CrumbleCluster(D.GroupXf[g]);
				else if (D.HoldFor <= 0.f)
				{
					C->ApplyLinearVelocity(D.GroupXf[g], D.GroupVelocity[g]);
					const float Slow = FMath::Clamp(150.f / FMath::Max(D.GroupRadius.IsValidIndex(g) ? D.GroupRadius[g] : 150.f, 1.f), 0.12f, 1.f);
					C->ApplyAngularVelocity(D.GroupXf[g], D.GroupSpin[g] * Slow);
				}
			}
			if (D.HoldFor <= 0.f)
			{
				FRandomStream R(D.NumPieces * 31 + D.GroupXf.Num());
				for (int32 Index = 0; Index < D.PieceXf.Num(); ++Index)
				{
					const int32 Packed = D.PieceXf[Index];
					if (Packed < 0) continue;
					const int32 Xf = Packed & 0xFFFF, Group = Packed >> 16;
					if (!D.GroupCrumble.IsValidIndex(Group) || !D.GroupCrumble[Group]) continue;
					// a hand-sized lump is flung about and spins; a slab keeps its course and rolls over slowly
					const float Radius = FMath::Max(D.PieceRadius.IsValidIndex(Index) ? D.PieceRadius[Index] : 60.f, 4.f);
					const float Scatter = FMath::Clamp(65.f / Radius, 0.3f, 1.25f);
					const float Turn = FMath::Clamp(48.f / Radius, 0.1f, 1.3f);
					FVector V = D.GroupVelocity[Group];
					V += FVector(R.FRandRange(-1.f, 1.f), R.FRandRange(-1.f, 1.f), R.FRandRange(-0.5f, 1.f)) * (60.f + D.BlastSpeed * 0.18f) * Scatter;
					C->ApplyLinearVelocity(Xf, V);
					C->ApplyAngularVelocity(Xf, FVector(R.FRandRange(-1.f, 1.f), R.FRandRange(-1.f, 1.f), R.FRandRange(-1.f, 1.f)) * (0.8f + FMath::Min(D.BlastSpeed, 2500.f) * 0.0022f) * Turn);
				}
			}
			D.Stage = 3;
		}
	}
}

void ANYCDestruction::KickDebris(const FVector& Centre, float Radius, float Speed, float UpKick, bool bBreak)
{
	const FNYCSlowStep Slow_(TEXT("KickDebris"));
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (FNYCDebris& D : Debris)
	{
		UGeometryCollectionComponent* C = D.Comp.Get();
		if (!C || D.Stage < 3 || D.bHeld) continue;
		if (D.Box.ExpandBy(1500.f).ComputeSquaredDistanceToPoint(Centre) > Radius * Radius) continue;
		if (bBreak)
		{
			// strain field: breaks clusters that are still whole
			URadialFalloff* Strain = NewObject<URadialFalloff>(C);
			Strain->SetRadialFalloff(900000.f, 0.35f, 1.f, 0.f, Radius, Centre, EFieldFalloffType::Field_Falloff_Linear);
			C->ApplyPhysicsField(true, EGeometryCollectionPhysicsTypeEnum::Chaos_ExternalClusterStrain, nullptr, Strain);
		}
		if (Speed != 0.f)
		{
			// velocity field: radial, fading with distance
			URadialFalloff* Fall = NewObject<URadialFalloff>(C);
			Fall->SetRadialFalloff(1.f, 0.f, 1.f, 0.f, Radius, Centre, EFieldFalloffType::Field_Falloff_Linear);
			URadialVector* Out = NewObject<URadialVector>(C);
			Out->SetRadialVector(Speed, Centre - FVector(0, 0, UpKick));
			UOperatorField* Product = NewObject<UOperatorField>(C);
			Product->SetOperatorField(1.f, Fall, Out, EFieldOperationType::Field_Multiply);
			C->ApplyPhysicsField(true, EGeometryCollectionPhysicsTypeEnum::Chaos_LinearVelocity, nullptr, Product);
		}
	}
}

void ANYCDestruction::LogDebris() const
{
	for (const FNYCBody& B : Bodies)
	{
		if (B.Root.IsValid()) UE_LOG(LogNYC, Display, TEXT("body %s at %s"), *B.Kind, *B.Root->GetComponentLocation().ToString());
	}
	FHitResult Hit;
	const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, FVector(500, 5900, 800), FVector(500, 5900, -800), ECC_WorldStatic);
	UE_LOG(LogNYC, Display, TEXT("ground trace: hit %d at z %.1f (%s); ground valid %d phys %d"), bHit ? 1 : 0, bHit ? Hit.ImpactPoint.Z : 0.0,
		bHit && Hit.GetComponent() ? *Hit.GetComponent()->GetName() : TEXT("-"), Ground.IsValid() ? 1 : 0,
		Ground.IsValid() && Ground->IsPhysicsStateCreated() ? 1 : 0);
	for (int32 i = 0; i < Debris.Num(); ++i)
	{
		const FNYCDebris& D = Debris[i];
		UGeometryCollectionComponent* C = D.Comp.Get();
		if (!C) continue;
		const TArray<FTransform3f>& Now = C->GetComponentSpaceTransforms3f();
		const UGeometryCollection* Rest = C->GetRestCollection();
		const TManagedArray<FTransform3f>& Start = Rest->GetGeometryCollection()->Transform;
		double Sum = 0;
		int32 Count = 0;
		for (int32 t = 1; t < FMath::Min(Now.Num(), Start.Num()); ++t)
		{
			if (Rest->GetGeometryCollection()->TransformToGeometryIndex[t] < 0) continue;
			Sum += (Now[t].GetLocation() - Start[t].GetLocation()).Size();
			++Count;
		}
		int32 Shapes = 0, Sim = 0;
		const FGeometryCollection& G = *Rest->GetGeometryCollection();
		if (const TManagedArray<Chaos::FImplicitObjectPtr>* Impl = G.FindAttribute<Chaos::FImplicitObjectPtr>(FGeometryDynamicCollection::ImplicitsAttribute, FTransformCollection::TransformGroup))
		{
			for (int32 t = 0; t < Impl->Num(); ++t) Shapes += (*Impl)[t].IsValid() ? 1 : 0;
		}
		if (const TManagedArray<bool>* Can = G.FindAttribute<bool>(FGeometryCollection::SimulatableParticlesAttribute, FTransformCollection::TransformGroup))
		{
			for (int32 t = 0; t < Can->Num(); ++t) Sim += (*Can)[t] ? 1 : 0;
		}
		UE_LOG(LogNYC, Display, TEXT("debris %d: shapes %d simulatable %d collision %d"), i, Shapes, Sim, (int32)C->GetCollisionEnabled());
		{
			TArray<float> Zs;
			int32 Under = 0, Far = 0;
			const FTransform World = C->GetComponentTransform();
			for (int32 t = 1; t < FMath::Min(Now.Num(), Start.Num()); ++t)
			{
				if (Rest->GetGeometryCollection()->TransformToGeometryIndex[t] < 0) continue;
				const FVector P = World.TransformPosition(FVector(Now[t].GetLocation()));
				Zs.Add(P.Z);
				Under += P.Z < -60 ? 1 : 0;
				Far += FVector::Dist2D(P, World.GetLocation()) > 4000 ? 1 : 0;
			}
			Zs.Sort();
			if (Zs.Num()) UE_LOG(LogNYC, Display, TEXT("debris %d: world z min %.0f median %.0f max %.0f, under ground %d, farther than 40 m %d of %d"),
				i, Zs[0], Zs[Zs.Num() / 2], Zs.Last(), Under, Far, Zs.Num());
		}
		UE_LOG(LogNYC, Display, TEXT("debris %d: stage %d simulating %d proxy %d root %d pieces %d transforms %d moved %.1f cm (sample %s)"),
			i, D.Stage, C->IsSimulatingPhysics() ? 1 : 0, C->GetPhysicsProxy() ? 1 : 0, C->GetRootIndex(), D.NumPieces, Now.Num(), Count ? Sum / Count : -1.0,
			Now.Num() > 2 ? *Now[Now.Num() - 1].GetLocation().ToString() : TEXT("-"));
	}
}

int32 ANYCDestruction::LivePieces() const
{
	int32 N = 0;
	for (const FNYCDebris& D : Debris) N += D.NumPieces;
	return N;
}

// ------------------------------------------------------------------ colliders
void ANYCDestruction::EnsureGround()
{
	if (Ground.IsValid()) return;
	UBoxComponent* Box = NewObject<UBoxComponent>(this, NAME_None, RF_Transient);
	Box->SetupAttachment(RootComponent);
	Box->SetBoxExtent(FVector(160000.0, 160000.0, 500.0));
	Box->SetWorldLocation(FVector(0, 0, -492.0));
	Box->SetCollisionProfileName(TEXT("BlockAll"));
	Box->RegisterComponent();
	Spawned.Add(Box);
	Ground = Box;
}

void ANYCDestruction::SetBuildingCollider(int32 Index)
{
	TArray<TWeakObjectPtr<UBoxComponent>>& List = Colliders.FindOrAdd(Index);
	for (const TWeakObjectPtr<UBoxComponent>& Old : List)
		if (Old.IsValid()) { Spawned.Remove(Old.Get()); Old->DestroyComponent(); }
	List.Reset();
	const FNYCBuildingState& S = States[Index];
	if (S.bFallen || CVarNoBuildingColliders.GetValueOnGameThread() != 0) return;
	const FNYCBuildingInfo& B = Buildings[Index];
	auto Add = [&](const FBox& Box)
	{
		if (Box.GetSize().GetMin() < 40.0) return;
		UBoxComponent* C = NewObject<UBoxComponent>(this, NAME_None, RF_Transient);
		C->SetupAttachment(RootComponent);
		C->SetBoxExtent(Box.GetExtent());
		C->SetWorldLocation(Box.GetCenter());
		C->SetCollisionProfileName(TEXT("BlockAll"));
		C->RegisterComponent();
		Spawned.Add(C);
		List.Add(C);
	};
	if (!S.bActive)
	{
		for (const FBox& T : B.Tiers) Add(T.ExpandBy(FVector(-24, -24, 0)));
		return;
	}
	// an opened building: only the floors that are still whole hold rubble up (kept a little below
	// the slab above so that pieces breaking free of it do not start inside the collider)
	TArray<int32> Broken;
	Broken.Init(0, S.NumFloors);
	for (const FNYCElement& E : S.Elements)
	{
		if (E.bAlive || E.Type == ENYCElement::Fitout) continue;
		const int32 Lo = FMath::Clamp(FMath::FloorToInt32((E.Box.Min.Z + 40.0) / S.FloorH), 0, S.NumFloors - 1);
		const int32 Hi = FMath::Clamp(FMath::FloorToInt32((E.Box.Max.Z - 40.0) / S.FloorH), Lo, S.NumFloors - 1);
		for (int32 f = Lo; f <= Hi; ++f) Broken[f]++;
	}
	int32 Start = 0;
	auto Flush = [&](int32 End)
	{
		if (End <= Start) return;
		const double Z0 = Start * S.FloorH, Z1 = End * S.FloorH;
		for (const FBox& T : B.Tiers)
		{
			const double A = FMath::Max(Z0, T.Min.Z), C = FMath::Min(Z1, T.Max.Z);
			if (C - A > 100) Add(FBox(FVector(T.Min.X + 120, T.Min.Y + 120, A), FVector(T.Max.X - 120, T.Max.Y - 120, C - 40)));
		}
	};
	for (int32 f = 0; f < S.NumFloors; ++f)
	{
		if (Broken[f] > 0 || f >= S.CollapsingFrom)
		{
			Flush(f);
			Start = f + 1;
		}
	}
	Flush(S.NumFloors);
}

void ANYCDestruction::UpdateColliders(const FVector& Around, float Radius)
{
	EnsureGround();
	TArray<int32> Near;
	BuildingsNear(Around, Radius, Near);
	for (int32 i : Near)
	{
		if (!Colliders.Contains(i)) SetBuildingCollider(i);
	}
}

// ------------------------------------------------------------------ damage
static double SegmentDistance(const FBox& Box, const FVector& A, const FVector& B)
{
	// nearest approach of a segment to a box, sampled finely enough for destruction
	const double Len = FVector::Dist(A, B);
	const int32 N = FMath::Clamp(FMath::CeilToInt32(Len / 120.0), 1, 200);
	double Best = TNumericLimits<double>::Max();
	for (int32 i = 0; i <= N; ++i) Best = FMath::Min(Best, Box.ComputeSquaredDistanceToPoint(FMath::Lerp(A, B, (double)i / N)));
	return FMath::Sqrt(Best);
}

void ANYCDestruction::BreakGlassOnly(int32 Building, int32 ElementIndex, const FVector& From, float Speed)
{
	FNYCBuildingState& S = States[Building];
	FNYCElement& E = S.Elements[ElementIndex];
	if (!E.bAlive || E.bGlassBroken || E.Type != ENYCElement::Module || !E.Comp.IsValid()) return;
	UInstancedStaticMeshComponent* C = E.Comp.Get();
	const FString Name = C->GetStaticMesh()->GetName();
	const TPair<FVector2D, TArray<FVector4f>>* Info = ModuleInfo.Find(Name);
	if (!Info || Info->Value.Num() == 0) return;
	// swap this one module for its broken-window twin
	UStaticMesh* Broken = CityMesh(Name + TEXT("_broken"));
	if (!Broken) return;
	E.bGlassBroken = true;
	const FString Key = FString::Printf(TEXT("%s_%p"), *Broken->GetName(), C);
	UInstancedStaticMeshComponent* Twin = nullptr;
	for (const TWeakObjectPtr<UInstancedStaticMeshComponent>& K : S.Skeleton)
	{
		if (K.IsValid() && K->ComponentHasTag(*Key)) { Twin = K.Get(); break; }
	}
	if (!Twin)
	{
		Twin = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
		Twin->SetMobility(EComponentMobility::Movable);
		Twin->SetStaticMesh(Broken);
		Twin->NumCustomDataFloats = C->NumCustomDataFloats;
		for (int32 m = 0; m < Broken->GetStaticMaterials().Num(); ++m)
		{
			const int32 Source = C->GetStaticMesh()->GetMaterialIndex(Broken->GetStaticMaterials()[m].MaterialSlotName);
			if (Source != INDEX_NONE) Twin->SetMaterial(m, C->GetMaterial(Source));
		}
		Twin->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Twin->bAffectDistanceFieldLighting = false;
		Twin->ComponentTags.Add(*Key);
		Twin->SetupAttachment(RootComponent);
		Twin->RegisterComponent();
		Spawned.Add(Twin);
		S.Skeleton.Add(Twin);
	}
	const int32 NewIndex = Twin->AddInstance(E.Xf, true);
	if (C->NumCustomDataFloats > 0 && (E.Index + 1) * C->NumCustomDataFloats <= C->PerInstanceSMCustomData.Num())
	{
		Twin->SetCustomData(NewIndex, MakeArrayView(C->PerInstanceSMCustomData.GetData() + E.Index * C->NumCustomDataFloats, C->NumCustomDataFloats), true);
	}
	HideInstance(C, E.Index);
	const FTransform Xf = E.Xf;
	E.Comp = Twin;
	E.Index = NewIndex;
	Stats.Windows += Info->Value.Num();
	// falling glass
	const FVector Outward = Xf.TransformVectorNoScale(FVector(0, 1, 0));
	for (const FVector4f& O : Info->Value)
	{
		const FVector P = Xf.TransformPosition(FVector((O.X + O.Y) * 0.5, 0.0, (O.Z + O.W) * 0.5));
		FVector V = (P - From).GetSafeNormal() * Speed * 0.2 + Outward * (120.0 + Speed * 0.15);
		FX()->GlassBurst(P, V, FVector2D((O.Y - O.X), (O.W - O.Z)));
		if (Stats.Windows > 400) break;
	}
}

bool ANYCDestruction::FindWindow(const FVector& Near, float Radius, const FVector& Facing, FVector& OutPoint, FVector& OutNormal)
{
	if (!EnsureLoaded()) return false;
	TArray<int32> List;
	BuildingsNear(Near, Radius + 100.f, List);
	double Best = Radius;
	bool bFound = false;
	int32 Opened = 0;
	for (int32 b : List)
	{
		if (States[b].bFallen || Opened >= 4) continue;
		FNYCBuildingState& S = Activate(b);
		++Opened;
		for (const FNYCElement& E : S.Elements)
		{
			if (E.Type != ENYCElement::Module || !E.bAlive || E.bGlassBroken || !E.Comp.IsValid() || !E.Comp->GetStaticMesh()) continue;
			if (E.Box.ComputeSquaredDistanceToPoint(Near) > (double)Radius * Radius) continue;
			const TPair<FVector2D, TArray<FVector4f>>* Info = ModuleInfo.Find(E.Comp->GetStaticMesh()->GetName());
			if (!Info) continue;
			const FVector Out = E.Xf.TransformVectorNoScale(FVector(0, 1, 0)).GetSafeNormal();
			if (!Facing.IsNearlyZero() && FVector::DotProduct(Out, Facing) < 0.5) continue;
			for (const FVector4f& O : Info->Value)
			{
				const FVector P = E.Xf.TransformPosition(FVector((O.X + O.Y) * 0.5, 0.0, (O.Z + O.W) * 0.5));
				const double Dist = FVector::Dist(P, Near);
				// a pane a person would pick: big enough to see
				if (Dist < Best && (O.Y - O.X) > 45.f && (O.W - O.Z) > 45.f)
				{
					Best = Dist;
					OutPoint = P;
					OutNormal = Out;
					bFound = true;
				}
			}
		}
	}
	FlushHidden();
	return bFound;
}

void ANYCDestruction::ShatterGlass(const FVector& Centre, float Radius, float Speed, int32 MaxWindows)
{
	const FNYCSlowStep Slow_(TEXT("ShatterGlass"));
	if (!EnsureLoaded()) return;
	TArray<int32> Near;
	BuildingsNear(Centre, Radius, Near);
	Near.Sort([&](int32 A, int32 B) { return Buildings[A].Box.ComputeSquaredDistanceToPoint(Centre) < Buildings[B].Box.ComputeSquaredDistanceToPoint(Centre); });
	int32 Done = 0, Opened = 0;
	// opening a building for the first time is the dear part: a very wide shatter played live takes fewer
	const bool bWide = IsLive() && Radius > 3500.f;
	if (bWide) MaxWindows = FMath::Min(MaxWindows, 220);
	const int32 MaxOpened = bWide ? 14 : 60;
	for (int32 b : Near)
	{
		if (Done >= MaxWindows || Opened > MaxOpened) break;
		if (States[b].bFallen) continue;
		FNYCBuildingState& S = Activate(b);
		++Opened;
		for (int32 e = 0; e < S.Elements.Num() && Done < MaxWindows; ++e)
		{
			const FNYCElement& E = S.Elements[e];
			if (E.Type != ENYCElement::Module || !E.bAlive || E.bGlassBroken) continue;
			const double Dist = FMath::Sqrt(E.Box.ComputeSquaredDistanceToPoint(Centre));
			if (Dist > Radius) continue;
			if (Dist > Radius * 0.55 && Rand.GetFraction() > 1.0 - (Dist - Radius * 0.55) / (Radius * 0.45)) continue;
			BreakGlassOnly(b, e, Centre, Speed);
			++Done;
		}
	}
	FlushHidden();
}

void ANYCDestruction::ClearStreetsOfPeople()
{
	if (ANYCTraffic* T = Traffic()) T->SetPedestriansHidden(true);
}

void ANYCDestruction::ApplyDamage(const FNYCDamage& D)
{
	const FNYCSlowStep Slow_(TEXT("ApplyDamage"));
	if (!EnsureLoaded()) return;
	ClearStreetsOfPeople();
	EnsureGround();
	const FVector A = D.Center, B = D.bCapsule ? D.End : D.Center;
	const FVector Mid = (A + B) * 0.5;
	const float Reach = FVector::Dist(A, B) * 0.5f + FMath::Max(D.Radius, 0.f);
	UpdateColliders(Mid, Reach + 4000.f);

	TArray<int32> Near;
	BuildingsNear(Mid, Reach + 100.f, Near);
	int32 Budget = D.MaxElements;
	if (D.OnlyBuilding != INDEX_NONE) Near = { D.OnlyBuilding };
	else if (IsLive() && D.Radius >= 1500.f)
	{
		// the nearest two now, the rest over the next few frames under the flash and dust
		TArray<int32> Struck;
		for (const int32 b : Near)
			if (!States[b].bFallen && SegmentDistance(Buildings[b].Box, A, B) <= D.Radius) Struck.Add(b);
		Struck.Sort([&](int32 X, int32 Y) { return SegmentDistance(Buildings[X].Box, A, B) < SegmentDistance(Buildings[Y].Box, A, B); });
		const int32 Share = FMath::Max(24, 340 / FMath::Max(Struck.Num(), 1));
		for (int32 i = 2; i < Struck.Num(); ++i)
		{
			FNYCDamage Later = D;
			Later.OnlyBuilding = Struck[i];
			Later.MaxElements = Share;
			Later.GlassRadius = 0.f;
			Later.PropRadius = 0.f;
			Later.bCrater = false;
			CoarseUntil = Clock + 14.0;
			After(0.04f * (i - 1), [this, Later]() { ApplyDamage(Later); });
		}
		Near = Struck;
		Near.SetNum(FMath::Min(Near.Num(), 2));
	}
	for (int32 b : Near)
	{
		if (D.Radius <= 0.f || Budget <= 0) break;
		if (States[b].bFallen) continue;
		if (SegmentDistance(Buildings[b].Box, A, B) > D.Radius) continue;
		FNYCBuildingState& S = Activate(b);
		TArray<TPair<double, int32>> Hit;
		for (int32 e = 0; e < S.Elements.Num(); ++e)
		{
			const FNYCElement& E = S.Elements[e];
			if (!E.bAlive) continue;
			if (!D.bFrame && (E.Type == ENYCElement::Column || E.Type == ENYCElement::Slab || E.Type == ENYCElement::Beam)) continue;
			const double Dist = D.bCapsule ? SegmentDistance(E.Box, A, B) : FMath::Sqrt(E.Box.ComputeSquaredDistanceToPoint(A));
			// the frame is tougher than the skin around it
			const float Toughness = E.Type == ENYCElement::Column ? 0.6f : E.Type == ENYCElement::Beam ? 0.65f : E.Type == ENYCElement::Slab ? 0.72f : 1.f;
			if (Dist <= D.Radius * Toughness) Hit.Add({ Dist, e });
		}
		if (Hit.Num() == 0) continue;
		Hit.Sort([](const TPair<double, int32>& U, const TPair<double, int32>& V) { return U.Key < V.Key || (U.Key == V.Key && U.Value < V.Value); });
		const bool bLiveHuge = IsLive() && D.Radius >= 1500.f;
		if (bLiveHuge) CoarseUntil = Clock + 14.0;
		if (bLiveHuge && Budget == D.MaxElements) Budget = FMath::Min(Budget, 340);
		const int32 Count = FMath::Min(Hit.Num(), Budget);
		Budget -= Count;
		const int32 LOD = D.ForceLOD >= 0 ? D.ForceLOD : bLiveHuge ? 2 : Count < 26 ? 0 : Count < 130 ? 1 : 2;

		FNYCBatch Batch;
		Batch.Building = b;
		if (!D.Skin.IsEmpty()) Batch.Override = DebrisMaterial(CityMaterial(D.Skin));
		FBox Broken(ForceInit);
		for (int32 i = 0; i < Count; ++i)
		{
			const int32 e = Hit[i].Value;
			const FNYCElement& E = S.Elements[e];
			const FVector C = E.Box.GetCenter();
			const double Fall = 1.0 - FMath::Clamp(Hit[i].Key / FMath::Max(D.Radius, 1.f), 0.0, 1.0);
			const FVector From = D.bCapsule ? FMath::ClosestPointOnSegment(C, A, B) : A;
			FVector V = D.Push * (0.4 + 0.6 * Fall);
			if (D.bRadial) V += (C - From).GetSafeNormal() * D.Speed * (0.3 + 0.7 * Fall);
			V.Z += D.UpKick * Fall;
			Broken += E.Box;
			// pieces close to the hit come apart at once; the rest stay in lumps until they land
			const bool bRaggedBay = D.bRagged && E.Type == ENYCElement::Module;
			const bool bCrumble = bRaggedBay || Hit[i].Key < D.Radius * 0.62 || E.Type == ENYCElement::Slab;
			const int32 Group = Batch.NewGroup(V, bCrumble, FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-0.6f, 0.6f)));
			const FBox Bay = E.Box;
			const int32 FirstPiece = Batch.Pieces.Num();
			BreakElement(b, e, Batch, Group, LOD, V, bCrumble);
			if (bRaggedBay)
			{
				const int32 Along = Bay.GetSize().X >= Bay.GetSize().Y ? 0 : 1;
				const double Keep = FMath::Max(D.Radius * 0.85f, 55.f);
				for (int32 q = FirstPiece; q < Batch.Pieces.Num(); ++q)
				{
					FNYCPiece& Piece = Batch.Pieces[q];
					if (Piece.Stuff != ENYCStuff::Masonry && Piece.Stuff != ENYCStuff::Concrete) continue;
					const FBox3f Ext = Piece.Geo.Bounds();
					const FVector PieceMid(Ext.GetCenter());
					const FVector From2 = D.bCapsule ? FMath::ClosestPointOnSegment(PieceMid, A, B) : A;
					// distance in the plane of the wall: the blow itself may sit a little in front of it or behind it
					const double Away = FMath::Sqrt(FMath::Square(PieceMid[Along] - From2[Along]) + FMath::Square(PieceMid.Z - From2.Z));
					if (Piece.bRim && Away > Keep) Piece.bAnchored = true;
				}
			}
		}
		// every window nearby goes too
		SpawnBatch(Batch, A, D.Speed, D.Radius);
		if (D.Dust > 0.f && Broken.IsValid)
		{
			const double Size = FMath::Min(Broken.GetExtent().Size() * 0.55, D.Radius * 1.15 + 30.0);
			FX()->DustBurst(Broken.GetCenter(), FMath::Clamp(Size, 40.0, 2200.0), D.Dust * FMath::Clamp(D.Radius / 260.f, 0.3f, 1.f), Buildings[b].Wall);
		}
		SetBuildingCollider(b);
		if (D.bStructural) CheckStructure(b, Mid);
	}
	if (Budget < D.MaxElements)
	{
		for (int32 i = Scars.Num() - 1; i >= 0; --i)
		{
			UStaticMeshComponent* Mark = Scars[i].Get();
			if (Mark && FVector::Dist(Mark->GetComponentLocation(), Mid) > Reach + 90.f) continue;
			if (Mark) FX()->RemoveMesh(Mark);
			Scars.RemoveAtSwap(i);
		}
	}
	if (D.GlassRadius > D.Radius * 0.6f)
	{
		ShatterGlass(A, D.GlassRadius, D.Speed, 700);
	}
	if (D.OnlyBuilding != INDEX_NONE)
	{
		FlushHidden();
		return;
	}
	HitProps(D);
	const float PropR = D.PropRadius >= 0.f ? D.PropRadius : D.Radius * 1.4f;
	if (PropR > 0.f) HitTraffic(Mid, PropR + FVector::Dist(A, B) * 0.5f, D.Speed * D.PropForce, FMath::Clamp(D.Speed / 1200.f, 0.2f, 1.f), D.Fire > 0.4f, D.Push);
	KickDebris(Mid, FMath::Max(D.Radius * 2.2f, PropR), D.Speed * 0.55f, D.UpKick + 60.f, true);
	if (D.bCrater && D.CraterRadius > 40.f && A.Z < D.CraterRadius * 1.2f)
	{
		MakeCrater(FVector(A.X, A.Y, 0), D.CraterRadius, D.CraterRadius * 0.34f);
	}
	FlushHidden();
}

// ------------------------------------------------------------------ time
void ANYCDestruction::After(float Delay, TFunction<void()> Fn)
{
	Timers.Add({ Clock + Delay, TimerOrder++, MoveTemp(Fn) });
}

void ANYCDestruction::During(float Duration, TFunction<void(float, float)> Fn)
{
	Ongoing.Add({ Clock, Clock + Duration, MoveTemp(Fn) });
}

void ANYCDestruction::Shake(const FVector& At, float Strength, float Duration)
{
	Shakes.Add({ At, Strength, Clock, Duration });
}

FVector ANYCDestruction::ShakeOffset(const FVector& Cam) const
{
	FVector Out = FVector::ZeroVector;
	for (const FShakeSource& S : Shakes)
	{
		const double Age = Clock - S.From;
		if (Age < 0 || Age > S.Duration) continue;
		const double Near = 1.0 / (1.0 + FVector::Dist(Cam, S.At) / 6000.0);
		const double Amp = S.Strength * Near * FMath::Square(1.0 - Age / S.Duration);
		Out += FVector(FMath::Sin(Age * 61.0), FMath::Sin(Age * 47.0 + 1.7), FMath::Sin(Age * 73.0 + 4.1)) * Amp;
	}
	return Out.GetClampedToMaxSize(60.0);
}

void ANYCDestruction::Step(float Dt)
{
	Clock += Dt;
	++StepCount;
	for (int32 Guard = 0; Guard < 2000; ++Guard)
	{
		int32 Next = INDEX_NONE;
		for (int32 i = 0; i < Timers.Num(); ++i)
		{
			if (Timers[i].At <= Clock && (Next == INDEX_NONE || Timers[i].At < Timers[Next].At || (Timers[i].At == Timers[Next].At && Timers[i].Order < Timers[Next].Order))) Next = i;
		}
		if (Next == INDEX_NONE) break;
		TFunction<void()> Fn = MoveTemp(Timers[Next].Fn);
		Timers.RemoveAt(Next);
		Fn();
	}
	const int32 Count = Ongoing.Num();
	for (int32 i = 0; i < Count && i < Ongoing.Num(); ++i)
	{
		const FOngoing O = Ongoing[i];
		if (Clock <= O.Until) O.Fn((float)(Clock - O.From), Dt);
	}
	Ongoing.RemoveAll([this](const FOngoing& O) { return Clock > O.Until; });
	TickFelled();
	DrainBatches(6.0);
	ServiceDebris();
	SyncBodies();
	FlushHidden();
	if (Effects) Effects->Advance(Clock, Dt);
}

void ANYCDestruction::AdvanceTo(double Time)
{
	// fixed steps so that a film shot runs the same events every time
	const float Fixed = 1.f / 24.f;
	while (Clock + Fixed * 0.5 < Time) Step(Fixed);
	PlaybackTime = Time;
	EvaluateCaches();
	if (CacheMode == ENYCCacheMode::Playback) SyncBodies();
}

void ANYCDestruction::Tick(float Dt)
{
	Super::Tick(Dt);
	if (!bExternalClock && bLoaded) Step(FMath::Min(Dt, 1.f / 20.f));
}

// ------------------------------------------------------------------ reset
void ANYCDestruction::ResetCity()
{
	CoarseUntil = -1.0;
	Timers.Reset();
	PendingBatches.Reset();
	Scars.Reset();
	Ongoing.Reset();
	Shakes.Reset();
	Felling.Reset();
	for (FNYCDebris& D : Debris)
		if (D.Cache.IsValid()) D.Cache->Destroy();
	for (FNYCBody& B : Bodies)
		if (B.Cache.IsValid()) B.Cache->Destroy();
	Debris.Reset();
	Bodies.Reset();
	CacheBorn.Reset();
	FollowOffsets.Reset();
	for (UActorComponent* C : Spawned)
		if (C && IsValid(C)) C->DestroyComponent();
	Spawned.Reset();
	for (AActor* A : SpawnedActors)
		if (A && IsValid(A)) A->Destroy();
	SpawnedActors.Reset();
	Colliders.Reset();
	Ground = nullptr;
	for (const TPair<TPair<UInstancedStaticMeshComponent*, int32>, FTransform>& H : Hidden)
	{
		if (IsValid(H.Key.Key))
		{
			H.Key.Key->UpdateInstanceTransform(H.Key.Value, H.Value, true, false, true);
			Dirty.Add(H.Key.Key);
		}
	}
	Hidden.Reset();
	FlushHidden();
	for (FNYCBuildingState& S : States)
	{
		for (const TWeakObjectPtr<UInstancedStaticMeshComponent>& C : S.HiddenShells)
			if (C.IsValid()) C->SetVisibility(true);
		S = FNYCBuildingState();
	}
	for (FFar& F : FarBoxes) F.bAlive = true;
	RestoreProps();
	Craters.Reset();
	KeepAlive.RemoveAll([](UObject* O) { return O && O->IsA<UGeometryCollection>(); });
	if (Effects) Effects->Clear();
	if (ANYCTraffic* T = Traffic()) T->ClearDestruction();
	if (bNoPeopleEver) ClearStreetsOfPeople();
	Stats = FNYCDestructionStats();
	Rand.Initialize(1789);
	NextDebrisId = 0;
	NextBodyId = 0;
	Clock = 0.0;
}
