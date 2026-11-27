#include "NYCGameMode.h"
#include "NYCArsenal.h"
#include "NYCTraffic.h"
#include "NYCDestruction.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "NYCWeatherController.h"
#include "Components/InputComponent.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Canvas.h"
#include "EngineUtils.h"

namespace
{
	struct FNycView { const TCHAR* Name; FVector Pos; FRotator Rot; };
	const FNycView GViews[] = {
		{ TEXT("5th Avenue looking downtown"), FVector(2600, 150, 230), FRotator(5, 180, 0) },
		{ TEXT("Library steps"), FVector(-5600, -900, 260), FRotator(6, -105, 0) },
		{ TEXT("42nd Street looking east"), FVector(150, -9000, 300), FRotator(7, 90, 0) },
		{ TEXT("Bryant Park"), FVector(-9500, -24500, 420), FRotator(8, 60, 0) },
		{ TEXT("Above Bryant Park"), FVector(21000, -42000, 24000), FRotator(-16, 132, 0) },
		{ TEXT("High over Midtown"), FVector(90000, -60000, 62000), FRotator(-24, 148, 0) },
	};

	struct FNycPreset { const TCHAR* Name; float Tod, Cloud, Storm, Rain, Snow, Fog, Wind, Bolts; };
	const FNycPreset GPresets[] = {
		{ TEXT("Clear day"),       13.0f, 0.18f, 0.0f, 0.0f, 0.0f, 0.0f, 0.25f, 0.f },
		{ TEXT("Golden hour"),     15.55f, 0.28f, 0.0f, 0.0f, 0.0f, 0.0f, 0.2f, 0.f },
		{ TEXT("Overcast"),        13.5f, 0.97f, 0.15f, 0.0f, 0.0f, 0.0f, 0.35f, 0.f },
		{ TEXT("Rain"),            16.9f, 0.96f, 0.35f, 0.6f, 0.0f, 0.0f, 0.4f, 0.f },
		{ TEXT("Thunderstorm"),    20.5f, 1.0f, 1.0f, 1.0f, 0.0f, 0.0f, 0.85f, 14.f },
		{ TEXT("Fog"),             23.3f, 0.7f, 0.0f, 0.0f, 0.0f, 1.0f, 0.15f, 0.f },
		{ TEXT("Snow"),            1.0f, 0.95f, 0.1f, 0.0f, 0.85f, 0.15f, 0.3f, 0.f },
		{ TEXT("Clear night"),     19.0f, 0.15f, 0.0f, 0.0f, 0.0f, 0.0f, 0.2f, 0.f },
		{ TEXT("Sunrise on snow"), 7.42f, 0.12f, 0.0f, 0.0f, 0.0f, 0.0f, 0.15f, 0.f },
	};
}

ANYCGameMode::ANYCGameMode()
{
	DefaultPawnClass = ANYCFlyPawn::StaticClass();
	HUDClass = ANYCHUD::StaticClass();
}

ANYCFlyPawn::ANYCFlyPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	bAddDefaultMovementBindings = true;
	if (UStaticMeshComponent* Body = GetMeshComponent())
	{
		Body->SetVisibility(false);
		Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}
	if (USphereComponent* Sphere = GetCollisionComponent())
	{
		Sphere->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}
}

void ANYCFlyPawn::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocation(GViews[0].Pos);
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->SetControlRotation(GViews[0].Rot);
	}
}

ANYCWeatherController* ANYCFlyPawn::GetWeather()
{
	if (!IsValid(Weather))
	{
		Weather = nullptr;
		for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It) { Weather = *It; break; }
		if (Weather) Weather->bExternalClock = false;
	}
	return Weather;
}

