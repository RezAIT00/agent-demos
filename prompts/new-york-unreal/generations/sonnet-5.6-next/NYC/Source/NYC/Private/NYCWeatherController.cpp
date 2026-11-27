#include "NYCWeatherController.h"
#include "NYC.h"
#include "NYCLightField.h"
#include "NYCTraffic.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/VolumetricCloudComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PostProcessComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "ProceduralMeshComponent.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialParameterCollection.h"
#include "Materials/MaterialParameterCollectionInstance.h"
#if WITH_EDITOR
#include "LevelEditorViewport.h"
#endif

namespace
{
	constexpr double Latitude = 40.7536;
	constexpr double Longitude = -73.9813;
	constexpr double GridBearing = 29.0;   // true bearing of "uptown"
	constexpr int32 NumFxLights = 16;

	/** Piecewise-linear lookup over (x, y) pairs sorted by x. */
	float Curve(float X, std::initializer_list<TPair<float, float>> Pts)
	{
		const TPair<float, float>* Prev = nullptr;
		for (const TPair<float, float>& P : Pts)
		{
			if (X <= P.Key)
			{
				if (!Prev) return P.Value;
				return FMath::Lerp(Prev->Value, P.Value, (X - Prev->Key) / (P.Key - Prev->Key));
			}
			Prev = &P;
		}
		return Prev ? Prev->Value : 0.f;
	}

	float Smooth(float A, float B, float X)
	{
		const float T = FMath::Clamp((X - A) / (B - A), 0.f, 1.f);
		return T * T * (3.f - 2.f * T);
	}

	FLinearColor Mix(const FLinearColor& A, const FLinearColor& B, float T)
	{
		return FLinearColor(FMath::Lerp(A.R, B.R, T), FMath::Lerp(A.G, B.G, T), FMath::Lerp(A.B, B.B, T), 1.f);
	}
}

ANYCWeatherController::ANYCWeatherController()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PostUpdateWork;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Root->SetMobility(EComponentMobility::Movable);

	auto SetupSun = [this](UDirectionalLightComponent* L)
	{
		L->SetupAttachment(Root);
		L->SetMobility(EComponentMobility::Movable);
	};

	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	SetupSun(Sun);
	Sun->bAtmosphereSunLight = true;
	Sun->AtmosphereSunLightIndex = 0;
	Sun->bPerPixelAtmosphereTransmittance = true;
	Sun->Intensity = 100000.f;
	Sun->LightSourceAngle = 0.5357f;
	Sun->ForwardShadingPriority = 1;
	Sun->DynamicShadowDistanceMovableLight = 40000.f;
	Sun->ContactShadowLength = 32.f;
	Sun->ContactShadowLengthInWS = true;

	Moon = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Moon"));
	SetupSun(Moon);
	Moon->bAtmosphereSunLight = false;
	Moon->Intensity = 0.0f;
	Moon->LightColor = FColor(176, 196, 255);
	Moon->CastShadows = true;

	FlashLight = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("LightningLight"));
	SetupSun(FlashLight);
	FlashLight->bAtmosphereSunLight = false;
	FlashLight->Intensity = 0.0f;
	FlashLight->LightColor = FColor(206, 212, 255);
	FlashLight->LightSourceAngle = 1.5f;

	Atmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("SkyAtmosphere"));
	Atmosphere->SetupAttachment(Root);

	SkyLight = CreateDefaultSubobject<USkyLightComponent>(TEXT("SkyLight"));
	SkyLight->SetupAttachment(Root);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->bRealTimeCapture = true;
	SkyLight->bLowerHemisphereIsBlack = true;
	SkyLight->SetRelativeLocation(FVector(0, 0, 60000));

	Clouds = CreateDefaultSubobject<UVolumetricCloudComponent>(TEXT("Clouds"));
	Clouds->SetupAttachment(Root);

	HeightFog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("HeightFog"));
	HeightFog->SetupAttachment(Root);
	HeightFog->bEnableVolumetricFog = true;

	PostProcess = CreateDefaultSubobject<UPostProcessComponent>(TEXT("PostProcess"));
	PostProcess->SetupAttachment(Root);
	PostProcess->bUnbound = true;

	auto MakeFx = [this](const TCHAR* Name)
	{
		UStaticMeshComponent* C = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		C->SetupAttachment(Root);
		C->SetMobility(EComponentMobility::Movable);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->CastShadow = false;
		C->bVisibleInRayTracing = false;
		C->bAffectDistanceFieldLighting = false;
		C->bAffectDynamicIndirectLighting = false;
		C->BoundsScale = 50.f;
		C->SetVisibility(false);
		return C;
	};
	RainComp = MakeFx(TEXT("Rain"));
	SnowComp = MakeFx(TEXT("Snow"));
	SplashComp = MakeFx(TEXT("Splashes"));
	DripComp = MakeFx(TEXT("Drips"));
	DripComp->BoundsScale = 1.f;

	Bolt = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("LightningBolt"));
	Bolt->SetupAttachment(Root);
	Bolt->SetUsingAbsoluteLocation(true);
	Bolt->CastShadow = false;
	Bolt->SetVisibility(false);
	Bolt->bVisibleInRayTracing = false;

	BoltLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("BoltGlow"));
	BoltLight->SetupAttachment(Root);
	BoltLight->SetMobility(EComponentMobility::Movable);
	BoltLight->SetUsingAbsoluteLocation(true);
	BoltLight->IntensityUnits = ELightUnits::Candelas;
	BoltLight->Intensity = 0.f;
	BoltLight->AttenuationRadius = 150000.f;
	BoltLight->LightColor = FColor(190, 196, 255);
	BoltLight->CastShadows = false;
	BoltLight->SetVisibility(false);
}

