// Street furniture, trees, vehicles, loose rigid bodies and craters.
#include "NYCDestruction.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "NYCDestructionFX.h"
#include "NYCLightField.h"
#include "NYCTraffic.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "ProceduralMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "EngineUtils.h"

namespace
{
	const float PropCell = 1000.f;
	uint64 PKey(int32 X, int32 Y) { return (uint64(uint32(X)) << 32) | uint32(Y); }

	enum EProp : uint8 { PK_Car, PK_Tree, PK_Pole, PK_Hydrant, PK_Box, PK_Bag, PK_Shelter, PK_Plate, PK_Attach, PK_Stall, PK_None };

	uint8 Classify(const FString& N)
	{
		if (N.StartsWith(TEXT("parked_"))) return PK_Car;
		if (N.StartsWith(TEXT("tree")) && N != TEXT("treepit")) return PK_Tree;
		if (N.StartsWith(TEXT("planetree")) || N.StartsWith(TEXT("littree")) || N == TEXT("holidaytree")) return PK_Tree;
		if (N == TEXT("streetlight") || N == TEXT("signalpole") || N == TEXT("mastarm") || N == TEXT("parklamp") || N == TEXT("nostanding") || N == TEXT("oneway")) return PK_Pole;
		if (N == TEXT("hydrant")) return PK_Hydrant;
		if (N == TEXT("mailbox") || N == TEXT("newsbox") || N == TEXT("litterbasket") || N == TEXT("munimeter") || N == TEXT("bench") || N == TEXT("bollard") || N == TEXT("bikerack") || N == TEXT("cafeset") || N == TEXT("planter_shrub") || N == TEXT("steamstack")) return PK_Box;
		if (N.StartsWith(TEXT("trashbags"))) return PK_Bag;
		if (N == TEXT("busshelter")) return PK_Shelter;
		if (N == TEXT("manhole") || N == TEXT("utility_plate") || N == TEXT("catchbasin") || N == TEXT("ventgrate")) return PK_Plate;
		if (N == TEXT("signalhead") || N == TEXT("pedhead") || N == TEXT("signquad")) return PK_Attach;
		if (N.StartsWith(TEXT("kiosk")) || N == TEXT("carousel") || N == TEXT("foodcart") || N == TEXT("subway")) return PK_Stall;
		return PK_None;
	}

	float PropMass(uint8 Kind, const FVector& Size)
	{
		switch (Kind)
		{
		case PK_Car: return 1700.f;
		case PK_Tree: return 900.f;
		case PK_Pole: return 320.f;
		case PK_Hydrant: return 140.f;
		case PK_Bag: return 12.f;
		case PK_Plate: return 90.f;
		default: return FMath::Clamp((float)(Size.X * Size.Y * Size.Z) * 0.00008f, 15.f, 600.f);
		}
	}
}

void ANYCDestruction::IndexProps()
{
	Props.Reset();
	PropGrid.Reset();
	TSet<uint64> Owned;
	auto Id = [](int32 G, int32 I) { return (uint64(uint32(G)) << 32) | uint32(I); };
	for (const FNYCBuildingInfo& B : Buildings)
		for (const FIntPoint& R : B.Refs) Owned.Add(Id(R.X, R.Y));
	for (const FFar& F : FarBoxes) Owned.Add(Id(F.Group, F.Index));
	for (int32 g = 0; g < City->LayoutGroups.Num(); ++g)
	{
		UInstancedStaticMeshComponent* C = City->LayoutGroups[g];
		if (!C || !C->GetStaticMesh()) continue;
		const uint8 Kind = Classify(C->GetStaticMesh()->GetName());
		if (Kind == PK_None) continue;
		for (int32 i = 0; i < C->GetInstanceCount(); ++i)
		{
			if (Owned.Contains(Id(g, i))) continue;
			FTransform Xf;
			C->GetInstanceTransform(i, Xf, true);
			FNYCProp P;
			P.Group = g;
			P.Index = i;
			P.Pos = Xf.GetLocation();
			P.Kind = Kind;
			const int32 At = Props.Add(P);
			PropGrid.FindOrAdd(PKey(FMath::FloorToInt32(P.Pos.X / PropCell), FMath::FloorToInt32(P.Pos.Y / PropCell))).Add(At);
		}
	}
}

