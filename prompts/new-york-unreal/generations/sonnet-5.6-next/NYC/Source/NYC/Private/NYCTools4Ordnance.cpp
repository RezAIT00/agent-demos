// Tier 4: artillery and heavy ordnance.  All of it is fired from the ground or falls as a shell; nothing
// here recreates any real attack or event.
#include "NYCToolKit.h"

using namespace NYCT;

namespace
{
	/** Cuts a path through everything between two points, like a solid shot passing through walls. */
	void Pierce(ANYCDestruction& D, const FVector& From, const FVector& To, float Radius, float Speed, int32 Max)
	{
		FNYCDamage H;
		H.Center = From;
		H.End = To;
		H.bCapsule = true;
		H.Radius = Radius;
		H.GlassRadius = Radius * 3.f;
		H.Speed = Speed * 0.25f;
		H.Push = (To - From).GetSafeNormal() * Speed;
		H.bRadial = true;
		H.MaxElements = Max;
		H.PropRadius = Radius * 2.f;
		H.Dust = 0.7f;
		D.ApplyDamage(H);
	}

	/** A shell arriving on a high arc from behind the viewer. */
	void Incoming(ANYCDestruction& D, const FNYCAim& A, const FVector& Target, const TCHAR* Mesh, float Scale, float Time, float Gravity,
		TFunction<void(const FVector&, const FVector&, int32, const FVector&)> Hit, bool bTrail)
	{
		FFlight F;
		F.Mesh = Mesh;
		F.From = Target - Flat(A.Dir) * 5200.0 + FVector(0, 0, 5200.0);
		F.Velocity = Lob(F.From, Target, Time, Gravity);
		F.Gravity = Gravity;
		F.Scale = Scale;
		F.MaxTime = Time * 1.5f + 1.f;
		if (bTrail) F.Trail = SmokeTrail(D, 26.f, 1.8f, FLinearColor(0.35f, 0.34f, 0.33f), 0.05f);
		F.Hit = MoveTemp(Hit);
		Fly(D, F);
	}
}

