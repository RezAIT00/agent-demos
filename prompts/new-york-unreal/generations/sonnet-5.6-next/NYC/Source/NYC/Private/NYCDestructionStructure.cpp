// Structural behaviour: support per floor, progressive collapse, toppling, shearing, falling mass hitting
// the neighbours, and the cheaper whole-building collapse used far from the camera.
#include "NYCDestruction.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "NYCDestructionFX.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "ProceduralMeshComponent.h"
#include "EngineUtils.h"

static const float Gravity = 981.f;

void ANYCDestruction::CheckStructure(int32 Index, const FVector& HitFrom)
{
	FNYCBuildingState& S = States[Index];
	if (!S.bActive || S.bFallen || S.NumFloors < 2) return;
	const FNYCBuildingInfo& B = Buildings[Index];
	const float Limit = B.bMasonry ? 0.58f : 0.62f;
	int32 Weak = INDEX_NONE;
	float WeakFraction = 1.f;
	for (int32 f = 0; f < FMath::Min(S.NumFloors - 1, S.CollapsingFrom); ++f)
	{
		if (S.Support0[f] < 1.f) continue;
		const float Fraction = FMath::Max(0.f, S.Support[f]) / S.Support0[f];
		if (Fraction < Limit) { Weak = f; WeakFraction = Fraction; break; }
	}
	if (Weak == INDEX_NONE) return;

	// where the support that is left sits tells which way the load goes
	FVector2D Centre(0, 0);
	float Sum = 0.f;
	for (int32 e : S.ByFloor[Weak])
	{
		const FNYCElement& E = S.Elements[e];
		if (!E.bAlive || E.Support <= 0.f) continue;
		const FVector C = E.Box.GetCenter();
		Centre += FVector2D(C.X, C.Y) * E.Support;
		Sum += E.Support;
	}
	const FVector2D Half = B.Rect.GetExtent();
	FVector2D Lean(0, 0);
	if (Sum > 0.01f) Lean = (S.Centre0[Weak] - Centre / Sum);
	const float Off = FMath::Abs(Lean.X) / FMath::Max(Half.X, 100.0) + FMath::Abs(Lean.Y) / FMath::Max(Half.Y, 100.0);
	const double UpperHeight = B.Height - Weak * S.FloorH;
	const double Slender = UpperHeight / FMath::Max(1.0, 2.0 * Half.GetMin());
	int32 Mode = 1;
	FVector Toward(Lean.X, Lean.Y, 0);
	if (Toward.IsNearlyZero()) Toward = (FVector(B.Rect.GetCenter().X, B.Rect.GetCenter().Y, 0) - HitFrom).GetSafeNormal2D();
	Toward = Toward.GetSafeNormal2D();
	if (Off > 0.16f && Slender > 1.2) Mode = 2;
	else if (!B.bMasonry && Weak > S.NumFloors / 3 && Off > 0.08f) Mode = 3;
	else if (WeakFraction < 0.12f && Weak > 2 && Off > 0.1f) Mode = 3;
	CollapseBuilding(Index, Weak, Mode, Toward, 0.35f + Rand.FRandRange(0.f, 0.5f));
}