void ANYCDestruction::RestoreProps()
{
	for (FNYCProp& P : Props) P.bAlive = true;
	for (TActorIterator<ANYCLightField> It(GetWorld()); It; ++It) It->ReviveLights();
}

void ANYCDestruction::CollectProps(const FVector& Centre, float Radius, TArray<int32>& Out, uint32 KindMask) const
{
	Out.Reset();
	const float R = FMath::Min(Radius, 90000.f);
	const double R2 = (double)R * R;
	if (R > 12000.f)
	{
		for (int32 i = 0; i < Props.Num(); ++i)
			if (Props[i].bAlive && (KindMask & (1u << Props[i].Kind)) && FVector::DistSquared2D(Props[i].Pos, Centre) <= R2) Out.Add(i);
		return;
	}
	for (int32 x = FMath::FloorToInt32((Centre.X - R) / PropCell); x <= FMath::FloorToInt32((Centre.X + R) / PropCell); ++x)
	{
		for (int32 y = FMath::FloorToInt32((Centre.Y - R) / PropCell); y <= FMath::FloorToInt32((Centre.Y + R) / PropCell); ++y)
		{
			if (const TArray<int32>* List = PropGrid.Find(PKey(x, y)))
			{
				for (int32 i : *List)
					if (Props[i].bAlive && (KindMask & (1u << Props[i].Kind)) && FVector::DistSquared2D(Props[i].Pos, Centre) <= R2) Out.Add(i);
			}
		}
	}
}

// ------------------------------------------------------------------ rigid bodies
int32 ANYCDestruction::SpawnBody(const FString& Kind, USceneComponent* Visual, const FTransform& Xf, const FVector& HalfSize, float MassKg,
	const FVector& Velocity, const FVector& Spin)
{
	EnsureGround();
	const int32 Id = NextBodyId++;
	UStaticMeshComponent* Root = NewObject<UStaticMeshComponent>(this, *FString::Printf(TEXT("body_%04d"), Id), RF_Transient);
	Root->SetMobility(EComponentMobility::Movable);
	Root->SetStaticMesh(UnitCube());
	const FVector Half = HalfSize.ComponentMax(FVector(6.0));
	Root->SetupAttachment(RootComponent);
	Root->SetWorldTransform(FTransform(Xf.GetRotation(), Xf.GetLocation(), Half / 50.0));
	Root->SetCollisionProfileName(TEXT("PhysicsActor"));
	Root->BodyInstance.SetMaxDepenetrationVelocity(150.f);
	Root->SetVisibility(false);
	Root->SetCastShadow(false);
	Root->bVisibleInRayTracing = false;
	const bool bPlayback = CacheMode == ENYCCacheMode::Playback;
	Root->RegisterComponent();
	Spawned.Add(Root);
	if (!bPlayback)
	{
		Root->SetSimulatePhysics(true);
		Root->SetMassOverrideInKg(NAME_None, FMath::Max(MassKg, 1.f), true);
		Root->SetAngularDamping(0.25f);
		Root->SetPhysicsLinearVelocity(Velocity);
		Root->SetPhysicsAngularVelocityInDegrees(Spin);
		Root->SetUseCCD(Velocity.Size() > 2500.0);
	}
	FNYCBody Body;
	Body.Root = Root;
	Body.Visual = Visual;
	Body.Kind = Kind;
	Body.HalfSize = Half;
	Body.Born = Clock;
	const int32 At = Bodies.Add(Body);
	RegisterForCache(Root, FString::Printf(TEXT("body_%04d"), Id), Bodies[At].Cache);
	if (Visual)
	{
		// the visual keeps its own scale; it follows the simulated box
		Visual->ComponentTags.Add(TEXT("NYCFollow"));
		FollowOffsets.Add(Visual, Visual->GetComponentTransform().GetRelativeTransform(FTransform(Xf.GetRotation(), Xf.GetLocation())));
	}
	return At;
}

