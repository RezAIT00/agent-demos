#include "NYCWalkers.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "Async/ParallelFor.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "HAL/IConsoleManager.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "RHICommandList.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

#include "Walkers/WalkerCity.h"

namespace
{
	TAutoConsoleVariable<int32> CVarWalkersShow(TEXT("nyc.Walkers.Show"), 1, TEXT("0 hides the pedestrians and skips their update."));
	TAutoConsoleVariable<int32> CVarWalkersForceLod(TEXT("nyc.Walkers.ForceLOD"), -1, TEXT("Draw every walker with this level of detail (0-3)."));
	TAutoConsoleVariable<int32> CVarWalkersLog(TEXT("nyc.Walkers.Log"), 0, TEXT("Log walker statistics every N frames."));
	TAutoConsoleVariable<float> CVarWalkersLodScale(TEXT("nyc.Walkers.LODScale"), 1.f, TEXT("Larger keeps detailed walkers further out."));
	TAutoConsoleVariable<int32> CVarWalkersFreezeCull(TEXT("nyc.Walkers.NoCull"), 0, TEXT("1 poses every walker whether or not the camera can see it."));
	TAutoConsoleVariable<int32> CVarWalkersCameraHiding(TEXT("nyc.Walkers.CameraHiding"), 0,
		TEXT("0: only someone about to pass through the lens thins out.  1: the original rule - nobody within 9 m of a low camera, ")
		TEXT("and anyone within 17 m at a cut stays hidden for that shot."));
	TAutoConsoleVariable<FString> CVarWalkersDump(TEXT("nyc.Walkers.Dump"), TEXT(""),
		TEXT("\"t0 t1 dt file\": at the next load, writes where every walker is over that span to Saved/<file> (CSV)."));

	constexpr int32 RowTexels = 128;
	constexpr int32 RowColours = 100;
	constexpr int32 NumColourTexels = 9;
	constexpr int32 NumLods = 4;
	constexpr int32 NumPropLods = 3;
	/** projected height in pixels below which each level of detail takes over */
	constexpr float LodPixels[3] = { 300.f, 104.f, 40.f };

	const FVector Hidden(0.0, 0.0, -400000.0);

	struct FWalkerBody
	{
		nycw::Skeleton Skel;
		nycw::VariantTraits Traits;
		TArray<FLinearColor> Coat, Legs, Accent, Bag, Shoe;
		FVector3f HeadPoint = FVector3f::ZeroVector;
		float HeadScale = 1.f, Style = 0.f, Vee = 0.f, VeeBottom = 126.f, Hem = 54.f, BodyScale = 1.f;
		int32 Mesh[NumLods] = { -1, -1, -1, -1 };
	};

	struct FSlotMesh
	{
		UInstancedStaticMeshComponent* Ism = nullptr;
		int32 Capacity = 0;
		int32 Used = 0;
		int32 LastUsed = 0;
		int32 Triangles = 0;
		TArray<FTransform> Xf;
		TArray<float> Data;        // row, fade per slot
	};

	struct FResidentState
	{
		nycw::Resident R;
		FVector4f Colours[NumColourTexels];
		int32 PropMeshR = -1, PropMeshL = -1, PropMeshUmbrella = -1;   // index into PropMeshes
		float PartnerOffset = 0.f;
		// last frame's pose, for motion vectors only
		nycw::Pose Previous;
		nycw::V3 PreviousRoot;
		float PreviousYaw = 0.f;
		uint64 PreviousFrame = 0;
		bool PreviousFull = false;
	};

	struct FWalkerFrame
	{
		float Tau = 0.f, S = 0.f, Speed = 0.f;     // lap-local time, distance along the route, speed
		nycw::V2 Pos;
		float Fade = 0.f;
		float Pixels = 0.f;
		float AvoidWeight = 0.f;
		int32 Lod = 3;
		int32 Row = -1;
		bool bVisible = false;
		// results
		FTransform Root;
		float Umbrella = 0.f;
		bool bUmbrella = false, bPropR = false, bPropL = false;
	};

	FLinearColor ReadColour(const TSharedPtr<FJsonValue>& V)
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		return FLinearColor((float)A[0]->AsNumber(), (float)A[1]->AsNumber(), (float)A[2]->AsNumber());
	}

	void ReadPalette(const TSharedPtr<FJsonObject>& O, const TCHAR* Name, TArray<FLinearColor>& Out)
	{
		for (const TSharedPtr<FJsonValue>& V : O->GetArrayField(Name)) Out.Add(ReadColour(V));
		if (!Out.Num()) Out.Add(FLinearColor(0.02f, 0.02f, 0.02f));
	}

	nycw::V3 ReadV3(const TSharedPtr<FJsonValue>& V)
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		return nycw::V3((float)A[0]->AsNumber(), (float)A[1]->AsNumber(), (float)A[2]->AsNumber());
	}

	bool ReadJson(const FString& Path, TSharedPtr<FJsonObject>& Out)
	{
		FString Text;
		if (!FFileHelper::LoadFileToString(Text, *Path)) return false;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
		return FJsonSerializer::Deserialize(Reader, Out) && Out.IsValid();
	}

	/** Street furniture the walking routes bend around: radius, and half length for long objects. */
	bool FurnitureShape(const FString& Mesh, float& Radius, float& HalfLength)
	{
		struct FShape { const TCHAR* Name; float R, Half; };
		static const FShape Shapes[] = {
			{ TEXT("streetlight"), 22, 0 }, { TEXT("signalpole"), 22, 0 }, { TEXT("hydrant"), 26, 0 }, { TEXT("mailbox"), 46, 0 },
			{ TEXT("newsbox"), 34, 0 }, { TEXT("litterbasket"), 36, 0 }, { TEXT("trashbags0"), 62, 80 }, { TEXT("trashbags1"), 62, 80 },
			{ TEXT("trashbags2"), 62, 80 }, { TEXT("tree0"), 30, 0 }, { TEXT("tree1"), 30, 0 }, { TEXT("tree2"), 30, 0 },
			{ TEXT("parklamp"), 18, 0 }, { TEXT("bikerack"), 48, 60 }, { TEXT("bollard"), 14, 0 }, { TEXT("munimeter"), 20, 0 },
			{ TEXT("busshelter"), 90, 145 }, { TEXT("foodcart"), 80, 55 }, { TEXT("subway"), 95, 170 }, { TEXT("planter"), 70, 40 },
			{ TEXT("steamstack"), 44, 0 } };
		for (const FShape& S : Shapes)
		{
			if (Mesh == S.Name) { Radius = S.R; HalfLength = S.Half; return true; }
		}
		return false;
	}
}

struct UNYCWalkerComponent::FImpl
{
	TArray<FWalkerBody> Variants;
	TArray<FResidentState> People;
	TArray<FSlotMesh> Slots;
	TArray<int32> PropMeshes;          // [prop * NumPropLods + lod] -> slot mesh
	TMap<FString, int32> PropByName;
	TArray<FLinearColor> Skins, Hairs;
	nycw::Signals Signals;

