// Tier 5: the city's own failures, and the weather and the ground turning on it.
#include "NYCToolKit.h"
#include "NYCLightField.h"
#include "EngineUtils.h"

using namespace NYCT;

namespace
{
	/** A forked channel of light between two points, made of short beams. */
	void Arc(ANYCDestruction& D, const FVector& From, const FVector& To, float Width, const FLinearColor& Colour, float Nits, float Life, float Jag)
	{
		const int32 N = FMath::Clamp(FMath::RoundToInt32(FVector::Dist(From, To) / (Jag * 1.6f)), 4, 22);
		FVector Prev = From;
		for (int32 i = 1; i <= N; ++i)
		{
			FVector P = FMath::Lerp(From, To, (double)i / N);
			if (i < N) P += D.Random().VRand() * Jag * D.Random().FRandRange(0.35f, 1.f);
			D.FX()->Beam(Prev, P, Width * (1.f - 0.4f * i / N), Colour, Nits, Life);
			if (i % 4 == 2) D.FX()->Beam(P, P + D.Random().VRand() * Jag * 3.f, Width * 0.4f, Colour, Nits * 0.5f, Life * 0.7f);
			Prev = P;
		}
	}

	/** One facade point near P facing outward, for hazards that attack building fronts. */
	bool FrontNear(ANYCDestruction& D, const FVector& P, float Reach, FVector& OutPoint, FVector& OutNormal, int32& OutBuilding)
	{
		FVector Dir(D.Random().FRandRange(-1.f, 1.f), D.Random().FRandRange(-1.f, 1.f), 0);
		Dir.Normalize();
		const float T = D.Trace(P, Dir, Reach, OutPoint, OutNormal, &OutBuilding);
		return T >= 0.f && OutBuilding != INDEX_NONE;
	}

	/** A wall of water that travels, sweeping what it meets. */
	void Surge(ANYCDestruction& D, const FVector& From, const FVector& Dir, double Length, float Speed, float Width, float Height, float Violence, bool bStructure)
	{
		const FQuat Rot = Facing(Dir);
		UStaticMeshComponent* Wall = Prop(D, TEXT("fx_waterwall"), From, Rot, 1.f);
		UStaticMeshComponent* Back = Prop(D, TEXT("fx_watersheet"), From, Rot, 1.f);
		if (!Wall || !Back) return;
		Wall->SetCustomPrimitiveDataFloat(0, 0.5f);
		Back->SetCustomPrimitiveDataFloat(0, 0.18f);
		Wall->SetWorldScale3D(FVector(Height / 100.f, Width / 4000.f, Height / 100.f));
		const float Time = (float)(Length / Speed);
		TWeakObjectPtr<UStaticMeshComponent> W1(Wall), W2(Back);
		ANYCDestruction* Dp = &D;
		TSharedRef<int32> Count = MakeShared<int32>(0);
		const FVector Side = WallTangent(Dir);
		D.During(Time + 5.0f, [Dp, W1, W2, From, Dir, Side, Rot, Speed, Time, Width, Height, Violence, bStructure, Count](float T, float)
		{
			if (!W1.IsValid() || !W2.IsValid()) return;
			const float U = FMath::Min(T, Time);
			const FVector Front = From + Dir * (Speed * U);
			// once it has run its course the water drains away
			const float Fall = FMath::Clamp((T - Time) / 4.f, 0.f, 1.f);
			const float H = Height * (1.f - Fall * 0.96f) * FMath::Min(1.f, 0.35f + T * 1.2f);
			W1->SetWorldLocationAndRotation(Front + FVector(0, 0, 8), Rot);
			W1->SetWorldScale3D(FVector(H / 100.f, Width / 4000.f, FMath::Max(H, 20.f) / 100.f));
			const double Trail = FMath::Min(Speed * U, Width * 2.4);
			W2->SetWorldLocationAndRotation(Front - Dir * (Trail * 0.5 + Height * 1.4) + FVector(0, 0, FMath::Max(16.0, H * 0.3)), Rot);
			W2->SetWorldScale3D(FVector((Trail + Height) / 100.0, Width * 0.98 / 100.0, 1.0));
			if (T > Time) return;
			const int32 K = ++*Count;
			if (K % 2 == 0)
			{
				const FVector At = Front + Side * Dp->Random().FRandRange(-0.45f, 0.45f) * Width + Dir * Height * 0.3;
				Dp->FX()->Splash(At + FVector(0, 0, H * 0.55f), H * 0.55f, 0.8f);
			}
			if (K % 5 == 0)
			{
				FNYCPuff Q;
				Q.Pos = Front + Side * Dp->Random().FRandRange(-0.4f, 0.4f) * Width + FVector(0, 0, H * 0.85f);
				Q.Vel = Dir * Speed * 0.55f + FVector(0, 0, 260);
				Q.Drag = 1.1f;
				Q.R0 = H * 0.35f;
				Q.R1 = H * 0.95f;
				Q.Squash = 0.65f;
				Q.Life = 2.4f;
				Q.Density = 0.55f;
				Q.Kind = ENYCVol::Mist;
				Q.Albedo = FLinearColor(0.7f, 0.73f, 0.74f);
				Q.NoiseM = H / 260.f + 0.6f;
				Dp->FX()->AddPuff(Q);
			}
			if (K % 4 == 0)
			{
				// everything in the band just reached goes with the water
				for (int32 j = -1; j <= 1; ++j)
				{
					const FVector P = Front + Side * (j * Width * 0.33) + FVector(0, 0, FMath::Min(H * 0.35f, 220.f));
					FNYCDamage Hit;
					Hit.Center = P;
					Hit.Radius = bStructure ? Height * 0.34f : 0.f;
					Hit.GlassRadius = bStructure ? Height * 0.8f : 0.f;
					Hit.Speed = 350.f * Violence;
					Hit.Push = Dir * Speed * 0.65f;
					Hit.bRadial = false;
					Hit.bFrame = false;
					Hit.PropRadius = Width * 0.22f;
					Hit.PropForce = Violence;
					Hit.UpKick = 220.f * Violence;
					Hit.MaxElements = 7;
					Hit.Dust = 0.15f;
					Hit.bStructural = Violence > 1.f;
					Dp->ApplyDamage(Hit);
				}
				Dp->KickDebris(Front, Width * 0.6f, 260.f * Violence, 80.f, false);
				Dp->Shake(Front, 4.f * Violence, 0.5f);
			}
		});
	}

