// Tier 3: vehicles, plant and the demolition trade.
#include "NYCToolKit.h"

using namespace NYCT;

namespace
{
	const TArray<FVector> CarWheels(double HalfBase, double HalfTrack, double Radius)
	{
		return { FVector(HalfBase, HalfTrack, Radius), FVector(HalfBase, -HalfTrack, Radius), FVector(-HalfBase, HalfTrack, Radius), FVector(-HalfBase, -HalfTrack, Radius) };
	}

	/** Where a driven attack begins: back along the street from the target, on the ground. */
	FVector RunUp(const FNYCAim& A, double Distance, double Z = 0.0)
	{
		const FVector Out = Outward(A);
		const FVector Side = WallTangent(Out);
		const double Sign = FVector::DotProduct(Side, A.Origin - A.Point) >= 0 ? 1.0 : -1.0;
		return Ground(A.Point + (Out * 0.42 + Side * Sign * 0.9).GetSafeNormal() * Distance, Z);
	}

	/** A crane made of lattice sections: mast height and jib reach in metres of segments. */
	struct FCrane
	{
		TArray<TWeakObjectPtr<UStaticMeshComponent>> Mast, Jib;
	};

	TSharedRef<FCrane> BuildCrane(ANYCDestruction& D, const FVector& Foot, const FVector& JibDir, int32 MastParts, int32 JibParts, float Life)
	{
		TSharedRef<FCrane> C = MakeShared<FCrane>();
		for (int32 i = 0; i < MastParts; ++i) C->Mast.Add(Prop(D, TEXT("tl_cranemast"), Foot + FVector(0, 0, i * 400.0), FQuat::Identity, 1.f, Life));
		const FVector Top = Foot + FVector(0, 0, MastParts * 400.0);
		for (int32 i = -2; i < JibParts; ++i) C->Jib.Add(Prop(D, TEXT("tl_cranejib"), Top + JibDir * (i * 400.0), Facing(JibDir), 1.f, Life));
		return C;
	}
}