void ANYCWeatherController::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	CloudMID = nullptr;
	BoltMID = nullptr;
	ApplyWeather();
}

void ANYCWeatherController::BeginPlay()
{
	Super::BeginPlay();
	FindPeers();
	ApplyWeather();
}

void ANYCWeatherController::FindPeers()
{
	if (!GetWorld()) return;
	if (!IsValid(LightField))
	{
		LightField = nullptr;
		for (TActorIterator<ANYCLightField> It(GetWorld()); It; ++It) { LightField = *It; break; }
	}
	if (!IsValid(Traffic))
	{
		Traffic = nullptr;
		for (TActorIterator<ANYCTraffic> It(GetWorld()); It; ++It) { Traffic = *It; break; }
	}
}

bool ANYCWeatherController::GetViewCamera(FVector& OutPos, FVector& OutDir) const
{
	const UWorld* W = GetWorld();
	if (!W) return false;
	if (W->IsGameWorld())
	{
		if (const APlayerController* PC = W->GetFirstPlayerController())
		{
			if (PC->PlayerCameraManager)
			{
				OutPos = PC->PlayerCameraManager->GetCameraLocation();
				OutDir = PC->PlayerCameraManager->GetCameraRotation().Vector();
				return true;
			}
		}
		return false;
	}
#if WITH_EDITOR
	if (GCurrentLevelEditingViewportClient)
	{
		OutPos = GCurrentLevelEditingViewportClient->GetViewLocation();
		OutDir = GCurrentLevelEditingViewportClient->GetViewRotation().Vector();
		return true;
	}
#endif
	return false;
}

FVector2D ANYCWeatherController::SolarPosition(float Hours) const
{
	static const int32 Cum[] = { 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 };
	const int32 N = Cum[FMath::Clamp(Month, 1, 12) - 1] + Day;
	const double G = 2.0 * PI / 365.0 * (N - 1 + (Hours - 12.0) / 24.0);
	const double EqTime = 229.18 * (0.000075 + 0.001868 * FMath::Cos(G) - 0.032077 * FMath::Sin(G)
		- 0.014615 * FMath::Cos(2 * G) - 0.040849 * FMath::Sin(2 * G));
	const double Decl = 0.006918 - 0.399912 * FMath::Cos(G) + 0.070257 * FMath::Sin(G) - 0.006758 * FMath::Cos(2 * G)
		+ 0.000907 * FMath::Sin(2 * G) - 0.002697 * FMath::Cos(3 * G) + 0.00148 * FMath::Sin(3 * G);
	const double Tz = -5.0; // EST
	const double Tst = Hours * 60.0 + EqTime + 4.0 * Longitude - 60.0 * Tz;
	const double Ha = FMath::DegreesToRadians(Tst / 4.0 - 180.0);
	const double Lat = FMath::DegreesToRadians(Latitude);
	const double CosZ = FMath::Clamp(FMath::Sin(Lat) * FMath::Sin(Decl) + FMath::Cos(Lat) * FMath::Cos(Decl) * FMath::Cos(Ha), -1.0, 1.0);
	double El = 90.0 - FMath::RadiansToDegrees(FMath::Acos(CosZ));
	const double Az = FMath::Fmod(FMath::RadiansToDegrees(FMath::Atan2(FMath::Sin(Ha),
		FMath::Cos(Ha) * FMath::Sin(Lat) - FMath::Tan(Decl) * FMath::Cos(Lat))) + 180.0 + 360.0, 360.0);
	// atmospheric refraction lifts the sun near the horizon
	if (El > -1.0) El += 0.0167 / FMath::Tan(FMath::DegreesToRadians(El + 10.3 / (El + 5.11)));
	return FVector2D(El, Az);
}

FNYCWeather ANYCWeatherController::Capture() const
{
	FNYCWeather W;
	W.TimeOfDay = TimeOfDay; W.CloudCover = CloudCover; W.Storm = Storm; W.Rain = Rain; W.Snow = Snow;
	W.Fog = Fog; W.Wind = Wind; W.LightningPerMinute = LightningPerMinute;
	return W;
}

void ANYCWeatherController::TransitionTo(const FNYCWeather& Target, float Seconds)
{
	BlendFrom = Capture();
	BlendTo = Target;
	BlendT = 0.f;
	BlendDuration = FMath::Max(Seconds, 0.05f);
	bBlending = true;
}

void ANYCWeatherController::TriggerLightning()
{
	// Never closer than 1.3 s to the previous one, so flashes stay well under 3 per second.
	if (LiveStrikes.Num() && SimTime - LiveStrikes.Last().Time < 1.3f) return;
	FNYCStrike S;
	FRandomStream R(FMath::Rand());
	const FVector Ahead = CamPos + FVector(CamDir.X, CamDir.Y, 0).GetSafeNormal() * R.FRandRange(30000.f, 140000.f);
	S.To = FVector(Ahead.X + R.FRandRange(-40000.f, 40000.f), Ahead.Y + R.FRandRange(-40000.f, 40000.f), R.FRandRange(6000.f, 26000.f));
	S.From = S.To + FVector(R.FRandRange(-20000.f, 20000.f), R.FRandRange(-20000.f, 20000.f), 80000.f);
	S.Time = SimTime;
	S.Seed = R.RandRange(1, 100000);
	S.Power = R.FRandRange(0.5f, 1.2f);
	S.bVisibleBolt = R.FRand() < 0.6f;
	LiveStrikes.Add(S);
	if (LiveStrikes.Num() > 8) LiveStrikes.RemoveAt(0);
}