	TArray<FWalkerFrame> Frames;
	TArray<int32> Visible;
	/** Everyone's whereabouts every CoarseStep seconds of their lap, in one block of memory: enough for
	 *  culling and for finding neighbours, without touching each walker's own route. */
	static constexpr float CoarseStep = 2.f;
	struct FLap { int32 First = 0, Count = 0; float Period = 1.f, InvPeriod = 1.f, Step = CoarseStep; double Base = 0.0; float Scale = 1.f; };
	TArray<FLap> Laps;
	TArray<FVector3f> Coarse;      // x, y, ground z

	void BuildCoarse()
	{
		const int32 Num = People.Num();
		Laps.SetNum(Num);
		int32 Total = 0;
		for (int32 N = 0; N < Num; ++N)
		{
			const nycw::Walker& W = People[N].R.W;
			FLap& L = Laps[N];
			L.Period = W.Time.Period;
			L.InvPeriod = 1.f / FMath::Max(W.Time.Period, 0.01f);
			L.Base = W.Time.Base;
			L.Scale = W.Gait.Scale;
			L.Count = FMath::Max(2, FMath::CeilToInt(W.Time.Period / CoarseStep) + 1);
			L.Step = W.Time.Period / (float)(L.Count - 1);
			L.First = Total;
			Total += L.Count;
		}
		Coarse.SetNumUninitialized(Total);
		ParallelFor(Num, [this](int32 N)
		{
			const nycw::Walker& W = People[N].R.W;
			const FLap& L = Laps[N];
			for (int32 K = 0; K < L.Count; ++K)
			{
				const float Tau = FMath::Min(K * L.Step, L.Period - 0.001f);
				const float S = W.Time.Eval(Tau);
				const nycw::V2 At = W.Path.At(S);
				Coarse[L.First + K] = FVector3f(At.x, At.y, W.Path.GroundZ(S));
			}
		});
	}
	// neighbour lookup: people hashed into 4 m cells
	static constexpr int32 TableSize = 4096;
	TArray<int32> Head, Next;

	struct FObstacle { FVector Centre; float Radius; double Added; };
	TArray<FObstacle> Obstacles;
	TArray<FObstacle> PendingObstacles;

	double HideStart = -1.0e12;
	float HideSeconds = 1.6f, HideFrom = 1.f, HideTo = 1.f;
	int32 PendingHide = -1;             // 0 show, 1 hide: stamped with the clock at the next update
	float PendingHideSeconds = 1.6f;

	TSet<int32> ShotHidden;
	int32 HiddenShot = -999;
	uint64 Frame = 1;
	double LastTime = -1.0e12;

	static int32 CellHash(int32 X, int32 Y) { return (int32)(((uint32)X * 73856093u) ^ ((uint32)Y * 19349663u)) & (TableSize - 1); }
	static constexpr float CellSize = 700.f;
	/** every neighbour who can matter at any footstep on screen is within this of the rough positions */
	static constexpr float NeighbourReach = 1350.f;
	static int32 CellOf(float V) { return FMath::FloorToInt(V / CellSize); }

	float GlobalAlpha(double Time) const
	{
		if (Time < HideStart) return HideFrom;
		const float U = HideSeconds > 0.001f ? (float)((Time - HideStart) / HideSeconds) : 1.f;
		return FMath::Lerp(HideFrom, HideTo, nycw::Smooth01(U));
	}

	/** Sideways step to get past others at Time (see nycw::AvoidanceAt). */
	float AvoidAt(int32 Index, double Time, const int32* Near, int32 NumNear) const
	{
		return nycw::AvoidanceAt([this](int N) -> const nycw::Resident& { return People[N].R; }, Index, Time, Near, NumNear);
	}
};

UNYCWalkerComponent::UNYCWalkerComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetMobility(EComponentMobility::Movable);
}

UNYCWalkerComponent::~UNYCWalkerComponent() = default;

void UNYCWalkerComponent::OnUnregister()
{
	Super::OnUnregister();
}

int32 UNYCWalkerComponent::NumWalkers() const { return Impl ? Impl->People.Num() : 0; }

