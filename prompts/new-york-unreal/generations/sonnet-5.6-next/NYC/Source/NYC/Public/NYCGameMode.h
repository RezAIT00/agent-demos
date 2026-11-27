#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/DefaultPawn.h"
#include "GameFramework/HUD.h"
#include "NYCGameMode.generated.h"

class ANYCWeatherController;

/** Free-flying camera with keys for every weather state and time of day. */
UCLASS()
class NYC_API ANYCFlyPawn : public ADefaultPawn
{
	GENERATED_BODY()
public:
	ANYCFlyPawn();
	virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void BeginPlay() override;
	virtual void CalcCamera(float DeltaTime, struct FMinimalViewInfo& OutResult) override;

	bool bShowHelp = true;
	/** Off for audits and engineering shots: nothing at all is drawn over the picture. */
	bool bHideHud = false;
	FString Status;

	// destruction: the chosen tool and the list panel
	int32 ToolIndex = 0;
	bool bSelector = false;
	FString ToolStatus;
	double ToolStatusUntil = 0.0;
	void SelectTool(int32 Index);
	void SetSelector(bool bOpen);

private:
	UPROPERTY() ANYCWeatherController* Weather = nullptr;
	ANYCWeatherController* GetWeather();
	void Preset(int32 Index);
	void Preset1() { Preset(1); }
	void Preset2() { Preset(2); }
	void Preset3() { Preset(3); }
	void Preset4() { Preset(4); }
	void Preset5() { Preset(5); }
	void Preset6() { Preset(6); }
	void Preset7() { Preset(7); }
	void Preset8() { Preset(8); }
	void Preset9() { Preset(9); }
	void TimeBack();
	void TimeForward();
	void RainDown();
	void RainUp();
	void SnowDown();
	void SnowUp();
	void CloudDown();
	void CloudUp();
	void FogToggle();
	void WindDown();
	void WindUp();
	void Lightning();
	void TimeLapse();
	void HelpToggle();
	void PeopleToggle();
	void SpeedUp();
	void SpeedDown();
	void NextView();
	void Dry();
	void FireTool();
	void NextTool();
	void PrevTool();
	void NextTier();
	void PrevTier();
	void ToggleSelector();
	void RebuildCity();
	void StepTool(int32 Delta);
	void StepTier(int32 Delta);
	double LastUse = -10.0;
	void Nudge(float& Value, float Delta, const TCHAR* Label);
	bool bTimeLapse = false;
	float Speed = 2400.f;
	int32 ViewIndex = 0;
};

UCLASS()
class NYC_API ANYCHUD : public AHUD
{
	GENERATED_BODY()
public:
	virtual void DrawHUD() override;
	virtual void NotifyHitBoxClick(FName BoxName) override;
	virtual void NotifyHitBoxBeginCursorOver(FName BoxName) override;
	virtual void NotifyHitBoxEndCursorOver(FName BoxName) override;

private:
	void DrawSelector(class ANYCFlyPawn* Pawn);
	void Panel(float X, float Y, float W, float H, float Alpha);
	void Shadowed(const FString& Text, const FLinearColor& Color, float X, float Y, float Scale = 1.f);
	int32 Hover = INDEX_NONE;
};

UCLASS()
class NYC_API ANYCGameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	ANYCGameMode();
};
