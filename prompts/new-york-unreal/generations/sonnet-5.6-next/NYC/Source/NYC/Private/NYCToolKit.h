// Shared moves for the arsenal: things thrown, driven, swung, dropped and detonated.  Everything runs on
// the director's clock (After / During), so the same inputs give the same sequence in play, audit and film.
#pragma once

#include "CoreMinimal.h"
#include "NYCArsenal.h"
#include "NYCDestruction.h"
#include "NYCDestructionFX.h"
#include "NYCTraffic.h"
#include "NYCWeatherController.h"
#include "NYC.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"

namespace NYCT
{
	inline FVector Flat(const FVector& V) { return FVector(V.X, V.Y, 0).GetSafeNormal(UE_SMALL_NUMBER, FVector(1, 0, 0)); }
	inline FVector Ground(const FVector& V, double Z = 0.0) { return FVector(V.X, V.Y, Z); }

	/** The direction of the street nearest to a line of sight: the grid runs along x and y. */
	inline FVector StreetAxis(const FVector& Dir)
	{
		return FMath::Abs(Dir.X) >= FMath::Abs(Dir.Y) ? FVector(Dir.X >= 0 ? 1 : -1, 0, 0) : FVector(0, Dir.Y >= 0 ? 1 : -1, 0);
	}

	/** The horizontal outward direction of whatever was aimed at: a wall's normal, or back toward the viewer. */
	inline FVector Outward(const FNYCAim& A)
	{
		const FVector N(A.Normal.X, A.Normal.Y, 0);
		return N.SizeSquared() > 0.25 ? N.GetSafeNormal() : -Flat(A.Dir);
	}

	/** Hand position: in front of the viewer and a little low and right. */
	inline FVector Hand(const FNYCAim& A)
	{
		const FVector F = A.Dir.GetSafeNormal();
		const FVector R = FVector::CrossProduct(FVector::UpVector, F).GetSafeNormal(UE_SMALL_NUMBER, FVector::RightVector);
		return A.Origin + F * 90.0 + R * 28.0 - FVector(0, 0, 26.0);
	}

	inline FVector WallTangent(const FVector& N) { return FVector::CrossProduct(FVector::UpVector, N).GetSafeNormal(UE_SMALL_NUMBER, FVector(0, 1, 0)); }

	inline FString WallOf(ANYCDestruction& D, int32 Building)
	{
		const FNYCBuildingInfo* I = D.Info(Building);
		return I ? I->Wall : FString(TEXT("concrete"));
	}

	inline FQuat Facing(const FVector& Dir)
	{
		return FRotationMatrix::MakeFromX(Dir.GetSafeNormal(UE_SMALL_NUMBER, FVector::ForwardVector)).ToQuat();
	}

	inline UStaticMeshComponent* Prop(ANYCDestruction& D, const TCHAR* Mesh, const FVector& At, const FQuat& Rot = FQuat::Identity, float Scale = 1.f, float Life = -1.f)
	{
		return D.FX()->Mesh(Mesh, FTransform(Rot, At, FVector(Scale)), Life);
	}

	inline void Place(UStaticMeshComponent* C, const FVector& At, const FQuat& Rot)
	{
		if (C && IsValid(C)) C->SetWorldLocationAndRotation(At, Rot);
	}

	// ------------------------------------------------------------------ explosions
	struct FBlast
	{
		float Radius = 380.f;       // structure
		float Glass = 1200.f;
		float Speed = 1500.f;
		float Fireball = 220.f;     // 0 for none
		float Dust = 1.f;
		float Smoke = 0.f;          // column radius
		float Crater = 0.f;
		float Flash = 1.f;
		float UpKick = 400.f;
		float Burn = 0.2f;
		int32 MaxElements = 700;
		bool bShock = false;
		bool bRagged = false;       // leave anchored wall edges round the hole
		const TCHAR* Sound = TEXT("blast_med");
		float Volume = 1.f;
		float Pitch = 1.f;
		float ShakeAmount = 8.f;
	};