bool UNYCWalkerComponent::Load(const FString& TrafficFile, float PedestrianDensity)
{
	const double Start = FPlatformTime::Seconds();
	TSharedPtr<FImpl> New = MakeShared<FImpl>();
	TSharedPtr<FJsonObject> Bodies, Traffic;
	const FString BodiesPath = FPaths::Combine(FPaths::ProjectContentDir(), BodiesFile);
	const FString TrafficPath = FPaths::Combine(FPaths::ProjectContentDir(), TrafficFile);
	if (!ReadJson(BodiesPath, Bodies) || !ReadJson(TrafficPath, Traffic))
	{
		UE_LOG(LogNYC, Error, TEXT("Walkers: cannot read %s or %s"), *BodiesPath, *TrafficPath);
		return false;
	}

	UMaterialInterface* BaseMaterial = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("%s/M_Walker.M_Walker"), *AssetFolder));
	if (!BaseMaterial)
	{
		UE_LOG(LogNYC, Error, TEXT("Walkers: M_Walker is missing from %s (run ue/import_walkers.py and ue/materials_walkers.py)"), *AssetFolder);
		return false;
	}

	for (const TSharedPtr<FJsonValue>& V : Bodies->GetArrayField(TEXT("skins"))) New->Skins.Add(ReadColour(V));
	for (const TSharedPtr<FJsonValue>& V : Bodies->GetArrayField(TEXT("hairs"))) New->Hairs.Add(ReadColour(V));

	for (const TSharedPtr<FJsonValue>& V : Bodies->GetArrayField(TEXT("variants")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FWalkerBody B;
		const TArray<TSharedPtr<FJsonValue>>& Joints = O->GetArrayField(TEXT("joints"));
		if (Joints.Num() != nycw::B_COUNT)
		{
			UE_LOG(LogNYC, Error, TEXT("Walkers: walkers.json has %d bones, the code expects %d"), Joints.Num(), (int32)nycw::B_COUNT);
			return false;
		}
		for (int32 i = 0; i < nycw::B_COUNT; ++i) B.Skel.J[i] = ReadV3(Joints[i]);
		B.Skel.GripL = ReadV3(O->TryGetField(TEXT("gripL")));
		B.Skel.GripR = ReadV3(O->TryGetField(TEXT("gripR")));
		const TSharedPtr<FJsonObject> Foot = O->GetObjectField(TEXT("foot"));
		B.Skel.AnkleH = Foot->GetNumberField(TEXT("ankle"));
		B.Skel.HeelX = Foot->GetNumberField(TEXT("heel"));
		B.Skel.BallX = Foot->GetNumberField(TEXT("ball"));
		B.Skel.TipX = Foot->GetNumberField(TEXT("tip"));
		B.Skel.HipClear = O->GetNumberField(TEXT("hipClear"));
		B.Skel.Height = O->GetNumberField(TEXT("height"));
		B.Skel.Prepare();

		nycw::VariantTraits& T = B.Traits;
		T.Female = O->GetBoolField(TEXT("female"));
		T.Pace = O->GetNumberField(TEXT("pace"));
		T.Age = O->GetNumberField(TEXT("age"));
		T.ArmOut = O->GetNumberField(TEXT("armOut"));
		T.Umbrella = O->GetNumberField(TEXT("umbrella"));
		T.HoodUp = O->GetBoolField(TEXT("hoodUp"));
		T.Height = B.Skel.Height;
		FString Bag;
		O->TryGetStringField(TEXT("bag"), Bag);
		T.Shoulder = Bag == TEXT("handbag") || Bag == TEXT("tote") ? 1 : (Bag == TEXT("messenger") ? 2 : 0);
		for (const TSharedPtr<FJsonValue>& P : O->GetArrayField(TEXT("props")))
		{
			const FString Name = P->AsString();
			T.Briefcase |= Name == TEXT("briefcase");
			T.ShopBag |= Name == TEXT("shopbag");
			T.Phone |= Name == TEXT("phone");
			T.Coffee |= Name == TEXT("coffee");
		}
		const TSharedPtr<FJsonObject> Palettes = O->GetObjectField(TEXT("palettes"));
		ReadPalette(Palettes, TEXT("coat"), B.Coat);
		ReadPalette(Palettes, TEXT("legs"), B.Legs);
		ReadPalette(Palettes, TEXT("accent"), B.Accent);
		ReadPalette(Palettes, TEXT("bag"), B.Bag);
		ReadPalette(Palettes, TEXT("shoe"), B.Shoe);
		const nycw::V3 HeadPoint = ReadV3(O->TryGetField(TEXT("headPoint")));
		B.HeadPoint = FVector3f(HeadPoint.x, HeadPoint.y, HeadPoint.z);
		B.HeadScale = O->GetNumberField(TEXT("headScale"));
		B.Style = O->GetNumberField(TEXT("style"));
		B.Vee = O->GetNumberField(TEXT("vee"));
		B.VeeBottom = O->GetNumberField(TEXT("veeBottom"));
		B.Hem = O->GetNumberField(TEXT("longHem"));
		B.BodyScale = B.Skel.Height / 176.f;
		New->Variants.Add(MoveTemp(B));
	}
	if (!New->Variants.Num()) return false;

	// ---- the walking paths ----------------------------------------------------------------------
	nycw::CityInput City;
	City.Sig.Cycle = Traffic->GetNumberField(TEXT("cycle"));
	City.Sig.AveGreen = Traffic->GetNumberField(TEXT("aveGreen"));
	City.Sig.Yellow = Traffic->GetNumberField(TEXT("yellow"));
	City.Sig.AllRed = Traffic->GetNumberField(TEXT("allRed"));
	New->Signals = City.Sig;
	for (const TSharedPtr<FJsonValue>& V : Traffic->GetArrayField(TEXT("peds")))
	{
		std::vector<nycw::V2> Loop;
		for (const TSharedPtr<FJsonValue>& Pt : V->AsArray())
		{
			const TArray<TSharedPtr<FJsonValue>>& A = Pt->AsArray();
			Loop.push_back(nycw::V2((float)(A[0]->AsNumber() * 100.0), (float)(A[1]->AsNumber() * 100.0)));
		}
		City.Loops.push_back(std::move(Loop));
	}
	if (Traffic->HasField(TEXT("crossings")))
	{
		for (const TSharedPtr<FJsonValue>& V : Traffic->GetArrayField(TEXT("crossings")))
		{
			const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
			City.Crossings.push_back({ nycw::V2((float)(A[0]->AsNumber() * 100.0), (float)(A[1]->AsNumber() * 100.0)),
				nycw::V2((float)(A[2]->AsNumber() * 100.0), (float)(A[3]->AsNumber() * 100.0)),
				(int32)A[4]->AsNumber(), (float)A[5]->AsNumber() });
		}
	}
	if (Traffic->HasField(TEXT("lanes")))
	{
		for (const TSharedPtr<FJsonValue>& V : Traffic->GetArrayField(TEXT("lanes")))
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			const TArray<TSharedPtr<FJsonValue>>& P = O->GetArrayField(TEXT("p0"));
			const TArray<TSharedPtr<FJsonValue>>& D = O->GetArrayField(TEXT("dir"));
			const double Len = O->GetNumberField(TEXT("length"));
			const nycw::V2 A((float)(P[0]->AsNumber() * 100.0), (float)(P[1]->AsNumber() * 100.0));
			const nycw::V2 B = A + nycw::V2((float)(D[0]->AsNumber() * Len * 100.0), (float)(D[1]->AsNumber() * Len * 100.0));
			City.Lanes.push_back({ A, B });
		}
	}
	// street furniture comes from whatever the level has placed
	for (TActorIterator<ANYCCityActor> It(GetWorld()); It; ++It)
	{
		for (UInstancedStaticMeshComponent* C : It->Groups)
		{
			if (!C || !C->GetStaticMesh()) continue;
			float Radius = 0.f, Half = 0.f;
			if (!FurnitureShape(C->GetStaticMesh()->GetName(), Radius, Half)) continue;
			for (int32 i = 0; i < C->GetInstanceCount(); ++i)
			{
				FTransform Xf;
				C->GetInstanceTransform(i, Xf, true);
				const FVector At = Xf.GetLocation();
				const FVector Along = Xf.GetUnitAxis(EAxis::X);
				const int32 Pieces = Half > 0.f ? 3 : 1;
				for (int32 k = 0; k < Pieces; ++k)
				{
					const FVector P = At + Along * (Pieces == 1 ? 0.f : Half * (float)(k - 1));
					City.Obstacles.push_back({ nycw::V2((float)P.X, (float)P.Y), Radius });
				}
			}
		}
	}

	std::vector<nycw::VariantTraits> Traits;
	for (const FWalkerBody& B : New->Variants) Traits.push_back(B.Traits);
	nycw::PopulationParams Params;
	Params.Density = PedestrianDensity;
	std::vector<nycw::Resident> Residents = nycw::Populate(City, Traits, Params);

	// ---- appearance ------------------------------------------------------------------------------
	const TArray<TSharedPtr<FJsonValue>>& PropList = Bodies->GetArrayField(TEXT("props"));
	for (int32 i = 0; i < PropList.Num(); ++i) New->PropByName.Add(PropList[i]->AsObject()->GetStringField(TEXT("name")), i);
	auto PropIndex = [&](const TCHAR* Name) { const int32* I = New->PropByName.Find(Name); return I ? *I : -1; };

	static const FLinearColor UmbrellaColours[] = {
		FLinearColor(0.008f, 0.008f, 0.009f), FLinearColor(0.008f, 0.008f, 0.009f), FLinearColor(0.008f, 0.008f, 0.009f),
		FLinearColor(0.008f, 0.008f, 0.009f), FLinearColor(0.008f, 0.008f, 0.009f), FLinearColor(0.012f, 0.016f, 0.045f),
		FLinearColor(0.012f, 0.016f, 0.045f), FLinearColor(0.22f, 0.012f, 0.01f), FLinearColor(0.14f, 0.15f, 0.17f),
		FLinearColor(0.012f, 0.06f, 0.035f), FLinearColor(0.42f, 0.24f, 0.02f), FLinearColor(0.06f, 0.012f, 0.05f) };

	New->People.SetNum((int32)Residents.size());
	for (int32 i = 0; i < New->People.Num(); ++i)
	{
		FResidentState& S = New->People[i];
		S.R = std::move(Residents[i]);
		const nycw::Resident& R = S.R;
		const FWalkerBody& B = New->Variants[R.Variant];
		const uint32 Seed = R.Seed;
		auto Pick = [Seed](const TArray<FLinearColor>& From, uint32 Channel)
		{
			return From[(int32)(nycw::Hash01(Seed, Channel) * From.Num()) % From.Num()];
		};
		auto Set = [&S](int32 K, const FLinearColor& C, float A) { S.Colours[K] = FVector4f(C.R, C.G, C.B, A); };
		const FLinearColor Coat = Pick(B.Coat, 201u);
		const FLinearColor Skin = Pick(New->Skins, 205u);
		FLinearColor Hair = Pick(New->Hairs, 206u);
		// grey comes with age, and darker skin keeps darker hair
		if (B.Traits.Age > 0.5f && nycw::Hash01(Seed, 207u) < 0.75f) Hair = FLinearColor(0.2f, 0.19f, 0.18f);
		else if (Skin.R < 0.3f && Hair.R > 0.05f) Hair = FLinearColor(0.012f, 0.008f, 0.006f);
		Set(0, Coat, 0.f);
		Set(1, Pick(B.Legs, 202u), B.Style);
		Set(2, Pick(B.Accent, 203u), B.Vee);
		Set(3, Pick(B.Bag, 204u), B.BodyScale);
		Set(4, Pick(B.Shoe, 208u), B.Hem);
		Set(5, Skin, B.VeeBottom);
		Set(6, Hair, nycw::Hash01(Seed, 209u));
		S.Colours[7] = FVector4f(B.HeadPoint.X, B.HeadPoint.Y, B.HeadPoint.Z, B.HeadScale);
		Set(8, UmbrellaColours[(int32)(nycw::Hash01(Seed, 210u) * UE_ARRAY_COUNT(UmbrellaColours)) % UE_ARRAY_COUNT(UmbrellaColours)],
			B.Traits.Female ? 1.f : 0.f);

		auto PropFor = [&](int32 Kind, bool bRight)
		{
			switch (Kind)
			{
			case nycw::PROP_BRIEFCASE: return PropIndex(bRight ? TEXT("briefcaseR") : TEXT("briefcaseL"));
			case nycw::PROP_SHOPBAG: return PropIndex(bRight ? TEXT("shopbagR") : TEXT("shopbagL"));
			case nycw::PROP_PHONE: return bRight ? PropIndex(TEXT("phone")) : -1;
			case nycw::PROP_COFFEE: return bRight ? PropIndex(TEXT("coffee")) : -1;
			default: return -1;
			}
		};
		S.PropMeshR = PropFor(R.PropR, true);
		S.PropMeshL = PropFor(R.PropL, false);
		S.PropMeshUmbrella = PropIndex(R.UmbrellaStyle ? TEXT("umbrella1") : TEXT("umbrella0"));
	}

	// ---- instanced meshes --------------------------------------------------------------------------
	BoneTexture = UTexture2D::CreateTransient(RowTexels, FMath::Max(New->People.Num(), 64), PF_A32B32G32R32F);
	BoneTexture->SRGB = false;
	BoneTexture->Filter = TF_Nearest;
	BoneTexture->AddressX = TA_Clamp;
	BoneTexture->AddressY = TA_Clamp;
	BoneTexture->NeverStream = true;
	BoneTexture->CompressionSettings = TC_HDR;
	{
		FTexture2DMipMap& Mip = BoneTexture->GetPlatformData()->Mips[0];
		void* Pixels = Mip.BulkData.Lock(LOCK_READ_WRITE);
		FMemory::Memzero(Pixels, Mip.BulkData.GetBulkDataSize());
		Mip.BulkData.Unlock();
	}
	BoneTexture->UpdateResource();
	Material = UMaterialInstanceDynamic::Create(BaseMaterial, this);
	Material->SetTextureParameterValue(TEXT("BoneTex"), BoneTexture);

	Meshes.Reset();
	auto AddSlotMesh = [&](const FString& Name, int32 Capacity, bool bShadow) -> int32
	{
		UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, *FString::Printf(TEXT("%s/%s.%s"), *AssetFolder, *Name, *Name));
		if (!Mesh)
		{
			UE_LOG(LogNYC, Warning, TEXT("Walkers: missing mesh %s"), *Name);
			return -1;
		}
		if (Capacity <= 0) return -1;
		UInstancedStaticMeshComponent* C = NewObject<UNYCWalkerInstances>(GetOwner(), NAME_None, RF_Transient);
		C->SetMobility(EComponentMobility::Movable);
		C->SetStaticMesh(Mesh);
		C->SetMaterial(0, Material);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		// otherwise every bounds update walks all the instances again on behalf of the navigation system
		C->SetCanEverAffectNavigation(false);
		C->NumCustomDataFloats = 2;
		C->CastShadow = bShadow;
		C->bAffectDistanceFieldLighting = false;
		C->bAffectDynamicIndirectLighting = false;
		// the ray tracing scene would hold the unposed body, so walkers stay out of it
		C->bVisibleInRayTracing = false;
		C->WorldPositionOffsetDisableDistance = 0;
		C->bEvaluateWorldPositionOffset = true;
		C->bWorldPositionOffsetWritesVelocity = true;
		C->BoundsScale = 1.35f;
		C->SetupAttachment(this);
		C->RegisterComponent();

		FSlotMesh M;
		M.Ism = C;
		M.Capacity = Capacity;
		M.Triangles = Mesh->GetNumTriangles(0);
		M.Xf.Init(FTransform(FQuat::Identity, Hidden, FVector(0.001)), Capacity);
		M.Data.SetNumZeroed(Capacity * 2);
		C->AddInstances(M.Xf, false, true);
		Meshes.Add(C);
		return New->Slots.Add(MoveTemp(M));
	};

	TArray<int32> PerVariant;
	PerVariant.SetNumZeroed(New->Variants.Num());
	TArray<int32> PerProp;
	PerProp.SetNumZeroed(PropList.Num());
	for (const FResidentState& S : New->People)
	{
		++PerVariant[S.R.Variant];
		for (const int32 P : { S.PropMeshR, S.PropMeshL }) if (P >= 0) ++PerProp[P];
		if ((S.R.UmbrellaRain < 1.5f || S.R.UmbrellaSnow < 1.5f) && S.PropMeshUmbrella >= 0) ++PerProp[S.PropMeshUmbrella];
	}
	for (int32 V = 0; V < New->Variants.Num(); ++V)
	{
		for (int32 L = 0; L < NumLods; ++L)
		{
			New->Variants[V].Mesh[L] = AddSlotMesh(FString::Printf(TEXT("walker_%02d_l%d"), V, L), PerVariant[V], true);
		}
	}
	New->PropMeshes.Init(-1, PropList.Num() * NumPropLods);
	for (int32 P = 0; P < PropList.Num(); ++P)
	{
		const FString Name = PropList[P]->AsObject()->GetStringField(TEXT("name"));
		for (int32 L = 0; L < NumPropLods; ++L)
		{
			New->PropMeshes[P * NumPropLods + L] = AddSlotMesh(FString::Printf(TEXT("prop_%s_l%d"), *Name, L), PerProp[P], L < 2);
		}
	}

	New->BuildCoarse();
	New->Frames.SetNum(New->People.Num());
	New->Next.SetNum(New->People.Num());
	New->Head.SetNum(FImpl::TableSize);
	Impl = MoveTemp(New);
	Stats = FNYCWalkerStats();
	Stats.Total = Impl->People.Num();
	UE_LOG(LogNYC, Log, TEXT("Walkers: %d pedestrians, %d bodies, %d crossings, %d pieces of furniture, built in %.2f s"),
		Impl->People.Num(), Impl->Variants.Num(), (int32)City.Crossings.size(), (int32)City.Obstacles.size(),
		FPlatformTime::Seconds() - Start);
	// a table of where everyone will be, for choosing camera positions and checking behaviour
	TArray<FString> Spec;
	CVarWalkersDump.GetValueOnGameThread().ParseIntoArrayWS(Spec);
	if (Spec.Num() == 4)
	{
		const double T0 = FCString::Atod(*Spec[0]), T1 = FCString::Atod(*Spec[1]), Dt = FMath::Max(FCString::Atod(*Spec[2]), 0.02);
		FString Csv = TEXT("t,id,x,y,z,dx,dy,speed,variant,partner,standing,archetype,umbrella\n");
		for (double T = T0; T <= T1 + 1.0e-6; T += Dt)
		{
			for (int32 N = 0; N < Impl->People.Num(); ++N)
			{
				FVector P, D;
				float Speed = 0.f;
				Locate(N, T, P, D, Speed);
				const nycw::Resident& R = Impl->People[N].R;
				Csv += FString::Printf(TEXT("%.3f,%d,%.1f,%.1f,%.1f,%.3f,%.3f,%.1f,%d,%d,%d,%d,%.2f\n"), T, N, P.X, P.Y, P.Z, D.X, D.Y,
					Speed, R.Variant, R.Partner, R.W.Path.bFixed ? 1 : 0, R.Archetype, R.UmbrellaRain);
			}
		}
		FFileHelper::SaveStringToFile(Csv, *FPaths::Combine(FPaths::ProjectSavedDir(), Spec[3]));
	}
	return true;
}