void ANYCDestruction::SyncBodies()
{
	for (FNYCBody& B : Bodies)
	{
		UStaticMeshComponent* Root = B.Root.Get();
		USceneComponent* V = B.Visual.Get();
		if (!Root || !V) continue;
		const FTransform* Offset = FollowOffsets.Find(V);
		if (!Offset) continue;
		V->SetWorldTransform(*Offset * FTransform(Root->GetComponentQuat(), Root->GetComponentLocation()));
		if (B.bBurning && FMath::Fmod(Clock - B.Born, 0.35) < 1.0 / 24.0 && Clock - B.Born < 26.0)
		{
			FX()->Fire(Root->GetComponentLocation() + FVector(0, 0, B.HalfSize.Z * 0.6), FMath::Clamp(B.HalfSize.GetMax() * 0.45, 40.0, 190.0), 0.9f);
		}
	}
}

// ------------------------------------------------------------------ vehicles
int32 ANYCDestruction::WreckVehicle(const FString& MeshName, const FTransform& Xf, const FLinearColor& Paint, const FVector& Velocity, const FVector& Spin,
	const FVector& HitFrom, float Crush, bool bBurn)
{
	UStaticMesh* Mesh = CityMesh(MeshName);
	if (!Mesh) return INDEX_NONE;
	FNYCSoup G = Soup(Mesh);
	if (G.IsEmpty()) return INDEX_NONE;
	const FBox3f Bounds = G.Bounds();
	const FVector3f Centre = Bounds.GetCenter();
	const FVector3f Ext = Bounds.GetExtent();
	// crumple: panels facing the blow fold in, the roof sags, everything buckles
	const FVector3f Dir = FVector3f(Xf.InverseTransformVectorNoScale((Xf.TransformPosition(FVector(Centre)) - HitFrom).GetSafeNormal()));
	const float Depth = Crush * FMath::Min(Ext.X, Ext.Y * 1.6f) * 0.85f;
	FRandomStream R(NextBodyId * 7919 + 13);
	const FVector3f Seed(R.FRandRange(0.f, 100.f), R.FRandRange(0.f, 100.f), R.FRandRange(0.f, 100.f));
	for (int32 i = 0; i < G.Pos.Num(); ++i)
	{
		FVector3f P = G.Pos[i] - Centre;
		const float Along = -FVector3f::DotProduct(P, Dir) / FMath::Max(1.f, FMath::Abs(Dir.X) * Ext.X + FMath::Abs(Dir.Y) * Ext.Y + FMath::Abs(Dir.Z) * Ext.Z);
		const float Facing = FMath::Clamp((Along - 0.15f) / 0.85f, 0.f, 1.f);
		P += Dir * Depth * Facing * Facing;
		const FVector3f Q = (P + Seed) * 0.045f;
		const FVector3f Buckle(FMath::Sin(Q.Y * 1.7f + Q.Z * 2.3f), FMath::Sin(Q.Z * 1.3f + Q.X * 2.9f), FMath::Sin(Q.X * 2.1f + Q.Y * 1.1f));
		P += Buckle * (2.0f + 13.f * Crush * Facing + 3.5f * Crush);
		if (P.Z > 0.f) P.Z *= 1.f - 0.38f * Crush * FMath::Clamp(0.4f + FMath::Max(-Dir.Z, 0.f) + Facing * 0.5f, 0.f, 1.f) * (P.Z / FMath::Max(Ext.Z, 1.f));
		G.Pos[i] = P + Centre;
	}
	UProceduralMeshComponent* PM = NewObject<UProceduralMeshComponent>(this, NAME_None, RF_Transient);
	PM->SetupAttachment(RootComponent);
	PM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PM->SetWorldTransform(Xf);
	PM->RegisterComponent();
	Spawned.Add(PM);
	const TArray<FStaticMaterial>& Slots = Mesh->GetStaticMaterials();
	int32 Section = 0;
	bool bShattered = false;
	for (int32 m = 0; m < Slots.Num(); ++m)
	{
		const FString Slot = Slots[m].MaterialSlotName.ToString();
		const bool bGlass = Slot.Contains(TEXT("glass"));
		TArray<FVector> V, N;
		TArray<int32> T;
		TArray<FVector2D> U0, U1, Empty;
		TArray<FLinearColor> C;
		TArray<FProcMeshTangent> Tan;
		TMap<int32, int32> Remap;
		for (int32 t = 0; t < G.NumTris(); ++t)
		{
			if (G.Mat[t] != m) continue;
			// most of the glass is gone
			if (bGlass && Crush > 0.25f && R.GetFraction() < 0.35f + Crush) { bShattered = true; continue; }
			const FIntVector& I = G.Tris[t];
			const int32 Idx[3] = { I.X, I.Y, I.Z };
			for (int32 k = 0; k < 3; ++k)
			{
				int32* Found = Remap.Find(Idx[k]);
				if (!Found)
				{
					V.Add(FVector(G.Pos[Idx[k]]));
					N.Add(FVector(G.Nrm[Idx[k]]));
					U0.Add(FVector2D(G.UV0[Idx[k]]));
					U1.Add(FVector2D(G.UV1[Idx[k]]));
					C.Add(FLinearColor(G.Col[Idx[k]].X, G.Col[Idx[k]].Y, G.Col[Idx[k]].Z, G.Col[Idx[k]].W));
					Found = &Remap.Add(Idx[k], V.Num() - 1);
				}
				T.Add(*Found);
			}
		}
		if (T.Num() == 0) continue;
		PM->CreateMeshSection_LinearColor(Section, V, T, N, U0, U1, Empty, Empty, C, Tan, false);
		PM->SetMaterial(Section++, Mesh->GetMaterial(m));
	}
	const FLinearColor Colour = bBurn ? FLinearColor(0.012f, 0.01f, 0.009f) : Paint;
	PM->SetCustomPrimitiveDataFloat(0, Colour.R);
	PM->SetCustomPrimitiveDataFloat(1, Colour.G);
	PM->SetCustomPrimitiveDataFloat(2, Colour.B);
	const FTransform Body(Xf.GetRotation(), Xf.TransformPosition(FVector(Centre)));
	const FVector Half(Ext.X * 0.94, Ext.Y * 0.9, Ext.Z * 0.82);
	const int32 At = SpawnBody(TEXT("car"), PM, Body, Half, 1600.f, Velocity, Spin);
	if (bShattered) FX()->GlassBurst(Body.GetLocation() + FVector(0, 0, 40), Velocity * 0.4 + FVector(0, 0, 260), FVector2D(220, 110));
	if (bBurn && Bodies.IsValidIndex(At))
	{
		Bodies[At].bBurning = true;
		FX()->Fireball(Body.GetLocation() + FVector(0, 0, 60), 170.f, 0.9f);
		FX()->SmokeColumn(Body.GetLocation(), 130.f, 24.f);
	}
	Stats.Vehicles++;
	return At;
}