	/** The moving funnel: cloud, orbiting rubbish, and the forces that go with it. */
	void Twister(ANYCDestruction& D, const FVector& From, const FVector& To, float Duration, float Radius, float Height, float Power)
	{
		FNYCPuff Look;
		Look.Pos = From + FVector(0, 0, Height * 0.5f);
		Look.R0 = Radius;
		Look.Squash = Height * 0.5f / Radius;
		Look.Kind = ENYCVol::Funnel;
		Look.Albedo = FLinearColor(0.3f, 0.275f, 0.245f);
		Look.Density = 1.7f;
		Look.FadeIn = 1.6f;
		Look.Life = Duration;
		Look.NoiseM = Radius / 150.f;
		const int32 Id = D.FX()->DrivenVolume(Look);
		FNYCPuff Deck = Look;
		Deck.Kind = ENYCVol::Smoke;
		Deck.Pos = From + FVector(0, 0, Height);
		Deck.R0 = Radius * 2.6f;
		Deck.Squash = 0.2f;
		Deck.Albedo = FLinearColor(0.11f, 0.115f, 0.125f);
		Deck.Density = 1.1f;
		Deck.NoiseM = Radius / 90.f;
		const int32 Collar = D.FX()->DrivenVolume(Deck);
		ANYCDestruction* Dp = &D;
		TSharedRef<int32> Count = MakeShared<int32>(0);
		D.FX()->Sound(TEXT("tornado"), From, 1.4f, 1.f);
		const int32 FirstBody = D.NumBodies();
		D.During(Duration, [Dp, Id, Collar, From, To, Duration, Radius, Height, Power, Count, FirstBody](float T, float Dt)
		{
			const float U = T / Duration;
			const FVector Along = (To - From).GetSafeNormal();
			const FVector Side = WallTangent(Along);
			const FVector Foot = FMath::Lerp(From, To, (double)U) + Side * (FMath::Sin(T * 1.3f) * Radius * 0.45f);
			Dp->FX()->DriveVolume(Id, Foot + FVector(0, 0, Height * 0.5f), Radius, Height * 0.5f / Radius);
			Dp->FX()->DriveVolume(Collar, Foot + FVector(0, 0, Height * 0.97f), Radius * 2.6f, 0.2f);
			const int32 K = ++*Count;
			const float Core = Radius * 0.5f;
			// what is loose is drawn in, whirled round and lifted
			Dp->DragBodies(Foot + FVector(0, 0, Height * 0.22f), Radius * 2.2f, 1500.f * Power, 2900.f * Power, 2900.f * Power, 0.f, Dt);
			if (K % 6 == 0)
			{
				Dp->DragDebris(Foot + FVector(0, 0, 500), Radius * 2.0f, 520.f * Power, 850.f * Power, -700.f);
				TArray<int32> Reach;
				Dp->CollectProps(Foot, Radius * 0.95f, Reach);
				int32 Taken = 0;
				for (int32 P : Reach)
				{
					if (Taken >= 5 || Dp->Random().GetFraction() > 0.5f) continue;
					const FVector At = Dp->PropLocation(P);
					const FVector In = (Foot - At).GetSafeNormal2D();
					const FVector Turn = FVector::CrossProduct(FVector::UpVector, In);
					Dp->LaunchProp(P, (Turn * 1300.0 + In * 500.0 + FVector(0, 0, 900)) * Power, FVector(200, 300, 150), false, false);
					++Taken;
				}
				Dp->HitTraffic(Foot, Radius * 0.8f, 1100.f * Power, 0.35f, false, FVector(0, 0, 800));
			}
			if (K % 3 == 0)
			{
				const float Ang = T * 7.f + K;
				const FVector Orbit = Foot + FVector(FMath::Cos(Ang) * Core, FMath::Sin(Ang) * Core, Dp->Random().FRandRange(60.f, Height * 0.45f));
				const FVector Turn(-FMath::Sin(Ang), FMath::Cos(Ang), 0.35f);
				Dp->FX()->Litter(Orbit, Turn * 2100.0, 40);
				Dp->FX()->Chips(Orbit, Turn * 2000.0, 45, FLinearColor(0.2f, 0.16f, 0.12f), 2.f, 14.f, 25.f);
				if (K % 12 == 0) Dp->FX()->Splinters(Orbit, Turn * 1700.0, 60);
			}
			if (K % 5 == 0)
			{
				FNYCPuff Q;
				Q.Pos = Foot + FVector(Dp->Random().FRandRange(-1.f, 1.f) * Core, Dp->Random().FRandRange(-1.f, 1.f) * Core, 120);
				Q.Vel = FVector(Dp->Random().FRandRange(-500.f, 500.f), Dp->Random().FRandRange(-500.f, 500.f), 420);
				Q.Drag = 1.f;
				Q.R0 = Radius * 0.2f;
				Q.R1 = Radius * 0.6f;
				Q.Squash = 0.7f;
				Q.Life = 3.5f;
				Q.Density = 0.7f;
				Q.Albedo = FLinearColor(0.24f, 0.2f, 0.16f);
				Q.NoiseM = Radius / 320.f + 0.8f;
				Q.bGroundHug = true;
				Dp->FX()->AddPuff(Q);
			}
			// it strips whatever front it touches, at all heights
			if (K % 9 == 0)
			{
				const FVector P = Foot + FVector(0, 0, Dp->Random().FRandRange(200.f, Height * 0.4f));
				FVector Point, Normal;
				int32 B = INDEX_NONE;
				const FVector Look_(Dp->Random().FRandRange(-1.f, 1.f), Dp->Random().FRandRange(-1.f, 1.f), 0);
				if (Dp->Trace(P, Look_.GetSafeNormal(), Radius * 1.5f, Point, Normal, &B) >= 0.f && B != INDEX_NONE)
				{
					FNYCDamage H;
					H.Center = Point;
					H.Radius = 180.f * Power;
					H.GlassRadius = 650.f * Power;
					H.Speed = 500.f;
					H.bRadial = false;
					H.Push = (FVector::CrossProduct(FVector::UpVector, (Foot - Point).GetSafeNormal2D()) * 900.0 + FVector(0, 0, 700)) * Power;
					H.MaxElements = Power > 1.2f ? 26 : 10;
					H.PropRadius = 0.f;
					H.Dust = 0.55f;
					H.bStructural = Power > 1.2f;
					Dp->ApplyDamage(H);
				}
			}
			Dp->Shake(Foot, 6.f * Power, 0.2f);
		});
		D.After(Duration - 0.2f, [Dp, Id, Collar]() { Dp->FX()->EndVolume(Id, 2.5f); Dp->FX()->EndVolume(Collar, 3.5f); });
	}
}

