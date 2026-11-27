#include "NYCTraffic.h"
#include "NYC.h"
#include "NYCWeatherController.h"
#include "NYCWalkers.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

namespace
{
	constexpr float SimDt = 1.f / 30.f;
	constexpr float Prewarm = 75.f;
	constexpr float MaxDrawDistance = 150000.f;
	constexpr int32 NumHeadLights = 200;
	constexpr int32 NumTailLights = 40;
	constexpr int32 NumSignalLights = 28;

	float Hash01(int32 N)
	{
		return FMath::Frac(FMath::Sin(N * 12.9898f) * 43758.5453f) + (FMath::Frac(FMath::Sin(N * 12.9898f) * 43758.5453f) < 0.f ? 1.f : 0.f);
	}
}

ANYCTraffic::ANYCTraffic()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PostUpdateWork;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Root->SetMobility(EComponentMobility::Movable);
}

void ANYCTraffic::BeginPlay()
{
	Super::BeginPlay();
	for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It) { Weather = *It; break; }
	if (Weather) AddTickPrerequisiteActor(Weather);
	bLoaded = LoadData();
	if (bLoaded) CreateRuntimeComponents();
}

void ANYCTraffic::EndPlay(const EEndPlayReason::Type Reason)
{
	FlushAudio();
	Super::EndPlay(Reason);
}

bool ANYCTraffic::LoadData()
{
	FString Text;
	const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), DataFile);
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		UE_LOG(LogNYC, Error, TEXT("Traffic data missing: %s"), *Path);
		return false;
	}
	TSharedPtr<FJsonObject> J;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, J) || !J.IsValid())
	{
		UE_LOG(LogNYC, Error, TEXT("Traffic data unreadable"));
		return false;
	}
	Cycle = J->GetNumberField(TEXT("cycle"));
	AveGreen = J->GetNumberField(TEXT("aveGreen"));
	Yellow = J->GetNumberField(TEXT("yellow"));
	AllRed = J->GetNumberField(TEXT("allRed"));

	Lanes.Reset();
	int32 LaneIndex = 0;
	for (const TSharedPtr<FJsonValue>& V : J->GetArrayField(TEXT("lanes")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FLane L;
		const TArray<TSharedPtr<FJsonValue>>& P = O->GetArrayField(TEXT("p0"));
		const TArray<TSharedPtr<FJsonValue>>& D = O->GetArrayField(TEXT("dir"));
		L.P0 = FVector2D(P[0]->AsNumber(), P[1]->AsNumber()) * 100.0;
		L.Dir = FVector2D(D[0]->AsNumber(), D[1]->AsNumber());
		L.Length = O->GetNumberField(TEXT("length")) * 100.f;
		L.bBus = O->GetStringField(TEXT("kind")) == TEXT("bus");
		L.bAvenue = O->GetStringField(TEXT("axis")) == TEXT("a");
		for (const TSharedPtr<FJsonValue>& S : O->GetArrayField(TEXT("stops")))
		{
			const TArray<TSharedPtr<FJsonValue>>& A = S->AsArray();
			L.Stops.Add({ (float)A[0]->AsNumber() * 100.f, (int32)A[1]->AsNumber(), (float)A[2]->AsNumber() });
		}
		// mean seconds between arrivals
		const FString Road = O->GetStringField(TEXT("road"));
		L.Headway = L.bBus ? 26.f : (L.bAvenue ? 6.5f : (Road == TEXT("42") || Road == TEXT("34") ? 8.f : 17.f));
		L.Rng.Initialize(7919 * (LaneIndex + 1));
		++LaneIndex;
		Lanes.Add(MoveTemp(L));
	}

	Lamps.Reset();
	for (const TSharedPtr<FJsonValue>& V : J->GetArrayField(TEXT("lamps")))
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		FLamp L;
		L.Pos = FVector(A[0]->AsNumber(), A[1]->AsNumber(), A[2]->AsNumber()) * 100.0;
		L.Yaw = A[3]->AsNumber();
		L.Kind = (int32)A[4]->AsNumber();
		L.Group = (int32)A[5]->AsNumber();
		L.Offset = A[6]->AsNumber();
		L.Instance = 0;
		Lamps.Add(L);
	}

	Peds.Reset();	// pedestrians now live in UNYCWalkerComponent
	UE_LOG(LogNYC, Log, TEXT("Traffic: %d lanes, %d signal lamps"), Lanes.Num(), Lamps.Num());
	return true;
}

