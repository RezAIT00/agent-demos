// The destruction audit.  For every tool: rebuild the city, find a target of the kind the tool is meant for,
// put the camera where it can see it, take "before", use the tool, wait, take "after", and write down what
// the destruction system reports as broken.  tools/destruction_audit checks the numbers and the pictures.
#include "NYCTestRunner.h"
#include "NYC.h"
#include "NYCArsenal.h"
#include "NYCDestruction.h"
#include "NYCDestructionFX.h"
#include "NYCWeatherController.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Dom/JsonObject.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Misc/FileHelper.h"
#include "UnrealClient.h"
#include "NYCGameMode.h"

namespace NYCAuditScene
{
	/** A building front that looks onto the avenue through the site, preferring ordinary masonry mid-rises. */
	bool Front(ANYCDestruction& D, const FVector& Site, float Height, FNYCAim& Aim, int32 Skip = 0)
	{
		TArray<int32> Near;
		D.BuildingsNear(Site, 12000.f, Near);
		struct FPick { double Score; FVector Point, Normal; int32 Building; };
		TArray<FPick> Picks;
		for (int32 B : Near)
		{
			const FNYCBuildingInfo* I = D.Info(B);
			if (!I || I->Height < 1400.f || I->Height > 6500.f) continue;
			const FVector C = I->Box.GetCenter();
			const float Z = Height < 0.f ? FMath::Clamp(I->Height * 0.55f, 700.f, 2400.f) : Height;
			const FVector From(Site.X, C.Y, Z);
			FVector Point, Normal;
			int32 Hit = INDEX_NONE;
			if (D.Trace(From, (FVector(C.X, C.Y, Z) - From).GetSafeNormal(), 6000.f, Point, Normal, &Hit) < 0.f || Hit != B) continue;
			if (FMath::Abs(Normal.X) < 0.7 || FMath::Abs(Point.X - Site.X) > 2800.0) continue;
			const double Wide = I->Box.GetSize().Y;
			const double Score = FMath::Abs(C.Y - Site.Y) + (I->bMasonry ? 0.0 : 5000.0) + (Wide < 900.0 ? 2500.0 : 0.0) + FMath::Abs(I->Height - 3000.f) * 0.4;
			Picks.Add({ Score, Point, Normal, B });
		}
		Picks.Sort([](const FPick& A, const FPick& B) { return A.Score < B.Score; });
		if (!Picks.IsValidIndex(Skip)) return false;
		Aim.Point = Picks[Skip].Point;
		Aim.Normal = Picks[Skip].Normal;
		Aim.Building = Picks[Skip].Building;
		return true;
	}

	bool Clear(ANYCDestruction& D, const FVector& From, const FVector& To, float Slack)
	{
		FVector Point, Normal;
		const double Len = FVector::Dist(From, To);
		const float T = D.Trace(From, (To - From).GetSafeNormal(), (float)Len, Point, Normal, nullptr);
		return T < 0.f || T > Len - Slack;
	}

	/** Chooses a viewpoint at the asked distance and height with a clear line to the target. */
	FVector Viewpoint(ANYCDestruction& D, const FVector& Target, const FVector& Facing, float Distance, float Height, std::initializer_list<float> Angles)
	{
		const FVector Look = Target + FVector(0, 0, FMath::Max(0.0, 120.0 - Target.Z));
		for (float Scale : { 1.f, 0.8f, 0.62f, 1.3f, 0.45f })
		{
			for (float Angle : Angles)
			{
				const FVector Dir = FQuat(FVector::UpVector, FMath::DegreesToRadians(Angle)).RotateVector(Facing);
				FVector P = Target + Dir * Distance * Scale;
				P.Z = FMath::Max(150.0, (double)Height * (0.5f + 0.5f * Scale));
				int32 Inside = INDEX_NONE;
				if (D.NearestBuilding(P, 70.f, Inside)) continue;
				if (!Clear(D, P, Look + Facing * 40.0, 260.f)) continue;
				return P;
			}
		}
		return Target + Facing * Distance * 0.6 + FVector(0, 0, FMath::Max(Height * 2.f, 900.f));
	}