void UNYCWalkerComponent::SetHidden(bool bHidden, float FadeSeconds)
{
	if (!Impl) return;
	// callers may repeat themselves every frame: only a change starts a new fade
	const bool bTarget = Impl->PendingHide >= 0 ? Impl->PendingHide == 1 : Impl->HideTo < 0.5f;
	if (bTarget == bHidden) return;
	Impl->PendingHide = bHidden ? 1 : 0;
	Impl->PendingHideSeconds = FadeSeconds;
}

void UNYCWalkerComponent::AddObstacle(const FVector& Centre, float Radius)
{
	if (!Impl) return;
	for (FImpl::FObstacle& O : Impl->Obstacles)
	{
		if (FVector::Dist2D(O.Centre, Centre) < O.Radius * 0.6f)
		{
			O.Radius = FMath::Max(O.Radius, Radius);
			return;
		}
	}
	if (Impl->Obstacles.Num() + Impl->PendingObstacles.Num() < 64) Impl->PendingObstacles.Add({ Centre, Radius, 0.0 });
}

void UNYCWalkerComponent::Reset()
{
	if (!Impl) return;
	Impl->Obstacles.Reset();
	Impl->PendingObstacles.Reset();
	Impl->PendingHide = -1;
	Impl->HideStart = -1.0e12;
	Impl->HideFrom = Impl->HideTo = 1.f;
}