	inline void Blast(ANYCDestruction& D, const FVector& At, const FBlast& B)
	{
		ANYCDestructionFX& F = *D.FX();
		if (B.Fireball > 0.f) F.Fireball(At, B.Fireball, 0.55f + B.Fireball / 1100.f, B.Flash);
		else if (B.Flash > 0.f) F.Flash(At + FVector(0, 0, 60), FLinearColor(1.f, 0.7f, 0.4f), 30.f * B.Radius * B.Radius * B.Flash * F.GlowScale(), B.Radius * 12.f + 800.f, 0.22f);
		F.Sparks(At, FVector(0, 0, B.Speed * 0.9f), FMath::Clamp((int32)(B.Radius * 0.3f), 20, 400), FLinearColor(1.f, 0.6f, 0.2f), 140.f);
		FNYCDamage H;
		H.Center = At;
		H.Radius = B.Radius;
		H.GlassRadius = B.Glass;
		H.Speed = B.Speed;
		H.UpKick = B.UpKick;
		H.Dust = B.Dust;
		H.Fire = B.Burn;
		H.MaxElements = B.MaxElements;
		H.bRagged = B.bRagged;
		H.bCrater = B.Crater > 0.f;
		H.CraterRadius = B.Crater;
		H.PropRadius = FMath::Max(B.Radius * 1.6f, B.Fireball * 2.f);
		D.ApplyDamage(H);
		if (At.Z < B.Radius * 0.8f && B.Dust > 0.f) F.DustBurst(Ground(At, B.Radius * 0.35f), B.Radius * 0.85f, B.Dust * 0.75f, TEXT("asphalt"));
		if (B.Smoke > 0.f) F.SmokeColumn(At, B.Smoke, 14.f);
		if (B.bShock) F.ShockDome(At, B.Glass * 1.3f, B.Glass * 3.4f, 0.55f);
		F.Sound(B.Sound, At, B.Volume, B.Pitch * D.Random().FRandRange(0.94f, 1.06f));
		D.Shake(At, B.ShakeAmount, 0.5f + B.Radius / 900.f);
	}

	// ------------------------------------------------------------------ flying things
	struct FFlight
	{
		FString Mesh;
		FVector From = FVector::ZeroVector;
		FVector Velocity = FVector::ZeroVector;
		float Gravity = 1.f;            // multiple of g
		float Scale = 1.f;
		float Spin = 0.f;               // deg/s end over end
		bool bAlign = true;             // nose follows the path
		float MaxTime = 8.f;
		int32 Bounces = 0;
		float Bounce = 0.5f;
		float Fuse = -1.f;              // >0: go off after this long wherever it is
		float ArmDelay = 0.f;           // ignore hits this early (leaving the launcher)
		/** point, surface normal, building index, velocity at impact */
		TFunction<void(const FVector&, const FVector&, int32, const FVector&)> Hit;
		TFunction<void(const FVector&, const FVector&, float)> Trail;     // position, velocity, age
	};