	bool Pick(ANYCDestruction& D, const FNYCTool& Tool, const FVector& Site, FNYCAim& Aim, FVector& Camera, FVector& LookAt)
	{
		const float Distance = Tool.ViewDistance * 100.f, Height = Tool.ViewHeight * 100.f;
		Aim = FNYCAim();
		FVector Facing(1, 0, 0);
		bool bFound = true;
		switch (Tool.Target)
		{
		case ENYCTarget::Facade:
		case ENYCTarget::FacadeHigh:
		case ENYCTarget::GroundFloor:
		{
			const float Z = Tool.Target == ENYCTarget::Facade ? (Tool.Tier <= 2 ? 250.f : 420.f) : Tool.Target == ENYCTarget::GroundFloor ? 200.f : -1.f;
			bFound = Front(D, Site, Z, Aim);
			if (bFound && Tool.Tier == 1)
			{
				// someone with a hand tool goes for the glass
				FVector Pane, Out;
				if (D.FindWindow(Aim.Point, 650.f, Aim.Normal, Pane, Out)) { Aim.Point = Pane; Aim.Normal = Out; }
			}
			Facing = Aim.Normal;
			Camera = Viewpoint(D, Aim.Point, Facing, Distance, Height, { 38.f, -38.f, 54.f, -54.f, 22.f, -22.f, 66.f, -66.f, 0.f });
			break;
		}
		case ENYCTarget::Roof:
		{
			bFound = Front(D, Site, 700.f, Aim);
			if (const FNYCBuildingInfo* I = D.Info(Aim.Building))
			{
				const FVector Out = Aim.Normal;
				const FVector Edge = FVector(Aim.Point.X, Aim.Point.Y, I->Height) - Out * 420.0;
				FVector Point, Normal;
				if (D.Trace(Edge + FVector(0, 0, 3000), FVector(0, 0, -1), 6000.f, Point, Normal, nullptr) >= 0.f) Aim.Point = Point;
				else Aim.Point = Edge;
				Aim.Normal = FVector::UpVector;
				Facing = Out;
				Camera = Aim.Point + FQuat(FVector::UpVector, 0.6f).RotateVector(Out) * Distance * 0.75 + FVector(0, 0, Height + 900.0);
			}
			break;
		}
		case ENYCTarget::Street:
		{
			Aim.Point = FVector(Site.X, Site.Y, 0);
			Aim.Normal = FVector::UpVector;
			Facing = FVector(0, -1, 0);
			Camera = Viewpoint(D, Aim.Point, Facing, Distance, Height, { 18.f, -18.f, 0.f, 32.f, -32.f });
			break;
		}
		case ENYCTarget::District:
		{
			Aim.Point = FVector(Site.X, Site.Y + 1200.0, 0);
			Aim.Normal = FVector::UpVector;
			Facing = FVector(0, -1, 0);
			if (Distance < 10000.f)
			{
				Camera = Viewpoint(D, Aim.Point + FVector(0, 0, 300), Facing, Distance, Height, { 10.f, -10.f, 0.f, 18.f, -18.f, 28.f });
			}
			else
			{
				// from the air: try the line down the avenue first, then swing out and climb until the view is clear
				bool bClear = false;
				for (float Rise : { 1.f, 1.4f, 1.9f, 2.6f, 3.4f })
				{
					for (float Swing : { 0.f, 0.06f, -0.06f, 0.3f, -0.3f, 0.62f, -0.62f, 1.2f })
					{
						Camera = Aim.Point + FQuat(FVector::UpVector, Swing).RotateVector(Facing) * Distance + FVector(0, 0, Height * Rise);
						int32 Inside = INDEX_NONE;
						if (D.NearestBuilding(Camera, 900.f, Inside)) continue;
						if (!Clear(D, Camera, Aim.Point + FVector(0, 0, 900), 1600.f)) continue;
						if (!Clear(D, Camera, Aim.Point + FVector(0, 0, 4000), 3200.f)) continue;
						bClear = true;
						break;
					}
					if (bClear) break;
				}
				if (!bClear) Camera = Aim.Point + Facing * Distance + FVector(0, 0, FMath::Max(Height * 4.f, 18000.f));
			}
			break;
		}
		default:
		{
			uint32 Mask = ANYCDestruction::MCar;
			if (Tool.Target == ENYCTarget::Tree) Mask = ANYCDestruction::MTree;
			else if (Tool.Target == ENYCTarget::Pole) Mask = ANYCDestruction::MPole;
			else if (Tool.Target == ENYCTarget::Hydrant) Mask = ANYCDestruction::MHydrant;
			else if (Tool.Target == ENYCTarget::Box) Mask = ANYCDestruction::MBox;
			int32 Prop = INDEX_NONE;
			for (float Reach : { 3500.f, 8000.f, 20000.f, 60000.f })
			{
				Prop = D.FindProp(Site, Mask, Reach);
				if (Prop != INDEX_NONE) break;
			}
			bFound = Prop != INDEX_NONE;
			const FVector At = bFound ? D.PropLocation(Prop) : Site;
			const float Lift = Tool.Target == ENYCTarget::Tree ? 190.f : Tool.Target == ENYCTarget::Pole ? 220.f : Tool.Target == ENYCTarget::Car ? 85.f : 55.f;
			Aim.Point = At + FVector(0, 0, Lift);
			Facing = FVector(At.X > Site.X ? -1.0 : 1.0, 0, 0);
			Camera = Viewpoint(D, Aim.Point, Facing, Distance, Height, { 48.f, -48.f, 70.f, -70.f, 28.f, -28.f, 0.f, 90.f, -90.f });
			Aim.Normal = (Camera - Aim.Point).GetSafeNormal();
			break;
		}
		}
		// who is using it: hand tools are held by someone standing at the target, everything else comes from the viewpoint
		if (Tool.Tier == 1 && Tool.Target != ENYCTarget::District && Tool.Target != ENYCTarget::Street)
		{
			FVector Back = FVector(Camera.X - Aim.Point.X, Camera.Y - Aim.Point.Y, 0).GetSafeNormal();
			Aim.Origin = Aim.Point + Back * 190.0;
			Aim.Origin.Z = FMath::Max(165.0, FMath::Min((double)Aim.Point.Z + 40.0, 260.0));
		}
		else Aim.Origin = Camera;
		Aim.Dir = (Aim.Point - Aim.Origin).GetSafeNormal();
		if (Aim.Building == INDEX_NONE) D.NearestBuilding(Aim.Point, 600.f, Aim.Building);
		LookAt = Aim.Point;
		if (Tool.Target == ENYCTarget::District) LookAt = Aim.Point + FVector(0, 0, FMath::Min(Distance * 0.09f, 3500.f));
		if (Tool.Target == ENYCTarget::Street) LookAt = Aim.Point + FVector(0, 0, 180);
		return bFound;
	}
}

