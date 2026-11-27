#include "NYCBuilderLibrary.h"
#include "NYC.h"
#include "NYCCityActor.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "Engine/VolumeTexture.h"
#include "Materials/MaterialInterface.h"
#include "Materials/Material.h"

#if WITH_EDITOR
#include "AssetRegistry/AssetRegistryModule.h"
#include "MeshDescription.h"
#include "StaticMeshAttributes.h"
#include "UObject/SavePackage.h"
#include "ShaderCompiler.h"
#include "AssetCompilingManager.h"
#include "PhysicsEngine/BodySetup.h"
#endif

namespace
{
	/** Little-endian reader over a loaded file. */
	struct FReader
	{
		const uint8* P;
		const uint8* End;
		bool bOk = true;
		FReader(const TArray64<uint8>& D) : P(D.GetData()), End(D.GetData() + D.Num()) {}
		template <typename T> T Read()
		{
			T V{};
			if (P + sizeof(T) > End) { bOk = false; return V; }
			FMemory::Memcpy(&V, P, sizeof(T));
			P += sizeof(T);
			return V;
		}
		FString ReadString()
		{
			const uint16 Len = Read<uint16>();
			if (P + Len > End) { bOk = false; return FString(); }
			FUTF8ToTCHAR Conv(reinterpret_cast<const ANSICHAR*>(P), Len);
			P += Len;
			return FString(Conv.Length(), Conv.Get());
		}
		const uint8* Bytes(int64 N)
		{
			if (P + N > End) { bOk = false; return nullptr; }
			const uint8* R = P;
			P += N;
			return R;
		}
	};
}