void ANYCFlyPawn::SetupPlayerInputComponent(UInputComponent* In)
{
	Super::SetupPlayerInputComponent(In);
#define NYC_BIND(Key, Fn) In->BindKey(Key, IE_Pressed, this, &ANYCFlyPawn::Fn)
	NYC_BIND(EKeys::One, Preset1); NYC_BIND(EKeys::Two, Preset2); NYC_BIND(EKeys::Three, Preset3);
	NYC_BIND(EKeys::Four, Preset4); NYC_BIND(EKeys::Five, Preset5); NYC_BIND(EKeys::Six, Preset6);
	NYC_BIND(EKeys::Seven, Preset7); NYC_BIND(EKeys::Eight, Preset8); NYC_BIND(EKeys::Nine, Preset9);
	NYC_BIND(EKeys::LeftBracket, TimeBack); NYC_BIND(EKeys::RightBracket, TimeForward);
	NYC_BIND(EKeys::Comma, RainDown); NYC_BIND(EKeys::Period, RainUp);
	NYC_BIND(EKeys::Semicolon, SnowDown); NYC_BIND(EKeys::Apostrophe, SnowUp);
	NYC_BIND(EKeys::Hyphen, CloudDown); NYC_BIND(EKeys::Equals, CloudUp);
	NYC_BIND(EKeys::J, WindDown); NYC_BIND(EKeys::K, WindUp);
	NYC_BIND(EKeys::F, FogToggle); NYC_BIND(EKeys::L, Lightning); NYC_BIND(EKeys::T, TimeLapse);
	NYC_BIND(EKeys::H, HelpToggle); NYC_BIND(EKeys::V, NextView); NYC_BIND(EKeys::R, Dry);
	NYC_BIND(EKeys::X, SpeedUp); NYC_BIND(EKeys::Z, SpeedDown);
	NYC_BIND(EKeys::LeftMouseButton, FireTool);
	NYC_BIND(EKeys::MouseScrollDown, NextTool); NYC_BIND(EKeys::MouseScrollUp, PrevTool);
	NYC_BIND(EKeys::PageDown, NextTier); NYC_BIND(EKeys::PageUp, PrevTier);
	NYC_BIND(EKeys::Tab, ToggleSelector); NYC_BIND(EKeys::BackSpace, RebuildCity);
	NYC_BIND(EKeys::P, PeopleToggle);
#undef NYC_BIND
}

void ANYCFlyPawn::Preset(int32 Index)
{
	ANYCWeatherController* W = GetWeather();
	if (!W) return;
	const FNycPreset& S = GPresets[FMath::Clamp(Index - 1, 0, 8)];
	FNYCWeather T;
	T.TimeOfDay = S.Tod; T.CloudCover = S.Cloud; T.Storm = S.Storm; T.Rain = S.Rain; T.Snow = S.Snow;
	T.Fog = S.Fog; T.Wind = S.Wind; T.LightningPerMinute = S.Bolts;
	W->TransitionTo(T, 4.0f);
	// Ground state follows the weather on its own; these two presets also need what already fell.
	if (Index == 7) W->SnowCover = FMath::Max(W->SnowCover, 0.45f);
	if (Index == 9) W->SnowCover = 1.0f;
	if (Index == 6) { W->Wetness = FMath::Max(W->Wetness, 0.7f); W->Puddles = FMath::Max(W->Puddles, 0.4f); }
	Status = S.Name;
}

void ANYCFlyPawn::Nudge(float& Value, float Delta, const TCHAR* Label)
{
	Value = FMath::Clamp(Value + Delta, 0.f, 1.f);
	Status = FString::Printf(TEXT("%s %.1f"), Label, Value);
}