void ANYCDestruction::HitTraffic(const FVector& Centre, float Radius, float Speed, float Crush, bool bBurn, const FVector& Push)
{
	const FNYCSlowStep Slow_(TEXT("HitTraffic"));
	ANYCTraffic* T = Traffic();
	if (!T || Radius <= 0.f) return;
	TArray<FNYCCarInfo> Cars;
	T->CollectCars(Centre, Radius, Cars);
	int32 Done = 0;
	for (const FNYCCarInfo& C : Cars)
	{
		const double Dist = FVector::Dist2D(C.Xf.GetLocation(), Centre);
		const double Fall = 1.0 - FMath::Clamp(Dist / Radius, 0.0, 1.0);
		const FVector Out = (C.Xf.GetLocation() - Centre).GetSafeNormal2D();
		FVector V = C.Xf.GetUnitAxis(EAxis::X) * C.Speed + Out * Speed * (0.35 + 0.65 * Fall) + Push * 0.7 + FVector(0, 0, Speed * 0.35 * Fall);
		const FVector Spin = FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f)) * (40.0 + Speed * 0.1 * Fall);
		T->RemoveCar(C.Key);
		const int32 At = WreckVehicle(C.Mesh, C.Xf, C.Color, V, Spin, Centre, Crush * (0.4f + 0.6f * (float)Fall), bBurn && Rand.GetFraction() < 0.35 + 0.5 * Fall);
		if (At != INDEX_NONE && C.Wheels.Num() > 0 && Bodies.IsValidIndex(At))
		{
			UStaticMesh* WheelMesh = CityMesh(C.WheelMesh);
			USceneComponent* Visual = Bodies[At].Visual.Get();
			for (const FTransform& W : C.Wheels)
			{
				if (!WheelMesh || !Visual) break;
				if (Crush > 0.55f && Rand.GetFraction() < 0.25f)
				{
					// a wheel tears off and bowls away
					UStaticMeshComponent* Loose = NewVisual(WheelMesh, W * C.Xf);
					SpawnBody(TEXT("wheel"), Loose, FTransform((W * C.Xf).GetRotation(), (W * C.Xf).GetLocation()), FVector(34, 14, 34), 28.f,
						V * 0.8 + FVector(Rand.FRandRange(-300.f, 300.f), Rand.FRandRange(-300.f, 300.f), 300.0), FVector(0, 600, 0));
				}
				else
				{
					UStaticMeshComponent* Fixed = NewVisual(WheelMesh, W * C.Xf);
					Fixed->AttachToComponent(Visual, FAttachmentTransformRules::KeepWorldTransform);
				}
			}
		}
		if (++Done >= 40) break;
	}
	T->AddObstacle(Centre, FMath::Min(Radius * 0.6f, 2500.f));
}