UStaticMesh* UNYCBuilderLibrary::ImportNMesh(const FString& FilePath, const FString& PackagePath,
	const TMap<FName, UMaterialInterface*>& SlotMaterials, bool bNanite, int32 LumenCards, bool bPreserveArea)
{
#if WITH_EDITOR
	TArray64<uint8> Data;
	if (!FFileHelper::LoadFileToArray(Data, *FilePath))
	{
		UE_LOG(LogNYC, Error, TEXT("Cannot read %s"), *FilePath);
		return nullptr;
	}
	FReader R(Data);
	const uint32 Magic = R.Read<uint32>();
	const uint32 Version = R.Read<uint32>();
	if (Magic != 0x48534D4E || Version != 1)
	{
		UE_LOG(LogNYC, Error, TEXT("Bad nmesh header in %s"), *FilePath);
		return nullptr;
	}
	const int32 NumVerts = R.Read<uint32>();
	const int32 NumTris = R.Read<uint32>();
	const int32 NumSlots = R.Read<uint32>();
	TArray<FName> SlotNames;
	for (int32 i = 0; i < NumSlots; ++i)
	{
		SlotNames.Add(FName(*R.ReadString()));
	}
	const float* Pos = reinterpret_cast<const float*>(R.Bytes((int64)NumVerts * 12));
	const float* Nrm = reinterpret_cast<const float*>(R.Bytes((int64)NumVerts * 12));
	const float* UV0 = reinterpret_cast<const float*>(R.Bytes((int64)NumVerts * 8));
	const float* UV1 = reinterpret_cast<const float*>(R.Bytes((int64)NumVerts * 8));
	const uint8* Col = R.Bytes((int64)NumVerts * 4);
	const uint32* Idx = reinterpret_cast<const uint32*>(R.Bytes((int64)NumTris * 12));
	const uint16* TriSlot = reinterpret_cast<const uint16*>(R.Bytes((int64)NumTris * 2));
	if (!R.bOk || NumTris == 0)
	{
		UE_LOG(LogNYC, Error, TEXT("Truncated or empty nmesh %s"), *FilePath);
		return nullptr;
	}

	const FString AssetName = FPackageName::GetShortName(PackagePath);
	UPackage* Package = CreatePackage(*PackagePath);
	Package->FullyLoad();
	UStaticMesh* Mesh = FindObject<UStaticMesh>(Package, *AssetName);
	const bool bNew = (Mesh == nullptr);
	if (bNew)
	{
		Mesh = NewObject<UStaticMesh>(Package, *AssetName, RF_Public | RF_Standalone);
		Mesh->InitResources();
		Mesh->SetLightingGuid();
	}
	else
	{
		Mesh->ReleaseResources();
		Mesh->ReleaseResourcesFence.Wait();
		Mesh->InitResources();
	}

	Mesh->SetNumSourceModels(1);
	FStaticMeshSourceModel& SM = Mesh->GetSourceModel(0);
	SM.BuildSettings.bRecomputeNormals = false;
	SM.BuildSettings.bRecomputeTangents = true;
	SM.BuildSettings.bUseMikkTSpace = true;
	SM.BuildSettings.bRemoveDegenerates = true;
	SM.BuildSettings.bGenerateLightmapUVs = false;
	SM.BuildSettings.bUseFullPrecisionUVs = true;
	SM.BuildSettings.bBuildReversedIndexBuffer = false;
	SM.BuildSettings.DistanceFieldResolutionScale = 0.0f;
	SM.BuildSettings.MaxLumenMeshCards = LumenCards;

	FMeshDescription* MD = Mesh->CreateMeshDescription(0);
	FStaticMeshAttributes Attr(*MD);
	Attr.Register();
	TVertexAttributesRef<FVector3f> VPos = Attr.GetVertexPositions();
	TVertexInstanceAttributesRef<FVector3f> VNrm = Attr.GetVertexInstanceNormals();
	TVertexInstanceAttributesRef<FVector2f> VUV = Attr.GetVertexInstanceUVs();
	TVertexInstanceAttributesRef<FVector4f> VCol = Attr.GetVertexInstanceColors();
	TPolygonGroupAttributesRef<FName> GroupNames = Attr.GetPolygonGroupMaterialSlotNames();
	VUV.SetNumChannels(2);

	MD->ReserveNewVertices(NumVerts);
	MD->ReserveNewVertexInstances(NumVerts);
	MD->ReserveNewTriangles(NumTris);

	TArray<FVertexInstanceID> Inst;
	Inst.SetNumUninitialized(NumVerts);
	for (int32 i = 0; i < NumVerts; ++i)
	{
		const FVertexID V = MD->CreateVertex();
		VPos[V] = FVector3f(Pos[i * 3], Pos[i * 3 + 1], Pos[i * 3 + 2]);
		const FVertexInstanceID VI = MD->CreateVertexInstance(V);
		VNrm[VI] = FVector3f(Nrm[i * 3], Nrm[i * 3 + 1], Nrm[i * 3 + 2]);
		VUV.Set(VI, 0, FVector2f(UV0[i * 2], UV0[i * 2 + 1]));
		VUV.Set(VI, 1, FVector2f(UV1[i * 2], UV1[i * 2 + 1]));
		VCol[VI] = FVector4f(Col[i * 4] / 255.f, Col[i * 4 + 1] / 255.f, Col[i * 4 + 2] / 255.f, Col[i * 4 + 3] / 255.f);
		Inst[i] = VI;
	}

	TArray<FPolygonGroupID> Groups;
	TArray<FStaticMaterial> Materials;
	for (int32 i = 0; i < NumSlots; ++i)
	{
		const FPolygonGroupID G = MD->CreatePolygonGroup();
		GroupNames[G] = SlotNames[i];
		Groups.Add(G);
		UMaterialInterface* const* Found = SlotMaterials.Find(SlotNames[i]);
		UMaterialInterface* M = Found ? *Found : UMaterial::GetDefaultMaterial(MD_Surface);
		if (!Found)
		{
			UE_LOG(LogNYC, Warning, TEXT("No material for slot %s in %s"), *SlotNames[i].ToString(), *AssetName);
		}
		FStaticMaterial SMat(M, SlotNames[i], SlotNames[i]);
		SMat.UVChannelData = FMeshUVChannelInfo(1.f);
		Materials.Add(SMat);
	}

	for (int32 t = 0; t < NumTris; ++t)
	{
		// The generator winds counter-clockwise (right-handed maths); Unreal wants the opposite.
		const uint32 A = Idx[t * 3], B = Idx[t * 3 + 2], C = Idx[t * 3 + 1];
		if (A == B || B == C || A == C || A >= (uint32)NumVerts || B >= (uint32)NumVerts || C >= (uint32)NumVerts)
		{
			continue;
		}
		MD->CreateTriangle(Groups[TriSlot[t]], { Inst[A], Inst[B], Inst[C] });
	}

	Mesh->SetStaticMaterials(Materials);
	Mesh->CommitMeshDescription(0);

	FMeshNaniteSettings Nanite = Mesh->GetNaniteSettings();
	Nanite.bEnabled = bNanite;
	Nanite.FallbackTarget = ENaniteFallbackTarget::RelativeError;
	Nanite.FallbackRelativeError = 0.0f;
	Nanite.KeepPercentTriangles = 1.0f;
	Nanite.ShapePreservation = bPreserveArea ? ENaniteShapePreservation::PreserveArea : ENaniteShapePreservation::None;
	Mesh->SetNaniteSettings(Nanite);

	for (int32 i = 0; i < NumSlots; ++i)
	{
		FMeshSectionInfo Info = Mesh->GetSectionInfoMap().Get(0, i);
		Info.MaterialIndex = i;
		Info.bCastShadow = true;
		Info.bEnableCollision = false;
		Mesh->GetSectionInfoMap().Set(0, i, Info);
	}
	Mesh->GetOriginalSectionInfoMap().CopyFrom(Mesh->GetSectionInfoMap());

	Mesh->CreateBodySetup();
	if (UBodySetup* Body = Mesh->GetBodySetup())
	{
		Body->CollisionTraceFlag = CTF_UseSimpleAsComplex;
		Body->DefaultInstance.SetCollisionProfileName(TEXT("NoCollision"));
	}

	Mesh->SetImportVersion(EImportStaticMeshVersion::LastVersion);
	Mesh->Build(true);
	Mesh->PostEditChange();
	Package->MarkPackageDirty();
	if (bNew)
	{
		FAssetRegistryModule::AssetCreated(Mesh);
	}
	return Mesh;
#else
	return nullptr;
#endif
}

