// Tier 7: invented technology.  Every one of these has its own way of taking matter apart.
#include "NYCToolKit.h"
#include "NYCLightField.h"
#include "EngineUtils.h"

using namespace NYCT;

namespace
{
	/** Tears something off a front near `Centre` and sends it toward `Toward`. */
	void Rip(ANYCDestruction& D, const FVector& Centre, const FVector& Toward, float Reach, float Radius, float Speed, float MaxHeight)
	{
		const float Ang = D.Random().FRandRange(0.f, 6.283f);
		FVector Point, Normal;
		int32 B = INDEX_NONE;
		const FVector From(Centre.X, Centre.Y, D.Random().FRandRange(250.f, MaxHeight));
		if (D.Trace(From, FVector(FMath::Cos(Ang), FMath::Sin(Ang), 0), Reach, Point, Normal, &B) < 0.f || B == INDEX_NONE) return;
		FNYCDamage H;
		H.Center = Point;
		H.Radius = Radius;
		H.GlassRadius = Radius * 2.2f;
		H.Speed = Speed * 0.3f;
		H.bRadial = false;
		H.Push = (Toward - Point).GetSafeNormal() * Speed;
		H.MaxElements = 12;
		H.PropRadius = 0.f;
		H.bStructural = true;
		H.Dust = 0.35f;
		D.ApplyDamage(H);
		D.FX()->DustBurst(Point + Normal * 40.0, Radius * 0.7f, 0.4f, WallOf(D, B));
	}
}

