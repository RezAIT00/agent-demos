// Tier 8: the end of the neighbourhood and then some.  Big blasts are built from travelling fronts: damage,
// dust and light arrive at each distance when the wave does.
#include "NYCToolKit.h"

using namespace NYCT;

namespace
{
	/** A long burning trail through the sky: glowing head, thick smoke behind. */
	TFunction<void(const FVector&, const FVector&, float)> SkyTrail(ANYCDestruction& D, float Radius, float Life, float Spacing, float Glow, const FLinearColor& Smoke)
	{
		ANYCDestruction* Dp = &D;
		TSharedRef<float> Next = MakeShared<float>(0.f);
		TSharedRef<FVector> Last = MakeShared<FVector>(FVector::ZeroVector);
		return [Dp, Radius, Life, Spacing, Glow, Smoke, Next, Last](const FVector& P, const FVector& V, float Age)
		{
			if (Age < *Next) return;
			*Next = Age + Spacing;
			const FVector Back = -V.GetSafeNormal();
			// fill the gap since the last puff so a fast body leaves an unbroken tail
			const FVector From = Last->IsZero() ? P : *Last;
			*Last = P;
			const int32 N = FMath::Clamp(FMath::CeilToInt32(FVector::Dist(From, P) / (Radius * 1.1f)), 1, 5);
			for (int32 i = 0; i < N; ++i)
			{
				const FVector At = FMath::Lerp(From, P, (i + 1.0) / N) + Back * Radius;
				FNYCPuff Q;
				Q.Pos = At + Dp->Random().VRand() * Radius * 0.3f;
				Q.Vel = Back * Radius * 0.6f;
				Q.Drag = 1.2f;
				Q.Rise = Dp->Wind() * 0.7f;
				Q.R0 = Radius * 0.75f;
				Q.R1 = Radius * 2.4f;
				Q.Life = Life * Dp->Random().FRandRange(0.8f, 1.2f);
				Q.FadeIn = 0.04f;
				Q.Density = 0.7f;
				Q.Kind = ENYCVol::Smoke;
				Q.Albedo = Smoke;
				Q.NoiseM = Radius / 210.f + 0.5f;
				Dp->FX()->AddPuff(Q);
			}
			FNYCPuff G;
			G.Pos = P + Back * Radius * 0.8f;
			G.Vel = V * 0.35f;
			G.Drag = 2.5f;
			G.R0 = Radius;
			G.R1 = Radius * 1.8f;
			G.Life = 0.4f;
			G.FadeIn = 0.03f;
			G.Density = 0.8f;
			G.Kind = ENYCVol::Fireball;
			G.Albedo = FLinearColor(0.05f, 0.03f, 0.02f);
			G.Glow = Glow * Dp->FX()->GlowScale();
			G.NoiseM = Radius / 260.f + 0.4f;
			Dp->FX()->AddPuff(G);
			Dp->FX()->Sparks(P + Back * Radius, Back * 1500.0, 40, FLinearColor(1.f, 0.55f, 0.15f), 30.f);
		};
	}

	/** Burning rocks thrown out of an impact, each starting a fire where it comes down. */
	void Ejecta(ANYCDestruction& D, const FVector& At, int32 Count, float MinRange, float MaxRange, float Scale, float Spread)
	{
		ANYCDestruction* Dp = &D;
		for (int32 i = 0; i < Count; ++i)
		{
			D.After(D.Random().FRandRange(0.05f, Spread), [Dp, At, MinRange, MaxRange, Scale, i]()
			{
				FFlight F;
				F.Mesh = TEXT("tl_meteor");
				F.From = At + FVector(0, 0, 500);
				const double Ang = Dp->Random().FRandRange(0.f, 6.283f), Range = Dp->Random().FRandRange(MinRange, MaxRange);
				const float Time = Dp->Random().FRandRange(2.2f, 4.6f);
				F.Velocity = Lob(F.From, At + FVector(FMath::Cos(Ang) * Range, FMath::Sin(Ang) * Range, 0), Time);
				F.Scale = Scale * Dp->Random().FRandRange(0.55f, 1.5f);
				F.Spin = 250.f;
				F.bAlign = false;
				F.ArmDelay = 0.4f;
				F.MaxTime = 8.f;
				F.Trail = SmokeTrail(*Dp, 60.f * Scale, 2.2f, FLinearColor(0.1f, 0.085f, 0.075f), 0.1f, i % 2 ? 0.9f : 0.f);
				F.Hit = [Dp, i, Scale](const FVector& P, const FVector& N, int32, const FVector&)
				{
					FBlast B;
					B.Radius = 190.f * Scale;
					B.Glass = 700.f * Scale;
					B.Speed = 1100.f;
					B.Fireball = i % 3 == 0 ? 140.f * Scale : 0.f;
					B.Burn = 0.7f;
					B.Dust = 0.7f;
					B.Flash = 0.f;
					B.MaxElements = 12;
					B.ShakeAmount = 4.f;
					B.Sound = TEXT("blast_small");
					B.Pitch = 0.7f;
					B.Volume = 0.7f;
					Blast(*Dp, P + N * 20.0, B);
					if (i % 2 == 0) Dp->FX()->Fire(P + N * 25.0, 90.f * Scale, 12.f);
				};
				Fly(*Dp, F);
			});
		}
	}