void ANYCTestRunner::BeginAudit(const TSharedPtr<FJsonObject>& O)
{
	AuditIds.Reset();
	const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
	if (O->TryGetArrayField(TEXT("tools"), List))
	{
		for (const TSharedPtr<FJsonValue>& V : *List) AuditIds.Add(V->AsString());
	}
	else
	{
		double From = 0, To = 1000;
		O->TryGetNumberField(TEXT("from"), From);
		O->TryGetNumberField(TEXT("to"), To);
		const TArray<FNYCTool>& All = NYCArsenal::Tools();
		for (int32 i = (int32)From; i < FMath::Min((int32)To, All.Num()); ++i) AuditIds.Add(All[i].Id);
	}
	AuditDir = O->GetStringField(TEXT("out"));
	const TArray<TSharedPtr<FJsonValue>>* Site = nullptr;
	if (O->TryGetArrayField(TEXT("site"), Site) && Site->Num() >= 3) AuditSite = FVector((*Site)[0]->AsNumber(), (*Site)[1]->AsNumber(), (*Site)[2]->AsNumber());
	double Settle = AuditSettle;
	if (O->TryGetNumberField(TEXT("settle"), Settle)) AuditSettle = (float)Settle;
	AuditIndex = 0;
	if (ANYCDestruction* Director = ANYCDestruction::Get(GetWorld()))
	{
		Director->bNoPeopleEver = true;
		Director->ClearStreetsOfPeople();
	}
	AuditPhase = 0;
	bAudit = true;
	if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		if (ANYCFlyPawn* Pawn = Cast<ANYCFlyPawn>(PC->GetPawn())) { Pawn->bHideHud = true; }
	}
	UE_LOG(LogNYC, Display, TEXT("Audit: %d of %d tools"), AuditIds.Num(), NYCArsenal::Tools().Num());
}