void ANYCTraffic::CreateRuntimeComponents()
{
	auto MakeISM = [this](UStaticMesh* Mesh, int32 NumData, bool bShadow)
	{
		UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(Mesh);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->NumCustomDataFloats = NumData;
		C->CastShadow = bShadow;
		C->bAffectDistanceFieldLighting = false;
		C->SetupAttachment(Root);
		C->RegisterComponent();
		return C;
	};
	if (LampMesh && PedFaceMesh)
	{
		LampISM = MakeISM(LampMesh, 4, false);
		PedFaceISM = MakeISM(PedFaceMesh, 2, false);
		for (FLamp& L : Lamps)
		{
			UInstancedStaticMeshComponent* C = L.Kind == 3 ? PedFaceISM : LampISM;
			L.Instance = C->AddInstance(FTransform(FRotator(0.f, L.Yaw, 0.f), L.Pos), true);
		}
	}
	Walkers = NewObject<UNYCWalkerComponent>(this, TEXT("Walkers"), RF_Transient);
	Walkers->SetupAttachment(Root);
	Walkers->RegisterComponent();
	if (!Walkers->Load(DataFile, PedestrianDensity)) UE_LOG(LogNYC, Error, TEXT("Walkers failed to load"));
	for (int32 i = 0; i < NumHeadLights; ++i)
	{
		USpotLightComponent* S = NewObject<USpotLightComponent>(this, NAME_None, RF_Transient);
		S->SetMobility(EComponentMobility::Movable);
		S->IntensityUnits = ELightUnits::Candelas;
		S->OuterConeAngle = 36.f;
		S->InnerConeAngle = 8.f;
		S->AttenuationRadius = 4200.f;
		S->LightColor = FColor(255, 238, 214);
		S->SourceRadius = 7.f;
		S->Intensity = 0.f;
		S->CastShadows = i < 40;
		S->VolumetricScatteringIntensity = 1.4f;
		S->SetupAttachment(Root);
		S->RegisterComponent();
		S->SetVisibility(false);
		HeadPool.Add(S);
	}
	auto MakePoint = [this](float Radius)
	{
		UPointLightComponent* P = NewObject<UPointLightComponent>(this, NAME_None, RF_Transient);
		P->SetMobility(EComponentMobility::Movable);
		P->IntensityUnits = ELightUnits::Candelas;
		P->AttenuationRadius = Radius;
		P->SourceRadius = 6.f;
		P->Intensity = 0.f;
		P->CastShadows = false;
		P->VolumetricScatteringIntensity = 0.8f;
		P->SetupAttachment(Root);
		P->RegisterComponent();
		P->SetVisibility(false);
		return P;
	};
	for (int32 i = 0; i < NumTailLights; ++i) TailPool.Add(MakePoint(650.f));
	for (int32 i = 0; i < NumSignalLights; ++i) SignalPool.Add(MakePoint(1100.f));
	Pools.SetNum(Types.Num());
}

int32 ANYCTraffic::SignalState(double Time, int32 Group, float Offset) const
{
	double P = FMath::Fmod(Time + Offset, (double)Cycle);
	if (P < 0) P += Cycle;
	if (Group == 0)
	{
		return P < AveGreen ? 2 : (P < AveGreen + Yellow ? 1 : 0);
	}
	const double Start = AveGreen + Yellow + AllRed;
	const double Green = Cycle - AveGreen - 2.0 * Yellow - 2.0 * AllRed;
	if (P < Start) return 0;
	return P < Start + Green ? 2 : (P < Start + Green + Yellow ? 1 : 0);
}

int32 ANYCTraffic::PickType(FLane& Lane) const
{
	float R = Lane.Rng.FRand();
	int32 Kind;
	if (Lane.bBus)
	{
		Kind = R < 0.42f ? 5 : (R < 0.86f ? 0 : 3);
	}
	else if (Lane.bAvenue)
	{
		Kind = R < 0.34f ? 0 : (R < 0.54f ? 1 : (R < 0.81f ? 2 : (R < 0.91f ? 3 : 4)));
	}
	else
	{
		Kind = R < 0.28f ? 0 : (R < 0.48f ? 1 : (R < 0.72f ? 2 : (R < 0.89f ? 3 : 4)));
	}
	TArray<int32, TInlineAllocator<8>> Matching;
	for (int32 i = 0; i < Types.Num(); ++i)
	{
		if (Types[i].Kind == Kind) Matching.Add(i);
	}
	return Matching.Num() ? Matching[Lane.Rng.RandRange(0, Matching.Num() - 1)] : 0;
}

FLinearColor ANYCTraffic::PickColor(FRandomStream& R, int32 Kind) const
{
	if (Kind == 0) return FLinearColor(0.84f, 0.47f, 0.004f);
	if (Kind >= 3) return Kind == 3 && R.FRand() < 0.2f ? FLinearColor(0.05f, 0.052f, 0.055f) : FLinearColor(0.66f, 0.66f, 0.63f);
	static const FLinearColor Palette[] = {
		FLinearColor(0.006f, 0.006f, 0.007f), FLinearColor(0.006f, 0.006f, 0.007f), FLinearColor(0.012f, 0.013f, 0.015f),
		FLinearColor(0.68f, 0.68f, 0.66f), FLinearColor(0.58f, 0.58f, 0.57f), FLinearColor(0.34f, 0.35f, 0.37f), FLinearColor(0.12f, 0.125f, 0.135f),
		FLinearColor(0.06f, 0.063f, 0.068f), FLinearColor(0.012f, 0.03f, 0.11f), FLinearColor(0.24f, 0.012f, 0.008f), FLinearColor(0.012f, 0.05f, 0.03f),
		FLinearColor(0.25f, 0.2f, 0.12f)
	};
	return Palette[R.RandRange(0, UE_ARRAY_COUNT(Palette) - 1)];
}

void ANYCTraffic::Spawn(FLane& Lane, float S, double Time)
{
	FCar C;
	C.Id = NextId++;
	C.Type = PickType(Lane);
	const int32 Kind = Types.IsValidIndex(C.Type) ? Types[C.Type].Kind : 1;
	C.Color = PickColor(Lane.Rng, Kind);
	C.Cruise = Lane.Rng.FRandRange(0.86f, 1.12f) * (Lane.bAvenue ? 1120.f : 720.f) * (Kind >= 4 ? 0.85f : 1.f);
	C.S = C.PrevS = S;
	C.V = C.PrevV = C.Cruise * 0.7f;
	C.bHazard = Kind >= 3 && Kind <= 4 && Lane.Rng.FRand() < 0.04f;
	// keep the queue ordered front to back
	int32 At = Lane.Cars.Num();
	while (At > 0 && Lane.Cars[At - 1].S < S) --At;
	Lane.Cars.Insert(C, At);
}