UStaticMeshComponent* ANYCDestruction::NewInstanceVisual(UInstancedStaticMeshComponent* Source, int32 Instance, const FTransform& Xf)
{
	// the city's materials read per-instance values, which only an instanced component can supply
	UInstancedStaticMeshComponent* V = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
	V->SetMobility(EComponentMobility::Movable);
	V->SetStaticMesh(Source->GetStaticMesh());
	for (int32 m = 0; m < Source->GetNumMaterials(); ++m) V->SetMaterial(m, Source->GetMaterial(m));
	V->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	V->bAffectDistanceFieldLighting = false;
	const int32 N = Source->NumCustomDataFloats;
	V->NumCustomDataFloats = N;
	V->SetupAttachment(RootComponent);
	V->SetWorldTransform(Xf);
	V->RegisterComponent();
	const int32 At = V->AddInstance(FTransform::Identity, false);
	if (N > 0 && (Instance + 1) * N <= Source->PerInstanceSMCustomData.Num())
		V->SetCustomData(At, MakeArrayView(Source->PerInstanceSMCustomData.GetData() + Instance * N, N), true);
	Spawned.Add(V);
	return V;
}

// ------------------------------------------------------------------ furniture
int32 ANYCDestruction::LaunchProp(int32 PropIndex, const FVector& Velocity, const FVector& Spin, bool bBreak, bool bBurn)
{
	if (!Props.IsValidIndex(PropIndex) || !Props[PropIndex].bAlive) return INDEX_NONE;
	FNYCProp& P = Props[PropIndex];
	UInstancedStaticMeshComponent* C = City->LayoutGroups.IsValidIndex(P.Group) ? City->LayoutGroups[P.Group] : nullptr;
	if (!C || !C->GetStaticMesh()) return INDEX_NONE;
	P.bAlive = false;
	UStaticMesh* Mesh = C->GetStaticMesh();
	const FString Name = Mesh->GetName();
	FTransform Xf;
	C->GetInstanceTransform(P.Index, Xf, true);
	HideInstance(C, P.Index);
	Stats.Props++;
	const FBox Local = Mesh->GetBoundingBox();
	const FVector Scale = Xf.GetScale3D();
	const FVector Centre = Xf.TransformPosition(Local.GetCenter());
	const FVector Half = Local.GetExtent() * Scale;

	if (P.Kind == PK_Car)
	{
		FLinearColor Paint(0.3f, 0.3f, 0.32f);
		if (C->NumCustomDataFloats >= 3 && (P.Index + 1) * C->NumCustomDataFloats <= C->PerInstanceSMCustomData.Num())
		{
			const float* D = C->PerInstanceSMCustomData.GetData() + P.Index * C->NumCustomDataFloats;
			Paint = FLinearColor(D[0], D[1], D[2]);
		}
		const float Crush = FMath::Clamp((float)Velocity.Size() / 2200.f, 0.15f, 1.f);
		return WreckVehicle(Name, Xf, Paint, Velocity, Spin * 0.4, Centre - Velocity.GetSafeNormal() * 300.0 - FVector(0, 0, bBreak ? 0 : -200), Crush, bBurn);
	}

	auto MeshBody = [&](const FVector& BodyHalf, const FVector& BodyCentre, float Mass) -> int32
	{
		UStaticMeshComponent* Vis = NewInstanceVisual(C, P.Index, Xf);
		return SpawnBody(Name, Vis, FTransform(Xf.GetRotation(), BodyCentre), BodyHalf, Mass, Velocity, Spin);
	};
	auto Fragments = [&](int32 Pieces, float Density, ENYCStuff Stuff)
	{
		FNYCSoup G = Soup(Mesh);
		if (G.IsEmpty()) return;
		FNYCBatch Batch;
		Batch.Density = Density;
		TArray<int32> Slot;
		for (int32 m = 0; m < Mesh->GetStaticMaterials().Num(); ++m) Slot.Add(Batch.MaterialSlot(DebrisMaterial(C->GetMaterial(m))));
		for (int32& M : G.Mat) M = Slot.IsValidIndex(M) ? Slot[M] : 0;
		G.Transform(FTransform3f(Xf));
		const FBox3f Box = G.Bounds();
		const FVector3f Size = Box.GetSize();
		const int32 NZ = FMath::Clamp(FMath::RoundToInt32(Size.Z / FMath::Max(40.f, Size.GetMax() / FMath::Pow((float)Pieces, 0.55f))), 1, 8);
		const int32 PerLayer = FMath::Max(1, Pieces / NZ);
		const int32 NX = FMath::Max(1, FMath::RoundToInt32(FMath::Sqrt(PerLayer * FMath::Max(Size.X, 1.f) / FMath::Max(Size.Y, 1.f))));
		const int32 NY = FMath::Max(1, PerLayer / NX);
		for (int32 i = 0; i < NX; ++i)
			for (int32 j = 0; j < NY; ++j)
				for (int32 k = 0; k < NZ; ++k)
				{
					const FVector3f A = Box.Min + FVector3f(Size.X * i / NX, Size.Y * j / NY, Size.Z * k / NZ);
					const FBox3f Cell(A, A + FVector3f(Size.X / NX, Size.Y / NY, Size.Z / NZ));
					FNYCPiece Piece;
					for (int32 t = 0; t < G.NumTris(); ++t) NYCFracture::ClipTriangleToBox(G, t, Cell, Piece.Geo, G.Mat[t]);
					if (Piece.Geo.IsEmpty()) continue;
					NYCFracture::Thicken(Piece.Geo, 2.f, Piece.Geo.Mat[0]);
					Piece.Stuff = Stuff;
					const FVector Mid(Cell.GetCenter());
					const FVector V = Velocity * Rand.FRandRange(0.5f, 1.2f) + (Mid - Centre).GetSafeNormal() * Rand.FRandRange(80.f, 380.f);
					Piece.Group = Batch.NewGroup(V, true);
					Batch.Pieces.Add(MoveTemp(Piece));
					Stats.Pieces++;
				}
		SpawnBatch(Batch, Centre - Velocity.GetSafeNormal() * 100.0, Velocity.Size() * 0.4f, 300.f);
	};

	switch (P.Kind)
	{
	case PK_Tree:
	{
		if (bBreak && Velocity.Size() > 1400.0)
		{
			Fragments(14, 600.f, ENYCStuff::Wood);
			FX()->Splinters(Centre, Velocity * 0.5, 160);
		}
		else
		{
			// falls whole: a tall thin body that pivots about its foot
			MeshBody(FVector(Half.X * 0.28, Half.Y * 0.28, Half.Z * 0.92), Centre + FVector(0, 0, 8), 700.f);
			FX()->Splinters(Xf.GetLocation() + FVector(0, 0, 60), Velocity * 0.3, 50);
		}
		break;
	}
	case PK_Pole:
	{
		const int32 At = MeshBody(FVector(FMath::Min(Half.X, 40.0), FMath::Min(Half.Y, 40.0), Half.Z * 0.96), FVector(Xf.GetLocation().X, Xf.GetLocation().Y, Centre.Z + 4), 320.f);
		// signs and signal heads go down with the post
		TArray<int32> Attached;
		CollectProps(Xf.GetLocation(), FMath::Max(Half.X, Half.Y) * 2.0f + 90.f, Attached, 1u << PK_Attach);
		if (USceneComponent* Vis = Bodies.IsValidIndex(At) ? Bodies[At].Visual.Get() : nullptr)
		{
			for (int32 a : Attached)
			{
				FNYCProp& Q = Props[a];
				UInstancedStaticMeshComponent* AC = City->LayoutGroups[Q.Group];
				if (!AC) continue;
				FTransform AX;
				AC->GetInstanceTransform(Q.Index, AX, true);
				Q.bAlive = false;
				HideInstance(AC, Q.Index);
				UStaticMeshComponent* Extra = NewInstanceVisual(AC, Q.Index, AX);
				Extra->AttachToComponent(Vis, FAttachmentTransformRules::KeepWorldTransform);
			}
		}
		if (ANYCTraffic* T = Traffic()) T->RemoveSignals(Xf.GetLocation(), FMath::Max(Half.X, Half.Y) * 2.0f + 120.f);
		for (TActorIterator<ANYCLightField> It(GetWorld()); It; ++It) It->KillLights(Xf.GetLocation() + FVector(0, 0, Half.Z * 1.6), 420.f);
		FX()->Sparks(Xf.GetLocation() + FVector(0, 0, 40), FVector(0, 0, 500), 90);
		break;
	}
	case PK_Hydrant:
	{
		MeshBody(Half * 0.9, Centre + FVector(0, 0, 5), 140.f);
		FX()->WaterJet(FVector(Xf.GetLocation().X, Xf.GetLocation().Y, 25.0), FVector(0, 0, 1) + Velocity.GetSafeNormal2D() * 0.12, 26.f, 1.f);
		break;
	}
	case PK_Shelter:
	{
		Fragments(60, 900.f, ENYCStuff::Glass);
		FX()->GlassBurst(Centre, Velocity * 0.4, FVector2D(300, 220));
		break;
	}
	case PK_Stall:
	{
		Fragments(36, 500.f, ENYCStuff::Wood);
		FX()->Splinters(Centre, Velocity * 0.5, 90);
		break;
	}
	case PK_Plate:
	{
		MeshBody(FVector(FMath::Max(Half.X, 8.0), FMath::Max(Half.Y, 8.0), 6.0), Centre + FVector(0, 0, 8), 90.f);
		break;
	}
	case PK_Bag:
	case PK_Box:
	default:
	{
		if (bBreak) Fragments(P.Kind == PK_Bag ? 8 : 12, P.Kind == PK_Bag ? 120.f : 700.f, ENYCStuff::Soft);
		else MeshBody(Half * 0.92, Centre + FVector(0, 0, 3), PropMass(P.Kind, Half * 2.0));
		if (P.Kind == PK_Bag || P.Kind == PK_Box) FX()->Litter(Centre, Velocity * 0.35, bBreak ? 90 : 25);
		break;
	}
	}
	if (bBurn) FX()->Fire(Centre, FMath::Clamp(Half.GetMax() * 0.5, 40.0, 160.0), 14.f);
	return INDEX_NONE;
}