UVolumeTexture* UNYCBuilderLibrary::MakeVolumeTexture(const FString& PackagePath, UTexture2D* Atlas, int32 TileSize)
{
#if WITH_EDITOR
	if (!Atlas)
	{
		return nullptr;
	}
	const FString AssetName = FPackageName::GetShortName(PackagePath);
	UPackage* Package = CreatePackage(*PackagePath);
	Package->FullyLoad();
	UVolumeTexture* Vol = FindObject<UVolumeTexture>(Package, *AssetName);
	const bool bNew = (Vol == nullptr);
	if (bNew)
	{
		Vol = NewObject<UVolumeTexture>(Package, *AssetName, RF_Public | RF_Standalone);
	}
	Vol->PreEditChange(nullptr);
	Vol->Source2DTexture = Atlas;
	Vol->Source2DTileSizeX = TileSize;
	Vol->Source2DTileSizeY = TileSize;
	Vol->SRGB = false;
	Vol->CompressionSettings = TC_VectorDisplacementmap;
	Vol->MipGenSettings = TMGS_SimpleAverage;
	Vol->UpdateSourceFromSourceTexture();
	Vol->PostEditChange();
	Package->MarkPackageDirty();
	if (bNew)
	{
		FAssetRegistryModule::AssetCreated(Vol);
	}
	return Vol;
#else
	return nullptr;
#endif
}

