// Tier 1: things a person can hold.  Each breaks something small in its own way.
#include "NYCToolKit.h"

using namespace NYCT;

namespace
{
	/** Shows a hand tool swinging into a point Count times; Impact runs at each blow. */
	void Swing(ANYCDestruction& D, const FNYCAim& A, const TCHAR* Mesh, float Reach, int32 Count, float Period, TFunction<void(int32)> Impact)
	{
		const FVector Out = A.Normal.Z > 0.7 ? -Flat(A.Dir) : Outward(A);
		const FVector Side = WallTangent(Out);
		const FVector Head = A.Point + Out * 4.0;
		const FVector Grip = Head + (Out * 0.78 + Side * 0.5 + FVector(0, 0, A.Normal.Z > 0.7 ? 0.62 : -0.12)).GetSafeNormal() * Reach;
		UStaticMeshComponent* C = Prop(D, Mesh, Grip, Facing(Head - Grip), 1.f, Count * Period + 0.5f);
		const FVector Axis = FVector::CrossProduct(FVector::UpVector, (Head - Grip).GetSafeNormal2D()).GetSafeNormal(UE_SMALL_NUMBER, Side);
		TWeakObjectPtr<UStaticMeshComponent> Weak(C);
		D.During(Count * Period + 0.2f, [Weak, Grip, Head, Axis, Period, Count](float T, float)
		{
			if (!Weak.IsValid()) return;
			const float U = FMath::Frac(FMath::Min(T / Period, Count - 0.001f));
			// drawn back slowly, brought down fast
			const float Angle = U < 0.68f ? FMath::SmoothStep(0.f, 1.f, U / 0.68f) : 1.f - FMath::Square((U - 0.68f) / 0.32f);
			const FQuat Back(Axis, FMath::DegreesToRadians(-95.f * Angle));
			Weak->SetWorldRotation(Back * Facing(Head - Grip));
			Weak->SetWorldLocation(Grip);
		});
		TSharedRef<TFunction<void(int32)>> Fn = MakeShared<TFunction<void(int32)>>(MoveTemp(Impact));
		for (int32 i = 0; i < Count; ++i) D.After((i + 0.995f) * Period, [Fn, i]() { (*Fn)(i); });
	}
}