void ANYCDestruction::CollapseBuilding(int32 Index, int32 FromFloor, int32 Mode, const FVector& TowardIn, float Delay)
{
	const FNYCSlowStep Slow_(TEXT("CollapseBuilding"));
	if (!Buildings.IsValidIndex(Index)) return;
	FNYCBuildingState& State = Activate(Index);
	if (State.bFallen || FromFloor >= State.CollapsingFrom) return;
	FromFloor = FMath::Clamp(FromFloor, 0, State.NumFloors - 1);
	State.CollapsingFrom = FromFloor;
	Stats.Collapses++;
	if (Mode == 0) Mode = 1;
	FVector Toward = TowardIn.GetSafeNormal2D();
	if (Toward.IsNearlyZero()) Toward = FVector(1, 0, 0);

	// groaning before it goes: dust jets from the failing floor
	const FNYCBuildingInfo& Info = Buildings[Index];
	const FVector Base(Info.Rect.GetCenter().X, Info.Rect.GetCenter().Y, FromFloor * State.FloorH + State.FloorH * 0.5);
	FX()->DustBurst(Base, FMath::Max(200.0, Info.Rect.GetExtent().GetMax() * 0.7), 0.6f, Info.Wall);
	Shake(Base, 6.f, Delay + 1.5f);

	After(Delay, [this, Index, FromFloor, Mode, Toward]()
	{
		ReleaseAnchors(Index);
		FNYCBuildingState& S = States[Index];
		const FNYCBuildingInfo& B = Buildings[Index];
		const float FH = S.FloorH;
		const FVector Centre(B.Rect.GetCenter().X, B.Rect.GetCenter().Y, 0);
		const FVector2D Half = B.Rect.GetExtent();
		const double Upper = FMath::Max(FH * 1.0, B.Height - FromFloor * FH);
		EnsureGround();
		UpdateColliders(Centre, 12000.f + B.Height);
		SetBuildingCollider(Index);

		// collects every standing element of a range of floors into one batch, merging pieces when there are very many
		auto Gather = [&](int32 F0, int32 F1, FNYCBatch& Batch, int32 MaxPieces, TFunctionRef<void(const FNYCElement&, int32& /*Group*/, bool& /*Crumble*/, FVector& /*Velocity*/)> Plan, TMap<int64, int32>& GroupOf)
		{
			int32 Count = 0;
			for (int32 f = F0; f <= F1; ++f)
				for (int32 e : S.ByFloor[f])
					if (S.Elements[e].bAlive) ++Count;
			if (Count == 0) return;
			const int32 LOD = Count < 36 ? 0 : Count < 150 ? 1 : 2;
			for (int32 f = F0; f <= F1; ++f)
			{
				for (int32 e : S.ByFloor[f])
				{
					const FNYCElement& E = S.Elements[e];
					if (!E.bAlive) continue;
					// furniture is not worth simulating in a falling tower
					if (E.Type == ENYCElement::Fitout && Count > 220) { HideElement(S, S.Elements[e]); continue; }
					int32 Group = 0;
					bool bCrumble = false;
					FVector V = FVector::ZeroVector;
					Plan(E, Group, bCrumble, V);
					BreakElement(Index, e, Batch, Group, LOD, V, bCrumble);
				}
			}
			if (Batch.Pieces.Num() > MaxPieces)
			{
				// fuse neighbouring pieces of the same cluster into bigger lumps
				const double Cell = 420.0 * FMath::Pow((double)Batch.Pieces.Num() / MaxPieces, 0.4);
				TMap<FString, int32> Slot;
				TArray<FNYCPiece> Fused;
				for (FNYCPiece& P : Batch.Pieces)
				{
					const FVector3f C = P.Geo.Bounds().GetCenter();
					const FString Key = FString::Printf(TEXT("%d_%d_%d_%d_%d"), P.Group, FMath::FloorToInt32(C.X / Cell), FMath::FloorToInt32(C.Y / Cell), FMath::FloorToInt32(C.Z / (Cell * 0.8)), P.Stuff == ENYCStuff::Glass ? 1 : 0);
					if (const int32* Found = Slot.Find(Key)) Fused[*Found].Geo.Append(P.Geo);
					else Slot.Add(Key, Fused.Add(MoveTemp(P)));
				}
				Batch.Pieces = MoveTemp(Fused);
			}
		};

		if (Mode == 1 || Mode == 4)
		{
			// ---- pancake (4: thrown outward as well)
			const bool bBurst = Mode == 4;
			{
				FNYCBatch Batch;
				Batch.Building = Index;
				TMap<int64, int32> GroupOf;
				Gather(FromFloor, FromFloor, Batch, 420, [&](const FNYCElement& E, int32& Group, bool& bCrumble, FVector& V)
				{
					const FVector Out = (E.Box.GetCenter() - Centre).GetSafeNormal2D();
					V = Out * (bBurst ? 1700.0 : 420.0) + FVector(0, 0, bBurst ? 300.0 : -80.0);
					Group = Batch.NewGroup(V, true);
					bCrumble = true;
				}, GroupOf);
				SpawnBatch(Batch, Centre + FVector(0, 0, FromFloor * FH), 300.f, 2000.f);
			}
			if (FromFloor + 1 < S.NumFloors)
			{
				FNYCBatch Batch;
				Batch.Building = Index;
				TMap<int64, int32> GroupOf;
				// each floor (or pair of floors) of the block above falls as a cluster and breaks when it lands
				const int32 Band = FMath::Max(1, (S.NumFloors - FromFloor) / 22);
				Gather(FromFloor + 1, S.NumFloors - 1, Batch, 1500, [&](const FNYCElement& E, int32& Group, bool& bCrumble, FVector& V)
				{
					const FVector C = E.Box.GetCenter();
					const int32 Level = (E.Floor - FromFloor - 1) / Band;
					const int32 Quadrant = (C.X > Centre.X ? 1 : 0) + (C.Y > Centre.Y ? 2 : 0);
					const int64 Key = Level * 4 + Quadrant;
					V = FVector(0, 0, -120.0 - 14.0 * Level);
					if (bBurst) V += (C - Centre).GetSafeNormal2D() * 1500.0 + FVector(0, 0, 500.0);
					if (const int32* Found = GroupOf.Find(Key)) Group = *Found;
					else
					{
						Group = Batch.NewGroup(V, bBurst, FVector((Quadrant & 2) ? 0.09 : -0.09, (Quadrant & 1) ? -0.09 : 0.09, 0));
						GroupOf.Add(Key, Group);
					}
					bCrumble = bBurst;
				}, GroupOf);
				SpawnBatch(Batch, Centre + FVector(0, 0, FromFloor * FH), bBurst ? 900.f : 120.f, 3000.f);
			}
			// the floors below give way one after another as the weight arrives
			const int32 Step = FMath::Max(1, FromFloor / 12);
			int32 Count = 0;
			double Last = 0.3;
			for (int32 Top = FromFloor - 1; Top >= 0; Top -= Step)
			{
				++Count;
				const double At = FMath::Sqrt(2.0 * Count * Step * FH / (0.62 * Gravity)) + 0.12;
				const int32 Low = FMath::Max(0, Top - Step + 1);
				Last = At;
				After(At, [this, Index, Low, Top, bBurst]()
				{
					FNYCBuildingState& S2 = States[Index];
					const FNYCBuildingInfo& B2 = Buildings[Index];
					const FVector C2(B2.Rect.GetCenter().X, B2.Rect.GetCenter().Y, 0);
					S2.CollapsingFrom = Low;
					SetBuildingCollider(Index);
					FNYCBatch Batch;
					Batch.Building = Index;
					int32 N = 0;
					for (int32 f = Low; f <= Top; ++f) for (int32 e : S2.ByFloor[f]) if (S2.Elements[e].bAlive) ++N;
					const int32 LOD = N < 36 ? 0 : N < 110 ? 1 : 2;
					for (int32 f = Low; f <= Top; ++f)
					{
						for (int32 e : S2.ByFloor[f])
						{
							FNYCElement& E = S2.Elements[e];
							if (!E.bAlive) continue;
							if (E.Type == ENYCElement::Fitout && N > 90) { HideElement(S2, E); continue; }
							const FVector Out = (E.Box.GetCenter() - C2).GetSafeNormal2D();
							const FVector V = Out * Rand.FRandRange(180.f, bBurst ? 1500.f : 620.f) + FVector(0, 0, Rand.FRandRange(-500.f, 80.f));
							const bool bCrumble = Rand.GetFraction() < 0.5f;
							const int32 G = Batch.NewGroup(V, bCrumble);
							BreakElement(Index, e, Batch, G, LOD, V, bCrumble);
						}
					}
					const FVector At3(C2.X, C2.Y, Low * S2.FloorH);
					SpawnBatch(Batch, At3, 380.f, 2000.f);
					FX()->DustBurst(At3, FMath::Max(300.0, B2.Rect.GetExtent().GetMax() * 1.25), 1.0f, B2.Wall);
					Shake(At3, 9.f, 0.9f);
				});
			}
			const double Crash = FMath::Max(Last, FMath::Sqrt(2.0 * FMath::Max(FromFloor, 1) * FH / (0.7 * Gravity))) + 0.35;
			After(Crash, [this, Index]()
			{
				const FNYCBuildingInfo& B2 = Buildings[Index];
				const FVector C2(B2.Rect.GetCenter().X, B2.Rect.GetCenter().Y, 0);
				States[Index].bFallen = true;
				SetBuildingCollider(Index);
				FX()->DustSurge(FBox(FVector(B2.Rect.Min, 0), FVector(B2.Rect.Max, B2.Height * 0.3)), B2.Height, B2.Wall);
				FX()->RubbleSmoke(C2, B2.Rect.GetExtent().GetMax(), 40.f);
				Shake(C2, FMath::Min(45.f, 8.f + (float)B2.Height / 600.f), 3.0f);
				// what was thrown outward strikes whatever stands close by
				const float Reach = 500.f + B2.Height * 0.16f;
				TArray<int32> Near;
				BuildingsNear(FVector(C2.X, C2.Y, 400.0), B2.Rect.GetExtent().Size() + Reach, Near);
				int32 Hits = 0;
				for (int32 Other : Near)
				{
					if (Other == Index || States[Other].bFallen || Hits >= 4) continue;
					const FBox& O = Buildings[Other].Box;
					const FVector P = O.GetClosestPointTo(FVector(C2.X, C2.Y, 500.0));
					const double Gap = FVector::Dist2D(P, FVector(FMath::Clamp(P.X, B2.Rect.Min.X, B2.Rect.Max.X), FMath::Clamp(P.Y, B2.Rect.Min.Y, B2.Rect.Max.Y), 0));
					if (Gap > Reach) continue;
					++Hits;
					FNYCDamage D;
					D.Center = P + FVector(0, 0, Rand.FRandRange(-200.f, 500.f));
					D.Radius = FMath::Clamp(180.f + B2.Height * 0.045f, 220.f, 850.f);
					D.GlassRadius = D.Radius * 2.4f;
					D.Speed = 650.f;
					D.Push = (P - C2).GetSafeNormal2D() * 350.0;
					D.MaxElements = 140;
					D.Dust = 0.8f;
					D.PropRadius = D.Radius;
					ApplyDamage(D);
				}
			});
			return;
		}

		// ---- topple (2) and shear (3): the block above goes as one mass, then breaks where it lands
		const bool bShear = Mode == 3;
		const bool bLaunch = Mode == 5;
		const double HalfAlong = FMath::Abs(Toward.X) * Half.X + FMath::Abs(Toward.Y) * Half.Y;
		const FVector Hinge = Centre + Toward * HalfAlong + FVector(0, 0, FromFloor * FH);
		const FVector Axis = FVector::CrossProduct(FVector::UpVector, Toward).GetSafeNormal();
		{
			FNYCBatch Batch;
			Batch.Building = Index;
			TMap<int64, int32> GroupOf;
			Gather(FromFloor, FromFloor, Batch, 380, [&](const FNYCElement& E, int32& Group, bool& bCrumble, FVector& V)
			{
				V = Toward * 500.0 + (E.Box.GetCenter() - Centre).GetSafeNormal2D() * 250.0;
				Group = Batch.NewGroup(V, true);
				bCrumble = true;
			}, GroupOf);
			SpawnBatch(Batch, Centre + FVector(0, 0, FromFloor * FH), 300.f, 2000.f);
		}
		S.CollapsingFrom = FromFloor;
		SetBuildingCollider(Index);
		// time for the mass to swing through most of a quarter turn
		const double Length = FMath::Max(600.0, Upper);
		const double Fall = bShear ? 1.35 : bLaunch ? 2.6 : FMath::Clamp(1.55 * FMath::Sqrt(Length / Gravity) + 0.7, 1.4, 6.5);
		if (FromFloor + 1 < S.NumFloors)
		{
			FNYCBatch Batch;
			Batch.Building = Index;
			TMap<int64, int32> GroupOf;
			const int32 Band = FMath::Max(1, (S.NumFloors - FromFloor) / 20);
			Gather(FromFloor + 1, S.NumFloors - 1, Batch, 1300, [&](const FNYCElement& E, int32& Group, bool& bCrumble, FVector& V)
			{
				const int32 Level = (E.Floor - FromFloor - 1) / Band;
				if (const int32* Found = GroupOf.Find(Level)) Group = *Found;
				else
				{
					Group = Batch.NewGroup(FVector::ZeroVector, false);
					GroupOf.Add(Level, Group);
				}
				bCrumble = false;
			}, GroupOf);
			if (Batch.GroupVelocity.Num() > 0)
			{
				if (bLaunch)
				{
					Batch.GroupVelocity[0] = Toward * 520.0 + FVector(0, 0, 2400.0);
					Batch.GroupSpin[0] = Axis * 0.55;
				}
				else if (bShear)
				{
					Batch.GroupVelocity[0] = Toward * 560.0 + FVector(0, 0, -360.0);
					Batch.GroupSpin[0] = Axis * 0.12;
				}
				else
				{
					const double Omega = FMath::Clamp(0.42 * FMath::Sqrt(Gravity / Length), 0.16, 0.7);
					const FVector Mid = Centre + FVector(0, 0, FromFloor * FH + Upper * 0.45);
					Batch.GroupSpin[0] = Axis * Omega;
					Batch.GroupVelocity[0] = FVector::CrossProduct(Axis * Omega, Mid - Hinge) + Toward * 90.0;
				}
			}
			SpawnBatch(Batch, Hinge, bShear ? 300.f : 420.f, 3000.f, (float)Fall);
		}
		for (int32 k = 1; k <= 3; ++k)
		{
			After(Fall * k / 4.0, [this, Index, Hinge, Toward]()
			{
				FX()->DustBurst(Hinge - Toward * 200.0, FMath::Max(260.0, Buildings[Index].Rect.GetExtent().GetMin() * 0.9), 0.7f, Buildings[Index].Wall);
			});
		}
		After(Fall, [this, Index, Hinge, Toward, Upper, FromFloor, bShear]()
		{
			const FNYCBuildingInfo& B2 = Buildings[Index];
			const double Reach = bShear ? FMath::Min(Upper, 2500.0) : Upper;
			const FVector Far = FVector(Hinge.X, Hinge.Y, 0) + Toward * Reach;
			FBox Foot(ForceInit);
			Foot += FVector(Hinge.X, Hinge.Y, 0);
			Foot += Far;
			Foot = Foot.ExpandBy(FVector(B2.Rect.GetExtent().GetMin(), B2.Rect.GetExtent().GetMin(), 0));
			FX()->DustSurge(Foot, FMath::Max(1500.0, Upper * 0.7), B2.Wall);
			FX()->RubbleSmoke(FMath::Lerp(FVector(Hinge.X, Hinge.Y, 0), Far, 0.55), 900.f, 35.f);
			Shake(Far, FMath::Min(40.f, 8.f + (float)Upper / 500.f), 2.6f);
			if (FromFloor == 0) States[Index].bFallen = true;
			// the falling mass hits the street and whatever it reaches
			for (int32 k = 1; k <= 4; ++k)
			{
				const FVector P = FVector(Hinge.X, Hinge.Y, 0) + Toward * (Reach * k / 4.0);
				FNYCDamage D;
				D.Center = P + FVector(0, 0, 260.0 + (bShear ? Hinge.Z * 0.5 : 0.0));
				D.Radius = FMath::Clamp(320.0 + Upper * 0.05, 320.0, 900.0);
				D.GlassRadius = D.Radius * 2.2f;
				D.Speed = 800.f;
				D.Push = Toward * 600.0;
				D.UpKick = 250.f;
				D.MaxElements = 130;
				D.Dust = 0.9f;
				D.bCrater = k == 3;
				D.CraterRadius = 350.f;
				After(0.09f * k, [this, D]() { ApplyDamage(D); });
			}
		});
	});
}