void UNYCWalkerComponent::Update(double Time, int32 Shot, const FNYCWalkerView& View, float Rain, float Snow, float Wind)
{
	if (!Impl) return;
	const double T0 = FPlatformTime::Seconds();
	FImpl& I = *Impl;
	const int32 Count = I.People.Num();
	const bool bShow = CVarWalkersShow.GetValueOnGameThread() != 0;
	++I.Frame;

	if (I.PendingHide >= 0)
	{
		const float Now = I.GlobalAlpha(Time);
		I.HideFrom = Now;
		I.HideTo = I.PendingHide == 1 ? 0.f : 1.f;
		I.HideStart = Time;
		I.HideSeconds = I.PendingHideSeconds;
		I.PendingHide = -1;
	}
	for (FImpl::FObstacle& O : I.PendingObstacles)
	{
		O.Added = Time;
		I.Obstacles.Add(O);
	}
	I.PendingObstacles.Reset();
	const float Global = bShow ? I.GlobalAlpha(Time) : 0.f;
	const bool bNewShot = Shot != I.HiddenShot;
	if (bNewShot) { I.ShotHidden.Reset(); I.HiddenShot = Shot; }

	// camera planes
	const FVector Cam = View.Location;
	const FRotationMatrix Basis(View.Rotation);
	const FVector Fwd = Basis.GetUnitAxis(EAxis::X), Right = Basis.GetUnitAxis(EAxis::Y), Up = Basis.GetUnitAxis(EAxis::Z);
	const float HalfH = FMath::DegreesToRadians(FMath::Clamp(View.FovDegrees, 4.f, 150.f) * 0.5f);
	const float TanH = FMath::Tan(HalfH);
	const float TanV = TanH / FMath::Max(View.Aspect, 0.5f);
	const FVector PlaneR = (Right - Fwd * TanH).GetSafeNormal(), PlaneL = (-Right - Fwd * TanH).GetSafeNormal();
	const FVector PlaneT = (Up - Fwd * TanV).GetSafeNormal(), PlaneB = (-Up - Fwd * TanV).GetSafeNormal();
	const float PixelScale = View.ResolutionY / (2.f * TanV) * FMath::Max(CVarWalkersLodScale.GetValueOnGameThread(), 0.05f);
	const bool bEveryone = CVarWalkersFreezeCull.GetValueOnGameThread() != 0;    // stress test: pose all of them
	const bool bCull = View.bCull && !bEveryone;
	const int32 ForceLod = CVarWalkersForceLod.GetValueOnGameThread();

	const double TPar0 = FPlatformTime::Seconds();
	double TWhere = TPar0;
	// ---- where is everybody, and who can be seen --------------------------------------------------
	// roughly (to a metre or so) from the compact table; exact positions are worked out only for those drawn
	for (int32 N = 0; N < Count; ++N)
	{
		FWalkerFrame& F = I.Frames[N];
		const FImpl::FLap& L = I.Laps[N];
		const double Since = (Time - L.Base) * (double)L.InvPeriod;
		F.Tau = (float)((Since - FMath::FloorToDouble(Since)) * (double)L.Period);
		const float Slot = FMath::Clamp(F.Tau / L.Step, 0.f, (float)(L.Count - 1) - 0.001f);
		const int32 K = (int32)Slot;
		const FVector3f At = FMath::Lerp(I.Coarse[L.First + K], I.Coarse[L.First + K + 1], Slot - (float)K);
		F.Pos = nycw::V2(At.X, At.Y);
		F.bVisible = false;
		F.Row = -1;
		const float Z = At.Z;
		const FVector Middle(At.X, At.Y, Z + 95.f);
		float Alpha = Global;
		for (const FImpl::FObstacle& O : I.Obstacles)
		{
			const float Ramp = nycw::Smooth01((float)(Time - O.Added) / 1.4f);
			const float Zone = O.Radius * 1.8f + 1200.f;
			const float D = (float)FVector::Dist2D(O.Centre, Middle);
			Alpha *= FMath::Lerp(1.f, nycw::SmoothRange(Zone - 150.f, Zone + 300.f, D), Ramp);
		}
		const FVector To = Middle - Cam;
		const float Dist = (float)To.Size();
		F.Pixels = View.bCull ? 178.f * L.Scale / FMath::Max(Dist, 60.f) * PixelScale : 1000.f;
		// gone only when smaller than a few pixels
		if (!bEveryone) Alpha *= nycw::SmoothRange(3.2f, 5.4f, F.Pixels);
		F.Fade = Alpha;
		if (Alpha <= 0.004f) continue;
		if (bCull)
		{
			// a margin keeps shadows from people just out of frame
			const float Margin = Dist < 3500.f ? 520.f : 190.f;
			const float Radius = 150.f * L.Scale + Margin + 100.f;
			if (FVector::DotProduct(To, Fwd) < -Radius) continue;
			if (FVector::DotProduct(To, PlaneR) > Radius || FVector::DotProduct(To, PlaneL) > Radius) continue;
			if (FVector::DotProduct(To, PlaneT) > Radius || FVector::DotProduct(To, PlaneB) > Radius) continue;
		}
		F.bVisible = true;
		F.Lod = F.Pixels >= LodPixels[0] ? 0 : (F.Pixels >= LodPixels[1] ? 1 : (F.Pixels >= LodPixels[2] ? 2 : 3));
		if (ForceLod >= 0) F.Lod = FMath::Min(ForceLod, NumLods - 1);
		// stepping aside only matters where it can be seen
		F.AvoidWeight = nycw::SmoothRange(14.f, 30.f, F.Pixels);
	}

	TWhere = FPlatformTime::Seconds();

	const bool bOriginalHiding = CVarWalkersCameraHiding.GetValueOnGameThread() != 0;
	const float CutClearance = bOriginalHiding ? (Cam.Z < 2500.f ? 1700.f : 0.f) : ShotStartClearance;
	if (CutClearance > 0.f && bNewShot)
	{
		for (int32 N = 0; N < Count; ++N)
		{
			if (FVector2D(I.Frames[N].Pos.x - Cam.X, I.Frames[N].Pos.y - Cam.Y).Size() < CutClearance) I.ShotHidden.Add(N);
		}
	}

	I.Visible.Reset();
	for (int32 H = 0; H < FImpl::TableSize; ++H) I.Head[H] = -1;
	for (int32 N = 0; N < Count; ++N)
	{
		FWalkerFrame& F = I.Frames[N];
		const int32 H = FImpl::CellHash(FImpl::CellOf(F.Pos.x), FImpl::CellOf(F.Pos.y));
		I.Next[N] = I.Head[H];
		I.Head[H] = N;
		if (F.bVisible && !I.ShotHidden.Contains(N))
		{
			F.Row = I.Visible.Add(N);
		}
	}
	const int32 NumVisible = I.Visible.Num();

	// ---- pose them ---------------------------------------------------------------------------------
	FVector4f* Rows = NumVisible ? (FVector4f*)FMemory::Malloc((SIZE_T)NumVisible * RowTexels * sizeof(FVector4f), 16) : nullptr;
	const bool bContinuous = FMath::Abs(Time - I.LastTime) < 0.25;
	const nycw::V2 WindDir(0.35f * Wind, 0.94f * Wind);

	ParallelFor(TEXT("NYCWalkerPose"), NumVisible, 20, [&](int32 Row)
	{
		const int32 N = I.Visible[Row];
		FResidentState& P = I.People[N];
		FWalkerFrame& F = I.Frames[N];
		const nycw::Resident& R = P.R;
		const nycw::Walker& W = R.W;
		const FWalkerBody& B = I.Variants[R.Variant];
		nycw::GaitState G;
		G.Tau = W.Time.Local(Time);
		G.S = W.Time.Eval(G.Tau, &G.Speed);
		for (int32 K = 0; K < 2; ++K) W.Plan.At(K, G.Tau, G.Cur[K], G.Next[K]);

		// neighbours who could get in the way during the footsteps being shown
		int32 Near[24];
		float NearD[24];
		int32 NumNear = 0;
		if (F.AvoidWeight > 0.001f && !W.Path.bFixed)
		{
			const int32 Cx = FImpl::CellOf(F.Pos.x), Cy = FImpl::CellOf(F.Pos.y);
			for (int32 Dx = -2; Dx <= 2; ++Dx)
			{
				for (int32 Dy = -2; Dy <= 2; ++Dy)
				{
					for (int32 J = I.Head[FImpl::CellHash(Cx + Dx, Cy + Dy)]; J >= 0; J = I.Next[J])
					{
						if (J == N) continue;
						const FWalkerFrame& O = I.Frames[J];
						if (FImpl::CellOf(O.Pos.x) != Cx + Dx || FImpl::CellOf(O.Pos.y) != Cy + Dy) continue;
						const nycw::V2 Rel = O.Pos - F.Pos;
						const float D2 = nycw::Dot(Rel, Rel);
						if (D2 > FImpl::NeighbourReach * FImpl::NeighbourReach) continue;
						if (NumNear < 24) { Near[NumNear] = J; NearD[NumNear++] = D2; }
						else
						{
							int32 Far = 0;
							for (int32 k = 1; k < 24; ++k) if (NearD[k] > NearD[Far]) Far = k;
							if (D2 < NearD[Far]) { Near[Far] = J; NearD[Far] = D2; }
						}
					}
				}
			}
		}
		nycw::LateralSet Lat;
		if (NumNear)
		{
			auto At = [&](float Local) { return I.AvoidAt(N, Time + (double)(Local - G.Tau), Near, NumNear) * F.AvoidWeight; };
			Lat.Now = At(G.Tau);
			for (int32 k = 0; k < 2; ++k)
			{
				Lat.Cur[k] = At(G.Cur[k].Land);
				Lat.Next[k] = At(G.Next[k].Land);
			}
		}

		nycw::PoseInput In;
		nycw::EvaluateGait(B.Skel, W, G, Lat, Time, In);
		// anyone about to pass through the lens thins out instead of filling it
		if (View.bCull && Cam.Z > In.RootPos.z - 30.f && Cam.Z < In.RootPos.z + 215.f)
		{
			const float Flat = (float)FVector2D(In.RootPos.x - Cam.X, In.RootPos.y - Cam.Y).Size();
			if (Flat < LensClearance + 25.f) F.Fade *= nycw::SmoothRange(LensClearance - 22.f, LensClearance + 25.f, Flat);
		}
		if (bOriginalHiding && View.bCull && Cam.Z < 900.f && FVector2D(In.RootPos.x - Cam.X, In.RootPos.y - Cam.Y).Size() < 900.0) F.Fade = 0.f;
		In.Wind = WindDir;
		const float Clock = In.Time;

		// ---- weather and habits -----------------------------------------------------------------
		const float OpenRain = nycw::SmoothRange(R.UmbrellaRain - 0.02f, R.UmbrellaRain + 0.07f, Rain);
		const float OpenSnow = nycw::SmoothRange(R.UmbrellaSnow - 0.03f, R.UmbrellaSnow + 0.1f, Snow);
		const float Up = FMath::Max(OpenRain, OpenSnow);
		const float ArmUp = nycw::Smooth01(Up / 0.5f);
		In.Umbrella = ArmUp;
		const float Cold = nycw::SmoothRange(R.ColdPockets, R.ColdPockets + 0.14f, Snow);
		const bool bHandBusyR = R.PropR != nycw::PROP_NONE;
		In.CarryL = R.CarryL;
		In.CarryR = R.CarryR * (1.f - ArmUp);
		In.PocketL = R.CarryL > 0.9f ? 0.f : FMath::Max(R.PocketL, Cold);
		In.PocketR = bHandBusyR ? 0.f : FMath::Max(R.PocketR, Cold) * (1.f - ArmUp);
		if (R.PropR == nycw::PROP_PHONE)
		{
			In.Phone = 1.f - ArmUp;
			// nobody reads under an umbrella with the same hand
			In.HeadPitch += -W.Gait.HeadPitch * ArmUp * 0.9f;
		}
		if (R.PropR == nycw::PROP_COFFEE)
		{
			In.Coffee = 1.f - ArmUp;
			In.Sip = nycw::SmoothRange(0.55f, 0.85f, nycw::Wander(R.Seed, 31u, Clock, 6.5f, 1.3f)) * (1.f - ArmUp);
		}
		In.HeadPitch += R.StandPitch * 0.25f;
		if (R.TalkSide != 0.f)
		{
			// the two take turns: one gestures while the other looks over and listens
			const uint32 Shared = R.Partner >= 0 ? FMath::Min(R.Seed, I.People[R.Partner].R.Seed) : R.Seed;
			const float Turn = nycw::Wander(Shared, 41u, Clock, 5.2f, 1.1f) * (R.TalkSide > 0.f ? 1.f : -1.f);
			const float Speaking = nycw::SmoothRange(0.18f, 0.55f, Turn);
			In.Talk = Speaking * (bHandBusyR ? 0.35f : 0.8f) * (1.f - ArmUp);
			In.TalkSide = R.TalkSide > 0.f ? 1.f : -1.f;
			if (FMath::Abs(R.TalkSide) > 0.5f)
			{
				const float Glance = nycw::SmoothRange(-0.15f, 0.45f, nycw::Wander(R.Seed, 42u, Clock, 3.4f, 0.8f));
				In.HeadYaw = FMath::Lerp(In.HeadYaw * 0.4f, R.TalkSide * 0.62f, Glance);
			}
			else
			{
				In.HeadYaw *= 0.25f;
			}
		}
		else if (R.PropR == nycw::PROP_PHONE)
		{
			In.HeadYaw *= 0.18f + 0.82f * ArmUp;
		}

		nycw::Pose Pose;
		nycw::SolvePose(B.Skel, W.Gait, In, Pose);

		const float Scale = W.Gait.Scale;
		FVector4f* Out = Rows + (SIZE_T)Row * RowTexels;
		static_assert(sizeof(FVector4f) == 16, "bone rows are written as raw floats");
		nycw::ToSkinFloats(B.Skel, Pose, reinterpret_cast<float*>(Out));
		const bool bHasPrevious = bContinuous && P.PreviousFrame == I.Frame - 1;
		if (F.Pixels < 40.f)
		{
			// small on screen: limbs move under a pixel a frame, so motion vectors only need the walk itself
			FMemory::Memcpy(Out + nycw::B_COUNT * 2, Out, nycw::B_COUNT * 2 * sizeof(FVector4f));
			if (bHasPrevious)
			{
				const nycw::V3 Moved = nycw::Rot(nycw::YawQ(-In.RootYaw), P.PreviousRoot - In.RootPos) * (1.f / Scale);
				for (int32 Bone = 0; Bone < nycw::B_COUNT; ++Bone)
				{
					FVector4f& T = Out[nycw::B_COUNT * 2 + Bone * 2 + 1];
					T.X += Moved.x;
					T.Y += Moved.y;
					T.Z += Moved.z;
				}
			}
			P.PreviousFull = false;
		}
		else
		{
			nycw::Pose Before = Pose;
			if (bHasPrevious && P.PreviousFull)
			{
				Before = P.Previous;
				nycw::Rebase(Before, P.PreviousRoot, P.PreviousYaw, In.RootPos, In.RootYaw, Scale);
			}
			nycw::ToSkinFloats(B.Skel, Before, reinterpret_cast<float*>(Out + nycw::B_COUNT * 2));
			P.Previous = Pose;
			P.PreviousFull = true;
		}
		P.PreviousRoot = In.RootPos;
		P.PreviousYaw = In.RootYaw;
		P.PreviousFrame = I.Frame;

		for (int32 K = 0; K < NumColourTexels; ++K) Out[RowColours + K] = P.Colours[K];
		Out[RowColours].W = nycw::Smooth01((Up - 0.3f) / 0.7f);

		F.Root = FTransform(FQuat(FVector::UpVector, (double)In.RootYaw), FVector(In.RootPos.x, In.RootPos.y, In.RootPos.z), FVector((double)Scale));
		F.bUmbrella = Up > 0.015f;
		F.bPropR = R.PropR != nycw::PROP_NONE && !(F.bUmbrella && (ArmUp > 0.35f));
		F.bPropL = R.PropL != nycw::PROP_NONE;
	});
	const double TPar1 = FPlatformTime::Seconds();
	I.LastTime = Time;

	// ---- hand them to the renderer -------------------------------------------------------------------
	for (FSlotMesh& M : I.Slots) M.Used = 0;
	auto Put = [&I](int32 Mesh, const FWalkerFrame& F)
	{
		if (Mesh < 0) return;
		FSlotMesh& M = I.Slots[Mesh];
		if (M.Used >= M.Capacity) return;
		M.Xf[M.Used] = F.Root;
		M.Data[M.Used * 2] = (float)F.Row;
		M.Data[M.Used * 2 + 1] = F.Fade;
		++M.Used;
	};
	int32 PerLod[NumLods] = { 0, 0, 0, 0 };
	for (int32 Row = 0; Row < NumVisible; ++Row)
	{
		const FResidentState& P = I.People[I.Visible[Row]];
		const FWalkerFrame& F = I.Frames[I.Visible[Row]];
		Put(I.Variants[P.R.Variant].Mesh[F.Lod], F);
		++PerLod[F.Lod];
		const int32 PropLod = F.Lod;
		if (PropLod < NumPropLods)
		{
			if (F.bUmbrella && P.PropMeshUmbrella >= 0) Put(I.PropMeshes[P.PropMeshUmbrella * NumPropLods + PropLod], F);
			if (F.bPropR && P.PropMeshR >= 0) Put(I.PropMeshes[P.PropMeshR * NumPropLods + PropLod], F);
			if (F.bPropL && P.PropMeshL >= 0) Put(I.PropMeshes[P.PropMeshL * NumPropLods + PropLod], F);
		}
		else if (F.bUmbrella && P.PropMeshUmbrella >= 0)
		{
			// umbrellas still read from far away
			Put(I.PropMeshes[P.PropMeshUmbrella * NumPropLods + NumPropLods - 1], F);
		}
	}
	int32 Triangles = 0;
	for (FSlotMesh& M : I.Slots)
	{
		const int32 Touch = FMath::Max(M.Used, M.LastUsed);
		if (!Touch) continue;
		for (int32 K = M.Used; K < M.LastUsed; ++K)
		{
			M.Xf[K] = FTransform(FQuat::Identity, Hidden, FVector(0.001));
			M.Data[K * 2] = 0.f;
			M.Data[K * 2 + 1] = 0.f;
		}
		M.Ism->BatchUpdateInstancesTransforms(0, MakeArrayView(M.Xf.GetData(), Touch), true, false, true);
		for (int32 K = 0; K < Touch; ++K) M.Ism->SetCustomData(K, MakeArrayView(M.Data.GetData() + K * 2, 2), false);
		M.Ism->MarkRenderInstancesDirty();
		M.LastUsed = M.Used;
		Triangles += M.Used * M.Triangles;
	}
	if (NumVisible && BoneTexture && BoneTexture->GetResource())
	{
		FUpdateTextureRegion2D* Region = new FUpdateTextureRegion2D(0, 0, 0, 0, RowTexels, NumVisible);
		BoneTexture->UpdateTextureRegions(0, 1, Region, RowTexels * sizeof(FVector4f), sizeof(FVector4f), reinterpret_cast<uint8*>(Rows),
			[](uint8* Data, const FUpdateTextureRegion2D* Regions)
			{
				FMemory::Free(Data);
				delete Regions;
			});
	}
	else if (Rows)
	{
		FMemory::Free(Rows);
	}

	const double T1 = FPlatformTime::Seconds();
	Stats.Total = Count;
	Stats.Drawn = NumVisible;
	for (int32 L = 0; L < NumLods; ++L) Stats.PerLod[L] = PerLod[L];
	Stats.Triangles = Triangles;
	Stats.UpdateMs = (T1 - T0) * 1000.0;
	Stats.ParallelMs = (TPar1 - TPar0) * 1000.0;
	Stats.WhereMs = (TWhere - TPar0) * 1000.0;
	Stats.SubmitMs = (T1 - TPar1) * 1000.0;
	const int32 Every = CVarWalkersLog.GetValueOnGameThread();
	if (Every > 0 && I.Frame % Every == 0)
	{
		UE_LOG(LogNYC, Log, TEXT("Walkers: %d of %d drawn (%d/%d/%d/%d by LOD, %.2f M tris), update %.3f ms (posing %.3f, submit %.3f)"),
			NumVisible, Count, PerLod[0], PerLod[1], PerLod[2], PerLod[3], Triangles / 1.0e6, Stats.UpdateMs, Stats.ParallelMs, Stats.SubmitMs);
	}
}