void NYCArsenal::RegisterHazards(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("water_main"), TEXT("Burst water main"), 5, TEXT("City hazard"), ENYCTarget::Street, 7.0f, 32.f, 10.f,
		TEXT("The pavement splits and a six-storey geyser tears it apart, flipping the car above."), TEXT("Crater, thrown paving, a manhole lid, vehicles launched from below, and a long Niagara water column with splashes and drifting spray."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector P = Ground(A.Point);
			D.FX()->Sound(TEXT("rumble_short"), P, 1.f, 1.f);
			D.Shake(P, 6.f, 1.0f);
			D.After(0.8f, [Dp, P]()
			{
				Dp->MakeCrater(P, 330.f, 110.f);
				Dp->SpawnLumps(P + FVector(0, 0, 40), FVector(0, 0, 1), 34, 55.f, TEXT("concrete"), 1250.f, 0.45f);
				Dp->HitTraffic(P, 520.f, 700.f, 0.6f, false, FVector(0, 0, 1400));
				const int32 Lid = Dp->FindProp(P, ANYCDestruction::MPlate, 2000.f);
				if (Lid != INDEX_NONE) Dp->LaunchProp(Lid, FVector(120, -80, 2400), FVector(700, 200, 0), false, false);
				Dp->FX()->WaterJet(P + FVector(0, 0, 20), FVector(0.06, 0.03, 1), 24.f, 3.4f);
				Dp->FX()->WaterJet(P + FVector(90, 40, 20), FVector(0.45, 0.2, 1), 18.f, 1.0f);
				Dp->FX()->Splash(P, 420.f, 1.6f);
				Repeat(*Dp, 12, 0.5f, 0.3f, [Dp, P](int32 i) { Dp->FX()->Splash(P + FVector(FMath::Cos(i * 2.4f), FMath::Sin(i * 2.4f), 0) * (200.f + i * 55.f), 150.f, 0.7f); });
				FNYCDamage H;
				H.Center = P + FVector(0, 0, 80);
				H.Radius = 0.f;
				H.GlassRadius = 900.f;
				H.PropRadius = 600.f;
				H.Speed = 600.f;
				H.UpKick = 700.f;
				Dp->ApplyDamage(H);
				Dp->FX()->Sound(TEXT("burst"), P, 1.2f, 0.8f);
				Dp->Shake(P, 16.f, 1.0f);
			});
		}));

	Out.Add(Tool(TEXT("manhole_cascade"), TEXT("Manhole cascade"), 5, TEXT("City hazard"), ENYCTarget::Street, 6.5f, 34.f, 10.f,
		TEXT("An underground fault runs down the street and one manhole after another launches its lid on a jet of fire."), TEXT("The real manhole and grate instances along the street, sorted by distance, fire in sequence: spinning lids, flame jets, smoke and glass."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			TArray<int32> Lids;
			D.CollectProps(A.Point, 4200.f, Lids, ANYCDestruction::MPlate);
			Lids.Sort([&D, &Along](int32 X, int32 Y) { return FVector::DotProduct(D.PropLocation(X), Along) < FVector::DotProduct(D.PropLocation(Y), Along); });
			TArray<TPair<int32, FVector>> Seq;
			for (int32 L : Lids)
				if (Seq.Num() < 12 && FMath::Abs(FVector::DotProduct(D.PropLocation(L) - A.Point, WallTangent(Along))) < 1200.0) Seq.Add({ L, D.PropLocation(L) });
			for (int32 i = Seq.Num(); i < 8; ++i) Seq.Add({ INDEX_NONE, Ground(A.Point + Along * ((i - 4) * 480.0)) });
			for (int32 i = 0; i < Seq.Num(); ++i)
			{
				const int32 Lid = Seq[i].Key;
				const FVector P = Ground(Seq[i].Value);
				D.After(0.4f + i * 0.34f, [Dp, Lid, P, i]()
				{
					if (Lid != INDEX_NONE) Dp->LaunchProp(Lid, FVector(Dp->Random().FRandRange(-250.f, 250.f), Dp->Random().FRandRange(-250.f, 250.f), 2100.f), FVector(900, 300, 120), false, false);
					else Dp->SpawnLumps(P + FVector(0, 0, 25), FVector(0, 0, 1), 5, 30.f, TEXT("iron_black"), 1500.f, 0.3f);
					Dp->MakeCrater(P, 90.f, 40.f);
					Dp->FX()->Fireball(P + FVector(0, 0, 190), 150.f, 0.55f, i % 3 == 0 ? 0.8f : 0.f);
					Dp->FX()->Sparks(P + FVector(0, 0, 30), FVector(0, 0, 1900), 130, FLinearColor(1.f, 0.55f, 0.18f), 16.f);
					Dp->FX()->SmokeColumn(P + FVector(0, 0, 60), 75.f, 7.f, 0.5f);
					Dp->ShatterGlass(P + FVector(0, 0, 150), 750.f, 600.f, 8);
					Dp->HitTraffic(P, 280.f, 500.f, 0.4f, true, FVector(0, 0, 900));
					Dp->FX()->Sound(TEXT("burst"), P, 1.f, 1.05f - 0.02f * i);
					Dp->Shake(P, 8.f, 0.45f);
				});
			}
		}));

	Out.Add(Tool(TEXT("gas_main"), TEXT("Gas main explosion"), 5, TEXT("City hazard"), ENYCTarget::Street, 9.0f, 55.f, 22.f,
		TEXT("Sixty metres of street erupt in a running line, leaving a burning trench and gutted storefronts."), TEXT("Blasts every four metres along the street axis timed as a travelling wave; asphalt slabs heaved upward, a chain of craters and standing flames."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("rumble_short"), C, 1.f, 0.8f);
			Repeat(D, 17, 0.1f, 0.7f, [Dp, C, Along](int32 i)
			{
				const FVector P = C + Along * ((i - 8) * 400.0) + WallTangent(Along) * Dp->Random().FRandRange(-110.f, 110.f);
				if (i % 2 == 0) Dp->MakeCrater(P, 230.f, 85.f);
				Dp->SpawnLumps(P + FVector(0, 0, 35), FVector(0, 0, 1), 9, 70.f, i % 3 ? TEXT("granite_black") : TEXT("concrete"), 1350.f, 0.4f);
				Dp->FX()->Fireball(P + FVector(0, 0, 150), 300.f, 0.75f, i % 5 == 0 ? 1.f : 0.f);
				Dp->FX()->Chips(P, FVector(0, 0, 1800), 70, FLinearColor(0.1f, 0.08f, 0.06f), 2.f, 11.f, 28.f);
				FNYCDamage H;
				H.Center = P + FVector(0, 0, 60);
				H.Radius = 340.f;
				H.GlassRadius = 1300.f;
				H.PropRadius = 600.f;
				H.Speed = 1000.f;
				H.UpKick = 900.f;
				H.Fire = 0.35f;
				H.MaxElements = 12;
				H.bFrame = false;
				Dp->ApplyDamage(H);
				if (i % 2 == 1) Dp->FX()->Fire(P + FVector(0, 0, 10), 150.f, 15.f);
				if (i % 4 == 0) Dp->FX()->SmokeColumn(P, 170.f, 14.f);
				Dp->FX()->Sound(TEXT("blast_med"), P, 1.f, 0.9f + 0.012f * i);
				Dp->Shake(P, 13.f, 0.6f);
			});
		}));

	Out.Add(Tool(TEXT("arc_storm"), TEXT("Transformer arc storm"), 5, TEXT("City hazard"), ENYCTarget::Pole, 3.2f, 30.f, 10.f,
		TEXT("A vault blows and raw current leaps from post to post, bursting lamps and setting cars alight."), TEXT("Jagged blue arcs built from beam segments hop between nearby poles and cars with spark showers; the lamps they touch go dark, posts fall, vehicles ignite."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Vault = Ground(A.Point, 20.0);
			TArray<int32> Poles;
			D.CollectProps(Vault, 3200.f, Poles, ANYCDestruction::MPole);
			Poles.Sort([&D, &Vault](int32 X, int32 Y) { return FVector::DistSquared(D.PropLocation(X), Vault) < FVector::DistSquared(D.PropLocation(Y), Vault); });
			FBlast B;
			B.Radius = 90.f;
			B.Glass = 600.f;
			B.Speed = 800.f;
			B.Fireball = 110.f;
			B.MaxElements = 3;
			B.Crater = 70.f;
			B.Sound = TEXT("zap_big");
			Blast(D, Vault, B);
			TSharedRef<FVector> Last = MakeShared<FVector>(Vault);
			const int32 N = FMath::Max(10, FMath::Min(Poles.Num(), 16));
			for (int32 i = 0; i < N; ++i)
			{
				const int32 Pole = Poles.IsValidIndex(i) ? Poles[i] : INDEX_NONE;
				const FVector To = Pole != INDEX_NONE ? D.PropLocation(Pole) + FVector(0, 0, D.Random().FRandRange(280.f, 720.f))
					: Vault + FVector(D.Random().FRandRange(-1500.f, 1500.f), D.Random().FRandRange(-1500.f, 1500.f), D.Random().FRandRange(40.f, 700.f));
				D.After(0.45f + i * 0.33f, [Dp, Pole, To, Last, Vault, i]()
				{
					const FLinearColor Blue(0.35f, 0.62f, 1.f);
					Arc(*Dp, *Last, To, 7.f, Blue, 130000.f, 0.22f, 90.f);
					Arc(*Dp, Vault, To, 3.f, Blue, 70000.f, 0.14f, 130.f);
					*Last = To;
					Dp->FX()->Glow(To, Blue, 52000.f * Dp->FX()->GlowScale(), 1500.f, 0.45f, 0.6f);
					Dp->FX()->Sparks(To, FVector(0, 0, 500), 130, FLinearColor(0.6f, 0.78f, 1.f), 160.f);
					Dp->ShatterGlass(To, 330.f, 350.f, 2);
					for (TActorIterator<ANYCLightField> It(Dp->GetWorld()); It; ++It) It->KillLights(To, 600.f);
					if (Pole != INDEX_NONE && i % 3 == 2) Dp->LaunchProp(Pole, FVector(Dp->Random().FRandRange(-160.f, 160.f), Dp->Random().FRandRange(-160.f, 160.f), 40), FVector(30, 40, 0), false, false);
					const int32 Car = Dp->FindProp(To, ANYCDestruction::MCar, 700.f);
					if (Car != INDEX_NONE && i % 2 == 0)
					{
						const FVector At = Dp->PropLocation(Car) + FVector(0, 0, 100);
						Arc(*Dp, To, At, 4.f, Blue, 100000.f, 0.2f, 60.f);
						Dp->LaunchProp(Car, FVector(0, 0, 120), FVector::ZeroVector, false, true);
					}
					Dp->FX()->Sound(TEXT("zap"), To, 0.95f, Dp->Random().FRandRange(0.8f, 1.25f));
					Dp->Shake(To, 3.f, 0.2f);
				});
			}
		}));

	Out.Add(Tool(TEXT("sinkhole"), TEXT("Sinkhole"), 5, TEXT("Natural disaster"), ENYCTarget::Street, 11.0f, 60.f, 28.f,
		TEXT("The street gives way. The hole widens, swallowing cars and posts, until the corner of a building slides in."), TEXT("A crater regrown in stages; props and cars that fall inside the rim are animated sinking and tilting out of sight; footings of the nearest building are removed so it leans in."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("rumble_long"), C, 1.2f, 0.85f);
			Repeat(D, 8, 0.72f, 0.5f, [Dp, C](int32 i)
			{
				const float R = 190.f + i * 165.f;
				// a slightly shifted centre each time keeps the rim ragged
				const FVector Off(FMath::Cos(i * 2.3f) * 45.f, FMath::Sin(i * 2.3f) * 45.f, 0);
				Dp->MakeCrater(C + Off, R, R * 0.62f);
				Dp->SpawnLumps(C + FVector(FMath::Cos(i * 1.7f), FMath::Sin(i * 1.7f), 0) * R * 0.85f + FVector(0, 0, 30), FVector(-FMath::Cos(i * 1.7f), -FMath::Sin(i * 1.7f), 0.35f), 12, 60.f, TEXT("concrete"), 420.f, 0.4f);
				Dp->FX()->DustBurst(C + FVector(0, 0, 100), R * 0.7f, 0.8f, TEXT("soil"));
				TArray<int32> In;
				Dp->CollectProps(C, R * 0.93f, In);
				for (int32 P : In)
				{
					const FVector At = Dp->PropLocation(P);
					Dp->SinkProp(P, 1400.f, 1.5f + (float)FVector::Dist2D(At, C) / 900.f);
				}
				Dp->HitTraffic(C, R * 0.85f, 120.f, 0.3f, false, FVector(0, 0, -900));
				Dp->Shake(C, 7.f + i * 2.f, 0.7f);
				Dp->FX()->Sound(TEXT("crunch"), C, 1.f, 0.7f - 0.03f * i);
				if (i >= 4)
				{
					int32 B = INDEX_NONE;
					if (Dp->NearestBuilding(C + FVector(0, 0, 200), R + 900.f, B))
					{
						const FNYCBuildingInfo* I = Dp->Info(B);
						const FVector At = I->Box.GetClosestPointTo(C + FVector(0, 0, 120));
						FNYCDamage H;
						H.Center = At;
						H.Radius = 300.f + (i - 4) * 90.f;
						H.GlassRadius = H.Radius * 2.f;
						H.Speed = 200.f;
						H.bRadial = false;
						H.Push = (C - At).GetSafeNormal2D() * 420.0 + FVector(0, 0, -600);
						H.MaxElements = 20;
						H.PropRadius = 0.f;
						Dp->ApplyDamage(H);
						if (i == 7) Dp->CollapseBuilding(B, 1, 2, (C - At).GetSafeNormal2D(), 0.5f);
					}
				}
			});
		}));

	Out.Add(Tool(TEXT("hailstorm"), TEXT("Giant hail"), 5, TEXT("Weather"), ENYCTarget::District, 9.0f, 40.f, 14.f,
		TEXT("Ice the size of footballs hammers the block: windows burst everywhere, cars are pounded, ice bounces in the street."), TEXT("Two hundred falling ice meshes with their own flights; each impact breaks glass, dents or knocks over what it hits and bursts into ice chips; the sky darkens."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			ShiftWeather(D, 9.f, 1.f, 0.75f, 0.25f, 0.f, 0.7f);
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("hail"), C, 1.1f, 1.f);
			Repeat(D, 110, 0.065f, 0.4f, [Dp, C](int32 i)
			{
				FFlight F;
				F.Mesh = TEXT("tl_hail");
				const FVector T = C + FVector(Dp->Random().FRandRange(-2600.f, 2600.f), Dp->Random().FRandRange(-2600.f, 2600.f), 0);
				F.From = T + FVector(-700, -900, 5200);
				F.Velocity = FVector(420, 540, -3100);
				F.Gravity = 0.4f;
				F.Scale = Dp->Random().FRandRange(0.9f, 2.1f);
				F.Spin = 700.f;
				F.bAlign = false;
				F.MaxTime = 3.f;
				F.Hit = [Dp, i](const FVector& P, const FVector& N, int32 B, const FVector&)
				{
					Dp->FX()->Chips(P + N * 6.0, N * 520.0, 16, FLinearColor(0.75f, 0.84f, 0.92f), 1.f, 5.f, 80.f);
					if (B != INDEX_NONE && i % 2 == 0) Dp->ShatterGlass(P, 200.f, 450.f, 2);
					if (N.Z > 0.7f && i % 3 == 0)
					{
						Dp->SpawnLumps(P + N * 10.0, N, 2, 14.f, TEXT("ice_clear"), 380.f, 0.9f);
						Dp->HitTraffic(P, 170.f, 90.f, 0.35f, false, FVector::ZeroVector);
					}
					if (i % 5 == 0)
					{
						FNYCDamage H;
						H.Center = P;
						H.Radius = 0.f;
						H.GlassRadius = 0.f;
						H.PropRadius = 130.f;
						H.Speed = 320.f;
						Dp->ApplyDamage(H);
					}
					Dp->Scar(P, N, 9.f);
					if (i % 3 == 0) Dp->FX()->Sound(TEXT("tick_glass"), P, 0.55f, Dp->Random().FRandRange(0.5f, 0.9f));
				};
				Fly(*Dp, F);
			});
		}));

	Out.Add(Tool(TEXT("super_lightning"), TEXT("Superbolt"), 5, TEXT("Weather"), ENYCTarget::Roof, 8.0f, 75.f, 20.f,
		TEXT("Three enormous strokes hit the same tower: the crown explodes, windows burst down its whole height and the roof burns."), TEXT("Forked bolts built from beam segments, rationed to stay within the flash limit; each stroke blasts the roof, showers sparks down the facade and starts fires."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			ShiftWeather(D, 8.f, 1.f, 1.f, 0.7f, 0.f, 0.8f);
			int32 B = A.Building;
			if (B == INDEX_NONE) D.NearestBuilding(A.Point, 5000.f, B);
			const FNYCBuildingInfo* I = D.Info(B);
			const double Top = I ? I->Height : A.Point.Z;
			const FVector Crown = FVector(A.Point.X, A.Point.Y, Top);
			const FVector In = -Outward(A) * 250.0;
			Repeat(D, 3, 1.55f, 0.9f, [Dp, Crown, In, B](int32 i)
			{
				const FVector Hit = Crown + In + FVector((i - 1) * 260.0, (i % 2) * 230.0, -40.0 - i * 130.0);
				const FLinearColor Violet(0.68f, 0.74f, 1.f);
				Arc(*Dp, Hit + FVector(2600, -3800, 21000), Hit, 55.f, Violet, 200000.f, 0.28f, 700.f);
				Arc(*Dp, Hit + FVector(2600, -3800, 21000), Hit, 17.f, Violet, 240000.f, 0.4f, 380.f);
				Dp->FX()->Flash(Hit + FVector(0, 0, 400), Violet, 3.2e7f * Dp->FX()->GlowScale(), 26000.f, 0.45f, 0.3f);
				FBlast X;
				X.Radius = 330.f;
				X.Glass = 1500.f;
				X.Speed = 1400.f;
				X.Fireball = 190.f;
				X.Flash = 0.f;
				X.Burn = 0.7f;
				X.MaxElements = 34;
				X.Sound = TEXT("thunder_close");
				X.Volume = 1.4f;
				X.ShakeAmount = 18.f;
				Blast(*Dp, Hit, X);
				Dp->FX()->Sparks(Hit, FVector(0, 0, 1400), 380, FLinearColor(0.7f, 0.8f, 1.f), 170.f);
				Dp->FX()->Fire(Hit + FVector(0, 0, 40), 190.f, 14.f);
				// the charge runs to ground down the steel
				for (int32 k = 1; k <= 5; ++k)
				{
					const FVector Down(Hit.X - In.X * 1.15, Hit.Y - In.Y * 1.15, Hit.Z * (1.0 - k / 5.6));
					Dp->After(k * 0.07f, [Dp, Down]()
					{
						Dp->ShatterGlass(Down, 450.f, 500.f, 6);
						Dp->FX()->Sparks(Down, FVector(0, 0, -400), 60, FLinearColor(0.75f, 0.85f, 1.f), 150.f);
					});
				}
			});
		}));

	Out.Add(Tool(TEXT("microburst"), TEXT("Microburst"), 5, TEXT("Weather"), ENYCTarget::District, 7.0f, 52.f, 20.f,
		TEXT("A column of cold air slams down and spreads flat: trees and lamps go over outward, signs and glass fly."), TEXT("A downward blast: a dust ring racing out along the ground, street objects flattened radially with distance-timed delays, windows broken on the faces turned to the centre."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			ShiftWeather(D, 7.f, 1.f, 0.8f, 0.6f, 0.f, 1.f);
			const FVector C = Ground(A.Point);
			for (int32 i = 0; i < 9; ++i)
			{
				FNYCPuff Q;
				Q.Pos = C + FVector(D.Random().FRandRange(-600.f, 600.f), D.Random().FRandRange(-600.f, 600.f), 4200 - i * 120);
				Q.Vel = FVector(0, 0, -3600);
				Q.Drag = 0.85f;
				Q.R0 = 500.f;
				Q.R1 = 1100.f;
				Q.Life = 3.0f;
				Q.Density = 0.4f;
				Q.Kind = ENYCVol::Mist;
				Q.Albedo = FLinearColor(0.5f, 0.53f, 0.57f);
				Q.NoiseM = 4.f;
				D.FX()->AddPuff(Q);
			}
			D.FX()->Sound(TEXT("gust"), C, 1.4f, 0.85f);
			D.After(1.05f, [Dp, C]()
			{
				Dp->FX()->GroundRing(C, 6200.f, 3300.f, 0.75f, TEXT("concrete"));
				Dp->FX()->ShockDome(C, 4200.f, 3300.f, 0.25f, FLinearColor(0.8f, 0.86f, 0.95f));
				for (int32 k = 0; k < 8; ++k)
				{
					const float R0 = k * 600.f, R1 = R0 + 600.f;
					Dp->After(R1 / 3300.f, [Dp, C, R0, R1, k]()
					{
						TArray<int32> List;
						Dp->CollectProps(C, R1, List);
						int32 N = 0;
						for (int32 P : List)
						{
							const FVector At = Dp->PropLocation(P);
							if (FVector::Dist2D(At, C) < R0 || Dp->Random().GetFraction() > 0.75f - k * 0.06f) continue;
							const FVector Dir = (At - C).GetSafeNormal2D();
							Dp->LaunchProp(P, Dir * (1500.0 - k * 120.0) + FVector(0, 0, 220), FVector(-Dir.Y, Dir.X, 0) * 230.0, false, false);
							if (++N > 16) break;
						}
						Dp->HitTraffic(C, R1, 800.f - k * 70.f, 0.25f, false, FVector::ZeroVector);
						Dp->ShatterGlass(C + FVector(0, 0, 500), R1, 900.f, 10 + k * 4);
						Dp->FX()->Litter(C + FVector(R1 * 0.5, 0, 200), FVector(1800, 0, 500), 90);
						Dp->FX()->Litter(C - FVector(R1 * 0.5, 0, -200), FVector(-1800, 0, 500), 90);
						Dp->Shake(C, 10.f - k, 0.5f);
					});
				}
			});
		}));

	Out.Add(Tool(TEXT("blizzard"), TEXT("Crushing blizzard"), 5, TEXT("Weather"), ENYCTarget::District, 11.0f, 45.f, 18.f,
		TEXT("Wet snow piles up fast until things give way under it: branches, lamp arms, awnings, rooftop tanks."), TEXT("The weather controller is driven into a whiteout that settles on every surface; trees, posts and roof equipment fail one by one and slump (gentle velocities, heavy fall), with icy fragments."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			ShiftWeather(D, 12.f, 1.f, 0.35f, 0.f, 1.f, 0.85f, 1.f);
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("blizzard"), C, 1.2f, 1.f);
			Repeat(D, 30, 0.31f, 1.4f, [Dp, C](int32 i)
			{
				const float Reach = 900.f + i * 90.f;
				const int32 Which = i % 3;
				const int32 P = Dp->FindProp(C + FVector(Dp->Random().FRandRange(-Reach, Reach), Dp->Random().FRandRange(-Reach, Reach), 0), Which == 0 ? ANYCDestruction::MTree : Which == 1 ? ANYCDestruction::MPole : (ANYCDestruction::MBag | ANYCDestruction::MBox | ANYCDestruction::MStall), 1400.f);
				if (P != INDEX_NONE)
				{
					const FVector At = Dp->PropLocation(P);
					const FVector Lean(Dp->Random().FRandRange(-1.f, 1.f), Dp->Random().FRandRange(-1.f, 1.f), 0);
					Dp->LaunchProp(P, Lean.GetSafeNormal() * 90.0, FVector(-Lean.Y, Lean.X, 0) * 28.0, false, false);
					Dp->FX()->Motes(At + FVector(0, 0, 350), 130, FLinearColor(0.85f, 0.9f, 1.f), 170.f, 130.f, 2.4f, 6.f, FVector(0, 0, -520));
					Dp->SpawnLumps(At + FVector(0, 0, 300), FVector(0, 0, -1), 5, 22.f, TEXT("ice_clear"), 120.f, 0.9f);
					Dp->FX()->Sound(TEXT("timber"), At, 0.7f, Dp->Random().FRandRange(0.9f, 1.3f));
				}
				if (i % 3 == 2)
				{
					// a tank or a cornice gives up on a roof nearby
					TArray<int32> Near;
					Dp->BuildingsNear(C, Reach + 1500.f, Near);
					if (Near.Num())
					{
						const int32 B = Near[Dp->Random().RandRange(0, Near.Num() - 1)];
						const FNYCBuildingInfo* I = Dp->Info(B);
						if (I && I->Height < 9000.f)
						{
							FNYCDamage H;
							H.Center = FVector(I->Rect.GetCenter().X + Dp->Random().FRandRange(-500.f, 500.f), I->Rect.GetCenter().Y + Dp->Random().FRandRange(-500.f, 500.f), I->Height + 120.f);
							H.Radius = 330.f;
							H.GlassRadius = 0.f;
							H.Speed = 130.f;
							H.bRadial = false;
							H.Push = FVector(0, 0, -450);
							H.MaxElements = 10;
							H.PropRadius = 0.f;
							H.bStructural = false;
							H.Dust = 0.4f;
							Dp->ApplyDamage(H);
						}
					}
				}
			});
		}));

	Out.Add(Tool(TEXT("hurricane"), TEXT("Hurricane gust front"), 5, TEXT("Weather"), ENYCTarget::District, 10.0f, 48.f, 18.f,
		TEXT("A screaming horizontal gale with driving rain strips the windward fronts, sheet by sheet."), TEXT("Sustained wind: rain and wind pushed to maximum, windows on faces turned into the wind failing in waves, loose objects and roof gear dragged downwind, debris streaming horizontally."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			ShiftWeather(D, 11.f, 1.f, 0.9f, 1.f, 0.f, 1.f);
			const FVector C = Ground(A.Point);
			const FVector Blow = StreetAxis(A.Dir);
			D.FX()->Sound(TEXT("hurricane"), C, 1.5f, 1.f);
			Repeat(D, 44, 0.21f, 0.5f, [Dp, C, Blow](int32 i)
			{
				const FVector At = C + Blow * Dp->Random().FRandRange(-3200.f, 3200.f) + WallTangent(Blow) * Dp->Random().FRandRange(-2400.f, 2400.f) + FVector(0, 0, Dp->Random().FRandRange(200.f, 2600.f));
				FVector Point, Normal;
				int32 B = INDEX_NONE;
				// looking downwind finds the faces that take the wind
				if (Dp->Trace(At - Blow * 1600.0, Blow, 3600.f, Point, Normal, &B) >= 0.f && B != INDEX_NONE)
				{
					Dp->ShatterGlass(Point, 330.f + (i % 5) * 70.f, 750.f, 5);
					Dp->FX()->Litter(Point, Blow * 2200.0, 30);
					if (i % 6 == 0)
					{
						FNYCDamage H;
						H.Center = Point;
						H.Radius = 190.f;
						H.GlassRadius = 0.f;
						H.Speed = 150.f;
						H.bRadial = false;
						H.Push = Blow * 1200.0 + FVector(0, 0, 150);
						H.bFrame = false;
						H.MaxElements = 4;
						H.PropRadius = 0.f;
						H.bStructural = false;
						Dp->ApplyDamage(H);
					}
				}
				const int32 P = Dp->FindProp(At, ANYCDestruction::MTree | ANYCDestruction::MBox | ANYCDestruction::MBag | ANYCDestruction::MStall | ANYCDestruction::MPole, 1500.f);
				if (P != INDEX_NONE && i % 2 == 0) Dp->LaunchProp(P, Blow * Dp->Random().FRandRange(700.f, 1900.f) + FVector(0, 0, 260), FVector(-Blow.Y, Blow.X, 0) * 180.0, false, false);
				Dp->FX()->Litter(At, Blow * 2600.0, 45);
				if (i % 4 == 0) Dp->FX()->Chips(At, Blow * 2400.0, 50, FLinearColor(0.18f, 0.15f, 0.11f), 2.f, 9.f, 18.f);
				if (i % 5 == 0)
				{
					FNYCPuff Q;
					Q.Pos = At;
					Q.Vel = Blow * 2600.f;
					Q.Drag = 0.25f;
					Q.R0 = 260.f;
					Q.R1 = 620.f;
					Q.Squash = 0.4f;
					Q.Life = 2.0f;
					Q.Density = 0.34f;
					Q.Kind = ENYCVol::Mist;
					Q.Albedo = FLinearColor(0.5f, 0.54f, 0.58f);
					Q.NoiseM = 2.6f;
					Dp->FX()->AddPuff(Q);
				}
				for (int32 k = FMath::Max(0, Dp->NumBodies() - 40); k < Dp->NumBodies(); ++k)
				{
					if (UStaticMeshComponent* R = Dp->BodyRoot(k)) { if (R->IsSimulatingPhysics()) R->AddImpulse(Blow * 220.0 + FVector(0, 0, 60), NAME_None, true); }
				}
				Dp->Shake(At, 2.5f, 0.22f);
			});
		}));

	Out.Add(Tool(TEXT("tornado"), TEXT("Tornado"), 5, TEXT("Natural disaster"), ENYCTarget::District, 7.0f, 80.f, 28.f,
		TEXT("A twisting funnel walks up the avenue, lifting cars and street furniture and peeling the fronts."), TEXT("A ray-marched funnel volume driven along a wandering path; loose bodies are dragged into orbit, physics fields swirl the debris, props are torn up and facades stripped where it touches; Niagara litter and splinters orbit it."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ShiftWeather(D, 12.f, 1.f, 0.85f, 0.2f, 0.f, 0.9f);
			const FVector Along = StreetAxis(A.Dir);
			Twister(D, Ground(A.Point - Along * 2400.0), Ground(A.Point + Along * 3600.0), 12.f, 1500.f, 11000.f, 1.0f);
		}));

	Out.Add(Tool(TEXT("wedge_tornado"), TEXT("Wedge tornado"), 5, TEXT("Natural disaster"), ENYCTarget::District, 7.0f, 330.0f, 120.0f,
		TEXT("A funnel wider than the avenue grinds across several blocks and brings buildings down in its path."), TEXT("A far larger, lower, darker funnel with structural damage and whole-building collapses along its track, and a debris cloud at its foot."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ShiftWeather(D, 14.f, 1.f, 1.f, 0.5f, 0.f, 1.f);
			ANYCDestruction* Dp = &D;
			const FVector Along = StreetAxis(A.Dir);
			const FVector From = Ground(A.Point - Along * 5600.0), To = Ground(A.Point + Along * 5200.0);
			Twister(D, From, To, 14.f, 3400.f, 14000.f, 1.7f);
			Repeat(D, 7, 1.6f, 1.6f, [Dp, From, To, Along](int32 i)
			{
				const FVector Foot = FMath::Lerp(From, To, (i + 1.0) / 8.5);
				TArray<int32> Near;
				Dp->BuildingsNear(Foot + FVector(0, 0, 500), 2600.f, Near);
				int32 N = 0;
				for (int32 B : Near)
				{
					const FNYCBuildingInfo* I = Dp->Info(B);
					if (!I || I->Height > 13000.f || N >= 1) continue;
					++N;
					const FVector Away = (FVector(I->Rect.GetCenter().X, I->Rect.GetCenter().Y, 0) - Foot).GetSafeNormal2D();
					Dp->CollapseBuilding(B, FMath::Max(1, FMath::FloorToInt32(I->Height / FMath::Max(I->FloorH, 300.f) * 0.35f)), 3, FVector(-Away.Y, Away.X, 0), 0.1f);
				}
				Dp->ShatterGlass(Foot + FVector(0, 0, 900), 3800.f, 1300.f, 120);
			});
		}));

	Out.Add(Tool(TEXT("flash_flood"), TEXT("Flash flood"), 5, TEXT("Natural disaster"), ENYCTarget::District, 6.0f, 50.f, 18.f,
		TEXT("A chest-high surge of brown water races down the avenue, floating cars and carrying everything loose."), TEXT("A moving wave mesh with the flood shader and foam, Niagara spray and mist; everything in its band is pushed along with the flow, ground floors are breached."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ShiftWeather(D, 10.f, 1.f, 0.5f, 0.8f, 0.f, 0.6f);
			const FVector Along = StreetAxis(A.Dir);
			D.FX()->Sound(TEXT("flood"), A.Point, 1.4f, 1.f);
			Surge(D, Ground(A.Point - Along * 4600.0), Along, 9000.0, 1250.f, 2300.f, 230.f, 0.75f, true);
		}));

	Out.Add(Tool(TEXT("tsunami"), TEXT("Tsunami down 42nd Street"), 5, TEXT("Natural disaster"), ENYCTarget::District, 6.0f, 110.0f, 40.0f,
		TEXT("A wall of water five storeys high comes in off the river and fills the street, ripping out the lower floors."), TEXT("A very large wave with heavy structural damage along both fronts, cars and wreckage carried with it, huge spray and a thunderous roar."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ShiftWeather(D, 13.f, 1.f, 0.6f, 0.3f, 0.f, 0.8f);
			// it comes from the east: down the grid's -y
			const FVector Along(0, -1, 0);
			D.FX()->Sound(TEXT("tsunami"), A.Point, 1.8f, 1.f);
			Surge(D, Ground(A.Point - Along * 9000.0), Along, 17000.0, 2100.f, 3300.f, 1500.f, 1.7f, true);
		}));

	Out.Add(Tool(TEXT("tremor"), TEXT("Earthquake, magnitude 5"), 5, TEXT("Natural disaster"), ENYCTarget::District, 9.0f, 45.f, 14.f,
		TEXT("Everything shakes: windows crack across the block, parapet bricks and rooftop tanks come loose."), TEXT("Sustained camera and ground shake with random light damage: glass failing, falling roof equipment, chunks off cornices, dust off every ledge; no collapses."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("quake"), C, 1.2f, 1.1f);
			D.Shake(C, 22.f, 8.f);
			Repeat(D, 40, 0.19f, 0.4f, [Dp, C](int32 i)
			{
				const FVector P = C + FVector(Dp->Random().FRandRange(-3200.f, 3200.f), Dp->Random().FRandRange(-3200.f, 3200.f), Dp->Random().FRandRange(200.f, 2800.f));
				FVector Point, Normal;
				int32 B = INDEX_NONE;
				if (FrontNear(*Dp, P, 4000.f, Point, Normal, B))
				{
					Dp->ShatterGlass(Point, 240.f, 220.f, 3);
					Dp->FX()->DustBurst(Point + Normal * 40.0, 80.f, 0.55f, WallOf(*Dp, B));
					if (i % 4 == 0) Dp->SpawnLumps(Point + Normal * 30.0, Normal * 0.35 + FVector(0, 0, -0.4), 8, 24.f, WallOf(*Dp, B), 180.f);
				}
				if (i % 5 == 0)
				{
					TArray<int32> Near;
					Dp->BuildingsNear(C, 3600.f, Near);
					if (Near.Num())
					{
						const int32 Pick = Near[Dp->Random().RandRange(0, Near.Num() - 1)];
						const FNYCBuildingInfo* I = Dp->Info(Pick);
						if (I && I->Height < 11000.f)
						{
							FNYCDamage H;
							H.Center = FVector(I->Rect.GetCenter().X, I->Rect.GetCenter().Y, I->Height + 160.f);
							H.Radius = 420.f;
							H.GlassRadius = 0.f;
							H.Speed = 160.f;
							H.bRadial = false;
							H.Push = FVector(Dp->Random().FRandRange(-300.f, 300.f), Dp->Random().FRandRange(-300.f, 300.f), -150.f);
							H.MaxElements = 9;
							H.PropRadius = 0.f;
							H.bStructural = false;
							H.Dust = 0.5f;
							Dp->ApplyDamage(H);
						}
					}
				}
				if (i % 6 == 0) Dp->KickDebris(C, 4000.f, 90.f, 60.f, false);
			});
		}));

	Out.Add(Tool(TEXT("megaquake"), TEXT("Great quake and fissure"), 5, TEXT("Natural disaster"), ENYCTarget::District, 15.0f, 210.0f, 105.0f,
		TEXT("The ground splits along the street and, one after another, buildings pancake and topple into the dust."), TEXT("Violent shake; a fissure of overlapping craters opens progressively with heaved slabs; six surrounding buildings fail with differing collapse modes, staggered, with dust surges."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FVector Along = StreetAxis(A.Dir);
			D.FX()->Sound(TEXT("quake"), C, 1.8f, 0.75f);
			D.Shake(C, 55.f, 12.f);
			Repeat(D, 17, 0.22f, 0.8f, [Dp, C, Along](int32 i)
			{
				const int32 K = (i % 2 == 0 ? 1 : -1) * ((i + 1) / 2);
				const FVector P = C + Along * (K * 480.0) + WallTangent(Along) * (FMath::Sin(K * 1.9) * 210.0);
				Dp->MakeCrater(P, 200.f + (i % 3) * 90.f, 190.f);
				Dp->SpawnLumps(P + FVector(0, 0, 40), FVector(0, 0, 1), 9, 90.f, i % 2 ? TEXT("concrete") : TEXT("granite_black"), 700.f, 0.6f);
				Dp->FX()->DustBurst(P + FVector(0, 0, 110), 220.f, 0.8f, TEXT("soil"));
				FNYCDamage H;
				H.Center = P;
				H.Radius = 0.f;
				H.GlassRadius = 1500.f;
				H.PropRadius = 460.f;
				H.Speed = 500.f;
				H.UpKick = 450.f;
				Dp->ApplyDamage(H);
				Dp->FX()->Sound(TEXT("crunch"), P, 1.1f, 0.55f);
			});
			TArray<int32> Near;
			D.BuildingsNear(C + FVector(0, 0, 500), 4600.f, Near);
			Near.Sort([&D, &C](int32 X, int32 Y) { return D.Info(X)->Box.ComputeSquaredDistanceToPoint(C) < D.Info(Y)->Box.ComputeSquaredDistanceToPoint(C); });
			int32 N = 0;
			for (int32 B : Near)
			{
				const FNYCBuildingInfo* I = D.Info(B);
				if (!I || I->Height > 17000.f || N >= 5) continue;
				const int32 Mode = N % 3 == 1 ? 2 : N % 3 == 2 ? 3 : 1;
				const FVector Lean = (C - FVector(I->Rect.GetCenter().X, I->Rect.GetCenter().Y, 0)).GetSafeNormal2D();
				const int32 Floor = Mode == 3 ? FMath::Max(2, FMath::FloorToInt32(I->Height / FMath::Max(I->FloorH, 300.f) * 0.45f)) : 1;
				D.After(2.2f + N * 1.5f, [Dp, B, Mode, Lean, Floor]() { Dp->CollapseBuilding(B, Floor, Mode, Lean, 0.4f); });
				++N;
			}
		}));

	Out.Add(Tool(TEXT("eruption"), TEXT("Eruption in Bryant Park"), 5, TEXT("Natural disaster"), ENYCTarget::District, 9.0f, 170.0f, 90.0f,
		TEXT("A vent breaks open, hurling glowing bombs across the blocks under a black ash column."), TEXT("A spatter cone with glowing throat, a towering driven ash plume, lava-rock bombs on ballistic arcs each exploding on impact and starting fires, lava light flickering."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			D.FX()->Sound(TEXT("eruption"), C, 1.6f, 1.f);
			D.Shake(C, 30.f, 11.f);
			D.MakeCrater(C, 900.f, 260.f);
			D.SpawnLumps(C + FVector(0, 0, 60), FVector(0, 0, 1), 60, 90.f, TEXT("soil"), 1900.f, 0.55f);
			Prop(D, TEXT("tl_vent"), C - FVector(0, 0, 30), FQuat::Identity, 4.2f);
			D.FX()->Glow(C + FVector(0, 0, 750), FLinearColor(1.f, 0.32f, 0.04f), 3.0e6f * D.FX()->GlowScale(), 7000.f, 13.f, 0.5f);
			Repeat(D, 30, 0.4f, 0.4f, [Dp, C](int32 i)
			{
				FNYCPuff Q;
				Q.Pos = C + FVector(Dp->Random().FRandRange(-130.f, 130.f), Dp->Random().FRandRange(-130.f, 130.f), 620);
				Q.Vel = FVector(Dp->Random().FRandRange(-260.f, 260.f), Dp->Random().FRandRange(-260.f, 260.f), Dp->Random().FRandRange(2200.f, 3600.f));
				Q.Drag = 0.42f;
				Q.Rise = Dp->Wind() * 1.4f;
				Q.R0 = 240.f;
				Q.R1 = 1500.f;
				Q.Life = 13.f;
				Q.Density = 1.15f;
				Q.Kind = ENYCVol::Smoke;
				Q.Albedo = FLinearColor(0.06f, 0.052f, 0.048f);
				Q.NoiseM = 5.5f;
				Dp->FX()->AddPuff(Q);
				Dp->FX()->Fire(C + FVector(0, 0, 640), 230.f, 0.7f);
				Dp->FX()->Sparks(C + FVector(0, 0, 640), FVector(0, 0, 3200), 150, FLinearColor(1.f, 0.4f, 0.05f), 24.f);
				if (i % 2 == 0)
				{
					FFlight F;
					F.Mesh = TEXT("tl_meteor");
					F.From = C + FVector(0, 0, 650);
					const double Ang = Dp->Random().FRandRange(0.f, 6.283f), Rad = Dp->Random().FRandRange(900.f, 4800.f);
					F.Velocity = Lob(F.From, C + FVector(FMath::Cos(Ang) * Rad, FMath::Sin(Ang) * Rad, 0), Dp->Random().FRandRange(2.4f, 3.6f));
					F.Scale = Dp->Random().FRandRange(0.9f, 2.2f);
					F.Spin = 300.f;
					F.bAlign = false;
					F.ArmDelay = 0.35f;
					F.MaxTime = 6.f;
					F.Trail = SmokeTrail(*Dp, 45.f, 2.0f, FLinearColor(0.09f, 0.08f, 0.075f), 0.09f, 1.f);
					F.Hit = [Dp, i](const FVector& P, const FVector& N, int32, const FVector&)
					{
						FBlast B;
						B.Radius = 250.f;
						B.Glass = 900.f;
						B.Speed = 1100.f;
						B.Fireball = 150.f;
						B.Burn = 0.8f;
						B.Crater = P.Z < 200.f ? 150.f : 0.f;
						B.Flash = i % 6 == 0 ? 0.8f : 0.f;
						B.MaxElements = 14;
						B.Sound = TEXT("blast_small");
						B.Pitch = 0.75f;
						Blast(*Dp, P + N * 20.0, B);
						Dp->FX()->Fire(P + N * 20.0, 100.f, 10.f);
					};
					Fly(*Dp, F);
				}
			});
		}));
}