// ------------------------------------------------------------------ distant buildings
void ANYCDestruction::FellBuilding(int32 Index, const FVector& Away, float Delay, float Severity)
{
	if (!Buildings.IsValidIndex(Index) || States[Index].bFallen || States[Index].bActive) return;
	ReleaseAnchors(Index);
	States[Index].bFallen = true;
	Stats.Buildings++;
	Stats.Collapses++;
	FFelled F;
	F.Building = Index;
	F.From = Clock + Delay;
	F.Duration = 1.6f + (float)Buildings[Index].Height / 5200.f;
	F.Away = Away.GetSafeNormal2D();
	F.Severity = FMath::Clamp(Severity, 0.f, 1.f);
	F.bDone = false;
	for (const FIntPoint& Ref : Buildings[Index].Refs)
	{
		UInstancedStaticMeshComponent* C = City->LayoutGroups.IsValidIndex(Ref.X) ? City->LayoutGroups[Ref.X] : nullptr;
		if (!C) continue;
		F.Parts.Add({ C, Ref.Y });
	}
	for (const FString& Shell : Buildings[Index].Shells)
	{
		if (UInstancedStaticMeshComponent* C = ShellGroup(Shell)) F.Parts.Add({ C, 0 });
	}
	for (const TPair<UInstancedStaticMeshComponent*, int32>& P : F.Parts)
	{
		FTransform Xf;
		P.Key->GetInstanceTransform(P.Value, Xf, true);
		F.Start.Add(Xf);
		if (!Hidden.Contains(P)) Hidden.Add(P, Xf);
		Stats.Elements++;
	}
	Felling.Add(MoveTemp(F));
}