	/** The wall of dust that runs out ahead of the damage. */
	void DustFront(ANYCDestruction& D, const FVector& C, float FromRadius, float ToRadius, float Speed, float Size, const FString& Wall)
	{
		ANYCDestruction* Dp = &D;
		const int32 Rings = 7;
		for (int32 r = 0; r < Rings; ++r)
		{
			const float R = FMath::Lerp(FromRadius, ToRadius, (r + 1.f) / Rings);
			D.After((R - FromRadius) / Speed, [Dp, C, R, r, Size, Speed, Wall]()
			{
				const int32 N = 12 + r;
				for (int32 i = 0; i < N; ++i)
				{
					const float Ang = i * UE_TWO_PI / N + r * 0.37f;
					const FVector Out(FMath::Cos(Ang), FMath::Sin(Ang), 0);
					FNYCPuff Q;
					Q.Pos = C + Out * R + FVector(0, 0, Size * 0.45f);
					Q.Vel = Out * Speed * 0.22f + FVector(0, 0, Size * 0.1f);
					Q.Drag = 0.55f;
					Q.Rise = FVector(0, 0, 40) + Dp->Wind() * 0.5f;
					Q.R0 = Size * 0.45f;
					Q.R1 = Size * Dp->Random().FRandRange(1.1f, 1.7f);
					Q.Squash = 0.6f;
					Q.Life = Dp->Random().FRandRange(7.f, 12.f);
					Q.FadeIn = 0.1f;
					Q.GrowTau = 0.12f;
					Q.Density = 0.75f - r * 0.05f;
					Q.Kind = ENYCVol::Dust;
					Q.Albedo = ANYCDestructionFX::DustColour(Wall) * Dp->Random().FRandRange(0.85f, 1.1f);
					Q.NoiseM = Size / 320.f + 1.f;
					Q.bGroundHug = true;
					Dp->FX()->AddPuff(Q);
				}
			});
		}
	}

	struct FImpact
	{
		float Fireball = 1400.f;
		float Radius = 1500.f;          // structure destroyed outright
		float Crater = 1500.f;
		float WaveTo = 9000.f;
		float WaveSpeed = 6500.f;
		float WaveStrength = 0.75f;
		float Mushroom = 0.f;
		float MushroomTime = 25.f;
		int32 Bombs = 12;
		float BombRange = 6000.f;
		const TCHAR* Sound = TEXT("meteor_impact");
	};

	void Impact(ANYCDestruction& D, const FVector& C, const FImpact& I)
	{
		ANYCDestruction* Dp = &D;
		D.FX()->Flash(C + FVector(0, 0, I.Fireball * 0.8f + 300.f), FLinearColor(1.f, 0.72f, 0.42f), 40.f * I.Radius * I.Radius * D.FX()->GlowScale(), I.Radius * 14.f, 1.1f, 0.15f);
		if (I.Mushroom <= 0.f) D.FX()->Fireball(C + FVector(0, 0, I.Fireball * 0.65f), I.Fireball, 1.6f + I.Fireball / 2600.f, 0.f);
		D.MakeCrater(C, I.Crater, I.Crater * 0.38f);
		FNYCDamage H;
		H.Center = C + FVector(0, 0, I.Radius * 0.18f);
		H.Radius = I.Radius;
		H.GlassRadius = I.Radius * 4.f;
		H.Speed = 3200.f;
		H.UpKick = 1500.f;
		H.Fire = 0.55f;
		H.PropRadius = I.Radius * 1.7f;
		H.MaxElements = 900;
		D.ApplyDamage(H);
		const float Rock = FMath::Clamp(I.Radius / 22.f, 60.f, 190.f);
		D.SpawnLumps(C + FVector(0, 0, 150), FVector(0, 0, 1), 70, Rock, TEXT("concrete"), 3200.f, 1.0f);
		D.SpawnLumps(C + FVector(0, 0, 150), FVector(0, 0, 1), 45, Rock * 0.8f, TEXT("soil"), 3600.f, 0.8f);
		D.SpawnLumps(C + FVector(0, 0, 150), FVector(0, 0, 1), 30, Rock * 0.6f, TEXT("granite_black"), 4200.f, 0.7f);
		D.FX()->GroundRing(C, I.WaveTo * 1.05f, I.WaveSpeed, 1.f, TEXT("concrete"));
		D.FX()->ShockDome(C, I.WaveTo * 0.9f, I.WaveSpeed * 1.15f, 0.75f);
		D.Shockwave(C, I.Radius, I.WaveTo, I.WaveSpeed, I.WaveStrength, true);
		if (I.Mushroom > 0.f)
		{
			D.FX()->StreetSurge(C, I.Radius * 1.05f, I.WaveTo * 0.9f, I.WaveSpeed * 0.55f, I.Radius * 0.55f, TEXT("concrete"));
			D.FX()->MushroomCloud(C, I.Mushroom, I.MushroomTime);
			D.FX()->CondensationRing(C + FVector(0, 0, I.Radius * 0.7f), I.WaveTo * 0.62f, 2.6f, 0.2f);
			D.FX()->BlastScorch(C, I.WaveTo * 0.45f, I.WaveSpeed);
		}
		else
		{
			DustFront(D, C, I.Radius, I.WaveTo, I.WaveSpeed * 0.62f, FMath::Clamp(I.Radius * 0.5f, 500.f, 2600.f), TEXT("concrete"));
			D.FX()->SmokeColumn(C + FVector(0, 0, I.Crater * 0.2f), I.Crater * 0.5f, 24.f, 0.75f);
		}
		Ejecta(D, C, I.Bombs, I.Radius * 1.2f, I.BombRange, FMath::Clamp(I.Radius / 1300.f, 0.9f, 2.6f), 0.8f);
		for (int32 i = 0; i < 14; ++i)
		{
			const FVector F = C + FVector(FMath::Cos(i * 2.4f), FMath::Sin(i * 2.4f), 0) * (I.Radius * (0.35f + i * 0.1f)) + FVector(0, 0, 40);
			D.After(0.5f + i * 0.12f, [Dp, F, I]() { Dp->FX()->Fire(F, FMath::Clamp(I.Radius * 0.12f, 120.f, 500.f), 22.f); });
		}
		D.FX()->Sound(I.Sound, C, 2.f, 1.f);
		D.Shake(C, FMath::Clamp(I.Radius / 22.f, 35.f, 160.f), 3.5f);
		// the aftershock of falling material
		D.After(1.8f, [Dp, C, I]() { Dp->KickDebris(C, I.Radius * 2.2f, 350.f, 200.f, true); Dp->Shake(C, 20.f, 2.f); Dp->FX()->Sound(TEXT("rumble_long"), C, 1.6f, 0.8f); });
	}