	inline void Fly(ANYCDestruction& D, const FFlight& In)
	{
		TSharedRef<FFlight> F = MakeShared<FFlight>(In);
		struct FState { FVector P, V; float Age = 0; int32 Left; bool bDone = false; TWeakObjectPtr<UStaticMeshComponent> Mesh; float Roll = 0; };
		TSharedRef<FState> S = MakeShared<FState>();
		S->P = F->From;
		S->V = F->Velocity;
		S->Left = F->Bounces;
		if (!F->Mesh.IsEmpty()) S->Mesh = D.FX()->Mesh(F->Mesh, FTransform(Facing(S->V), S->P, FVector(F->Scale)));
		ANYCDestruction* Dp = &D;
		const float Total = F->MaxTime + 0.2f;
		D.During(Total, [Dp, F, S](float T, float Dt)
		{
			if (S->bDone) return;
			ANYCDestruction& Dir = *Dp;
			S->Age += Dt;
			// several short steps so fast things do not skip through walls
			const int32 Sub = FMath::Clamp(FMath::CeilToInt32(S->V.Size() * Dt / 350.0), 1, 24);
			const float H = Dt / Sub;
			auto Finish = [&](const FVector& At, const FVector& N, int32 B)
			{
				S->bDone = true;
				if (S->Mesh.IsValid()) Dir.FX()->RemoveMesh(S->Mesh.Get());
				if (F->Hit) F->Hit(At, N, B, S->V);
			};
			for (int32 i = 0; i < Sub && !S->bDone; ++i)
			{
				const FVector Prev = S->P;
				S->V.Z -= 981.0 * F->Gravity * H;
				S->P += S->V * H;
				const FVector Step = S->P - Prev;
				const double Len = Step.Size();
				if (Len < 0.01 || S->Age < F->ArmDelay) continue;
				FVector Point, Normal;
				int32 Building = INDEX_NONE;
				const float Hit = Dir.Trace(Prev, Step / Len, (float)Len, Point, Normal, &Building);
				if (Hit >= 0.f)
				{
					if (S->Left > 0)
					{
						--S->Left;
						const FVector Vn = Normal * FVector::DotProduct(S->V, Normal);
						S->V = (S->V - Vn) * (F->Fuse > 0.f ? 0.3 : 0.82) - Vn * F->Bounce;
						S->P = Point + Normal * 4.0;
						Dir.FX()->Sound(TEXT("thock"), Point, 0.4f, Dir.Random().FRandRange(0.85f, 1.2f));
						if (F->Fuse < 0.f && F->Hit) F->Hit(Point, Normal, Building, S->V);
						continue;
					}
					if (F->Fuse > 0.f)
					{
						// it has stopped bouncing: sit there until the fuse runs out
						S->P = Point + Normal * 5.0;
						S->V = FVector::ZeroVector;
						F->Gravity = 0.f;
						continue;
					}
					Finish(Point, Normal, Building);
				}
			}
			if (S->bDone) return;
			if (S->Mesh.IsValid())
			{
				S->Roll += F->Spin * Dt;
				FQuat Q = F->bAlign && S->V.SizeSquared() > 100.0 ? Facing(S->V) : FQuat::Identity;
				if (F->Spin != 0.f) Q = Q * FQuat(FVector(0, 1, 0), FMath::DegreesToRadians(S->Roll));
				S->Mesh->SetWorldLocationAndRotation(S->P, Q);
			}
			if (F->Trail) F->Trail(S->P, S->V, S->Age);
			if ((F->Fuse > 0.f && S->Age >= F->Fuse) || S->Age >= F->MaxTime) Finish(S->P, FVector::UpVector, INDEX_NONE);
		});
	}

	/** Launch velocity that lands on a target after `Time` seconds under g * Gravity. */
	inline FVector Lob(const FVector& From, const FVector& To, float Time, float Gravity = 1.f)
	{
		FVector V = (To - From) / Time;
		V.Z += 0.5 * 981.0 * Gravity * Time;
		return V;
	}

	/** A puffed smoke trail behind a rocket or meteor. */
	inline TFunction<void(const FVector&, const FVector&, float)> SmokeTrail(ANYCDestruction& D, float Radius, float Life, const FLinearColor& Colour, float Spacing, float Fire = 0.f)
	{
		ANYCDestruction* Dp = &D;
		TSharedRef<float> Next = MakeShared<float>(0.f);
		return [Dp, Radius, Life, Colour, Spacing, Fire, Next](const FVector& P, const FVector& V, float Age)
		{
			if (Age < *Next) return;
			*Next = Age + Spacing;
			FNYCPuff Q;
			Q.Pos = P - V.GetSafeNormal() * Radius;
			Q.Vel = -V.GetSafeNormal() * Radius * 1.4f;
			Q.Drag = 1.4f;
			Q.Rise = FVector(0, 0, 30) + Dp->Wind() * 0.4f;
			Q.R0 = Radius * 0.45f;
			Q.R1 = Radius * 1.7f;
			Q.Life = Life;
			Q.FadeIn = 0.05f;
			Q.Density = 0.62f;
			Q.Kind = ENYCVol::Smoke;
			Q.Albedo = Colour;
			Q.NoiseM = Radius / 130.f + 0.35f;
			Dp->FX()->AddPuff(Q);
			if (Fire > 0.f)
			{
				FNYCPuff G = Q;
				G.Kind = ENYCVol::Fireball;
				G.R0 = Radius * 0.55f * Fire;
				G.R1 = Radius * 0.9f * Fire;
				G.Life = 0.28f;
				G.Glow = 60000.f * Dp->FX()->GlowScale();
				G.Albedo = FLinearColor(0.05f, 0.04f, 0.03f);
				Dp->FX()->AddPuff(G);
			}
		};
	}

