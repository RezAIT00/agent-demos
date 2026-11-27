// Tier 2: small explosives, fire and cutting charges.
#include "NYCToolKit.h"

using namespace NYCT;

namespace
{
	/** A short beeping countdown at a placed charge. */
	void Arm(ANYCDestruction& D, const FVector& At, float Delay)
	{
		ANYCDestruction* Dp = &D;
		Repeat(D, 3, Delay / 3.4f, 0.1f, [Dp, At](int32 i)
		{
			Dp->FX()->Sound(TEXT("beep"), At, 0.5f, 1.f + 0.12f * i);
			Dp->FX()->Glow(At, FLinearColor(1.f, 0.05f, 0.03f), 260.f, 180.f, 0.18f, 0.f);
		});
	}
}

void NYCArsenal::RegisterCharges(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("grenade"), TEXT("Fragmentation grenade"), 2, TEXT("Explosive"), ENYCTarget::GroundFloor, 3.8f, 12.f, 3.2f,
		TEXT("A sharp crack that riddles walls with fragments and blows out nearby glass."), TEXT("Bouncing fused body; a hard, mostly dry blast, then thirty fragment rays traced outward that scar walls and break the panes they hit."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_grenade");
			F.From = Hand(A);
			const FVector Rest = FVector(A.Point.X, A.Point.Y, FMath::Max(14.0, A.Point.Z - 150.0)) + Outward(A) * 85.0;
			F.Velocity = Lob(F.From, Rest, 1.05f);
			F.Spin = 760.f;
			F.bAlign = false;
			F.Bounces = 1;
			F.Bounce = 0.16f;
			F.Fuse = 1.55f;
			TSharedRef<bool> Gone = MakeShared<bool>(false);
			F.Hit = [Dp, Gone](const FVector& P0, const FVector&, int32, const FVector&)
			{
				if (*Gone) return;
				*Gone = true;
				const FVector P = P0 + FVector(0, 0, 12);
				FBlast B;
				B.Radius = 190.f;
				B.Glass = 780.f;
				B.Speed = 1700.f;
				B.Fireball = 95.f;
				B.Dust = 0.75f;
				B.MaxElements = 12;
				B.Sound = TEXT("grenade");
				B.ShakeAmount = 7.f;
				B.bRagged = true;
				Blast(*Dp, P, B);
				if (P.Z < 220.f) Dp->MakeCrater(Ground(P), 75.f, 20.f);
				for (int32 i = 0; i < 34; ++i)
				{
					FVector Ray = Dp->Random().VRand();
					Ray.Z = FMath::Abs(Ray.Z) * 0.55f;
					Ray.Normalize();
					FVector Point, Normal;
					if (Dp->Trace(P, Ray, 1500.f, Point, Normal) < 0.f) continue;
					Dp->Scar(Point, Normal, Dp->Random().FRandRange(3.f, 8.f));
					Dp->FX()->Sparks(Point, Normal * 300.0, 5);
					if (i % 5 == 0) Dp->ShatterGlass(Point, 130.f, 300.f, 1);
				}
			};
			Fly(D, F);
			D.FX()->Sound(TEXT("pin"), A.Origin, 0.5f, 1.f);
		}));

	Out.Add(Tool(TEXT("road_flare"), TEXT("Road flare"), 2, TEXT("Fire"), ENYCTarget::Car, 9.0f, 12.f, 3.8f,
		TEXT("Starts a fire that spreads: cars catch, litter burns, windows crack in the heat."), TEXT("A red-burning flare; every two seconds the fire reaches the next car or object within range, which is wrecked burning in place."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_flare");
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point + FVector(0, 0, 10), 0.8f);
			F.Spin = 540.f;
			F.bAlign = false;
			F.Trail = [Dp](const FVector& P, const FVector&, float) { Dp->FX()->Sparks(P, FVector(0, 0, 160), 3, FLinearColor(1.f, 0.08f, 0.03f), 60.f); };
			F.Hit = [Dp](const FVector& P, const FVector& N, int32, const FVector&)
			{
				const FVector At = P + N * 8.0;
				Prop(*Dp, TEXT("tl_flare"), At, FQuat::Identity, 1.f, 12.f);
				Dp->FX()->Glow(At + FVector(0, 0, 30), FLinearColor(1.f, 0.06f, 0.02f), 6500.f * Dp->FX()->GlowScale(), 900.f, 9.f, 0.6f);
				Repeat(*Dp, 20, 0.25f, 0.f, [Dp, At](int32) { Dp->FX()->Sparks(At, FVector(0, 0, 260), 14, FLinearColor(1.f, 0.12f, 0.05f), 40.f); });
				Dp->FX()->Fire(At, 38.f, 9.f);
				Dp->FX()->Sound(TEXT("flare"), At, 0.7f, 1.f);
				Repeat(*Dp, 5, 1.35f, 0.7f, [Dp, At](int32 i)
				{
					const float Reach = 260.f + i * 210.f;
					const int32 Car = Dp->FindProp(At, ANYCDestruction::MCar, Reach + 120.f);
					const int32 Other = Dp->FindProp(At, ANYCDestruction::MBox | ANYCDestruction::MBag, Reach);
					if (Car != INDEX_NONE)
					{
						const FVector Where = Dp->PropLocation(Car);
						Dp->LaunchProp(Car, FVector(0, 0, 30), FVector::ZeroVector, false, true);
						Dp->FX()->Fire(Where + FVector(0, 0, 90), 130.f, 14.f);
					}
					if (Other != INDEX_NONE) Dp->LaunchProp(Other, FVector(0, 0, 40), FVector(20, 10, 0), false, true);
					const FVector Spot = At + FVector(Dp->Random().FRandRange(-1.f, 1.f), Dp->Random().FRandRange(-1.f, 1.f), 0) * Reach * 0.6;
					Dp->FX()->Fire(Spot + FVector(0, 0, 12), 45.f + i * 12.f, 9.f);
					Dp->ShatterGlass(Spot + FVector(0, 0, 220), Reach, 180.f, 3 + i);
					if (Car == INDEX_NONE) Dp->HitTraffic(At, Reach, 40.f, 0.15f, true, FVector::ZeroVector);
				});
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("fireworks"), TEXT("Fireworks barrage"), 2, TEXT("Explosive"), ENYCTarget::FacadeHigh, 5.5f, 34.f, 6.f,
		TEXT("Rockets burst against the upper floors in coloured stars, breaking glass and setting awnings smoking."), TEXT("Seven rockets with spark trails; each burst is a Niagara star shell in its own colour with a coloured light and a small glass-breaking pop."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			Prop(D, TEXT("tl_mortartube"), Ground(A.Point + Outward(A) * 1400.0, 12.0), Facing(-Outward(A)), 1.f, 7.f);
			Repeat(D, 7, 0.38f, 0.f, [Dp, A](int32 i)
			{
				static const FLinearColor Colours[] = { FLinearColor(1.f, 0.08f, 0.05f), FLinearColor(0.1f, 0.45f, 1.f), FLinearColor(1.f, 0.72f, 0.18f),
					FLinearColor(0.15f, 1.f, 0.3f), FLinearColor(0.75f, 0.2f, 1.f) };
				const FLinearColor Colour = Colours[i % 5];
				const FVector Out_ = Outward(A);
				const FVector Side = WallTangent(Out_);
				const FVector Target = A.Point + Side * Dp->Random().FRandRange(-750.f, 750.f) + FVector(0, 0, Dp->Random().FRandRange(-250.f, 700.f));
				FFlight F;
				F.Mesh = TEXT("tl_fireworkrocket");
				F.From = Ground(A.Point + Out_ * 1400.0 + Side * ((i - 3) * 60.0), 60.0);
				F.Velocity = Lob(F.From, Target, 0.85f, 0.35f);
				F.Gravity = 0.35f;
				F.Trail = [Dp, Colour](const FVector& P, const FVector& V, float) { Dp->FX()->Sparks(P, -V * 0.25, 6, FLinearColor(1.f, 0.7f, 0.35f), 24.f); };
				F.Hit = [Dp, Colour](const FVector& P, const FVector& N, int32, const FVector&)
				{
					const FVector At = P + N * 120.0;
					Dp->FX()->Motes(At, 420, Colour, 25.f, 1500.f, 2.1f, 11.f, FVector(0, 0, -260));
					Dp->FX()->Sparks(At, FVector(0, 0, 900), 90, Colour, 180.f);
					Dp->FX()->Flash(At, Colour, 160000.f * Dp->FX()->GlowScale(), 2200.f, 0.55f, 0.2f);
					Dp->ShatterGlass(P, 260.f, 420.f, 4);
					Dp->FX()->SmokeColumn(P + N * 40.0, 40.f, 3.f, 0.3f);
					Dp->FX()->Sound(TEXT("firework"), At, 0.8f, Dp->Random().FRandRange(0.85f, 1.15f));
				};
				Fly(*Dp, F);
				Dp->FX()->Sound(TEXT("whistle_up"), F.From, 0.6f, Dp->Random().FRandRange(0.9f, 1.1f));
			});
		}));

	Out.Add(Tool(TEXT("propane_rocket"), TEXT("Runaway propane tank"), 2, TEXT("Explosive"), ENYCTarget::GroundFloor, 4.6f, 18.f, 4.5f,
		TEXT("A ruptured cylinder skitters along the street spewing flame, then explodes against the storefront."), TEXT("A tank mesh driven in a weaving path with a trailing jet of flame and sparks, ending in a medium blast."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector From = Ground(A.Point + Outward(A) * 1500.0 + WallTangent(Outward(A)) * 500.0, 32.0);
			const FVector To = Ground(A.Point + Outward(A) * 70.0, 45.0);
			const FVector Along = Flat(To - From);
			const FVector Side = WallTangent(Along);
			UStaticMeshComponent* Tank = Prop(D, TEXT("tl_propane"), From, Facing(Along), 1.f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(Tank);
			TSharedRef<int32> N = MakeShared<int32>(0);
			D.FX()->Sound(TEXT("hiss"), From, 0.9f, 1.f);
			D.During(2.0f, [Dp, Weak, From, To, Side, N](float T, float)
			{
				if (!Weak.IsValid()) return;
				const float U = FMath::Clamp(T / 1.9f, 0.f, 1.f);
				const double Weave = FMath::Sin(U * 17.0) * 130.0 * (1.0 - U);
				FVector P = FMath::Lerp(From, To, (double)(U * U)) + Side * Weave;
				P.Z += FMath::Abs(FMath::Sin(U * 23.f)) * 34.0 * (1.0 - U);
				const FVector Dir = Flat(To - From + Side * FMath::Cos(U * 17.0) * 900.0 * (1.0 - U));
				Weak->SetWorldLocationAndRotation(P, Facing(Dir) * FQuat(FVector(1, 0, 0), T * 21.f));
				if (++*N % 2 == 0)
				{
					Dp->FX()->Sparks(P - Dir * 45.0, -Dir * 800.0, 12, FLinearColor(1.f, 0.6f, 0.2f), 22.f);
					if (*N % 4 == 0) Dp->FX()->Fire(P - Dir * 70.0, 34.f, 0.35f);
				}
			});
			D.After(2.0f, [Dp, Weak, To]()
			{
				if (Weak.IsValid()) Dp->FX()->RemoveMesh(Weak.Get());
				FBlast B;
				B.Radius = 260.f;
				B.Glass = 900.f;
				B.Speed = 1500.f;
				B.Fireball = 270.f;
				B.Burn = 0.55f;
				B.Smoke = 90.f;
				B.MaxElements = 26;
				B.Sound = TEXT("blast_med");
				B.Pitch = 1.15f;
				Blast(*Dp, To, B);
				Dp->SpawnLumps(To, FVector(0, 0, 1), 7, 28.f, TEXT("steel"), 1100.f, 1.2f, 2.4f);
				Dp->FX()->Fire(Ground(To, 20.0), 90.f, 10.f);
			});
		}));

	Out.Add(Tool(TEXT("dynamite"), TEXT("Stick of dynamite"), 2, TEXT("Explosive"), ENYCTarget::Facade, 5.0f, 17.f, 4.5f,
		TEXT("Blows a ragged hole in a wall and every window round it."), TEXT("A thrown stick with a spitting fuse; a medium blast that fractures facade modules into Chaos pieces and throws them outward."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_dynamite");
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point + Outward(A) * 35.0, FMath::Clamp((float)FVector::Dist(F.From, A.Point) / 1500.f, 0.35f, 1.4f));
			F.Spin = 480.f;
			F.bAlign = false;
			F.Trail = [Dp](const FVector& P, const FVector&, float) { Dp->FX()->Sparks(P, FVector(0, 0, 200), 3, FLinearColor(1.f, 0.65f, 0.25f), 90.f); };
			F.Hit = [Dp](const FVector& P, const FVector& N, int32 B_, const FVector&)
			{
				const FVector At = P + N * 22.0;
				Prop(*Dp, TEXT("tl_dynamite"), At, Facing(WallTangent(N)), 1.f, 0.7f);
				Dp->FX()->Sparks(At, N * 160.0, 40);
				Dp->After(0.65f, [Dp, At]()
				{
					FBlast B;
					B.Radius = 360.f;
					B.Glass = 1300.f;
					B.Speed = 1500.f;
					B.Fireball = 200.f;
					B.Dust = 1.f;
					B.MaxElements = 34;
					B.Sound = TEXT("blast_med");
					B.ShakeAmount = 12.f;
					B.Smoke = 55.f;
					Blast(*Dp, At, B);
					if (At.Z < 260.f) Dp->MakeCrater(Ground(At), 130.f, 40.f);
				});
			};
			Fly(D, F);
			D.FX()->Sound(TEXT("fuse"), A.Origin, 0.5f, 1.f);
		}));

	Out.Add(Tool(TEXT("breaching_charge"), TEXT("Breaching charge"), 2, TEXT("Demolition charge"), ENYCTarget::GroundFloor, 3.6f, 11.f, 2.6f,
		TEXT("Punches a doorway straight into the building."), TEXT("A placed charge with a beeping fuse; a narrow inward-directed blast (capsule into the wall) that drives all the debris inside."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector At = A.Point + N * 8.0;
			UStaticMeshComponent* C = Prop(D, TEXT("tl_charge"), At, Facing(WallTangent(N)), 1.5f, 1.5f);
			Arm(D, At + N * 10.0, 1.3f);
			D.After(1.45f, [Dp, At, N]()
			{
				FNYCDamage H;
				H.Center = Ground(At + N * 30.0, FMath::Max(At.Z - 70.0, 40.0));
				H.End = H.Center - N * 330.0 + FVector(0, 0, 110);
				H.bCapsule = true;
				H.Radius = 125.f;
				H.GlassRadius = 480.f;
				H.Speed = 520.f;
				H.Push = -N * 1500.0;
				H.bRadial = true;
				H.bFrame = false;
				H.ForceLOD = 0;
				H.MaxElements = 7;
				H.PropRadius = 220.f;
				H.Dust = 0.7f;
				H.bRagged = true;
				Dp->ApplyDamage(H);
				Dp->FX()->Flash(At + N * 60.0, FLinearColor(1.f, 0.82f, 0.6f), 420000.f * Dp->FX()->GlowScale(), 1800.f, 0.16f);
				Dp->FX()->Sparks(At, N * 1300.0, 170, FLinearColor(1.f, 0.72f, 0.4f), 62.f);
				Dp->FX()->DustBurst(At + N * 130.0, 150.f, 0.95f, TEXT("concrete"));
				Dp->FX()->Sound(TEXT("breach"), At, 1.f, 1.f);
				Dp->Shake(At, 9.f, 0.5f);
			});
		}));

	Out.Add(Tool(TEXT("shaped_charge"), TEXT("Column-cutting charge"), 2, TEXT("Demolition charge"), ENYCTarget::GroundFloor, 6.0f, 22.f, 6.f,
		TEXT("A focused jet shears the steel columns behind the wall; the floors above sag or come down."), TEXT("Two narrow capsule cuts that sever columns, beams and slabs along a line into the building; the structural check then decides what falls."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const FVector At = Ground(A.Point + N * 8.0, 130.0);
			for (int32 k = -1; k <= 1; k += 2) Prop(D, TEXT("tl_charge"), At + Side * (k * 260.0), Facing(Side), 1.2f, 2.0f);
			Arm(D, At + N * 12.0, 1.5f);
			Repeat(D, 2, 0.45f, 1.75f, [Dp, At, N, Side](int32 i)
			{
				const FVector Start = At + Side * ((i == 0 ? -1 : 1) * 260.0);
				const FVector End = Start - N * 1000.0;
				const int32 Jet = Dp->FX()->Beam(Start + N * 40.0, End, 22.f, FLinearColor(1.f, 0.85f, 0.65f), 90000.f, 0.22f);
				FNYCDamage H;
				H.Center = Start;
				H.End = End;
				H.bCapsule = true;
				H.Radius = 190.f;
				H.GlassRadius = 420.f;
				H.Speed = 600.f;
				H.Push = -N * 1100.0;
				H.MaxElements = 22;
				H.PropRadius = 200.f;
				H.Dust = 0.8f;
				H.bRagged = true;
				Dp->ApplyDamage(H);
				Dp->FX()->Sparks(Start, -N * 2600.0, 220, FLinearColor(1.f, 0.85f, 0.6f), 16.f);
				Dp->FX()->Sparks(Start, N * 700.0, 90, FLinearColor(1.f, 0.7f, 0.35f), 55.f);
				Dp->FX()->Flash(Start + N * 80.0, FLinearColor(1.f, 0.9f, 0.75f), 520000.f * Dp->FX()->GlowScale(), 2200.f, 0.12f);
				Dp->FX()->Sound(TEXT("crack_charge"), Start, 1.f, 1.f);
				Dp->Shake(Start, 7.f, 0.35f);
			});
		}));

	Out.Add(Tool(TEXT("linear_charge"), TEXT("Linear cutting charge"), 2, TEXT("Demolition charge"), ENYCTarget::FacadeHigh, 5.5f, 32.f, 8.f,
		TEXT("Slices a horizontal line across the front; the band of wall peels off into the street."), TEXT("A string of charges fired end to end: sequential thin cuts along the wall that push their pieces outward."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			for (int32 k = -3; k <= 3; ++k) Prop(D, TEXT("tl_linearcharge"), A.Point + N * 9.0 + Side * (k * 300.0), Facing(Side), 1.f, 1.45f);
			Arm(D, A.Point + N * 14.0, 1.2f);
			Repeat(D, 8, 0.065f, 1.4f, [Dp, A, N, Side](int32 i)
			{
				const FVector P0 = A.Point + Side * ((i - 4) * 270.0);
				FNYCDamage H;
				H.Center = P0 - N * 20.0;
				H.End = H.Center + Side * 270.0;
				H.bCapsule = true;
				H.Radius = 85.f;
				H.GlassRadius = 330.f;
				H.Speed = 380.f;
				H.Push = N * 720.0;
				H.bFrame = false;
				H.MaxElements = 6;
				H.PropRadius = 0.f;
				H.Dust = 0.5f;
				Dp->ApplyDamage(H);
				const FVector Mid = P0 + Side * 135.0 + N * 20.0;
				Dp->FX()->Beam(P0 + N * 14.0, P0 + Side * 270.0 + N * 14.0, 7.f, FLinearColor(1.f, 0.75f, 0.45f), 120000.f, 0.14f);
				Dp->FX()->Sparks(Mid, N * 1000.0, 90, FLinearColor(1.f, 0.75f, 0.4f), 70.f);
				if (i % 4 == 0) Dp->FX()->Flash(Mid + N * 80.0, FLinearColor(1.f, 0.85f, 0.65f), 380000.f * Dp->FX()->GlowScale(), 2000.f, 0.2f);
				Dp->FX()->Sound(TEXT("crack_charge"), Mid, 0.7f, 1.15f + 0.03f * i);
			});
		}));

	Out.Add(Tool(TEXT("thermite"), TEXT("Thermite pot"), 2, TEXT("Demolition charge"), ENYCTarget::GroundFloor, 9.0f, 18.f, 5.f,
		TEXT("White-hot metal pours into the base of the building, silently eating through the steel until something gives."), TEXT("No blast: a five-second white spark fountain and molten drips; columns are removed one at a time with almost no debris speed, until the structural check fails."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Side = WallTangent(N);
			const FVector At = Ground(A.Point + N * 26.0, 18.0);
			Prop(D, TEXT("tl_thermite"), At, FQuat::Identity, 1.8f, 7.f);
			D.FX()->Sound(TEXT("thermite"), At, 0.9f, 1.f);
			D.FX()->Glow(At + FVector(0, 0, 60) + N * 20.0, FLinearColor(1.f, 0.86f, 0.62f), 90000.f * D.FX()->GlowScale(), 2400.f, 6.f, 0.45f);
			Repeat(D, 40, 0.15f, 0.2f, [Dp, At, N, Side](int32 i)
			{
				Dp->FX()->Sparks(At + FVector(0, 0, 55), FVector(0, 0, 780) + N * 120.0, 40, FLinearColor(1.f, 0.9f, 0.68f), 34.f);
				Dp->FX()->Motes(At + FVector(0, 0, 40), 6, FLinearColor(1.f, 0.45f, 0.06f), 30.f, 90.f, 1.6f, 5.f, FVector(0, 0, -500));
				if (i % 6 == 0) Dp->FX()->SmokeColumn(At + FVector(0, 0, 110), 55.f, 2.5f, 0.1f);
				if (i % 5 == 4)
				{
					FNYCDamage H;
					H.Center = At - N * (60.0 + i * 15.0) + Side * Dp->Random().FRandRange(-260.f, 260.f) + FVector(0, 0, 150);
					H.Radius = 230.f;
					H.GlassRadius = 0.f;
					H.Speed = 90.f;
					H.bRadial = false;
					H.Push = FVector(0, 0, -160);
					H.MaxElements = 5;
					H.PropRadius = 0.f;
					H.Dust = 0.18f;
					Dp->ApplyDamage(H);
					Dp->FX()->Sound(TEXT("creak"), H.Center, 0.8f, 0.55f);
				}
			});
			D.MakeCrater(Ground(At), 55.f, 18.f);
		}));

	Out.Add(Tool(TEXT("gas_leak"), TEXT("Gas leak and spark"), 2, TEXT("Explosion"), ENYCTarget::FacadeHigh, 6.0f, 40.f, 10.f,
		TEXT("A floor full of gas goes off at once: every window on it blows out and flame rolls from all four sides."), TEXT("All facade modules on one floor are found; the glazing is broken and jets of fire are placed round the perimeter at the same instant, with a floor-wide outward blast."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 B = A.Building;
			if (B == INDEX_NONE) D.NearestBuilding(A.Point, 3000.f, B);
			const FNYCBuildingInfo* I = D.Info(B);
			if (!I) { FBlast X; X.Fireball = 420.f; X.Radius = 300.f; Blast(D, A.Point, X); return; }
			const float FH = FMath::Max(I->FloorH, 320.f);
			const double Z = (FMath::Max(1, FMath::FloorToInt32(A.Point.Z / FH)) + 0.5) * FH;
			D.FX()->Sound(TEXT("hiss"), A.Point, 0.8f, 0.6f);
			const FBox2D R = I->Rect;
			D.After(1.5f, [Dp, R, Z, A, FH]()
			{
				// round the four sides of the floor
				TArray<TPair<FVector, FVector>> Spots;
				for (int32 k = 0; k < 4; ++k)
				{
					const FVector N = k == 0 ? FVector(1, 0, 0) : k == 1 ? FVector(-1, 0, 0) : k == 2 ? FVector(0, 1, 0) : FVector(0, -1, 0);
					const double Along0 = k < 2 ? R.Min.Y : R.Min.X, Along1 = k < 2 ? R.Max.Y : R.Max.X;
					const double Face = k == 0 ? R.Max.X : k == 1 ? R.Min.X : k == 2 ? R.Max.Y : R.Min.Y;
					const int32 Count = FMath::Clamp(FMath::RoundToInt32((Along1 - Along0) / 650.0), 1, 5);
					for (int32 j = 0; j < Count; ++j)
					{
						const double T = FMath::Lerp(Along0, Along1, (j + 0.5) / Count);
						Spots.Add({ k < 2 ? FVector(Face, T, Z) : FVector(T, Face, Z), N });
					}
				}
				for (int32 s = 0; s < Spots.Num(); ++s)
				{
					const FVector P = Spots[s].Key, N = Spots[s].Value;
					FNYCDamage H;
					H.Center = P - N * 120.0;
					H.Radius = 150.f;
					H.GlassRadius = 420.f;
					H.Speed = 500.f;
					H.Push = N * 1200.0;
					H.bFrame = false;
					H.MaxElements = 4;
					H.PropRadius = 0.f;
					H.Dust = 0.25f;
					Dp->ApplyDamage(H);
					Dp->FX()->Fireball(P + N * 160.0, 190.f, 0.8f, s == 0 ? 1.f : 0.f);
					Dp->FX()->Sparks(P, N * 1100.0, 60);
					if (s % 3 == 0) Dp->FX()->Fire(P - N * 40.0 - FVector(0, 0, FH * 0.35), 75.f, 12.f);
					if (s % 2 == 0) Dp->FX()->Litter(P + N * 60.0, N * 900.0, 40);
				}
				Dp->FX()->Sound(TEXT("blast_big"), A.Point, 1.f, 1.1f);
				Dp->Shake(A.Point, 16.f, 1.0f);
			});
		}));
}