bool UNYCWalkerComponent::Locate(int32 Index, double Time, FVector& OutPosition, FVector& OutDirection, float& OutSpeed) const
{
	if (!Impl || !Impl->People.IsValidIndex(Index)) return false;
	const nycw::Walker& W = Impl->People[Index].R.W;
	const float Tau = W.Time.Local(Time);
	float Speed = 0.f;
	const float S = W.Time.Eval(Tau, &Speed);
	const nycw::V2 P = W.Path.At(S);
	const nycw::V2 D = W.Path.Heading(S, 60.f);
	OutPosition = FVector(P.x, P.y, W.Path.GroundZ(S));
	OutDirection = FVector(D.x, D.y, 0.f);
	OutSpeed = Speed;
	return true;
}

void UNYCWalkerComponent::FindCrossers(const FVector& Point, float Radius, double From, double To, TArray<int32>& Out) const
{
	if (!Impl) return;
	for (int32 N = 0; N < Impl->People.Num(); ++N)
	{
		const nycw::Walker& W = Impl->People[N].R.W;
		if (W.Time.Stops.empty()) continue;
		for (double T = From; T <= To; T += 1.0)
		{
			const float S = W.Time.Eval(W.Time.Local(T));
			const nycw::V2 P = W.Path.At(S);
			if (FVector2D(P.x - Point.X, P.y - Point.Y).Size() < Radius) { Out.Add(N); break; }
		}
	}
}