	// ------------------------------------------------------------------ things that drive
	/** Damage to everything a moving body brushes against between two points. */
	inline void Plough(ANYCDestruction& D, const FVector& From, const FVector& To, float Radius, float Speed, const FVector& Push, int32 MaxElements, bool bStructure = true)
	{
		FNYCDamage H;
		H.Center = From;
		H.End = To;
		H.bCapsule = true;
		H.Radius = bStructure ? Radius : 0.f;
		H.GlassRadius = 0.f;
		H.Speed = Speed;
		H.Push = Push;
		H.UpKick = Speed * 0.18f;
		H.PropRadius = Radius * 1.15f;
		H.MaxElements = MaxElements;
		H.Dust = 0.55f;
		H.bFrame = false;
		D.ApplyDamage(H);
	}

	struct FDriven
	{
		FString Mesh;
		FString Wheel;                      // optional separate wheels
		TArray<FVector> Wheels;             // x, y, radius
		FVector From, To;
		float Time = 3.f;
		float Ease = 2.f;                   // exponent: >1 accelerates into the target
		float Radius = 200.f;               // what it hits
		float Strike = 900.f;               // fragment speed
		float Lift = 120.f;                 // height of the sensing point
		float Scale = 1.f;
		FLinearColor Paint = FLinearColor(0.82f, 0.45f, 0.004f);
		bool bStructure = true;
		int32 PerHit = 6;
		const TCHAR* Engine = TEXT("engine");
		TFunction<void(UStaticMeshComponent*, const FVector&, const FVector&)> Arrive;     // component, position, velocity
		TFunction<void(const FVector&, float)> Step;
		TFunction<double(float)> Height;    // extra height along the way (jumps, bounces)
	};