void ANYCFlyPawn::TimeBack() { if (ANYCWeatherController* W = GetWeather()) { W->TimeOfDay = FMath::Fmod(W->TimeOfDay + 23.5f, 24.f); Status = TEXT("Time -30 min"); } }
void ANYCFlyPawn::TimeForward() { if (ANYCWeatherController* W = GetWeather()) { W->TimeOfDay = FMath::Fmod(W->TimeOfDay + 0.5f, 24.f); Status = TEXT("Time +30 min"); } }
void ANYCFlyPawn::RainDown() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->Rain, -0.2f, TEXT("Rain")); }
void ANYCFlyPawn::RainUp() { if (ANYCWeatherController* W = GetWeather()) { Nudge(W->Rain, 0.2f, TEXT("Rain")); W->CloudCover = FMath::Max(W->CloudCover, 0.9f); } }
void ANYCFlyPawn::SnowDown() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->Snow, -0.2f, TEXT("Snowfall")); }
void ANYCFlyPawn::SnowUp() { if (ANYCWeatherController* W = GetWeather()) { Nudge(W->Snow, 0.2f, TEXT("Snowfall")); W->CloudCover = FMath::Max(W->CloudCover, 0.9f); } }
void ANYCFlyPawn::CloudDown() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->CloudCover, -0.15f, TEXT("Cloud")); }
void ANYCFlyPawn::CloudUp() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->CloudCover, 0.15f, TEXT("Cloud")); }
void ANYCFlyPawn::WindDown() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->Wind, -0.2f, TEXT("Wind")); }
void ANYCFlyPawn::WindUp() { if (ANYCWeatherController* W = GetWeather()) Nudge(W->Wind, 0.2f, TEXT("Wind")); }
void ANYCFlyPawn::FogToggle() { if (ANYCWeatherController* W = GetWeather()) { W->Fog = W->Fog > 0.5f ? 0.f : 1.f; Status = W->Fog > 0.5f ? TEXT("Fog on") : TEXT("Fog off"); } }
void ANYCFlyPawn::Lightning() { if (ANYCWeatherController* W = GetWeather()) { W->TriggerLightning(); Status = TEXT("Lightning"); } }
void ANYCFlyPawn::TimeLapse() { bTimeLapse = !bTimeLapse; Status = bTimeLapse ? TEXT("Time-lapse on") : TEXT("Time-lapse off"); }
void ANYCFlyPawn::HelpToggle() { bShowHelp = !bShowHelp; }
void ANYCFlyPawn::PeopleToggle()
{
	ANYCDestruction* D = ANYCDestruction::Get(GetWorld());
	ANYCTraffic* T = D ? D->Traffic() : nullptr;
	if (!T) return;
	T->TogglePedestrians();
	Status = T->PedestriansBarred() ? TEXT("Pedestrians stay away until the city is rebuilt (Backspace)")
		: T->PedestriansShown() ? TEXT("Pedestrians on") : TEXT("Pedestrians off");
}
void ANYCFlyPawn::Dry() { if (ANYCWeatherController* W = GetWeather()) { W->Wetness = 0; W->Puddles = 0; W->SnowCover = 0; Status = TEXT("Streets reset: dry, no snow"); } }
void ANYCFlyPawn::SpeedUp() { Speed = FMath::Min(Speed * 1.4f, 60000.f); }
void ANYCFlyPawn::SpeedDown() { Speed = FMath::Max(Speed / 1.4f, 200.f); }

// ------------------------------------------------------------------ destruction
void ANYCFlyPawn::SelectTool(int32 Index)
{
	const TArray<FNYCTool>& All = NYCArsenal::Tools();
	if (All.Num() == 0) return;
	ToolIndex = (Index % All.Num() + All.Num()) % All.Num();
}

void ANYCFlyPawn::StepTool(int32 Delta) { SelectTool(ToolIndex + Delta); }
void ANYCFlyPawn::NextTool() { StepTool(1); }
void ANYCFlyPawn::PrevTool() { StepTool(-1); }

void ANYCFlyPawn::StepTier(int32 Delta)
{
	const TArray<FNYCTool>& All = NYCArsenal::Tools();
	if (!All.IsValidIndex(ToolIndex)) return;
	const int32 Want = (All[ToolIndex].Tier - 1 + Delta + 8) % 8 + 1;
	for (int32 i = 0; i < All.Num(); ++i)
		if (All[i].Tier == Want) { ToolIndex = i; return; }
}

void ANYCFlyPawn::NextTier() { StepTier(1); }
void ANYCFlyPawn::PrevTier() { StepTier(-1); }

void ANYCFlyPawn::SetSelector(bool bOpen)
{
	bSelector = bOpen;
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC) return;
	PC->bShowMouseCursor = bOpen;
	PC->bEnableClickEvents = bOpen;
	PC->bEnableMouseOverEvents = bOpen;
	PC->SetIgnoreLookInput(bOpen);
	if (bOpen)
	{
		FInputModeGameAndUI Mode;
		Mode.SetHideCursorDuringCapture(false);
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		PC->SetInputMode(Mode);
	}
	else PC->SetInputMode(FInputModeGameOnly());
}