void ANYCDestruction::TickFelled()
{
	const FNYCSlowStep Slow_(TEXT("TickFelled"));
	// played live, a crowd of falling blocks moves on alternate steps
	++FellStep;
	const int32 Turns = IsLive() && Felling.Num() > 24 ? 4 : 1;
	int32 Which = 0;
	for (FFelled& F : Felling)
	{
		++Which;
		if (F.bDone || Clock < F.From) continue;
		if (Turns > 1 && (Which + FellStep) % Turns != 0 && Clock < F.From + F.Duration) continue;
		const FNYCBuildingInfo& B = Buildings[F.Building];
		const double U = FMath::Clamp((Clock - F.From) / F.Duration, 0.0, 1.0);
		const double Ease = U * U * (0.65 + 0.35 * U);
		const FVector Centre(B.Rect.GetCenter().X, B.Rect.GetCenter().Y, 0);
		const FVector2D Half = B.Rect.GetExtent();
		const FVector Pivot = Centre + F.Away * (FMath::Abs(F.Away.X) * Half.X + FMath::Abs(F.Away.Y) * Half.Y);
		const FVector Axis = FVector::CrossProduct(FVector::UpVector, F.Away).GetSafeNormal();
		const FQuat Tilt(Axis, FMath::DegreesToRadians(Ease * FMath::Lerp(14.0, 77.0, (double)F.Severity)));
		const double Squash = FMath::Lerp(1.0, FMath::Lerp(0.66, 0.26, (double)F.Severity), Ease);
		const bool bEnd = U >= 1.0;
		for (int32 i = 0; i < F.Parts.Num(); ++i)
		{
			UInstancedStaticMeshComponent* C = F.Parts[i].Key;
			if (!IsValid(C)) continue;
			const FTransform& X0 = F.Start[i];
			FVector Rel = X0.GetLocation() - Pivot;
			Rel.Z *= Squash;
			FTransform Xf;
			{
				// it stays where it ends up: laid over and crushed, pointing away from the blow
				// upper parts lag and scatter a little so the mass does not move as one solid
				const double Jitter = Ease * Ease * 90.0;
				const double H = FMath::Frac(i * 0.61803398875);
				const double K = FMath::Frac(i * 0.7548776662);
				Xf.SetLocation(Pivot + Tilt.RotateVector(Rel) + FVector((H - 0.5) * Jitter, (K - 0.5) * Jitter, 0));
				const FQuat Wobble(FVector(H - 0.5, K - 0.5, 0.2).GetSafeNormal(), Ease * Ease * (H - 0.5) * 0.35);
				Xf.SetRotation(Wobble * Tilt * X0.GetRotation());
				FVector Scale = X0.GetScale3D();
				Scale.Z *= FMath::Max(0.25, Squash);
				Xf.SetScale3D(Scale);
			}
			C->UpdateInstanceTransform(F.Parts[i].Value, Xf, true, false, true);
			Dirty.Add(C);
		}
		const FVector Foot(Centre.X, Centre.Y, 150.0);
		if (U > 0.05 && U < 0.9 && FMath::Fmod(Clock - F.From, 0.55) < 1.0 / 24.0)
		{
			FX()->DustBurst(Foot + F.Away * Half.GetMax() * U, FMath::Max(500.0, Half.GetMax() * 1.2), 0.75f, B.Wall);
		}
		if (bEnd)
		{
			F.bDone = true;
			FX()->DustSurge(FBox(FVector(B.Rect.Min, 0), FVector(B.Rect.Max, B.Height * 0.25)), B.Height, B.Wall);
			FX()->RubbleMound(Foot, B.Rect.GetExtent(), FMath::Min(B.Height * 0.16f, 1800.f), B.Wall);
		}
	}
}

