#pragma once

#include "CoreMinimal.h"

class ANYCDestruction;

/** What the player (or a film script, or the audit) is pointing at. */
struct FNYCAim
{
	FVector Origin = FVector::ZeroVector;      // the viewer
	FVector Point = FVector::ZeroVector;       // what the crosshair rests on
	FVector Normal = FVector::UpVector;
	FVector Dir = FVector::ForwardVector;      // from the viewer toward the point
	int32 Building = INDEX_NONE;
};

/** What the audit points a tool at on a fresh scene. */
enum class ENYCTarget : uint8
{
	Facade,         // low on a masonry front
	FacadeHigh,     // several floors up
	GroundFloor,    // a storefront
	Street,         // open roadway
	Roof,           // top of a mid-rise
	Car,            // a parked or passing car
	Tree,           // a street tree
	Pole,           // a lamp post or signal
	Hydrant,
	Box,            // mailbox, news box, litter basket
	District        // wide open view over several blocks
};

struct FNYCTool
{
	FString Id;
	FString Name;
	int32 Tier = 1;                 // 1 hand tools ... 8 world ending
	FString Category;
	FString Does;
	FString Built;
	ENYCTarget Target = ENYCTarget::Facade;
	float Watch = 4.f;              // seconds before the audit takes the "after" picture
	float ViewDistance = 18.f;      // audit camera, metres
	float ViewHeight = 5.f;
	TFunction<void(ANYCDestruction&, const FNYCAim&)> Use;
};

namespace NYCArsenal
{
	/** Every tool, smallest first. */
	NYC_API const TArray<FNYCTool>& Tools();
	NYC_API const FNYCTool* Find(const FString& Id);
	NYC_API int32 IndexOf(const FString& Id);
	NYC_API void Use(ANYCDestruction& D, const FString& Id, const FNYCAim& Aim);
	NYC_API FNYCAim MakeAim(ANYCDestruction& D, const FVector& Origin, const FVector& Dir);
	NYC_API const TCHAR* TierName(int32 Tier);

	void RegisterHand(TArray<FNYCTool>& Out);
	void RegisterCharges(TArray<FNYCTool>& Out);
	void RegisterMachines(TArray<FNYCTool>& Out);
	void RegisterOrdnance(TArray<FNYCTool>& Out);
	void RegisterHazards(TArray<FNYCTool>& Out);
	void RegisterAbsurd(TArray<FNYCTool>& Out);
	void RegisterAlien(TArray<FNYCTool>& Out);
	void RegisterCataclysm(TArray<FNYCTool>& Out);
}
