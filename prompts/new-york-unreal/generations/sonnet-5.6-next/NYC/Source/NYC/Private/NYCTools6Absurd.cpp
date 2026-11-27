// Tier 6: things that have no business doing damage, doing damage.
#include "NYCToolKit.h"
#include "Components/InstancedStaticMeshComponent.h"

using namespace NYCT;

namespace
{
	/** A burst around an impact that crushes the street and what is on it without any fire. */
	void Thud(ANYCDestruction& D, const FVector& At, float Radius, float PropReach, float Speed, int32 MaxElements = 40, float Dust = 0.6f)
	{
		FNYCDamage H;
		H.Center = At;
		H.Radius = Radius;
		H.GlassRadius = Radius * 2.4f;
		H.Speed = Speed;
		H.UpKick = Speed * 0.45f;
		H.PropRadius = PropReach;
		H.Dust = Dust;
		H.MaxElements = MaxElements;
		D.ApplyDamage(H);
		D.KickDebris(At, PropReach * 1.3f, Speed * 0.45f, Speed * 0.35f, false);
	}

}

void NYCArsenal::RegisterAbsurd(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("rubber_duck"), TEXT("Colossal rubber duck"), 6, TEXT("Absurd"), ENYCTarget::District, 6.2f, 55.f, 18.f,
		TEXT("A twelve metre bath toy bounces down the avenue, squeaking, and flattens whatever it lands on."), TEXT("The duck follows a decaying hop curve with squash and stretch on landing; each landing crushes cars, flings furniture, cracks glass and squeaks."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const FVector From = Ground(A.Point - Along * 3800.0), To = Ground(A.Point + Along * 2600.0);
			UStaticMeshComponent* Duck = Prop(D, TEXT("tl_duck"), From + FVector(0, 0, 2000), Facing(-Along), 1.55f);
			if (!Duck) return;
			TWeakObjectPtr<UStaticMeshComponent> Weak(Duck);
			TSharedRef<int32> Landed = MakeShared<int32>(-1);
			const float Time = 10.f;
			const int32 Hops = 7;
			D.During(Time, [Dp, Weak, Landed, From, To, Along, Time, Hops](float T, float)
			{
				if (!Weak.IsValid()) return;
				const float U = FMath::Clamp(T / Time, 0.f, 1.f);
				const float Phase = U * Hops;
				const int32 Hop = FMath::FloorToInt32(Phase);
				const float Frac = Phase - Hop;
				const FVector P = FMath::Lerp(From, To, (double)U);
				// a parabola between landings, each a little lower
				const float Height = (Hop == 0 ? 1.f - Frac * Frac : 4.f * Frac * (1.f - Frac)) * (1500.f - Hop * 120.f);
				const float Near = FMath::Clamp(1.f - Height / 220.f, 0.f, 1.f) * (Frac < 0.5f ? 1.f : 0.5f);
				Weak->SetWorldScale3D(FVector(1.55f * (1.f + 0.16f * Near), 1.55f * (1.f + 0.16f * Near), 1.55f * (1.f - 0.27f * Near)));
				const FQuat Rock(WallTangent(Along), FMath::Sin(Frac * PI * 2.f) * 0.17f);
				Weak->SetWorldLocationAndRotation(P + FVector(0, 0, Height), Rock * Facing(Along));
				if (Hop > *Landed && Hop >= 1 && Hop <= Hops)
				{
					*Landed = Hop;
					const FVector G = Ground(P);
					Dp->MakeCrater(G, 240.f, 35.f);
					Thud(*Dp, G + FVector(0, 0, 150), 520.f, 1000.f, 950.f, 50, 0.25f);
					Dp->HitTraffic(G, 800.f, 350.f, 1.0f, false, FVector(0, 0, -500));
					Dp->FX()->GroundRing(G, 1500.f, 2200.f, 0.25f, TEXT("concrete"));
					Dp->FX()->Sound(TEXT("squeak"), G, 1.5f, 1.f - Hop * 0.045f);
					Dp->FX()->Sound(TEXT("thud_giant"), G, 1.f, 1.1f);
					Dp->Shake(G, 18.f, 0.7f);
				}
			});
		}));

	Out.Add(Tool(TEXT("bowling_ball"), TEXT("Giant bowling ball"), 6, TEXT("Absurd"), ENYCTarget::District, 4.6f, 55.f, 20.f,
		TEXT("An eight metre bowling ball thunders down the avenue and sends cars flying like pins."), TEXT("A rolling sphere with true rolling rotation and accelerating speed; swept damage along its path, cars launched high, posts snapped, a final crash into whatever stands at the end."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const float R = 400.f;
			const FVector From = Ground(A.Point - Along * 5200.0, R);
			UStaticMeshComponent* Ball = Prop(D, TEXT("tl_bowlingball"), From, FQuat::Identity, 1.f);
			if (!Ball) return;
			TWeakObjectPtr<UStaticMeshComponent> Weak(Ball);
			TSharedRef<FVector> Pos = MakeShared<FVector>(From);
			TSharedRef<float> Speed = MakeShared<float>(900.f), Rolled = MakeShared<float>(0.f);
			TSharedRef<int32> Count = MakeShared<int32>(0);
			TSharedRef<bool> Done = MakeShared<bool>(false);
			D.FX()->Sound(TEXT("bowling_roll"), From, 1.4f, 1.f);
			D.During(8.5f, [Dp, Weak, Pos, Speed, Rolled, Count, Done, Along, R](float T, float Dt)
			{
				if (!Weak.IsValid() || *Done) return;
				*Speed = FMath::Min(*Speed + 650.f * Dt, 2900.f);
				const FVector Prev = *Pos;
				*Pos += Along * (*Speed * Dt);
				*Rolled += *Speed * Dt / R;
				const FVector Axis = FVector::CrossProduct(FVector::UpVector, Along);
				Weak->SetWorldLocationAndRotation(*Pos, FQuat(Axis, *Rolled));
				const int32 K = ++*Count;
				if (K % 3 == 0)
				{
					Plough(*Dp, Prev - Along * 50.0, *Pos + Along * (R * 0.6), R * 1.05f, *Speed * 0.55f, Along * (*Speed * 0.4) + FVector(0, 0, 450), 18, true);
					Dp->HitTraffic(*Pos + Along * R, R * 1.25f, *Speed * 0.5f, 0.75f, false, Along * (*Speed * 0.4) + FVector(0, 0, 900));
					Dp->KickDebris(*Pos, R * 1.5f, *Speed * 0.35f, 200.f, false);
					Dp->Shake(*Pos, 11.f, 0.25f);
				}
				if (K % 9 == 0)
				{
					Dp->MakeCrater(Ground(*Pos), 110.f, 22.f);
					Dp->FX()->DustBurst(Ground(*Pos, 90.0) - Along * 250.0, 220.f, 0.45f, TEXT("asphalt"));
				}
				// the end of the lane
				FVector Point, Normal;
				int32 B = INDEX_NONE;
				const bool bWall = Dp->Trace(*Pos, Along, R + *Speed * Dt + 20.f, Point, Normal, &B) >= 0.f && B != INDEX_NONE;
				if (bWall || T > 8.2f)
				{
					*Done = true;
					FNYCDamage H;
					H.Center = *Pos + Along * R;
					H.Radius = bWall ? 850.f : 450.f;
					H.GlassRadius = 2200.f;
					H.Speed = 1400.f;
					H.bRadial = false;
					H.Push = Along * 1100.0;
					H.MaxElements = 320;
					Dp->ApplyDamage(H);
					Dp->FX()->DustBurst(*Pos + Along * R, 700.f, 1.1f, WallOf(*Dp, B));
					Dp->FX()->Sound(TEXT("bowling_strike"), *Pos, 1.8f, 1.f);
					Dp->Shake(*Pos, 30.f, 1.1f);
				}
			});
		}));

	Out.Add(Tool(TEXT("pinball"), TEXT("Street pinball"), 6, TEXT("Absurd"), ENYCTarget::District, 9.0f, 45.f, 25.f,
		TEXT("A mirror-bright steel ball ricochets between the buildings, ringing a bell and gouging a wall at every bounce."), TEXT("A chrome sphere with its own velocity, reflected off real facade normals found by ray casts; every bounce damages the front, flashes a coloured bumper light and rings a rising bell."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const float R = 240.f;
			const FVector From = Ground(A.Point - Along * 2200.0, R + 4);
			UStaticMeshComponent* Ball = Prop(D, TEXT("tl_pinball"), From, FQuat::Identity, 1.f);
			if (!Ball) return;
			TWeakObjectPtr<UStaticMeshComponent> Weak(Ball);
			TSharedRef<FVector> Pos = MakeShared<FVector>(From);
			TSharedRef<FVector> Vel = MakeShared<FVector>((Along + WallTangent(Along) * 0.72).GetSafeNormal() * 3600.0);
			TSharedRef<int32> Count = MakeShared<int32>(0), Bounces = MakeShared<int32>(0);
			const FVector Home = Ground(A.Point, R);
			D.FX()->Sound(TEXT("plunger"), From, 1.3f, 1.f);
			D.During(9.0f, [Dp, Weak, Pos, Vel, Count, Bounces, Home, R](float, float Dt)
			{
				if (!Weak.IsValid()) return;
				const FVector Dir = Vel->GetSafeNormal();
				const float Len = Vel->Size() * Dt;
				FVector Point, Normal;
				int32 B = INDEX_NONE;
				bool bBounce = Dp->Trace(*Pos, Dir, Len + R, Point, Normal, &B) >= 0.f && FMath::Abs(Normal.Z) < 0.6;
				if (!bBounce && FVector::Dist2D(*Pos, Home) > 4200.0 && FVector::DotProduct(Dir, Home - *Pos) < 0)
				{
					// an unseen cushion keeps it on the table
					bBounce = true;
					Normal = (Home - *Pos).GetSafeNormal2D();
					Point = *Pos + Dir * R;
					B = INDEX_NONE;
				}
				if (bBounce)
				{
					Normal.Z = 0;
					Normal.Normalize();
					*Vel = Vel->MirrorByVector(Normal);
					*Vel += FVector(Dp->Random().FRandRange(-500.f, 500.f), Dp->Random().FRandRange(-500.f, 500.f), 0);
					*Vel = Vel->GetSafeNormal2D() * 3600.0;
					const int32 N = ++*Bounces;
					const FLinearColor Colours[4] = { FLinearColor(1.f, 0.15f, 0.2f), FLinearColor(0.15f, 0.7f, 1.f), FLinearColor(1.f, 0.75f, 0.1f), FLinearColor(0.35f, 1.f, 0.35f) };
					if (B != INDEX_NONE)
					{
						FNYCDamage H;
						H.Center = Point;
						H.Radius = 330.f;
						H.GlassRadius = 950.f;
						H.Speed = 1100.f;
						H.MaxElements = 36;
						Dp->ApplyDamage(H);
						Dp->FX()->DustBurst(Point + Normal * 60.0, 200.f, 0.55f, WallOf(*Dp, B));
					}
					Dp->FX()->Sparks(Point, Normal * 1100.0, 150, Colours[N % 4], 65.f);
					Dp->FX()->Glow(Point + Normal * 120.0, Colours[N % 4], 26000.f * Dp->FX()->GlowScale(), 1700.f, 0.55f, 0.1f);
					Dp->FX()->Sound(TEXT("bell"), Point, 1.2f, 0.8f + (N % 7) * 0.11f);
					Dp->Shake(Point, 7.f, 0.3f);
				}
				const FVector Prev = *Pos;
				*Pos += *Vel * Dt;
				Pos->Z = R + 4;
				Weak->SetWorldLocationAndRotation(*Pos, FQuat(FVector::CrossProduct(FVector::UpVector, Vel->GetSafeNormal()), (float)(++*Count) * 0.5f));
				if (*Count % 3 == 0) Plough(*Dp, Prev, *Pos + Vel->GetSafeNormal() * R, R, 1300.f, *Vel * 0.25 + FVector(0, 0, 400), 7, false);
				if (*Count % 4 == 0) Dp->HitTraffic(*Pos, R * 1.6f, 900.f, 0.7f, false, *Vel * 0.25 + FVector(0, 0, 600));
			});
		}));

	Out.Add(Tool(TEXT("anvil_rain"), TEXT("Anvil rain"), 6, TEXT("Absurd"), ENYCTarget::Street, 7.0f, 30.f, 14.f,
		TEXT("A cartoon cloudburst of iron: dozens of anvils bang into the street, car roofs and parapets, and stay stuck there."), TEXT("Forty tumbling anvil meshes with staggered falls; each rings on impact, punches a small crater or hole, flattens what is below and remains embedded at a crooked angle."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("whistle_down"), C + FVector(0, 0, 900), 0.9f, 1.4f);
			Repeat(D, 42, 0.095f, 0.15f, [Dp, C](int32 i)
			{
				const FVector T = C + FVector(Dp->Random().FRandRange(-1300.f, 1300.f), Dp->Random().FRandRange(-1300.f, 1300.f), 0);
				Drop(*Dp, TEXT("tl_anvil"), T, 3600.f, 2.4f, Dp->Random().FRandRange(-90.f, 90.f), [Dp, i](const FVector& P, const FVector& N, int32 B, const FVector&)
				{
					if (P.Z < 60.f && i % 3 == 0) Dp->MakeCrater(P, 105.f, 40.f);
					FNYCDamage H;
					H.Center = P;
					H.Radius = 105.f;
					H.GlassRadius = 260.f;
					H.PropRadius = 190.f;
					H.Speed = 520.f;
					H.bRadial = false;
					H.Push = FVector(0, 0, -300);
					H.MaxElements = 8;
					H.Dust = 0.3f;
					Dp->ApplyDamage(H);
					Dp->HitTraffic(P, 190.f, 150.f, 1.f, false, FVector(0, 0, -700));
					Dp->Scar(P, N, 55.f);
					const FQuat Q = FQuat(FVector(Dp->Random().FRandRange(-1.f, 1.f), Dp->Random().FRandRange(-1.f, 1.f), 0).GetSafeNormal(), Dp->Random().FRandRange(0.15f, 0.6f))
						* FQuat(FVector::UpVector, Dp->Random().FRandRange(0.f, 6.28f));
					Prop(*Dp, TEXT("tl_anvil"), P + N * 12.0, Q, 2.4f);
					Dp->FX()->Sparks(P + N * 20.0, N * 600.0, 45, FLinearColor(1.f, 0.7f, 0.3f), 70.f);
					Dp->FX()->Chips(P, N * 700.0, 30, FLinearColor(0.16f, 0.15f, 0.14f), 2.f, 8.f, 70.f);
					Dp->FX()->Sound(TEXT("anvil"), P, 0.9f, Dp->Random().FRandRange(0.82f, 1.22f));
					Dp->Shake(P, 4.f, 0.25f);
				});
			});
		}));

	Out.Add(Tool(TEXT("piano_drop"), TEXT("Falling grand piano"), 6, TEXT("Absurd"), ENYCTarget::Car, 5.0f, 17.f, 6.f,
		TEXT("A concert grand whistles down from the sky and detonates into black lacquer, keys and one enormous wrong chord."), TEXT("A tumbling grand piano model; on impact it is replaced by lacquered lumps, white and black keys and wooden splinters, crushes the car beneath and rings a discord."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			D.FX()->Sound(TEXT("whistle_down"), A.Point + FVector(0, 0, 600), 1.f, 0.85f);
			FFlight F;
			F.Mesh = TEXT("tl_piano");
			F.From = A.Point + FVector(-150, 90, 4200);
			F.Velocity = FVector(70, -42, -500);
			F.Gravity = 1.15f;
			F.Scale = 1.9f;
			F.Spin = 36.f;
			F.bAlign = false;
			F.Hit = [Dp](const FVector& P, const FVector& N, int32 B, const FVector& V)
			{
				const FVector At = P + N * 70.0;
				Dp->SpawnLumps(At, N, 26, 55.f, TEXT("paint_black"), 720.f, 1.1f, 1.8f);
				Dp->SpawnLumps(At + FVector(0, 0, 25), N, 44, 17.f, TEXT("paint_white"), 900.f, 1.2f, 3.5f);
				Dp->SpawnLumps(At, N, 22, 38.f, TEXT("wood"), 650.f, 1.1f, 3.f);
				Dp->SpawnLumps(At, N, 10, 60.f, TEXT("iron_black"), 420.f, 1.f, 4.f);
				Dp->FX()->Splinters(At, N * 650.0, 260);
				Dp->HitTraffic(P, 330.f, 380.f, 1.f, false, FVector(0, 0, -900));
				Thud(*Dp, At, 190.f, 340.f, 700.f, 24);
				Dp->FX()->Motes(At + FVector(0, 0, 80), 60, FLinearColor(1.f, 0.82f, 0.35f), 160.f, 260.f, 2.8f, 9.f, FVector(0, 0, 120));
				Dp->FX()->Litter(At, N * 520.0, 80, FLinearColor(0.9f, 0.88f, 0.8f));
				Dp->FX()->Sound(TEXT("piano_crash"), At, 1.7f, 1.f);
				Dp->Shake(At, 9.f, 0.7f);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("giant_boot"), TEXT("Giant boot"), 6, TEXT("Absurd"), ENYCTarget::District, 9.0f, 75.f, 26.f,
		TEXT("An enormous boot comes down out of the sky three times, stamping craters across the block."), TEXT("A twenty metre boot animated through lift, travel and an accelerating stamp; each footfall makes a crater, a ground shock ring, crushed cars and a camera jolt."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const FVector Side = WallTangent(Along);
			TArray<FVector> Marks = { Ground(A.Point - Along * 3600.0) + FVector(0, 0, 5200), Ground(A.Point - Along * 1700.0 + Side * 450.0), Ground(A.Point + Side * -300.0), Ground(A.Point + Along * 1900.0 + Side * 380.0), Ground(A.Point + Along * 4200.0) + FVector(0, 0, 6500) };
			UStaticMeshComponent* Boot = Prop(D, TEXT("tl_boot"), Marks[0], Facing(Along), 1.35f);
			if (!Boot) return;
			TWeakObjectPtr<UStaticMeshComponent> Weak(Boot);
			TSharedRef<int32> Stomped = MakeShared<int32>(0);
			const float Each = 2.4f;
			D.During(Each * 4.f, [Dp, Weak, Stomped, Marks, Along, Each](float T, float)
			{
				if (!Weak.IsValid()) return;
				const int32 K = FMath::Min(FMath::FloorToInt32(T / Each), 3);
				const float U = FMath::Clamp(T / Each - K, 0.f, 1.f);
				const FVector From = Marks[K], To = Marks[K + 1];
				// lift and carry, hang, then stamp
				const float Carry = FMath::InterpEaseInOut(0.f, 1.f, FMath::Clamp(U / 0.62f, 0.f, 1.f), 2.f);
				const float Fall = FMath::Pow(FMath::Clamp((U - 0.7f) / 0.2f, 0.f, 1.f), 2.4f);
				const float Hang = 3400.f;
				FVector P = FMath::Lerp(From, To, (double)Carry);
				double Z;
				if (U < 0.62f) Z = FMath::Lerp(From.Z, (double)Hang, FMath::Sin(Carry * HALF_PI));
				else Z = FMath::Lerp((double)Hang, To.Z, (double)Fall);
				if (K == 3) Z = FMath::Lerp(From.Z, To.Z, (double)Carry);
				P.Z = Z;
				const float Pitch = U < 0.62f ? -14.f * FMath::Sin(Carry * PI) : 0.f;
				Weak->SetWorldLocationAndRotation(P - Along * 300.0, Facing(Along) * FQuat(FRotator(Pitch, 0, 0)));
				if (K < 3 && U >= 0.9f && *Stomped <= K)
				{
					*Stomped = K + 1;
					const FVector G = Ground(To);
					Dp->MakeCrater(G, 720.f, 130.f);
					Dp->SpawnLumps(G + FVector(0, 0, 60), FVector(0, 0, 1), 24, 75.f, TEXT("concrete"), 1500.f, 1.1f);
					Thud(*Dp, G + FVector(0, 0, 220), 880.f, 1500.f, 1500.f, 220);
					Dp->HitTraffic(G, 1100.f, 900.f, 1.f, false, FVector(0, 0, -300));
					Dp->FX()->GroundRing(G, 3600.f, 3000.f, 0.9f, TEXT("concrete"));
					Dp->FX()->DustBurst(G + FVector(0, 0, 150), 800.f, 1.1f, TEXT("concrete"));
					Dp->ShatterGlass(G + FVector(0, 0, 700), 2800.f, 700.f, 60);
					Dp->FX()->Sound(TEXT("boot_stomp"), G, 2.f, 1.f - 0.05f * K);
					Dp->Shake(G, 42.f, 1.2f);
				}
			});
		}));

	Out.Add(Tool(TEXT("gravity_flip"), TEXT("Gravity flip"), 6, TEXT("Absurd"), ENYCTarget::District, 9.5f, 42.f, 16.f,
		TEXT("For five seconds down is up: cars, benches, rubble and chunks of wall drift into the sky, and then everything falls at once."), TEXT("Gravity is switched off on every loose body in range and a gentle upward field applied to rubble; props and traffic are cut loose, then gravity returns with a downward kick."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const float R = 2800.f;
			const int32 First = D.NumBodies();
			D.FX()->Sound(TEXT("gravity_up"), C, 1.5f, 1.f);
			D.FX()->ShockDome(C, R, 2600.f, 0.45f, FLinearColor(0.55f, 0.35f, 1.f));
			D.After(0.35f, [Dp, C, R, First]()
			{
				TArray<int32> Near;
				Dp->CollectProps(C, R, Near, ANYCDestruction::MCar | ANYCDestruction::MBox | ANYCDestruction::MBag | ANYCDestruction::MPlate | ANYCDestruction::MPole | ANYCDestruction::MTree | ANYCDestruction::MHydrant | ANYCDestruction::MStall);
				int32 N = 0;
				for (int32 P : Near)
				{
					if (N >= 60) break;
					if (Dp->Random().GetFraction() > 0.7f) continue;
					Dp->LaunchProp(P, FVector(Dp->Random().FRandRange(-90.f, 90.f), Dp->Random().FRandRange(-90.f, 90.f), Dp->Random().FRandRange(220.f, 520.f)),
						Dp->Random().VRand() * 60.0, false, false);
					++N;
				}
				Dp->HitTraffic(C, R, 40.f, 0.05f, false, FVector(0, 0, 500));
				// pieces of the fronts come unstuck and drift
				for (int32 i = 0; i < 26; ++i)
				{
					const FVector From = C + FVector(0, 0, Dp->Random().FRandRange(200.f, 2200.f));
					const float Ang = i * 2.4f;
					FVector Point, Normal;
					int32 B = INDEX_NONE;
					if (Dp->Trace(From, FVector(FMath::Cos(Ang), FMath::Sin(Ang), 0), R, Point, Normal, &B) < 0.f || B == INDEX_NONE) continue;
					FNYCDamage H;
					H.Center = Point;
					H.Radius = 150.f;
					H.GlassRadius = 330.f;
					H.Speed = 90.f;
					H.bRadial = false;
					H.Push = Normal * 130.0 + FVector(0, 0, 330);
					H.MaxElements = 5;
					H.bFrame = false;
					H.bStructural = false;
					H.PropRadius = 0.f;
					H.Dust = 0.2f;
					Dp->ApplyDamage(H);
				}
				Dp->KickDebris(C, R, 30.f, 420.f, false);
				Dp->SetBodiesGravity(C, R * 1.6f, false, First);
			});
			TSharedRef<int32> Count = MakeShared<int32>(0);
			D.During(5.2f, [Dp, C, R, First, Count](float T, float Dt)
			{
				const int32 K = ++*Count;
				if (T < 0.45f) return;
				Dp->SetBodiesGravity(C, R * 2.0f, false, First);
				for (int32 i = First; i < Dp->NumBodies(); ++i)
				{
					UStaticMeshComponent* Body = Dp->BodyRoot(i);
					if (!Body || !Body->IsSimulatingPhysics()) continue;
					FVector V = Body->GetPhysicsLinearVelocity();
					V.Z += ((Body->GetComponentLocation().Z < 2200.0 ? 170.0 : -60.0)) * Dt;
					Body->SetPhysicsLinearVelocity(V);
				}
				if (K % 4 == 0) Dp->DragDebris(C + FVector(0, 0, 5200), 6400.f, 42.f, 14.f, 0.f);
				if (K % 5 == 0) Dp->FX()->Motes(C + FVector(Dp->Random().FRandRange(-R, R) * 0.7f, Dp->Random().FRandRange(-R, R) * 0.7f, 60), 40, FLinearColor(0.6f, 0.45f, 1.f), 450.f, 30.f, 3.2f, 5.f, FVector(0, 0, 230));
			});
			D.After(5.6f, [Dp, C, R, First]()
			{
				Dp->SetBodiesGravity(C, R * 3.0f, true, First);
				for (int32 i = First; i < Dp->NumBodies(); ++i)
				{
					UStaticMeshComponent* Body = Dp->BodyRoot(i);
					if (Body && Body->IsSimulatingPhysics()) Body->SetPhysicsLinearVelocity(Body->GetPhysicsLinearVelocity() + FVector(0, 0, -750));
				}
				Dp->KickDebris(C + FVector(0, 0, 1200), R * 1.5f, 80.f, -900.f, false);
				Dp->FX()->Sound(TEXT("gravity_slam"), C, 1.8f, 1.f);
			});
			D.After(6.5f, [Dp, C, R]()
			{
				Dp->FX()->GroundRing(C, R * 1.2f, 2600.f, 0.8f, TEXT("concrete"));
				Dp->Shake(C, 30.f, 1.2f);
			});
		}));

	Out.Add(Tool(TEXT("balloon_lift"), TEXT("Party balloon airlift"), 6, TEXT("Absurd"), ENYCTarget::Car, 4.6f, 34.f, 10.f,
		TEXT("Bunches of giant balloons carry off cars, mailboxes and a hydrant, which burst one by one and let their cargo drop."), TEXT("Real bodies made weightless and steered gently upward with balloon clusters following them; balloons pop in sequence and gravity returns to each object when its last one goes."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			TArray<int32> Targets;
			auto Take = [&](uint32 Mask, int32 Want)
			{
				TArray<int32> List;
				D.CollectProps(C, 2400.f, List, Mask);
				List.Sort([&D, &C](int32 X, int32 Y) { return FVector::DistSquared2D(D.PropLocation(X), C) < FVector::DistSquared2D(D.PropLocation(Y), C); });
				for (int32 i = 0; i < FMath::Min(Want, List.Num()); ++i) Targets.Add(List[i]);
			};
			Take(ANYCDestruction::MCar, 5);
			Take(ANYCDestruction::MHydrant, 1);
			Take(ANYCDestruction::MBox, 5);
			Take(ANYCDestruction::MStall, 1);
			const TCHAR* Colours[3] = { TEXT("tl_balloon_red"), TEXT("tl_balloon_blue"), TEXT("tl_balloon_yellow") };
			struct FBunch { int32 Body = INDEX_NONE; TArray<TWeakObjectPtr<UStaticMeshComponent>> Balloons, Strings; TArray<FVector> Offsets; int32 Alive = 0; FVector Drift; };
			TSharedRef<TArray<FBunch>> Bunches = MakeShared<TArray<FBunch>>();
			for (int32 i = 0; i < Targets.Num(); ++i)
			{
				const bool bCar = i < 5;
				FBunch B;
				B.Body = Loose(D, Targets[i], FVector(0, 0, 60), FVector::ZeroVector);
				if (B.Body == INDEX_NONE) continue;
				if (UStaticMeshComponent* Root = D.BodyRoot(B.Body)) Root->SetEnableGravity(false);
				B.Drift = FVector(D.Random().FRandRange(-35.f, 35.f), D.Random().FRandRange(-35.f, 35.f), D.Random().FRandRange(95.f, 175.f));
				const int32 N = bCar ? 11 : 4;
				const FVector At = D.PropLocation(Targets[i]);
				for (int32 k = 0; k < N; ++k)
				{
					const float Ang = k * 2.4f;
					const float Rad = FMath::Sqrt((float)k) * (bCar ? 62.f : 45.f);
					const FVector Off(FMath::Cos(Ang) * Rad, FMath::Sin(Ang) * Rad, (bCar ? 480.f : 300.f) + D.Random().FRandRange(-60.f, 90.f));
					B.Offsets.Add(Off);
					B.Balloons.Add(Prop(D, Colours[(i + k) % 3], At + Off, FQuat::Identity, bCar ? 0.3f : 0.23f));
					UStaticMeshComponent* String = D.NewVisual(D.UnitCube(), FTransform(FQuat::Identity, At, FVector(0.01)));
					String->SetMaterial(0, D.CityMaterial(TEXT("plastic_black")));
					B.Strings.Add(String);
				}
				B.Alive = N;
				Bunches->Add(B);
			}
			D.FX()->Sound(TEXT("balloon_inflate"), C, 1.2f, 1.f);
			const int32 Total = [&] { int32 S = 0; for (const FBunch& B : *Bunches) S += B.Alive; return S; }();
			D.During(14.f, [Dp, Bunches](float T, float)
			{
				for (FBunch& B : *Bunches)
				{
					UStaticMeshComponent* Root = Dp->BodyRoot(B.Body);
					if (!Root) continue;
					if (B.Alive > 0 && Root->IsSimulatingPhysics())
					{
						const FVector Sway(FMath::Sin(T * 1.4f + B.Body) * 40.f, FMath::Cos(T * 1.1f + B.Body * 2) * 40.f, 0);
						const FVector Want = (B.Drift + Sway) * FMath::Min(1.f, 0.2f + T * 0.45f);
						Root->WakeAllRigidBodies();
						Root->SetPhysicsLinearVelocity(FMath::Lerp(Root->GetPhysicsLinearVelocity(), Want, 0.18));
						Root->SetPhysicsAngularVelocityInDegrees(Root->GetPhysicsAngularVelocityInDegrees() * 0.93);
					}
					const FVector Hook = Root->GetComponentLocation() + FVector(0, 0, 60);
					for (int32 k = 0; k < B.Balloons.Num(); ++k)
					{
						if (!B.Balloons[k].IsValid()) continue;
						const FVector At = Root->GetComponentLocation() + B.Offsets[k] + FVector(FMath::Sin(T * 2.f + k) * 14.f, FMath::Cos(T * 1.7f + k) * 14.f, 0);
						B.Balloons[k]->SetWorldLocation(At);
						if (k < B.Strings.Num() && B.Strings[k].IsValid())
						{
							const FVector Span = At - Hook;
							B.Strings[k]->SetWorldLocationAndRotation(Hook + Span * 0.5, Facing(Span));
							B.Strings[k]->SetWorldScale3D(FVector(Span.Size() / 100.0, 0.012, 0.012));
						}
					}
				}
			});
			// they go one at a time, then in a flurry
			float When = 6.2f;
			for (int32 n = 0; n < Total; ++n)
			{
				D.After(When, [Dp, Bunches]()
				{
					TArray<int32> Live;
					for (int32 i = 0; i < Bunches->Num(); ++i) if ((*Bunches)[i].Alive > 0) Live.Add(i);
					if (!Live.Num()) return;
					FBunch& B = (*Bunches)[Live[Dp->Random().RandRange(0, Live.Num() - 1)]];
					for (int32 k = 0; k < B.Balloons.Num(); ++k)
					{
						if (!B.Balloons[k].IsValid()) continue;
						const FVector At = B.Balloons[k]->GetComponentLocation();
						Dp->FX()->Chips(At, FVector(0, 0, 100), 26, FLinearColor(0.8f, 0.12f, 0.1f), 2.f, 9.f, 180.f);
						Dp->FX()->Sound(TEXT("balloon_pop"), At, 0.8f, Dp->Random().FRandRange(0.85f, 1.3f));
						Dp->FX()->RemoveMesh(B.Balloons[k].Get());
						B.Balloons[k].Reset();
						if (k < B.Strings.Num() && B.Strings[k].IsValid()) { B.Strings[k]->SetVisibility(false); B.Strings[k].Reset(); }
						break;
					}
					if (--B.Alive == 0)
					{
						if (UStaticMeshComponent* Root = Dp->BodyRoot(B.Body))
						{
							Root->SetEnableGravity(true);
							Root->WakeAllRigidBodies();
							if (Root->IsSimulatingPhysics()) Root->SetPhysicsAngularVelocityInDegrees(Dp->Random().VRand() * 90.0);
						}
						TSharedRef<bool> Landed = MakeShared<bool>(false);
						const int32 Body = B.Body;
						Dp->During(4.f, [Dp, Body, Landed](float, float)
						{
							UStaticMeshComponent* Root = Dp->BodyRoot(Body);
							if (*Landed || !Root) return;
							const FVector At = Root->GetComponentLocation();
							if (At.Z < 190.0)
							{
								*Landed = true;
								Thud(*Dp, FVector(At.X, At.Y, 40), 90.f, 230.f, 380.f, 4);
								Dp->FX()->GlassBurst(At, FVector(0, 0, 300), FVector2D(160, 90));
								Dp->FX()->Sound(TEXT("crash_car"), At, 0.8f, Dp->Random().FRandRange(0.9f, 1.2f));
							}
						});
					}
				});
				When += FMath::Max(0.05f, 0.34f - n * 0.012f);
			}
		}));

	Out.Add(Tool(TEXT("giant_spring"), TEXT("Giant spring"), 6, TEXT("Absurd"), ENYCTarget::Facade, 8.0f, 48.f, 18.f,
		TEXT("A huge coil squeezes flat against the foot of a building, lets go, and flings the whole thing into the air."), TEXT("An animated coil compresses with a creak and releases with a boing; the building's floors are launched upward and outward as separate Chaos clusters that tumble back down."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 B = A.Building;
			TArray<int32> Near;
			D.BuildingsNear(A.Point, 3000.f, Near);
			// a mid-sized neighbour makes the best flight
			const FNYCBuildingInfo* I = D.Info(B);
			if (!I || I->Height > 7500.f)
			{
				double Best = 1e18;
				for (int32 N : Near)
				{
					const FNYCBuildingInfo* J = D.Info(N);
					const double Dist = J->Box.ComputeSquaredDistanceToPoint(A.Point);
					if (J->Height < 7500.f && Dist < Best) { Best = Dist; B = N; }
				}
				I = D.Info(B);
			}
			if (!I) return;
			const FVector Out = Outward(A);
			const FVector Foot = Ground(A.Point + Out * 460.0);
			UStaticMeshComponent* Coil = Prop(D, TEXT("tl_spring"), Foot, FQuat::Identity, 1.f);
			if (!Coil) return;
			TWeakObjectPtr<UStaticMeshComponent> Weak(Coil);
			TSharedRef<bool> Let = MakeShared<bool>(false);
			D.FX()->Sound(TEXT("spring_load"), Foot, 1.3f, 1.f);
			D.During(7.f, [Dp, Weak, Let, Foot, Out, B](float T, float)
			{
				if (!Weak.IsValid()) return;
				float H;
				if (T < 1.8f) H = FMath::Lerp(1.5f, 0.28f, FMath::InterpEaseInOut(0.f, 1.f, T / 1.8f, 2.f));
				else H = 1.5f + FMath::Exp(-(T - 1.8f) * 1.3f) * FMath::Cos((T - 1.8f) * 19.f) * 1.6f * FMath::Min(1.f, (T - 1.8f) * 9.f) - FMath::Exp(-(T - 1.8f) * 14.f) * 1.22f;
				const float Wide = 1.2f / FMath::Sqrt(FMath::Clamp(H, 0.5f, 2.4f));
				Weak->SetWorldScale3D(FVector(Wide, Wide, H));
				if (T >= 1.86f && !*Let)
				{
					*Let = true;
					Dp->CollapseBuilding(B, 0, 5, -Out, 0.f);
					Dp->HitTraffic(Foot, 1100.f, 500.f, 0.4f, false, FVector(0, 0, 2200));
					Thud(*Dp, Foot + FVector(0, 0, 700), 380.f, 1000.f, 1500.f, 60);
					Dp->FX()->DustSurge(Dp->Info(B)->Box, 700.f, WallOf(*Dp, B));
					Dp->FX()->Sound(TEXT("boing"), Foot, 2.f, 1.f);
					Dp->Shake(Foot, 25.f, 1.3f);
				}
			});
		}));

	Out.Add(Tool(TEXT("giant_magnet"), TEXT("Giant magnet"), 6, TEXT("Absurd"), ENYCTarget::District, 11.0f, 60.f, 22.f,
		TEXT("A horseshoe magnet the size of a house lowers over the street; cars, lamp posts and steel from the walls fly up and cling, then drop."), TEXT("Bodies are made weightless and accelerated toward the poles each step; steel is ripped from fronts as long thin lumps and drawn up by a physics field; on shut-off everything falls in one heap."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			UStaticMeshComponent* Magnet = Prop(D, TEXT("tl_magnet"), C + FVector(0, 0, 9000), FQuat::Identity, 1.9f);
			if (!Magnet) return;
			UStaticMeshComponent* Cable = D.NewVisual(D.UnitCube(), FTransform(C + FVector(0, 0, 12000)));
			Cable->SetMaterial(0, D.CityMaterial(TEXT("iron_black")));
			TWeakObjectPtr<UStaticMeshComponent> Weak(Magnet), Line(Cable);
			const int32 First = D.NumBodies();
			TSharedRef<int32> Count = MakeShared<int32>(0);
			TSharedRef<bool> Off = MakeShared<bool>(false);
			D.FX()->Sound(TEXT("magnet_hum"), C + FVector(0, 0, 2000), 1.4f, 1.f);
			D.During(11.f, [Dp, Weak, Line, C, First, Count, Off](float T, float Dt)
			{
				if (!Weak.IsValid()) return;
				const float In = FMath::InterpEaseInOut(0.f, 1.f, FMath::Clamp(T / 2.0f, 0.f, 1.f), 2.f);
				const float Leave = FMath::Clamp((T - 8.6f) / 2.4f, 0.f, 1.f);
				const double Z = FMath::Lerp(9000.0, 2500.0, (double)In) + Leave * Leave * 7000.0;
				const FVector P = C + FVector(FMath::Sin(T * 0.8f) * 90.f, FMath::Cos(T * 0.65f) * 70.f, Z);
				Weak->SetWorldLocation(P);
				if (Line.IsValid())
				{
					Line->SetWorldLocationAndRotation(P + FVector(0, 0, 1520 + 3000), FRotator(90, 0, 0).Quaternion());
					Line->SetWorldScale3D(FVector(60.0, 0.45, 0.45));
				}
				const int32 K = ++*Count;
				const FVector Pole = P - FVector(0, 0, 1250);
				if (T > 1.6f && T < 7.6f)
				{
					if (K % 3 == 0)
					{
						const int32 Pick = Dp->FindProp(C + FVector(Dp->Random().FRandRange(-1900.f, 1900.f), Dp->Random().FRandRange(-1900.f, 1900.f), 0),
							ANYCDestruction::MCar | ANYCDestruction::MPole | ANYCDestruction::MBox | ANYCDestruction::MPlate | ANYCDestruction::MShelter, 1100.f);
						if (Pick != INDEX_NONE)
						{
							const int32 Body = Loose(*Dp, Pick, FVector(0, 0, 500), Dp->Random().VRand() * 120.0);
							if (Body != INDEX_NONE && Dp->BodyRoot(Body)) Dp->BodyRoot(Body)->SetEnableGravity(false);
							Dp->FX()->Sound(TEXT("clang"), Pole, 0.7f, Dp->Random().FRandRange(0.7f, 1.3f));
						}
						Dp->HitTraffic(C, 1700.f, 60.f, 0.2f, false, FVector(0, 0, 800));
						Dp->SetBodiesGravity(C, 3600.f, false, First);
					}
					Dp->DragBodies(Pole, 5200.f, 2600.f, 1900.f, 0.f, 0.f, Dt);
					// they pile against the poles instead of passing through
					for (int32 i = First; i < Dp->NumBodies(); ++i)
					{
						UStaticMeshComponent* Body = Dp->BodyRoot(i);
						if (!Body || !Body->IsSimulatingPhysics()) continue;
						if (FVector::Dist(Body->GetComponentLocation(), Pole) < 560.0)
						{
							Body->SetPhysicsLinearVelocity(Body->GetPhysicsLinearVelocity() * 0.72);
							Body->SetPhysicsAngularVelocityInDegrees(Body->GetPhysicsAngularVelocityInDegrees() * 0.8);
						}
					}
					if (K % 5 == 0) Dp->DragDebris(Pole, 4200.f, 190.f, 0.f, 0.f);
					if (K % 11 == 0)
					{
						const float Ang = Dp->Random().FRandRange(0.f, 6.283f);
						FVector Point, Normal;
						int32 B = INDEX_NONE;
						if (Dp->Trace(C + FVector(0, 0, Dp->Random().FRandRange(500.f, 2600.f)), FVector(FMath::Cos(Ang), FMath::Sin(Ang), 0), 3800.f, Point, Normal, &B) >= 0.f && B != INDEX_NONE)
						{
							const FVector Pull = (Pole - Point).GetSafeNormal();
							Dp->SpawnLumps(Point + Normal * 60.0, Pull, 9, 90.f, TEXT("steel"), 1500.f, 0.12f, 5.f);
							FNYCDamage H;
							H.Center = Point;
							H.Radius = 210.f;
							H.GlassRadius = 460.f;
							H.Speed = 250.f;
							H.bRadial = false;
							H.Push = Pull * 1300.0;
							H.MaxElements = 8;
							H.PropRadius = 0.f;
							H.bStructural = false;
							H.Dust = 0.4f;
							Dp->ApplyDamage(H);
							Dp->FX()->Sparks(Point, Pull * 900.0, 60);
						}
					}
					if (K % 7 == 0) Dp->FX()->Motes(Pole - FVector(0, 0, 500), 24, FLinearColor(0.35f, 0.65f, 1.f), 600.f, 140.f, 1.2f, 4.f, FVector(0, 0, 700));
				}
				if (T >= 7.6f && !*Off)
				{
					*Off = true;
					Dp->SetBodiesGravity(C, 6000.f, true, First);
					Dp->KickDebris(Pole, 1800.f, 40.f, -500.f, false);
					Dp->FX()->Sound(TEXT("powerdown"), Pole, 1.4f, 1.f);
				}
			});
			D.After(8.9f, [Dp, C]() { Thud(*Dp, C + FVector(0, 0, 120), 220.f, 700.f, 650.f, 30); Dp->FX()->DustBurst(C + FVector(0, 0, 200), 600.f, 0.8f, TEXT("concrete")); Dp->Shake(C, 24.f, 1.f); Dp->FX()->Sound(TEXT("crash_heavy"), C, 1.6f, 0.85f); });
		}));
}
