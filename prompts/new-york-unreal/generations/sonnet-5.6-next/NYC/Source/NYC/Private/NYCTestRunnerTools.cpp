// The test runner's tool event: {"t":1,"do":"tool","id":"grenade","from":[x,y,z],"at":[x,y,z]}
#include "NYCTestRunner.h"
#include "NYC.h"
#include "NYCArsenal.h"
#include "NYCDestruction.h"
#include "Dom/JsonObject.h"

void ANYCTestRunner::UseTool(const TSharedPtr<FJsonObject>& E)
{
	ANYCDestruction* D = ANYCDestruction::Get(GetWorld());
	if (!D) return;
	auto Vector = [&E](const TCHAR* Name, const FVector& Default)
	{
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (!E->TryGetArrayField(Name, A) || A->Num() < 3) return Default;
		return FVector((*A)[0]->AsNumber(), (*A)[1]->AsNumber(), (*A)[2]->AsNumber());
	};
	const FString Id = E->GetStringField(TEXT("id"));
	const FVector From = Vector(TEXT("from"), CameraBase);
	const FVector At = Vector(TEXT("at"), From + FVector(1000, 0, -200));
	const FNYCAim Aim = NYCArsenal::MakeAim(*D, From, At - From);
	NYCArsenal::Use(*D, Id, Aim);
}
