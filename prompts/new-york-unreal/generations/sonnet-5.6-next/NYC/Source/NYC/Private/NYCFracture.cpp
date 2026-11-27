#include "NYCFracture.h"
#include "NYC.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "GeometryCollection/GeometryCollection.h"
#include "GeometryCollection/GeometryCollectionObject.h"
#include "GeometryCollection/GeometryCollectionAlgo.h"
#include "GeometryCollection/GeometryCollectionUtility.h"
#include "GeometryCollection/GeometryCollectionConvexUtility.h"
#include "GeometryCollection/GeometryCollectionSimulationCoreTypes.h"
#include "GeometryCollection/Facades/CollectionAnchoringFacade.h"
#include "GeometryCollection/Facades/CollectionHierarchyFacade.h"
#include "GeometryCollection/Facades/CollectionUVFacade.h"
#if WITH_EDITOR
#include "MeshDescription.h"
#include "StaticMeshAttributes.h"
#endif

// ------------------------------------------------------------------ soup
FBox3f FNYCSoup::Bounds() const
{
	FBox3f B(ForceInit);
	for (const FVector3f& P : Pos) B += P;
	return B;
}

void FNYCSoup::Append(const FNYCSoup& O)
{
	const int32 Base = Pos.Num();
	Pos.Append(O.Pos);
	Nrm.Append(O.Nrm);
	UV0.Append(O.UV0);
	UV1.Append(O.UV1);
	Col.Append(O.Col);
	Tris.Reserve(Tris.Num() + O.Tris.Num());
	for (const FIntVector& T : O.Tris) Tris.Add(FIntVector(T.X + Base, T.Y + Base, T.Z + Base));
	Mat.Append(O.Mat);
}

void FNYCSoup::Transform(const FTransform3f& T)
{
	const FVector3f S = T.GetScale3D();
	const FVector3f InvS(S.X != 0 ? 1.f / S.X : 0.f, S.Y != 0 ? 1.f / S.Y : 0.f, S.Z != 0 ? 1.f / S.Z : 0.f);
	for (FVector3f& P : Pos) P = T.TransformPosition(P);
	for (FVector3f& N : Nrm) N = T.GetRotation().RotateVector(N * InvS).GetSafeNormal();
	if (S.X * S.Y * S.Z < 0.f)
	{
		for (FIntVector& Tri : Tris) Swap(Tri.Y, Tri.Z);
	}
}

void FNYCSoup::RemapMaterials(const TArray<int32>& Map)
{
	for (int32& M : Mat) M = Map.IsValidIndex(M) ? Map[M] : 0;
}

int32 FNYCSoup::AddVertex(const FVector3f& P, const FVector3f& N, const FVector2f& A, const FVector2f& B, const FVector4f& C)
{
	Nrm.Add(N);
	UV0.Add(A);
	UV1.Add(B);
	Col.Add(C);
	return Pos.Add(P);
}

void FNYCSoup::AddTri(int32 A, int32 B, int32 C, int32 Material)
{
	Tris.Add(FIntVector(A, B, C));
	Mat.Add(Material);
}

static FVector2f NycBoxUV(const FVector3f& P, const FVector3f& N)
{
	const FVector3f A = N.GetAbs();
	if (A.Z >= A.X && A.Z >= A.Y) return FVector2f(P.X, P.Y) * 0.01f;
	if (A.X >= A.Y) return FVector2f(P.Y, -P.Z) * 0.01f;
	return FVector2f(P.X, -P.Z) * 0.01f;
}

void FNYCSoup::AddQuad(const FVector3f& P0, const FVector3f& P1, const FVector3f& P2, const FVector3f& P3, int32 Material)
{
	// corners run counter-clockwise (right-handed) about the outward normal; Unreal wants the reverse winding
	FVector3f N = FVector3f::CrossProduct(P1 - P0, P2 - P0).GetSafeNormal();
	if (N.IsNearlyZero()) N = FVector3f::CrossProduct(P2 - P0, P3 - P0).GetSafeNormal();
	const FVector4f White(1, 1, 1, 1);
	const FVector3f* P[4] = { &P0, &P1, &P2, &P3 };
	const int32 Base = Pos.Num();
	for (int32 i = 0; i < 4; ++i)
	{
		AddVertex(*P[i], N, NycBoxUV(*P[i], N), FVector2f::ZeroVector, White);
	}
	AddTri(Base, Base + 2, Base + 1, Material);
	AddTri(Base, Base + 3, Base + 2, Material);
}

