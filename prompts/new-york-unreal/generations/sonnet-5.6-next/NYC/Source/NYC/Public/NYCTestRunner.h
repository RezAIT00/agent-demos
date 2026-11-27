#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "NYCTestRunner.generated.h"

class ACameraActor;
class FJsonObject;
class FJsonValue;
class ANYCDestruction;
struct FNYCAim;
struct FNYCTool;

/** Plays a json script of camera moves, weather, destruction and screenshots in a running game. */
UCLASS(Transient)
class ANYCTestRunner : public AActor
{
	GENERATED_BODY()
public:
	ANYCTestRunner();
	bool Load(const FString& Path);
	virtual void Tick(float Dt) override;

private:
	void Run(const TSharedPtr<FJsonObject>& Event);
	void SetCamera(const TSharedPtr<FJsonObject>& O);
	void SetWeather(const TSharedPtr<FJsonObject>& O);
	void UseTool(const TSharedPtr<FJsonObject>& O);

	// the destruction audit (NYCTestRunnerAudit.cpp): every tool on a freshly rebuilt city
	void BeginAudit(const TSharedPtr<FJsonObject>& O);
	void TickAudit(float Dt);
	TArray<FString> AuditIds;
	TArray<FString> AuditReport;
	FString AuditDir;
	FVector AuditSite = FVector(0, 6000, 0);
	TSharedPtr<FNYCAim> AuditAim;
	int32 AuditIndex = 0;
	int32 AuditPhase = 0;
	double AuditClock = 0.0;
	float AuditSettle = 2.0f;
	float AuditWorstFrame = 0.f;
	bool bAudit = false;

	// frame-rate measurement over a stretch of the script
	void TickPerf();
	bool bPerf = false;
	FString PerfLabel;
	double PerfStart = 0.0, PerfUntil = 0.0, PerfLastReal = 0.0;
	FVector PerfFrom, PerfTo;
	TArray<float> PerfFrames;
	double PerfGpu = 0.0, PerfGame = 0.0, PerfRender = 0.0;

	TSharedPtr<FJsonObject> Script;
	TArray<TSharedPtr<FJsonValue>> Events;
	TArray<FString> Report;
	int32 Next = 0;
	int32 WarmFrames = 0;
	double Elapsed = 0.0;
	double LastReal = 0.0;
	float AverageFrame = 0.033f;
	FVector CameraBase = FVector::ZeroVector;
	UPROPERTY() ACameraActor* Camera = nullptr;
};
