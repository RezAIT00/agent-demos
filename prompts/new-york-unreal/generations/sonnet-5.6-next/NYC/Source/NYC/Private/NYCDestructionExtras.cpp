// Building blocks for the stranger tools: loose lumps, wall scars, disintegration, dragging loose bodies
// about (gravity, magnets, vortices), and things sinking into the ground.
#include "NYCDestruction.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "NYCDestructionFX.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GeometryCollection/GeometryCollectionComponent.h"
#include "Field/FieldSystemObjects.h"
#include "Engine/StaticMesh.h"

void ANYCDestruction::SpawnLumps(const FVector& At, const FVector& Direction, int32 Count, float Size, const FString& Material, float Speed,
	float Spread, float Elongation)
{
	if (!EnsureLoaded() || Count <= 0) return;
	EnsureGround();
	UpdateColliders(At, 2500.f);
	FNYCBatch Batch;
	Batch.Density = Material.StartsWith(TEXT("paint")) || Material == TEXT("steel") || Material == TEXT("rust") ? 3500.f : 1900.f;
	UMaterialInterface* Source = CityMaterial(Material);
	const int32 Slot = Batch.MaterialSlot(DebrisMaterial(Source));
	const FVector Dir = Direction.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);
	for (int32 i = 0; i < Count; ++i)
	{
		const float S = Size * Rand.FRandRange(0.45f, 1.25f);
		const FVector3f Half(S * 0.5f * Elongation, S * 0.5f * Rand.FRandRange(0.55f, 1.f) / FMath::Max(1.f, Elongation * 0.5f), S * 0.5f * Rand.FRandRange(0.35f, 0.9f) / FMath::Max(1.f, Elongation * 0.5f));
		const FVector Pos = At + FVector(Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-1.f, 1.f), Rand.FRandRange(-0.5f, 1.f)) * Size * 0.55f * FMath::Sqrt((float)Count) * 0.35f;
		const FQuat4f Q(FRotator3f(Rand.FRandRange(0.f, 360.f), Rand.FRandRange(0.f, 360.f), Rand.FRandRange(0.f, 360.f)));
		// an irregular six-faced lump
		FVector3f V[8];
		for (int32 k = 0; k < 8; ++k)
		{
			const FVector3f Corner((k & 1) ? 1.f : -1.f, (k & 2) ? 1.f : -1.f, (k & 4) ? 1.f : -1.f);
			const FVector3f Jitter(Rand.FRandRange(0.55f, 1.f), Rand.FRandRange(0.55f, 1.f), Rand.FRandRange(0.55f, 1.f));
			V[k] = Q.RotateVector(Corner * Half * Jitter) + FVector3f(Pos);
		}
		FNYCPiece P;
		static const int32 Faces[6][4] = { { 4, 5, 7, 6 }, { 0, 2, 3, 1 }, { 1, 3, 7, 5 }, { 0, 4, 6, 2 }, { 2, 6, 7, 3 }, { 0, 1, 5, 4 } };
		for (const int32(&F)[4] : Faces) P.Geo.AddQuad(V[F[0]], V[F[1]], V[F[2]], V[F[3]], Slot);
		FVector Out = Rand.VRand();
		const FVector Vel = (Dir + Out * Spread).GetSafeNormal() * Speed * Rand.FRandRange(0.45f, 1.25f);
		P.Group = Batch.NewGroup(Vel, true);
		Batch.Pieces.Add(MoveTemp(P));
		Stats.Pieces++;
	}
	SpawnBatch(Batch, At - Dir * 50.0, Speed * 0.4f, Size * 3.f);
}

void ANYCDestruction::Scar(const FVector& At, const FVector& Normal, float Radius)
{
	const FQuat Q = FQuat::FindBetweenNormals(FVector::UpVector, Normal.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector));
	const FQuat Turn(FVector::UpVector, Rand.FRandRange(0.f, 6.28f));
	if (UStaticMeshComponent* Mark = FX()->Mesh(TEXT("fx_scar"), FTransform(Q * Turn, At + Normal * 1.6f, FVector(Radius / 100.0)))) Scars.Add(Mark);
	Stats.Pieces++;
}