void ANYCTestRunner::TickAudit(float Dt)
{
	ANYCDestruction* D = ANYCDestruction::Get(GetWorld());
	if (!D || !D->EnsureLoaded()) return;
	AuditClock += Dt;
	if (AuditIndex >= AuditIds.Num())
	{
		if (AuditPhase != 99)
		{
			AuditPhase = 99;
			AuditClock = 0;
		}
		else if (AuditClock > 0.5)
		{
			if (APlayerController* PC = GetWorld()->GetFirstPlayerController()) PC->ConsoleCommand(TEXT("quit"));
		}
		return;
	}
	const FString Id = AuditIds[AuditIndex];
	const FNYCTool* Tool = NYCArsenal::Find(Id);
	if (!Tool)
	{
		++AuditIndex;
		return;
	}
	const int32 Number = NYCArsenal::IndexOf(Id) + 1;
	const FString Stem = FString::Printf(TEXT("%s/%02d_%s"), *AuditDir, Number, *Id);
	static FVector LookAt;
	static bool bFound = false;
	switch (AuditPhase)
	{
	case 0:
	{
		D->ResetCity();
		GEngine->ForceGarbageCollection(true);
		for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It)
		{
			It->Month = 4; It->Day = 3; It->TimeOfDay = 8.5f; It->CloudCover = 0.28f; It->Storm = 0.f; It->Rain = 0.f; It->Snow = 0.f; It->Fog = 0.f;
			It->Wetness = 0.f; It->Puddles = 0.f; It->SnowCover = 0.f; It->Wind = 0.25f; It->ExposureBias = 1.0f; It->LightningPerMinute = 0.f;
		}
		AuditAim = MakeShared<FNYCAim>();
		FVector Cam;
		bFound = NYCAuditScene::Pick(*D, *Tool, AuditSite, *AuditAim, Cam, LookAt);
		// close to the ground the street is in shadow: open up for it, as a photographer would
		const bool bStreetLevel = Cam.Z < 1500.0;
		// the parked cars the audit picks stand on the shaded side of the street
		const bool bShaded = Tool->Target == ENYCTarget::Car;
		for (TActorIterator<ANYCWeatherController> It(GetWorld()); It; ++It) It->ExposureBias = bShaded ? 2.6f : bStreetLevel ? 1.35f : 0.95f;
		CameraBase = Cam;
		TSharedPtr<FJsonObject> O = MakeShared<FJsonObject>();
		SetCamera(O);
		Camera->SetActorLocationAndRotation(Cam, (LookAt - Cam).Rotation());
		Camera->GetCameraComponent()->SetFieldOfView(Tool->ViewDistance > 100.f ? 58.f : 64.f);
		AuditClock = 0;
		AuditPhase = 1;
		break;
	}
	case 1:
		if (AuditClock >= AuditSettle)
		{
			FScreenshotRequest::RequestScreenshot(Stem + TEXT("_before.png"), false, false);
			AuditClock = 0;
			AuditPhase = 2;
		}
		break;
	case 2:
		if (AuditClock >= 0.15)
		{
			D->Stats = FNYCDestructionStats();
			NYCArsenal::Use(*D, Id, *AuditAim);
			AuditClock = 0;
			AuditWorstFrame = 0.f;
			AuditPhase = 3;
		}
		break;
	case 3:
		AuditWorstFrame = FMath::Max(AuditWorstFrame, AverageFrame);
		if (AuditClock >= Tool->Watch)
		{
			FScreenshotRequest::RequestScreenshot(Stem + TEXT("_after.png"), false, false);
			const FNYCDestructionStats& S = D->Stats;
			const FString Line = FString::Printf(TEXT("{\"n\":%d,\"id\":\"%s\",\"name\":\"%s\",\"tier\":%d,\"found\":%s,\"elements\":%d,\"pieces\":%d,\"windows\":%d,\"props\":%d,\"vehicles\":%d,\"craters\":%d,\"buildings\":%d,\"collapses\":%d,\"collections\":%d,\"sounds\":%d,\"frame_ms\":%.1f,\"aim\":[%.0f,%.0f,%.0f],\"camera\":[%.0f,%.0f,%.0f],\"building\":%d}"),
				Number, *Id, *Tool->Name, Tool->Tier, bFound ? TEXT("true") : TEXT("false"), S.Elements, S.Pieces, S.Windows, S.Props, S.Vehicles, S.Craters, S.Buildings, S.Collapses, S.Collections,
				D->FX()->SoundLog.Num(), AuditWorstFrame * 1000.f, AuditAim->Point.X, AuditAim->Point.Y, AuditAim->Point.Z, CameraBase.X, CameraBase.Y, CameraBase.Z, AuditAim->Building);
			AuditReport.Add(Line);
			UE_LOG(LogNYC, Display, TEXT("Audit %s"), *Line);
			FFileHelper::SaveStringArrayToFile(AuditReport, *(AuditDir + FString::Printf(TEXT("/audit_%s.jsonl"), *AuditIds[0])));
			AuditClock = 0;
			AuditPhase = 4;
		}
		break;
	case 4:
		if (AuditClock >= 0.2)
		{
			++AuditIndex;
			AuditPhase = 0;
			AuditClock = 0;
		}
		break;
	default:
		break;
	}
}