void ANYCWeatherController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const bool bGame = GetWorld() && GetWorld()->IsGameWorld();
	if (!bExternalClock)
	{
		SimTime += DeltaSeconds;
	}
	if (bBlending)
	{
		BlendT += DeltaSeconds / BlendDuration;
		const float A = Smooth(0.f, 1.f, BlendT);
		float T0 = BlendFrom.TimeOfDay, T1 = BlendTo.TimeOfDay;
		if (T1 - T0 > 12.f) T1 -= 24.f;
		if (T0 - T1 > 12.f) T1 += 24.f;
		TimeOfDay = FMath::Fmod(FMath::Lerp(T0, T1, A) + 24.f, 24.f);
		CloudCover = FMath::Lerp(BlendFrom.CloudCover, BlendTo.CloudCover, A);
		Storm = FMath::Lerp(BlendFrom.Storm, BlendTo.Storm, A);
		Rain = FMath::Lerp(BlendFrom.Rain, BlendTo.Rain, A);
		Snow = FMath::Lerp(BlendFrom.Snow, BlendTo.Snow, A);
		Fog = FMath::Lerp(BlendFrom.Fog, BlendTo.Fog, A);
		Wind = FMath::Lerp(BlendFrom.Wind, BlendTo.Wind, A);
		LightningPerMinute = FMath::Lerp(BlendFrom.LightningPerMinute, BlendTo.LightningPerMinute, A);
		bBlending = BlendT < 1.f;
	}
	if (bGame && !bExternalClock)
	{
		// streets get wet and dry, puddles grow and drain, snow builds up and melts
		const float Dt = DeltaSeconds;
		Wetness = FMath::Clamp(Wetness + Dt * (Rain > 0.03f ? (0.4f + Rain) / 22.f : -1.f / 110.f), 0.f, 1.f);
		Puddles = FMath::Clamp(Puddles + Dt * (Rain > 0.15f ? Rain / 40.f : -1.f / 220.f), 0.f, 1.f);
		const float Melt = (Rain > 0.1f ? Rain / 18.f : 0.f) + (SolarPosition(TimeOfDay).X > 12.f && CloudCover < 0.5f && Snow < 0.05f ? 1.f / 240.f : 0.f);
		SnowCover = FMath::Clamp(SnowCover + Dt * (Snow / 38.f - Melt), 0.f, 1.f);
		if (Melt > 0.f && SnowCover > 0.02f) Wetness = FMath::Max(Wetness, 0.6f);
		if (LightningPerMinute > 0.1f && SimTime >= NextRandomStrike)
		{
			TriggerLightning();
			NextRandomStrike = SimTime + FMath::Max(1.4f, -FMath::Loge(FMath::Max(FMath::FRand(), 0.02f)) * 60.f / LightningPerMinute);
		}
	}
	ApplyWeather();
}

void ANYCWeatherController::ApplyWeather()
{
	if (!GetWorld() || IsTemplate()) return;
	FindPeers();
	FVector P, D;
	if (GetViewCamera(P, D)) { CamPos = P; CamDir = D; }
	UpdateLightning();
	UpdateSunAndSky();
	UpdateExposure();
	UpdatePrecipitation();
	UpdateCollection();
}