namespace NYCFracture
{

bool ReadMesh(UStaticMesh* Mesh, FNYCSoup& Out)
{
#if WITH_EDITOR
	if (!Mesh) return false;
	const FMeshDescription* MD = Mesh->GetMeshDescription(0);
	if (!MD) return false;
	FStaticMeshConstAttributes Attr(*MD);
	TVertexAttributesConstRef<FVector3f> VPos = Attr.GetVertexPositions();
	TVertexInstanceAttributesConstRef<FVector3f> VNrm = Attr.GetVertexInstanceNormals();
	TVertexInstanceAttributesConstRef<FVector2f> VUV = Attr.GetVertexInstanceUVs();
	TVertexInstanceAttributesConstRef<FVector4f> VCol = Attr.GetVertexInstanceColors();
	TPolygonGroupAttributesConstRef<FName> Slots = Attr.GetPolygonGroupMaterialSlotNames();

	TMap<FPolygonGroupID, int32> SlotOf;
	for (const FPolygonGroupID G : MD->PolygonGroups().GetElementIDs())
	{
		int32 Index = Mesh->GetMaterialIndexFromImportedMaterialSlotName(Slots[G]);
		SlotOf.Add(G, FMath::Max(Index, 0));
	}
	TMap<FVertexInstanceID, int32> Remap;
	const int32 NumUV = VUV.GetNumChannels();
	for (const FTriangleID Tri : MD->Triangles().GetElementIDs())
	{
		TArrayView<const FVertexInstanceID> Inst = MD->GetTriangleVertexInstances(Tri);
		int32 Idx[3];
		for (int32 k = 0; k < 3; ++k)
		{
			const FVertexInstanceID VI = Inst[k];
			if (const int32* Found = Remap.Find(VI))
			{
				Idx[k] = *Found;
				continue;
			}
			const FVector3f P = VPos[MD->GetVertexInstanceVertex(VI)];
			Idx[k] = Out.AddVertex(P, VNrm[VI], VUV.Get(VI, 0), NumUV > 1 ? VUV.Get(VI, 1) : FVector2f::ZeroVector, VCol[VI]);
			Remap.Add(VI, Idx[k]);
		}
		Out.AddTri(Idx[0], Idx[1], Idx[2], SlotOf.FindRef(MD->GetTrianglePolygonGroup(Tri)));
	}
	return Out.NumTris() > 0;
#else
	return false;
#endif
}

// ------------------------------------------------------------------ 2D polygons
static float SignedArea(const TArray<FVector2f>& P)
{
	float A = 0;
	for (int32 i = 0, n = P.Num(); i < n; ++i)
	{
		const FVector2f& U = P[i];
		const FVector2f& V = P[(i + 1) % n];
		A += U.X * V.Y - V.X * U.Y;
	}
	return A * 0.5f;
}

/** Keeps the part of a polygon where dot(P, N) >= D. */
static void ClipPoly(const TArray<FVector2f>& In, const FVector2f& N, float D, TArray<FVector2f>& Out)
{
	Out.Reset();
	const int32 Num = In.Num();
	for (int32 i = 0; i < Num; ++i)
	{
		const FVector2f A = In[i], B = In[(i + 1) % Num];
		const float DA = FVector2f::DotProduct(A, N) - D, DB = FVector2f::DotProduct(B, N) - D;
		if (DA >= 0) Out.Add(A);
		if ((DA >= 0) != (DB >= 0)) Out.Add(A + (B - A) * (DA / (DA - DB)));
	}
}

void Voronoi2D(const FVector2f& Min, const FVector2f& Max, int32 NX, int32 NY, FRandomStream& Rand, TArray<TArray<FVector2f>>& OutCells, float Jitter)
{
	NX = FMath::Max(NX, 1);
	NY = FMath::Max(NY, 1);
	const FVector2f Step((Max.X - Min.X) / NX, (Max.Y - Min.Y) / NY);
	TArray<FVector2f> Seeds;
	for (int32 j = 0; j < NY; ++j)
	{
		for (int32 i = 0; i < NX; ++i)
		{
			Seeds.Add(Min + FVector2f((i + 0.5f + (Rand.GetFraction() - 0.5f) * Jitter) * Step.X, (j + 0.5f + (Rand.GetFraction() - 0.5f) * Jitter) * Step.Y));
		}
	}
	TArray<FVector2f> Cell, Tmp;
	for (int32 s = 0; s < Seeds.Num(); ++s)
	{
		Cell = { Min, FVector2f(Max.X, Min.Y), Max, FVector2f(Min.X, Max.Y) };
		for (int32 o = 0; o < Seeds.Num() && Cell.Num() >= 3; ++o)
		{
			if (o == s) continue;
			const FVector2f N = (Seeds[s] - Seeds[o]).GetSafeNormal();
			ClipPoly(Cell, N, FVector2f::DotProduct((Seeds[s] + Seeds[o]) * 0.5f, N), Tmp);
			Swap(Cell, Tmp);
		}
		if (Cell.Num() >= 3 && FMath::Abs(SignedArea(Cell)) > 1.f) OutCells.Add(Cell);
	}
}

void SubtractRect(const TArray<FVector2f>& Poly, const FVector2f& Min, const FVector2f& Max, TArray<TArray<FVector2f>>& Out)
{
	FBox2f Box(ForceInit);
	for (const FVector2f& P : Poly) Box += P;
	if (Box.Max.X <= Min.X || Box.Min.X >= Max.X || Box.Max.Y <= Min.Y || Box.Min.Y >= Max.Y)
	{
		Out.Add(Poly);
		return;
	}
	auto Keep = [&Out](const TArray<FVector2f>& P)
	{
		if (P.Num() >= 3 && FMath::Abs(SignedArea(P)) > 6.f) Out.Add(P);
	};
	TArray<FVector2f> A, Mid, B;
	ClipPoly(Poly, FVector2f(-1, 0), -Min.X, A); Keep(A);
	ClipPoly(Poly, FVector2f(1, 0), Max.X, A); Keep(A);
	ClipPoly(Poly, FVector2f(1, 0), Min.X, B);
	ClipPoly(B, FVector2f(-1, 0), -Max.X, Mid);
	ClipPoly(Mid, FVector2f(0, -1), -Min.Y, A); Keep(A);
	ClipPoly(Mid, FVector2f(0, 1), Max.Y, A); Keep(A);
}

// ------------------------------------------------------------------ clipping
struct FClipVert
{
	FVector3f P, N;
	FVector2f A, B;
	FVector4f C;
	static FClipVert Lerp(const FClipVert& U, const FClipVert& V, float T)
	{
		return { FMath::Lerp(U.P, V.P, T), FMath::Lerp(U.N, V.N, T).GetSafeNormal(), FMath::Lerp(U.A, V.A, T), FMath::Lerp(U.B, V.B, T), FMath::Lerp(U.C, V.C, T) };
	}
};

void ClipToPrism(const FNYCSoup& Source, const TArray<int32>& TriList, const TArray<FVector2f>& PolyIn, int32 AxisU, int32 AxisV, FNYCSoup& Out)
{
	TArray<FVector2f> Poly = PolyIn;
	if (SignedArea(Poly) < 0) Algo::Reverse(Poly);
	struct FEdge { FVector2f N; float D; };
	TArray<FEdge, TInlineAllocator<16>> Edges;
	FBox2f PolyBox(ForceInit);
	for (int32 i = 0, n = Poly.Num(); i < n; ++i)
	{
		const FVector2f E = Poly[(i + 1) % n] - Poly[i];
		const FVector2f N = FVector2f(-E.Y, E.X).GetSafeNormal();
		if (!N.IsNearlyZero()) Edges.Add({ N, FVector2f::DotProduct(N, Poly[i]) - 0.02f });
		PolyBox += Poly[i];
	}
	TArray<FClipVert, TInlineAllocator<24>> In, Next;
	for (const int32 t : TriList)
	{
		const FIntVector& T = Source.Tris[t];
		const int32 V[3] = { T.X, T.Y, T.Z };
		FBox2f TriBox(ForceInit);
		for (int32 k = 0; k < 3; ++k) TriBox += FVector2f(Source.Pos[V[k]][AxisU], Source.Pos[V[k]][AxisV]);
		if (TriBox.Max.X < PolyBox.Min.X - 0.02f || TriBox.Min.X > PolyBox.Max.X + 0.02f || TriBox.Max.Y < PolyBox.Min.Y - 0.02f || TriBox.Min.Y > PolyBox.Max.Y + 0.02f)
			continue;
		In.Reset();
		for (int32 k = 0; k < 3; ++k)
		{
			const int32 i = V[k];
			In.Add({ Source.Pos[i], Source.Nrm[i], Source.UV0[i], Source.UV1[i], Source.Col[i] });
		}
		for (const FEdge& E : Edges)
		{
			Next.Reset();
			for (int32 i = 0, n = In.Num(); i < n; ++i)
			{
				const FClipVert& A = In[i];
				const FClipVert& B = In[(i + 1) % n];
				const float DA = A.P[AxisU] * E.N.X + A.P[AxisV] * E.N.Y - E.D;
				const float DB = B.P[AxisU] * E.N.X + B.P[AxisV] * E.N.Y - E.D;
				if (DA >= 0) Next.Add(A);
				if ((DA >= 0) != (DB >= 0)) Next.Add(FClipVert::Lerp(A, B, DA / (DA - DB)));
			}
			In = Next;
			if (In.Num() < 3) break;
		}
		if (In.Num() < 3) continue;
		const int32 Base = Out.Pos.Num();
		for (const FClipVert& C : In) Out.AddVertex(C.P, C.N, C.A, C.B, C.C);
		bool bAny = false;
		for (int32 i = 1; i + 1 < In.Num(); ++i)
		{
			if (FVector3f::CrossProduct(In[i].P - In[0].P, In[i + 1].P - In[0].P).SizeSquared() > 4.f)
			{
				Out.AddTri(Base, Base + i, Base + i + 1, Source.Mat[t]);
				bAny = true;
			}
		}
		if (!bAny)
		{
			const int32 Count = In.Num();
			Out.Pos.SetNum(Out.Pos.Num() - Count);
			Out.Nrm.SetNum(Out.Pos.Num());
			Out.UV0.SetNum(Out.Pos.Num());
			Out.UV1.SetNum(Out.Pos.Num());
			Out.Col.SetNum(Out.Pos.Num());
		}
	}
}

void ClipTriangleToBox(const FNYCSoup& Source, int32 t, const FBox3f& Box, FNYCSoup& Out, int32 Material)
{
	const FIntVector& T = Source.Tris[t];
	const int32 V[3] = { T.X, T.Y, T.Z };
	TArray<FClipVert, TInlineAllocator<16>> In, Next;
	FBox3f TriBox(ForceInit);
	for (int32 k = 0; k < 3; ++k)
	{
		const int32 i = V[k];
		In.Add({ Source.Pos[i], Source.Nrm[i], Source.UV0[i], Source.UV1[i], Source.Col[i] });
		TriBox += Source.Pos[i];
	}
	for (int32 Axis = 0; Axis < 3 && In.Num() >= 3; ++Axis)
	{
		if (TriBox.Max[Axis] - TriBox.Min[Axis] < 1.f) continue;
		for (int32 Side = 0; Side < 2 && In.Num() >= 3; ++Side)
		{
			const float Sign = Side == 0 ? 1.f : -1.f;
			const float Limit = Side == 0 ? Box.Min[Axis] : Box.Max[Axis];
			Next.Reset();
			for (int32 i = 0, n = In.Num(); i < n; ++i)
			{
				const FClipVert& A = In[i];
				const FClipVert& B = In[(i + 1) % n];
				const float DA = (A.P[Axis] - Limit) * Sign, DB = (B.P[Axis] - Limit) * Sign;
				if (DA >= 0) Next.Add(A);
				if ((DA >= 0) != (DB >= 0)) Next.Add(FClipVert::Lerp(A, B, DA / (DA - DB)));
			}
			In = Next;
		}
	}
	if (In.Num() < 3) return;
	const int32 Base = Out.Pos.Num();
	for (const FClipVert& C : In) Out.AddVertex(C.P, C.N, C.A, C.B, C.C);
	for (int32 i = 1; i + 1 < In.Num(); ++i)
	{
		if (FVector3f::CrossProduct(In[i].P - In[0].P, In[i + 1].P - In[0].P).SizeSquared() > 4.f)
		{
			Out.AddTri(Base, Base + i, Base + i + 1, Material);
		}
	}
}

// ------------------------------------------------------------------ solids
/** Adds a convex face given counter-clockwise about its outward normal. */
static void AddFace(FNYCSoup& Out, const TArray<FVector3f, TInlineAllocator<16>>& P, const FVector3f& N, int32 Mat)
{
	if (P.Num() < 3) return;
	const int32 Base = Out.Pos.Num();
	for (const FVector3f& V : P) Out.AddVertex(V, N, NycBoxUV(V, N), FVector2f::ZeroVector, FVector4f(1, 1, 1, 1));
	// check which way round we were given them
	const bool bCCW = FVector3f::DotProduct(FVector3f::CrossProduct(P[1] - P[0], P[2] - P[0]), N) > 0;
	for (int32 i = 1; i + 1 < P.Num(); ++i)
	{
		if (bCCW) Out.AddTri(Base, Base + i + 1, Base + i, Mat);
		else Out.AddTri(Base, Base + i, Base + i + 1, Mat);
	}
}

static void AddPrism(FNYCSoup& Out, const TArray<FVector2f>& PolyIn, float D0, float D1, int32 Axis, int32 U, int32 W,
	int32 Face1Mat, int32 SideMat, int32 Face0Mat, bool bFace1)
{
	TArray<FVector2f> Poly = PolyIn;
	if (SignedArea(Poly) < 0) Algo::Reverse(Poly);
	const int32 n = Poly.Num();
	if (n < 3) return;
	auto At = [&](const FVector2f& Q, float D) { FVector3f P; P[U] = Q.X; P[W] = Q.Y; P[Axis] = D; return P; };
	FVector3f AxisDir(0, 0, 0);
	AxisDir[Axis] = D1 > D0 ? 1.f : -1.f;
	TArray<FVector3f, TInlineAllocator<16>> F;
	if (bFace1)
	{
		for (int32 i = 0; i < n; ++i) F.Add(At(Poly[i], D1));
		AddFace(Out, F, AxisDir, Face1Mat);
	}
	F.Reset();
	for (int32 i = 0; i < n; ++i) F.Add(At(Poly[i], D0));
	AddFace(Out, F, -AxisDir, Face0Mat);
	FVector2f Centre(0, 0);
	for (const FVector2f& Q : Poly) Centre += Q / n;
	for (int32 i = 0; i < n; ++i)
	{
		const FVector2f A = Poly[i], B = Poly[(i + 1) % n];
		const FVector2f E = B - A;
		FVector2f N2 = FVector2f(E.Y, -E.X).GetSafeNormal();
		if (FVector2f::DotProduct(N2, (A + B) * 0.5f - Centre) < 0) N2 = -N2;
		if (N2.IsNearlyZero()) continue;
		FVector3f N(0, 0, 0);
		N[U] = N2.X; N[W] = N2.Y;
		F.Reset();
		F.Add(At(A, D0)); F.Add(At(B, D0)); F.Add(At(B, D1)); F.Add(At(A, D1));
		AddFace(Out, F, N, SideMat);
	}
}

void AddPrismXZ(FNYCSoup& Out, const TArray<FVector2f>& Poly, float YFront, float YBack, int32 FrontMat, int32 SideMat, int32 BackMat, bool bFront)
{
	AddPrism(Out, Poly, YBack, YFront, 1, 0, 2, FrontMat, SideMat, BackMat, bFront);
}

void AddPrismXY(FNYCSoup& Out, const TArray<FVector2f>& Poly, float Z0, float Z1, int32 TopMat, int32 SideMat, int32 BottomMat)
{
	AddPrism(Out, Poly, Z0, Z1, 2, 0, 1, TopMat, SideMat, BottomMat, true);
}

void AddBox(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, int32 M)
{
	const FVector3f P000(A.X, A.Y, A.Z), P100(B.X, A.Y, A.Z), P110(B.X, B.Y, A.Z), P010(A.X, B.Y, A.Z);
	const FVector3f P001(A.X, A.Y, B.Z), P101(B.X, A.Y, B.Z), P111(B.X, B.Y, B.Z), P011(A.X, B.Y, B.Z);
	Out.AddQuad(P001, P101, P111, P011, M);     // +z
	Out.AddQuad(P000, P010, P110, P100, M);     // -z
	Out.AddQuad(P100, P110, P111, P101, M);     // +x
	Out.AddQuad(P000, P001, P011, P010, M);     // -x
	Out.AddQuad(P010, P011, P111, P110, M);     // +y
	Out.AddQuad(P000, P100, P101, P001, M);     // -y
}

void AddIBeam(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, float W, float D, int32 M)
{
	const FVector3f Along = (B - A);
	const float Len = Along.Size();
	if (Len < 1.f) return;
	const FQuat4f Q = FQuat4f::FindBetweenNormals(FVector3f(0, 0, 1), Along / Len);
	const float T = FMath::Max(W * 0.09f, 1.5f);
	FNYCSoup S;
	AddBox(S, FVector3f(-W / 2, -D / 2, 0), FVector3f(W / 2, -D / 2 + T, Len), M);
	AddBox(S, FVector3f(-W / 2, D / 2 - T, 0), FVector3f(W / 2, D / 2, Len), M);
	AddBox(S, FVector3f(-T / 2, -D / 2 + T, 0), FVector3f(T / 2, D / 2 - T, Len), M);
	S.Transform(FTransform3f(Q, A));
	Out.Append(S);
}

void Thicken(FNYCSoup& Geo, float Thickness, int32 BackMaterial)
{
	const int32 NV = Geo.Pos.Num(), NT = Geo.Tris.Num();
	for (int32 i = 0; i < NV; ++i)
	{
		const FVector3f N = Geo.Nrm[i];
		const FVector3f P = Geo.Pos[i] - N * Thickness;
		const FVector2f A = Geo.UV0[i], B = Geo.UV1[i];
		const FVector4f C = Geo.Col[i];
		Geo.AddVertex(P, -N, A, B, C);
	}
	for (int32 t = 0; t < NT; ++t)
	{
		const FIntVector T = Geo.Tris[t];
		Geo.AddTri(T.X + NV, T.Z + NV, T.Y + NV, BackMaterial);
	}
}

// ------------------------------------------------------------------ broken edges
static void AddTriFacing(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, const FVector3f& C, const FVector3f& Hint, int32 Mat)
{
	FVector3f N = FVector3f::CrossProduct(B - A, C - A);
	if (N.SizeSquared() < 2.f) return;
	if (FVector3f::DotProduct(N, Hint) < 0.f) N = -N;
	N.Normalize();
	TArray<FVector3f, TInlineAllocator<16>> P;
	P.Add(A); P.Add(B); P.Add(C);
	AddFace(Out, P, N, Mat);
}

static FVector3f NycRoughOffset(const FVector3f& At)
{
	const FVector Q(At.X * 0.11, At.Y * 0.11, At.Z * 0.13);
	return FVector3f(FMath::PerlinNoise3D(Q), FMath::PerlinNoise3D(Q + FVector(37.1, 11.7, 5.3)), FMath::PerlinNoise3D(Q + FVector(3.9, 71.2, 23.1)));
}

void JagOutline(const TArray<FVector2f>& ConvexIn, float Step, float Amplitude, TFunctionRef<bool(const FVector2f&)> Pinned, TArray<FVector2f>& Out)
{
	TArray<FVector2f> Convex = ConvexIn;
	if (SignedArea(Convex) < 0) Algo::Reverse(Convex);
	Out.Reset();
	const int32 n = Convex.Num();
	float Perimeter = 0.f;
	for (int32 i = 0; i < n; ++i) Perimeter += (Convex[(i + 1) % n] - Convex[i]).Size();
	// a sliver cannot take a crooked edge without folding over itself
	const bool bThin = 2.f * FMath::Abs(SignedArea(Convex)) / FMath::Max(Perimeter, 1.f) < Amplitude * 2.6f;
	for (int32 i = 0; i < n; ++i)
	{
		const FVector2f A = Convex[i], B = Convex[(i + 1) % n];
		const int32 Parts = bThin ? 1 : FMath::Clamp(FMath::RoundToInt32((B - A).Size() / Step), 1, 14);
		for (int32 k = 0; k < Parts; ++k)
		{
			FVector2f Q = FMath::Lerp(A, B, (float)k / Parts);
			if (!bThin && !Pinned(Q))
			{
				const FVector2D At(Q.X * 0.087, Q.Y * 0.087);
				Q += FVector2f(FMath::PerlinNoise2D(At + FVector2D(13.2, 7.9)), FMath::PerlinNoise2D(At + FVector2D(41.7, 29.3))) * Amplitude * 1.7f;
			}
			Out.Add(Q);
		}
	}
}

void ClipToOutline(const FNYCSoup& Source, const TArray<int32>& TriList, const TArray<FVector2f>& Outline, int32 AxisU, int32 AxisV, FNYCSoup& Out)
{
	const int32 n = Outline.Num();
	if (n < 3) return;
	if (n <= 8)
	{
		// not subdivided: it is still the convex cell
		ClipToPrism(Source, TriList, Outline, AxisU, AxisV, Out);
		return;
	}
	FVector2f Centre(0, 0);
	for (const FVector2f& Q : Outline) Centre += Q / n;
	FBox2f Whole(ForceInit);
	for (const FVector2f& Q : Outline) Whole += Q;
	TArray<int32> Near;
	for (const int32 t : TriList)
	{
		const FIntVector& T = Source.Tris[t];
		FBox2f Box(ForceInit);
		Box += FVector2f(Source.Pos[T.X][AxisU], Source.Pos[T.X][AxisV]);
		Box += FVector2f(Source.Pos[T.Y][AxisU], Source.Pos[T.Y][AxisV]);
		Box += FVector2f(Source.Pos[T.Z][AxisU], Source.Pos[T.Z][AxisV]);
		if (Box.Max.X >= Whole.Min.X - 0.02f && Box.Min.X <= Whole.Max.X + 0.02f && Box.Max.Y >= Whole.Min.Y - 0.02f && Box.Min.Y <= Whole.Max.Y + 0.02f) Near.Add(t);
	}
	for (int32 i = 0; i < n; ++i)
	{
		const TArray<FVector2f> Wedge = { Centre, Outline[i], Outline[(i + 1) % n] };
		if (FMath::Abs(SignedArea(Wedge)) < 2.f) continue;
		ClipToPrism(Source, Near, Wedge, AxisU, AxisV, Out);
	}
}

void AddRoughSlab(FNYCSoup& Out, const TArray<FVector2f>& OutlineIn, float D0, float D1, int32 Axis, int32 U, int32 W,
	int32 SideMat, int32 EndMat, bool bStart, int32 StartMat, float Rough)
{
	const int32 n = OutlineIn.Num();
	if (n < 3) return;
	const TArray<FVector2f>& Outline = OutlineIn;
	FVector2f Centre(0, 0);
	for (const FVector2f& Q : Outline) Centre += Q / n;
	auto At = [&](const FVector2f& Q, float D) { FVector3f P; P[U] = Q.X; P[W] = Q.Y; P[Axis] = D; return P; };
	const int32 Rows = FMath::Clamp(FMath::RoundToInt32(FMath::Abs(D1 - D0) / 12.f), 1, 3);
	const float Dir = D1 > D0 ? 1.f : -1.f;
	auto Vert = [&](int32 i, int32 r)
	{
		const float D = FMath::Lerp(D0, D1, (float)r / Rows);
		FVector2f Q = Outline[i];
		if (r == 0) return At(Q, D);
		const FVector3f J = NycRoughOffset(At(Q, D));
		Q += FVector2f(J.X, J.Y) * Rough * (r == Rows ? 1.1f : 1.9f);
		const float Bump = r == Rows ? FMath::PerlinNoise2D(FVector2D(Outline[i].X * 0.079, Outline[i].Y * 0.079)) * Rough * 1.5f : J.Z * Rough * 0.6f;
		return At(Q, D + Bump * Dir);
	};
	FVector3f AxisDir(0, 0, 0);
	AxisDir[Axis] = Dir;
	for (int32 i = 0; i < n; ++i)
	{
		const int32 j = (i + 1) % n;
		const FVector2f E = Outline[j] - Outline[i];
		FVector2f N2(E.Y, -E.X);
		if (FVector2f::DotProduct(N2, (Outline[i] + Outline[j]) * 0.5f - Centre) < 0) N2 = -N2;
		FVector3f Hint(0, 0, 0);
		Hint[U] = N2.X; Hint[W] = N2.Y;
		for (int32 r = 0; r < Rows; ++r)
		{
			const FVector3f V00 = Vert(i, r), V10 = Vert(j, r), V11 = Vert(j, r + 1), V01 = Vert(i, r + 1);
			AddTriFacing(Out, V00, V10, V11, Hint, SideMat);
			AddTriFacing(Out, V00, V11, V01, Hint, SideMat);
		}
	}
	const FVector3f EndMid = At(Centre, D1 + FMath::PerlinNoise2D(FVector2D(Centre.X * 0.051, Centre.Y * 0.051)) * Rough * 2.2f * Dir);
	const FVector3f StartMid = At(Centre, D0);
	for (int32 i = 0; i < n; ++i)
	{
		const int32 j = (i + 1) % n;
		AddTriFacing(Out, EndMid, Vert(i, Rows), Vert(j, Rows), AxisDir, EndMat);
		if (bStart) AddTriFacing(Out, StartMid, Vert(i, 0), Vert(j, 0), -AxisDir, StartMat);
	}
}

void AddRod(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, float Radius, int32 Material)
{
	const FVector3f Along = B - A;
	const float Len = Along.Size();
	if (Len < 1.f) return;
	FNYCSoup S;
	AddBox(S, FVector3f(-Radius, -Radius, 0), FVector3f(Radius, Radius, Len), Material);
	S.Transform(FTransform3f(FQuat4f::FindBetweenNormals(FVector3f(0, 0, 1), Along / Len), A));
	Out.Append(S);
}

void AddRebarStub(FNYCSoup& Out, const FVector3f& From, const FVector3f& Outward, float Length, int32 Material, FRandomStream& Rand)
{
	const FVector3f Dir = Outward.GetSafeNormal();
	if (Dir.IsNearlyZero()) return;
	const FVector3f Wander(Rand.FRandRange(-0.3f, 0.3f), Rand.FRandRange(-0.3f, 0.3f), Rand.FRandRange(-0.25f, 0.35f));
	const FVector3f Mid = From + (Dir + Wander * 0.5f) * Length * 0.6f;
	const FVector3f End = Mid + (Dir * 0.6f + Wander + FVector3f(0, 0, -0.7f)) * Length * 0.42f;
	AddRod(Out, From - Dir * 4.f, Mid, 0.85f, Material);
	AddRod(Out, Mid, End, 0.85f, Material);
}

void ThickenSolid(FNYCSoup& Geo, float Thickness, int32 BackMaterial, int32 EdgeMaterial, float Rough)
{
	const int32 NV = Geo.Pos.Num(), NT = Geo.Tris.Num();
	if (NT == 0) return;
	TMap<FIntVector, int32> Weld;
	TArray<int32> Id;
	Id.SetNumUninitialized(NV);
	for (int32 i = 0; i < NV; ++i)
	{
		const FVector3f& P = Geo.Pos[i];
		const FIntVector Key(FMath::RoundToInt32(P.X * 1.5f), FMath::RoundToInt32(P.Y * 1.5f), FMath::RoundToInt32(P.Z * 1.5f));
		if (const int32* Found = Weld.Find(Key)) Id[i] = *Found;
		else { Id[i] = Weld.Num(); Weld.Add(Key, Id[i]); }
	}
	auto EdgeKey = [](int32 A, int32 B) { return ((uint64)FMath::Min(A, B) << 32) | (uint32)FMath::Max(A, B); };
	TMap<uint64, int32> Uses;
	for (int32 t = 0; t < NT; ++t)
	{
		const FIntVector T = Geo.Tris[t];
		const int32 V[3] = { T.X, T.Y, T.Z };
		for (int32 e = 0; e < 3; ++e) ++Uses.FindOrAdd(EdgeKey(Id[V[e]], Id[V[(e + 1) % 3]]));
	}
	struct FRim { FVector3f A, B, QA, QB, Hint; };
	TArray<FRim> Rim;
	for (int32 t = 0; t < NT; ++t)
	{
		const FIntVector T = Geo.Tris[t];
		const int32 V[3] = { T.X, T.Y, T.Z };
		for (int32 e = 0; e < 3; ++e)
		{
			const int32 a = V[e], b = V[(e + 1) % 3], c = V[(e + 2) % 3];
			if (Uses[EdgeKey(Id[a], Id[b])] != 1) continue;
			const FVector3f A = Geo.Pos[a], B = Geo.Pos[b];
			const float Len = (B - A).Size();
			if (Len < 6.f) continue;
			const FVector3f Along = (B - A) / Len;
			FVector3f Hint = (A + B) * 0.5f - Geo.Pos[c];
			Hint -= Along * FVector3f::DotProduct(Hint, Along);
			Rim.Add({ A, B, A - Geo.Nrm[a] * Thickness, B - Geo.Nrm[b] * Thickness, Hint });
		}
	}
	Thicken(Geo, Thickness, BackMaterial);
	// a sheet made of very many scraps would drown in rim walls: keep the longest runs
	if (Rim.Num() > 260)
	{
		Rim.Sort([](const FRim& X, const FRim& Y) { return (X.B - X.A).SizeSquared() > (Y.B - Y.A).SizeSquared(); });
		Rim.SetNum(260);
	}
	for (const FRim& E : Rim)
	{
		if (Rough <= 0.f)
		{
			AddTriFacing(Geo, E.A, E.B, E.QB, E.Hint, EdgeMaterial);
			AddTriFacing(Geo, E.A, E.QB, E.QA, E.Hint, EdgeMaterial);
			continue;
		}
		const int32 Segs = FMath::Clamp(FMath::RoundToInt32((E.B - E.A).Size() / 30.f), 1, 6);
		for (int32 k = 0; k < Segs; ++k)
		{
			const float F0 = (float)k / Segs, F1 = (float)(k + 1) / Segs;
			const FVector3f A0 = FMath::Lerp(E.A, E.B, F0), A1 = FMath::Lerp(E.A, E.B, F1);
			const FVector3f B0 = FMath::Lerp(E.QA, E.QB, F0), B1 = FMath::Lerp(E.QA, E.QB, F1);
			FVector3f M0 = (A0 + B0) * 0.5f, M1 = (A1 + B1) * 0.5f;
			M0 += NycRoughOffset(M0) * Rough * 1.8f;
			M1 += NycRoughOffset(M1) * Rough * 1.8f;
			AddTriFacing(Geo, A0, A1, M1, E.Hint, EdgeMaterial);
			AddTriFacing(Geo, A0, M1, M0, E.Hint, EdgeMaterial);
			AddTriFacing(Geo, M0, M1, B1, E.Hint, EdgeMaterial);
			AddTriFacing(Geo, M0, B1, B0, E.Hint, EdgeMaterial);
		}
	}
}

// ------------------------------------------------------------------ geometry collections
static int32 NycAxisCode(const FVector3f& N)
{
	const FVector3f A = N.GetAbs();
	if (A.Z >= A.X && A.Z >= A.Y) return N.Z >= 0 ? 4 : 5;
	if (A.X >= A.Y) return N.X >= 0 ? 0 : 1;
	return N.Y >= 0 ? 2 : 3;
}

void BuildCollection(UGeometryCollection* Asset, const TArray<FNYCPiece>& Pieces, const TArray<UMaterialInterface*>& Materials,
	const FVector& RestOrigin, TArray<int32>& OutPieceTransform, TArray<int32>& OutGroupTransform)
{
	TSharedPtr<FGeometryCollection, ESPMode::ThreadSafe> Col = Asset->GetGeometryCollection();
	int32 NumVerts = 0, NumTris = 0, NumGeo = 0, MaxGroup = 0;
	for (const FNYCPiece& P : Pieces)
	{
		if (P.Geo.IsEmpty()) continue;
		NumVerts += P.Geo.Pos.Num();
		NumTris += P.Geo.Tris.Num();
		MaxGroup = FMath::Max(MaxGroup, P.Group);
		++NumGeo;
	}
	// groups that hold more than one piece become clusters; lone pieces hang off the root
	TArray<int32> GroupCount;
	GroupCount.Init(0, MaxGroup + 1);
	for (const FNYCPiece& P : Pieces)
		if (!P.Geo.IsEmpty()) ++GroupCount[P.Group];
	int32 NumClusters = 0;
	for (int32 C : GroupCount) NumClusters += C > 1 ? 1 : 0;

	const int32 NumTransforms = 1 + NumClusters + NumGeo;
	Col->AddElements(NumTransforms, FTransformCollection::TransformGroup);
	Col->AddElements(NumVerts, FGeometryCollection::VerticesGroup);
	Col->AddElements(NumTris, FGeometryCollection::FacesGroup);
	Col->AddElements(NumGeo, FGeometryCollection::GeometryGroup);
	GeometryCollection::UV::SetNumUVLayers(*Col, 4);
	TManagedArray<FVector2f>& L0 = GeometryCollection::UV::ModifyUVLayer(*Col, 0);
	TManagedArray<FVector2f>& L1 = GeometryCollection::UV::ModifyUVLayer(*Col, 1);
	TManagedArray<FVector2f>& L2 = GeometryCollection::UV::ModifyUVLayer(*Col, 2);
	TManagedArray<FVector2f>& L3 = GeometryCollection::UV::ModifyUVLayer(*Col, 3);

	auto InitTransform = [&](int32 i, int32 Parent, const FTransform3f& T, int32 SimType)
	{
		Col->Transform[i] = T;
		Col->Parent[i] = Parent;
		Col->SimulationType[i] = SimType;
		Col->BoneName[i] = FString::Printf(TEXT("n%d"), i);
		Col->BoneColor[i] = FLinearColor::White;
		if (Parent >= 0) Col->Children[Parent].Add(i);
	};
	InitTransform(0, FGeometryCollection::Invalid, FTransform3f::Identity, FGeometryCollection::ESimulationTypes::FST_Clustered);

	OutGroupTransform.Init(INDEX_NONE, MaxGroup + 1);
	int32 Next = 1;
	for (int32 g = 0; g <= MaxGroup; ++g)
	{
		if (GroupCount[g] > 1)
		{
			OutGroupTransform[g] = Next;
			InitTransform(Next++, 0, FTransform3f::Identity, FGeometryCollection::ESimulationTypes::FST_Clustered);
		}
	}

	int32 V = 0, F = 0, G = 0;
	OutPieceTransform.Init(INDEX_NONE, Pieces.Num());
	TArray<int32> Anchored;
	for (int32 pi = 0; pi < Pieces.Num(); ++pi)
	{
		const FNYCPiece& P = Pieces[pi];
		if (P.Geo.IsEmpty()) continue;
		const FBox3f Bounds = P.Geo.Bounds();
		const FVector3f Centre = Bounds.GetCenter();
		const int32 Xf = Next++;
		OutPieceTransform[pi] = Xf;
		const int32 Parent = GroupCount[P.Group] > 1 ? OutGroupTransform[P.Group] : 0;
		InitTransform(Xf, Parent, FTransform3f(Centre), FGeometryCollection::ESimulationTypes::FST_Rigid);
		if (GroupCount[P.Group] == 1) OutGroupTransform[P.Group] = Xf;
		if (P.bAnchored) Anchored.Add(Xf);

		const int32 VStart = V, FStart = F;
		float Inner = TNumericLimits<float>::Max(), Outer = 0.f;
		FBox Local(ForceInit);
		for (int32 i = 0; i < P.Geo.Pos.Num(); ++i, ++V)
		{
			const FVector3f Q = P.Geo.Pos[i] - Centre;
			const FVector3f N = P.Geo.Nrm[i];
			Col->Vertex[V] = Q;
			Col->Normal[V] = N;
			FVector3f TU = FVector3f::CrossProduct(FMath::Abs(N.Z) < 0.9f ? FVector3f(0, 0, 1) : FVector3f(1, 0, 0), N).GetSafeNormal();
			Col->TangentU[V] = TU;
			Col->TangentV[V] = FVector3f::CrossProduct(N, TU);
			const FVector4f C = P.Geo.Col[i];
			Col->Color[V] = FLinearColor(C.X, C.Y, C.Z, C.W);
			Col->BoneMap[V] = Xf;
			L0[V] = P.Geo.UV0[i];
			L1[V] = P.Geo.UV1[i];
			// rest pose, in metres relative to RestOrigin, for materials that must not swim as pieces move
			const FVector3f Rest = (P.Geo.Pos[i] - FVector3f(RestOrigin)) * 0.01f;
			L2[V] = FVector2f(Rest.X, Rest.Y);
			L3[V] = FVector2f(Rest.Z, (float)NycAxisCode(N));
			Local += FVector(Q);
			Outer = FMath::Max(Outer, Q.Size());
		}
		Inner = FMath::Max(1.f, (float)Local.GetExtent().GetMin());
		for (int32 t = 0; t < P.Geo.Tris.Num(); ++t, ++F)
		{
			const FIntVector& T = P.Geo.Tris[t];
			Col->Indices[F] = FIntVector(T.X + VStart, T.Y + VStart, T.Z + VStart);
			Col->Visible[F] = true;
			Col->Internal[F] = false;
			Col->MaterialID[F] = FMath::Clamp(P.Geo.Mat[t], 0, FMath::Max(Materials.Num() - 1, 0));
			Col->MaterialIndex[F] = F;
		}
		Col->TransformToGeometryIndex[Xf] = G;
		Col->TransformIndex[G] = Xf;
		Col->BoundingBox[G] = Local;
		Col->InnerRadius[G] = Inner;
		Col->OuterRadius[G] = Outer;
		Col->VertexStart[G] = VStart;
		Col->VertexCount[G] = V - VStart;
		Col->FaceStart[G] = FStart;
		Col->FaceCount[G] = F - FStart;
		++G;
	}

	Chaos::Facades::FCollectionHierarchyFacade Hierarchy(*Col);
	Hierarchy.GenerateLevelAttribute();
	Chaos::Facades::FCollectionAnchoringFacade Anchoring(*Col);
	Anchoring.AddAnchoredAttribute();
	for (int32 i : Anchored) Anchoring.SetAnchored(i, true);

	Asset->Materials.Reset();
	for (UMaterialInterface* M : Materials) Asset->Materials.Add(M);
	Col->ReindexMaterials();
}

UGeometryCollection* MakeCollection(UObject* Outer, const FName& Name, const TArray<FNYCPiece>& Pieces,
	const TArray<UMaterialInterface*>& Materials, const FVector& RestOrigin, float Density,
	TArray<int32>& OutPieceTransform, TArray<int32>& OutGroupTransform)
{
#if WITH_EDITOR
	UGeometryCollection* Asset = NewObject<UGeometryCollection>(Outer, MakeUniqueObjectName(Outer, UGeometryCollection::StaticClass(), Name), RF_Transient);
	BuildCollection(Asset, Pieces, Materials, RestOrigin, OutPieceTransform, OutGroupTransform);

	Asset->EnableClustering = true;
	Asset->MaxClusterLevel = 100;
	Asset->DamageModel = EDamageModelTypeEnum::Chaos_Damage_Model_UserDefined_Damage_Threshold;
	Asset->DamageThreshold = { 400000.f, 60000.f, 20000.f };
	Asset->bUseSizeSpecificDamageThreshold = false;
	Asset->ClusterConnectionType = EClusterConnectionTypeEnum::Chaos_BoundsOverlapFilteredDelaunayTriangulation;
	Asset->ConnectionGraphBoundsFilteringMargin = 4.f;
	Asset->bUseFullPrecisionUVs = true;
	Asset->SetEnableNanite(false);
	Asset->bMassAsDensity = true;
	Asset->Mass = Density;
	Asset->MinimumMassClamp = 0.5f;
	Asset->bRemoveOnMaxSleep = false;

	Asset->SizeSpecificData.Reset();
	Asset->SizeSpecificData.Add(UGeometryCollection::GeometryCollectionSizeSpecificDataDefaults());
	FGeometryCollectionSizeSpecificData& Size = Asset->SizeSpecificData[0];
	if (Size.CollisionShapes.Num() == 0) Size.CollisionShapes.AddDefaulted();
	Size.CollisionShapes[0].CollisionType = ECollisionTypeEnum::Chaos_Volumetric;
	Size.CollisionShapes[0].ImplicitType = EImplicitTypeEnum::Chaos_Implicit_Convex;
	Size.CollisionShapes[0].CollisionMarginFraction = 0.f;
	Size.CollisionShapes[0].CollisionObjectReductionPercentage = 6.f;
	Size.CollisionShapes[0].CollisionParticles.CollisionParticlesFraction = 1.f;
	Size.CollisionShapes[0].CollisionParticles.MaximumCollisionParticles = 40;
	Size.DamageThreshold = 5000;

	FGeometryCollectionConvexUtility::FLeafConvexHullSettings Hulls;
	Hulls.SimplificationDistanceThreshold = 2.0;
	FGeometryCollectionConvexUtility::GenerateLeafConvexHulls(*Asset->GetGeometryCollection(), false, TArrayView<const int32>(), Hulls);

	Asset->InvalidateCollection();
	Asset->CreateSimulationData();
	Asset->RebuildRenderData();
	return Asset;
#else
	return nullptr;
#endif
}

} // namespace NYCFracture