void ANYCTraffic::ResetSim(double Time)
{
	NextId = 1;
	const double Start = Time - Prewarm;
	for (int32 i = 0; i < Lanes.Num(); ++i)
	{
		FLane& L = Lanes[i];
		L.Cars.Reset();
		L.Rng.Initialize(7919 * (i + 1));
		const float Gap = L.Headway / FMath::Max(Density, 0.05f) * 800.f;
		float S = L.Length - L.Rng.FRandRange(0.f, Gap);
		while (S > 0.f)
		{
			Spawn(L, S, Start);
			S -= FMath::Max(1100.f, Gap * L.Rng.FRandRange(0.35f, 1.9f));
		}
		L.NextSpawn = Start + L.Rng.FRandRange(0.5f, L.Headway);
	}
	SimClock = Start;
}

void ANYCTraffic::StepSim(double Time, float Dt)
{
	for (FLane& L : Lanes)
	{
		for (int32 i = 0; i < L.Cars.Num(); ++i)
		{
			FCar& C = L.Cars[i];
			C.PrevS = C.S;
			C.PrevV = C.V;
			const float Len = Types.IsValidIndex(C.Type) ? Types[C.Type].Length : 480.f;
			float Gap = 1.0e8f;
			float Closing = 0.f;
			if (i > 0)
			{
				const FCar& F = L.Cars[i - 1];
				const float FLen = Types.IsValidIndex(F.Type) ? Types[F.Type].Length : 480.f;
				Gap = F.PrevS - FLen * 0.5f - (C.S + Len * 0.5f);
				Closing = C.V - F.PrevV;
			}
			const float Nose = C.S + Len * 0.5f;
			for (const FStop& St : L.Stops)
			{
				const float D = St.S - Nose;
				if (D < -60.f) continue;
				if (D > 9000.f) break;
				const int32 State = SignalState(Time, St.Group, St.Offset);
				bool bMustStop = State == 0 || (State == 1 && D > C.V * C.V / (2.f * 330.f));
				// do not block the box: wait if there is no room on the far side
				if (!bMustStop && i > 0 && D < 2500.f)
				{
					const FCar& F = L.Cars[i - 1];
					const float FLen = Types.IsValidIndex(F.Type) ? Types[F.Type].Length : 480.f;
					const float Rear = F.PrevS - FLen * 0.5f;
					if (F.PrevV < 150.f && Rear > St.S - 100.f && Rear < St.S + 2300.f + Len) bMustStop = true;
				}
				if (bMustStop && D < Gap)
				{
					Gap = D + 120.f;
					Closing = C.V;
				}
				if (bMustStop) break;
			}
			for (const FSphere& O : Obstacles)
			{
				const FVector2D Rel = FVector2D(O.Center.X, O.Center.Y) - L.P0;
				const double Along = FVector2D::DotProduct(Rel, L.Dir);
				const double Across = FMath::Abs(FVector2D::CrossProduct(L.Dir, Rel));
				if (Across > O.W + 150.0) continue;
				const float D = (float)(Along - O.W) - Nose;
				if (D > -O.W && D < Gap)
				{
					Gap = FMath::Max(D, 0.f) + 120.f;
					Closing = C.V;
				}
			}
			const float A = 190.f, B = 270.f, S0 = 210.f, Headway = 1.25f;
			const float Desired = S0 + FMath::Max(0.f, C.V * Headway + C.V * Closing / (2.f * FMath::Sqrt(A * B)));
			float Acc = A * (1.f - FMath::Pow(C.V / C.Cruise, 4.f) - FMath::Square(Desired / FMath::Max(Gap, 40.f)));
			Acc = FMath::Clamp(Acc, -900.f, A);
			C.Accel = Acc;
		}
		for (int32 i = 0; i < L.Cars.Num(); ++i)
		{
			FCar& C = L.Cars[i];
			const float NewV = FMath::Max(0.f, C.V + C.Accel * Dt);
			C.S += (C.V + NewV) * 0.5f * Dt;
			C.V = NewV;
		}
		while (L.Cars.Num() && L.Cars[0].S > L.Length) L.Cars.RemoveAt(0);
		if (Time >= L.NextSpawn)
		{
			if (!L.Cars.Num() || L.Cars.Last().S > 1500.f)
			{
				Spawn(L, 100.f, Time);
				L.NextSpawn = Time + FMath::Max(1.6f, -FMath::Loge(FMath::Max(L.Rng.FRand(), 0.02f)) * L.Headway / FMath::Max(Density, 0.05f));
			}
			else
			{
				L.NextSpawn = Time + 1.0;
			}
		}
	}
}

int32 ANYCTraffic::WheelSetFor(UStaticMesh* Mesh)
{
	if (!Mesh) return -1;
	for (int32 i = 0; i < WheelISM.Num(); ++i)
		if (WheelISM[i]->GetStaticMesh() == Mesh) return i;
	UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
	C->SetMobility(EComponentMobility::Movable);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->bAffectDistanceFieldLighting = false;
	C->SetHasPerInstancePrevTransforms(true);
	C->SetupAttachment(Root);
	C->RegisterComponent();
	WheelXf.AddDefaulted();
	WheelPrev.AddDefaulted();
	return WheelISM.Add(C);
}