void ANYCFlyPawn::ToggleSelector() { SetSelector(!bSelector); }

void ANYCFlyPawn::FireTool()
{
	// while the list is open the click belongs to the list
	if (bSelector) return;
	const TArray<FNYCTool>& All = NYCArsenal::Tools();
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !All.IsValidIndex(ToolIndex)) return;
	const double Real = GetWorld()->GetTimeSeconds();
	if (Real - LastUse < 0.18) return;
	LastUse = Real;
	ANYCDestruction* D = ANYCDestruction::Get(GetWorld());
	if (!D || !D->EnsureLoaded())
	{
		ToolStatus = TEXT("The destruction data is missing: run source/pipeline.py");
		ToolStatusUntil = Real + 4.0;
		return;
	}
	GetWeather();
	FVector Eye;
	FRotator Look;
	PC->GetPlayerViewPoint(Eye, Look);
	NYCArsenal::Use(*D, All[ToolIndex].Id, NYCArsenal::MakeAim(*D, Eye, Look.Vector()));
	ToolStatus = All[ToolIndex].Name;
	ToolStatusUntil = Real + 2.5;
}

void ANYCFlyPawn::RebuildCity()
{
	if (ANYCDestruction* D = ANYCDestruction::Get(GetWorld(), false))
	{
		D->ResetCity();
		ToolStatus = TEXT("City rebuilt");
		ToolStatusUntil = GetWorld()->GetTimeSeconds() + 2.5;
	}
}

void ANYCFlyPawn::NextView()
{
	ViewIndex = (ViewIndex + 1) % UE_ARRAY_COUNT(GViews);
	SetActorLocation(GViews[ViewIndex].Pos);
	if (APlayerController* PC = Cast<APlayerController>(GetController())) PC->SetControlRotation(GViews[ViewIndex].Rot);
	Status = GViews[ViewIndex].Name;
}

void ANYCFlyPawn::CalcCamera(float DeltaTime, FMinimalViewInfo& OutResult)
{
	Super::CalcCamera(DeltaTime, OutResult);
	if (const ANYCDestruction* D = ANYCDestruction::Get(GetWorld(), false)) OutResult.Location += D->ShakeOffset(OutResult.Location);
}

void ANYCFlyPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (UFloatingPawnMovement* M = Cast<UFloatingPawnMovement>(GetMovementComponent()))
	{
		const APlayerController* PC = Cast<APlayerController>(GetController());
		const bool bFast = PC && (PC->IsInputKeyDown(EKeys::LeftShift) || PC->IsInputKeyDown(EKeys::RightShift));
		M->MaxSpeed = Speed * (bFast ? 4.f : 1.f);
		M->Acceleration = M->MaxSpeed * 4.f;
		M->Deceleration = M->MaxSpeed * 6.f;
	}
	if (ANYCWeatherController* W = GetWeather())
	{
		if (bTimeLapse) W->TimeOfDay = FMath::Fmod(W->TimeOfDay + DeltaSeconds * 0.25f, 24.f);
	}
}

void ANYCHUD::Panel(float X, float Y, float W, float H, float Alpha)
{
	DrawRect(FLinearColor(0.012f, 0.014f, 0.02f, Alpha), X, Y, W, H);
}

void ANYCHUD::Shadowed(const FString& Text, const FLinearColor& Color, float X, float Y, float Scale)
{
	UFont* Font = GEngine ? GEngine->GetSmallFont() : nullptr;
	DrawText(Text, FLinearColor(0.f, 0.f, 0.f, 0.85f), X + 1.f, Y + 1.f, Font, Scale);
	DrawText(Text, Color, X, Y, Font, Scale);
}