int32 UNYCBuilderLibrary::LoadLayout(ANYCCityActor* City, const FString& FilePath, const FString& MeshFolder,
	const TMap<FName, UMaterialInterface*>& OverrideMaterials)
{
	if (!City)
	{
		return 0;
	}
	TArray64<uint8> Data;
	if (!FFileHelper::LoadFileToArray(Data, *FilePath))
	{
		UE_LOG(LogNYC, Error, TEXT("Cannot read layout %s"), *FilePath);
		return 0;
	}
	FReader R(Data);
	if (R.Read<uint32>() != 0x59414C4E)
	{
		UE_LOG(LogNYC, Error, TEXT("Bad layout header"));
		return 0;
	}
	const uint32 NumGroups = R.Read<uint32>();
	int32 Total = 0;
	TMap<FString, UStaticMesh*> Cache;
	const bool bCityLayout = FPaths::GetBaseFilename(FilePath) == TEXT("city");
	if (bCityLayout)
	{
		City->LayoutGroups.Reset();
		City->LayoutGroups.AddZeroed(NumGroups);
	}
	for (uint32 g = 0; g < NumGroups && R.bOk; ++g)
	{
		const FString GroupName = R.ReadString();
		const FString MeshName = R.ReadString();
		const FString OverrideName = R.ReadString();
		const uint8 Flags = R.Read<uint8>();
		const uint8 NumCustom = R.Read<uint8>();
		const uint32 Count = R.Read<uint32>();

		TArray<FTransform> Xf;
		Xf.Reserve(Count);
		TArray<float> Custom;
		Custom.Reserve(Count * NumCustom);
		for (uint32 i = 0; i < Count && R.bOk; ++i)
		{
			float V[7];
			for (int32 k = 0; k < 7; ++k) V[k] = R.Read<float>();
			// x, y, z, yaw (degrees), sx, sy, sz
			Xf.Emplace(FRotator(0.0, V[3], 0.0), FVector(V[0], V[1], V[2]), FVector(V[4], V[5], V[6]));
			for (int32 k = 0; k < NumCustom; ++k) Custom.Add(R.Read<float>());
		}

		UStaticMesh** Cached = Cache.Find(MeshName);
		UStaticMesh* Mesh = Cached ? *Cached : nullptr;
		if (!Cached)
		{
			const FString Path = FString::Printf(TEXT("%s/%s.%s"), *MeshFolder, *MeshName, *MeshName);
			Mesh = LoadObject<UStaticMesh>(nullptr, *Path);
			Cache.Add(MeshName, Mesh);
		}
		if (!Mesh)
		{
			UE_LOG(LogNYC, Warning, TEXT("Layout group %s: missing mesh %s"), *GroupName, *MeshName);
			continue;
		}
		// "slot=Material;slot=Material"; the slot name "*" replaces every slot
		TMap<int32, UMaterialInterface*> SlotOverrides;
		TArray<FString> Pairs;
		OverrideName.ParseIntoArray(Pairs, TEXT(";"), true);
		for (const FString& Pair : Pairs)
		{
			FString Slot, MatName;
			if (!Pair.Split(TEXT("="), &Slot, &MatName)) continue;
			UMaterialInterface* const* Found = OverrideMaterials.Find(FName(*MatName));
			if (!Found)
			{
				UE_LOG(LogNYC, Warning, TEXT("Layout group %s: missing material %s"), *GroupName, *MatName);
				continue;
			}
			if (Slot == TEXT("*"))
			{
				for (int32 i = 0; i < Mesh->GetStaticMaterials().Num(); ++i) SlotOverrides.Add(i, *Found);
			}
			else
			{
				const int32 Index = Mesh->GetMaterialIndex(FName(*Slot));
				if (Index != INDEX_NONE) SlotOverrides.Add(Index, *Found);
			}
		}
		UInstancedStaticMeshComponent* Added = City->AddGroup(GroupName, Mesh, Xf, Custom, NumCustom, (Flags & 1) != 0, (Flags & 2) != 0, SlotOverrides);
		if (bCityLayout) City->LayoutGroups[g] = Added;
		Total += Xf.Num();
	}
	City->MarkPackageDirty();
	return Total;
}

bool UNYCBuilderLibrary::SaveAssetObject(UObject* Asset)
{
#if WITH_EDITOR
	if (!Asset)
	{
		return false;
	}
	UPackage* Package = Asset->GetOutermost();
	const FString File = FPackageName::LongPackageNameToFilename(Package->GetName(), FPackageName::GetAssetPackageExtension());
	FSavePackageArgs Args;
	Args.TopLevelFlags = RF_Public | RF_Standalone;
	Args.SaveFlags = SAVE_NoError;
	return UPackage::SavePackage(Package, Asset, *File, Args);
#else
	return false;
#endif
}

void UNYCBuilderLibrary::FinishAllCompilation()
{
#if WITH_EDITOR
	FAssetCompilingManager::Get().FinishAllCompilation();
	if (GShaderCompilingManager)
	{
		GShaderCompilingManager->FinishAllCompilation();
	}
#endif
}