	void Warhead(ANYCDestruction& D, const FVector& Target, double BurstHeight, float Scale, float Time, TFunction<void(const FVector&)> Burst)
	{
		FFlight F;
		F.Mesh = TEXT("tl_navalshell");
		const FVector End = Target + FVector(0, 0, BurstHeight);
		F.From = End + FVector(-5200, -3400, 36000);
		F.Velocity = (End - F.From) / Time;
		F.Gravity = 0.f;
		F.Scale = Scale;
		F.MaxTime = Time;
		F.ArmDelay = Time + 1.f;
		F.Trail = SmokeTrail(D, 70.f, 3.5f, FLinearColor(0.55f, 0.55f, 0.57f), 0.05f);
		F.Hit = [Burst, End](const FVector&, const FVector&, int32, const FVector&) { Burst(End); };
		D.FX()->Sound(TEXT("whistle_down"), Target + FVector(0, 0, 4000), 1.5f, 0.7f);
		Fly(D, F);
	}

	/** Fires take hold on whatever faced the light. */
	void ThermalFires(ANYCDestruction& D, const FVector& Source, float Range, int32 Count)
	{
		for (int32 i = 0, Made = 0; i < Count * 5 && Made < Count; ++i)
		{
			const double Ang = D.Random().FRandRange(0.f, 6.283f), Rad = Range * FMath::Sqrt(D.Random().FRandRange(0.03f, 1.f));
			const FVector Aim = FVector(Source.X + FMath::Cos(Ang) * Rad, Source.Y + FMath::Sin(Ang) * Rad, D.Random().FRandRange(100.f, 1800.f));
			FVector Point, Normal;
			int32 B = INDEX_NONE;
			if (D.Trace(Source, (Aim - Source).GetSafeNormal(), Range * 1.6f, Point, Normal, &B) < 0.f) continue;
			ANYCDestruction* Dp = &D;
			const FVector At = Point + Normal * 50.0;
			const float Size = D.Random().FRandRange(110.f, 330.f);
			D.After(0.35f + (float)Rad / Range * 2.2f, [Dp, At, Size]() { Dp->FX()->Fire(At, Size, 30.f); if (Size > 220.f) Dp->FX()->SmokeColumn(At, Size * 0.8f, 28.f); });
			++Made;
		}
	}
}