void NYCArsenal::RegisterHand(TArray<FNYCTool>& Out)
{
	Out.Add(Tool(TEXT("pebble"), TEXT("Slingshot pebble"), 1, TEXT("Hand tool"), ENYCTarget::Facade, 2.0f, 6.f, 3.5f,
		TEXT("Cracks a single window."), TEXT("A pebble mesh flown on a ballistic arc; the window it strikes is swapped for its broken twin, with a small Niagara glass burst."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			FFlight F;
			F.Mesh = TEXT("tl_pebble");
			F.From = Hand(A);
			const float Time = FMath::Clamp((float)FVector::Dist(F.From, A.Point) / 3200.f, 0.08f, 1.2f);
			F.Velocity = Lob(F.From, A.Point, Time);
			F.Spin = 900.f;
			F.bAlign = false;
			F.Scale = 1.4f;
			ANYCDestruction* Dp = &D;
			F.Hit = [Dp](const FVector& P, const FVector& N, int32 B, const FVector& V)
			{
				Dp->ShatterGlass(P, 150.f, 260.f, 1);
				Dp->Scar(P, N, 5.f);
				Dp->FX()->Chips(P, N * 260.0, 14, FLinearColor(0.35f, 0.3f, 0.26f), 0.4f, 1.6f);
				Dp->FX()->Sound(TEXT("tick_glass"), P, 0.5f, 1.25f);
			};
			Fly(D, F);
			D.FX()->Sound(TEXT("sling"), A.Origin, 0.5f, 1.f);
		}));

	Out.Add(Tool(TEXT("baseball"), TEXT("Line-drive baseball"), 1, TEXT("Hand tool"), ENYCTarget::Facade, 3.0f, 8.f, 3.5f,
		TEXT("Smashes a window, then bounces off walls and the street breaking whatever else it clips."),
		TEXT("Bouncing projectile with restitution; each contact shatters the nearest window and can knock over light street objects."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			FFlight F;
			F.Mesh = TEXT("tl_baseball");
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point, FMath::Clamp((float)FVector::Dist(F.From, A.Point) / 2900.f, 0.1f, 1.2f));
			F.Scale = 1.6f;
			F.Spin = 1400.f;
			F.bAlign = false;
			F.Bounces = 3;
			F.Bounce = 0.55f;
			F.MaxTime = 4.f;
			ANYCDestruction* Dp = &D;
			F.Hit = [Dp](const FVector& P, const FVector& N, int32, const FVector& V)
			{
				Dp->ShatterGlass(P, 170.f, 320.f, 2);
				Dp->FX()->Chips(P, N * 340.0, 10, FLinearColor(0.4f, 0.36f, 0.3f), 0.5f, 2.f);
				FNYCDamage H;
				H.Center = P;
				H.Radius = 0.f;
				H.GlassRadius = 0.f;
				H.PropRadius = 110.f;
				H.Speed = 450.f;
				Dp->ApplyDamage(H);
			};
			Fly(D, F);
			D.FX()->Sound(TEXT("bat_crack"), A.Origin, 0.8f, 1.f);
		}));

	Out.Add(Tool(TEXT("marbles"), TEXT("Fistful of marbles"), 1, TEXT("Hand tool"), ENYCTarget::GroundFloor, 2.2f, 7.f, 2.2f,
		TEXT("A spray of marbles that pocks the wall and stars several panes."), TEXT("Eighteen small projectiles in a cone, each leaving a scar or breaking a pane."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			for (int32 i = 0; i < 18; ++i)
			{
				FFlight F;
				F.Mesh = TEXT("tl_marble");
				F.From = Hand(A);
				const FVector Target = A.Point + D.Random().VRand() * D.Random().FRandRange(10.f, 170.f);
				F.Velocity = Lob(F.From, Target, FMath::Clamp((float)FVector::Dist(F.From, A.Point) / D.Random().FRandRange(1900.f, 2600.f), 0.1f, 1.f));
				F.Scale = 1.5f;
				F.bAlign = false;
				const bool bBreak = i % 4 == 0;
				F.Hit = [Dp, bBreak](const FVector& P, const FVector& N, int32, const FVector&)
				{
					if (bBreak) Dp->ShatterGlass(P, 120.f, 200.f, 1);
					Dp->Scar(P, N, 2.6f);
					Dp->FX()->Sparks(P, N * 220.0, 4, FLinearColor(0.7f, 0.75f, 0.8f), 70.f);
					Dp->FX()->Chips(P, N * 200.0, 5, FLinearColor(0.36f, 0.32f, 0.28f), 0.3f, 1.1f);
				};
				D.After(i * 0.012f, [Dp, F]() { Fly(*Dp, F); });
			}
			D.FX()->Sound(TEXT("marbles"), A.Point, 0.6f, 1.f);
		}));

	Out.Add(Tool(TEXT("claw_hammer"), TEXT("Claw hammer"), 1, TEXT("Hand tool"), ENYCTarget::Facade, 2.4f, 4.f, 3.f,
		TEXT("Chips fist-sized bites out of the masonry."), TEXT("Animated hammer mesh; each blow spawns a few Chaos fragments of the wall's own material, a scar and chips."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FString Wall = WallOf(D, A.Building);
			Swing(D, A, TEXT("tl_claw_hammer"), 36.f, 3, 0.52f, [Dp, A, Wall](int32 i)
			{
				const FVector P = A.Point + Dp->Random().VRand() * 7.0;
				Dp->Scar(P, A.Normal, 7.f + 3.f * i);
				Dp->SpawnLumps(P + A.Normal * 8.0, A.Normal, 5, 6.f, Wall, 240.f);
				Dp->FX()->Chips(P, A.Normal * 260.0, 22, ANYCDestructionFX::DustColour(Wall), 0.4f, 1.8f);
				Dp->FX()->Sound(TEXT("hammer"), P, 0.55f, 1.f + 0.05f * i);
				if (i == 2) Dp->ShatterGlass(P, 140.f, 150.f, 1);
			});
		}));

	Out.Add(Tool(TEXT("crowbar"), TEXT("Crowbar"), 1, TEXT("Hand tool"), ENYCTarget::GroundFloor, 2.8f, 5.f, 2.4f,
		TEXT("Pries a window out of its frame."), TEXT("Two levering strokes; the pane breaks and bent lengths of frame fall as rigid metal fragments."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			Swing(D, A, TEXT("tl_crowbar"), 80.f, 2, 0.75f, [Dp, A](int32 i)
			{
				Dp->FX()->Sound(TEXT("creak"), A.Point, 0.7f, 0.9f + 0.2f * i);
				if (i == 1)
				{
					Dp->ShatterGlass(A.Point, 170.f, 260.f, 2);
					Dp->SpawnLumps(A.Point + A.Normal * 14.0, A.Normal + FVector(0, 0, 0.2), 9, 22.f, TEXT("paint_darkgray"), 300.f, 0.5f, 5.f);
					Dp->Scar(A.Point + FVector(0, 0, -30), A.Normal, 14.f);
					Dp->FX()->Splinters(A.Point, A.Normal * 300.0, 60);
				}
				else Dp->FX()->Chips(A.Point, A.Normal * 150.0, 12, FLinearColor(0.2f, 0.18f, 0.16f), 0.4f, 1.4f);
			});
		}));

	Out.Add(Tool(TEXT("pickaxe"), TEXT("Pickaxe"), 1, TEXT("Hand tool"), ENYCTarget::Street, 3.0f, 5.f, 2.4f,
		TEXT("Breaks a small hole in the roadway, throwing lumps of asphalt."), TEXT("Two swings; a small crater is cut with the crater material and asphalt lumps are spawned as Chaos pieces."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			Swing(D, A, TEXT("tl_pickaxe"), 90.f, 3, 0.62f, [Dp, A](int32 i)
			{
				Dp->SpawnLumps(Ground(A.Point, 24.0), FVector(0, 0, 1), 5 + i * 2, 11.f, TEXT("granite_black"), 330.f, 0.75f);
				Dp->FX()->Chips(A.Point, FVector(0, 0, 340), 30, FLinearColor(0.06f, 0.055f, 0.05f), 0.6f, 2.6f);
				Dp->FX()->Sound(TEXT("pick"), A.Point, 0.7f, 1.f - 0.06f * i);
				Dp->FX()->Sparks(A.Point, FVector(0, 0, 300), 12);
				if (i == 2) Dp->MakeCrater(Ground(A.Point), 58.f, 24.f);
			});
		}));

	Out.Add(Tool(TEXT("fire_axe"), TEXT("Fire axe"), 1, TEXT("Hand tool"), ENYCTarget::GroundFloor, 2.8f, 6.f, 2.4f,
		TEXT("Splits a storefront: glass sheets down along the line of the blows and whatever stands there splinters."),
		TEXT("Three sweeping strokes walk along the wall, shattering storefront glazing and throwing splinters."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = WallTangent(Outward(A));
			Swing(D, A, TEXT("tl_fire_axe"), 82.f, 3, 0.6f, [Dp, A, Along](int32 i)
			{
				const FVector P = A.Point + Along * ((i - 1) * 85.0);
				Dp->ShatterGlass(P, 190.f, 420.f, 3);
				Dp->Scar(P, A.Normal, 18.f);
				Dp->FX()->Splinters(P, A.Normal * 420.0, 90);
				Dp->SpawnLumps(P + A.Normal * 10.0, A.Normal, 4, 18.f, TEXT("wood"), 320.f, 0.6f, 3.5f);
				Dp->FX()->Sound(TEXT("axe"), P, 0.75f, 1.f);
				FNYCDamage H;
				H.Center = P;
				H.Radius = 0.f;
				H.GlassRadius = 0.f;
				H.PropRadius = 120.f;
				H.Speed = 520.f;
				Dp->ApplyDamage(H);
			});
		}));

	Out.Add(Tool(TEXT("sledgehammer"), TEXT("Sledgehammer"), 1, TEXT("Hand tool"), ENYCTarget::Facade, 3.6f, 7.f, 3.f,
		TEXT("Knocks a bay out of a masonry wall."), TEXT("Three heavy blows: scars and lumps, then the struck facade module is fractured (Voronoi chunks, frames, glass) with a puff of its dust."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FString Wall = WallOf(D, A.Building);
			Swing(D, A, TEXT("tl_sledgehammer"), 88.f, 3, 0.78f, [Dp, A, Wall](int32 i)
			{
				Dp->Scar(A.Point + Dp->Random().VRand() * 16.0, A.Normal, 17.f + 8.f * i);
				Dp->SpawnLumps(A.Point + A.Normal * 14.0, A.Normal, 6, 13.f, Wall, 330.f);
				Dp->FX()->DustBurst(A.Point + A.Normal * 30.0, 55.f, 0.55f, Wall);
				Dp->FX()->Sound(TEXT("sledge"), A.Point, 0.8f, 1.f - 0.05f * i);
				Dp->Shake(A.Point, 2.f, 0.25f);
				if (i == 2)
				{
					FNYCDamage H;
					H.Center = A.Point - A.Normal * 12.0;
					H.Radius = 48.f;
					H.GlassRadius = 170.f;
					H.Speed = 270.f;
					// most of a struck wall slumps where it stands: only a little is driven indoors
					H.Push = -A.Normal * 35.0;
					H.bRadial = true;
					H.bStructural = false;
					H.bFrame = false;
					H.MaxElements = 1;
					H.ForceLOD = 0;
					H.PropRadius = 0.f;
					H.Dust = 0.5f;
					H.bRagged = true;
					Dp->ApplyDamage(H);
				}
			});
		}));

	Out.Add(Tool(TEXT("firecracker"), TEXT("Firecrackers"), 1, TEXT("Explosive"), ENYCTarget::Box, 3.2f, 6.f, 2.2f,
		TEXT("A string of sharp little pops that scatters litter and bags."), TEXT("Thrown bundle with a sparking fuse; a train of tiny flashes with red paper confetti (Niagara) and a light push on loose objects."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_firecracker");
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point + FVector(0, 0, 12), 0.65f);
			F.Spin = 500.f;
			F.bAlign = false;
			F.Bounces = 3;
			F.Bounce = 0.28f;
			F.Fuse = 1.4f;
			F.Trail = [Dp](const FVector& P, const FVector&, float) { Dp->FX()->Sparks(P, FVector(0, 0, 190), 2, FLinearColor(1.f, 0.7f, 0.3f), 80.f); };
			F.Hit = [Dp](const FVector& P, const FVector&, int32, const FVector&)
			{
				if (Dp->Random().GetFraction() < 0.01f) return;
				Repeat(*Dp, 9, 0.085f, 0.f, [Dp, P](int32 i)
				{
					const FVector Q = P + FVector(Dp->Random().FRandRange(-40.f, 40.f), Dp->Random().FRandRange(-40.f, 40.f), Dp->Random().FRandRange(5.f, 35.f));
					if (i == 0) Dp->FX()->Flash(Q, FLinearColor(1.f, 0.8f, 0.5f), 3500.f * Dp->FX()->GlowScale(), 450.f, 0.8f, 0.4f);
					Dp->FX()->Sparks(Q, Dp->Random().VRand() * 380.0, 18, FLinearColor(1.f, 0.75f, 0.4f), 120.f);
					// shredded red wrapping paper
					Dp->FX()->Chips(Q, FVector(0, 0, 330), 34, FLinearColor(0.55f, 0.035f, 0.025f), 0.8f, 2.4f, 80.f);
					Dp->FX()->DustBurst(Q, 20.f, 0.22f, TEXT("asphalt"));
					Dp->FX()->Sound(TEXT("pop"), Q, 0.55f, Dp->Random().FRandRange(0.85f, 1.2f));
					FNYCDamage H;
					H.Center = Q;
					H.Radius = 0.f;
					H.GlassRadius = 0.f;
					H.PropRadius = 130.f;
					H.PropForce = 0.8f;
					H.Speed = 380.f;
					H.UpKick = 150.f;
					Dp->ApplyDamage(H);
					if (i == 4) { Dp->MakeCrater(Ground(P), 22.f, 6.f); Dp->ShatterGlass(P, 150.f, 200.f, 1); }
				});
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("cherry_bomb"), TEXT("Cherry bomb"), 1, TEXT("Explosive"), ENYCTarget::Box, 3.4f, 8.f, 2.8f,
		TEXT("One hard bang that blows a mailbox or news box apart."), TEXT("Fused projectile; a small flash, a knot of smoke and a force strong enough to fracture street boxes into pieces."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			FFlight F;
			F.Mesh = TEXT("tl_grenade");
			F.Scale = 0.6f;
			F.From = Hand(A);
			F.Velocity = Lob(F.From, A.Point + FVector(0, 0, 14), 0.7f);
			F.Spin = 700.f;
			F.bAlign = false;
			F.Bounces = 2;
			F.Bounce = 0.25f;
			F.Fuse = 1.5f;
			F.Trail = [Dp](const FVector& P, const FVector&, float) { Dp->FX()->Sparks(P, FVector(0, 0, 220), 2, FLinearColor(1.f, 0.55f, 0.2f), 70.f); };
			F.Hit = [Dp](const FVector& P, const FVector&, int32, const FVector&)
			{
				FBlast B;
				B.Radius = 45.f;
				B.Glass = 330.f;
				B.Speed = 900.f;
				B.Fireball = 55.f;
				B.Dust = 0.35f;
				B.Flash = 0.7f;
				B.UpKick = 350.f;
				B.MaxElements = 1;
				B.Sound = TEXT("bang_small");
				B.Volume = 0.85f;
				B.ShakeAmount = 3.f;
				Blast(*Dp, P, B);
				FNYCDamage H;
				H.Center = P;
				H.Radius = 0.f;
				H.GlassRadius = 0.f;
				H.PropRadius = 340.f;
				H.PropForce = 1.2f;
				H.Speed = 1000.f;
				H.UpKick = 300.f;
				Dp->ApplyDamage(H);
				Dp->MakeCrater(Ground(P), 32.f, 8.f);
				Dp->FX()->SmokeColumn(P, 22.f, 3.f, 0.45f);
			};
			Fly(D, F);
		}));

	Out.Add(Tool(TEXT("hydrant_wrench"), TEXT("Hydrant wrench"), 1, TEXT("Hand tool"), ENYCTarget::Hydrant, 5.0f, 11.f, 3.5f,
		TEXT("Wrenches a hydrant off: it pops loose and the main throws a column of water."), TEXT("The hydrant becomes a rigid body; a Niagara water jet, spray splashes and mist run for half a minute."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 H = D.FindProp(A.Point, ANYCDestruction::MHydrant, 4000.f);
			const FVector At = H != INDEX_NONE ? D.PropLocation(H) : Ground(A.Point, 15.0);
			FNYCAim To = A;
			To.Point = At + FVector(0, 0, 55);
			To.Normal = -Flat(A.Dir);
			Swing(D, To, TEXT("tl_hydrant_wrench"), 50.f, 2, 0.6f, [Dp, At, H](int32 i)
			{
				Dp->FX()->Sound(TEXT("creak"), At, 0.7f, 1.2f);
				if (i != 1) return;
				if (H != INDEX_NONE) Dp->LaunchProp(H, FVector(Dp->Random().FRandRange(-90.f, 90.f), Dp->Random().FRandRange(-90.f, 90.f), 620.f), FVector(140, 60, 90), false, false);
				else
				{
					Dp->FX()->WaterJet(At, FVector(0, 0, 1), 22.f, 0.8f);
					Dp->MakeCrater(Ground(At), 45.f, 14.f);
				}
				Dp->FX()->Splash(At + FVector(0, 0, 30), 170.f, 1.2f);
			});
		}));

	Out.Add(Tool(TEXT("chainsaw"), TEXT("Chainsaw"), 1, TEXT("Hand tool"), ENYCTarget::Tree, 5.0f, 12.f, 3.5f,
		TEXT("Cuts through a street tree and fells it."), TEXT("The saw bites with bursts of sawdust and splinters, then the tree becomes a rigid body given a topple about its stump."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			int32 T = D.FindProp(A.Point, ANYCDestruction::MTree, 3000.f);
			if (T == INDEX_NONE) T = D.FindProp(A.Point, ANYCDestruction::MPole, 3000.f);
			const FVector Base = T != INDEX_NONE ? D.PropLocation(T) : A.Point;
			const FVector Cut = Base + FVector(0, 0, 70);
			const FVector Away = Flat(Base - A.Origin);
			const FVector Side = WallTangent(Away);
			UStaticMeshComponent* Saw = Prop(D, TEXT("tl_chainsaw"), Cut - Side * 95.0 - Away * 12.0, Facing(Side), 1.f, 2.6f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(Saw);
			D.During(2.3f, [Weak, Cut, Side, Away](float Time, float)
			{
				if (Weak.IsValid()) Weak->SetWorldLocation(Cut - Side * (95.0 - 38.0 * FMath::Min(Time / 2.2f, 1.f)) - Away * 12.0 + FVector(0, 0, FMath::Sin(Time * 61.f) * 0.7));
			});
			D.FX()->Sound(TEXT("chainsaw"), Cut, 0.9f, 1.f);
			Repeat(D, 18, 0.12f, 0.15f, [Dp, Cut, Side, Away](int32)
			{
				Dp->FX()->Splinters(Cut, (Side * 0.4 - Away + FVector(0, 0, 0.25)) * 420.0, 16);
				Dp->FX()->Chips(Cut, (-Away) * 280.0, 18, FLinearColor(0.42f, 0.28f, 0.13f), 0.25f, 1.1f, 40.f);
				Dp->Stats.Pieces++;
			});
			D.After(2.35f, [Dp, T, Cut, Away, Side]()
			{
				// it leans, cracks and goes over away from the cut
				if (T != INDEX_NONE) Dp->LaunchProp(T, Away * 130.0 + FVector(0, 0, 25), FVector(-Away.Y, Away.X, 0) * 42.0, false, false);
				Dp->SpawnLumps(Cut, Away, 5, 14.f, TEXT("bark"), 130.f, 0.9f, 2.5f);
				Dp->FX()->Sound(TEXT("timber"), Cut, 0.9f, 1.f);
			});
		}));

	Out.Add(Tool(TEXT("cutting_torch"), TEXT("Cutting torch"), 1, TEXT("Hand tool"), ENYCTarget::Pole, 5.0f, 11.f, 3.5f,
		TEXT("Burns through a steel post, which topples."), TEXT("A hissing blue flame, a Niagara spark stream and molten drips, a flickering light; then the post falls as a rigid body and its lamp or signals go dark."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const int32 P = D.FindProp(A.Point, ANYCDestruction::MPole, 3000.f);
			const FVector Base = P != INDEX_NONE ? D.PropLocation(P) : A.Point;
			const FVector Cut = P != INDEX_NONE ? Base + FVector(0, 0, 95) : A.Point;
			const FVector Away = Flat(Base - A.Origin);
			Prop(D, TEXT("tl_cutting_torch"), Cut - Away * 52.0 + FVector(0, 0, -8), Facing(Away), 1.f, 2.8f);
			D.FX()->Glow(Cut - Away * 18.0, FLinearColor(1.f, 0.55f, 0.2f), 5200.f * D.FX()->GlowScale(), 700.f, 2.7f, 0.5f);
			const int32 Jet = D.FX()->Beam(Cut - Away * 16.0, Cut, 1.3f, FLinearColor(0.35f, 0.6f, 1.f), 60000.f, 2.6f);
			D.FX()->Sound(TEXT("torch"), Cut, 0.7f, 1.f);
			Repeat(D, 26, 0.1f, 0.05f, [Dp, Cut, Away](int32 i)
			{
				const float Turn = i * 0.24f;
				const FVector At = Cut + FVector(FMath::Cos(Turn) * 9.f, FMath::Sin(Turn) * 9.f, 0);
				Dp->FX()->Sparks(At, (-Away + FVector(0, 0, 0.35)) * 520.0, 22, FLinearColor(1.f, 0.72f, 0.3f), 48.f);
				if (i % 4 == 0) Dp->FX()->Motes(At - FVector(0, 0, 8), 5, FLinearColor(1.f, 0.3f, 0.04f), 4.f, 40.f, 1.1f, 3.f, FVector(0, 0, -700));
			});
			D.After(2.7f, [Dp, P, Cut, Away]()
			{
				if (P != INDEX_NONE) Dp->LaunchProp(P, Away * 150.0, FVector(-Away.Y, Away.X, 0) * 40.0, false, false);
				else Dp->SpawnLumps(Cut, Away, 6, 16.f, TEXT("rust"), 200.f, 0.6f, 4.f);
				Dp->SpawnLumps(Cut, -Away, 3, 6.f, TEXT("rust"), 180.f);
				Dp->FX()->Sound(TEXT("clang"), Cut, 0.85f, 0.85f);
			});
		}));

	Out.Add(Tool(TEXT("jackhammer"), TEXT("Jackhammer"), 1, TEXT("Demolition tool"), ENYCTarget::Street, 4.6f, 7.f, 3.2f,
		TEXT("Hammers a trench into the pavement."), TEXT("Thirty rapid blows walking forward: pavement lumps, grit, shake, and a line of overlapping breaks cut into the road."),
		[](ANYCDestruction& D, const FNYCAim& A)
		{
			ANYCDestruction* Dp = &D;
			const FVector Along = Flat(A.Dir);
			const FVector Start = Ground(A.Point);
			UStaticMeshComponent* Tool_ = Prop(D, TEXT("tl_jackhammer"), Start + FVector(0, 0, 100), Facing(FVector(0, 0, -1)), 1.f, 4.0f);
			TWeakObjectPtr<UStaticMeshComponent> Weak(Tool_);
			D.During(3.7f, [Weak, Start, Along](float T, float)
			{
				if (!Weak.IsValid()) return;
				const FVector Base = Start + Along * (T / 3.6f * 170.0);
				Weak->SetWorldLocation(Base + FVector(0, 0, 100.0 + FMath::Abs(FMath::Sin(T * 40.f)) * 7.0));
			});
			D.FX()->Sound(TEXT("jackhammer"), Start, 0.95f, 1.f);
			Repeat(D, 30, 0.12f, 0.05f, [Dp, Start, Along](int32 i)
			{
				const FVector P = Start + Along * (i / 29.0 * 170.0);
				if (i % 2 == 0) Dp->SpawnLumps(P + FVector(0, 0, 20), FVector(0, 0, 1), 3, 8.f, i % 4 ? TEXT("granite_black") : TEXT("concrete"), 270.f, 0.9f);
				Dp->FX()->Chips(P, FVector(0, 0, 260), 12, FLinearColor(0.09f, 0.085f, 0.08f), 0.4f, 1.8f);
				Dp->Shake(P, 1.2f, 0.14f);
				if (i % 5 == 4)
				{
					Dp->MakeCrater(P, 44.f + i, 18.f);
					Dp->FX()->DustBurst(P + FVector(0, 0, 14), 42.f, 0.4f, TEXT("concrete"));
				}
			});
		}));
}