ANYCTraffic::FVisual* ANYCTraffic::AcquireVisual(int32 Type, int64 Key)
{
	if (!Pools.IsValidIndex(Type)) return nullptr;
	TArray<FVisual>& Pool = Pools[Type];
	for (FVisual& V : Pool)
	{
		if (V.Owner == Key) return &V;
	}
	for (FVisual& V : Pool)
	{
		if (V.Owner == -1) { V.Owner = Key; return &V; }
	}
	const FNYCVehicleType& T = Types[Type];
	auto MakeMesh = [this](UStaticMesh* M, USceneComponent* Parent)
	{
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(M);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->bAffectDistanceFieldLighting = false;
		C->SetupAttachment(Parent);
		C->RegisterComponent();
		AllVisualComponents.Add(C);
		return C;
	};
	FVisual V;
	V.Type = Type;
	V.Owner = Key;
	V.Body = MakeMesh(T.Body, Root);
	V.WheelSet = WheelSetFor(T.Wheel);
	if (V.WheelSet >= 0)
	{
		const FTransform Parked(FQuat::Identity, FVector(0, 0, -100000), FVector(0.001));
		for (int32 w = 0; w < T.Wheels.Num(); ++w)
		{
			V.Wheels.Add(WheelISM[V.WheelSet]->AddInstance(Parked, true));
			WheelXf[V.WheelSet].Add(Parked);
		}
	}
	if (SprayMesh)
	{
		// not a child of the body: a child is moved with its parent even while hidden
		V.Spray = MakeMesh(SprayMesh, Root);
		V.Spray->SetVisibility(false);
		V.Spray->SetRelativeScale3D(FVector(1.f, T.Kind >= 4 ? 1.5f : 1.f, T.Kind >= 4 ? 1.7f : 1.f));
		V.Spray->CastShadow = false;
		V.Spray->bVisibleInRayTracing = false;
		V.Spray->BoundsScale = 3.f;
	}
	Pool.Add(MoveTemp(V));
	return &Pool.Last();
}