	/** Drives a mesh in a straight line, wrecking what it meets; returns the component. */
	inline UStaticMeshComponent* Drive(ANYCDestruction& D, const FDriven& In)
	{
		TSharedRef<FDriven> V = MakeShared<FDriven>(In);
		const FVector Dir = Flat(V->To - V->From);
		const FQuat Rot = Facing(Dir);
		UStaticMeshComponent* Body = D.FX()->Mesh(V->Mesh, FTransform(Rot, V->From, FVector(V->Scale)));
		if (!Body) return nullptr;
		Body->SetCustomPrimitiveDataFloat(0, V->Paint.R);
		Body->SetCustomPrimitiveDataFloat(1, V->Paint.G);
		Body->SetCustomPrimitiveDataFloat(2, V->Paint.B);
		TArray<UStaticMeshComponent*> Wheels;
		for (const FVector& W : V->Wheels)
		{
			UStaticMeshComponent* C = D.FX()->Mesh(V->Wheel, FTransform(FVector(W.X, W.Y, W.Z) + V->From));
			if (!C) continue;
			C->AttachToComponent(Body, FAttachmentTransformRules::KeepWorldTransform);
			C->SetRelativeLocation(FVector(W.X, W.Y, W.Z));
			C->SetRelativeRotation(FRotator(0, W.Y < 0 ? 180 : 0, 0));
			Wheels.Add(C);
		}
		if (V->Engine) D.FX()->Sound(V->Engine, V->From, 0.8f, 1.f);
		ANYCDestruction* Dp = &D;
		TWeakObjectPtr<UStaticMeshComponent> Weak(Body);
		TSharedRef<FVector> Last = MakeShared<FVector>(V->From);
		TSharedRef<int32> Count = MakeShared<int32>(0);
		TSharedRef<bool> Done = MakeShared<bool>(false);
		D.During(V->Time + 0.1f, [Dp, V, Weak, Last, Count, Done, Rot, Dir, Wheels](float T, float Dt)
		{
			if (*Done || !Weak.IsValid()) return;
			const float U = FMath::Clamp(T / V->Time, 0.f, 1.f);
			const float E = FMath::Pow(U, V->Ease);
			FVector P = FMath::Lerp(V->From, V->To, (double)E);
			if (V->Height) P.Z += V->Height(U);
			const FVector Vel = (P - *Last) / FMath::Max(Dt, 0.001f);
			FQuat Q = Rot;
			if (V->Height)
			{
				const double Slope = (V->Height(FMath::Min(U + 0.02f, 1.f)) - V->Height(FMath::Max(U - 0.02f, 0.f))) / FMath::Max(1.0, 0.04 * FVector::Dist2D(V->From, V->To));
				Q = Rot * FQuat(FVector(0, 1, 0), -FMath::Atan(Slope));
			}
			Weak->SetWorldLocationAndRotation(P, Q);
			const double Travel = FVector::Dist2D(P, V->From);
			for (int32 i = 0; i < Wheels.Num(); ++i)
			{
				if (!IsValid(Wheels[i])) continue;
				const double Deg = FMath::RadiansToDegrees(Travel / FMath::Max(V->Wheels[i].Z, 20.0));
				Wheels[i]->SetRelativeRotation(FQuat(FVector(0, 1, 0), FMath::DegreesToRadians(Deg)) * FQuat(FVector(0, 0, 1), V->Wheels[i].Y < 0 ? PI : 0.0));
			}
			if (++*Count % 3 == 0 || U >= 1.f)
			{
				const FVector Nose = P + FVector(0, 0, V->Lift) + Dir * V->Radius * 0.7;
				Plough(*Dp, *Last + FVector(0, 0, V->Lift), Nose, V->Radius, V->Strike * (0.4f + 0.6f * U), Dir * V->Strike * 0.7f, V->PerHit, V->bStructure);
				*Last = P;
			}
			if (V->Step) V->Step(P, U);
			if (U >= 1.f)
			{
				*Done = true;
				if (V->Arrive) V->Arrive(Weak.Get(), P, Vel);
			}
		});
		return Body;
	}

	/** Runs something Count times, Interval apart, starting after Delay. */
	inline void Repeat(ANYCDestruction& D, int32 Count, float Interval, float Delay, TFunction<void(int32)> Fn)
	{
		TSharedRef<TFunction<void(int32)>> F = MakeShared<TFunction<void(int32)>>(MoveTemp(Fn));
		for (int32 i = 0; i < Count; ++i) D.After(Delay + i * Interval, [F, i]() { (*F)(i); });
	}

	/** Drops something from high above onto a point; Land gets the impact. */
	inline void Drop(ANYCDestruction& D, const TCHAR* Mesh, const FVector& Onto, float Height, float Scale, float Spin,
		TFunction<void(const FVector&, const FVector&, int32, const FVector&)> Land)
	{
		FFlight F;
		F.Mesh = Mesh;
		F.From = Onto + FVector(0, 0, Height);
		F.Velocity = FVector(0, 0, -600);
		F.Gravity = 1.5f;
		F.Scale = Scale;
		F.Spin = Spin;
		F.bAlign = false;
		F.MaxTime = 12.f;
		F.Hit = MoveTemp(Land);
		Fly(D, F);
	}

	// ------------------------------------------------------------------ shared by the later tiers
	/** Launches a street object as one whole body and returns the body's index. */
	inline int32 Loose(ANYCDestruction& D, int32 PropIndex, const FVector& Velocity, const FVector& Spin)
	{
		const int32 Before = D.NumBodies();
		D.LaunchProp(PropIndex, Velocity, Spin, false, false);
		return D.NumBodies() > Before ? Before : INDEX_NONE;
	}