void ANYCHUD::NotifyHitBoxClick(FName BoxName)
{
	Super::NotifyHitBoxClick(BoxName);
	if (ANYCFlyPawn* Pawn = Cast<ANYCFlyPawn>(GetOwningPawn()))
	{
		const FString Name = BoxName.ToString();
		if (Name.StartsWith(TEXT("tool_")))
		{
			Pawn->SelectTool(FCString::Atoi(*Name.Mid(5)));
			Pawn->SetSelector(false);
		}
	}
}

void ANYCHUD::NotifyHitBoxBeginCursorOver(FName BoxName)
{
	Super::NotifyHitBoxBeginCursorOver(BoxName);
	const FString Name = BoxName.ToString();
	if (Name.StartsWith(TEXT("tool_"))) Hover = FCString::Atoi(*Name.Mid(5));
}

void ANYCHUD::NotifyHitBoxEndCursorOver(FName BoxName)
{
	Super::NotifyHitBoxEndCursorOver(BoxName);
	if (BoxName.ToString() == FString::Printf(TEXT("tool_%d"), Hover)) Hover = INDEX_NONE;
}

/** Every tool, one column per tier, smallest at the top left.  Click one to take it. */
void ANYCHUD::DrawSelector(ANYCFlyPawn* Pawn)
{
	const TArray<FNYCTool>& All = NYCArsenal::Tools();
	const float W = Canvas->SizeX, H = Canvas->SizeY;
	const float Scale = FMath::Clamp(W / 1920.f, 0.62f, 2.f);
	const float Col = (W - 40.f * Scale) / 8.f, Row = 24.f * Scale, Top = H * 0.17f;
	int32 Most = 0;
	for (int32 Tier = 1; Tier <= 8; ++Tier)
	{
		int32 N = 0;
		for (const FNYCTool& T : All) N += T.Tier == Tier ? 1 : 0;
		Most = FMath::Max(Most, N);
	}
	Panel(12.f * Scale, Top - 66.f * Scale, W - 24.f * Scale, (Most * Row) + 150.f * Scale, 0.86f);
	Shadowed(FString::Printf(TEXT("DESTRUCTION TOOLS  (%d, smallest first)    click to choose, Tab to close"), All.Num()),
		FLinearColor(1.f, 0.82f, 0.3f), 24.f * Scale, Top - 56.f * Scale, 1.25f * Scale);
	int32 Line[9] = { 0 };
	for (int32 i = 0; i < All.Num(); ++i)
	{
		const FNYCTool& T = All[i];
		const float X = 20.f * Scale + (T.Tier - 1) * Col;
		if (Line[T.Tier] == 0) Shadowed(FString::Printf(TEXT("%d  %s"), T.Tier, NYCArsenal::TierName(T.Tier)), FLinearColor(0.55f, 0.8f, 1.f), X, Top - 22.f * Scale, 0.95f * Scale);
		const float Y = Top + Line[T.Tier]++ * Row;
		const bool bChosen = i == Pawn->ToolIndex, bOver = i == Hover;
		if (bChosen || bOver) DrawRect(bChosen ? FLinearColor(0.55f, 0.32f, 0.04f, 0.9f) : FLinearColor(0.25f, 0.28f, 0.36f, 0.85f), X - 4.f, Y - 2.f, Col - 6.f, Row - 2.f);
		Shadowed(FString::Printf(TEXT("%d. %s"), i + 1, *T.Name), FLinearColor::White, X, Y + 2.f, 0.86f * Scale);
		AddHitBox(FVector2D(X - 4.f, Y - 2.f), FVector2D(Col - 6.f, Row - 2.f), *FString::Printf(TEXT("tool_%d"), i), true, 0);
	}
	const int32 Shown = All.IsValidIndex(Hover) ? Hover : Pawn->ToolIndex;
	if (All.IsValidIndex(Shown))
	{
		Shadowed(All[Shown].Name + TEXT(":  ") + All[Shown].Does, FLinearColor(1.f, 0.95f, 0.8f), 24.f * Scale, Top + Most * Row + 22.f * Scale, 1.05f * Scale);
		Shadowed(All[Shown].Built, FLinearColor(0.72f, 0.74f, 0.78f), 24.f * Scale, Top + Most * Row + 48.f * Scale, 0.82f * Scale);
	}
}