void ANYCTraffic::UpdateVehicles(double Time, const FVector& Cam, int32 Shot, float ShotTime, float Darkness, float Wet, float Rain, float Snow)
{
	Draw.Reset();
	FxLights.Reset();
	const float Alpha = FMath::Clamp((float)((Time - (SimClock - SimDt)) / SimDt), 0.f, 1.f);
	const bool bFilm = Weather && Weather->bExternalClock;

	for (const FLane& L : Lanes)
	{
		const float Yaw = FMath::RadiansToDegrees(FMath::Atan2(L.Dir.Y, L.Dir.X));
		for (const FCar& C : L.Cars)
		{
			const float S = FMath::Lerp(C.PrevS, C.S, Alpha);
			const FVector2D P = L.P0 + L.Dir * S;
			const float Dist = FVector::Dist(FVector(P.X, P.Y, 0), Cam);
			if (Dist > MaxDrawDistance) continue;
			if (bFilm)
			{
				bool bCleared = false;
				for (const FNYCClearZone& Z : ClearZones)
				{
					if (Z.Shot == Shot && P.X > Z.Min.X && P.X < Z.Max.X && P.Y > Z.Min.Y && P.Y < Z.Max.Y) { bCleared = true; break; }
				}
				if (bCleared) continue;
			}
			if (Gone.Contains((int64)C.Id)) continue;
			const float V = FMath::Lerp(C.PrevV, C.V, Alpha);
			Draw.Add({ (int64)C.Id, C.Type, FVector(P.X, P.Y, 0.2f), Yaw, V, S, C.Accel < -70.f || V < 40.f, C.bHazard && V < 30.f, C.Color, Dist });
		}
	}

	if (bFilm)
	{
		for (int32 h = 0; h < HeroCars.Num(); ++h)
		{
			const FNYCHeroCar& H = HeroCars[h];
			if (H.Shot != Shot || H.Keys.Num() == 0 || Gone.Contains((int64)(1000000 + h))) continue;
			int32 Type = 0;
			for (int32 i = 0; i < Types.Num(); ++i) if (Types[i].Name == H.TypeName) { Type = i; break; }
			// Catmull-Rom through the keys so a braking car eases to its stop
			auto Eval = [&H](float T)
			{
				const int32 N = H.Keys.Num();
				if (T <= H.Keys[0].X) return H.Keys[0];
				if (T >= H.Keys[N - 1].X) return H.Keys[N - 1];
				int32 i = 0;
				while (i + 1 < N && H.Keys[i + 1].X < T) ++i;
				const FVector4& P1 = H.Keys[i];
				const FVector4& P2 = H.Keys[i + 1];
				const FVector4& P0 = H.Keys[FMath::Max(i - 1, 0)];
				const FVector4& P3 = H.Keys[FMath::Min(i + 2, N - 1)];
				const float D = P2.X - P1.X;
				const float U = (T - P1.X) / D;
				FVector4 Out(T, 0, 0, 0);
				for (int32 c = 1; c < 4; ++c)
				{
					// monotone Hermite: flat tangents wherever the value stops changing
					auto Slope = [](double a, double b, double c2, double ta, double tb, double tc)
					{
						const double s0 = tb > ta ? (b - a) / (tb - ta) : 0.0;
						const double s1 = tc > tb ? (c2 - b) / (tc - tb) : 0.0;
						if (s0 * s1 <= 0.0) return (tb <= ta) ? s1 : (tc <= tb ? s0 : 0.0);
						return 2.0 * s0 * s1 / (s0 + s1);
					};
					const double M1 = Slope(P0[c], P1[c], P2[c], P0.X, P1.X, P2.X) * D;
					const double M2 = Slope(P1[c], P2[c], P3[c], P1.X, P2.X, P3.X) * D;
					const double U2 = U * U, U3 = U2 * U;
					Out[c] = (2 * U3 - 3 * U2 + 1) * P1[c] + (U3 - 2 * U2 + U) * M1 + (-2 * U3 + 3 * U2) * P2[c] + (U3 - U2) * M2;
				}
				return Out;
			};
			const FVector4 Now = Eval(ShotTime);
			const FVector4 Before = Eval(ShotTime - 0.1f);
			const FVector4 Earlier = Eval(ShotTime - 0.2f);
			const float V = FVector2D::Distance(FVector2D(Now.Y, Now.Z), FVector2D(Before.Y, Before.Z)) / 0.1f;
			const float V0 = FVector2D::Distance(FVector2D(Before.Y, Before.Z), FVector2D(Earlier.Y, Earlier.Z)) / 0.1f;
			const FVector Fwd = FRotator(0, Now.W, 0).Vector();
			const float Travel = FVector::DotProduct(FVector(Now.Y, Now.Z, 0), Fwd);
			const float Dist = FVector::Dist(FVector(Now.Y, Now.Z, 0), Cam);
			Draw.Add({ (int64)(1000000 + h), Type, FVector(Now.Y, Now.Z, 0.2f), (float)Now.W, V, Travel, V - V0 < -4.f || V < 40.f, false, H.Color, Dist });
		}
	}

	Draw.Sort([](const FDrawCar& A, const FDrawCar& B) { return A.Dist < B.Dist; });

	TMap<int64, int32> Wanted;
	for (int32 i = 0; i < Draw.Num(); ++i) Wanted.Add(Draw[i].Key, i);
	for (TArray<FVisual>& Pool : Pools)
	{
		for (FVisual& V : Pool)
		{
			if (V.Owner != -1 && !Wanted.Contains(V.Owner))
			{
				V.Owner = -1;
				V.Body->SetVisibility(false, true);
				if (V.Spray) V.Spray->SetVisibility(false);
			}
		}
	}

	const FTransform Parked(FQuat::Identity, FVector(0, 0, -100000), FVector(0.001));
	WheelPrev = WheelXf;
	for (TArray<FTransform>& List : WheelXf)
		for (FTransform& X : List) X = Parked;
	const bool bHeads = Darkness > 0.34f || Rain > 0.25f || Snow > 0.25f;
	const float Blink = FMath::Fmod(Time, 1.0) < 0.5 ? 1.f : 0.f;
	int32 HeadUsed = 0, TailUsed = 0;
	for (const FDrawCar& D : Draw)
	{
		FVisual* V = AcquireVisual(D.Type, D.Key);
		if (!V) continue;
		const FNYCVehicleType& T = Types[D.Type];
		if (!V->Body->IsVisible()) V->Body->SetVisibility(true, true);
		V->Body->SetWorldLocationAndRotation(D.Pos, FRotator(0.f, D.Yaw, 0.f), false, nullptr, ETeleportType::None);
		const float Spin = FMath::Fmod(D.Travel / FMath::Max(T.WheelRadius, 1.f), 2.f * PI);
		// a wheel more than 300 m off is smaller than a pixel of tyre: leave it parked
		if (V->WheelSet >= 0 && D.Dist < 30000.f)
		{
			const FTransform Car(FRotator(0.f, D.Yaw, 0.f), D.Pos);
			const FQuat Turn(FVector(0, 1, 0), Spin);
			for (int32 w = 0; w < V->Wheels.Num(); ++w)
			{
				const bool bLeft = T.Wheels[w].Z < 0.f;
				const FQuat Flip = bLeft ? FQuat(FVector(0, 0, 1), PI) : FQuat::Identity;
				WheelXf[V->WheelSet][V->Wheels[w]] = FTransform(Turn * Flip, FVector(T.Wheels[w].X, T.Wheels[w].Y, T.WheelRadius)) * Car;
			}
		}
		const float SnowOnCar = FMath::Clamp(0.12f + (D.Speed < 50.f ? 0.18f : 0.f), 0.f, 1.f);
		const float Data[8] = { D.Color.R, D.Color.G, D.Color.B, bHeads ? 1.f : 0.f, D.bBrake ? 1.f : 0.f, D.bHazard ? Blink : 0.f, 0.f, SnowOnCar };
		for (int32 k = 0; k < 8; ++k)
		{
			if (!FMath::IsNearlyEqual(V->Data[k], Data[k], 0.001f))
			{
				V->Data[k] = Data[k];
				V->Body->SetCustomPrimitiveDataFloat(k, Data[k]);
			}
		}
		if (V->Spray)
		{
			const float Amount = FMath::Clamp(Wet * (0.35f + Rain) * (D.Speed - 250.f) / 700.f, 0.f, 1.f);
			const bool bOn = Amount > 0.03f && D.Dist < 12000.f;
			V->Spray->SetVisibility(bOn);
			if (bOn)
			{
				const FTransform Car(FRotator(0.f, D.Yaw, 0.f), D.Pos);
				V->Spray->SetWorldLocationAndRotation(Car.TransformPosition(FVector(-T.Length * 0.5f, 0.f, 0.f)), Car.GetRotation());
				V->Spray->SetCustomPrimitiveDataFloat(0, Amount);
				V->Spray->SetCustomPrimitiveDataFloat(1, D.Speed);
			}
		}

		const FTransform Xf(FRotator(0.f, D.Yaw, 0.f), D.Pos);
		const FVector Fwd = Xf.GetUnitAxis(EAxis::X);
		if (bHeads)
		{
			const bool bPair = D.Dist < 7500.f;
			if (D.Dist < 45000.f)
			{
				const int32 N = bPair ? 2 : 1;
				for (int32 k = 0; k < N && HeadUsed < HeadPool.Num(); ++k)
				{
					FVector Local = T.HeadLamp;
					Local.Y = bPair ? (k == 0 ? Local.Y : -Local.Y) : 0.f;
					Local.X += 14.f;
					USpotLightComponent* S = HeadPool[HeadUsed++];
					const FVector Pos = Xf.TransformPosition(Local);
					const FVector Dir = (Fwd + FVector(0, 0, -0.13f)).GetSafeNormal();
					S->SetVisibility(true);
					S->SetWorldLocationAndRotation(Pos, Dir.Rotation());
					S->SetIntensity(bPair ? 1900.f : 3600.f);
					if (D.Dist < 5000.f) FxLights.Add({ Pos, Dir, FLinearColor(1.f, 0.9f, 0.76f), bPair ? 4200.f : 7600.f, 34.f });
				}
			}
		}
		if ((bHeads || D.bBrake) && D.Dist < 6000.f && TailUsed < TailPool.Num() && (Darkness > 0.25f || Wet > 0.4f))
		{
			const FVector Pos = Xf.TransformPosition(FVector(T.TailLamp.X - 24.f, 0.f, T.TailLamp.Z));
			UPointLightComponent* P = TailPool[TailUsed++];
			P->SetVisibility(true);
			P->SetWorldLocation(Pos);
			P->SetLightColor(FLinearColor(1.f, 0.015f, 0.006f));
			const float Cd = D.bBrake ? 42.f : (bHeads ? 8.f : 0.f);
			P->SetIntensity(Cd);
			if (D.bBrake && D.Dist < 4000.f) FxLights.Add({ Pos, -Fwd, FLinearColor(1.f, 0.03f, 0.01f), Cd * 3.f, 0.f });
		}
	}
	for (int32 i = HeadUsed; i < HeadPool.Num(); ++i) if (HeadPool[i]->IsVisible()) HeadPool[i]->SetVisibility(false);
	for (int32 i = TailUsed; i < TailPool.Num(); ++i) if (TailPool[i]->IsVisible()) TailPool[i]->SetVisibility(false);
	for (int32 k = 0; k < WheelISM.Num(); ++k)
	{
		if (WheelXf[k].Num() == 0) continue;
		// a wheel that has just appeared, left or jumped has no motion to smear
		WheelPrev[k].SetNum(WheelXf[k].Num());
		for (int32 i = 0; i < WheelXf[k].Num(); ++i)
		{
			if (FVector::DistSquared(WheelPrev[k][i].GetLocation(), WheelXf[k][i].GetLocation()) > FMath::Square(250.0) || WheelPrev[k][i].GetScale3D().X < 0.5)
				WheelPrev[k][i] = WheelXf[k][i];
		}
		WheelISM[k]->BatchUpdateInstancesTransforms(0, WheelXf[k], WheelPrev[k], true, false, false);
	}
}