void ANYCDestruction::CollectRoofClutter(const FBox& Box, TArray<TPair<UInstancedStaticMeshComponent*, TPair<int32, FTransform>>>& Out)
{
	const double Cell = 3000.0;
	auto KeyOf = [Cell](double X, double Y) { return FIntPoint(FMath::FloorToInt32(X / Cell), FMath::FloorToInt32(Y / Cell)); };
	if (!bRoofIndexed)
	{
		bRoofIndexed = true;
		RoofClutter.Reset();
		for (UInstancedStaticMeshComponent* C : City->LayoutGroups)
		{
			if (!C || !C->GetStaticMesh() || C->GetStaticMesh()->GetName() != TEXT("farroof")) continue;
			for (int32 n = 0; n < C->GetInstanceCount(); ++n)
			{
				FTransform Xf;
				if (C->GetInstanceTransform(n, Xf, true)) RoofClutter.FindOrAdd(KeyOf(Xf.GetLocation().X, Xf.GetLocation().Y)).Add({ C, n });
			}
		}
	}
	const FIntPoint Lo = KeyOf(Box.Min.X, Box.Min.Y), Hi = KeyOf(Box.Max.X, Box.Max.Y);
	for (int32 x = Lo.X; x <= Hi.X; ++x)
	{
		for (int32 y = Lo.Y; y <= Hi.Y; ++y)
		{
			const TArray<TPair<UInstancedStaticMeshComponent*, int32>>* List = RoofClutter.Find(FIntPoint(x, y));
			if (!List) continue;
			for (const TPair<UInstancedStaticMeshComponent*, int32>& Item : *List)
			{
				FTransform Xf;
				if (Hidden.Contains(Item) || !Item.Key->GetInstanceTransform(Item.Value, Xf, true)) continue;
				const FVector P = Xf.GetLocation();
				if (P.X < Box.Min.X || P.X > Box.Max.X || P.Y < Box.Min.Y || P.Y > Box.Max.Y || P.Z < Box.Max.Z - 400.0 || P.Z > Box.Max.Z + 400.0) continue;
				Hidden.Add(Item, Xf);
				Out.Add(TPair<UInstancedStaticMeshComponent*, TPair<int32, FTransform>>(Item.Key, TPair<int32, FTransform>(Item.Value, Xf)));
			}
		}
	}
}