void ANYCWeatherController::UpdateSunAndSky()
{
	const FVector2D Solar = SolarPosition(TimeOfDay);
	const float El = Solar.X;
	const float GridAz = FMath::DegreesToRadians(Solar.Y - GridBearing);
	const float ElR = FMath::DegreesToRadians(El);
	SunDir = FVector(FMath::Cos(ElR) * FMath::Cos(GridAz), FMath::Cos(ElR) * FMath::Sin(GridAz), FMath::Sin(ElR));

	const float Overcast = FMath::Max(Smooth(0.55f, 0.95f, CloudCover), FMath::Max(Storm, Fog * 0.9f));
	const float SunUp = Smooth(-3.5f, 0.4f, El);
	// darkness drives city lights: night, or a heavy storm in daytime
	Darkness = FMath::Clamp(FMath::Max(1.f - Smooth(-5.f, 6.f, El), Storm * 0.55f + Overcast * 0.18f + Fog * 0.1f), 0.f, 1.f);

	Sun->SetWorldRotation((-SunDir).Rotation());
	const float SunThrough = FMath::Lerp(1.f, 0.012f, FMath::Pow(Overcast, 1.2f)) * (1.f - Snow * 0.5f);
	Sun->SetIntensity(127000.f * SunThrough * Smooth(-6.f, -1.f, El));
	Sun->SetVisibility(El > -7.f);
	Sun->SetVolumetricScatteringIntensity(1.0f);

	const FVector MoonDir = FRotator(34.f, 128.f, 0.f).Vector();
	Moon->SetWorldRotation((-MoonDir).Rotation());
	const float NightF = 1.f - Smooth(-9.f, -3.f, El);
	Moon->SetIntensity(0.35f * NightF * (1.f - Overcast));
	Moon->SetVisibility(NightF > 0.01f);

	// haze: more aerosol in rain, snow and fog
	const float Haze = (0.72f + Rain * 2.0f + Snow * 2.5f + Fog * 3.f) * HazeScale;
	Atmosphere->SetMieScatteringScale(0.0045f * Haze);
	Atmosphere->SetMieAnisotropy(0.78f);
	Atmosphere->SetAerialPespectiveViewDistanceScale(FMath::Lerp(1.4f, 2.6f, FMath::Clamp(Fog + Snow, 0.f, 1.f)));

	// ---- overcast and night sky luminance (cd/m2) -------------------------------------------
	const float ClearLum = Curve(El, { {-12.f, 0.004f}, {-8.f, 0.8f}, {-5.f, 18.f}, {-2.f, 170.f}, {0.f, 480.f}, {3.f, 1400.f}, {10.f, 3600.f}, {30.f, 5200.f} });
	const float OvercastLum = ClearLum * FMath::Lerp(0.95f, 0.42f, Storm);
	// the city lights the underside of cloud, mist and falling snow
	const float GlowLum = (0.22f + 0.5f * CloudCover + 0.85f * Fog + 0.7f * Snow + 0.1f * Rain + 0.25f * SnowCover) * (1.f - 0.35f * Storm);
	const float CityGlow = GlowLum * Smooth(4.f, -7.f, El);

	// height fog: ground haze, rain and snow murk
	const float Density = (0.0015f + 0.0036f * Rain + 0.011f * Snow + 0.019f * Fog + 0.0016f * Storm) * HazeScale;
	HeightFog->SetFogDensity(Density);
	float CutoffKm = FMath::Max(FogCutoffKm, 0.f);
	// flying high in clear air in the running game: keep the height fog off the sky (past every building and shore)
	if (CutoffKm <= 0.f && !bExternalClock && GetWorld() && GetWorld()->IsGameWorld() && CamPos.Z > 14000.0 && Fog < 0.35f && Rain < 0.3f && Snow < 0.3f) CutoffKm = 80.f;
	HeightFog->SetFogCutoffDistance(CutoffKm * 100000.f);
	// at night the glow has to fill the band above the horizon, so the haze reaches higher
	const float NightAir = Smooth(2.f, -7.f, El);
	HeightFog->SetFogHeightFalloff(FMath::Lerp(FMath::Lerp(0.085f, 0.03f, FMath::Clamp(Fog + Snow * 0.6f + Rain * 0.4f, 0.f, 1.f)), 0.018f, NightAir));
	HeightFog->SetStartDistance(0.f);
	// a thin, tall second layer carries the city's glow out to the horizon after dark
	HeightFog->SetSecondFogDensity((0.00075f + 0.0007f * FMath::Max(Fog, Snow)) * NightAir);
	HeightFog->SetSecondFogHeightFalloff(0.0035f);
	HeightFog->SetSecondFogHeightOffset(0.f);

	const FLinearColor DayHaze(0.55f, 0.66f, 0.82f);
	const FLinearColor GreyHaze(0.62f, 0.66f, 0.72f);
	const FLinearColor DuskHaze(0.80f, 0.55f, 0.42f);
	const FLinearColor NightHaze(1.0f, 0.66f, 0.46f);
	const FLinearColor SnowNight(1.0f, 0.72f, 0.58f);
	const float Dusk = Smooth(12.f, 1.5f, El) * Smooth(-6.f, 0.f, El);
	FLinearColor HazeCol = Mix(DayHaze, GreyHaze, Overcast);
	HazeCol = Mix(HazeCol, DuskHaze, Dusk * (1.f - Overcast * 0.8f));
	const float HazeLum = FMath::Lerp(ClearLum * 0.75f, OvercastLum * 0.85f, Overcast);
	const FLinearColor NightCol = Mix(NightHaze, SnowNight, Snow) * (CityGlow * 0.85f);
	const FLinearColor FogLum = HazeCol * HazeLum + NightCol;
	HeightFog->SetFogInscatteringColor(FogLum);
	HeightFog->SetDirectionalInscatteringColor(FLinearColor(1.f, 0.66f, 0.38f) * (Dusk * SunThrough * 520.f));
	HeightFog->SetDirectionalInscatteringExponent(10.f);
	HeightFog->SkyAtmosphereAmbientContributionColorScale = FLinearColor(0.f, 0.f, 0.f);

	const bool bVol = true;
	HeightFog->SetVolumetricFog(bVol);
	HeightFog->SetVolumetricFogScatteringDistribution(0.55f);
	HeightFog->SetVolumetricFogExtinctionScale(0.18f + 1.1f * Fog + 0.5f * Rain + 0.45f * Snow);
	HeightFog->SetVolumetricFogDistance(45000.f);
	HeightFog->SetVolumetricFogEmissive(FLinearColor::Black);
	HeightFog->MarkRenderStateDirty();

	SkyLight->SetIntensity(1.0f);

	// ---- clouds -----------------------------------------------------------------------------
	if (CloudMaterial)
	{
		if (!CloudMID || CloudMID->Parent != CloudMaterial)
		{
			CloudMID = UMaterialInstanceDynamic::Create(CloudMaterial, this);
			Clouds->SetMaterial(CloudMID);
		}
		const float WindDrift = SimTime * (4.f + 14.f * Wind);
		CloudMID->SetScalarParameterValue(TEXT("Coverage"), CloudCover);
		CloudMID->SetScalarParameterValue(TEXT("StormAmt"), Storm);
		CloudMID->SetScalarParameterValue(TEXT("LowDeck"), Fog);
		CloudMID->SetScalarParameterValue(TEXT("DeckBase"), FogCeiling);
		CloudMID->SetScalarParameterValue(TEXT("Drift"), WindDrift);
		CloudMID->SetVectorParameterValue(TEXT("OvercastColor"), Mix(GreyHaze, DuskHaze, Dusk * 0.6f) * (OvercastLum * Overcast));
		CloudMID->SetVectorParameterValue(TEXT("GlowColor"), Mix(NightHaze, SnowNight, Snow) * CityGlow);
		CloudMID->SetScalarParameterValue(TEXT("Flash"), FlashValue);
		CloudMID->SetVectorParameterValue(TEXT("FlashPosition"), FLinearColor(FlashPos.X, FlashPos.Y, FlashPos.Z, 0.f));
	}
	const bool bClouds = CloudCover > 0.02f || Fog > 0.02f;
	Clouds->SetVisibility(bClouds);
	Clouds->SetLayerBottomAltitude(Fog > 0.02f ? 0.12f : 1.1f);
	Clouds->SetLayerHeight(Fog > 0.02f ? 3.4f : 2.6f);
	Clouds->SetTracingMaxDistance(220.f);
}