void ANYCTraffic::UpdateSignals(double Time, const FVector& Cam)
{
	if (!LampISM || !PedFaceISM) return;
	bool bLampDirty = false, bFaceDirty = false;
	struct FNear { float D; int32 Index; };
	TArray<FNear> Lit;
	const double Green = Cycle - AveGreen - 2.0 * Yellow - 2.0 * AllRed;
	for (int32 i = 0; i < Lamps.Num(); ++i)
	{
		FLamp& L = Lamps[i];
		if (DeadLamps.Contains(i)) continue;
		if (L.Kind < 3)
		{
			const int32 State = SignalState(Time, L.Group, L.Offset);
			const int32 Wanted = (L.Kind == 0 && State == 0) || (L.Kind == 1 && State == 1) || (L.Kind == 2 && State == 2) ? 1 : 0;
			if (Wanted != L.State)
			{
				L.State = Wanted;
				static const FLinearColor Cols[3] = { FLinearColor(1.f, 0.012f, 0.006f), FLinearColor(1.f, 0.44f, 0.0f), FLinearColor(0.04f, 1.f, 0.46f) };
				const FLinearColor C = Cols[L.Kind];
				const float Data[4] = { C.R, C.G, C.B, Wanted ? (L.Kind == 2 ? 2300.f : 3200.f) : 0.f };
				LampISM->SetCustomData(L.Instance, MakeArrayView(Data, 4), false);
				bLampDirty = true;
			}
			if (Wanted)
			{
				const float D = FVector::DistSquared(L.Pos, Cam);
				if (D < FMath::Square(9000.f)) Lit.Add({ D, i });
			}
		}
		else
		{
			double P = FMath::Fmod(Time + L.Offset, (double)Cycle);
			if (P < 0) P += Cycle;
			// walk alongside the parallel green: the first seconds show the walker, then a countdown
			const double Start = L.Group == 0 ? 0.0 : AveGreen + Yellow + AllRed;
			const double Length = L.Group == 0 ? AveGreen : Green;
			const double In = P - Start;
			int32 State = 0, Count = 0;
			if (In >= 0 && In < Length)
			{
				const double Remain = Length - In;
				if (Remain > 13.0) State = 1;
				else
				{
					Count = FMath::Clamp((int32)FMath::CeilToInt(Remain) - 1, 0, 13);
					State = FMath::Fmod(Time, 1.0) < 0.65 ? 2 : 0;
				}
			}
			if (State != L.State || Count != L.Count)
			{
				L.State = State;
				L.Count = Count;
				const float Data[2] = { (float)State, (float)Count };
				PedFaceISM->SetCustomData(L.Instance, MakeArrayView(Data, 2), false);
				bFaceDirty = true;
			}
		}
	}
	if (bLampDirty) LampISM->MarkRenderInstancesDirty();
	if (bFaceDirty) PedFaceISM->MarkRenderInstancesDirty();

	Lit.Sort([](const FNear& A, const FNear& B) { return A.D < B.D; });
	const float Night = Weather ? Weather->GetDarkness() : 0.f;
	for (int32 i = 0; i < SignalPool.Num(); ++i)
	{
		UPointLightComponent* P = SignalPool[i];
		if (i < Lit.Num() && Night > 0.25f)
		{
			const FLamp& L = Lamps[Lit[i].Index];
			const FVector Out = FRotator(0.f, L.Yaw + 90.f, 0.f).Vector();
			P->SetVisibility(true);
			P->SetWorldLocation(L.Pos + Out * 28.f);
			P->SetLightColor(L.Kind == 0 ? FLinearColor(1.f, 0.02f, 0.01f) : (L.Kind == 1 ? FLinearColor(1.f, 0.45f, 0.f) : FLinearColor(0.05f, 1.f, 0.5f)));
			P->SetIntensity(38.f);
		}
		else if (P->IsVisible())
		{
			P->SetVisibility(false);
		}
	}
}