void ANYCDestruction::Shockwave(const FVector& Centre, float Inner, float Outer, float FrontSpeed, float Strength, bool bFlattenCore)
{
	const FNYCSlowStep Slow_(TEXT("Shockwave"));
	if (!EnsureLoaded()) return;
	EnsureGround();
	TArray<int32> Near;
	BuildingsNear(Centre, Outer, Near);
	Near.Sort([&](int32 A, int32 B) { return Buildings[A].Box.ComputeSquaredDistanceToPoint(Centre) < Buildings[B].Box.ComputeSquaredDistanceToPoint(Centre); });
	int32 Detailed = 0, Damaged = 0;
	for (int32 b : Near)
	{
		const FNYCBuildingInfo& B = Buildings[b];
		const double Dist = FMath::Sqrt(B.Box.ComputeSquaredDistanceToPoint(Centre));
		if (States[b].bFallen || (Dist < Inner && !bFlattenCore)) continue;
		const float Severity = Strength * FMath::Clamp(1.f - (float)((Dist - Inner) / FMath::Max(1.0, (double)(Outer - Inner))), 0.f, 1.f);
		const float At = (float)(Dist / FrontSpeed);
		const FVector Mid = B.Box.GetCenter();
		const FVector Away = (Mid - Centre).GetSafeNormal2D();
		// a building already broken open has to come down part by part
		if (States[b].bActive && Severity > 0.3f && Damaged < 14)
		{
			++Damaged;
			After(At + 0.05f * Damaged, [this, b, Away, Severity]()
			{
				if (!States[b].bFallen) CollapseBuilding(b, 0, Severity > 0.8f ? 4 : 1, Away, 0.05f);
			});
		}
		else if (Severity > 0.45f && Detailed < 8 && Dist < 22000.0 && Dist >= Inner)
		{
			++Detailed;
			const int32 Mode = Severity > 0.8f ? 4 : 2;
			After(At, [this, b, Centre, Away, Severity, Mode]()
			{
				if (States[b].bFallen) return;
				FNYCDamage D;
				D.Center = Buildings[b].Box.GetClosestPointTo(Centre);
				D.Radius = 350.f + 500.f * Severity;
				D.GlassRadius = D.Radius * 1.6f;
				D.Speed = 1500.f * Severity;
				D.Push = Away * 1400.0 * Severity;
				D.MaxElements = 90;
				D.bStructural = false;
				D.PropRadius = 0.f;
				ApplyDamage(D);
				CollapseBuilding(b, 1, Mode, Away, 0.1f);
			});
		}
		else if (Severity > 0.16f)
		{
			FellBuilding(b, Away, At, Severity);
		}
		else if (Severity > 0.03f)
		{
			After(At, [this, b, Centre]()
			{
				if (!States[b].bFallen) ShatterGlass(Buildings[b].Box.GetClosestPointTo(Centre), 900.f, 900.f, 40);
			});
		}
	}
	// distant massing goes the same way
	for (int32 i = 0; i < FarBoxes.Num(); ++i)
	{
		FFar& F = FarBoxes[i];
		if (!F.bAlive) continue;
		const double Dist = FMath::Sqrt(F.Box.ComputeSquaredDistanceToPoint(Centre));
		if (Dist < Inner || Dist > Outer) continue;
		const float Severity = Strength * FMath::Clamp(1.f - (float)((Dist - Inner) / FMath::Max(1.0, (double)(Outer - Inner))), 0.f, 1.f);
		if (Severity < 0.22f) continue;
		F.bAlive = false;
		UInstancedStaticMeshComponent* C = City->LayoutGroups.IsValidIndex(F.Group) ? City->LayoutGroups[F.Group] : nullptr;
		if (!C) continue;
		const float At = (float)(Dist / FrontSpeed);
		const FVector Away = (F.Box.GetCenter() - Centre).GetSafeNormal2D();
		FTransform X0;
		C->GetInstanceTransform(F.Index, X0, true);
		const TPair<UInstancedStaticMeshComponent*, int32> Key(C, F.Index);
		if (!Hidden.Contains(Key)) Hidden.Add(Key, X0);
		const int32 Idx = F.Index;
		const float Dur = 1.5f + 0.5f * Severity;
		// it goes over about the foot of its far side, like a tree in a gale; each a little differently
		const FVector Mid = F.Box.GetCenter(), Half = F.Box.GetExtent();
		const FVector Pivot = FVector(Mid.X, Mid.Y, F.Box.Min.Z) + Away * (FMath::Abs(Away.X) * Half.X + FMath::Abs(Away.Y) * Half.Y);
		const float Lean = FMath::Lerp(12.f, 79.f, FMath::Clamp(Severity * 1.15f, 0.f, 1.f)) * (0.8f + 0.2f * FMath::Frac(i * 0.61803398875f));
		const float Twist = (FMath::Frac(i * 0.7548776662f) - 0.5f) * 26.f * Severity;
		const double Short = FMath::Lerp(0.82, 0.42, (double)FMath::Min(Severity, 1.f)) * (0.75 + 0.5 * FMath::Frac(i * 0.5698402909));
		// the roof clutter of this box goes with it
		TArray<TPair<UInstancedStaticMeshComponent*, TPair<int32, FTransform>>> Riders;
		CollectRoofClutter(F.Box, Riders);
		After(At, [this, C, Idx, X0, Away, Severity, Dur, Pivot, Lean, Twist, Short, Riders]()
		{
			During(Dur, [this, C, Idx, X0, Away, Severity, Dur, Pivot, Lean, Twist, Short, Riders](float T, float)
			{
				if (!IsValid(C)) return;
				const float U = FMath::Clamp(T / Dur, 0.f, 1.f);
				const float Ease = U * U;
				const FVector Axis = FVector::CrossProduct(FVector::UpVector, Away).GetSafeNormal();
				const FQuat Tilt = FQuat(FVector::UpVector, FMath::DegreesToRadians(Twist * Ease)) * FQuat(Axis, FMath::DegreesToRadians(Ease * Lean));
				FVector Rel = X0.GetLocation() - Pivot;
				const double Shrink = FMath::Lerp(1.0, Short, (double)Ease);
				Rel.Z *= Shrink;
				FVector Scale = X0.GetScale3D();
				Scale.Z *= Shrink;
				C->UpdateInstanceTransform(Idx, FTransform(Tilt * X0.GetRotation(), Pivot + Tilt.RotateVector(Rel) + Away * 350.0 * Ease * Severity, Scale), true, false, true);
				Dirty.Add(C);
				for (const TPair<UInstancedStaticMeshComponent*, TPair<int32, FTransform>>& Rider : Riders)
				{
					if (!IsValid(Rider.Key)) continue;
					const FTransform& R0 = Rider.Value.Value;
					FVector Up = R0.GetLocation() - Pivot;
					Up.Z *= Shrink;
					// small plant on the roof is lost in the wreckage once the box is well over
					const FVector Size = R0.GetScale3D() * FMath::Max(0.001, 1.0 - 1.35 * Ease * Severity);
					Rider.Key->UpdateInstanceTransform(Rider.Value.Key, FTransform(Tilt * R0.GetRotation(), Pivot + Tilt.RotateVector(Up) + Away * 350.0 * Ease * Severity, Size), true, false, true);
					Dirty.Add(Rider.Key);
				}
			});
		});
		Stats.Elements++;
	}
	// street furniture, trees and cars go over as the front reaches them
	const int32 Rings = 14;
	for (int32 k = 0; k < Rings; ++k)
	{
		const float R0 = FMath::Lerp(Inner, FMath::Min(Outer, 60000.f), (float)k / Rings);
		const float R1 = FMath::Lerp(Inner, FMath::Min(Outer, 60000.f), (float)(k + 1) / Rings);
		After(R1 / FrontSpeed, [this, Centre, R0, R1, Strength, Outer]()
		{
			const float Severity = Strength * FMath::Clamp(1.f - R0 / Outer, 0.f, 1.f);
			if (Severity < 0.06f) return;
			TArray<int32> List;
			CollectProps(Centre, R1, List);
			int32 Launched = 0;
			for (int32 p : List)
			{
				const FVector Pos = Props[p].Pos;
				if (FVector::Dist2D(Pos, Centre) < R0) continue;
				if (Rand.GetFraction() > Severity + 0.25f) continue;
				const FVector Out = (Pos - Centre).GetSafeNormal2D();
				LaunchProp(p, Out * 2600.0 * Severity + FVector(0, 0, 700.0 * Severity), FVector(Out.Y, -Out.X, 0.3) * 260.0, false, Severity > 0.75f && Rand.GetFraction() < 0.2f);
				if (++Launched > 40) break;
			}
			HitTraffic(Centre, R1, 2600.f * Severity, 0.6f, Severity > 0.6f, FVector::ZeroVector);
		});
	}
}