void ANYCHUD::DrawHUD()
{
	Super::DrawHUD();
	ANYCFlyPawn* Pawn = Cast<ANYCFlyPawn>(GetOwningPawn());
	if (!Pawn || Pawn->bHideHud || !Canvas) return;
	const float W = Canvas->SizeX, H = Canvas->SizeY;
	if (Pawn->bShowHelp && !Pawn->bSelector)
	{
		const TCHAR* Lines[] = {
			TEXT("WASD move   E/Q up/down   mouse look   Shift fast   Z X speed   V next viewpoint   H hide help   P pedestrians"),
			TEXT("1 clear  2 golden hour  3 overcast  4 rain  5 thunderstorm  6 fog  7 snow  8 clear night  9 sunrise on snow"),
			TEXT("[ ] time   , . rain   ; ' snowfall   - = cloud   J K wind   F fog   L lightning   T time-lapse   R dry streets"),
			TEXT("LEFT CLICK use tool   wheel previous/next tool   PgUp/PgDn tier   Tab all tools   BACKSPACE rebuild the city"),
		};
		float Y = 24.f;
		for (const TCHAR* L : Lines)
		{
			Shadowed(L, FLinearColor::White, 24.f, Y);
			Y += 18.f;
		}
		for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It)
		{
			const FString S = FString::Printf(TEXT("%02d:%02d  cloud %.2f rain %.2f snow %.2f fog %.2f  wet %.2f puddles %.2f snow cover %.2f   %s"),
				int32(It->TimeOfDay), int32(FMath::Frac(It->TimeOfDay) * 60.f), It->CloudCover, It->Rain, It->Snow, It->Fog,
				It->Wetness, It->Puddles, It->SnowCover, *Pawn->Status);
			Shadowed(S, FLinearColor(1.f, 0.85f, 0.3f), 24.f, Y + 4.f);
			break;
		}
	}
	if (Pawn->bSelector)
	{
		DrawSelector(Pawn);
		return;
	}
	// crosshair
	const float Cx = W * 0.5f, Cy = H * 0.5f;
	for (int32 k = 0; k < 2; ++k)
	{
		const FLinearColor C = k ? FLinearColor(1.f, 0.86f, 0.4f, 0.95f) : FLinearColor(0.f, 0.f, 0.f, 0.6f);
		const float O = k ? 0.f : 1.f;
		DrawLine(Cx - 11 + O, Cy + O, Cx - 4 + O, Cy + O, C, 1.5f);
		DrawLine(Cx + 4 + O, Cy + O, Cx + 11 + O, Cy + O, C, 1.5f);
		DrawLine(Cx + O, Cy - 11 + O, Cx + O, Cy - 4 + O, C, 1.5f);
		DrawLine(Cx + O, Cy + 4 + O, Cx + O, Cy + 11 + O, C, 1.5f);
	}
	const TArray<FNYCTool>& All = NYCArsenal::Tools();
	if (All.IsValidIndex(Pawn->ToolIndex))
	{
		const FNYCTool& T = All[Pawn->ToolIndex];
		const float Scale = FMath::Clamp(W / 1920.f, 0.7f, 2.f);
		Panel(Cx - 420.f * Scale, H - 92.f * Scale, 840.f * Scale, 72.f * Scale, 0.62f);
		Shadowed(FString::Printf(TEXT("%d / %d   %s        [tier %d: %s]"), Pawn->ToolIndex + 1, All.Num(), *T.Name, T.Tier, NYCArsenal::TierName(T.Tier)),
			FLinearColor(1.f, 0.82f, 0.3f), Cx - 404.f * Scale, H - 84.f * Scale, 1.2f * Scale);
		Shadowed(T.Does, FLinearColor(0.9f, 0.9f, 0.92f), Cx - 404.f * Scale, H - 54.f * Scale, 0.9f * Scale);
		if (GetWorld()->GetTimeSeconds() < Pawn->ToolStatusUntil) Shadowed(Pawn->ToolStatus, FLinearColor(0.6f, 1.f, 0.6f), Cx + 20.f, Cy + 16.f, 1.0f * Scale);
	}
}