void NYCArsenal::RegisterMachines(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("rocket_cart"), TEXT("Rocket shopping cart"), 3, TEXT("Vehicle"), ENYCTarget::GroundFloor, 4.5f, 17.f, 4.f,
		TEXT("A shopping cart with boosters screams across the street, scatters everything and smashes into the shopfronts."), TEXT("Driven mesh with flame and spark trails; capsule sweeps knock over street objects; ends in a small burst and the cart tumbling as a rigid body."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FDriven V;
			V.Mesh = TEXT("tl_cart");
			V.From = RunUp(A, 2200.0, 0.0);
			V.To = Ground(A.Point + Outward(A) * 40.0, 0.0);
			V.Time = 2.0f;
			V.Ease = 2.4f;
			V.Radius = 90.f;
			V.Strike = 900.f;
			V.Lift = 70.f;
			V.PerHit = 1;
			V.bStructure = false;
			V.Engine = TEXT("rocket_burn");
			V.Step = [Dp](const FVector& P, float U)
			{
				Dp->FX()->Sparks(P + FVector(0, 0, 62), FVector(0, 0, 120), 5, FLinearColor(1.f, 0.55f, 0.15f), 90.f);
				if (FMath::Fmod(U * 40.f, 3.f) < 1.f) Dp->FX()->Fire(P + FVector(0, 0, 62), 24.f, 0.25f);
			};
			V.Arrive = [Dp](UStaticMeshComponent* C, const FVector& P, const FVector& Vel)
			{
				const FVector Hit = P + FVector(0, 0, 90);
				Dp->ShatterGlass(Hit, 430.f, 700.f, 7);
				Dp->SpawnBody(TEXT("cart"), C, FTransform(C->GetComponentQuat(), P + FVector(0, 0, 55)), FVector(55, 32, 48), 45.f, -Vel * 0.18 + FVector(0, 0, 520), FVector(320, 140, 90));
				Dp->FX()->Fireball(Hit, 85.f, 0.5f, 0.6f);
				Dp->FX()->Sparks(Hit, -Vel * 0.5, 140);
				Dp->FX()->Litter(Hit, -Vel * 0.3 + FVector(0, 0, 500), 130);
				Dp->FX()->Sound(TEXT("crash_small"), Hit, 1.f, 1.1f);
				Plough(*Dp, Hit - Vel.GetSafeNormal() * 120.0, Hit + Vel.GetSafeNormal() * 50.0, 95.f, 800.f, Vel * 0.25, 2);
				Dp->Shake(Hit, 5.f, 0.5f);
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("runaway_taxi"), TEXT("Runaway taxi"), 3, TEXT("Vehicle"), ENYCTarget::GroundFloor, 5.5f, 24.f, 6.f,
		TEXT("A yellow cab at full throttle ploughs into a storefront and crumples."), TEXT("The project's own cab with turning wheels; on impact its mesh is deformed (crumple field along the blow), the glass is removed and it becomes a rigid wreck, sometimes burning."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FDriven V;
			V.Mesh = TEXT("cab0");
			V.Wheel = TEXT("wheel_car");
			V.Wheels = CarWheels(146.0, 80.0, 34.0);
			V.From = RunUp(A, 5200.0);
			V.To = Ground(A.Point + Outward(A) * 130.0);
			V.Time = 3.0f;
			V.Ease = 2.0f;
			V.Radius = 150.f;
			V.Strike = 1300.f;
			V.bStructure = false;
			V.Paint = FLinearColor(0.84f, 0.47f, 0.004f);
			V.Engine = TEXT("engine_rev");
			V.Arrive = [Dp, A](UStaticMeshComponent* C, const FVector& P, const FVector& Vel)
			{
				const FTransform Xf(C->GetComponentQuat(), P);
				Dp->FX()->RemoveMesh(C);
				const FVector Fwd = Xf.GetUnitAxis(EAxis::X);
				const FVector Nose = P + Fwd * 250.0 + FVector(0, 0, 80);
				Dp->WreckVehicle(TEXT("parked_cab0"), Xf, FLinearColor(0.84f, 0.47f, 0.004f), -Fwd * 420.0 + FVector(0, 0, 240), FVector(30, -20, 70), Nose, 1.f, Dp->Random().GetFraction() < 0.5f);
				Plough(*Dp, Nose - Fwd * 60.0, Nose + Fwd * 180.0, 190.f, 900.f, Fwd * 900.0, 6);
				Dp->ShatterGlass(Nose, 520.f, 800.f, 10);
				Dp->FX()->DustBurst(Nose, 140.f, 0.8f, WallOf(*Dp, A.Building));
				Dp->FX()->Sparks(Nose, -Vel * 0.35 + FVector(0, 0, 300), 180);
				Dp->FX()->Sound(TEXT("crash_car"), Nose, 1.f, 1.f);
				Dp->Shake(Nose, 9.f, 0.7f);
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("garbage_truck"), TEXT("Runaway garbage truck"), 3, TEXT("Vehicle"), ENYCTarget::GroundFloor, 6.5f, 28.f, 7.f,
		TEXT("Twenty tonnes with no brakes: it crushes what is in the way and buries its cab in the building."), TEXT("A purpose-built truck model on a driven path with wide capsule damage; it stops embedded in the broken front, trailing rubbish."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FDriven V;
			V.Mesh = TEXT("tl_garbagetruck");
			V.From = RunUp(A, 5600.0);
			V.To = Ground(A.Point - Outward(A) * 120.0);
			V.Time = 3.6f;
			V.Ease = 1.7f;
			V.Radius = 235.f;
			V.Strike = 1100.f;
			V.Lift = 150.f;
			V.PerHit = 5;
			V.Engine = TEXT("engine_heavy");
			V.Step = [Dp](const FVector& P, float U)
			{
				if (FMath::Fmod(U * 30.f, 4.f) < 1.f) Dp->FX()->Litter(P + FVector(0, 0, 320), FVector(0, 0, 420), 30);
			};
			V.Arrive = [Dp, A](UStaticMeshComponent* C, const FVector& P, const FVector& Vel)
			{
				const FVector Hit = P + FVector(0, 0, 190) + Vel.GetSafeNormal2D() * 420.0;
				Plough(*Dp, P + FVector(0, 0, 170), Hit, 290.f, 900.f, Vel.GetSafeNormal() * 700.0, 14);
				Dp->FX()->DustBurst(Hit, 300.f, 1.1f, WallOf(*Dp, A.Building));
				Dp->FX()->Litter(Hit, FVector(0, 0, 800), 260);
				Dp->SpawnLumps(Hit, -Vel.GetSafeNormal() + FVector(0, 0, 0.4), 14, 42.f, WallOf(*Dp, A.Building), 600.f);
				Dp->FX()->SmokeColumn(P + FVector(0, 0, 220), 60.f, 8.f, 0.55f);
				Dp->FX()->Sound(TEXT("crash_heavy"), Hit, 1.f, 0.9f);
				Dp->Shake(Hit, 14.f, 1.0f);
				C->SetWorldRotation(C->GetComponentQuat() * FQuat(FRotator(-2.5, 0, 3.5)));
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("city_bus"), TEXT("Runaway city bus"), 3, TEXT("Vehicle"), ENYCTarget::GroundFloor, 6.5f, 32.f, 8.f,
		TEXT("Twelve metres of bus sweeps parked cars aside and rams deep into the ground floor."), TEXT("The project's bus with its wheels, driven on a long shallow line so it side-swipes the kerb lane; cars it meets are wrecked."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Out_ = Outward(A);
			const FVector Side = WallTangent(Out_);
			FDriven V;
			V.Mesh = TEXT("bus0");
			V.Wheel = TEXT("wheel_bus");
			V.Wheels = { FVector(415, 105, 50), FVector(415, -105, 50), FVector(-295, 105, 50), FVector(-295, -105, 50) };
			V.From = Ground(A.Point + Out_ * 900.0 + Side * 4800.0);
			V.To = Ground(A.Point - Out_ * 140.0 - Side * 180.0);
			V.Time = 3.8f;
			V.Ease = 1.5f;
			V.Radius = 250.f;
			V.Strike = 1250.f;
			V.Lift = 150.f;
			V.PerHit = 5;
			V.Paint = FLinearColor(0.62f, 0.64f, 0.66f);
			V.Engine = TEXT("engine_heavy");
			V.Step = [Dp](const FVector& P, float U)
			{
				if (U > 0.5f && FMath::Fmod(U * 50.f, 3.f) < 1.f) Dp->FX()->Sparks(P + FVector(0, 0, 40), FVector(0, 0, 360), 16);
			};
			V.Arrive = [Dp, A](UStaticMeshComponent* C, const FVector& P, const FVector& Vel)
			{
				const FVector Dir = Vel.GetSafeNormal2D();
				const FVector Hit = P + FVector(0, 0, 180) + Dir * 600.0;
				Plough(*Dp, P + FVector(0, 0, 170), Hit, 330.f, 1000.f, Dir * 800.0, 18);
				Dp->FX()->DustBurst(Hit, 340.f, 1.15f, WallOf(*Dp, A.Building));
				Dp->ShatterGlass(Hit, 900.f, 900.f, 24);
				Dp->FX()->Sound(TEXT("crash_heavy"), Hit, 1.f, 1.f);
				Dp->Shake(Hit, 15.f, 1.0f);
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("monster_truck"), TEXT("Monster truck leap"), 3, TEXT("Vehicle"), ENYCTarget::Car, 4.1f, 24.f, 6.f,
		TEXT("Vaults through the air and flattens the cars it lands on, twice."), TEXT("A giant-wheeled truck following two ballistic hops; each landing wrecks vehicles from directly above (roof crush) and slams street objects down."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 Car = D.FindProp(A.Point, ANYCDestruction::MCar, 2500.f);
			const FVector Target = Ground(Car != INDEX_NONE ? D.PropLocation(Car) : A.Point);
			const FVector Along = StreetAxis(A.Dir);
			auto Land = [Dp, Along](const FVector& P)
			{
				FNYCDamage H;
				H.Center = P + FVector(0, 0, 160);
				H.Radius = 0.f;
				H.GlassRadius = 0.f;
				H.PropRadius = 430.f;
				H.Speed = 700.f;
				H.UpKick = -200.f;
				H.PropForce = 0.9f;
				Dp->ApplyDamage(H);
				Dp->HitTraffic(P, 430.f, 200.f, 1.f, false, FVector(0, 0, -500));
				Dp->MakeCrater(P, 85.f, 14.f);
				Dp->FX()->DustBurst(P + FVector(0, 0, 50), 190.f, 0.8f, TEXT("asphalt"));
				Dp->FX()->Sparks(P + FVector(0, 0, 40), Along * 700.0 + FVector(0, 0, 400), 150);
				Dp->FX()->GlassBurst(P + FVector(0, 0, 110), FVector(0, 0, 500), FVector2D(300, 200));
				Dp->FX()->Sound(TEXT("crash_car"), P, 1.f, 0.8f);
				Dp->Shake(P, 12.f, 0.7f);
			};
			FDriven V;
			V.Mesh = TEXT("tl_monstertruck");
			V.From = Target - Along * 3400.0;
			V.To = Target + Along * 2100.0;
			V.Time = 4.4f;
			V.Ease = 1.0f;
			V.Radius = 190.f;
			V.Strike = 700.f;
			V.Lift = 140.f;
			V.bStructure = false;
			V.Engine = TEXT("engine_rev");
			V.Height = [](float U)
			{
				// run, jump, crush; jump again, crush
				auto Hop = [](float X, float From, float To, double H) { if (X < From || X > To) return 0.0; const double T = (X - From) / (To - From); return 4.0 * H * T * (1.0 - T); };
				return Hop(U, 0.34f, 0.62f, 620.0) + Hop(U, 0.66f, 0.86f, 330.0);
			};
			TSharedRef<int32> Landed = MakeShared<int32>(0);
			V.Step = [Land, Landed](const FVector& P, float U)
			{
				if ((*Landed == 0 && U >= 0.615f) || (*Landed == 1 && U >= 0.855f)) { ++*Landed; Land(Ground(P)); }
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("road_roller"), TEXT("Road roller"), 3, TEXT("Vehicle"), ENYCTarget::Car, 9.0f, 20.f, 6.f,
		TEXT("Grinds slowly down the kerb lane, pressing cars flat and crazing the pavement."), TEXT("A slow driven roller; every car under the drum is rebuilt with a downward crumple, street objects are pushed over and the road is cracked behind it."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 Car = D.FindProp(A.Point, ANYCDestruction::MCar, 2500.f);
			const FVector Target = Ground(Car != INDEX_NONE ? D.PropLocation(Car) : A.Point);
			const FVector Along = StreetAxis(A.Dir);
			FDriven V;
			V.Mesh = TEXT("tl_roadroller");
			V.From = Target - Along * 900.0;
			V.To = Target + Along * 1500.0;
			V.Time = 8.0f;
			V.Ease = 1.0f;
			V.Radius = 120.f;
			V.Strike = 120.f;
			V.Lift = 90.f;
			V.bStructure = false;
			V.Engine = TEXT("engine_heavy");
			TSharedRef<float> Mark = MakeShared<float>(0.f);
			V.Step = [Dp, Along, Mark](const FVector& P, float U)
			{
				if (U < *Mark) return;
				*Mark = U + 0.07f;
				const FVector Drum = P + Along * 230.0;
				Dp->HitTraffic(Drum, 260.f, 40.f, 1.f, false, FVector(0, 0, -300));
				const int32 Under = Dp->FindProp(Drum, ANYCDestruction::MCar, 270.f);
				if (Under != INDEX_NONE) Dp->LaunchProp(Under, FVector(0, 0, -1) * 2100.0, FVector::ZeroVector, false, false);
				Dp->MakeCrater(Ground(P - Along * 220.0), 46.f, 9.f);
				Dp->FX()->Chips(Drum + FVector(0, 0, 15), FVector(0, 0, 220), 24, FLinearColor(0.07f, 0.065f, 0.06f), 0.5f, 2.5f);
				Dp->FX()->Sound(TEXT("crunch"), Drum, 0.6f, Dp->Random().FRandRange(0.8f, 1.f));
				Dp->Shake(Drum, 2.5f, 0.4f);
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("bulldozer"), TEXT("Bulldozer"), 3, TEXT("Demolition machine"), ENYCTarget::GroundFloor, 9.0f, 22.f, 6.5f,
		TEXT("Pushes steadily into the ground floor, shoving the front and its contents inward."), TEXT("A slow driven dozer; repeated forward capsule damage at blade height with debris pushed ahead rather than thrown."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			FDriven V;
			V.Mesh = TEXT("tl_bulldozer");
			V.From = Ground(A.Point + N * 1100.0);
			V.To = Ground(A.Point - N * 420.0);
			V.Time = 7.5f;
			V.Ease = 1.0f;
			V.Radius = 210.f;
			V.Strike = 260.f;
			V.Lift = 150.f;
			V.PerHit = 3;
			V.Engine = TEXT("engine_heavy");
			TSharedRef<float> Mark = MakeShared<float>(0.f);
			V.Step = [Dp, A, N, Mark](const FVector& P, float U)
			{
				if (U < *Mark) return;
				*Mark = U + 0.09f;
				const FVector Blade = P - N * 300.0 + FVector(0, 0, 90);
				Dp->FX()->SmokeColumn(P + FVector(0, 0, 330), 22.f, 1.2f, 0.75f);
				if (FVector::DotProduct(Blade - A.Point, N) < 80.0)
				{
					Dp->FX()->DustBurst(Blade, 150.f, 0.65f, WallOf(*Dp, A.Building));
					Dp->SpawnLumps(Blade, -N + FVector(0, 0, 0.35), 5, 30.f, WallOf(*Dp, A.Building), 330.f);
					Dp->FX()->Sound(TEXT("crunch"), Blade, 0.85f, 0.75f);
					Dp->Shake(Blade, 4.f, 0.6f);
				}
			};
			Drive(D, V);
		}));

	Out.Add(Tool(TEXT("excavator"), TEXT("Excavator claw"), 3, TEXT("Demolition machine"), ENYCTarget::FacadeHigh, 9.5f, 30.f, 9.f,
		TEXT("Reaches up and tears bites out of the facade, one after another."), TEXT("A tracked machine with a two-part arm solved to each target; each bite fractures a few modules and drags the pieces back and down."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const FVector Base = Ground(A.Point + N * 1250.0);
			Prop(D, TEXT("tl_excavator"), Base, Facing(-N), 1.f, 11.f);
			const FVector Shoulder = Base + FVector(0, 0, 240) - N * 120.0;
			const double Reach = FMath::Max(FVector::Dist(Shoulder, A.Point) * 0.58, 700.0);
			UStaticMeshComponent* Upper = Prop(D, TEXT("tl_arm"), Shoulder, FQuat::Identity, 1.f, 11.f);
			UStaticMeshComponent* Fore = Prop(D, TEXT("tl_arm"), Shoulder, FQuat::Identity, 1.f, 11.f);
			UStaticMeshComponent* Claw = Prop(D, TEXT("tl_claw"), Shoulder, FQuat::Identity, 1.f, 11.f);
			TArray<FVector> Bites;
			for (int32 i = 0; i < 5; ++i)
				Bites.Add(A.Point + Side * ((i % 3 - 1) * 230.0) + FVector(0, 0, (i % 2) * 260.0 - 90.0 - i * 40.0));
			TWeakObjectPtr<UStaticMeshComponent> U1(Upper), U2(Fore), U3(Claw);
			auto Tip = [Shoulder, N, Bites](float T)
			{
				// in to the wall, close, drag back and down, return
				const int32 i = FMath::Clamp(FMath::FloorToInt32(T / 1.6f), 0, Bites.Num() - 1);
				const float U = FMath::Clamp(T / 1.6f - i, 0.f, 1.f);
				const FVector Rest = Shoulder - N * 380.0 + FVector(0, 0, 360);
				const FVector Pull = Bites[i] + N * 420.0 - FVector(0, 0, 300);
				if (U < 0.5f) return FMath::Lerp(i == 0 ? Rest : Bites[i - 1] + N * 420.0 - FVector(0, 0, 300), Bites[i], (double)FMath::SmoothStep(0.f, 1.f, U / 0.5f));
				return FMath::Lerp(Bites[i], Pull, (double)FMath::SmoothStep(0.f, 1.f, (U - 0.5f) / 0.5f));
			};
			D.FX()->Sound(TEXT("hydraulic"), Base, 0.9f, 1.f);
			D.During(8.4f, [Shoulder, Reach, Tip, U1, U2, U3](float T, float)
			{
				if (!U1.IsValid() || !U2.IsValid() || !U3.IsValid()) return;
				const FVector End = Tip(T);
				const FVector To = End - Shoulder;
				const double Dist = FMath::Clamp(To.Size(), 100.0, Reach * 1.98);
				const FVector Dir = To.GetSafeNormal();
				const FVector Up = FVector::CrossProduct(Dir, FVector::CrossProduct(FVector::UpVector, Dir)).GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);
				const double Lift = FMath::Sqrt(FMath::Max(Reach * Reach - Dist * Dist / 4.0, 0.0));
				const FVector Elbow = Shoulder + Dir * Dist * 0.5 + Up * Lift;
				U1->SetWorldTransform(FTransform(Facing(Elbow - Shoulder), Shoulder, FVector(FVector::Dist(Elbow, Shoulder) / 100.0, 1.25, 1.25)));
				U2->SetWorldTransform(FTransform(Facing(End - Elbow), Elbow, FVector(FVector::Dist(End, Elbow) / 100.0, 1.0, 1.0)));
				U3->SetWorldLocationAndRotation(End - (End - Elbow).GetSafeNormal() * 90.0, Facing(End - Elbow));
			});
			Repeat(D, 5, 1.6f, 0.8f, [Dp, Bites, N, A](int32 i)
			{
				const FVector P = Bites[i];
				FNYCDamage H;
				H.Center = P - N * 40.0;
				H.Radius = 125.f;
				H.GlassRadius = 300.f;
				H.Speed = 140.f;
				H.bRadial = false;
				H.Push = N * 430.0 + FVector(0, 0, -240);
				H.MaxElements = 4;
				H.ForceLOD = 0;
				H.PropRadius = 0.f;
				H.Dust = 0.65f;
				H.bFrame = i >= 2;
				Dp->ApplyDamage(H);
				Dp->FX()->Chips(P, N * 300.0, 90, ANYCDestructionFX::DustColour(WallOf(*Dp, A.Building)) * 0.6f, 1.f, 6.f);
				Dp->FX()->Sound(TEXT("crunch"), P, 0.9f, 1.f);
				Dp->Shake(P, 3.f, 0.4f);
			});
		}));

	Out.Add(Tool(TEXT("high_reach_shear"), TEXT("High-reach demolition shear"), 3, TEXT("Demolition machine"), ENYCTarget::Roof, 11.0f, 55.f, 26.f,
		TEXT("An enormous boom nibbles a building down from the parapet, floor by floor."), TEXT("A long articulated boom to the roof line; ten bites step across and down the top floors, removing structure so the upper corner is eaten away."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 B = A.Building;
			if (B == INDEX_NONE) D.NearestBuilding(A.Point, 4000.f, B);
			const FNYCBuildingInfo* I = D.Info(B);
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const double Top = I ? I->Height : A.Point.Z + 600.0;
			const FVector Edge = FVector(A.Point.X, A.Point.Y, Top - 160.0);
			const FVector Base = Ground(Edge + N * 2100.0);
			Prop(D, TEXT("tl_excavator"), Base, Facing(-N), 1.5f, 13.f);
			const FVector Shoulder = Base + FVector(0, 0, 360);
			UStaticMeshComponent* Boom = Prop(D, TEXT("tl_arm"), Shoulder, FQuat::Identity, 1.f, 13.f);
			UStaticMeshComponent* Shear = Prop(D, TEXT("tl_claw"), Shoulder, FQuat::Identity, 1.f, 13.f);
			TArray<FVector> Bites;
			for (int32 i = 0; i < 10; ++i) Bites.Add(Edge + Side * (((i % 4) - 1.5) * 240.0 * (i % 8 < 4 ? 1 : -1)) - FVector(0, 0, (i / 2) * 175.0) - N * 80.0);
			TWeakObjectPtr<UStaticMeshComponent> W1(Boom), W2(Shear);
			D.During(10.2f, [W1, W2, Shoulder, Bites, N](float T, float)
			{
				if (!W1.IsValid() || !W2.IsValid()) return;
				const float K = FMath::Clamp(T / 1.0f, 0.f, 9.999f);
				const int32 i = (int32)K;
				const FVector Target = FMath::Lerp(Bites[FMath::Max(i - 1, 0)], Bites[i], (double)FMath::SmoothStep(0.f, 0.7f, K - i)) + N * (FMath::Sin((K - i) * PI) < 0.6f ? 120.0 : 40.0);
				const FVector To = Target - Shoulder;
				W1->SetWorldTransform(FTransform(Facing(To), Shoulder, FVector((To.Size() - 110.0) / 100.0, 1.7, 1.7)));
				W2->SetWorldTransform(FTransform(Facing(To), Target - To.GetSafeNormal() * 130.0, FVector(1.5)));
			});
			D.FX()->Sound(TEXT("hydraulic"), Base, 0.9f, 0.8f);
			Repeat(D, 10, 1.0f, 0.75f, [Dp, Bites, N, B](int32 i)
			{
				const FVector P = Bites[i];
				FNYCDamage H;
				H.Center = P;
				H.Radius = 230.f;
				H.GlassRadius = 380.f;
				H.Speed = 160.f;
				H.bRadial = false;
				H.Push = N * 240.0 + FVector(0, 0, -300);
				H.MaxElements = 11;
				H.PropRadius = 0.f;
				H.Dust = 0.7f;
				H.bStructural = false;
				Dp->ApplyDamage(H);
				Dp->FX()->Sound(TEXT("crunch"), P, 1.f, 0.85f);
				// water spray to hold down the dust, as on a real demolition
				Dp->FX()->Splash(P + N * 160.0, 90.f, 0.6f);
			});
		}));

	Out.Add(Tool(TEXT("wrecking_ball"), TEXT("Crane and wrecking ball"), 3, TEXT("Demolition machine"), ENYCTarget::FacadeHigh, 10.0f, 48.f, 14.f,
		TEXT("A four-tonne ball swings into the wall three times."), TEXT("A lattice crane with a chain of links and a pendulum ball integrated each step; every strike pushes a large bite of facade and frame into the building."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const double Hang = 1700.0;
			// the pivot hangs just off the wall, so that straight down is a hand's width short of it
			const FVector Pivot = A.Point + N * 210.0 + FVector(0, 0, Hang);
			const FVector Foot = Ground(A.Point + N * 1500.0 + Side * 700.0);
			const int32 MastParts = FMath::Clamp(FMath::CeilToInt32(Pivot.Z / 400.0), 4, 40);
			const FVector JibTop(Foot.X, Foot.Y, MastParts * 400.0);
			const FVector JibDir = (FVector(Pivot.X, Pivot.Y, JibTop.Z) - JibTop).GetSafeNormal();
			BuildCrane(D, Foot, JibDir, MastParts, FMath::Clamp(FMath::CeilToInt32(FVector::Dist2D(Foot, Pivot) / 400.0), 3, 14), 13.f);
			UStaticMeshComponent* Ball = Prop(D, TEXT("tl_wreckingball"), Pivot - FVector(0, 0, Hang), FQuat::Identity, 1.f, 13.f);
			TArray<TWeakObjectPtr<UStaticMeshComponent>> Links;
			for (int32 i = 0; i < 26; ++i) Links.Add(Prop(D, TEXT("tl_chainlink"), Pivot, FQuat::Identity, 2.2f, 13.f));
			TWeakObjectPtr<UStaticMeshComponent> WB(Ball);
			const FVector HangFrom(Pivot.X, Pivot.Y, FMath::Max(JibTop.Z, Pivot.Z));
			const double L = HangFrom.Z - A.Point.Z;
			TSharedRef<FVector2D> State = MakeShared<FVector2D>(FVector2D(FMath::DegreesToRadians(52.0), 0.0));     // angle toward the street, rate
			TSharedRef<int32> Hits = MakeShared<int32>(0);
			D.During(11.5f, [Dp, WB, Links, HangFrom, L, N, Side, State, Hits, A](float T, float Dt)
			{
				if (!WB.IsValid()) return;
				double& Th = State->X;
				double& W = State->Y;
				if (T > 0.6f)
				{
					const double Acc = -981.0 / L * FMath::Sin(Th) * 1.35;
					W += Acc * Dt;
					Th += W * Dt;
				}
				// the wall is just past vertical
				if (Th < -0.035 && W < 0.0)
				{
					const double Speed = FMath::Abs(W) * L;
					const FVector P = HangFrom + FVector(0, 0, -L * FMath::Cos(Th)) + N * (L * FMath::Sin(Th));
					const int32 K = (*Hits)++;
					const FVector Where = P - N * 150.0 + Side * ((K == 1 ? 130.0 : K == 2 ? -140.0 : 0.0)) - FVector(0, 0, K * 90.0);
					FNYCDamage H;
					H.Center = Where + N * 60.0;
					H.End = Where - N * (140.0 + 110.0 * K);
					H.bCapsule = true;
					H.Radius = 235.f;
					H.GlassRadius = 650.f;
					H.Speed = 420.f;
					H.Push = -N * FMath::Max(500.0, Speed * 0.7);
					H.bRadial = true;
					H.MaxElements = 20;
					H.PropRadius = 0.f;
					H.Dust = 1.f;
					H.bRagged = true;
					Dp->ApplyDamage(H);
					Dp->FX()->DustBurst(Where + N * 120.0, 230.f, 0.9f, WallOf(*Dp, A.Building));
					Dp->SpawnLumps(Where + N * 60.0, N + FVector(0, 0, 0.2), 12, 34.f, WallOf(*Dp, A.Building), 520.f);
					Dp->FX()->Sound(TEXT("wrecking_hit"), Where, 1.f, 1.f - 0.06f * K);
					Dp->Shake(Where, 11.f, 0.7f);
					// rebound, then it is winched back for another go
					W = -W * 0.16 + 0.1;
					Th = -0.03;
					if (*Hits < 3) Dp->After(0.5f, [State]() { State->Y = 0.52; });
				}
				if (*Hits >= 3) W *= FMath::Max(0.0, 1.0 - Dt * 1.2);
				const FVector P = HangFrom + FVector(0, 0, -L * FMath::Cos(Th)) + N * (L * FMath::Sin(Th));
				const FVector Down = (P - HangFrom).GetSafeNormal();
				WB->SetWorldLocationAndRotation(P, FQuat::FindBetweenNormals(FVector(0, 0, -1), Down));
				const FQuat Q = FQuat::FindBetweenNormals(FVector::UpVector, -Down);
				for (int32 i = 0; i < Links.Num(); ++i)
				{
					if (Links[i].IsValid()) Links[i]->SetWorldLocationAndRotation(HangFrom + Down * ((i + 0.5) / Links.Num() * (L - 140.0)), Q * FQuat(FVector::UpVector, (i % 2) * HALF_PI));
				}
			});
		}));

	Out.Add(Tool(TEXT("pile_driver"), TEXT("Pile driver"), 3, TEXT("Demolition machine"), ENYCTarget::Street, 8.0f, 30.f, 9.f,
		TEXT("Hammers the street; each blow rings out as a ground wave that cracks windows further and further away."), TEXT("A drop hammer on guides; every blow grows the crater, raises a dust ring, kicks loose objects upward and breaks glass over a widening radius."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector P = Ground(A.Point);
			UStaticMeshComponent* H_ = Prop(D, TEXT("tl_piledriver"), P + FVector(0, 0, 500), FQuat::Identity, 1.f, 9.f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(H_);
			D.During(7.2f, [Weak, P](float T, float)
			{
				if (!Weak.IsValid()) return;
				const float U = FMath::Frac(T / 1.35f);
				const double Z = U < 0.76f ? 520.0 * FMath::SmoothStep(0.f, 1.f, U / 0.76f) : 520.0 * (1.0 - FMath::Square((U - 0.76f) / 0.24f));
				Weak->SetWorldLocation(P + FVector(0, 0, Z));
			});
			Repeat(D, 5, 1.35f, 1.34f, [Dp, P](int32 i)
			{
				Dp->MakeCrater(P, 130.f + i * 55.f, 45.f + i * 18.f);
				Dp->FX()->GroundRing(P, 900.f + i * 380.f, 2600.f, 0.45f + 0.1f * i, TEXT("asphalt"));
				Dp->ShatterGlass(P + FVector(0, 0, 250), 900.f + i * 620.f, 350.f, 6 + i * 9);
				FNYCDamage H;
				H.Center = P;
				H.Radius = 0.f;
				H.GlassRadius = 0.f;
				H.PropRadius = 380.f + i * 200.f;
				H.Speed = 180.f + i * 60.f;
				H.UpKick = 520.f;
				Dp->ApplyDamage(H);
				Dp->KickDebris(P, 1500.f, 160.f, 500.f, false);
				Dp->FX()->Sound(TEXT("pile_hit"), P, 1.f, 1.f - 0.03f * i);
				Dp->Shake(P, 10.f + 3.f * i, 0.8f);
			});
		}));

	Out.Add(Tool(TEXT("steel_beam_drop"), TEXT("Falling steel"), 3, TEXT("Impact"), ENYCTarget::Roof, 8.0f, 55.f, 30.f,
		TEXT("A bundle of girders comes down and spears straight through roofs and floors."), TEXT("Seven girders fall under gravity; each one that strikes a roof cuts a vertical capsule down through several floors, then comes to rest as a rigid body."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			Repeat(D, 7, 0.33f, 0.f, [Dp, A](int32 i)
			{
				const FVector Over = A.Point + FVector(Dp->Random().FRandRange(-650.f, 650.f), Dp->Random().FRandRange(-650.f, 650.f), 0) - Outward(A) * 350.0;
				FFlight F;
				F.Mesh = TEXT("tl_ibeam");
				F.From = FVector(Over.X, Over.Y, FMath::Max(Over.Z, 3000.0) + 4200.0);
				F.Velocity = FVector(Dp->Random().FRandRange(-120.f, 120.f), Dp->Random().FRandRange(-120.f, 120.f), -1400.f);
				F.Gravity = 1.6f;
				F.bAlign = true;
				F.Hit = [Dp](const FVector& P, const FVector& N, int32 B, const FVector& V)
				{
					FNYCDamage H;
					H.Center = P + FVector(0, 0, 60);
					H.End = P - FVector(0, 0, B != INDEX_NONE ? 1300.0 : 40.0);
					H.bCapsule = true;
					H.Radius = B != INDEX_NONE ? 175.f : 130.f;
					H.GlassRadius = 450.f;
					H.Speed = 480.f;
					H.Push = FVector(0, 0, -900);
					H.MaxElements = 14;
					H.PropRadius = 330.f;
					H.Dust = 0.8f;
					Dp->ApplyDamage(H);
					if (B == INDEX_NONE) Dp->MakeCrater(Ground(P), 110.f, 30.f);
					UStaticMeshComponent* Vis = Dp->NewVisual(Dp->CityMesh(TEXT("tl_ibeam")), FTransform(FRotator(Dp->Random().FRandRange(-40.f, 40.f), Dp->Random().FRandRange(0.f, 360.f), 0), P + N * 140.0));
					Dp->SpawnBody(TEXT("beam"), Vis, Vis->GetComponentTransform(), FVector(440, 22, 40), 1400.f, FVector(Dp->Random().FRandRange(-300.f, 300.f), Dp->Random().FRandRange(-300.f, 300.f), 260.f), FVector(60, 90, 30));
					Dp->FX()->Sparks(P, FVector(0, 0, 900), 80);
					Dp->FX()->Sound(TEXT("clang"), P, 1.f, Dp->Random().FRandRange(0.7f, 1.05f));
					Dp->Shake(P, 6.f, 0.5f);
				};
				Fly(*Dp, F);
			});
		}));

	Out.Add(Tool(TEXT("container_drop"), TEXT("Dropped shipping container"), 3, TEXT("Impact"), ENYCTarget::Car, 5.5f, 24.f, 7.f,
		TEXT("Thirty tonnes of steel box lands flat on the traffic."), TEXT("A falling container; on landing it crushes vehicles from above, throws a flat ring of dust and remains as a heavy rigid body."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 Car = D.FindProp(A.Point, ANYCDestruction::MCar, 2000.f);
			const FVector At = Ground(Car != INDEX_NONE ? D.PropLocation(Car) : A.Point);
			const FVector Along = StreetAxis(A.Dir);
			UStaticMeshComponent* Box = Prop(D, TEXT("tl_container"), At + FVector(0, 0, 5000), Facing(Along), 1.f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(Box);
			D.FX()->Sound(TEXT("whoosh_heavy"), At + FVector(0, 0, 2000), 0.9f, 0.8f);
			D.During(2.5f, [Weak, At, Along](float T, float)
			{
				if (!Weak.IsValid()) return;
				const double Z = FMath::Max(25.0, 5000.0 - 0.5 * 981.0 * 1.35 * T * T);
				Weak->SetWorldLocationAndRotation(At + FVector(0, 0, Z), Facing(Along) * FQuat(FVector(1, 0, 0), FMath::Max(0.0, Z - 25.0) * 0.00004) * FQuat(FVector(0, 1, 0), FMath::Max(0.0, Z - 25.0) * 0.000025));
			});
			D.After(2.76f, [Dp, At, Along, Weak]()
			{
				Dp->HitTraffic(At, 480.f, 500.f, 1.f, false, FVector(0, 0, -700));
				FNYCDamage H;
				H.Center = At + FVector(0, 0, 80);
				H.Radius = 260.f;
				H.GlassRadius = 1100.f;
				H.Speed = 900.f;
				H.PropRadius = 620.f;
				H.UpKick = 300.f;
				H.MaxElements = 10;
				H.Dust = 0.8f;
				Dp->ApplyDamage(H);
				Dp->MakeCrater(At, 340.f, 60.f);
				Dp->FX()->GroundRing(At, 1300.f, 2000.f, 0.9f, TEXT("asphalt"));
				Dp->FX()->Sparks(At + FVector(0, 0, 40), FVector(0, 0, 700), 240);
				Dp->FX()->Sound(TEXT("crash_heavy"), At, 1.f, 0.7f);
				Dp->Shake(At, 22.f, 1.2f);
				if (Weak.IsValid())
				{
					Dp->SpawnBody(TEXT("container"), Weak.Get(), FTransform(Facing(Along), At + FVector(0, 0, 170)), FVector(300, 120, 130), 28000.f, FVector(0, 0, 120), FVector(12, 8, 4));
				}
			});
		}));

	Out.Add(Tool(TEXT("crane_collapse"), TEXT("Tower crane collapse"), 3, TEXT("Disaster"), ENYCTarget::FacadeHigh, 9.0f, 75.f, 22.f,
		TEXT("A tower crane buckles and falls across the street, its jib raking down the fronts."), TEXT("A mast and jib assembled from lattice sections, rotated about the foot under gravity; every section that meets a building cuts into it, and the end hits the ground in sparks and dust."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const FVector Foot = Ground(A.Point + N * 1900.0);
			const int32 Parts = FMath::Clamp(FMath::CeilToInt32((A.Point.Z + 1400.0) / 400.0), 9, 20);
			const FVector JibDir = Side;
			TSharedRef<FCrane> C = BuildCrane(D, Foot, JibDir, Parts, 9, 30.f);
			const FVector FallDir = -N;
			const FVector Axis = FVector::CrossProduct(FVector::UpVector, FallDir).GetSafeNormal();
			TSharedRef<FVector2D> S = MakeShared<FVector2D>(FVector2D(0.02, 0.0));
			TSharedRef<TSet<int32>> Struck = MakeShared<TSet<int32>>();
			const double H = Parts * 400.0;
			D.FX()->Sound(TEXT("steel_groan"), Foot + FVector(0, 0, H), 1.f, 0.7f);
			D.FX()->Sparks(Foot + FVector(0, 0, 300), FallDir * 400.0 + FVector(0, 0, 500), 120);
			D.During(8.5f, [Dp, C, S, Struck, Foot, FallDir, Axis, JibDir, Parts, H](float T, float Dt)
			{
				if (T < 0.9f || S->X >= HALF_PI - 0.03) return;
				S->Y += 981.0 / (H * 0.62) * FMath::Sin(S->X + 0.05) * Dt;
				S->X = FMath::Min(S->X + S->Y * Dt, HALF_PI - 0.03);
				const FQuat R(Axis, S->X);
				auto Check = [&](const FVector& P, int32 Id)
				{
					if (Struck->Contains(Id)) return;
					FVector Point, Normal;
					int32 B = INDEX_NONE;
					const FVector V = FVector::CrossProduct(Axis * S->Y, P - Foot);
					const FVector Back = P - V.GetSafeNormal() * 260.0;
					if (Dp->Trace(Back, V.GetSafeNormal(), 300.f, Point, Normal, &B) >= 0.f)
					{
						Struck->Add(Id);
						FNYCDamage Hit;
						Hit.Center = Point;
						Hit.Radius = 240.f;
						Hit.GlassRadius = 520.f;
						Hit.Speed = 520.f;
						Hit.Push = V.GetSafeNormal() * 800.0;
						Hit.MaxElements = 12;
						Hit.PropRadius = Point.Z < 300.0 ? 500.f : 0.f;
						Hit.bCrater = Point.Z < 120.0 && Id % 3 == 0;
						Hit.CraterRadius = 190.f;
						Dp->ApplyDamage(Hit);
						Dp->FX()->Sparks(Point, Normal * 800.0, 90);
						Dp->FX()->Sound(TEXT("clang"), Point, 0.9f, 0.6f + 0.02f * Id);
						Dp->Shake(Point, 6.f, 0.5f);
					}
				};
				for (int32 i = 0; i < C->Mast.Num(); ++i)
				{
					const FVector P = Foot + R.RotateVector(FVector(0, 0, i * 400.0));
					if (C->Mast[i].IsValid()) C->Mast[i]->SetWorldLocationAndRotation(P, R);
					if (i > 2) Check(P, i);
				}
				for (int32 k = 0; k < C->Jib.Num(); ++k)
				{
					const FVector Rel = FVector(0, 0, Parts * 400.0) + JibDir * ((k - 2) * 400.0);
					const FVector P = Foot + R.RotateVector(Rel);
					if (C->Jib[k].IsValid()) C->Jib[k]->SetWorldLocationAndRotation(P, R * Facing(JibDir));
					Check(P, 100 + k);
				}
				if (S->X >= HALF_PI - 0.031)
				{
					const FVector End = Foot + FallDir * (H * 0.8);
					Dp->FX()->DustSurge(FBox(Ground(Foot, 0) - FVector(200, 200, 0), Ground(End, 600) + FVector(200, 200, 0)), 1800.f, TEXT("concrete"));
					Dp->FX()->Sound(TEXT("crash_heavy"), End, 1.f, 0.6f);
					Dp->Shake(End, 25.f, 1.6f);
				}
			});
		}));

	Out.Add(Tool(TEXT("implosion"), TEXT("Controlled implosion"), 3, TEXT("Demolition charge"), ENYCTarget::Facade, 12.0f, 85.f, 24.f,
		TEXT("Timed charges ripple through the lower floors and the whole building drops into its own footprint."), TEXT("A sequence of sixteen charges with flashes and dust jets, then the progressive pancake collapse: the failing floor shatters, the mass above falls as floor clusters, lower floors give way in turn."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 B = A.Building;
			if (B == INDEX_NONE) D.NearestBuilding(A.Point, 5000.f, B);
			const FNYCBuildingInfo* I = D.Info(B);
			if (!I) return;
			const FBox2D R = I->Rect;
			const float FH = FMath::Max(I->FloorH, 320.f);
			D.FX()->Sound(TEXT("horn_warning"), A.Point, 1.f, 1.f);
			Repeat(D, 16, 0.17f, 1.4f, [Dp, R, FH, B](int32 i)
			{
				const int32 Face = i % 4;
				const double T = Dp->Random().FRandRange(0.12f, 0.88f);
				const double Z = FH * (0.6 + (i % 3) * 1.35);
				const FVector P = Face == 0 ? FVector(R.Max.X + 15, FMath::Lerp(R.Min.Y, R.Max.Y, T), Z) : Face == 1 ? FVector(R.Min.X - 15, FMath::Lerp(R.Min.Y, R.Max.Y, T), Z)
					: Face == 2 ? FVector(FMath::Lerp(R.Min.X, R.Max.X, T), R.Max.Y + 15, Z) : FVector(FMath::Lerp(R.Min.X, R.Max.X, T), R.Min.Y - 15, Z);
				const FVector N = Face == 0 ? FVector(1, 0, 0) : Face == 1 ? FVector(-1, 0, 0) : Face == 2 ? FVector(0, 1, 0) : FVector(0, -1, 0);
				if (i % 5 == 0) Dp->FX()->Flash(P + N * 80.0, FLinearColor(1.f, 0.82f, 0.6f), 600000.f * Dp->FX()->GlowScale(), 2600.f, 0.14f);
				Dp->FX()->Sparks(P, N * 1100.0, 60);
				Dp->FX()->DustBurst(P + N * 90.0, 120.f, 0.8f, TEXT("concrete"));
				Dp->ShatterGlass(P, 420.f, 800.f, 8);
				Dp->FX()->Sound(TEXT("crack_charge"), P, 0.9f, Dp->Random().FRandRange(0.8f, 1.15f));
				Dp->Shake(P, 4.f, 0.2f);
			});
			D.After(4.4f, [Dp, B]() { Dp->CollapseBuilding(B, 1, 1, FVector(1, 0, 0), 0.05f); });
		}));

	Out.Add(Tool(TEXT("topple_charges"), TEXT("Felling charges"), 3, TEXT("Demolition charge"), ENYCTarget::Facade, 12.0f, 100.f, 30.f,
		TEXT("Charges cut one side of the base so the building goes over like a tree, into whatever stands across the street."), TEXT("The street-side ground floor is blown, then the whole upper block is released as one rigid mass with an initial rotation about the cut edge; it breaks apart where it lands and damages what it reaches."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 B = A.Building;
			if (B == INDEX_NONE) D.NearestBuilding(A.Point, 5000.f, B);
			const FNYCBuildingInfo* I = D.Info(B);
			if (!I) return;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const FVector Foot = Ground(A.Point, 190.0);
			Repeat(D, 7, 0.14f, 0.9f, [Dp, Foot, N, Side](int32 i)
			{
				const FVector P = Foot + Side * ((i - 3) * 330.0);
				FNYCDamage H;
				H.Center = P - N * 60.0;
				H.Radius = 240.f;
				H.GlassRadius = 500.f;
				H.Speed = 900.f;
				H.Push = N * 600.0;
				H.MaxElements = 10;
				H.Dust = 0.8f;
				H.bStructural = false;
				Dp->ApplyDamage(H);
				if (i % 3 == 0) Dp->FX()->Flash(P + N * 100.0, FLinearColor(1.f, 0.85f, 0.65f), 600000.f * Dp->FX()->GlowScale(), 2600.f, 0.14f);
				Dp->FX()->Sparks(P, N * 1300.0, 80);
				Dp->FX()->Sound(TEXT("crack_charge"), P, 0.95f, 0.85f + 0.04f * i);
				Dp->Shake(P, 6.f, 0.25f);
			});
			D.After(2.1f, [Dp, B, N]() { Dp->CollapseBuilding(B, 1, 2, N, 0.05f); });
		}));
}