void ANYCDestruction::HitProps(const FNYCDamage& D)
{
	const FNYCSlowStep Slow_(TEXT("HitProps"));
	const float R = D.PropRadius >= 0.f ? D.PropRadius : D.Radius * 1.4f;
	if (R <= 0.f || D.PropForce <= 0.f) return;
	const FVector A = D.Center, B = D.bCapsule ? D.End : D.Center;
	TArray<int32> List;
	CollectProps((A + B) * 0.5, R + FVector::Dist2D(A, B) * 0.5f, List);
	int32 Done = 0;
	for (int32 p : List)
	{
		const FNYCProp& P = Props[p];
		if (!P.bAlive || P.Kind == PK_Attach) continue;
		const FVector At = P.Pos + FVector(0, 0, 80);
		const FVector From = D.bCapsule ? FMath::ClosestPointOnSegment(At, A, B) : A;
		const double Dist = FVector::Dist(At, From);
		const double Reach = P.Kind == PK_Plate ? R * 0.55 : P.Kind == PK_Car || P.Kind == PK_Tree ? R * 0.85 : R;
		if (Dist > Reach) continue;
		const double Fall = 1.0 - Dist / Reach;
		FVector Out = (At - From).GetSafeNormal2D();
		if (Out.IsNearlyZero()) Out = FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), 0).GetSafeNormal();
		const double Heavy = P.Kind == PK_Car ? 0.75 : P.Kind == PK_Bag ? 1.5 : P.Kind == PK_Tree || P.Kind == PK_Pole ? 0.45 : 1.0;
		FVector V = (Out * D.Speed * (0.25 + 0.75 * Fall) + D.Push * 0.6) * D.PropForce * Heavy;
		V.Z += (D.Speed * 0.3 * Fall + D.UpKick * Fall) * Heavy + (P.Kind == PK_Plate ? 500.0 * Fall : 0.0);
		const FVector Axis = FVector(-Out.Y, Out.X, 0);
		const FVector Spin = Axis * FMath::Min(420.0, V.Size() * 0.16) + FVector(0, 0, Rand.FRandRange(-90.f, 90.f));
		const bool bCoarse = IsLive() && Clock < CoarseUntil;
		const bool bBreak = !bCoarse && Dist < R * 0.4 && D.Speed > 500.f;
		const bool bBurn = D.Fire > 0.05f && Rand.GetFraction() < D.Fire * Fall;
		// played live, a great blast throws the street's furniture a few pieces a frame
		if (bCoarse && Done >= 6)
		{
			After(0.03f * (Done / 6), [this, p, V, Spin, bBurn]() { if (Props.IsValidIndex(p) && Props[p].bAlive) LaunchProp(p, V, Spin, false, bBurn); });
		}
		else LaunchProp(p, V, Spin, bBreak, bBurn);
		if (++Done >= (bCoarse ? 45 : 140)) break;
	}
}