int32 ANYCDestruction::DissolveElements(const FVector& Centre, float Radius, int32 MaxCount, const FLinearColor& Tint, bool bCheckStructure, const FString& Dust)
{
	if (!EnsureLoaded()) return 0;
	TArray<int32> Near;
	BuildingsNear(Centre, Radius, Near);
	int32 Done = 0, Puffs = 0;
	for (int32 b : Near)
	{
		if (Done >= MaxCount) break;
		if (States[b].bFallen) continue;
		FNYCBuildingState& S = Activate(b);
		bool bAny = false;
		for (int32 e = 0; e < S.Elements.Num() && Done < MaxCount; ++e)
		{
			FNYCElement& E = S.Elements[e];
			if (!E.bAlive || E.Box.ComputeSquaredDistanceToPoint(Centre) > (double)Radius * Radius) continue;
			// the element's middle must be inside, so that the edge of the bite stays ragged but true
			if (FVector::Dist(E.Box.GetCenter(), Centre) > Radius + E.Box.GetExtent().Size() * 0.35) continue;
			const FVector At = E.Box.GetCenter();
			S.Support[E.Floor] -= E.Support;
			HideElement(S, E);
			Stats.Elements++;
			++Done;
			bAny = true;
			if (Puffs < 70 && (Done % 3) == 0)
			{
				++Puffs;
				FX()->Motes(At, 55, Tint, FMath::Min(180.0, E.Box.GetExtent().GetMax()), 190.f, 2.2f, 4.5f, FVector(0, 0, 90));
				if (!Dust.IsEmpty()) FX()->DustBurst(At, 170.f, 0.45f, Dust);
			}
		}
		if (bAny)
		{
			ReleaseAnchors(b);
			SetBuildingCollider(b);
			if (bCheckStructure) CheckStructure(b, Centre);
		}
	}
	FlushHidden();
	return Done;
}

int32 ANYCDestruction::FindProp(const FVector& P, uint32 KindMask, float MaxDist) const
{
	TArray<int32> List;
	CollectProps(P, MaxDist, List, KindMask);
	int32 Best = INDEX_NONE;
	double BestD = TNumericLimits<double>::Max();
	for (int32 i : List)
	{
		const double D = FVector::DistSquared2D(Props[i].Pos, P);
		if (D < BestD) { BestD = D; Best = i; }
	}
	return Best;
}

FVector ANYCDestruction::PropLocation(int32 Index) const
{
	return Props.IsValidIndex(Index) ? Props[Index].Pos : FVector::ZeroVector;
}

void ANYCDestruction::SinkProp(int32 Index, float Depth, float Duration)
{
	if (!Props.IsValidIndex(Index) || !Props[Index].bAlive) return;
	FNYCProp& P = Props[Index];
	UInstancedStaticMeshComponent* C = City->LayoutGroups.IsValidIndex(P.Group) ? City->LayoutGroups[P.Group] : nullptr;
	if (!C) return;
	FTransform Xf;
	C->GetInstanceTransform(P.Index, Xf, true);
	P.bAlive = false;
	HideInstance(C, P.Index);
	Stats.Props++;
	UStaticMeshComponent* V = NewInstanceVisual(C, P.Index, Xf);
	const FRotator Tip(Rand.FRandRange(-40.f, 40.f), Rand.FRandRange(-20.f, 20.f), Rand.FRandRange(-40.f, 40.f));
	TWeakObjectPtr<UStaticMeshComponent> Weak(V);
	During(Duration, [Weak, Xf, Depth, Duration, Tip](float T, float)
	{
		if (!Weak.IsValid()) return;
		const float U = FMath::Clamp(T / Duration, 0.f, 1.f);
		FTransform Now = Xf;
		Now.SetLocation(Xf.GetLocation() - FVector(0, 0, Depth * U * U));
		Now.SetRotation((Tip * U).Quaternion() * Xf.GetRotation());
		Weak->SetWorldTransform(Now);
		if (U >= 0.97f) Weak->SetVisibility(false);
	});
}