void NYCArsenal::RegisterAlien(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("plasma_cutter"), TEXT("Plasma lance"), 7, TEXT("Alien technology"), ENYCTarget::FacadeHigh, 9.0f, 38.f, 12.f,
		TEXT("A white-hot lance slices clean through a building at one floor; the glowing cut sags, and everything above slides off."), TEXT("A moving beam ray-cast onto the front, cutting a narrow band of elements and leaving a cooling molten line with dripping sparks; then the storeys above the cut shear sideways as rigid clusters."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 B = A.Building;
			const FNYCBuildingInfo* I = D.Info(B);
			const FVector N = Outward(A);
			const FVector T = WallTangent(N);
			const float FloorH = I ? FMath::Max(I->FloorH, 300.f) : 350.f;
			const float CutZ = FMath::Clamp((float)A.Point.Z, FloorH * 1.5f, I ? FMath::Max(I->Height - FloorH * 1.2f, FloorH * 1.6f) : 3000.f);
			float Half = 800.f;
			if (I) Half = FMath::Clamp((float)(FMath::Abs(T.X) * I->Box.GetExtent().X + FMath::Abs(T.Y) * I->Box.GetExtent().Y), 300.f, 1700.f);
			const FVector Mid = I ? FVector(FMath::Abs(T.X) > 0.5 ? I->Box.GetCenter().X : A.Point.X, FMath::Abs(T.Y) > 0.5 ? I->Box.GetCenter().Y : A.Point.Y, CutZ) : FVector(A.Point.X, A.Point.Y, CutZ);
			const FVector Emitter = FVector(A.Point.X, A.Point.Y, CutZ + 450.f) + N * 1500.0;
			Prop(D, TEXT("tl_gravitygun"), Emitter, Facing(-N), 5.5f, 7.f);
			const FLinearColor Hot(1.f, 0.42f, 0.12f);
			const int32 Beam = D.FX()->Beam(Emitter, Mid - T * Half, 9.f, Hot, 90000.f, 4.4f);
			const int32 Light = D.FX()->Glow(Mid - T * Half + N * 60.0, Hot, 42000.f * D.FX()->GlowScale(), 1600.f, 4.4f, 0.35f);
			TSharedRef<FVector> Last = MakeShared<FVector>(FVector::ZeroVector);
			TSharedRef<int32> Count = MakeShared<int32>(0);
			D.FX()->Sound(TEXT("plasma_cut"), Mid, 1.4f, 1.f);
			D.During(4.3f, [Dp, Beam, Light, Last, Count, Mid, T, N, Half, Emitter](float Time, float)
			{
				const float U = FMath::Clamp((Time - 0.25f) / 3.8f, 0.f, 1.f);
				const FVector Want = Mid + T * FMath::Lerp(-Half, Half, U) + FVector(0, 0, FMath::Sin(U * 31.f) * 6.f);
				FVector Point = Want, Normal = N;
				int32 Hit = INDEX_NONE;
				const FVector Dir = (Want - Emitter).GetSafeNormal();
				if (Dp->Trace(Emitter, Dir, FVector::Dist(Emitter, Want) + 700.f, Point, Normal, &Hit) < 0.f) Point = Want;
				SetBeam(*Dp, Beam, Emitter + Dir * 260.0, Point);
				Dp->FX()->MoveLight(Light, Point + N * 70.0);
				const int32 K = ++*Count;
				if (K % 3 == 0)
				{
					if (!Last->IsZero() && FVector::Dist(*Last, Point) < 600.0)
					{
						// the edge of the cut stays hot and slowly goes out
						Dp->FX()->Beam(*Last + N * 9.0, Point + N * 9.0, 7.f, FLinearColor(1.f, 0.25f, 0.03f), 14000.f, 6.5f - Time);
					}
					*Last = Point;
					FNYCDamage H;
					H.Center = Point - N * 60.0;
					H.Radius = 95.f;
					H.GlassRadius = 170.f;
					H.Speed = 160.f;
					H.bRadial = false;
					H.Push = N * 120.0 + FVector(0, 0, -180);
					H.bStructural = false;
					H.MaxElements = 4;
					H.PropRadius = 0.f;
					H.Dust = 0.1f;
					Dp->ApplyDamage(H);
					Dp->Scar(Point, Normal, 38.f);
				}
				Dp->FX()->Sparks(Point + N * 12.0, N * 260.0 + FVector(0, 0, -120), 14, FLinearColor(1.f, 0.5f, 0.12f), 70.f);
				if (K % 7 == 0)
				{
					FNYCPuff Q;
					Q.Pos = Point + N * 70.0;
					Q.Vel = N * 90.f + FVector(0, 0, 90);
					Q.Rise = FVector(0, 0, 90) + Dp->Wind() * 0.4f;
					Q.R0 = 35.f;
					Q.R1 = 170.f;
					Q.Life = 4.f;
					Q.Density = 0.5f;
					Q.Kind = ENYCVol::Smoke;
					Q.Albedo = FLinearColor(0.2f, 0.19f, 0.18f);
					Q.NoiseM = 0.7f;
					Dp->FX()->AddPuff(Q);
				}
			});
			D.After(4.6f, [Dp, B, CutZ, FloorH, T, Mid]()
			{
				Dp->CollapseBuilding(B, FMath::Max(1, FMath::FloorToInt32(CutZ / FloorH)), 3, T, 0.35f);
				Dp->FX()->Sound(TEXT("steel_groan"), Mid, 1.5f, 0.85f);
			});
		}));

	Out.Add(Tool(TEXT("gravity_gun"), TEXT("Gravity gun"), 7, TEXT("Alien technology"), ENYCTarget::Car, 9.0f, 20.f, 6.f,
		TEXT("Plucks a parked car off the kerb, holds it hovering in a cyan field and fires it through the nearest wall; then does it again."), TEXT("A real simulated car body is made weightless and servoed to a hold point with a tether beam, then launched at over 200 km/h; its path is ray-tested each step so it smashes the front it reaches."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Muzzle = Hand(A);
			Prop(D, TEXT("tl_gravitygun"), Muzzle, Facing(A.Dir), 0.8f, 8.5f);
			const FVector Hold = A.Origin + A.Dir * 750.0 + FVector(0, 0, 330);
			const FLinearColor Cyan(0.15f, 0.85f, 1.f);
			for (int32 Shot = 0; Shot < 3; ++Shot)
			{
				D.After(Shot * 2.5f + 0.1f, [Dp, A, Muzzle, Hold, Cyan, Shot]()
				{
					int32 Body = INDEX_NONE;
					const int32 Car = Dp->FindProp(A.Point, ANYCDestruction::MCar, 2600.f);
					if (Car != INDEX_NONE) Body = Loose(*Dp, Car, FVector(0, 0, 200), FVector(0, 0, 20));
					if (Body == INDEX_NONE)
					{
						const int32 Box = Dp->FindProp(A.Point, ANYCDestruction::MBox | ANYCDestruction::MStall | ANYCDestruction::MPole, 2600.f);
						if (Box != INDEX_NONE) Body = Loose(*Dp, Box, FVector(0, 0, 220), FVector(0, 0, 40));
					}
					if (Body == INDEX_NONE) return;
					if (UStaticMeshComponent* R = Dp->BodyRoot(Body)) R->SetEnableGravity(false);
					const int32 Tether = Dp->FX()->Beam(Muzzle, Hold, 5.f, Cyan, 16000.f, 1.7f);
					const int32 Light = Dp->FX()->Glow(Hold, Cyan, 12000.f * Dp->FX()->GlowScale(), 900.f, 1.7f, 0.2f);
					Dp->FX()->Sound(TEXT("grav_hold"), Hold, 1.2f, 1.f + Shot * 0.1f);
					TSharedRef<FVector> Last = MakeShared<FVector>(FVector::ZeroVector);
					TSharedRef<bool> Fired = MakeShared<bool>(false), Spent = MakeShared<bool>(false);
					Dp->During(4.2f, [Dp, A, Muzzle, Hold, Body, Tether, Light, Last, Fired, Spent, Cyan, Shot](float T, float Dt)
					{
						UStaticMeshComponent* R = Dp->BodyRoot(Body);
						if (!R) return;
						const FVector P = R->GetComponentLocation();
						if (T < 1.65f)
						{
							if (R->IsSimulatingPhysics())
							{
								const FVector Bob(0, 0, FMath::Sin(T * 7.f) * 22.f);
								R->WakeAllRigidBodies();
								R->SetPhysicsLinearVelocity(FMath::Lerp(R->GetPhysicsLinearVelocity(), (Hold + Bob - P) * 3.4, 0.3));
								R->SetPhysicsAngularVelocityInDegrees(FVector(12, 8, 55));
							}
							SetBeam(*Dp, Tether, Muzzle, P);
							Dp->FX()->MoveLight(Light, P);
							if (FMath::Fmod(T, 0.12f) < Dt) Dp->FX()->Motes(P, 12, Cyan, 240.f, 60.f, 0.7f, 4.f);
						}
						else if (!*Fired)
						{
							*Fired = true;
							*Last = P;
							// at the wall behind where the player is looking, spread a little between shots
							FVector Target = A.Point + WallTangent(A.Dir) * ((Shot - 1) * 450.0) + FVector(0, 0, 250 + Shot * 220);
							FVector Point, Normal;
							int32 Hit = INDEX_NONE;
							if (Dp->Trace(P, (Target - P).GetSafeNormal(), 12000.f, Point, Normal, &Hit) >= 0.f) Target = Point;
							if (R->IsSimulatingPhysics())
							{
								R->SetEnableGravity(true);
								R->SetUseCCD(true);
								R->SetPhysicsLinearVelocity((Target - P).GetSafeNormal() * 6200.0 + FVector(0, 0, 150));
							}
							Dp->FX()->ShockDome(P, 600.f, 2600.f, 0.6f, Cyan);
							Dp->FX()->Sound(TEXT("grav_fire"), P, 1.6f, 1.f);
							Dp->Shake(Muzzle, 9.f, 0.35f);
						}
						else if (!*Spent)
						{
							const FVector Step = P - *Last;
							const double Len = Step.Size();
							if (Len < 5.0) return;
							FVector Point, Normal;
							int32 Hit = INDEX_NONE;
							if (Dp->Trace(*Last, Step / Len, (float)Len + 260.f, Point, Normal, &Hit) >= 0.f && Hit != INDEX_NONE)
							{
								*Spent = true;
								const FVector In = Step / Len;
								FNYCDamage H;
								H.Center = Point + In * 150.0;
								H.Radius = 430.f;
								H.GlassRadius = 1200.f;
								H.Speed = 1300.f;
								H.Push = In * 900.0;
								H.MaxElements = 160;
								Dp->ApplyDamage(H);
								Dp->FX()->DustBurst(Point + Normal * 100.0, 420.f, 1.f, WallOf(*Dp, Hit));
								Dp->FX()->GlassBurst(Point + Normal * 80.0, Normal * 700.0, FVector2D(300, 200));
								Dp->FX()->Sparks(Point, Normal * 900.0, 130);
								Dp->FX()->Fire(Point + Normal * 60.0, 110.f, 12.f);
								Dp->FX()->Sound(TEXT("crash_heavy"), Point, 1.6f, 1.05f);
								Dp->Shake(Point, 20.f, 0.8f);
								if (R->IsSimulatingPhysics()) R->SetPhysicsLinearVelocity(Normal * 350.0 + FVector(0, 0, 100));
							}
							*Last = P;
						}
					});
				});
			}
		}));

	Out.Add(Tool(TEXT("sonic_disruptor"), TEXT("Sonic disruptor"), 7, TEXT("Alien technology"), ENYCTarget::Facade, 8.0f, 30.f, 9.f,
		TEXT("A resonance dish pulses a rising note: first the panes burst, then loose things walk and buzz, then the masonry itself shakes apart."), TEXT("Visible pressure rings built from beam segments travel from the dish to the wall; each pulse widens the window-breaking radius and the last two turn into structural damage."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector Base = Ground(A.Point + N * 1500.0);
			Prop(D, TEXT("tl_sonicdish"), Base, Facing(-N), 1.5f);
			const FVector Mouth = Base + FVector(0, 0, 290) - N * 110.0;
			const FVector To = A.Point;
			for (int32 i = 0; i < 9; ++i)
			{
				const float Start = 0.4f + i * 0.58f - i * i * 0.012f;
				D.After(Start, [Dp, Mouth, To, N, A, i]()
				{
					const FVector Axis = (To - Mouth).GetSafeNormal();
					const FVector U = WallTangent(Axis), V = FVector::CrossProduct(Axis, U);
					TArray<int32> Ring;
					const FLinearColor Colour(0.55f, 0.82f, 1.f);
					for (int32 k = 0; k < 24; ++k) Ring.Add(Dp->FX()->Beam(Mouth, Mouth + U, 3.5f, Colour, 2600.f, 0.62f));
					Dp->During(0.6f, [Dp, Ring, Mouth, To, Axis, U, V, i](float T, float)
					{
						const float W = FMath::Clamp(T / 0.58f, 0.f, 1.f);
						const FVector C = FMath::Lerp(Mouth, To, (double)W);
						const float R = FMath::Lerp(90.f, 330.f + i * 55.f, W);
						for (int32 k = 0; k < Ring.Num(); ++k)
						{
							const float A0 = k * UE_TWO_PI / Ring.Num(), A1 = (k + 0.86f) * UE_TWO_PI / Ring.Num();
							const float J0 = 1.f + 0.05f * FMath::Sin(A0 * 7.f + T * 60.f);
							SetBeam(*Dp, Ring[k], C + (U * FMath::Cos(A0) + V * FMath::Sin(A0)) * R * J0, C + (U * FMath::Cos(A1) + V * FMath::Sin(A1)) * R * J0);
						}
					});
					Dp->FX()->Sound(TEXT("sonic_pulse"), Mouth, 1.1f, 0.7f + i * 0.085f);
					Dp->After(0.58f, [Dp, To, N, A, i]()
					{
						Dp->ShatterGlass(To, 260.f + i * 240.f, 420.f + i * 60.f, 8 + i * 12);
						Dp->FX()->DustBurst(To + N * 50.0, 90.f + i * 38.f, 0.3f + i * 0.07f, WallOf(*Dp, A.Building));
						for (int32 k = 0; k < i; ++k)
						{
							const FVector S = To + WallTangent(N) * Dp->Random().FRandRange(-90.f - i * 60.f, 90.f + i * 60.f) + FVector(0, 0, Dp->Random().FRandRange(-100.f, 100.f + i * 55.f));
							FVector Point, Normal;
							if (Dp->Trace(S + N * 300.0, -N, 600.f, Point, Normal, nullptr) >= 0.f) Dp->Scar(Point, Normal, Dp->Random().FRandRange(14.f, 34.f));
						}
						Dp->KickDebris(To, 600.f + i * 120.f, 60.f + i * 22.f, 90.f + i * 20.f, false);
						if (i >= 4)
						{
							FNYCDamage H;
							H.Center = To + FVector(0, 0, (i - 6) * 130.0);
							H.Radius = 90.f + (i - 4) * 75.f;
							H.GlassRadius = 0.f;
							H.Speed = 260.f + (i - 4) * 90.f;
							H.UpKick = 120.f;
							H.MaxElements = 20 + (i - 4) * 22;
							H.PropRadius = (i - 4) * 230.f;
							H.Dust = 0.7f;
							Dp->ApplyDamage(H);
						}
						Dp->Shake(To, 2.f + i * 2.2f, 0.45f);
					});
				});
			}
		}));

	Out.Add(Tool(TEXT("cryo_bomb"), TEXT("Cryo bomb"), 7, TEXT("Alien technology"), ENYCTarget::GroundFloor, 7.0f, 22.f, 6.f,
		TEXT("A burst of impossible cold: frost mist rolls out, crystals erupt over the street and the frozen storefront shatters like glass."), TEXT("A lobbed canister, ground-hugging mist volumes, ice crystal meshes that grow over the surfaces found by ray casts, then a low-velocity brittle fracture whose pieces take an ice material."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_cryo");
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point, 0.9f);
			F.Spin = 500.f;
			F.bAlign = false;
			F.ArmDelay = 0.1f;
			D.FX()->Sound(TEXT("sling"), F.From, 0.6f, 1.2f);
			F.Hit = [Dp](const FVector& P, const FVector& N, int32 B, const FVector&)
			{
				const FVector C = P + N * 60.0;
				const FLinearColor Frost(0.55f, 0.8f, 1.f);
				Dp->FX()->Sound(TEXT("freeze"), C, 1.6f, 1.f);
				Dp->FX()->Glow(C + FVector(0, 0, 150), Frost, 9000.f * Dp->FX()->GlowScale(), 1400.f, 4.5f, 0.1f);
				for (int32 i = 0; i < 16; ++i)
				{
					const float Ang = i * 2.4f;
					FNYCPuff Q;
					Q.Pos = Ground(C, 90.0);
					Q.Vel = FVector(FMath::Cos(Ang), FMath::Sin(Ang), 0) * Dp->Random().FRandRange(300.f, 950.f);
					Q.Drag = 1.5f;
					Q.R0 = 90.f;
					Q.R1 = Dp->Random().FRandRange(220.f, 420.f);
					Q.Squash = 0.45f;
					Q.Life = Dp->Random().FRandRange(4.f, 7.5f);
					Q.Density = 0.6f;
					Q.Kind = ENYCVol::Mist;
					Q.Albedo = FLinearColor(0.78f, 0.87f, 0.95f);
					Q.NoiseM = 1.4f;
					Q.bGroundHug = true;
					Dp->FX()->AddPuff(Q);
				}
				Dp->FX()->Motes(C, 240, Frost, 260.f, 520.f, 3.f, 3.5f, FVector(0, 0, -90));
				// crystals take hold wherever the cold reached a surface
				struct FIce { TWeakObjectPtr<UStaticMeshComponent> Mesh; FVector At; float Size, Delay; };
				TSharedRef<TArray<FIce>> Ice = MakeShared<TArray<FIce>>();
				for (int32 i = 0; i < 120 && Ice->Num() < 75; ++i)
				{
					FVector Dir = Dp->Random().VRand();
					Dir.Z = -FMath::Abs(Dir.Z) * (i % 2 ? 1.0 : -0.35);
					FVector Point, Normal;
					const float T = Dp->Trace(C + FVector(0, 0, 80), Dir.GetSafeNormal(), 640.f, Point, Normal, nullptr);
					if (T < 0.f) continue;
					const FQuat Q = FQuat::FindBetweenNormals(FVector::UpVector, Normal) * FQuat(FVector::UpVector, Dp->Random().FRandRange(0.f, 6.28f));
					UStaticMeshComponent* M = Prop(*Dp, TEXT("tl_icecrystal"), Point, Q, 0.02f);
					Ice->Add({ M, Point, (float)Dp->Random().FRandRange(0.28f, 1.05f), (float)(T / 900.f) });
				}
				Dp->During(1.9f, [Ice](float T, float)
				{
					for (const FIce& I : *Ice)
					{
						if (!I.Mesh.IsValid()) continue;
						const float U = FMath::Clamp((T - I.Delay) / 0.9f, 0.f, 1.f);
						I.Mesh->SetWorldScale3D(FVector(0.02f + I.Size * (1.f - FMath::Pow(1.f - U, 3.f))));
					}
				});
				Dp->After(2.5f, [Dp, C, Ice, N, B]()
				{
					FNYCDamage H;
					H.Center = C - N * 60.0;
					H.Radius = 440.f;
					H.GlassRadius = 900.f;
					H.Speed = 190.f;
					H.UpKick = 60.f;
					H.PropRadius = 0.f;
					H.Skin = TEXT("ice_clear");
					H.MaxElements = 90;
					H.Dust = 0.f;
					Dp->ApplyDamage(H);
					TArray<int32> Near;
					Dp->CollectProps(C, 640.f, Near);
					int32 Count = 0;
					for (int32 P : Near)
					{
						const FVector At = Dp->PropLocation(P);
						Dp->LaunchProp(P, (At - C).GetSafeNormal2D() * 260.0 + FVector(0, 0, 160), Dp->Random().VRand() * 90.0, true, false);
						if (++Count >= 6) break;
					}
					Dp->HitTraffic(C, 560.f, 160.f, 0.5f, false, FVector::ZeroVector);
					int32 K = 0;
					for (const FIce& I : *Ice)
					{
						if (!I.Mesh.IsValid()) continue;
						if (++K % 3 != 0)
						{
							Dp->FX()->Chips(I.At, (I.At - C).GetSafeNormal() * 300.0 + FVector(0, 0, 180), 10, FLinearColor(0.72f, 0.86f, 0.95f), 1.5f, 8.f, 120.f);
							Dp->FX()->RemoveMesh(I.Mesh.Get());
						}
					}
					Dp->SpawnLumps(C, FVector(0, 0, 1), 34, 26.f, TEXT("ice_clear"), 480.f, 1.3f, 2.f);
					Dp->FX()->Sound(TEXT("ice_shatter"), C, 1.7f, 1.f);
					Dp->Shake(C, 8.f, 0.6f);
				});
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("ufo_tractor"), TEXT("Saucer tractor beam"), 7, TEXT("Alien technology"), ENYCTarget::District, 11.0f, 65.f, 22.f,
		TEXT("A thirty metre saucer slides in over the rooftops and drinks up the street: cars, posts and pieces of buildings spiral up into its belly."), TEXT("An animated craft with a soft volumetric beam; bodies inside the beam are made weightless and pulled up on a spiral until swallowed, while a field lifts loose rubble."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FLinearColor Cyan(0.3f, 0.9f, 1.f);
			const int32 First = D.NumBodies();
			TSharedRef<int32> Count = MakeShared<int32>(0), Wide = MakeShared<int32>(INDEX_NONE), Core = MakeShared<int32>(INDEX_NONE), Light = MakeShared<int32>(INDEX_NONE);
			Saucer(D, C + FVector(0, 0, 4300), 1.25f, 2.0f, 7.2f, [Dp, C, Cyan, First, Count, Wide, Core, Light](const FVector& P, float S, float Dt)
			{
				const FVector Belly = P - FVector(0, 0, 420);
				if (*Wide == INDEX_NONE)
				{
					*Wide = Dp->FX()->Beam(Belly, Ground(P, 15), 60.f, Cyan, 700.f, 7.2f);
					*Core = Dp->FX()->Beam(Belly, Ground(P, 15), 20.f, Cyan, 2600.f, 7.2f);
					*Light = Dp->FX()->Glow(Ground(P, 600), Cyan, 90000.f * Dp->FX()->GlowScale(), 3800.f, 7.2f, 0.15f);
					Dp->FX()->Sound(TEXT("tractor"), Ground(P), 1.4f, 1.f);
				}
				const float Open = FMath::Min(S * 1.6f, 1.f) * FMath::Min((7.2f - S) * 2.f, 1.f);
				SetBeam(*Dp, *Wide, Belly, Ground(P, 15), 520.f * Open);
				SetBeam(*Dp, *Core, Belly, Ground(P, 15), 160.f * Open);
				const int32 K = ++*Count;
				if (S < 6.3f)
				{
					if (K % 3 == 0)
					{
						const int32 Pick = Dp->FindProp(C + FVector(Dp->Random().FRandRange(-1100.f, 1100.f), Dp->Random().FRandRange(-1100.f, 1100.f), 0), 0xFFFFFEFF, 800.f);
						if (Pick != INDEX_NONE)
						{
							const int32 Body = Loose(*Dp, Pick, FVector(0, 0, 420), Dp->Random().VRand() * 70.0);
							if (Body != INDEX_NONE && Dp->BodyRoot(Body)) Dp->BodyRoot(Body)->SetEnableGravity(false);
						}
						Dp->HitTraffic(C, 1000.f, 30.f, 0.05f, false, FVector(0, 0, 650));
						Dp->SetBodiesGravity(C, 1700.f, false, First);
					}
					Dp->DragBodies(Belly + FVector(0, 0, 150), 5200.f, 1150.f, 1150.f, 520.f, 520.f, Dt);
					if (K % 4 == 0) Dp->DragDebris(Belly, 4800.f, 150.f, 130.f, 0.f);
					if (K % 8 == 0) Rip(*Dp, C, Belly, 2600.f, 190.f, 900.f, 2400.f);
					if (K % 30 == 0) { Dp->SpawnLumps(Ground(C, 60) + FVector(Dp->Random().FRandRange(-350.f, 350.f), Dp->Random().FRandRange(-350.f, 350.f), 0), FVector(0, 0, 1), 12, 55.f, TEXT("concrete"), 760.f, 0.18f); }
				}
				if (K % 5 == 0) Dp->FX()->Motes(Ground(P, 120) + FVector(Dp->Random().FRandRange(-400.f, 400.f), Dp->Random().FRandRange(-400.f, 400.f), 0), 20, Cyan, 200.f, 40.f, 2.4f, 4.f, FVector(0, 0, 420));
				Dp->Shake(Ground(P), 2.2f, 0.2f);
			});
			D.After(9.4f, [Dp, C, First]() { Dp->SetBodiesGravity(C, 9000.f, true, First); });
		}));

	Out.Add(Tool(TEXT("ufo_death_ray"), TEXT("Saucer death ray"), 7, TEXT("Alien technology"), ENYCTarget::District, 11.0f, 75.f, 30.f,
		TEXT("The saucer circles the block raking a green beam across street and fronts, leaving a smoking, burning, glowing trail."), TEXT("An orbiting craft whose beam is ray-cast against the city at every step; where it lands elements burst, scorch scars and fires are left, and cars explode."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FLinearColor Green(0.25f, 1.f, 0.3f);
			TSharedRef<int32> Count = MakeShared<int32>(0), Beam = MakeShared<int32>(INDEX_NONE), Light = MakeShared<int32>(INDEX_NONE);
			Saucer(D, C + FVector(0, 0, 5600), 1.1f, 2.0f, 7.0f, [Dp, C, Green, Count, Beam, Light](const FVector& P, float S, float)
			{
				const FVector Muzzle = P - FVector(0, 0, 360);
				// the aim traces a wandering figure over the block, at ground and facade height
				const FVector Sweep = C + FVector(FMath::Sin(S * 1.55f) * 2100.f, FMath::Sin(S * 2.35f + 1.f) * 1700.f, 300.f + (FMath::Sin(S * 1.1f) * 0.5f + 0.5f) * 1500.f);
				FVector Point = Sweep, Normal = FVector::UpVector;
				int32 B = INDEX_NONE;
				if (Dp->Trace(Muzzle, (Sweep - Muzzle).GetSafeNormal(), 20000.f, Point, Normal, &B) < 0.f) Point = Ground(Sweep);
				if (*Beam == INDEX_NONE)
				{
					*Beam = Dp->FX()->Beam(Muzzle, Point, 28.f, Green, 42000.f, 7.0f);
					*Light = Dp->FX()->Glow(Point, Green, 60000.f * Dp->FX()->GlowScale(), 2200.f, 7.0f, 0.4f);
					Dp->FX()->Sound(TEXT("death_ray"), C, 1.5f, 1.f);
				}
				SetBeam(*Dp, *Beam, Muzzle, Point, 8.f + 22.f * FMath::Min(S * 2.f, 1.f));
				Dp->FX()->MoveLight(*Light, Point + Normal * 120.0);
				const int32 K = ++*Count;
				if (K % 3 == 0)
				{
					FNYCDamage H;
					H.Center = Point - Normal * 40.0;
					H.Radius = 230.f;
					H.GlassRadius = 500.f;
					H.Speed = 900.f;
					H.UpKick = 260.f;
					H.Fire = 0.3f;
					H.MaxElements = 12;
					H.Dust = 0.55f;
					Dp->ApplyDamage(H);
					Dp->HitTraffic(Point, 300.f, 600.f, 0.5f, true, FVector(0, 0, 700));
					Dp->Scar(Point, Normal, 85.f);
				}
				Dp->FX()->Sparks(Point + Normal * 15.0, Normal * 750.0, 20, FLinearColor(0.5f, 1.f, 0.35f), 75.f);
				if (K % 12 == 0) Dp->FX()->Fire(Point + Normal * 30.0, 110.f, 9.f);
				if (K % 16 == 0)
				{
					Dp->FX()->Fireball(Point + Normal * 140.0, 170.f, 0.7f, 0.f);
					Dp->FX()->Sound(TEXT("blast_small"), Point, 1.f, 1.2f);
				}
				if (K % 9 == 0) Dp->FX()->SmokeColumn(Point + Normal * 40.0, 70.f, 7.f, 0.8f);
				Dp->Shake(Point, 4.f, 0.2f);
			}, [](float S) { return FVector(FMath::Cos(S * 0.62f + 0.6f) * 2100.f, FMath::Sin(S * 0.62f + 0.6f) * 2100.f, 0.f); });
		}));

	Out.Add(Tool(TEXT("alien_tripod"), TEXT("Tripod walker"), 7, TEXT("Alien technology"), ENYCTarget::District, 12.0f, 80.f, 22.f,
		TEXT("A thirty metre three-legged machine strides up the avenue, crushing what it steps on and burning the fronts with a red heat ray."), TEXT("A procedurally walking tripod: each leg is two segments re-solved every step with a bulging knee; foot plants make craters; the eye fires ray-cast beams that explode where they land."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const FVector Side = WallTangent(Along);
			const FVector Start = Ground(A.Point + Along * 4800.0);
			const FVector March = -Along;          // toward the viewer's side of the street
			struct FLeg { FVector Foot, From, To; float Lift = -1.f; TWeakObjectPtr<UStaticMeshComponent> Upper, Lower, Pad; };
			struct FWalker { FLeg Legs[3]; TWeakObjectPtr<UStaticMeshComponent> Body; FVector At; int32 Next = 0; float Clock = 0.f; int32 Shots = 0; };
			TSharedRef<FWalker> W = MakeShared<FWalker>();
			W->At = Start;
			W->Body = Prop(D, TEXT("tl_tripod"), Start + FVector(0, 0, 2900), Facing(March), 1.35f);
			const FVector Offsets[3] = { March * 900.0, -March * 600.0 + Side * 800.0, -March * 600.0 - Side * 800.0 };
			for (int32 i = 0; i < 3; ++i)
			{
				FLeg& L = W->Legs[i];
				L.Foot = Ground(Start + Offsets[i]);
				L.Upper = Prop(D, TEXT("tl_tripodleg"), L.Foot, FQuat::Identity, 1.f);
				L.Lower = Prop(D, TEXT("tl_tripodleg"), L.Foot, FQuat::Identity, 1.f);
				L.Pad = Prop(D, TEXT("tl_tripodfoot"), L.Foot, FQuat::Identity, 1.f);
			}
			D.FX()->Sound(TEXT("tripod_horn"), Start, 1.8f, 1.f);
			D.During(12.5f, [Dp, W, March, Side, Offsets](float T, float Dt)
			{
				const float Stride = 1.15f;
				W->Clock += Dt;
				W->At += March * (T < 11.f ? 560.0 * Dt : 0.0);
				if (W->Clock >= Stride && T < 11.f)
				{
					W->Clock -= Stride;
					FLeg& L = W->Legs[W->Next];
					L.From = L.Foot;
					L.To = Ground(W->At + Offsets[W->Next] + March * 1250.0 + Side * Dp->Random().FRandRange(-180.f, 180.f));
					L.Lift = 0.f;
					W->Next = (W->Next + 1) % 3;
				}
				for (FLeg& L : W->Legs)
				{
					if (L.Lift < 0.f) continue;
					L.Lift += Dt / 0.9f;
					const float U = FMath::Min(L.Lift, 1.f);
					L.Foot = FMath::Lerp(L.From, L.To, (double)FMath::InterpEaseInOut(0.f, 1.f, U, 2.f));
					L.Foot.Z = FMath::Sin(U * PI) * 1100.f;
					if (L.Lift >= 1.f)
					{
						L.Lift = -1.f;
						L.Foot.Z = 0.0;
						Dp->MakeCrater(L.Foot, 270.f, 70.f);
						FNYCDamage H;
						H.Center = L.Foot + FVector(0, 0, 120);
						H.Radius = 330.f;
						H.GlassRadius = 800.f;
						H.Speed = 900.f;
						H.UpKick = 500.f;
						H.PropRadius = 620.f;
						H.MaxElements = 40;
						Dp->ApplyDamage(H);
						Dp->HitTraffic(L.Foot, 460.f, 400.f, 1.f, false, FVector(0, 0, -200));
						Dp->FX()->GroundRing(L.Foot, 1300.f, 2000.f, 0.6f, TEXT("concrete"));
						Dp->FX()->Sound(TEXT("tripod_step"), L.Foot, 1.6f, Dp->Random().FRandRange(0.9f, 1.08f));
						Dp->Shake(L.Foot, 20.f, 0.7f);
					}
				}
				FVector Middle = (W->Legs[0].Foot + W->Legs[1].Foot + W->Legs[2].Foot) / 3.0;
				const FVector Head = FVector(FMath::Lerp(Middle.X, W->At.X, 0.5), FMath::Lerp(Middle.Y, W->At.Y, 0.5), 2900.0 + FMath::Sin(T * 5.4f) * 80.f);
				const FQuat Look = Facing(March) * FQuat(FRotator(FMath::Sin(T * 2.7f) * 3.f, FMath::Sin(T * 0.9f) * 14.f, FMath::Sin(T * 1.9f) * 3.f));
				if (W->Body.IsValid()) W->Body->SetWorldLocationAndRotation(Head, Look);
				const FVector HipOffsets[3] = { FVector(420, 0, -250), FVector(-260, 360, -250), FVector(-260, -360, -250) };
				for (int32 i = 0; i < 3; ++i)
				{
					FLeg& L = W->Legs[i];
					const FVector Hip = Head + Look.RotateVector(HipOffsets[i]);
					const FVector Ankle = L.Foot + FVector(0, 0, 160);
					const FVector Bulge = (FVector(Ankle.X - Head.X, Ankle.Y - Head.Y, 0)).GetSafeNormal() * 780.0 + FVector(0, 0, 420);
					const FVector Knee = FMath::Lerp(Hip, Ankle, 0.42) + Bulge;
					auto Segment = [](UStaticMeshComponent* M, const FVector& P0, const FVector& P1, float Girth)
					{
						if (!M) return;
						const FVector Span = P1 - P0;
						M->SetWorldTransform(FTransform(FQuat::FindBetweenNormals(FVector(0, 0, -1), Span.GetSafeNormal()), P0, FVector(Girth, Girth, Span.Size() / 100.0)));
					};
					Segment(L.Upper.Get(), Hip, Knee, 13.f);
					Segment(L.Lower.Get(), Knee, Ankle, 9.f);
					if (L.Pad.IsValid()) L.Pad->SetWorldLocationAndRotation(L.Foot, FQuat::Identity);
				}
				// the heat ray
				if (T > 1.2f && T > 1.2f + W->Shots * 1.35f && W->Shots < 8)
				{
					const int32 Shot = W->Shots++;
					const FVector Eye = Head + Look.RotateVector(FVector(800, 0, 40));
					const float Ang = (Shot % 2 ? 1.f : -1.f) * Dp->Random().FRandRange(0.35f, 1.15f);
					const FVector Dir = FQuat(FVector::UpVector, Ang).RotateVector(March);
					FVector Point, Normal;
					int32 B = INDEX_NONE;
					FVector Aim = Eye + Dir * 3200.0;
					Aim.Z = Dp->Random().FRandRange(100.f, 1600.f);
					if (Dp->Trace(Eye, (Aim - Eye).GetSafeNormal(), 14000.f, Point, Normal, &B) < 0.f) Point = Ground(Aim);
					const FLinearColor Red(1.f, 0.09f, 0.04f);
					const int32 Ray = Dp->FX()->Beam(Eye, Point, 16.f, Red, 55000.f, 0.6f);
					Dp->FX()->Glow(Point, Red, 46000.f * Dp->FX()->GlowScale(), 1700.f, 0.7f, 0.3f);
					Dp->FX()->Sound(TEXT("heat_ray"), Point, 1.5f, 1.f);
					Dp->After(0.22f, [Dp, Point, Normal]()
					{
						FBlast X;
						X.Radius = 330.f;
						X.Glass = 1000.f;
						X.Speed = 1200.f;
						X.Fireball = 230.f;
						X.Burn = 0.8f;
						X.Smoke = 110.f;
						X.MaxElements = 70;
						X.Flash = 0.35f;
						X.Sound = TEXT("blast_med");
						Blast(*Dp, Point + Normal * 30.0, X);
						Dp->FX()->Fire(Point + Normal * 30.0, 130.f, 11.f);
					});
				}
			});
		}));

	Out.Add(Tool(TEXT("ion_cannon"), TEXT("Orbital ion cannon"), 7, TEXT("Alien technology"), ENYCTarget::District, 4.4f, 170.0f, 85.0f,
		TEXT("Six guide beams spiral together; then a column of light from orbit bores straight down through whatever is underneath."), TEXT("Converging beams animated into a point, then a widening sky-high column that removes building parts in a vertical cylinder, melts a deep crater and throws a flat shock ring."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FLinearColor Blue(0.4f, 0.68f, 1.f);
			TArray<int32> Guides;
			for (int32 i = 0; i < 6; ++i) Guides.Add(D.FX()->Beam(C + FVector(0, 0, 90000), C, 9.f, Blue, 7000.f, 3.3f));
			D.FX()->Sound(TEXT("ion_charge"), C, 1.6f, 1.f);
			D.During(3.2f, [Dp, C, Guides, Blue](float T, float)
			{
				const float U = FMath::Clamp(T / 3.1f, 0.f, 1.f);
				const float R = 2600.f * (1.f - U * U) + 40.f;
				for (int32 i = 0; i < Guides.Num(); ++i)
				{
					const float Ang = i * UE_TWO_PI / 6.f + U * U * 11.f;
					const FVector Foot = C + FVector(FMath::Cos(Ang) * R, FMath::Sin(Ang) * R, 5);
					SetBeam(*Dp, Guides[i], Foot + FVector(0, 0, 90000), Foot, 6.f + 16.f * U);
					if (FMath::Fmod(T + i * 0.04f, 0.25f) < 0.04f) Dp->FX()->Sparks(Foot, FVector(0, 0, 500), 18, FLinearColor(0.55f, 0.75f, 1.f), 60.f);
				}
				if (FMath::Fmod(T, 0.18f) < 0.045f) Dp->FX()->Motes(C + FVector(0, 0, 100), 40, Blue, R * 0.6f, 60.f, 1.8f, 6.f, FVector(0, 0, 500));
			});
			D.After(3.2f, [Dp, C, Blue]()
			{
				const int32 Column = Dp->FX()->Beam(C + FVector(0, 0, 120000), C, 20.f, Blue, 30000.f, 2.9f);
				const int32 Heart = Dp->FX()->Beam(C + FVector(0, 0, 120000), C, 8.f, FLinearColor(0.9f, 0.96f, 1.f), 90000.f, 2.9f);
				Dp->FX()->Flash(C + FVector(0, 0, 1500), Blue, 2.5e7f * Dp->FX()->GlowScale(), 24000.f, 1.2f, 0.12f);
				Dp->FX()->Glow(C + FVector(0, 0, 700), Blue, 1.2e6f * Dp->FX()->GlowScale(), 9000.f, 2.8f, 0.25f);
				Dp->FX()->Sound(TEXT("ion_fire"), C, 2.f, 1.f);
				Dp->During(2.9f, [Dp, C, Column, Heart](float T, float)
				{
					const float Open = FMath::Min(T / 0.45f, 1.f) * FMath::Clamp((2.9f - T) / 0.7f, 0.f, 1.f);
					const float Throb = 1.f + 0.06f * FMath::Sin(T * 55.f);
					SetBeam(*Dp, Column, C + FVector(0, 0, 120000), C, FMath::Max(4.f, 620.f * Open * Throb));
					SetBeam(*Dp, Heart, C + FVector(0, 0, 120000), C, FMath::Max(2.f, 210.f * Open));
					Dp->Shake(C, 26.f * Open, 0.15f);
				});
				// it eats downward, then outward
				Repeat(*Dp, 11, 0.13f, 0.1f, [Dp, C](int32 i)
				{
					const FVector At = C + FVector(0, 0, 3800.0 - i * 360.0);
					Dp->DissolveElements(At, 640.f + i * 14.f, 130, FLinearColor(0.5f, 0.75f, 1.f), i == 10);
				});
				Dp->After(0.25f, [Dp, C]()
				{
					Dp->MakeCrater(C, 950.f, 520.f);
					FNYCDamage H;
					H.Center = C + FVector(0, 0, 100);
					H.Radius = 1000.f;
					H.GlassRadius = 3600.f;
					H.Speed = 2100.f;
					H.UpKick = 1100.f;
					H.Fire = 0.5f;
					H.MaxElements = 600;
					Dp->ApplyDamage(H);
					Dp->SpawnLumps(C + FVector(0, 0, 80), FVector(0, 0, 1), 60, 85.f, TEXT("concrete"), 2300.f, 0.9f);
					Dp->Shockwave(C, 1000.f, 4200.f, 3600.f, 0.65f);
					Dp->FX()->GroundRing(C, 5200.f, 3600.f, 1.f, TEXT("concrete"));
					Dp->FX()->ShockDome(C, 4400.f, 3800.f, 0.55f, FLinearColor(0.7f, 0.85f, 1.f));
				});
				Dp->After(2.7f, [Dp, C]()
				{
					Dp->FX()->SmokeColumn(C + FVector(0, 0, 150), 520.f, 18.f, 0.65f);
					for (int32 i = 0; i < 9; ++i) Dp->FX()->Fire(C + FVector(FMath::Cos(i * 2.4f), FMath::Sin(i * 2.4f), 0) * (250.f + i * 90.f) + FVector(0, 0, 30), 130.f, 14.f);
				});
			});
		}));

	Out.Add(Tool(TEXT("nanite_swarm"), TEXT("Grey swarm"), 7, TEXT("Alien technology"), ENYCTarget::GroundFloor, 10.0f, 34.f, 12.f,
		TEXT("A humming cloud of machines eats the city from one point outward: stone and steel turn to glittering dust and the unsupported floors come down."), TEXT("A growing driven mist volume; every step it deletes the building parts at its advancing edge in a shower of motes, sinks street objects into powder and lets the structural check bring down what is left unsupported."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = A.Point;
			FNYCPuff Look;
			Look.Pos = C;
			Look.R0 = 120.f;
			Look.Squash = 0.82f;
			Look.Kind = ENYCVol::Mist;
			Look.Albedo = FLinearColor(0.1f, 0.15f, 0.12f);
			Look.Density = 0.7f;
			Look.FadeIn = 0.6f;
			Look.Life = 12.f;
			Look.NoiseM = 1.1f;
			const int32 Cloud = D.FX()->DrivenVolume(Look);
			D.FX()->Sound(TEXT("swarm"), C, 1.5f, 1.f);
			const FLinearColor Silver(0.5f, 0.85f, 0.62f);
			TSharedRef<int32> Count = MakeShared<int32>(0);
			D.During(9.2f, [Dp, C, Cloud, Silver, Count](float T, float)
			{
				const float R = 110.f + FMath::Pow(T / 9.f, 1.25f) * 1850.f;
				Dp->FX()->DriveVolume(Cloud, C + FVector(0, 0, FMath::Sin(T * 3.f) * 30.f), R * 1.08f, 0.82f);
				const int32 K = ++*Count;
				if (K % 5 == 0)
				{
					Dp->DissolveElements(C, R, 22, Silver, K % 20 == 0);
					TArray<int32> Near;
					Dp->CollectProps(C, R, Near);
					int32 N = 0;
					for (int32 P : Near)
					{
						if (FVector::Dist(Dp->PropLocation(P), C) > R + 100.f) continue;
						const FVector At = Dp->PropLocation(P);
						Dp->SinkProp(P, 320.f, 1.6f);
						Dp->FX()->Motes(At + FVector(0, 0, 90), 70, Silver, 130.f, 120.f, 2.f, 3.f, FVector(0, 0, 40));
						if (++N >= 2) break;
					}
				}
				for (int32 i = 0; i < 2; ++i)
				{
					const FVector Dir = Dp->Random().VRand();
					Dp->FX()->Motes(C + Dir * R * 0.9f, 16, Silver, 90.f, 260.f, 0.9f, 2.2f, -Dir * 120.0);
				}
				if (K % 24 == 0) Dp->ShatterGlass(C, R * 1.15f, 90.f, 14);
				if (K % 8 == 0) Dp->FX()->Glow(C + Dp->Random().VRand() * R * 0.6f, Silver, 2600.f * Dp->FX()->GlowScale(), 500.f, 0.5f, 0.5f);
			});
			D.After(9.2f, [Dp, Cloud, C]() { Dp->FX()->EndVolume(Cloud, 2.5f); Dp->DissolveElements(C, 1960.f, 1, FLinearColor(0.5f, 0.85f, 0.62f), true); });
		}));

	Out.Add(Tool(TEXT("antimatter"), TEXT("Antimatter capsule"), 7, TEXT("Alien technology"), ENYCTarget::FacadeHigh, 7.0f, 55.f, 18.f,
		TEXT("A tiny violet capsule drifts into the wall and annihilates a perfect sphere of building out of existence."), TEXT("Charge-up energy volume collapsing to a point, then every element inside a sphere is removed at once, rubble is first sucked into the void and then thrown out, and the structure left above fails."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector N = Outward(A);
			const FVector C = A.Point - N * 260.0;
			UStaticMeshComponent* Pod = Prop(D, TEXT("tl_antimatter"), A.Point + N * 1100.0, FQuat::Identity, 1.6f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(Pod);
			const FLinearColor Violet(0.62f, 0.25f, 1.f);
			const int32 Light = D.FX()->Glow(A.Point + N * 1100.0, Violet, 18000.f * D.FX()->GlowScale(), 1600.f, 2.5f, 0.15f);
			D.FX()->Sound(TEXT("antimatter_charge"), A.Point, 1.4f, 1.f);
			FNYCPuff Halo;
			Halo.Pos = A.Point + N * 1100.0;
			Halo.R0 = 30.f;
			Halo.Kind = ENYCVol::Energy;
			Halo.Albedo = Violet;
			Halo.Glow = 3500.f * D.FX()->GlowScale();
			Halo.Density = 0.6f;
			Halo.Life = 2.6f;
			Halo.FadeIn = 0.5f;
			Halo.NoiseM = 0.8f;
			const int32 Id = D.FX()->DrivenVolume(Halo);
			D.During(2.2f, [Dp, Weak, A, N, Id, Light](float T, float)
			{
				const float U = FMath::Clamp(T / 2.1f, 0.f, 1.f);
				const FVector P = FMath::Lerp(A.Point + N * 1100.0, A.Point + N * 40.0, (double)FMath::InterpEaseIn(0.f, 1.f, U, 2.f));
				if (Weak.IsValid()) Weak->SetWorldLocationAndRotation(P, FRotator(T * 300.f, T * 420.f, T * 170.f).Quaternion());
				Dp->FX()->DriveVolume(Id, P, U < 0.75f ? 60.f + U * 330.f : FMath::Lerp(310.f, 30.f, (U - 0.75f) / 0.25f), 1.f);
				Dp->FX()->MoveLight(Light, P);
			});
			D.After(2.25f, [Dp, Weak, C, Violet, Id, A]()
			{
				if (Weak.IsValid()) Dp->FX()->RemoveMesh(Weak.Get());
				Dp->FX()->EndVolume(Id, 0.1f);
				Dp->FX()->Sound(TEXT("antimatter_boom"), C, 2.f, 1.f);
				Dp->FX()->Flash(C, Violet, 1.4e7f * Dp->FX()->GlowScale(), 16000.f, 0.7f, 0.1f);
				FNYCPuff Void;
				Void.Pos = C;
				Void.R0 = 200.f;
				Void.R1 = 1220.f;
				Void.GrowTau = 0.12f;
				Void.Life = 0.9f;
				Void.FadeIn = 0.04f;
				Void.Kind = ENYCVol::Energy;
				Void.Albedo = Violet;
				Void.Glow = 5200.f * Dp->FX()->GlowScale();
				Void.Density = 0.75f;
				Void.NoiseM = 2.4f;
				Dp->FX()->AddPuff(Void);
				Dp->DissolveElements(C, 1050.f, 1400, Violet, false);
				if (C.Z < 1000.0) Dp->MakeCrater(Ground(C), 780.f, 460.f);
				TArray<int32> Near;
				Dp->CollectProps(C, 1100.f, Near);
				for (int32 P : Near)
					if (FVector::Dist(Dp->PropLocation(P), C) < 1100.0) Dp->SinkProp(P, 20.f, 0.06f);
				// air rushes into the space
				Repeat(*Dp, 5, 0.07f, 0.05f, [Dp, C](int32) { Dp->DragDebris(C, 2600.f, 520.f, 0.f, 0.f); });
				for (int32 i = 0; i < 22; ++i)
				{
					const FVector Dir = Dp->Random().VRand();
					Dp->FX()->Motes(C + Dir * 1150.f, 55, Violet, 140.f, 80.f, 0.7f, 4.f, -Dir * 3400.0);
				}
				Dp->After(0.45f, [Dp, C, A]()
				{
					FNYCDamage H;
					H.Center = C;
					H.Radius = 1180.f;
					H.GlassRadius = 3200.f;
					H.Speed = 1000.f;
					H.UpKick = 150.f;
					H.MaxElements = 220;
					H.Dust = 0.6f;
					Dp->ApplyDamage(H);
					Dp->KickDebris(C, 1900.f, 700.f, 150.f, false);
					Dp->FX()->ShockDome(C, 3600.f, 3200.f, 0.55f, FLinearColor(0.8f, 0.65f, 1.f));
					Dp->FX()->DustBurst(C, 900.f, 0.8f, WallOf(*Dp, A.Building));
					Dp->Shake(C, 28.f, 1.f);
				});
			});
		}));

	Out.Add(Tool(TEXT("black_hole"), TEXT("Pocket black hole"), 7, TEXT("Alien technology"), ENYCTarget::District, 11.0f, 80.f, 28.f,
		TEXT("A point of nothing opens above the street and pulls in cars, posts, masonry and finally a whole building, then winks out with a shock."), TEXT("A dark core volume with a glowing accretion disc; rigid bodies and Chaos fragments are pulled in on spirals by per-step forces and physics fields and swallowed at the horizon; fronts are torn off progressively."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FVector H = C + FVector(0, 0, 1500);
			FNYCPuff Core;
			Core.Pos = H;
			Core.R0 = 30.f;
			Core.Kind = ENYCVol::Smoke;
			Core.Albedo = FLinearColor(0.0005f, 0.0003f, 0.001f);
			Core.Density = 14.f;
			Core.Life = 10.5f;
			Core.FadeIn = 0.8f;
			Core.NoiseM = 0.3f;
			FNYCPuff Disc = Core;
			Disc.Kind = ENYCVol::Energy;
			Disc.Albedo = FLinearColor(1.f, 0.5f, 0.16f);
			Disc.Glow = 6500.f * D.FX()->GlowScale();
			Disc.Density = 0.85f;
			Disc.Squash = 0.09f;
			Disc.NoiseM = 1.6f;
			FNYCPuff Halo = Disc;
			Halo.Albedo = FLinearColor(0.5f, 0.28f, 1.f);
			Halo.Glow = 1300.f * D.FX()->GlowScale();
			Halo.Density = 0.3f;
			Halo.Squash = 1.f;
			const int32 CoreId = D.FX()->DrivenVolume(Core), DiscId = D.FX()->DrivenVolume(Disc), HaloId = D.FX()->DrivenVolume(Halo);
			// halo behind, the black core over it, the disc crossing in front
			D.FX()->SetVolumeOrder(HaloId, 4);
			D.FX()->SetVolumeOrder(CoreId, 6);
			D.FX()->SetVolumeOrder(DiscId, 7);
			D.FX()->Sound(TEXT("blackhole"), H, 1.7f, 1.f);
			const int32 Light = D.FX()->Glow(H, FLinearColor(1.f, 0.55f, 0.3f), 160000.f * D.FX()->GlowScale(), 5200.f, 8.4f, 0.2f);
			const int32 First = D.NumBodies();
			TSharedRef<int32> Count = MakeShared<int32>(0);
			D.During(8.3f, [Dp, C, H, CoreId, DiscId, HaloId, First, Count](float T, float Dt)
			{
				const float Grow = FMath::InterpEaseOut(0.f, 1.f, FMath::Clamp(T / 6.f, 0.f, 1.f), 2.f);
				const float R = 90.f + 290.f * Grow;
				Dp->FX()->DriveVolume(CoreId, H, R, 1.f);
				Dp->FX()->DriveVolume(DiscId, H, R * 3.6f, 0.09f);
				Dp->FX()->DriveVolume(HaloId, H, R * 2.0f, 1.f);
				const int32 K = ++*Count;
				if (K % 3 == 0)
				{
					const float Reach = 900.f + T * 330.f;
					const int32 Pick = Dp->FindProp(C + FVector(Dp->Random().FRandRange(-Reach, Reach), Dp->Random().FRandRange(-Reach, Reach), 0), 0xFFFFFEFF, 700.f);
					if (Pick != INDEX_NONE) Loose(*Dp, Pick, (H - Dp->PropLocation(Pick)).GetSafeNormal() * 600.0 + FVector(0, 0, 350), Dp->Random().VRand() * 200.0);
					Dp->HitTraffic(C, Reach, 60.f, 0.2f, false, (H - C).GetSafeNormal() * 900.0);
					Dp->SetBodiesGravity(C, Reach * 1.8f, false, First);
				}
				Dp->DragBodies(H, 5000.f, 1500.f + T * 250.f, 2600.f, 1300.f, R * 1.25f, Dt);
				if (K % 4 == 0) Dp->DragDebris(H, 4600.f, 120.f + T * 55.f, 190.f, 0.f);
				if (K % 5 == 0) Rip(*Dp, H, H, 2200.f + T * 300.f, 170.f + T * 26.f, 1400.f, 3200.f);
				if (K % 22 == 0 && T > 2.f) Dp->DissolveElements(H, R * 2.1f, 40, FLinearColor(1.f, 0.55f, 0.2f), true);
				if (K % 4 == 0)
				{
					const float Ang = K * 0.9f;
					const FVector Rim = H + FVector(FMath::Cos(Ang), FMath::Sin(Ang), 0) * (R * 6.f + 400.f);
					Dp->FX()->Litter(Rim, (H - Rim).GetSafeNormal() * 1900.0 + FVector(-FMath::Sin(Ang), FMath::Cos(Ang), 0) * 900.0, 18);
					Dp->FX()->Sparks(H + FVector(FMath::Cos(Ang * 1.7f), FMath::Sin(Ang * 1.7f), 0) * R * 2.6f, FVector(-FMath::Sin(Ang * 1.7f), FMath::Cos(Ang * 1.7f), 0) * 1500.0, 16, FLinearColor(1.f, 0.6f, 0.25f), 12.f);
				}
				Dp->Shake(H, 5.f + T * 2.2f, 0.2f);
			});
			D.After(4.8f, [Dp, C]()
			{
				TArray<int32> Near;
				Dp->BuildingsNear(C + FVector(0, 0, 800), 3400.f, Near);
				int32 Best = INDEX_NONE;
				double BestD = 1e18;
				for (int32 B : Near)
				{
					const FNYCBuildingInfo* I = Dp->Info(B);
					const double Dist = I->Box.ComputeSquaredDistanceToPoint(C);
					if (I->Height < 11000.f && Dist < BestD) { BestD = Dist; Best = B; }
				}
				if (Best != INDEX_NONE)
				{
					const FNYCBuildingInfo* I = Dp->Info(Best);
					Dp->CollapseBuilding(Best, 1, 2, (C - FVector(I->Rect.GetCenter().X, I->Rect.GetCenter().Y, 0)).GetSafeNormal2D(), 0.2f);
				}
			});
			D.After(8.35f, [Dp, H, C, CoreId, DiscId, HaloId, First]()
			{
				Dp->FX()->EndVolume(CoreId, 0.25f);
				Dp->FX()->EndVolume(DiscId, 0.25f);
				Dp->FX()->EndVolume(HaloId, 0.8f);
				Dp->SetBodiesGravity(C, 20000.f, true, First);
				Dp->FX()->Flash(H, FLinearColor(0.75f, 0.6f, 1.f), 2.0e7f * Dp->FX()->GlowScale(), 20000.f, 0.8f, 0.1f);
				Dp->FX()->ShockDome(H, 6000.f, 4800.f, 0.75f, FLinearColor(0.82f, 0.72f, 1.f));
				Dp->KickDebris(H, 3200.f, 1900.f, 300.f, false);
				for (int32 i = First; i < Dp->NumBodies(); ++i)
				{
					UStaticMeshComponent* Body = Dp->BodyRoot(i);
					if (!Body || !Body->IsSimulatingPhysics()) continue;
					const FVector Away = (Body->GetComponentLocation() - H).GetSafeNormal();
					if (FVector::Dist(Body->GetComponentLocation(), H) < 2600.0) Body->SetPhysicsLinearVelocity(Away * 2400.0);
				}
				Dp->Shockwave(C, 500.f, 5200.f, 4200.f, 0.6f);
				Dp->FX()->Sound(TEXT("blackhole_pop"), H, 2.f, 1.f);
				Dp->Shake(H, 45.f, 1.4f);
			});
		}));
}