// ------------------------------------------------------------------ craters
void ANYCDestruction::MakeCrater(const FVector& Centre, float Radius, float Depth)
{
	const FNYCSlowStep Slow_(TEXT("MakeCrater"));
	EnsureGround();
	// merge with a crater already here
	for (const FCrater& C : Craters)
		if (FVector::Dist2D(C.Centre, Centre) < C.Radius * 0.7f && Radius <= C.Radius * 1.15f) return;
	if (Craters.Num() >= 24)
	{
		int32 Smallest = 0;
		for (int32 i = 1; i < Craters.Num(); ++i) if (Craters[i].Radius < Craters[Smallest].Radius) Smallest = i;
		Craters.RemoveAt(Smallest);
	}
	Craters.Add({ Centre, Radius, Depth });
	Stats.Craters++;
	FX()->Crater(Centre, Radius, Depth);
	// slabs of pavement thrown out of the hole
	FNYCBatch Batch;
	Batch.Density = 2300.f;
	const int32 Asphalt = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("concrete"))));
	const int32 Dark = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("granite_black"))));
	const int32 Soil = Batch.MaterialSlot(DebrisMaterial(CityMaterial(TEXT("soil"))));
	FRandomStream R((int32)(Centre.X + Centre.Y * 7));
	TArray<TArray<FVector2f>> Cells;
	const int32 N = FMath::Clamp(FMath::RoundToInt32(Radius / 75.f), 3, 11);
	NYCFracture::Voronoi2D(FVector2f(-Radius, -Radius), FVector2f(Radius, Radius), N, N, R, Cells, 0.95f);
	for (const TArray<FVector2f>& Cell : Cells)
	{
		FVector2f Mid(0, 0);
		for (const FVector2f& Q : Cell) Mid += Q / Cell.Num();
		const float D = Mid.Size();
		if (D > Radius * 0.92f) continue;
		TArray<FVector2f> World;
		for (const FVector2f& Q : Cell) World.Add(Q + FVector2f(Centre.X, Centre.Y));
		FNYCPiece P;
		// broken blacktop is dark right through (pale soil on the sides made the slabs read as cartons)
		NYCFracture::AddPrismXY(P.Geo, World, 3.f, 3.f + R.FRandRange(14.f, 34.f), Dark, Dark, Dark);
		P.Stuff = ENYCStuff::Asphalt;
		const FVector Out = FVector(Mid.X, Mid.Y, 0).GetSafeNormal();
		const float K = 1.f - D / Radius;
		const FVector V = Out * R.FRandRange(150.f, 500.f) * (0.5f + Radius / 700.f) + FVector(0, 0, R.FRandRange(250.f, 750.f) * (0.35f + K) * FMath::Sqrt(Radius / 300.f));
		P.Group = Batch.NewGroup(V, true);
		Batch.Pieces.Add(MoveTemp(P));
		Stats.Pieces++;
	}
	SpawnBatch(Batch, Centre - FVector(0, 0, Depth), 600.f, Radius * 2.f);
}