void ANYCWeatherController::UpdateExposure()
{
	const float El = SolarPosition(TimeOfDay).X;
	const float Overcast = FMath::Max(Smooth(0.55f, 0.95f, CloudCover), FMath::Max(Storm, Fog * 0.9f));
	// scene exposure value for a clear sky at this sun elevation
	const float ClearEV = Curve(El, { {-12.f, 4.0f}, {-9.f, 4.4f}, {-6.f, 5.8f}, {-4.f, 7.2f}, {-2.f, 9.0f}, {0.f, 10.7f}, {2.f, 11.8f}, {5.f, 12.7f}, {10.f, 13.5f}, {25.f, 14.2f} });
	const float Dayness = Smooth(-5.f, 5.f, El);
	float EV = ClearEV - Dayness * (1.15f * Overcast + 0.55f * Storm);
	const float NightEV = 4.0f + 0.55f * SnowCover + 0.35f * Fog + 0.2f * Snow;
	EV = FMath::Max(EV, NightEV);
	EV += 0.45f * SnowCover * Dayness;
	// A camera at street level sits in the canyon's shade and opens up; from the air it stops down.
	const float InCanyon = 1.f - Smooth(1500.f, 14000.f, CamPos.Z);
	EV -= InCanyon * (1.25f * Dayness * (1.f - 0.55f * Overcast) + 0.15f * (1.f - Dayness));

	FPostProcessSettings& S = PostProcess->Settings;
	S.bOverride_AutoExposureMethod = true;
	S.AutoExposureMethod = AEM_Manual;
	S.bOverride_AutoExposureApplyPhysicalCameraExposure = true;
	S.AutoExposureApplyPhysicalCameraExposure = false;
	S.bOverride_AutoExposureBias = true;
	S.AutoExposureBias = -EV + ExposureBias;

	// local exposure keeps sunlit and shaded sides of the street canyon both readable
	S.bOverride_LocalExposureHighlightContrastScale = true;
	S.LocalExposureHighlightContrastScale = 0.76f;
	S.bOverride_LocalExposureShadowContrastScale = true;
	S.LocalExposureShadowContrastScale = 0.62f;

	S.bOverride_BloomIntensity = true;
	S.BloomIntensity = 0.42f + 0.25f * FMath::Max(Fog, Rain * 0.6f) + 0.1f * Darkness;
	S.bOverride_BloomThreshold = true;
	S.BloomThreshold = -1.f;

	const float Night = 1.f - Dayness;
	S.bOverride_WhiteTemp = true;
	S.WhiteTemp = FMath::Lerp(6500.f, 5400.f, Night) - 700.f * Warmth * -1.f;
	S.bOverride_VignetteIntensity = true;
	S.VignetteIntensity = 0.36f;
	S.bOverride_FilmGrainIntensity = true;
	S.FilmGrainIntensity = 0.13f + 0.1f * Night;
	// faint colour fringing toward the corners only, as on a real wide lens
	S.bOverride_SceneFringeIntensity = true;
	S.SceneFringeIntensity = 0.22f;
	S.bOverride_ChromaticAberrationStartOffset = true;
	S.ChromaticAberrationStartOffset = 0.55f;
	// a filmic grade: a touch less colour, deeper toe, cooler shadows against warmer highlights
	S.bOverride_ColorGainShadows = true;
	S.ColorGainShadows = FVector4(1.0, 1.005, 1.025, 1.0);
	S.bOverride_ColorGainHighlights = true;
	S.ColorGainHighlights = FVector4(1.035, 1.005, 0.955, 1.0);
	S.bOverride_FilmSlope = true;
	S.FilmSlope = 0.9f;
	S.bOverride_FilmToe = true;
	S.FilmToe = 0.52f;
	S.bOverride_FilmShoulder = true;
	S.FilmShoulder = 0.28f;
	S.bOverride_LensFlareIntensity = true;
	S.LensFlareIntensity = 0.0f;
	S.bOverride_MotionBlurAmount = true;
	S.MotionBlurAmount = 0.5f;

	S.bOverride_ColorSaturation = true;
	S.ColorSaturation = FVector4(1, 1, 1, (1.f - 0.14f * Overcast * Dayness - 0.05f * Rain) * 0.915f);
	S.bOverride_ColorContrast = true;
	S.ColorContrast = FVector4(1, 1, 1, 1.025f);

	S.bOverride_DynamicGlobalIlluminationMethod = true;
	S.DynamicGlobalIlluminationMethod = EDynamicGlobalIlluminationMethod::Lumen;
	S.bOverride_ReflectionMethod = true;
	S.ReflectionMethod = EReflectionMethod::Lumen;
	S.bOverride_LumenSceneLightingQuality = true;
	S.LumenSceneLightingQuality = 2.f;
	S.bOverride_LumenSceneDetail = true;
	S.LumenSceneDetail = 2.f;
	S.bOverride_LumenSceneViewDistance = true;
	S.LumenSceneViewDistance = 80000.f;
	S.bOverride_LumenMaxTraceDistance = true;
	S.LumenMaxTraceDistance = 60000.f;
	S.bOverride_LumenFinalGatherQuality = true;
	S.LumenFinalGatherQuality = 2.f;
	S.bOverride_LumenReflectionQuality = true;
	S.LumenReflectionQuality = 2.f;
	S.bOverride_LumenFinalGatherLightingUpdateSpeed = true;
	S.LumenFinalGatherLightingUpdateSpeed = 1.5f;
	S.bOverride_LumenSceneLightingUpdateSpeed = true;
	S.LumenSceneLightingUpdateSpeed = 1.5f;
	S.bOverride_LumenRayLightingMode = true;
	S.LumenRayLightingMode = ELumenRayLightingModeOverride::HitLightingForReflections;
	S.bOverride_LumenMaxReflectionBounces = true;
	S.LumenMaxReflectionBounces = 2;
	S.bOverride_LumenFrontLayerTranslucencyReflections = true;
	S.LumenFrontLayerTranslucencyReflections = true;
}