void ANYCTraffic::UpdatePeds(double Time, const FVector& Cam, int32 Shot, float Rain, float Snow)
{
	if (!Walkers) return;
	// pedestrians are posed by UNYCWalkerComponent (NYCWalkers.cpp)
	// hidden by destruction or the player's own switch; asking again for the same state does nothing
	Walkers->SetHidden(bNoPedestrians || bPedestriansOff, 1.2f);
	FNYCWalkerView View;
	View.Location = Cam;
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		if (PC->PlayerCameraManager)
		{
			View.Rotation = PC->PlayerCameraManager->GetCameraRotation();
			View.FovDegrees = PC->PlayerCameraManager->GetFOVAngle();
			View.bCull = true;
		}
	}
	FVector2D Size(2560.0, 1440.0);
	if (GEngine && GEngine->GameViewport) GEngine->GameViewport->GetViewportSize(Size);
	View.Aspect = Size.Y > 1.0 ? (float)(Size.X / Size.Y) : 16.f / 9.f;
	View.ResolutionY = (float)FMath::Max(Size.Y, 360.0);
	if (Weather && Weather->bExternalClock)
	{
		// Movie Render Queue output differs from the window: cull generously and keep 4K detail
		View.Aspect = 1.5f;
		View.ResolutionY = FMath::Max(View.ResolutionY, 2160.f);
	}
	Walkers->Update(Time, Shot, View, Rain, Snow, Weather ? Weather->Wind : 0.25f);
}

void ANYCTraffic::LogAudio(int32 Shot, double Time, float ShotTime, const FVector& Cam, const FRotator& CamRot)
{
	if (!bLogForAudio || !Weather || !Weather->bExternalClock) return;
	if (Shot != AudioShot) { FlushAudio(); AudioShot = Shot; LastAudioTime = -1.0e12; }
	if (Time - LastAudioTime < 0.04) return;
	LastAudioTime = Time;
	AudioLog += FString::Printf(TEXT("C,%.4f,%.1f,%.1f,%.1f,%.2f,%.2f\n"), ShotTime, Cam.X, Cam.Y, Cam.Z, CamRot.Yaw, CamRot.Pitch);
	int32 N = 0;
	for (const FDrawCar& D : Draw)
	{
		if (D.Dist > 9000.f || N >= 24) break;
		++N;
		const int32 Kind = Types.IsValidIndex(D.Type) ? Types[D.Type].Kind : 1;
		AudioLog += FString::Printf(TEXT("V,%.4f,%lld,%d,%.1f,%.1f,%.1f,%d\n"), ShotTime, D.Key, Kind, D.Pos.X, D.Pos.Y, D.Speed, D.bBrake ? 1 : 0);
	}
}

void ANYCTraffic::FlushAudio()
{
	if (AudioLog.Len() && AudioShot != -999)
	{
		const FString Path = FPaths::Combine(FPaths::ProjectSavedDir(), FString::Printf(TEXT("NYCAudio_%02d.csv"), AudioShot));
		FFileHelper::SaveStringToFile(AudioLog, *Path);
	}
	AudioLog.Reset();
}

void ANYCTraffic::GatherFxLights(const FVector& Near, TArray<FNYCFxLight>& Out) const
{
	Out.Append(FxLights);
}

