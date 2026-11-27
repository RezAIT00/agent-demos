#pragma once

#include "CoreMinimal.h"

class UStaticMesh;
class UMaterialInterface;
class UGeometryCollection;

/** What a broken piece is made of.  Decides collision mass, sound and what flies off it. */
enum class ENYCStuff : uint8
{
	Masonry,
	Concrete,
	Glass,
	Metal,
	Steel,
	Wood,
	Asphalt,
	Soft
};

/** Loose triangle geometry with the attributes the city materials read. */
struct FNYCSoup
{
	TArray<FVector3f> Pos;
	TArray<FVector3f> Nrm;
	TArray<FVector2f> UV0;
	TArray<FVector2f> UV1;
	TArray<FVector4f> Col;
	TArray<FIntVector> Tris;
	TArray<int32> Mat;          // per triangle: index into the owner's material list

	int32 NumTris() const { return Tris.Num(); }
	bool IsEmpty() const { return Tris.Num() == 0; }
	FBox3f Bounds() const;
	void Append(const FNYCSoup& Other);
	void Transform(const FTransform3f& T);
	void RemapMaterials(const TArray<int32>& Map);
	int32 AddVertex(const FVector3f& P, const FVector3f& N, const FVector2f& A, const FVector2f& B, const FVector4f& C);
	void AddTri(int32 A, int32 B, int32 C, int32 Material);
	/** Quad with a flat normal; corners counter-clockwise as seen from the side the normal points to. */
	void AddQuad(const FVector3f& P0, const FVector3f& P1, const FVector3f& P2, const FVector3f& P3, int32 Material);
};

/** One rigid fragment. */
struct FNYCPiece
{
	FNYCSoup Geo;               // in collection space, cm
	int32 Group = 0;            // pieces of one group form a cluster that holds together until strained
	bool bAnchored = false;
	bool bRim = false;          // a wall piece lying against the edge of its own bay
	ENYCStuff Stuff = ENYCStuff::Masonry;
};

/** A window opening in a facade module, module space (cm). */
struct FNYCOpening
{
	float X0, X1, Z0, Z1, Depth;
};

namespace NYCFracture
{
	/** Triangles of a static mesh's source model; Mat holds the mesh material slot index. */
	bool ReadMesh(UStaticMesh* Mesh, FNYCSoup& Out);

	/** Convex cells of a jittered Voronoi pattern over a rectangle. */
	void Voronoi2D(const FVector2f& Min, const FVector2f& Max, int32 NX, int32 NY, FRandomStream& Rand, TArray<TArray<FVector2f>>& OutCells, float Jitter = 0.85f);

	/** Convex polygon minus an axis aligned rectangle: up to four convex polygons. */
	void SubtractRect(const TArray<FVector2f>& Poly, const FVector2f& Min, const FVector2f& Max, TArray<TArray<FVector2f>>& Out);

	/** The part of Source inside the prism over a convex polygon in the plane (AxisU, AxisV). */
	void ClipToPrism(const FNYCSoup& Source, const TArray<int32>& TriList, const TArray<FVector2f>& Poly, int32 AxisU, int32 AxisV, FNYCSoup& Out);

	/** The part of one source triangle inside a box.  Axes on which the triangle is flat are not clipped. */
	void ClipTriangleToBox(const FNYCSoup& Source, int32 Tri, const FBox3f& Box, FNYCSoup& Out, int32 Material);

	/** A solid slab over a convex polygon in the XZ plane between depths YFront and YBack. */
	void AddPrismXZ(FNYCSoup& Out, const TArray<FVector2f>& Poly, float YFront, float YBack, int32 FrontMat, int32 SideMat, int32 BackMat, bool bFront);

	/** A solid slab over a convex polygon in the XY plane between heights Z0 and Z1. */
	void AddPrismXY(FNYCSoup& Out, const TArray<FVector2f>& Poly, float Z0, float Z1, int32 TopMat, int32 SideMat, int32 BottomMat);

	/** Axis aligned box. */
	void AddBox(FNYCSoup& Out, const FVector3f& Min, const FVector3f& Max, int32 Material);

	/** A steel I section from A to B with flange width W and depth D. */
	void AddIBeam(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, float W, float D, int32 Material);

	/** Gives a thin sheet of triangles some thickness along -normal, so it collides and has a back. */
	void Thicken(FNYCSoup& Geo, float Thickness, int32 BackMaterial);

	/** A convex outline with its edges broken into short crooked steps.  The offsets depend only on position, so
	 *  two cells that share an edge break along the same crooked line.  Points for which Pinned() is true stay put. */
	void JagOutline(const TArray<FVector2f>& Convex, float Step, float Amplitude, TFunctionRef<bool(const FVector2f&)> Pinned, TArray<FVector2f>& Out);

	/** The part of Source inside a jagged (star-shaped) outline, built as a fan of convex wedges. */
	void ClipToOutline(const FNYCSoup& Source, const TArray<int32>& TriList, const TArray<FVector2f>& Outline, int32 AxisU, int32 AxisV, FNYCSoup& Out);

	/** A thick lump over a star-shaped outline from depth D0 to D1 along Axis, with rough broken sides and a
	 *  lumpy far face.  The face at D0 is flat and only made when bStart is set. */
	void AddRoughSlab(FNYCSoup& Out, const TArray<FVector2f>& Outline, float D0, float D1, int32 Axis, int32 U, int32 W,
		int32 SideMat, int32 EndMat, bool bStart, int32 StartMat, float Rough);

	/** A thin square bar from A to B. */
	void AddRod(FNYCSoup& Out, const FVector3f& A, const FVector3f& B, float Radius, int32 Material);

	/** A reinforcing bar snapped off and bent: out of a broken face at From, along Out, sagging at the end. */
	void AddRebarStub(FNYCSoup& Out, const FVector3f& From, const FVector3f& Outward, float Length, int32 Material, FRandomStream& Rand);

	/** Turns an open sheet into a solid: a back face Thickness behind it and rough walls round every open edge. */
	void ThickenSolid(FNYCSoup& Geo, float Thickness, int32 BackMaterial, int32 EdgeMaterial, float Rough);

	/** Rest-pose coordinates for the debris materials: UV2 = position xy, UV3 = (z, dominant axis), metres. */
	void BuildCollection(UGeometryCollection* Collection, const TArray<FNYCPiece>& Pieces, const TArray<UMaterialInterface*>& Materials,
		const FVector& RestOrigin, TArray<int32>& OutPieceTransform, TArray<int32>& OutGroupTransform);

	/** Creates the asset, fills it and cooks simulation and render data (editor binaries only). */
	UGeometryCollection* MakeCollection(UObject* Outer, const FName& Name, const TArray<FNYCPiece>& Pieces,
		const TArray<UMaterialInterface*>& Materials, const FVector& RestOrigin, float Density,
		TArray<int32>& OutPieceTransform, TArray<int32>& OutGroupTransform);
}