void ANYCWeatherController::UpdatePrecipitation()
{
	auto Drive = [this](UStaticMeshComponent* C, UStaticMesh* Mesh, float Amount)
	{
		if (!C) return;
		if (Mesh && C->GetStaticMesh() != Mesh) C->SetStaticMesh(Mesh);
		const bool bOn = Mesh && Amount > 0.01f;
		C->SetVisibility(bOn);
		if (bOn) C->SetWorldLocation(CamPos);
	};
	Drive(RainComp, RainMesh, Rain);
	Drive(SnowComp, SnowMesh, Snow);
	Drive(SplashComp, SplashMesh, CamPos.Z < 6000.f ? Rain : 0.f);
	if (DripMesh && DripComp)
	{
		// drips hang from fixed ledges, so this one stays put in the world
		if (DripComp->GetStaticMesh() != DripMesh) DripComp->SetStaticMesh(DripMesh);
		DripComp->SetVisibility(Wetness > 0.2f);
		DripComp->SetWorldLocation(FVector::ZeroVector);
	}
}

float ANYCWeatherController::StrikeEnvelope(float Tau) const
{
	auto Pulse = [](float T, float Decay)
	{
		if (T < 0.f) return 0.f;
		const float Rise = 0.018f;
		return T < Rise ? T / Rise : FMath::Exp(-(T - Rise) / Decay);
	};
	// a leader flash and one return stroke: two flashes per strike
	return FMath::Max(Pulse(Tau, 0.065f), 0.78f * Pulse(Tau - 0.27f, 0.12f));
}

void ANYCWeatherController::UpdateLightning()
{
	FlashValue = 0.f;
	const FNYCStrike* Active = nullptr;
	float Best = 0.f;
	auto Consider = [&](const FNYCStrike& S, float Tau)
	{
		if (Tau < 0.f || Tau > 1.4f) return;
		const float E = StrikeEnvelope(Tau) * S.Power;
		if (E > Best) { Best = E; Active = &S; }
	};
	if (bExternalClock)
	{
		for (const FNYCStrike& S : Strikes)
		{
			if (S.Shot == ShotId) Consider(S, SimTime - ShotStart - S.Time);
		}
	}
	else
	{
		for (const FNYCStrike& S : LiveStrikes) Consider(S, SimTime - S.Time);
	}
	// the flash lights stay registered through a storm and only change brightness: switching them
	// off and on again makes the lighting caches step visibly a moment after each strike
	const bool bStormy = Storm > 0.6f || (Active && Best >= 0.0004f);
	if (FlashLight) FlashLight->SetVisibility(bStormy);
	if (BoltLight) BoltLight->SetVisibility(bStormy);
	if (!Active || Best < 0.0004f)
	{
		if (Bolt) Bolt->SetVisibility(false);
		if (BoltLight) BoltLight->SetIntensity(0.01f);
		if (FlashLight) FlashLight->SetIntensity(0.001f);
		return;
	}
	FlashValue = Best;
	const FVector Mid = FMath::Lerp(Active->From, Active->To, 0.35f);
	FlashPos = Mid;

	FVector LightDir = (FVector(CamPos.X, CamPos.Y, 0) - Mid).GetSafeNormal();
	LightDir.Z = FMath::Min(LightDir.Z, -0.45f);
	FlashLight->SetWorldRotation(LightDir.GetSafeNormal().Rotation());
	FlashLight->SetIntensity(FMath::Max((Active->bVisibleBolt ? 11.f : 7.f) * Best, 0.001f));
	BoltLight->SetWorldLocation(Mid);
	BoltLight->SetIntensity((Active->bVisibleBolt ? 1.5e6f : 7.0e5f) * Best);
	BoltLight->SetVolumetricScatteringIntensity(0.6f);

	if (Active->bVisibleBolt)
	{
		const int64 Key = (int64)Active->Seed * 1000 + Active->Shot;
		if (Key != BoltKey) { BuildBolt(*Active); BoltKey = Key; }
		if (BoltMaterial)
		{
			if (!BoltMID || BoltMID->Parent != BoltMaterial)
			{
				BoltMID = UMaterialInstanceDynamic::Create(BoltMaterial, this);
			}
			Bolt->SetMaterial(0, BoltMID);
			BoltMID->SetScalarParameterValue(TEXT("Envelope"), Best);
		}
		Bolt->SetVisibility(true);
	}
	else
	{
		Bolt->SetVisibility(false);
	}
}