void NYCArsenal::RegisterOrdnance(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("cannonball"), TEXT("Old iron cannon"), 4, TEXT("Artillery"), ENYCTarget::Facade, 4.5f, 28.f, 7.f,
		TEXT("A solid iron ball punches straight through wall after wall without exploding."), TEXT("A fast heavy ball; at the hit a capsule is cut deep along its line through several walls, fragments carried forward; the ball ends up rolling inside as a rigid body."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector From = Ground(A.Point + Outward(A) * 2600.0 + WallTangent(Outward(A)) * 700.0, FMath::Max(150.0, A.Point.Z * 0.5));
			Prop(D, TEXT("tl_mortartube"), Ground(From, 10.0), Facing(Flat(A.Point - From)), 1.6f, 6.f);
			D.FX()->Fireball(From, 85.f, 0.35f, 0.8f);
			D.FX()->SmokeColumn(From, 70.f, 2.f, 0.15f);
			D.FX()->Sound(TEXT("cannon"), From, 1.f, 1.f);
			FFlight F;
			F.Mesh = TEXT("tl_cannonball");
			F.From = From;
			F.Velocity = Lob(From, A.Point, 0.42f);
			F.bAlign = false;
			F.Spin = 900.f;
			F.Scale = 1.25f;
			F.Hit = [Dp](const FVector& P, const FVector& N, int32, const FVector& V)
			{
				const FVector Dir = V.GetSafeNormal();
				Pierce(*Dp, P - Dir * 30.0, P + Dir * 1500.0, 105.f, 1700.f, 22);
				Dp->FX()->DustBurst(P + N * 80.0, 170.f, 1.f, TEXT("concrete"));
				Dp->SpawnLumps(P + N * 40.0, N, 10, 26.f, TEXT("brick_brown"), 520.f);
				Dp->FX()->DustBurst(P + Dir * 900.0, 200.f, 0.7f, TEXT("concrete"));
				UStaticMeshComponent* Ball = Dp->NewVisual(Dp->CityMesh(TEXT("tl_cannonball")), FTransform(P + Dir * 500.0));
				Dp->SpawnBody(TEXT("ball"), Ball, FTransform(P + Dir * 500.0), FVector(20), 600.f, Dir * 700.0, FVector(0, 500, 0));
				Dp->FX()->Sound(TEXT("crash_heavy"), P, 0.9f, 1.25f);
				Dp->Shake(P, 9.f, 0.5f);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("mortar"), TEXT("Mortar"), 4, TEXT("Artillery"), ENYCTarget::Street, 6.0f, 34.f, 10.f,
		TEXT("A bomb drops out of a steep arc and cratering the street."), TEXT("Visible tube, a high lobbed finned bomb with a falling whistle, a ground blast with a crater cut into the road and thrown paving."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector From = Ground(A.Point + Outward(A) * 3200.0, 80.0);
			Prop(D, TEXT("tl_mortartube"), Ground(From, 10.0), Facing(Flat(A.Point - From)), 1.f, 7.f);
			D.FX()->Fireball(From + FVector(0, 0, 70), 45.f, 0.25f, 0.5f);
			D.FX()->Sound(TEXT("mortar_thump"), From, 1.f, 1.f);
			FFlight F;
			F.Mesh = TEXT("tl_mortarbomb");
			F.From = From + FVector(0, 0, 80);
			F.Velocity = Lob(F.From, A.Point, 3.2f);
			F.Scale = 1.3f;
			F.MaxTime = 6.f;
			F.ArmDelay = 0.5f;
			F.Hit = [Dp](const FVector& P, const FVector& N, int32, const FVector&)
			{
				FBlast B;
				B.Radius = 480.f;
				B.Glass = 1800.f;
				B.Speed = 1600.f;
				B.Fireball = 240.f;
				B.Crater = P.Z < 200.f ? 260.f : 0.f;
				B.Smoke = 90.f;
				B.MaxElements = 60;
				B.Sound = TEXT("blast_med");
				B.ShakeAmount = 16.f;
				B.bShock = true;
				Blast(*Dp, P + N * 40.0, B);
				Dp->FX()->Chips(P, FVector(0, 0, 1700), 220, FLinearColor(0.12f, 0.085f, 0.055f), 1.5f, 9.f, 40.f);
			};
			Fly(D, F);
			D.After(1.9f, [Dp, A]() { Dp->FX()->Sound(TEXT("whistle_down"), A.Point, 0.9f, 1.f); });
		}));

	Out.Add(Tool(TEXT("tank_shell"), TEXT("Tank gun"), 4, TEXT("Artillery"), ENYCTarget::FacadeHigh, 5.0f, 32.f, 9.f,
		TEXT("A tracer round drills through the facade and bursts inside, blowing the floor out from within."), TEXT("An instant tracer; a thin penetration capsule, then a delayed blast seven metres inside that throws walls and windows outward."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector From = Ground(A.Point + Outward(A) * 4200.0, 220.0);
			D.FX()->Fireball(From, 120.f, 0.3f, 0.9f);
			D.FX()->DustBurst(Ground(From, 80), 220.f, 0.8f, TEXT("asphalt"));
			D.FX()->Sound(TEXT("tank_fire"), From, 1.f, 1.f);
			FFlight F;
			F.Mesh = TEXT("tl_tankshell");
			F.From = From;
			F.Velocity = (A.Point - From).GetSafeNormal() * 16000.0;
			F.Gravity = 0.f;
			F.Scale = 1.4f;
			F.Trail = [Dp](const FVector& P, const FVector& V, float) { Dp->FX()->Beam(P - V.GetSafeNormal() * 600.0, P, 5.f, FLinearColor(1.f, 0.6f, 0.2f), 70000.f, 0.07f); };
			F.Hit = [Dp](const FVector& P, const FVector& N, int32, const FVector& V)
			{
				const FVector Dir = V.GetSafeNormal();
				Pierce(*Dp, P - Dir * 20.0, P + Dir * 800.0, 80.f, 2200.f, 10);
				Dp->FX()->Sparks(P, N * 1200.0, 130);
				Dp->FX()->Sound(TEXT("clang"), P, 0.8f, 1.3f);
				Dp->After(0.16f, [Dp, P, Dir]()
				{
					const FVector In = P + Dir * 720.0;
					FBlast B;
					B.Radius = 640.f;
					B.Glass = 1500.f;
					B.Speed = 1700.f;
					B.Fireball = 380.f;
					B.MaxElements = 90;
					B.Burn = 0.4f;
					B.Smoke = 130.f;
					B.Sound = TEXT("blast_big");
					B.Pitch = 1.12f;
					B.ShakeAmount = 17.f;
					Blast(*Dp, In, B);
					Dp->FX()->Fire(In - FVector(0, 0, 150), 170.f, 12.f);
				});
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("rocket_salvo"), TEXT("Rocket salvo"), 4, TEXT("Artillery"), ENYCTarget::FacadeHigh, 7.0f, 55.f, 18.f,
		TEXT("Sixteen rockets ripple in on smoke trails and stitch the whole front with blasts."), TEXT("Rockets launched a tenth of a second apart with scatter, each with its own flame-and-smoke trail and a small blast."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Out_ = Outward(A);
			const FVector Side = WallTangent(Out_);
			const FVector Base = Ground(A.Point + Out_ * 5200.0 + Side * 1800.0, 260.0);
			Repeat(D, 16, 0.115f, 0.3f, [Dp, A, Base, Side](int32 i)
			{
				const FVector Target = A.Point + Side * Dp->Random().FRandRange(-1300.f, 1300.f) + FVector(0, 0, Dp->Random().FRandRange(-500.f, 900.f));
				const FVector From = Base + Side * ((i % 8) * 90.0) + FVector(0, 0, (i / 8) * 90.0);
				FFlight F;
				F.Mesh = TEXT("tl_rocket");
				F.From = From;
				F.Velocity = Lob(From, Target, 0.95f, 0.5f);
				F.Gravity = 0.5f;
				F.Trail = SmokeTrail(*Dp, 34.f, 2.6f, FLinearColor(0.55f, 0.53f, 0.5f), 0.045f, 1.f);
				F.Hit = [Dp, i](const FVector& P, const FVector& N, int32, const FVector&)
				{
					FBlast B;
					B.Radius = 230.f;
					B.Glass = 750.f;
					B.Speed = 1300.f;
					B.Fireball = 160.f;
					B.Dust = 0.65f;
					B.MaxElements = 12;
					B.Flash = i % 5 == 0 ? 1.f : 0.f;
					B.Sound = TEXT("blast_small");
					B.Volume = 0.85f;
					B.ShakeAmount = 6.f;
					Blast(*Dp, P + N * 30.0, B);
				};
				Fly(*Dp, F);
				Dp->FX()->Sound(TEXT("rocket_launch"), From, 0.65f, Dp->Random().FRandRange(0.9f, 1.15f));
				Dp->FX()->SmokeColumn(From, 60.f, 1.f, 0.1f);
			});
		}));

	Out.Add(Tool(TEXT("plunging_rocket"), TEXT("Heavy plunging rocket"), 4, TEXT("Artillery"), ENYCTarget::Roof, 8.0f, 70.f, 28.f,
		TEXT("One big rocket climbs out of sight, tips over and dives through the roof; the blast comes from floors below."), TEXT("A guided path: boost, apex, steep dive; it cuts down through the roof, waits a fraction and detonates inside the building."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector From = Ground(A.Point - Flat(A.Dir) * 5200.0 + WallTangent(Flat(A.Dir)) * 3500.0, 120.0);
			const FVector Apex = (From + A.Point) * 0.5 + FVector(0, 0, FMath::Max(9000.0, A.Point.Z + 5000.0));
			UStaticMeshComponent* R = Prop(D, TEXT("tl_bigrocket"), From, FQuat::Identity, 1.f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(R);
			TFunction<void(const FVector&, const FVector&, float)> Trail = SmokeTrail(D, 90.f, 6.f, FLinearColor(0.62f, 0.6f, 0.57f), 0.06f, 1.2f);
			TSharedRef<bool> Done = MakeShared<bool>(false);
			D.FX()->Sound(TEXT("rocket_big"), From, 1.f, 1.f);
			D.During(3.6f, [Dp, Weak, From, Apex, A, Trail, Done](float T, float)
			{
				if (*Done || !Weak.IsValid()) return;
				const float U = FMath::Clamp(T / 3.4f, 0.f, 1.f);
				const double K = U * U * 0.55 + U * 0.45;
				const FVector P = FMath::Lerp(FMath::Lerp(From, Apex, K), FMath::Lerp(Apex, A.Point, K), K);
				const double K2 = FMath::Min(K + 0.01, 1.0);
				const FVector Next = FMath::Lerp(FMath::Lerp(From, Apex, K2), FMath::Lerp(Apex, A.Point, K2), K2);
				const FVector Dir = (Next - P).GetSafeNormal(UE_SMALL_NUMBER, FVector(0, 0, -1));
				Weak->SetWorldLocationAndRotation(P, Facing(Dir));
				Trail(P - Dir * 280.0, Dir * 3000.0, T);
				if (U >= 1.f)
				{
					*Done = true;
					Dp->FX()->RemoveMesh(Weak.Get());
					Pierce(*Dp, A.Point + FVector(0, 0, 200), A.Point - FVector(0, 0, 900), 170.f, 1800.f, 16);
					Dp->FX()->Sound(TEXT("crash_heavy"), A.Point, 1.f, 1.3f);
					const FVector In = FVector(A.Point.X, A.Point.Y, FMath::Max(250.0, A.Point.Z - 850.0));
					Dp->After(0.28f, [Dp, In]()
					{
						FBlast B;
						B.Radius = 760.f;
						B.Glass = 2400.f;
						B.Speed = 2100.f;
						B.Fireball = 560.f;
						B.MaxElements = 170;
						B.Burn = 0.5f;
						B.Smoke = 220.f;
						B.Sound = TEXT("blast_huge");
						B.ShakeAmount = 28.f;
						B.bShock = true;
						Blast(*Dp, In, B);
						Dp->FX()->Fire(In, 220.f, 16.f);
					});
				}
			});
		}));

	Out.Add(Tool(TEXT("howitzer"), TEXT("Howitzer battery"), 4, TEXT("Artillery"), ENYCTarget::Street, 7.0f, 60.f, 20.f,
		TEXT("A single heavy round screams in: a deep crater, a column of earth and every window for a block."), TEXT("Delayed arrival heard before it is seen; large ground blast with crater, soil fountain, shock shell and a lingering smoke column."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			D.FX()->Sound(TEXT("cannon_far"), A.Origin - Flat(A.Dir) * 8000.0, 0.9f, 0.8f);
			D.After(1.1f, [Dp, A]()
			{
				Dp->FX()->Sound(TEXT("whistle_down"), A.Point, 1.f, 0.75f);
				Incoming(*Dp, A, A.Point, TEXT("tl_howitzer"), 1.6f, 1.15f, 1.f, [Dp](const FVector& P, const FVector& N, int32, const FVector&)
				{
					FBlast B;
					B.Radius = 780.f;
					B.Glass = 3600.f;
					B.Speed = 2200.f;
					B.Fireball = 360.f;
					B.Crater = P.Z < 300.f ? 520.f : 0.f;
					B.Dust = 1.2f;
					B.Smoke = 180.f;
					B.MaxElements = 120;
					B.Sound = TEXT("blast_big");
					B.ShakeAmount = 30.f;
					B.bShock = true;
					Blast(*Dp, P + N * 60.0, B);
					Dp->FX()->Chips(P, FVector(0, 0, 2800), 500, FLinearColor(0.13f, 0.09f, 0.055f), 2.f, 14.f, 26.f);
					for (int32 i = 0; i < 5; ++i)
					{
						FNYCPuff Q;
						Q.Pos = P + FVector(0, 0, 150 + i * 120);
						Q.Vel = FVector(Dp->Random().FRandRange(-200.f, 200.f), Dp->Random().FRandRange(-200.f, 200.f), 1500.f + 380.f * i);
						Q.Drag = 1.3f;
						Q.R0 = 130.f;
						Q.R1 = 460.f + 60.f * i;
						Q.Life = 7.f;
						Q.Density = 1.1f;
						Q.Albedo = FLinearColor(0.11f, 0.08f, 0.055f);
						Q.NoiseM = 2.6f;
						Dp->FX()->AddPuff(Q);
					}
				}, false);
			});
		}));

	Out.Add(Tool(TEXT("naval_broadside"), TEXT("Naval broadside"), 4, TEXT("Artillery"), ENYCTarget::District, 9.0f, 75.0f, 30.0f,
		TEXT("Nine battleship shells walk down the avenue in a rolling line of explosions."), TEXT("Nine very large shells arriving in sequence along a straight line, each a heavy blast with crater, shock shell and structural damage."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			D.FX()->Sound(TEXT("cannon_far"), A.Origin - Flat(A.Dir) * 20000.0, 1.f, 0.55f);
			Repeat(D, 9, 0.27f, 1.0f, [Dp, A, Along](int32 i)
			{
				const FVector T = Ground(A.Point + Along * ((i - 4) * 1500.0) + WallTangent(Along) * Dp->Random().FRandRange(-1100.f, 1100.f));
				Incoming(*Dp, A, T + FVector(0, 0, 100), TEXT("tl_navalshell"), 1.4f, 1.0f, 1.f, [Dp, i](const FVector& P, const FVector& N, int32, const FVector&)
				{
					FBlast B;
					B.Radius = 800.f;
					B.Glass = 2600.f;
					B.Speed = 2200.f;
					B.Fireball = 520.f;
					B.Crater = P.Z < 300.f ? 470.f : 0.f;
					B.Dust = 1.1f;
					B.Smoke = i % 3 == 0 ? 210.f : 0.f;
					B.MaxElements = 70;
					B.Flash = i % 3 == 0 ? 1.f : 0.f;
					B.Sound = TEXT("blast_big");
					B.Pitch = 0.9f;
					B.ShakeAmount = 22.f;
					B.bShock = i % 2 == 0;
					Blast(*Dp, P + N * 70.0, B);
				}, true);
			});
		}));

	Out.Add(Tool(TEXT("thermobaric"), TEXT("Fuel-air bomb"), 4, TEXT("Ordnance"), ENYCTarget::District, 8.5f, 95.f, 36.f,
		TEXT("A mist of fuel fills the intersection, then ignites: a vast soft fireball, a pressure wave that sucks glass out and slams back."), TEXT("A canister bursts into a spreading aerosol (mist volumes), then a huge slow fireball with two glass waves, outward then inward, and interior damage to every front around."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point, 650.0);
			Drop(D, TEXT("tl_thermobaric"), C, 4200.f, 1.3f, 40.f, [Dp, C](const FVector&, const FVector&, int32, const FVector&)
			{
				Dp->FX()->Sound(TEXT("hiss"), C, 1.f, 0.55f);
				for (int32 i = 0; i < 16; ++i)
				{
					FNYCPuff Q;
					const double Ang = i / 16.0 * 2.0 * PI;
					Q.Pos = C;
					Q.Vel = FVector(FMath::Cos(Ang), FMath::Sin(Ang), Dp->Random().FRandRange(-0.3f, 0.25f)) * Dp->Random().FRandRange(900.f, 2400.f);
					Q.Drag = 1.6f;
					Q.R0 = 150.f;
					Q.R1 = 780.f;
					Q.Life = 2.0f;
					Q.FadeIn = 0.2f;
					Q.Density = 0.5f;
					Q.Kind = ENYCVol::Mist;
					Q.Albedo = FLinearColor(0.62f, 0.64f, 0.66f);
					Q.NoiseM = 2.2f;
					Dp->FX()->AddPuff(Q);
				}
				Dp->After(1.35f, [Dp, C]()
				{
					Dp->FX()->Fireball(C, 1700.f, 2.1f, 1.4f);
					Dp->FX()->ShockDome(C, 9000.f, 6500.f, 0.8f);
					Dp->FX()->GroundRing(Ground(C), 5200.f, 3800.f, 0.9f, TEXT("concrete"));
					Dp->ShatterGlass(C, 7500.f, 1700.f, 700);
					FNYCDamage H;
					H.Center = C;
					H.Radius = 1850.f;
					H.GlassRadius = 0.f;
					H.Speed = 1100.f;
					H.bFrame = false;
					H.MaxElements = 210;
					H.PropRadius = 3200.f;
					H.PropForce = 0.8f;
					H.Fire = 0.6f;
					H.ForceLOD = 2;
					Dp->ApplyDamage(H);
					Dp->FX()->Sound(TEXT("blast_huge"), C, 1.3f, 0.8f);
					Dp->Shake(C, 40.f, 2.4f);
					// the vacuum behind the front drags the loose pieces back
					Dp->After(0.75f, [Dp, C]()
					{
						Dp->KickDebris(C, 3600.f, -900.f, 100.f, false);
						Dp->FX()->Sound(TEXT("suck_back"), C, 1.f, 1.f);
						Dp->FX()->Litter(C, FVector(0, 0, 900), 400);
					});
					for (int32 i = 0; i < 6; ++i) Dp->FX()->Fire(Ground(C) + FVector(Dp->Random().FRandRange(-1700.f, 1700.f), Dp->Random().FRandRange(-1700.f, 1700.f), 40), 170.f, 18.f);
				});
			});
		}));

	Out.Add(Tool(TEXT("bunker_buster"), TEXT("Earth-penetrating bomb"), 4, TEXT("Ordnance"), ENYCTarget::Street, 11.0f, 85.f, 30.f,
		TEXT("A long steel bomb vanishes into the street. Then the ground heaves from underneath and the buildings around lose their footings."), TEXT("Penetrator punches a small hole; after a pause a buried blast lifts pavement over a wide disc and removes the ground-floor structure of the buildings in reach, which collapse."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector P = Ground(A.Point);
			Drop(D, TEXT("tl_penetrator"), P, 7000.f, 1.2f, 0.f, [Dp, P](const FVector&, const FVector&, int32, const FVector&)
			{
				Dp->MakeCrater(P, 150.f, 90.f);
				Dp->FX()->Chips(P, FVector(0, 0, 1500), 120, FLinearColor(0.1f, 0.085f, 0.07f), 1.f, 8.f, 22.f);
				Dp->FX()->DustBurst(P + FVector(0, 0, 90), 160.f, 0.9f, TEXT("asphalt"));
				Dp->FX()->Sound(TEXT("pile_hit"), P, 1.f, 0.65f);
				Dp->Shake(P, 8.f, 0.5f);
				Dp->After(1.5f, [Dp, P]()
				{
					Dp->FX()->Sound(TEXT("blast_deep"), P, 1.4f, 1.f);
					Dp->Shake(P, 48.f, 3.2f);
					Dp->MakeCrater(P + FVector(1, 1, 0), 1250.f, 430.f);
					Dp->SpawnLumps(P + FVector(0, 0, 60), FVector(0, 0, 1), 90, 105.f, TEXT("concrete"), 1900.f, 0.55f);
					Dp->SpawnLumps(P + FVector(0, 0, 40), FVector(0, 0, 1), 60, 80.f, TEXT("soil"), 2300.f, 0.4f);
					Dp->FX()->Chips(P, FVector(0, 0, 2600), 700, FLinearColor(0.14f, 0.1f, 0.065f), 3.f, 18.f, 38.f);
					Dp->FX()->DustSurge(FBox(P - FVector(900, 900, 0), P + FVector(900, 900, 700)), 5200.f, TEXT("soil"));
					Dp->FX()->GroundRing(P, 4200.f, 3000.f, 0.9f, TEXT("soil"));
					Dp->HitTraffic(P, 1700.f, 1500.f, 0.8f, false, FVector(0, 0, 900));
					FNYCDamage H;
					H.Center = P + FVector(0, 0, 60);
					H.Radius = 0.f;
					H.GlassRadius = 3800.f;
					H.PropRadius = 1900.f;
					H.Speed = 1400.f;
					H.UpKick = 900.f;
					Dp->ApplyDamage(H);
					// footings: what stands within reach loses its ground floor
					TArray<int32> Near;
					Dp->BuildingsNear(P, 3600.f, Near);
					int32 N = 0;
					for (int32 B : Near)
					{
						const FNYCBuildingInfo* I = Dp->Info(B);
						if (!I || N >= 3) continue;
						++N;
						const FVector At = I->Box.GetClosestPointTo(P + FVector(0, 0, 150));
						Dp->After(0.35f + N * 0.5f, [Dp, At, B, P]()
						{
							FNYCDamage F;
							F.Center = At;
							F.Radius = 520.f;
							F.GlassRadius = 900.f;
							F.Speed = 500.f;
							F.MaxElements = 40;
							F.bStructural = false;
							Dp->ApplyDamage(F);
							const FNYCBuildingInfo* I2 = Dp->Info(B);
							const FVector Lean = (P - FVector(I2->Rect.GetCenter().X, I2->Rect.GetCenter().Y, 0)).GetSafeNormal2D();
							Dp->CollapseBuilding(B, 1, I2->Height > 6000.f ? 2 : 1, Lean, 0.4f);
						});
					}
				});
			});
		}));

	Out.Add(Tool(TEXT("ripple_charges"), TEXT("Buried charge grid"), 4, TEXT("Demolition charge"), ENYCTarget::Street, 7.0f, 48.f, 22.f,
		TEXT("Thirty-six charges under the intersection fire outward in rings, leaving the roadway ploughed like a field."), TEXT("A grid of small buried blasts timed by distance from the centre, each cutting its own crater and throwing paving; cars are tossed as the ripple passes."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("beep"), C, 1.f, 0.7f);
			for (int32 i = 0; i < 36; ++i)
			{
				const int32 Gx = i % 6, Gy = i / 6;
				const FVector P = C + FVector((Gx - 2.5) * 420.0 + (Gy % 2) * 90.0, (Gy - 2.5) * 420.0, 0);
				const float Delay = 0.8f + (float)FVector::Dist2D(P, C) / 900.f + (i % 3) * 0.03f;
				D.After(Delay, [Dp, P, i]()
				{
					if (i % 3 == 0) Dp->MakeCrater(P, 165.f, 60.f);
					Dp->SpawnLumps(P + FVector(0, 0, 28), FVector(0, 0, 1), 4, 46.f, i % 2 ? TEXT("concrete") : TEXT("granite_black"), 1250.f, 0.35f);
					Dp->FX()->Fireball(P + FVector(0, 0, 60), 110.f, 0.4f, i % 7 == 0 ? 0.8f : 0.f);
					Dp->FX()->Chips(P, FVector(0, 0, 1700), 70, FLinearColor(0.12f, 0.09f, 0.06f), 1.5f, 9.f, 24.f);
					Dp->FX()->DustBurst(P + FVector(0, 0, 90), 170.f, 0.7f, TEXT("soil"));
					FNYCDamage H;
					H.Center = P + FVector(0, 0, 40);
					H.Radius = 150.f;
					H.GlassRadius = 650.f;
					H.PropRadius = 360.f;
					H.Speed = 900.f;
					H.UpKick = 800.f;
					H.MaxElements = 8;
					Dp->ApplyDamage(H);
					Dp->FX()->Sound(TEXT("blast_small"), P, 0.85f, 0.85f + 0.01f * i);
					Dp->Shake(P, 7.f, 0.35f);
				});
			}
		}));
}