void NYCArsenal::RegisterCataclysm(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("kinetic_rod"), TEXT("Orbital kinetic rod"), 8, TEXT("World ending"), ENYCTarget::District, 5.0f, 240.f, 120.f,
		TEXT("A tungsten pole dropped from orbit arrives faster than its own sound: a deep crater, a ring of flattened blocks and a towering plume of earth, with no fire at all."), TEXT("A hypersonic rod mesh with a white plasma streak; on impact a deep crater, a great fan of thrown paving and soil, a fast shock ring with distance-timed damage and a vertical dust column."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			FFlight F;
			F.Mesh = TEXT("tl_rod");
			F.From = C + FVector(-14000, -9000, 62000);
			F.Velocity = (C - F.From) / 1.35f;
			F.Gravity = 0.f;
			F.Scale = 4.5f;
			F.MaxTime = 3.f;
			F.ArmDelay = 0.2f;
			F.Trail = SkyTrail(D, 150.f, 2.6f, 0.05f, 140000.f, FLinearColor(0.62f, 0.6f, 0.58f));
			D.FX()->Sound(TEXT("rod_incoming"), C + FVector(0, 0, 3000), 1.6f, 1.f);
			F.Hit = [Dp, C](const FVector& P, const FVector&, int32, const FVector&)
			{
				const FVector At = Ground(P);
				Dp->FX()->Flash(At + FVector(0, 0, 900), FLinearColor(1.f, 0.88f, 0.7f), 4.0e7f * Dp->FX()->GlowScale(), 22000.f, 0.7f, 0.1f);
				Dp->MakeCrater(At, 1750.f, 850.f);
				FNYCDamage H;
				H.Center = At + FVector(0, 0, 150);
				H.Radius = 1550.f;
				H.GlassRadius = 6500.f;
				H.Speed = 3600.f;
				H.UpKick = 2100.f;
				H.PropRadius = 2700.f;
				H.MaxElements = 900;
				Dp->ApplyDamage(H);
				Dp->SpawnLumps(At + FVector(0, 0, 150), FVector(0, 0, 1), 90, 120.f, TEXT("concrete"), 4600.f, 0.75f);
				Dp->SpawnLumps(At + FVector(0, 0, 150), FVector(0, 0, 1), 70, 90.f, TEXT("soil"), 5200.f, 0.5f);
				Dp->SpawnLumps(At + FVector(0, 0, 150), FVector(0.4, 0.3, 1), 30, 150.f, TEXT("granite_black"), 3600.f, 0.9f);
				for (int32 i = 0; i < 16; ++i)
				{
					FNYCPuff Q;
					Q.Pos = At + FVector(Dp->Random().FRandRange(-500.f, 500.f), Dp->Random().FRandRange(-500.f, 500.f), 200);
					Q.Vel = FVector(Dp->Random().FRandRange(-700.f, 700.f), Dp->Random().FRandRange(-700.f, 700.f), 1500.f + i * 520.f);
					Q.Drag = 0.85f;
					Q.Rise = Dp->Wind();
					Q.R0 = 320.f;
					Q.R1 = 900.f + i * 75.f;
					Q.Life = 11.f + i * 0.4f;
					Q.Density = 0.9f;
					Q.Kind = ENYCVol::Dust;
					Q.Albedo = FLinearColor(0.23f, 0.18f, 0.13f) * (0.85f + i * 0.02f);
					Q.NoiseM = 5.f;
					Dp->FX()->AddPuff(Q);
				}
				Dp->FX()->GroundRing(At, 11000.f, 8500.f, 1.f, TEXT("concrete"));
				Dp->FX()->ShockDome(At, 9000.f, 9500.f, 0.8f);
				Dp->Shockwave(At, 1550.f, 10500.f, 8500.f, 0.8f, true);
				DustFront(*Dp, At, 1600.f, 10000.f, 5000.f, 900.f, TEXT("concrete"));
				Dp->FX()->Sound(TEXT("kinetic_impact"), At, 2.f, 1.f);
				Dp->Shake(At, 90.f, 2.8f);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("meteor_small"), TEXT("Meteor"), 8, TEXT("World ending"), ENYCTarget::District, 7.0f, 230.f, 120.f,
		TEXT("A six metre stone arrives on a pillar of fire and takes out the middle of a block."), TEXT("A cracked glowing rock with a burning smoke tail; impact fireball, crater, heaved ground, a travelling shock ring and burning ejecta that land and start fires."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			FFlight F;
			F.Mesh = TEXT("tl_meteor");
			F.From = C + FVector(13000, 9000, 26000);
			F.Velocity = (C - F.From) / 3.0f;
			F.Gravity = 0.f;
			F.Scale = 6.f;
			F.Spin = 160.f;
			F.bAlign = false;
			F.MaxTime = 5.f;
			F.ArmDelay = 0.3f;
			F.Trail = SkyTrail(D, 320.f, 3.4f, 0.07f, 55000.f, FLinearColor(0.16f, 0.13f, 0.11f));
			D.FX()->Sound(TEXT("meteor_incoming"), C + FVector(0, 0, 3000), 1.5f, 1.1f);
			F.Hit = [Dp](const FVector& P, const FVector&, int32, const FVector&)
			{
				FImpact I;
				Impact(*Dp, Ground(P), I);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("meteor_large"), TEXT("Great meteor"), 8, TEXT("World ending"), ENYCTarget::District, 10.5f, 520.f, 210.f,
		TEXT("A rock the size of a brownstone row strikes: several blocks vanish and a brown mushroom of earth climbs over Midtown."), TEXT("A twenty four metre body with a vast tail; a fireball that turns itself into a rising mushroom (stem, turning cap, self-shadow), a condensation ring, a radial scorch, a hundred-metre-wide crater, a visible pressure dome and a shock front that lays buildings over away from the strike, dust pouring down the real avenues and cross streets, and a rain of burning rock."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			FFlight F;
			F.Mesh = TEXT("tl_meteor");
			F.From = C + FVector(30000, 21000, 62000);
			F.Velocity = (C - F.From) / 4.2f;
			F.Gravity = 0.f;
			F.Scale = 24.f;
			F.Spin = 80.f;
			F.bAlign = false;
			F.MaxTime = 7.f;
			F.ArmDelay = 0.4f;
			F.Trail = SkyTrail(D, 1100.f, 5.5f, 0.08f, 50000.f, FLinearColor(0.15f, 0.12f, 0.1f));
			D.FX()->Sound(TEXT("meteor_incoming"), C + FVector(0, 0, 5000), 1.9f, 0.8f);
			F.Hit = [Dp](const FVector& P, const FVector&, int32, const FVector&)
			{
				FImpact I;
				I.Fireball = 4300.f;
				I.Radius = 3400.f;
				I.Crater = 4200.f;
				I.WaveTo = 27000.f;
				I.WaveSpeed = 9000.f;
				I.WaveStrength = 1.0f;
				I.Mushroom = 11000.f;
				I.Bombs = 34;
				I.BombRange = 17000.f;
				I.Sound = TEXT("meteor_huge");
				Impact(*Dp, Ground(P), I);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("tactical_nuke"), TEXT("Tactical nuclear warhead"), 8, TEXT("World ending"), ENYCTarget::District, 12.0f, 820.f, 250.f,
		TEXT("A single white swell of light, a rising fireball, then the blast front rolls out flattening the blocks one ring after another under a mushroom cloud."), TEXT("Airburst: one rationed, swelling flash; a white-hot ray-marched ball that rolls itself into a mushroom cloud (stem, turning vortex cap, base surge, self-shadow); a condensation ring and pressure dome racing outward; a radial scorch; distance-timed destruction that lays blocks over away from ground zero; dust surging along the real streets; thermal fires and the delayed roar."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			Warhead(D, C, 11000.0, 3.2f, 2.6f, [Dp, C](const FVector& B)
			{
				Dp->FX()->Flash(B, FLinearColor(1.f, 0.94f, 0.84f), 4.2e8f * Dp->FX()->GlowScale(), 110000.f, 1.7f, 0.f);
				Dp->FX()->MushroomCloud(C, 21000.f, 45.f, 8500.f);
				Dp->FX()->Sparks(B, FVector(0, 0, 9000.f), 420, FLinearColor(1.f, 0.62f, 0.25f), 150.f);
				Dp->FX()->Sound(TEXT("nuke"), B, 2.f, 1.f);
				ThermalFires(*Dp, B, 26000.f, 40);
				Dp->After(0.55f, [Dp, C, B]()
				{
					Dp->FX()->CondensationRing(C + FVector(0, 0, 9000.f), 30000.f, 3.0f, 0.35f);
					Dp->FX()->BlastScorch(C, 17000.f, 11500.f);
					Dp->MakeCrater(C, 3200.f, 700.f);
					FNYCDamage H;
					H.Center = C + FVector(0, 0, 900);
					H.Radius = 3600.f;
					H.GlassRadius = 20000.f;
					H.Speed = 3800.f;
					H.UpKick = 600.f;
					H.Fire = 0.5f;
					H.MaxElements = 900;
					H.PropRadius = 6000.f;
					Dp->ApplyDamage(H);
					Dp->Shockwave(C, 3400.f, 43000.f, 11500.f, 1.05f, true);
					Dp->FX()->ShockDome(C, 36000.f, 12500.f, 0.9f);
					Dp->FX()->GroundRing(C, 42000.f, 11500.f, 1.f, TEXT("concrete"));
					Dp->FX()->StreetSurge(C, 2500.f, 34000.f, 7600.f, 2300.f, TEXT("concrete"));
					Dp->Shake(C, 150.f, 5.f);
				});
				Dp->After(1.5f, [Dp, C]() { Dp->ShatterGlass(C + FVector(0, 0, 3000), 56000.f, 2200.f, 4000); Dp->FX()->Sound(TEXT("nuke_rumble"), C, 2.f, 1.f); });
				Dp->After(3.2f, [Dp, C]() { Dp->KickDebris(C, 14000.f, 900.f, 250.f, true); Dp->Shake(C, 60.f, 4.f); });
			});
		}));

	Out.Add(Tool(TEXT("strategic_nuke"), TEXT("Strategic nuclear warhead"), 8, TEXT("World ending"), ENYCTarget::District, 14.0f, 2300.f, 720.f,
		TEXT("A burst high over Midtown: the cloud top climbs past every tower and the front runs to the rivers, leaving a flattened, burning bowl."), TEXT("The same design at several times the scale: a far larger fireball-to-mushroom, condensation ring and scorch; far-district towers are laid over by the front as well as the detailed buildings; street surges, a wide fire field and a longer rumble."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			Warhead(D, C, 42000.0, 4.2f, 3.0f, [Dp, C](const FVector& B)
			{
				Dp->FX()->Flash(B, FLinearColor(1.f, 0.95f, 0.88f), 3.2e9f * Dp->FX()->GlowScale(), 380000.f, 2.2f, 0.f);
				Dp->FX()->MushroomCloud(C, 52000.f, 60.f, 26000.f);
				Dp->FX()->Sparks(B, FVector(0, 0, 20000.f), 520, FLinearColor(1.f, 0.62f, 0.25f), 150.f);
				Dp->FX()->Sound(TEXT("nuke_big"), B, 2.f, 1.f);
				ThermalFires(*Dp, B, 70000.f, 64);
				Dp->After(0.8f, [Dp, C, B]()
				{
					Dp->FX()->CondensationRing(C + FVector(0, 0, 22000.f), 80000.f, 3.6f, 0.45f);
					Dp->FX()->BlastScorch(C, 42000.f, 23000.f);
					Dp->MakeCrater(C, 6000.f, 900.f);
					FNYCDamage H;
					H.Center = C + FVector(0, 0, 1500);
					H.Radius = 8000.f;
					H.GlassRadius = 50000.f;
					H.Speed = 4800.f;
					H.UpKick = 500.f;
					H.Fire = 0.6f;
					H.MaxElements = 900;
					H.PropRadius = 14000.f;
					Dp->ApplyDamage(H);
					Dp->Shockwave(C, 7000.f, 120000.f, 25000.f, 1.4f, true);
					Dp->FX()->ShockDome(C, 85000.f, 23000.f, 1.f);
					Dp->FX()->GroundRing(C, 90000.f, 21000.f, 1.f, TEXT("concrete"));
					Dp->FX()->StreetSurge(C, 6000.f, 80000.f, 15000.f, 5200.f, TEXT("concrete"));
					Dp->Shake(C, 220.f, 7.f);
				});
				Dp->After(1.8f, [Dp, C]() { Dp->ShatterGlass(C + FVector(0, 0, 5000), 90000.f, 2600.f, 5000); Dp->FX()->Sound(TEXT("nuke_rumble"), C, 2.f, 0.75f); });
				Dp->After(4.0f, [Dp, C]() { Dp->KickDebris(C, 30000.f, 1200.f, 250.f, true); Dp->Shake(C, 80.f, 5.f); });
			});
		}));

	Out.Add(Tool(TEXT("planet_cracker"), TEXT("World cracker"), 8, TEXT("World ending"), ENYCTarget::District, 13.0f, 760.f, 300.f,
		TEXT("A mothership blots out the sky and drills into the island; the ground splits into glowing fissures that race outward, erupting and bringing towers down along their length."), TEXT("A 250 m craft with a drilling beam; seven fissure lines grow as chains of deep craters with lava light, spatter eruptions and thrown rock; buildings along each crack collapse in turn; a final heave with a mushroom cloud, condensation ring, street surges, scorch and shock."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			const FLinearColor Magma(1.f, 0.3f, 0.03f), Drill(0.35f, 1.f, 0.55f);
			TSharedRef<int32> Beam = MakeShared<int32>(INDEX_NONE), Core = MakeShared<int32>(INDEX_NONE), Count = MakeShared<int32>(0);
			D.FX()->Sound(TEXT("mothership"), C + FVector(0, 0, 6000), 2.f, 1.f);
			Saucer(D, C + FVector(0, 0, 27000), 8.5f, 3.2f, 9.6f, [Dp, C, Drill, Beam, Core, Count](const FVector& P, float S, float)
			{
				const FVector Belly = P - FVector(0, 0, 2700);
				if (*Beam == INDEX_NONE)
				{
					*Beam = Dp->FX()->Beam(Belly, C, 60.f, Drill, 14000.f, 8.6f);
					*Core = Dp->FX()->Beam(Belly, C, 25.f, FLinearColor(0.85f, 1.f, 0.9f), 52000.f, 8.6f);
					Dp->FX()->Sound(TEXT("ion_fire"), C, 2.f, 0.6f);
					Dp->FX()->Glow(C + FVector(0, 0, 1500), Drill, 4.0e6f * Dp->FX()->GlowScale(), 22000.f, 8.4f, 0.3f);
				}
				const float Open = FMath::Min(S / 1.2f, 1.f) * FMath::Clamp((8.6f - S), 0.f, 1.f);
				SetBeam(*Dp, *Beam, Belly, C, FMath::Max(5.f, 1250.f * Open * (1.f + 0.05f * FMath::Sin(S * 40.f))));
				SetBeam(*Dp, *Core, Belly, C, FMath::Max(3.f, 400.f * Open));
				const int32 K = ++*Count;
				if (K % 8 == 0 && S < 8.4f)
				{
					Dp->FX()->Sparks(C + FVector(0, 0, 100), FVector(0, 0, 4200), 200, FLinearColor(1.f, 0.5f, 0.1f), 55.f);
					Dp->DissolveElements(C + FVector(0, 0, FMath::Max(300.0, 4200.0 - S * 560.0)), 1300.f, 110, FLinearColor(0.5f, 1.f, 0.6f), K % 32 == 0);
				}
				Dp->Shake(C, 18.f + S * 4.f, 0.2f);
			}, nullptr);
			D.After(4.1f, [Dp, C, Magma]()
			{
				Dp->MakeCrater(C, 2600.f, 1500.f);
				FNYCDamage H;
				H.Center = C + FVector(0, 0, 150);
				H.Radius = 2100.f;
				H.GlassRadius = 9000.f;
				H.Speed = 2800.f;
				H.UpKick = 1600.f;
				H.Fire = 0.6f;
				H.MaxElements = 700;
				Dp->ApplyDamage(H);
			});
			// fissures racing outward
			TSharedRef<TSet<int32>> Fallen = MakeShared<TSet<int32>>();
			const int32 Rays = 7;
			for (int32 r = 0; r < Rays; ++r)
			{
				const float Base = r * UE_TWO_PI / Rays + D.Random().FRandRange(-0.25f, 0.25f);
				FVector At = C + FVector(FMath::Cos(Base), FMath::Sin(Base), 0) * 2000.0;
				for (int32 s = 0; s < 13; ++s)
				{
					const float Wander = Base + D.Random().FRandRange(-0.55f, 0.55f);
					At += FVector(FMath::Cos(Wander), FMath::Sin(Wander), 0) * (620.0 + s * 40.0);
					const FVector P = At;
					D.After(4.8f + s * 0.42f + r * 0.05f, [Dp, P, Magma, Fallen, C, r, s]()
					{
						const float Size = FMath::Max(240.f, 700.f - s * 34.f);
						Dp->MakeCrater(P, Size, Size * 0.85f);
						Dp->SpawnLumps(P + FVector(0, 0, 60), FVector(0, 0, 1), 7, 130.f, s % 2 ? TEXT("concrete") : TEXT("soil"), 1800.f, 0.65f);
						Dp->FX()->DustBurst(P + FVector(0, 0, 200), Size * 0.8f, 0.8f, TEXT("soil"));
						if ((r + s) % 3 == 0)
						{
							Dp->FX()->Glow(P + FVector(0, 0, 160), Magma, 130000.f * Dp->FX()->GlowScale(), Size * 5.f, 12.f, 0.4f);
							Dp->FX()->Fire(P + FVector(0, 0, 30), Size * 0.4f, 14.f);
							Dp->FX()->Sparks(P, FVector(0, 0, 2600), 130, Magma, 30.f);
						}
						if (s % 4 == 1) Dp->FX()->SmokeColumn(P, Size * 0.75f, 18.f, 0.9f);
						FNYCDamage H;
						H.Center = P;
						H.Radius = 0.f;
						H.GlassRadius = Size * 3.f;
						H.PropRadius = Size * 1.5f;
						H.Speed = 800.f;
						H.UpKick = 800.f;
						Dp->ApplyDamage(H);
						Dp->FX()->Sound(TEXT("crunch"), P, 1.4f, 0.5f);
						TArray<int32> Near;
						Dp->BuildingsNear(P + FVector(0, 0, 400), Size + 900.f, Near);
						int32 N = 0;
						for (int32 B : Near)
						{
							if (Fallen->Contains(B) || Fallen->Num() >= 18 || N >= 1) continue;
							const FNYCBuildingInfo* I = Dp->Info(B);
							if (!I || I->Height > 22000.f) continue;
							Fallen->Add(B);
							++N;
							const FVector Toward = (P - FVector(I->Rect.GetCenter().X, I->Rect.GetCenter().Y, 0)).GetSafeNormal2D();
							const int32 Mode = (r + s) % 3 == 0 ? 2 : 1;
							if (Fallen->Num() <= 7) Dp->CollapseBuilding(B, 1, Mode, Toward, 0.25f);
							else Dp->FellBuilding(B, -Toward, 0.25f, 0.85f);
						}
					});
				}
			}
			D.After(5.2f, [Dp, C]() { Ejecta(*Dp, C, 44, 3000.f, 22000.f, 2.2f, 5.5f); });
			D.After(10.6f, [Dp, C]()
			{
				Dp->FX()->MushroomCloud(C, 17000.f, 30.f);
				Dp->FX()->CondensationRing(C + FVector(0, 0, 6000.f), 24000.f, 2.8f, 0.2f);
				Dp->FX()->StreetSurge(C, 2800.f, 28000.f, 6500.f, 2000.f, TEXT("soil"));
				Dp->FX()->BlastScorch(C, 13000.f, 9000.f);
				Dp->Shockwave(C, 3000.f, 30000.f, 9000.f, 0.9f);
				Dp->FX()->ShockDome(C, 26000.f, 10000.f, 0.8f);
				Dp->FX()->GroundRing(C, 30000.f, 9000.f, 1.f, TEXT("concrete"));
				Dp->KickDebris(C, 9000.f, 1200.f, 900.f, true);
				Dp->FX()->Sound(TEXT("meteor_huge"), C, 2.f, 0.75f);
				Dp->Shake(C, 130.f, 4.f);
			});
		}));

	Out.Add(Tool(TEXT("asteroid"), TEXT("Asteroid"), 8, TEXT("World ending"), ENYCTarget::District, 15.5f, 3000.f, 950.f,
		TEXT("A rock a hundred and fifty metres across crosses the whole sky, strikes Midtown and erases it: the shock runs to the horizon and a cloud rises into the stratosphere."), TEXT("The largest event: an enormous burning body visible for seconds; at impact a single swelling flash, a giant fireball that rises into a mushroom with a turning cap, a condensation ring and a pressure dome sweeping the horizon, a radial scorch, every building and far-district tower laid over away from the strike, dust surging down the streets, burning ejecta and a darkened sky."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector C = Ground(A.Point);
			FFlight F;
			F.Mesh = TEXT("tl_rock");
			F.From = C + FVector(150000, 105000, 175000);
			F.Velocity = (C - F.From) / 6.5f;
			F.Gravity = 0.f;
			F.Scale = 150.f;
			F.Spin = 22.f;
			F.bAlign = false;
			F.MaxTime = 9.f;
			F.ArmDelay = 4.5f;
			F.Trail = SkyTrail(D, 6000.f, 9.f, 0.11f, 60000.f, FLinearColor(0.2f, 0.15f, 0.11f));
			D.FX()->Sound(TEXT("asteroid_incoming"), C + FVector(0, 0, 8000), 2.f, 1.f);
			F.Hit = [Dp](const FVector& P, const FVector&, int32, const FVector&)
			{
				const FVector C = Ground(P);
				Dp->FX()->Flash(C + FVector(0, 0, 18000), FLinearColor(1.f, 0.82f, 0.56f), 4.8e9f * Dp->FX()->GlowScale(), 480000.f, 2.3f, 0.f);
				Dp->FX()->MushroomCloud(C, 82000.f, 80.f);
				Dp->FX()->CondensationRing(C + FVector(0, 0, 26000.f), 140000.f, 3.8f, 0.3f);
				Dp->FX()->BlastScorch(C, 70000.f, 38000.f);
				Dp->MakeCrater(C, 11000.f, 3000.f);
				FNYCDamage H;
				H.Center = C + FVector(0, 0, 1800);
				H.Radius = 12000.f;
				H.GlassRadius = 60000.f;
				H.Speed = 6500.f;
				H.UpKick = 2800.f;
				H.Fire = 0.7f;
				H.PropRadius = 22000.f;
				H.MaxElements = 900;
				Dp->ApplyDamage(H);
				Dp->SpawnLumps(C + FVector(0, 0, 900), FVector(0, 0, 1), 110, 600.f, TEXT("concrete"), 9000.f, 0.9f);
				Dp->SpawnLumps(C + FVector(0, 0, 900), FVector(0, 0, 1), 70, 460.f, TEXT("soil"), 11000.f, 0.7f);
				Dp->Shockwave(C, 11000.f, 230000.f, 38000.f, 2.0f, true);
				Dp->FX()->ShockDome(C, 190000.f, 40000.f, 1.f, FLinearColor(1.f, 0.86f, 0.7f));
				Dp->FX()->GroundRing(C, 200000.f, 38000.f, 1.f, TEXT("concrete"));
				DustFront(*Dp, C, 14000.f, 150000.f, 24000.f, 12000.f, TEXT("concrete"));
				Dp->FX()->StreetSurge(C, 11000.f, 120000.f, 26000.f, 8000.f, TEXT("concrete"));
				Dp->FX()->Sound(TEXT("asteroid_impact"), C, 2.f, 1.f);
				Dp->Shake(C, 320.f, 9.f);
				Dp->After(1.2f, [Dp, C]() { Ejecta(*Dp, C, 70, 14000.f, 60000.f, 5.f, 5.f); Dp->ShatterGlass(C + FVector(0, 0, 8000), 90000.f, 3200.f, 5000); });
				Dp->After(2.5f, [Dp, C]() { ThermalFires(*Dp, C + FVector(0, 0, 30000), 80000.f, 56); Dp->FX()->Sound(TEXT("nuke_rumble"), C, 2.f, 0.6f); });
				ShiftWeather(*Dp, 16.f, 0.68f, 0.45f, 0.f, 0.f, 0.55f);
			};
			Fly(D, F);
		}));
}