void ANYCWeatherController::BuildBolt(const FNYCStrike& S)
{
	TArray<FVector> Verts, Normals;
	TArray<int32> Tris;
	TArray<FVector2D> UVs;
	TArray<FLinearColor> Colors;
	FRandomStream R(S.Seed);

	auto Jagged = [&R](const FVector& A, const FVector& B, int32 Levels, float Amp)
	{
		TArray<FVector> Pts = { A, B };
		float Disp = (B - A).Size() * Amp;
		for (int32 L = 0; L < Levels; ++L)
		{
			TArray<FVector> Next;
			Next.Reserve(Pts.Num() * 2);
			for (int32 i = 0; i + 1 < Pts.Num(); ++i)
			{
				FVector M = (Pts[i] + Pts[i + 1]) * 0.5f;
				const FVector Dir = (Pts[i + 1] - Pts[i]).GetSafeNormal();
				FVector Off = R.VRand();
				Off = (Off - Dir * FVector::DotProduct(Off, Dir)).GetSafeNormal();
				M += Off * Disp * R.FRandRange(0.35f, 1.f);
				Next.Add(Pts[i]);
				Next.Add(M);
			}
			Next.Add(Pts.Last());
			Pts = MoveTemp(Next);
			Disp *= 0.53f;
		}
		return Pts;
	};

	auto Ribbon = [&](const TArray<FVector>& Pts, float Width0, float Width1, float Glow)
	{
		for (int32 i = 0; i + 1 < Pts.Num(); ++i)
		{
			const float A0 = float(i) / (Pts.Num() - 1);
			const float A1 = float(i + 1) / (Pts.Num() - 1);
			const FVector Dir = Pts[i + 1] - Pts[i];
			const FVector ToCam = CamPos - Pts[i];
			const FVector Side = FVector::CrossProduct(Dir, ToCam).GetSafeNormal();
			// never thinner than about two pixels, so the channel cannot shimmer
			const float MinW = ToCam.Size() * 0.0009f;
			const float W0 = FMath::Max(FMath::Lerp(Width0, Width1, A0), MinW * 0.7f);
			const float W1 = FMath::Max(FMath::Lerp(Width0, Width1, A1), MinW * 0.7f);
			const int32 Base = Verts.Num();
			Verts.Add(Pts[i] - Side * W0); Verts.Add(Pts[i] + Side * W0);
			Verts.Add(Pts[i + 1] + Side * W1); Verts.Add(Pts[i + 1] - Side * W1);
			const FVector Nrm = ToCam.GetSafeNormal();
			for (int32 k = 0; k < 4; ++k) { Normals.Add(Nrm); Colors.Add(FLinearColor(Glow, Glow, Glow, 1.f)); }
			UVs.Add(FVector2D(0, A0)); UVs.Add(FVector2D(1, A0)); UVs.Add(FVector2D(1, A1)); UVs.Add(FVector2D(0, A1));
			Tris.Append({ Base, Base + 1, Base + 2, Base, Base + 2, Base + 3 });
		}
	};

	const TArray<FVector> Main = Jagged(S.From, S.To, 8, 0.085f);
	Ribbon(Main, 210.f, 120.f, 1.0f);
	const int32 Branches = R.RandRange(5, 9);
	for (int32 b = 0; b < Branches; ++b)
	{
		const int32 At = R.RandRange(Main.Num() / 12, Main.Num() * 3 / 4);
		const FVector Start = Main[At];
		FVector Dir = (S.To - S.From).GetSafeNormal();
		Dir = (Dir + R.VRand() * 0.9f).GetSafeNormal();
		if (Dir.Z > -0.1f) Dir.Z = -R.FRandRange(0.1f, 0.6f);
		const float Len = (S.To - S.From).Size() * R.FRandRange(0.12f, 0.38f);
		const TArray<FVector> Br = Jagged(Start, Start + Dir * Len, 6, 0.12f);
		Ribbon(Br, 90.f, 20.f, R.FRandRange(0.14f, 0.4f));
	}
	Bolt->ClearAllMeshSections();
	Bolt->CreateMeshSection_LinearColor(0, Verts, Tris, Normals, UVs, Colors, TArray<FProcMeshTangent>(), false);
	Bolt->SetWorldTransform(FTransform::Identity);
}