void ANYCTraffic::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bLoaded || !Weather) return;
	const double Time = Weather->GetClock();
	if (Time < SimClock - 2.0 * SimDt || Time > SimClock + 20.0)
	{
		ResetSim(Time);
	}
	int32 Guard = 0;
	while (SimClock < Time && Guard++ < 6000)
	{
		SimClock += SimDt;
		StepSim(SimClock, SimDt);
	}

	FVector Cam = FVector::ZeroVector;
	FRotator CamRot = FRotator::ZeroRotator;
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		if (PC->PlayerCameraManager)
		{
			Cam = PC->PlayerCameraManager->GetCameraLocation();
			CamRot = PC->PlayerCameraManager->GetCameraRotation();
		}
	}
	const int32 Shot = Weather->ShotId;
	const float ShotTime = Weather->SimTime - Weather->ShotStart;
	UpdateVehicles(Time, Cam, Shot, ShotTime, Weather->GetDarkness(), Weather->Wetness, Weather->Rain, Weather->Snow);
	UpdateSignals(Time, Cam);
	UpdatePeds(Time, Cam, Shot, Weather->Rain, Weather->Snow);
	LogAudio(Shot, Time, ShotTime, Cam, CamRot);
}

// ------------------------------------------------------------------ destruction hooks
void ANYCTraffic::CollectCars(const FVector& Centre, float Radius, TArray<FNYCCarInfo>& Out) const
{
	for (const FDrawCar& D : Draw)
	{
		if (Gone.Contains(D.Key) || !Types.IsValidIndex(D.Type) || FVector::DistSquared2D(D.Pos, Centre) > (double)Radius * Radius) continue;
		const FNYCVehicleType& T = Types[D.Type];
		if (!T.Body) continue;
		FNYCCarInfo C;
		C.Key = D.Key;
		C.Mesh = T.Body->GetName();
		C.WheelMesh = T.Wheel ? T.Wheel->GetName() : FString();
		C.Xf = FTransform(FRotator(0.f, D.Yaw, 0.f), D.Pos);
		for (const FVector& W : T.Wheels)
		{
			C.Wheels.Add(FTransform(W.Z < 0.f ? FQuat(FVector(0, 0, 1), PI) : FQuat::Identity, FVector(W.X, W.Y, T.WheelRadius)));
		}
		C.Color = D.Color;
		C.Speed = D.Speed;
		Out.Add(MoveTemp(C));
	}
}

void ANYCTraffic::RemoveCar(int64 Key)
{
	Gone.Add(Key);
	for (FLane& L : Lanes)
	{
		for (int32 i = L.Cars.Num() - 1; i >= 0; --i)
		{
			if ((int64)L.Cars[i].Id == Key) L.Cars.RemoveAt(i);
		}
	}
	for (TArray<FVisual>& Pool : Pools)
	{
		for (FVisual& V : Pool)
		{
			if (V.Owner == Key)
			{
				V.Owner = -1;
				if (V.Body) V.Body->SetVisibility(false, true);
				if (V.Spray) V.Spray->SetVisibility(false);
				if (V.WheelSet >= 0)
				{
					for (const int32 w : V.Wheels)
						WheelISM[V.WheelSet]->UpdateInstanceTransform(w, FTransform(FQuat::Identity, FVector(0, 0, -100000), FVector(0.001)), true, true, true);
				}
			}
		}
	}
}

void ANYCTraffic::AddObstacle(const FVector& Centre, float Radius)
{
	if (Walkers) Walkers->AddObstacle(Centre, Radius);
	for (FSphere& O : Obstacles)
	{
		if (FVector::Dist2D(O.Center, Centre) < O.W * 0.6)
		{
			O.W = FMath::Max<double>(O.W, Radius);
			return;
		}
	}
	if (Obstacles.Num() < 64) Obstacles.Add(FSphere(Centre, Radius));
}

void ANYCTraffic::RemoveSignals(const FVector& Centre, float Radius)
{
	for (int32 i = 0; i < Lamps.Num(); ++i)
	{
		const FLamp& L = Lamps[i];
		if (DeadLamps.Contains(i) || FVector::DistSquared2D(L.Pos, Centre) > (double)Radius * Radius) continue;
		DeadLamps.Add(i);
		UInstancedStaticMeshComponent* C = L.Kind == 3 ? PedFaceISM : LampISM;
		if (C) C->UpdateInstanceTransform(L.Instance, FTransform(FRotator(0.f, L.Yaw, 0.f), L.Pos - FVector(0, 0, 100000), FVector(0.001)), true, true, true);
	}
}

void ANYCTraffic::SetPedestriansHidden(bool bHide)
{
	FadePedestrians(bHide, 1.6f);
}

void ANYCTraffic::FadePedestrians(bool bHide, float Seconds)
{
	bNoPedestrians = bHide;
	if (Walkers) Walkers->SetHidden(bHide, Seconds);
}

void ANYCTraffic::ClearDestruction()
{
	if (Walkers) Walkers->Reset();
	for (int32 i : DeadLamps)
	{
		if (!Lamps.IsValidIndex(i)) continue;
		const FLamp& L = Lamps[i];
		UInstancedStaticMeshComponent* C = L.Kind == 3 ? PedFaceISM : LampISM;
		if (C) C->UpdateInstanceTransform(L.Instance, FTransform(FRotator(0.f, L.Yaw, 0.f), L.Pos), true, true, true);
	}
	DeadLamps.Reset();
	Gone.Reset();
	Obstacles.Reset();
	bNoPedestrians = false;
	SimClock = -1.0e12;
}