	/** Eases the weather controller toward given values while an event lasts (live play and audit). */
	inline void ShiftWeather(ANYCDestruction& D, float Duration, float Cloud, float Storm, float Rain, float Snow, float Wind, float SnowCover = -1.f)
	{
		ANYCWeatherController* W = D.Weather();
		if (!W || W->bExternalClock) return;
		TWeakObjectPtr<ANYCWeatherController> Weak(W);
		D.During(Duration, [Weak, Cloud, Storm, Rain, Snow, Wind, SnowCover](float, float Dt)
		{
			if (!Weak.IsValid()) return;
			const float K = FMath::Min(Dt * 0.9f, 1.f);
			Weak->CloudCover = FMath::Lerp(Weak->CloudCover, Cloud, K);
			Weak->Storm = FMath::Lerp(Weak->Storm, Storm, K);
			Weak->Rain = FMath::Lerp(Weak->Rain, Rain, K);
			Weak->Snow = FMath::Lerp(Weak->Snow, Snow, K);
			Weak->Wind = FMath::Lerp(Weak->Wind, Wind, K);
			if (SnowCover >= 0.f) Weak->SnowCover = FMath::Lerp(Weak->SnowCover, SnowCover, K * 0.35f);
		});
	}

	inline void SetBeam(ANYCDestruction& D, int32 Id, const FVector& A, const FVector& B, float Radius = -1.f)
	{
		D.FX()->MoveBeam(Id, A, B, Radius);
	}

	/** A saucer that arrives, hangs about and leaves; Work runs while it is on station. */
	inline void Saucer(ANYCDestruction& D, const FVector& Station, float Scale, float Arrive, float Stay, TFunction<void(const FVector&, float, float)> Work, TFunction<FVector(float)> Wander = nullptr)
	{
		const FVector Far = Station + FVector(24000, 17000, 9000);
		UStaticMeshComponent* Ship = Prop(D, TEXT("tl_saucer"), Far, FQuat::Identity, Scale);
		if (!Ship) return;
		TWeakObjectPtr<UStaticMeshComponent> Weak(Ship);
		D.FX()->Sound(TEXT("ufo_hum"), Station, 1.3f, 1.f);
		D.During(Arrive + Stay + 2.5f, [Weak, Station, Far, Arrive, Stay, Work, Wander](float T, float Dt)
		{
			if (!Weak.IsValid()) return;
			FVector P;
			float Tilt = 0.f;
			if (T < Arrive)
			{
				const float U = 1.f - FMath::Pow(1.f - T / Arrive, 3.f);
				P = FMath::Lerp(Far, Station + (Wander ? Wander(0.f) : FVector::ZeroVector), (double)U);
				Tilt = (1.f - U) * 24.f;
			}
			else if (T < Arrive + Stay)
			{
				const float S = T - Arrive;
				P = Station + (Wander ? Wander(S) : FVector::ZeroVector) + FVector(0, 0, FMath::Sin(S * 2.1f) * 55.f);
				Work(P, S, Dt);
			}
			else
			{
				const float U = (T - Arrive - Stay) / 2.5f;
				const FVector Off = Wander ? Wander(Stay) : FVector::ZeroVector;
				P = Station + Off + FVector(-90000, 52000, 46000) * FMath::Pow(U, 3.f);
				Tilt = -FMath::Min(U * 3.f, 1.f) * 20.f;
				if (U >= 0.98f) Weak->SetVisibility(false);
			}
			Weak->SetWorldLocationAndRotation(P, FRotator(Tilt, T * 65.f, Tilt * 0.4f).Quaternion());
		});
		ANYCDestruction* Dp = &D;
		D.After(Arrive + Stay, [Dp, Station]() { Dp->FX()->Sound(TEXT("ufo_leave"), Station, 1.2f, 1.f); });
	}

	inline FNYCTool Tool(const TCHAR* Id, const TCHAR* Name, int32 Tier, const TCHAR* Category, ENYCTarget Target, float Watch, float Distance, float Height,
		const TCHAR* Does, const TCHAR* Built, TFunction<void(ANYCDestruction&, const FNYCAim&)> Use)
	{
		FNYCTool T;
		T.Id = Id; T.Name = Name; T.Tier = Tier; T.Category = Category; T.Target = Target;
		T.Watch = Watch; T.ViewDistance = Distance; T.ViewHeight = Height; T.Does = Does; T.Built = Built;
		T.Use = MoveTemp(Use);
		return T;
	}
}