void ANYCWeatherController::UpdateCollection()
{
	if (!Collection || !GetWorld()) return;
	UMaterialParameterCollectionInstance* I = GetWorld()->GetParameterCollectionInstance(Collection);
	if (!I) return;
	const float El = SolarPosition(TimeOfDay).X;
	const float Hour = TimeOfDay;

	auto Set = [I](const TCHAR* Name, float V) { I->SetScalarParameterValue(Name, V); };
	auto SetV = [I](const FName Name, const FLinearColor& V) { I->SetVectorParameterValue(Name, V); };

	Set(TEXT("Wetness"), Wetness);
	Set(TEXT("Puddles"), Puddles);
	Set(TEXT("Rain"), Rain);
	Set(TEXT("NearRain"), NearRain);
	Set(TEXT("Snow"), SnowCover);
	Set(TEXT("SnowFall"), Snow);
	Set(TEXT("Wind"), Wind);
	Set(TEXT("SimTime"), SimTime);
	Set(TEXT("Night"), Darkness);
	Set(TEXT("CloudCover"), CloudCover);
	Set(TEXT("Fog"), Fog);
	Set(TEXT("Flash"), FlashValue);

	// How many rooms are lit, by building use and hour.
	const float Office = Curve(Hour, { {0.f, 0.11f}, {5.f, 0.08f}, {7.f, 0.22f}, {9.f, 0.5f}, {15.f, 0.58f}, {17.f, 0.66f}, {19.f, 0.46f}, {21.f, 0.28f}, {23.f, 0.16f}, {24.f, 0.11f} });
	const float Home = Curve(Hour, { {0.f, 0.17f}, {2.f, 0.07f}, {5.f, 0.07f}, {7.f, 0.3f}, {9.f, 0.12f}, {15.f, 0.12f}, {17.f, 0.38f}, {19.f, 0.62f}, {22.f, 0.5f}, {24.f, 0.17f} });
	const float Shop = Curve(Hour, { {0.f, 0.55f}, {3.f, 0.38f}, {6.f, 0.45f}, {9.f, 0.92f}, {20.f, 0.95f}, {23.f, 0.68f}, {24.f, 0.55f} });
	Set(TEXT("LitOffice"), Office);
	Set(TEXT("LitHome"), Home);
	Set(TEXT("LitShop"), Shop);
	const float Overcast = FMath::Max(Smooth(0.55f, 0.95f, CloudCover), FMath::Max(Storm, Fog * 0.9f));
	const float Daylight = Curve(El, { {-8.f, 0.f}, {-3.f, 4.f}, {0.f, 24.f}, {5.f, 110.f}, {25.f, 260.f} }) * FMath::Lerp(1.f, 0.45f, Overcast);
	Set(TEXT("InteriorDay"), Daylight);
	Set(TEXT("StreetLights"), Darkness > 0.45f ? 1.f : 0.f);
	Set(TEXT("Holiday"), 1.f);

	SetV(TEXT("WindDir"), FLinearColor(0.35f, 0.94f, 0.f, 0.f));
	SetV(TEXT("SunDir"), FLinearColor(SunDir.X, SunDir.Y, SunDir.Z, 0.f));
	SetV(TEXT("FlashPos"), FLinearColor(FlashPos.X, FlashPos.Y, FlashPos.Z, 0.f));
	const FLinearColor SkyAmb = HeightFog->FogInscatteringLuminance;
	SetV(TEXT("FogColor"), SkyAmb);
	SetV(TEXT("SkyColor"), SkyAmb);
	const float SunUp = Smooth(-2.f, 3.f, El);
	SetV(TEXT("SunColor"), Mix(FLinearColor(1.f, 0.55f, 0.28f), FLinearColor(1.f, 0.95f, 0.9f), Smooth(2.f, 18.f, El)) * (SunUp * (1.f - Overcast)));
	Set(TEXT("SunLux"), 100000.f * SunUp * (1.f - Overcast * 0.97f));
	Set(TEXT("SkyNits"), SkyAmb.GetLuminance());

	// ---- city light gains -------------------------------------------------------------------
	const float StreetOn = Smooth(0.42f, 0.52f, Darkness);
	const float Dim = FMath::Lerp(0.25f, 1.f, Darkness);
	TArray<float> Gains;
	Gains.Add(StreetOn);                                           // Street
	Gains.Add(FMath::Lerp(0.0f, 1.f, Smooth(0.2f, 0.7f, Darkness)) * Shop); // Shop
	Gains.Add(Dim);                                                // Sign
	Gains.Add(StreetOn * Curve(Hour, { {0.f, 1.f}, {2.f, 0.8f}, {6.f, 0.8f}, {16.f, 1.f}, {24.f, 1.f} })); // Landmark
	Gains.Add(Dim);                                                // Holiday
	Gains.Add(FMath::Lerp(0.15f, 1.f, Darkness));                  // Lobby
	Gains.Add(StreetOn);                                           // Park
	if (IsValid(LightField))
	{
		LightField->SetKindGains(Gains, 0.5f + 1.2f * FMath::Max3(Fog, Rain * 0.8f, Snow));
	}

	// ---- the lights that rain, snow and spray are lit by -------------------------------------
	struct FFx { float Score; FVector Pos; FVector Dir; FLinearColor Col; float Candela; float Radius; float CosCone; };
	TArray<FFx> Fx;
	const float Reach = 6500.f;
	const FVector Focus = CamPos + CamDir * 1400.f;
	auto Offer = [&](const FVector& Pos, const FVector& Dir, const FLinearColor& Col, float Candela, float Radius, float ConeDeg)
	{
		const float Dist = FVector::Dist(Pos, Focus);
		if (Dist > Reach || Candela <= 1.f) return;
		const float Fade = FMath::Clamp((Reach - Dist) / (Reach * 0.35f), 0.f, 1.f);
		FFx F;
		F.Score = Dist - FMath::Sqrt(Candela) * 4.f;
		F.Pos = Pos; F.Dir = Dir; F.Col = Col; F.Candela = Candela * Fade; F.Radius = Radius;
		F.CosCone = ConeDeg > 0.f ? FMath::Cos(FMath::DegreesToRadians(ConeDeg)) : -1.f;
		Fx.Add(F);
	};
	if (Rain > 0.01f || Snow > 0.01f)
	{
		if (IsValid(LightField))
		{
			for (const FNYCLight& L : LightField->Lights)
			{
				const int32 Kind = static_cast<int32>(L.Kind);
				const float G = Gains.IsValidIndex(Kind) ? Gains[Kind] : 1.f;
				if (G > 0.01f && L.Kind != ENYCLightKind::Landmark)
				{
					const float Cd = L.Cone < 0.f ? L.Intensity / PI : L.Intensity;
					Offer(L.Position, L.Direction, L.Color, Cd * G, L.Radius, L.Cone);
				}
			}
		}
		if (IsValid(Traffic))
		{
			TArray<FNYCFxLight> Car;
			Traffic->GatherFxLights(CamPos, Car);
			for (const FNYCFxLight& L : Car) Offer(L.Position, L.Direction, L.Color, L.Candela, 3000.f, L.ConeDeg);
		}
	}
	Fx.Sort([](const FFx& A, const FFx& B) { return A.Score < B.Score; });
	for (int32 i = 0; i < NumFxLights; ++i)
	{
		const bool bHas = i < Fx.Num();
		const FFx F = bHas ? Fx[i] : FFx{ 0, FVector(0, 0, -1.0e7), FVector(0, 0, -1), FLinearColor::Black, 0, 1, -1 };
		SetV(FName(*FString::Printf(TEXT("FxPos%d"), i)), FLinearColor(F.Pos.X, F.Pos.Y, F.Pos.Z, F.Candela));
		SetV(FName(*FString::Printf(TEXT("FxCol%d"), i)), FLinearColor(F.Col.R, F.Col.G, F.Col.B, F.Radius));
		SetV(FName(*FString::Printf(TEXT("FxDir%d"), i)), FLinearColor(F.Dir.X, F.Dir.Y, F.Dir.Z, F.CosCone));
	}
}