void ANYCDestruction::SetBodiesGravity(const FVector& Centre, float Radius, bool bGravity, int32 FirstBody)
{
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (int32 i = FMath::Max(FirstBody, 0); i < Bodies.Num(); ++i)
	{
		UStaticMeshComponent* R = Bodies[i].Root.Get();
		if (!R || FVector::DistSquared2D(R->GetComponentLocation(), Centre) > (double)Radius * Radius) continue;
		R->SetEnableGravity(bGravity);
		R->WakeAllRigidBodies();
	}
}

void ANYCDestruction::DragBodies(const FVector& Target, float Radius, float Acceleration, float MaxSpeed, float Swirl, float SwallowRadius, float Dt)
{
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (FNYCBody& B : Bodies)
	{
		UStaticMeshComponent* R = B.Root.Get();
		if (!R || !R->IsSimulatingPhysics()) continue;
		const FVector To = Target - R->GetComponentLocation();
		const double Dist = To.Size();
		if (Dist > Radius) continue;
		if (Dist < SwallowRadius)
		{
			R->SetSimulatePhysics(false);
			R->SetWorldLocation(FVector(0, 0, -100000.0));
			if (B.Visual.IsValid()) B.Visual->SetVisibility(false, true);
			B.bBurning = false;
			continue;
		}
		const FVector Dir = To / Dist;
		FVector V = R->GetPhysicsLinearVelocity();
		V += Dir * Acceleration * Dt + FVector::CrossProduct(FVector::UpVector, Dir) * Swirl * Dt;
		// bleed off speed that is not taking it where it is being pulled
		const FVector Across = V - Dir * FVector::DotProduct(V, Dir);
		V -= Across * FMath::Min(1.0, Dt * 0.6);
		R->WakeAllRigidBodies();
		R->SetPhysicsLinearVelocity(V.GetClampedToMaxSize(MaxSpeed));
	}
}

void ANYCDestruction::DragDebris(const FVector& Target, float Radius, float Speed, float Swirl, float Lift)
{
	if (CacheMode == ENYCCacheMode::Playback) return;
	for (FNYCDebris& D : Debris)
	{
		UGeometryCollectionComponent* C = D.Comp.Get();
		if (!C || D.Stage < 3) continue;
		if (D.Box.ExpandBy(3000.f).ComputeSquaredDistanceToPoint(Target) > (double)Radius * Radius) continue;
		D.Box += Target;
		if (Speed != 0.f)
		{
			// a radial field with negative strength draws everything inward
			URadialFalloff* Fall = NewObject<URadialFalloff>(C);
			Fall->SetRadialFalloff(1.f, 0.25f, 1.f, 0.f, Radius, Target, EFieldFalloffType::Field_Falloff_Linear);
			URadialVector* In = NewObject<URadialVector>(C);
			In->SetRadialVector(-Speed, Target - FVector(0, 0, Lift));
			UOperatorField* Product = NewObject<UOperatorField>(C);
			Product->SetOperatorField(1.f, Fall, In, EFieldOperationType::Field_Multiply);
			C->ApplyPhysicsField(true, EGeometryCollectionPhysicsTypeEnum::Chaos_LinearVelocity, nullptr, Product);
		}
		if (Swirl != 0.f)
		{
			URadialFalloff* Fall = NewObject<URadialFalloff>(C);
			Fall->SetRadialFalloff(1.f, 0.2f, 1.f, 0.f, Radius, Target, EFieldFalloffType::Field_Falloff_Linear);
			URotatedRadialVector* Turn = NewObject<URotatedRadialVector>(C);
			Turn->Magnitude = Swirl;
			Turn->Position = Target;
			Turn->Axis = FVector::UpVector;
			Turn->Angle = 90.f;
			UOperatorField* Product = NewObject<UOperatorField>(C);
			Product->SetOperatorField(1.f, Fall, Turn, EFieldOperationType::Field_Multiply);
			C->ApplyPhysicsField(true, EGeometryCollectionPhysicsTypeEnum::Chaos_LinearVelocity, nullptr, Product);
		}
	}
}
