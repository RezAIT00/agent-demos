// Populates the city: turns the block loops and crosswalks of traffic.json into everyday routes and
// gives every walker a body, a manner of walking and the things they carry.  Pure C++, deterministic.
#pragma once

#include <deque>

#include "WalkerPlan.h"

namespace nycw
{
struct CityCrossing
{
	V2 A, B;          // endpoints, 90 cm back from each kerb
	int Group;
	float Offset;
};

struct CityObstacle
{
	V2 P;
	float R;
};

struct CityInput
{
	std::vector<std::vector<V2>> Loops;
	std::vector<CityCrossing> Crossings;
	/** Traffic lanes (start, end).  They tell real streets from the gaps where a superblock has none. */
	std::vector<std::pair<V2, V2>> Lanes;
	std::vector<CityObstacle> Obstacles;
	Signals Sig;
};

/** What the population needs to know about each body. */
struct VariantTraits
{
	bool Female = false;
	float Pace = 1.f;
	float Age = 0.f;
	float ArmOut = 0.f;
	float Umbrella = 1.f;      // how likely to carry one
	bool HoodUp = false;
	int Shoulder = 0;          // bag on the left: 1 handbag or tote, 2 satchel
	bool Briefcase = false, ShopBag = false, Phone = false, Coffee = false;
	float Height = 176.f;
};

enum EArchetype { ARCH_EVERYDAY, ARCH_BRISK, ARCH_STROLLER, ARCH_PHONE, ARCH_STANDING };
enum EProp { PROP_NONE, PROP_UMBRELLA, PROP_BRIEFCASE, PROP_SHOPBAG, PROP_PHONE, PROP_COFFEE };

struct Resident
{
	Walker W;
	int Variant = 0;
	int Partner = -1;
	float TalkSide = 0.f;      // which side the partner is on; 0 = walks alone
	uint32_t Seed = 1;
	int Archetype = ARCH_EVERYDAY;
	int PropR = PROP_NONE, PropL = PROP_NONE;
	int UmbrellaStyle = 0;
	float PocketL = 0.f, PocketR = 0.f;   // hands always in pockets (December)
	float ColdPockets = 2.f;              // snow level at which cold hands go in too
	float UmbrellaRain = 2.f, UmbrellaSnow = 2.f;   // weather levels that put the umbrella up
	float CarryL = 0.f, CarryR = 0.f;
	float StandPitch = 0.f;
	/** (signal group, offset) for each roadway stretch of the route, in order */
	std::vector<std::pair<int, float>> CrossSignals;
};

namespace city
{
struct Rect
{
	V2 Lo, Hi;
	V2 Corner(int C) const { return V2(C == 1 || C == 2 ? Hi.x : Lo.x, C >= 2 ? Hi.y : Lo.y); }
};

struct Edge
{
	int From, To;
	int Cross;        // crossing index, or -1 for a block side
	V2 Dir;
};

/** A junction on a block's kerb line: one of its corners, or a point partway along a side. */
struct Node
{
	int Block;
	V2 P;
};

struct Graph
{
	std::vector<Node> Nodes;
	std::vector<Rect> Blocks;
	size_t NumReal = 0;       // blocks past this index only serve routes that cross into them
	std::vector<Edge> Edges;
	std::vector<std::vector<int>> Out;
	std::vector<std::pair<int, int>> CrossEdges;    // [crossing] -> the edge in each direction
};

/** The city's sidewalk corners are rounded (3.4 m radius), so near a corner the kerb sits back from the
 *  block's straight edge.  How far, for a crosswalk lane at `Line` across a block. */
inline float KerbSetback(const Rect& R, bool bAlongX, float Line)
{
	constexpr float Corner = 340.f;
	const float Lo = bAlongX ? R.Lo.y : R.Lo.x, Hi = bAlongX ? R.Hi.y : R.Hi.x;
	const float U = Clampf(std::min(Line - Lo, Hi - Line), 0.f, Corner);
	return Corner - std::sqrt(std::max(Corner * Corner - (Corner - U) * (Corner - U), 0.f));
}

/** Whether a traffic lane runs through the middle of this crosswalk.  The crosswalk list includes ones
 *  "across" streets that do not exist inside superblocks. */
inline bool CrossesStreet(const CityInput& In, const CityCrossing& X)
{
	if (In.Lanes.empty()) return true;
	auto Side = [](V2 A, V2 B, V2 P) { return (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x); };
	const V2 A = X.A + (X.B - X.A) * 0.15f, B = X.A + (X.B - X.A) * 0.85f;
	for (const auto& L : In.Lanes)
	{
		if (Side(A, B, L.first) * Side(A, B, L.second) < 0.f && Side(L.first, L.second, A) * Side(L.first, L.second, B) < 0.f) return true;
	}
	return false;
}

inline V2 AxisDir(V2 D)
{
	return std::fabs(D.x) >= std::fabs(D.y) ? V2(D.x > 0 ? 1.f : -1.f, 0.f) : V2(0.f, D.y > 0 ? 1.f : -1.f);
}

inline Graph BuildGraph(const CityInput& In)
{
	Graph G;
	struct Found { V2 Centre; Rect R; float Area; };
	std::vector<Found> Rects;
	for (const std::vector<V2>& L : In.Loops)
	{
		if (L.size() != 4) continue;
		Rect R = { L[0], L[0] };
		for (const V2& P : L)
		{
			R.Lo = V2(std::min(R.Lo.x, P.x), std::min(R.Lo.y, P.y));
			R.Hi = V2(std::max(R.Hi.x, P.x), std::max(R.Hi.y, P.y));
		}
		const V2 C = (R.Lo + R.Hi) * 0.5f;
		const float Area = (R.Hi.x - R.Lo.x) * (R.Hi.y - R.Lo.y);
		bool bMerged = false;
		for (Found& F : Rects)
		{
			if (Len(F.Centre - C) < 200.f)
			{
				if (Area > F.Area) { F.R = R; F.Area = Area; }
				bMerged = true;
				break;
			}
		}
		if (!bMerged) Rects.push_back({ C, R, Area });
	}
	// the outer ring runs 1.9 m inside the kerb
	for (const Found& F : Rects) G.Blocks.push_back({ F.R.Lo - V2(190.f, 190.f), F.R.Hi + V2(190.f, 190.f) });
	// a ring that runs over a real street is really two blocks: cut it at the kerbs
	for (size_t B = 0; B < G.Blocks.size(); ++B)
	{
		for (size_t K = 0; K < In.Crossings.size(); ++K)
		{
			const CityCrossing& X = In.Crossings[K];
			const Rect R = G.Blocks[B];
			auto Inside = [&R](V2 P) { return P.x > R.Lo.x - 5.f && P.x < R.Hi.x + 5.f && P.y > R.Lo.y - 5.f && P.y < R.Hi.y + 5.f; };
			if (!Inside(X.A) || !Inside(X.B) || !CrossesStreet(In, X)) continue;
			const bool bAlongX = std::fabs(X.B.x - X.A.x) > std::fabs(X.B.y - X.A.y);
			const float LowKerb = (bAlongX ? std::min(X.A.x, X.B.x) : std::min(X.A.y, X.B.y)) + 90.f;
			const float HighKerb = (bAlongX ? std::max(X.A.x, X.B.x) : std::max(X.A.y, X.B.y)) - 90.f;
			Rect Low = R, High = R;
			(bAlongX ? Low.Hi.x : Low.Hi.y) = LowKerb;
			(bAlongX ? High.Lo.x : High.Lo.y) = HighKerb;
			G.Blocks[B] = Low;
			G.Blocks.push_back(High);
		}
	}
	// pieces that turn out to be the same block, and slivers, go
	std::vector<Rect> Clean;
	for (const Rect& R : G.Blocks)
	{
		if (R.Hi.x - R.Lo.x < 1500.f || R.Hi.y - R.Lo.y < 1500.f) continue;
		bool bSame = false;
		for (const Rect& O : Clean) bSame |= Len((O.Lo + O.Hi) * 0.5f - (R.Lo + R.Hi) * 0.5f) < 600.f;
		if (!bSame) Clean.push_back(R);
	}
	G.Blocks = Clean;
	G.NumReal = G.Blocks.size();
	auto CornerNear = [&](V2 P)
	{
		for (int B = 0; B < (int)G.Blocks.size(); ++B)
		{
			const Rect& R = G.Blocks[B];
			if (P.x < R.Lo.x - 8.f || P.x > R.Hi.x + 8.f || P.y < R.Lo.y - 8.f || P.y > R.Hi.y + 8.f) continue;
			for (int C = 0; C < 4; ++C) if (Len(R.Corner(C) - P) < 430.f) return B * 4 + C;
		}
		return -1;
	};
	// some crosswalks lead to blocks that have no ring of their own: make those from the block opposite
	for (const CityCrossing& X : In.Crossings)
	{
		if (!CrossesStreet(In, X)) continue;
		const int Na = CornerNear(X.A), Nb = CornerNear(X.B);
		if ((Na < 0) == (Nb < 0)) continue;     // both known, or neither
		const V2 Known = Na >= 0 ? X.A : X.B, Far = Na >= 0 ? X.B : X.A;
		const int Node = Na >= 0 ? Na : Nb;
		const Rect R = G.Blocks[Node / 4];
		const V2 D = AxisDir(Far - Known);
		const V2 KerbPoint = Far - D * 90.f;
		Rect V = R;
		if (D.x != 0.f)
		{
			const float Wide = std::min(R.Hi.x - R.Lo.x, 12000.f);
			V.Lo.x = D.x > 0 ? KerbPoint.x : KerbPoint.x - Wide;
			V.Hi.x = D.x > 0 ? KerbPoint.x + Wide : KerbPoint.x;
		}
		else
		{
			const float Wide = std::min(R.Hi.y - R.Lo.y, 12000.f);
			V.Lo.y = D.y > 0 ? KerbPoint.y : KerbPoint.y - Wide;
			V.Hi.y = D.y > 0 ? KerbPoint.y + Wide : KerbPoint.y;
			// one city block deep from the corner we come from, never across the next side street
			const float CornerX = R.Corner(Node % 4).x;
			const float Toward = (R.Lo.x + R.Hi.x) * 0.5f > CornerX ? 1.f : -1.f;
			const float Deep = std::min(R.Hi.x - R.Lo.x, 6880.f);
			V.Lo.x = std::min(CornerX, CornerX + Toward * Deep);
			V.Hi.x = std::max(CornerX, CornerX + Toward * Deep);
		}
		// never lay one over a block that exists: the superblock has no 41st Street through it
		bool bOverlaps = false;
		for (size_t B = 0; B < G.Blocks.size() && !bOverlaps; ++B)
		{
			const Rect& O = G.Blocks[B];
			bOverlaps = V.Lo.x < O.Hi.x - 50.f && V.Hi.x > O.Lo.x + 50.f && V.Lo.y < O.Hi.y - 50.f && V.Hi.y > O.Lo.y + 50.f;
		}
		for (size_t B = 0; B < G.Blocks.size() && !bOverlaps; ++B)
		{
			const Rect& O = G.Blocks[B];
			bOverlaps = Far.x > O.Lo.x - 8.f && Far.x < O.Hi.x + 8.f && Far.y > O.Lo.y - 8.f && Far.y < O.Hi.y + 8.f;
		}
		if (!bOverlaps && CornerNear(Far) < 0) G.Blocks.push_back(V);
	}
	// junctions: every corner, plus wherever a crosswalk meets a long side (superblocks have several)
	for (int B = 0; B < (int)G.Blocks.size(); ++B)
	{
		for (int C = 0; C < 4; ++C) G.Nodes.push_back({ B, G.Blocks[B].Corner(C) });
	}
	auto NodeFor = [&](V2 P)
	{
		const int Corner = CornerNear(P);
		if (Corner >= 0) return Corner;
		for (int B = 0; B < (int)G.Blocks.size(); ++B)
		{
			const Rect& R = G.Blocks[B];
			if (P.x < R.Lo.x - 8.f || P.x > R.Hi.x + 8.f || P.y < R.Lo.y - 8.f || P.y > R.Hi.y + 8.f) continue;
			// the end of a crosswalk sits 90 cm in from the kerb it serves
			const float Gaps[4] = { P.y - R.Lo.y, R.Hi.x - P.x, R.Hi.y - P.y, P.x - R.Lo.x };
			int Side = 0;
			for (int k = 1; k < 4; ++k) if (Gaps[k] < Gaps[Side]) Side = k;
			if (Gaps[Side] > 140.f) continue;
			const V2 OnKerb = Side == 0 ? V2(P.x, R.Lo.y) : (Side == 1 ? V2(R.Hi.x, P.y) : (Side == 2 ? V2(P.x, R.Hi.y) : V2(R.Lo.x, P.y)));
			for (int N = 0; N < (int)G.Nodes.size(); ++N)
			{
				if (G.Nodes[N].Block == B && Len(G.Nodes[N].P - OnKerb) < 260.f) return N;
			}
			G.Nodes.push_back({ B, OnKerb });
			return (int)G.Nodes.size() - 1;
		}
		return -1;
	};
	struct Link { int Cross, A, B; V2 Dir; };
	std::vector<Link> Links;
	for (int K = 0; K < (int)In.Crossings.size(); ++K)
	{
		const CityCrossing& X = In.Crossings[K];
		if (!CrossesStreet(In, X)) continue;
		const int A = NodeFor(X.A), B = NodeFor(X.B);
		if (A < 0 || B < 0 || G.Nodes[A].Block == G.Nodes[B].Block) continue;
		Links.push_back({ K, A, B, AxisDir(X.B - X.A) });
	}
	G.Out.resize(G.Nodes.size());
	auto AddEdge = [&](int From, int To, int Cross, V2 Dir)
	{
		G.Out[From].push_back((int)G.Edges.size());
		G.Edges.push_back({ From, To, Cross, Dir });
		return (int)G.Edges.size() - 1;
	};
	for (int B = 0; B < (int)G.Blocks.size(); ++B)
	{
		const Rect& R = G.Blocks[B];
		for (int Side = 0; Side < 4; ++Side)
		{
			const V2 From = R.Corner(Side), To = R.Corner((Side + 1) % 4);
			const V2 Along = Norm(To - From);
			std::vector<std::pair<float, int>> On;
			for (int N = 0; N < (int)G.Nodes.size(); ++N)
			{
				if (G.Nodes[N].Block != B) continue;
				const V2 Rel = G.Nodes[N].P - From;
				if (std::fabs(Dot(Rel, RightOf(Along))) < 2.f && Dot(Rel, Along) > -2.f && Dot(Rel, Along) < Len(To - From) + 2.f)
					On.push_back({ Dot(Rel, Along), N });
			}
			std::sort(On.begin(), On.end());
			for (size_t i = 0; i + 1 < On.size(); ++i)
			{
				AddEdge(On[i].second, On[i + 1].second, -1, AxisDir(Along));
				AddEdge(On[i + 1].second, On[i].second, -1, AxisDir(Along) * -1.f);
			}
		}
	}
	G.CrossEdges.assign(In.Crossings.size(), { -1, -1 });
	for (const Link& L : Links)
	{
		G.CrossEdges[L.Cross].first = AddEdge(L.A, L.B, L.Cross, L.Dir);
		G.CrossEdges[L.Cross].second = AddEdge(L.B, L.A, L.Cross, L.Dir * -1.f);
	}
	return G;
}

/** A closed walk that starts by crossing StartCross. */
inline bool MakeTour(const Graph& G, int StartEdge, float WantLength, uint32_t Seed, std::vector<int>& Tour)
{
	Tour.clear();
	Tour.push_back(StartEdge);
	auto LengthOf = [&](int E)
	{
		const Edge& Ed = G.Edges[E];
		return Len(G.Nodes[Ed.To].P - G.Nodes[Ed.From].P);
	};
	auto Allowed = [&](int Prev, int Next)
	{
		const Edge& P = G.Edges[Prev];
		const Edge& N = G.Edges[Next];
		return Dot(P.Dir, N.Dir) > -0.5f;
	};
	float Total = LengthOf(StartEdge);
	for (int Step = 0; Step < 60 && Total < WantLength; ++Step)
	{
		const int Prev = Tour.back();
		const int Node = G.Edges[Prev].To;
		float Weights[8];
		float Sum = 0.f;
		const std::vector<int>& Options = G.Out[Node];
		for (size_t i = 0; i < Options.size() && i < 8; ++i)
		{
			const Edge& E = G.Edges[Options[i]];
			float W = 0.f;
			if (Allowed(Prev, Options[i])) W = Dot(E.Dir, G.Edges[Prev].Dir) > 0.5f ? 5.f : 1.3f;
			if (E.Cross >= 0) W *= 1.35f;
			Weights[i] = W;
			Sum += W;
		}
		if (Sum <= 0.f) return false;
		float Pick = Hash01(Seed, 100u + Step) * Sum;
		size_t i = 0;
		while (i + 1 < Options.size() && (Pick -= Weights[i]) > 0.f) ++i;
		if (Weights[i] <= 0.f) return false;
		Tour.push_back(Options[i]);
		Total += LengthOf(Options[i]);
	}
	// shortest way home without turning back on ourselves
	const int Home = G.Edges[StartEdge].From;
	std::vector<int> From(G.Edges.size(), -2);
	std::deque<int> Queue;
	const int Last = Tour.back();
	From[Last] = -1;
	Queue.push_back(Last);
	while (!Queue.empty())
	{
		const int E = Queue.front();
		Queue.pop_front();
		if (G.Edges[E].To == Home && Allowed(E, StartEdge) && G.Edges[E].Cross != G.Edges[StartEdge].Cross)
		{
			std::vector<int> Back;
			for (int Cur = E; Cur != Last && Cur >= 0; Cur = From[Cur]) Back.push_back(Cur);
			for (int i = (int)Back.size() - 1; i >= 0; --i) Tour.push_back(Back[i]);
			return Tour.size() >= 4;
		}
		for (const int Next : G.Out[G.Edges[E].To])
		{
			if (From[Next] != -2 || !Allowed(E, Next) || Next == StartEdge) continue;
			From[Next] = E;
			Queue.push_back(Next);
		}
	}
	return false;
}

struct ObstacleGrid
{
	static constexpr float Cell = 600.f;
	std::vector<std::pair<int64_t, int>> Keys;
	const std::vector<CityObstacle>* List = nullptr;
	static int64_t Key(int X, int Y) { return ((int64_t)X << 32) ^ (uint32_t)Y; }
	void Build(const std::vector<CityObstacle>& In)
	{
		List = &In;
		for (int i = 0; i < (int)In.size(); ++i)
			Keys.push_back({ Key((int)std::floor(In[i].P.x / Cell), (int)std::floor(In[i].P.y / Cell)), i });
		std::sort(Keys.begin(), Keys.end());
	}
	template <typename F> void Near(V2 P, F&& Fn) const
	{
		const int X = (int)std::floor(P.x / Cell), Y = (int)std::floor(P.y / Cell);
		for (int Dx = -1; Dx <= 1; ++Dx)
		{
			for (int Dy = -1; Dy <= 1; ++Dy)
			{
				const int64_t K = Key(X + Dx, Y + Dy);
				auto It = std::lower_bound(Keys.begin(), Keys.end(), std::make_pair(K, 0));
				for (; It != Keys.end() && It->first == K; ++It) Fn((*List)[It->second]);
			}
		}
	}
};

struct Pts
{
	std::vector<V2> P;
	std::vector<char> Road;
	void Add(V2 Q, bool bRoad = false)
	{
		if (!P.empty() && Len(Q - P.back()) < 1.f) { if (bRoad) Road.back() = 1; return; }
		P.push_back(Q);
		Road.push_back(bRoad ? 1 : 0);
	}
	void Line(V2 A, V2 B, float Step = 45.f, bool bRoad = false)
	{
		const int N = std::max(1, (int)std::ceil(Len(B - A) / Step));
		for (int i = 0; i <= N; ++i) Add(A + (B - A) * ((float)i / N), bRoad);
	}
};

/** Bends a path round the street furniture it would otherwise walk through. */
inline void Deflect(Pts& Path, const ObstacleGrid& Grid)
{
	const int N = (int)Path.P.size();
	if (N < 3) return;
	std::vector<float> Shift(N, 0.f);
	std::vector<V2> Side(N);
	for (int i = 0; i < N; ++i)
	{
		const V2 T = Norm(Path.P[(i + 1) % N] - Path.P[(i + N - 1) % N]);
		Side[i] = RightOf(T);
		if (Path.Road[i]) continue;
		float Right = 0.f, Left = 0.f;
		Grid.Near(Path.P[i], [&](const CityObstacle& O)
		{
			const V2 Rel = O.P - Path.P[i];
			const float Along = Dot(Rel, T), Across = Dot(Rel, Side[i]);
			const float Need = O.R + 30.f;
			if (std::fabs(Along) > 210.f || std::fabs(Across) >= Need) return;
			const float C = std::cos(Along / 210.f * kPi * 0.5f);
			const float Push = (Need - std::fabs(Across)) * C * C;
			if (Across > 0.f) Left = std::max(Left, Push); else Right = std::max(Right, Push);
		});
		Shift[i] = Right - Left;
	}
	for (int Pass = 0; Pass < 3; ++Pass)
	{
		std::vector<float> Next = Shift;
		for (int i = 0; i < N; ++i) Next[i] = 0.25f * Shift[(i + N - 1) % N] + 0.5f * Shift[i] + 0.25f * Shift[(i + 1) % N];
		Shift = Next;
	}
	for (int i = 0; i < N; ++i) Path.P[i] = Path.P[i] + Side[i] * Shift[i];
}

/** Turns points into a route that begins at point StartIndex and reports where the marked points fell. */
inline Route Finish(const Pts& In, int StartIndex, const std::vector<int>& Marks, std::vector<float>& MarkS)
{
	Route R;
	const int N = (int)In.P.size();
	std::vector<float> At(N, 0.f);
	std::vector<char> Road(N, 0);
	for (int k = 0; k <= N; ++k)
	{
		const int i = (StartIndex + k) % N;
		if (k == N) break;
		R.Add(In.P[i]);
		At[i] = R.N.back().S;
	}
	R.Close();
	// stretches on the roadway
	bool bOn = false;
	float Enter = 0.f;
	for (int k = 0; k < N; ++k)
	{
		const int i = (StartIndex + k) % N;
		if (In.Road[i] && !bOn) { bOn = true; Enter = At[i]; }
		if (!In.Road[i] && bOn)
		{
			bOn = false;
			R.Road.push_back({ Enter, At[(i + N - 1) % N] });
		}
	}
	if (bOn) R.Road.push_back({ Enter, At[(StartIndex + N - 1) % N] });
	MarkS.clear();
	for (const int M : Marks) MarkS.push_back(At[M]);
	return R;
}

struct SlotCounter
{
	std::vector<int> Count;
};

struct TourShape
{
	float NearInset, FarInset;     // pavement lanes: kerb on the right / kerb on the left
	float Shift;                   // partner offset toward the building
	float Radius;
	std::vector<float> Lat, Back;  // per crossing on the tour
};

/** Lays a tour out as a path: pavement lanes, crosswalk lanes, rounded corners, kerb stops. */
inline bool LayTour(const CityInput& In, const Graph& G, const std::vector<int>& Tour, const TourShape& Shape,
	const ObstacleGrid& Obstacles, Route& Out, std::vector<StopRequest>& Stops, float React)
{
	struct Leg
	{
		bool bCross, bHorizontal;
		V2 Dir;
		float Line;               // fixed coordinate of the leg's straight part
		float CurbIn, CurbOut;    // along coordinate of the kerbs (crossings)
		int Cross;
		float Back;
		V2 Start, End;
	};
	std::vector<Leg> Legs;
	int CrossNo = 0;
	for (const int E : Tour)
	{
		const Edge& Ed = G.Edges[E];
		Leg L = {};
		L.Dir = Ed.Dir;
		L.bHorizontal = Ed.Dir.x != 0.f;
		L.Cross = Ed.Cross;
		if (Ed.Cross < 0)
		{
			const Rect& R = G.Blocks[G.Nodes[Ed.From].Block];
			const V2 C = G.Nodes[Ed.From].P;
			const V2 Mid = (R.Lo + R.Hi) * 0.5f;
			const float Kerb = L.bHorizontal ? C.y : C.x;
			const float Inward = (L.bHorizontal ? Mid.y : Mid.x) > Kerb ? 1.f : -1.f;
			const V2 InN = L.bHorizontal ? V2(0.f, Inward) : V2(Inward, 0.f);
			// people keep to their right, so the two directions use different lanes
			const bool bKerbOnRight = Dot(InN, RightOf(L.Dir)) < 0.f;
			const float Inset = bKerbOnRight ? Shape.NearInset + Shape.Shift : Shape.FarInset - Shape.Shift;
			L.Line = Kerb + Inward * Inset;
		}
		else
		{
			const CityCrossing& X = In.Crossings[Ed.Cross];
			const bool bForward = Dot(X.B - X.A, Ed.Dir) > 0.f;
			const V2 A = bForward ? X.A : X.B, B = bForward ? X.B : X.A;
			L.bCross = true;
			const float Sign = L.bHorizontal ? Ed.Dir.x : Ed.Dir.y;
			L.Line = (L.bHorizontal ? A.y : A.x) + Shape.Lat[CrossNo];
			L.CurbIn = (L.bHorizontal ? A.x : A.y) + Sign * (90.f - KerbSetback(G.Blocks[G.Nodes[Ed.From].Block], L.bHorizontal, L.Line));
			L.CurbOut = (L.bHorizontal ? B.x : B.y) - Sign * (90.f - KerbSetback(G.Blocks[G.Nodes[Ed.To].Block], L.bHorizontal, L.Line));
			L.Back = Shape.Back[CrossNo];
			++CrossNo;
		}
		// carrying straight on past a junction partway along a side is one leg, not two
		if (!L.bCross && !Legs.empty() && !Legs.back().bCross && Dot(Legs.back().Dir, L.Dir) > 0.5f && std::fabs(Legs.back().Line - L.Line) < 1.f) continue;
		Legs.push_back(L);
	}
	if (Legs.size() > 2 && !Legs.front().bCross && !Legs.back().bCross && Dot(Legs.back().Dir, Legs.front().Dir) > 0.5f
		&& std::fabs(Legs.back().Line - Legs.front().Line) < 1.f) Legs.pop_back();
	const int N = (int)Legs.size();
	auto Point = [](const Leg& L, float Along, float Line) { return L.bHorizontal ? V2(Along, Line) : V2(Line, Along); };
	auto AlongOf = [](const Leg& L, V2 P) { return L.bHorizontal ? P.x : P.y; };
	auto SignOf = [](const Leg& L) { return L.bHorizontal ? L.Dir.x : L.Dir.y; };

	// junctions: [i] joins leg i to leg i + 1
	struct Joint { bool bCorner; V2 P; float R; float A0, A1; };
	std::vector<Joint> Joints(N);
	for (int i = 0; i < N; ++i)
	{
		Leg& A = Legs[i];
		Leg& B = Legs[(i + 1) % N];
		Joint& J = Joints[i];
		if (A.bHorizontal != B.bHorizontal)
		{
			J.bCorner = true;
			J.P = A.bHorizontal ? V2(B.Line, A.Line) : V2(A.Line, B.Line);
			float R = Shape.Radius;
			if (B.bCross) R = std::min(R, SignOf(B) * (B.CurbIn - AlongOf(B, J.P)) - 45.f);
			if (A.bCross) R = std::min(R, SignOf(A) * (AlongOf(A, J.P) - A.CurbOut) - 30.f);
			J.R = Clampf(R, 25.f, 220.f);
			A.End = J.P - A.Dir * J.R;
			B.Start = J.P + B.Dir * J.R;
		}
		else
		{
			if (Dot(A.Dir, B.Dir) < 0.f) return false;
			J.bCorner = false;
			// slide from one lane to the other on the pavement, clear of the kerb
			float Along;
			if (B.bCross) Along = B.CurbIn - SignOf(B) * 330.f;
			else if (A.bCross) Along = A.CurbOut + SignOf(A) * 240.f;
			else return false;
			A.End = Point(A, Along - SignOf(A) * 130.f, A.Line);
			B.Start = Point(B, Along + SignOf(B) * 130.f, B.Line);
		}
	}

	Pts Path;
	std::vector<int> Marks;      // for each crossing: waiting spot, far side
	std::vector<int> CrossOf;
	for (int i = 0; i < N; ++i)
	{
		const Leg& L = Legs[i];
		const float Sign = SignOf(L);
		const float S0 = AlongOf(L, L.Start), S1 = AlongOf(L, L.End);
		if (L.bCross)
		{
			// never stop further back than the pavement part of this leg allows
			const float Room = std::max(Sign * (L.CurbIn - S0), 12.f);
			const float Back = std::min(L.Back, Room);
			const float Wait = L.CurbIn - Sign * Back;
			if (Sign * (Wait - S0) > 2.f) Path.Line(L.Start, Point(L, Wait, L.Line));
			else Path.Add(Point(L, Wait, L.Line));
			Marks.push_back((int)Path.P.size() - 1);
			Path.Line(Point(L, Wait, L.Line), Point(L, L.CurbIn, L.Line), 30.f);
			Path.Line(Point(L, L.CurbIn + Sign * 2.f, L.Line), Point(L, L.CurbOut - Sign * 2.f, L.Line), 120.f, true);
			Path.Add(Point(L, L.CurbOut, L.Line));
			Marks.push_back((int)Path.P.size() - 1);
			CrossOf.push_back(L.Cross);
			if (Sign * (S1 - L.CurbOut) > 2.f) Path.Line(Point(L, L.CurbOut, L.Line), L.End);
		}
		else
		{
			if (Sign * (S1 - S0) < -5.f) return false;
			Path.Line(L.Start, L.End);
		}
		const Leg& Next = Legs[(i + 1) % N];
		const Joint& J = Joints[i];
		if (J.bCorner)
		{
			const V2 Centre = J.P - L.Dir * J.R + Next.Dir * J.R;
			for (int k = 1; k < 8; ++k)
			{
				const float U = k / 8.f * kPi * 0.5f;
				Path.Add(Centre - Next.Dir * (std::cos(U) * J.R) + L.Dir * (std::sin(U) * J.R));
			}
		}
		else
		{
			const float A0 = AlongOf(L, L.End), A1 = AlongOf(Next, Next.Start);
			for (int k = 1; k < 8; ++k)
			{
				const float U = k / 8.f;
				Path.Add(Point(L, Lerpf(A0, A1, U), Lerpf(L.Line, Next.Line, Smooth01(U))));
			}
		}
	}
	if (Marks.size() < 2) return false;
	Deflect(Path, Obstacles);
	std::vector<float> MarkS;
	Out = Finish(Path, Marks[0], Marks, MarkS);
	Stops.clear();
	for (size_t c = 0; c < CrossOf.size(); ++c)
	{
		const CityCrossing& X = In.Crossings[CrossOf[c]];
		float Far = MarkS[c * 2 + 1] - MarkS[c * 2];
		if (Far < 0.f) Far += Out.Length;
		float S = c == 0 ? 0.f : MarkS[c * 2];
		Stops.push_back({ S, X.Group, X.Offset, Far + 60.f, React });
	}
	for (size_t c = 1; c < Stops.size(); ++c) if (Stops[c].S <= Stops[c - 1].S) return false;
	return true;
}

/** A block's ring at the given inset, with rounded corners. */
inline Route LayRing(const Rect& R, float Inset, float Radius, bool bReverse, const ObstacleGrid& Obstacles)
{
	const V2 Lo = R.Lo + V2(Inset, Inset), Hi = R.Hi - V2(Inset, Inset);
	const float Rad_ = std::min(Radius, std::min(Hi.x - Lo.x, Hi.y - Lo.y) * 0.45f);
	Pts P;
	const V2 Centres[4] = { V2(Hi.x - Rad_, Hi.y - Rad_), V2(Lo.x + Rad_, Hi.y - Rad_), V2(Lo.x + Rad_, Lo.y + Rad_), V2(Hi.x - Rad_, Lo.y + Rad_) };
	for (int C = 0; C < 4; ++C)
	{
		V2 First;
		for (int k = 0; k <= 8; ++k)
		{
			const float A = (C * 90.f + k * 11.25f) * kPi / 180.f;
			const V2 Q = Centres[C] + V2(std::cos(A), std::sin(A)) * Rad_;
			if (k == 0) First = Q;
			P.Add(Q);
		}
		const float A = ((C + 1) * 90.f) * kPi / 180.f;
		const V2 NextStart = Centres[(C + 1) % 4] + V2(std::cos(A), std::sin(A)) * Rad_;
		P.Line(P.P.back(), NextStart);
		(void)First;
	}
	if (bReverse)
	{
		std::reverse(P.P.begin(), P.P.end());
		std::reverse(P.Road.begin(), P.Road.end());
	}
	Deflect(P, Obstacles);
	std::vector<float> Unused;
	return Finish(P, 0, {}, Unused);
}
}

/** Gives a resident a build, a gait and belongings. */
inline void Personify(Resident& P, const std::vector<VariantTraits>& Traits, uint32_t Seed, int Archetype)
{
	P.Seed = Seed;
	P.Variant = (int)(Hash01(Seed, 1u) * Traits.size()) % (int)Traits.size();
	const VariantTraits& T = Traits[P.Variant];
	P.Archetype = Archetype;
	Style& S = P.W.Gait;
	S.Seed = Seed;
	S.Scale = HashRange(Seed, 2u, 0.968f, 1.032f);
	const float Height = T.Height * S.Scale;
	auto R = [Seed](uint32_t C, float A, float B) { return HashRange(Seed, C, A, B); };

	float Speed = 134.f + (Hash01(Seed, 3u) + Hash01(Seed, 4u) + Hash01(Seed, 5u) - 1.5f) * 17.f;
	S.ArmFwd = R(6u, 0.26f, 0.40f);
	S.ArmBack = R(7u, 0.17f, 0.28f);
	S.ArmBias = R(8u, -0.01f, 0.07f);
	S.ElbowBase = R(9u, 0.20f, 0.40f);
	S.ElbowSwing = R(10u, 0.24f, 0.48f);
	S.ArmOut = R(11u, 0.085f, 0.13f) + T.ArmOut;
	S.ArmLag = R(12u, 0.005f, 0.065f);
	S.Lean = R(13u, 0.025f, 0.085f) + T.Age * 0.06f;
	S.HeadPitch = R(14u, -0.09f, 0.02f) - T.Age * 0.05f;
	S.Bob = R(15u, 1.85f, 2.4f);
	S.Sway = R(16u, 1.5f, 2.6f) * (T.Female ? 0.95f : 1.05f);
	S.PelvisYaw = R(17u, 0.065f, 0.11f);
	S.PelvisList = T.Female ? R(18u, 0.075f, 0.105f) : R(18u, 0.045f, 0.072f);
	S.ChestYaw = R(19u, 0.055f, 0.095f);
	S.ToeOut = R(20u, 0.05f, 0.17f);
	S.StepWidth = (T.Female ? R(21u, 12.0f, 15.0f) : R(21u, 13.5f, 18.0f));
	float StepFactor = R(22u, 0.96f, 1.04f);
	if (Archetype == ARCH_BRISK)
	{
		Speed = R(23u, 150.f, 166.f);
		S.ArmFwd *= 1.22f; S.ArmBack *= 1.18f; S.Lean += 0.035f; S.Bob *= 1.06f; StepFactor *= 1.03f;
	}
	else if (Archetype == ARCH_STROLLER)
	{
		Speed = R(23u, 108.f, 119.f);
		S.ArmFwd *= 0.62f; S.ArmBack *= 0.7f; S.Lean *= 0.5f; S.Sway *= 1.2f; S.ElbowSwing *= 0.7f; StepFactor *= 0.97f;
	}
	else if (Archetype == ARCH_PHONE)
	{
		Speed = R(23u, 110.f, 128.f);
		S.HeadPitch = -0.40f - R(24u, 0.f, 0.12f); S.ArmFwd *= 0.6f; S.Lean += 0.03f;
	}
	Speed = Clampf(Speed * T.Pace, 108.f, 167.f);
	S.Speed = Speed;
	// the walk ratio: step length over cadence stays about the same for one person
	const float Ratio = 0.0065f * Height / 175.f;
	const float Cadence = std::sqrt(Speed / 100.f * 60.f / Ratio);
	S.StepLen = Speed * 60.f / Cadence * StepFactor;

	// December: some keep their hands in their pockets, more when it snows
	if (Hash01(Seed, 30u) < 0.15f)
	{
		const float Which = Hash01(Seed, 31u);
		P.PocketL = Which < 0.82f ? 1.f : 0.f;
		P.PocketR = Which > 0.18f ? 1.f : 0.f;
	}
	if (Hash01(Seed, 32u) < 0.5f) P.ColdPockets = R(33u, 0.12f, 0.55f);
	if (Hash01(Seed, 34u) < 0.25f) S.Hunch = R(35u, 0.3f, 0.9f);

	// umbrellas go up one at a time as the rain thickens
	const float Likely = T.Umbrella * (T.HoodUp ? 0.4f : 1.f);
	if (Hash01(Seed, 36u) < 0.68f * Likely) P.UmbrellaRain = R(37u, 0.06f, 0.32f);
	if (Hash01(Seed, 38u) < 0.24f * Likely) P.UmbrellaSnow = R(39u, 0.3f, 0.75f);
	const float Brolly = Hash01(Seed, 40u);
	P.UmbrellaStyle = Brolly < 0.74f ? 0 : 1;

	// belongings
	if (T.Shoulder == 1) P.CarryL = 0.45f;
	if (T.Shoulder == 2) P.CarryL = 0.2f;
	if (Archetype == ARCH_PHONE && T.Phone) P.PropR = PROP_PHONE;
	else
	{
		const float Pick = Hash01(Seed, 41u);
		if (Pick < 0.09f && T.Coffee) P.PropR = PROP_COFFEE;
		const float Bag = Hash01(Seed, 42u);
		int Held = PROP_NONE;
		if (T.Briefcase && Bag < 0.30f) Held = PROP_BRIEFCASE;
		else if (T.ShopBag && Bag > 0.80f) Held = PROP_SHOPBAG;
		if (Held != PROP_NONE)
		{
			// the umbrella needs the right hand
			const bool bRight = P.PropR == PROP_NONE && P.UmbrellaRain > 1.f && P.UmbrellaSnow > 1.f && Hash01(Seed, 43u) < 0.5f;
			if (bRight) { P.PropR = Held; P.CarryR = 1.f; P.PocketR = 0.f; }
			else if (T.Shoulder == 0) { P.PropL = Held; P.CarryL = 1.f; P.PocketL = 0.f; }
		}
	}
	if (P.PropR == PROP_PHONE || P.PropR == PROP_COFFEE) P.PocketR = 0.f;
}

struct PopulationParams
{
	float Density = 1.f;
	uint32_t Seed = 4242;
};

inline std::vector<Resident> Populate(const CityInput& In, const std::vector<VariantTraits>& Traits, const PopulationParams& Params)
{
	std::vector<Resident> Out;
	if (Traits.empty()) return Out;
	const city::Graph G = city::BuildGraph(In);
	city::ObstacleGrid Obstacles;
	Obstacles.Build(In.Obstacles);
	uint32_t Next = Params.Seed * 977u + 1u;
	auto Archetype = [](uint32_t Seed)
	{
		const float A = Hash01(Seed, 50u);
		return A < 0.11f ? ARCH_BRISK : (A < 0.21f ? ARCH_STROLLER : (A < 0.30f ? ARCH_PHONE : ARCH_EVERYDAY));
	};
	auto Busy = [](V2 P)
	{
		// the pavements round 42nd and Fifth are the busiest
		const float D = Len(P - V2(-3000.f, 3000.f));
		return 1.f + 0.45f * std::exp(-D * D / (22000.f * 22000.f));
	};
	auto Link = [&Out](int A, int B)
	{
		Out[A].Partner = B;
		Out[B].Partner = A;
	};
	auto SetSides = [&Out](int A, int B)
	{
		const Resident& Ra = Out[A];
		const Resident& Rb = Out[B];
		const GaitState Ga = Locate(Ra.W, Ra.W.Time.Base + 3.0), Gb = Locate(Rb.W, Ra.W.Time.Base + 3.0);
		const V2 Pa = Ra.W.Path.At(Ga.S), Pb = Rb.W.Path.At(Gb.S);
		const float Side = Dot(Pb - Pa, RightOf(Ra.W.Path.Heading(Ga.S, 60.f))) >= 0.f ? 1.f : -1.f;
		Out[A].TalkSide = Side;
		Out[B].TalkSide = -Side;
	};

	// ---- people going round their block ----------------------------------------------------------
	for (size_t B = 0; B < G.NumReal; ++B)
	{
		const city::Rect& R = G.Blocks[B];
		const float Perimeter = 2.f * (R.Hi.x - R.Lo.x + R.Hi.y - R.Lo.y);
		const V2 Mid = (R.Lo + R.Hi) * 0.5f;
		const int Count = (int)std::lround(Perimeter / 100.f / 18.5f * Params.Density * Busy(Mid) * HashRange(Next, 7u, 0.62f, 1.38f));
		for (int k = 0; k < Count; ++k)
		{
			const uint32_t Seed = ++Next * 7919u + 13u;
			const bool bReverse = Hash01(Seed, 60u) < 0.5f;
			// counter-clockwise rings have the building on the left, so the kerb is on the right
			const bool bKerbOnRight = !bReverse;
			const float Inset = bKerbOnRight ? HashRange(Seed, 61u, 150.f, 218.f) : HashRange(Seed, 61u, 246.f, 322.f);
			const float Radius = HashRange(Seed, 62u, 110.f, 200.f);
			Resident P;
			Personify(P, Traits, Seed, Archetype(Seed));
			P.W.Path = city::LayRing(R, Inset, Radius, bReverse, Obstacles);
			P.W.Time = Schedule::Constant(P.W.Path.Length, P.W.Gait.Speed, Hash01(Seed, 63u) * P.W.Path.Length);
			const float Phase = Hash01(Seed, 63u) * P.W.Path.Length;
			const bool bPair = Hash01(Seed, 64u) < 0.17f && P.Archetype != ARCH_PHONE;
			const int Mine = (int)Out.size();
			P.W.Plan = BuildFootPlan(P.W.Time, P.W.Gait, Seed);
			Out.push_back(std::move(P));
			if (bPair)
			{
				const uint32_t Seed2 = Seed ^ 0x5bd1e995u;
				Resident Q;
				Personify(Q, Traits, Seed2, ARCH_EVERYDAY);
				const float Inset2 = bKerbOnRight ? Inset + 66.f : Inset - 66.f;
				Q.W.Path = city::LayRing(R, Inset2, Radius, bReverse, Obstacles);
				// same lap time, so they stay side by side all the way round
				const float Speed2 = Out[Mine].W.Gait.Speed * Q.W.Path.Length / Out[Mine].W.Path.Length;
				const float Ratio = Speed2 / Q.W.Gait.Speed;
				Q.W.Gait.Speed = Speed2;
				Q.W.Gait.StepLen *= std::sqrt(Ratio);
				const float Along = HashRange(Seed2, 65u, -16.f, 16.f);
				Q.W.Time = Schedule::Constant(Q.W.Path.Length, Speed2, Phase * Q.W.Path.Length / Out[Mine].W.Path.Length + Along);
				Q.W.Plan = BuildFootPlan(Q.W.Time, Q.W.Gait, Seed2);
				const int Theirs = (int)Out.size();
				Out.push_back(std::move(Q));
				Link(Mine, Theirs);
				SetSides(Mine, Theirs);
			}
		}
		// a few stand about by the doorways, alone or talking
		const int Standers = (int)(HashRange((uint32_t)B + 77u, 8u, 0.f, 3.4f) * Params.Density);
		for (int k = 0; k < Standers; ++k)
		{
			const uint32_t Seed = ++Next * 7919u + 13u;
			const int Side = (int)(Hash01(Seed, 70u) * 4.f) % 4;
			const V2 A = R.Corner(Side), C = R.Corner((Side + 1) % 4);
			const V2 Dir = Norm(C - A);
			const float Along = HashRange(Seed, 71u, 800.f, std::max(900.f, Len(C - A) - 800.f));
			V2 Inward = RightOf(Dir);
			const V2 Centre = (R.Lo + R.Hi) * 0.5f;
			if (Dot(Inward, Centre - A) < 0.f) Inward = Inward * -1.f;
			const V2 At = A + Dir * Along + Inward * HashRange(Seed, 72u, 352.f, 372.f);
			const bool bTalking = Hash01(Seed, 73u) < 0.42f;
			auto Stand = [&](uint32_t S2, V2 Pos, V2 Face)
			{
				Resident P;
				Personify(P, Traits, S2, Hash01(S2, 74u) < 0.3f ? ARCH_PHONE : ARCH_STANDING);
				P.StandPitch = P.Archetype == ARCH_PHONE ? -0.42f : 0.f;
				P.W.Gait.HeadPitch = P.Archetype == ARCH_PHONE ? -0.36f : P.W.Gait.HeadPitch;
				P.W.Path.bFixed = true;
				P.W.Path.N.push_back({ Pos.x, Pos.y, 0.f });
				P.W.Path.FixedDir = Norm(Face);
				P.W.Path.Length = 0.f;
				P.W.Time = Schedule::Standing(Hash01(S2, 75u) * 120.f);
				P.W.Plan = BuildFootPlan(P.W.Time, P.W.Gait, S2);
				Out.push_back(std::move(P));
				return (int)Out.size() - 1;
			};
			if (bTalking)
			{
				const int I = Stand(Seed, At - Dir * 43.f, Dir + Inward * -0.15f);
				const int J = Stand(Seed ^ 0x2545F491u, At + Dir * 43.f, Dir * -1.f + Inward * -0.25f);
				Link(I, J);
				Out[I].TalkSide = 0.02f;
				Out[J].TalkSide = -0.02f;
				if (Out[I].PropR == PROP_PHONE) Out[I].PropR = PROP_NONE;
				if (Out[J].PropR == PROP_PHONE) Out[J].PropR = PROP_NONE;
				Out[I].Archetype = Out[J].Archetype = ARCH_STANDING;
				Out[I].W.Gait.HeadPitch = Out[J].W.Gait.HeadPitch = -0.02f;
			}
			else
			{
				const float Turn = HashRange(Seed, 76u, -0.9f, 0.9f);
				const V2 Face = Inward * -std::cos(Turn) + Dir * std::sin(Turn);
				Stand(Seed, At, Face);
			}
		}
	}

	// ---- park paths ------------------------------------------------------------------------------
	for (size_t L = 0; L < In.Loops.size(); ++L)
	{
		const std::vector<V2>& Loop = In.Loops[L];
		if (Loop.size() == 4) continue;
		float Length = 0.f;
		for (size_t i = 0; i < Loop.size(); ++i) Length += Len(Loop[(i + 1) % Loop.size()] - Loop[i]);
		const int Count = (int)std::lround(Length / 100.f / 17.f * Params.Density);
		for (int k = 0; k < Count; ++k)
		{
			const uint32_t Seed = ++Next * 7919u + 13u;
			const bool bReverse = Hash01(Seed, 80u) < 0.5f;
			const float Lat = HashRange(Seed, 81u, 35.f, 95.f);
			city::Pts Path;
			const int N = (int)Loop.size();
			for (int i = 0; i < N; ++i)
			{
				const int A = bReverse ? (N - i) % N : i;
				const int B2 = bReverse ? (N - i - 1 + N) % N : (i + 1) % N;
				const int Z = bReverse ? (N - i + 1) % N : (i + N - 1) % N;
				const V2 Tangent = Norm(Loop[B2] - Loop[Z]);
				Path.Add(Loop[A] + RightOf(Tangent) * Lat);
			}
			std::vector<float> Unused;
			Resident P;
			Personify(P, Traits, Seed, Hash01(Seed, 82u) < 0.4f ? ARCH_STROLLER : Archetype(Seed));
			P.W.Path = city::Finish(Path, 0, {}, Unused);
			P.W.Time = Schedule::Constant(P.W.Path.Length, P.W.Gait.Speed, Hash01(Seed, 83u) * P.W.Path.Length);
			P.W.Plan = BuildFootPlan(P.W.Time, P.W.Gait, Seed);
			Out.push_back(std::move(P));
		}
	}

	// ---- people with somewhere to go: routes over the crosswalks ----------------------------------
	std::vector<int> Waiting(In.Crossings.size() * 2, 0);
	for (int K = 0; K < (int)In.Crossings.size(); ++K)
	{
		if (G.CrossEdges[K].first < 0) continue;
		const int Count = (int)std::lround(HashRange((uint32_t)K + 11u, 9u, 6.2f, 9.8f) * Params.Density * Busy(In.Crossings[K].A));
		for (int k = 0; k < Count; ++k)
		{
			const uint32_t Seed = ++Next * 7919u + 13u;
			const bool bFlip = (k & 1) != 0;
			const int Start = bFlip ? G.CrossEdges[K].second : G.CrossEdges[K].first;
			std::vector<int> Tour;
			city::TourShape Shape;
			Route Path;
			std::vector<StopRequest> Stops;
			Resident P;
			Personify(P, Traits, Seed, Archetype(Seed));
			const float React = HashRange(Seed, 90u, 0.25f, 2.3f);
			bool bOk = false;
			std::vector<int> Slots;
			for (int Try = 0; Try < 6 && !bOk; ++Try)
			{
				const uint32_t S2 = Seed + Try * 104729u;
				if (!city::MakeTour(G, Start, HashRange(S2, 91u, 9000.f, 34000.f), S2, Tour)) continue;
				Shape.NearInset = HashRange(S2, 92u, 152.f, 214.f);
				Shape.FarInset = HashRange(S2, 93u, 250.f, 316.f);
				Shape.Shift = 0.f;
				Shape.Radius = HashRange(S2, 94u, 70.f, 150.f);
				Shape.Lat.clear();
				Shape.Back.clear();
				Slots.clear();
				for (const int E : Tour)
				{
					const int X = G.Edges[E].Cross;
					if (X < 0) continue;
					// give each person their own place to wait at this corner
					const int Mouth = X * 2 + (E == G.CrossEdges[X].second ? 1 : 0);
					const int Slot = Waiting[Mouth];
					Slots.push_back(Mouth);
					const uint32_t Sj = S2 + (uint32_t)Slot * 31u + (uint32_t)X * 7u;
					Shape.Lat.push_back(-88.f + 66.f * ((Slot * 3 + 1) % 4) + HashRange(Sj, 95u, -14.f, 14.f));
					Shape.Back.push_back(34.f + 58.f * ((Slot / 4) % 3) + HashRange(Sj, 96u, -9.f, 20.f));
				}
				bOk = city::LayTour(In, G, Tour, Shape, Obstacles, Path, Stops, React);
			}
			if (!bOk) continue;
			for (const int Mouth : Slots) ++Waiting[Mouth];
			P.W.Path = Path;
			P.W.Time = BuildTimed(Path.Length, P.W.Gait.Speed, Stops, In.Sig, Seed, &Path);
			for (const StopRequest& Sr : Stops) P.CrossSignals.push_back({ Sr.Group, Sr.Offset });
			// spread the departures over the cycles of the lap
			const int Cycles = std::max(1, (int)std::lround(P.W.Time.Period / In.Sig.Cycle));
			P.W.Time.Base += (double)In.Sig.Cycle * (int)(Hash01(Seed, 97u) * Cycles);
			P.W.Plan = BuildFootPlan(P.W.Time, P.W.Gait, Seed);
			const double Base = P.W.Time.Base;
			const float Speed = P.W.Gait.Speed;
			const bool bPair = Hash01(Seed, 98u) < 0.18f && P.Archetype != ARCH_PHONE;
			const int Mine = (int)Out.size();
			Out.push_back(std::move(P));
			if (bPair)
			{
				const uint32_t Seed2 = Seed ^ 0x5bd1e995u;
				city::TourShape Shape2 = Shape;
				Shape2.Shift = 66.f;
				for (float& L : Shape2.Lat) L += L > 0.f ? -64.f : 64.f;
				Route Path2;
				std::vector<StopRequest> Stops2;
				Resident Q;
				Personify(Q, Traits, Seed2, ARCH_EVERYDAY);
				if (city::LayTour(In, G, Tour, Shape2, Obstacles, Path2, Stops2, React + HashRange(Seed2, 99u, -0.1f, 0.2f)))
				{
					const float Ratio = Speed / Q.W.Gait.Speed;
					Q.W.Gait.Speed = Speed;
					Q.W.Gait.StepLen *= std::sqrt(Ratio);
					Q.W.Path = Path2;
					Q.W.Time = BuildTimed(Path2.Length, Speed, Stops2, In.Sig, Seed, &Path2);
					for (const StopRequest& Sr : Stops2) Q.CrossSignals.push_back({ Sr.Group, Sr.Offset });
					const double Whole = std::round((Base - Q.W.Time.Base) / In.Sig.Cycle) * In.Sig.Cycle;
					Q.W.Time.Base += Whole;
					Q.W.Plan = BuildFootPlan(Q.W.Time, Q.W.Gait, Seed2);
					const int Theirs = (int)Out.size();
					Out.push_back(std::move(Q));
					Link(Mine, Theirs);
					SetSides(Mine, Theirs);
				}
			}
		}
	}
	return Out;
}

// ------------------------------------------------------------------------------------------------ avoidance
constexpr float kMaxStepAside = 72.f;

/** A walker as others see it for a moment. */
struct Mover
{
	V2 P;
	V2 D;          // direction of travel
	float Speed;
};

/** How far Me should step aside (cm, positive to the right) because of Other.  Smooth in both, and zero
 *  beyond 7.5 m, so it can be evaluated for any instant from the two analytic positions alone. */
inline float AvoidPush(const Mover& Me, const Mover& Other, float Tie = 1.f)
{
	const V2 Rel = Other.P - Me.P;
	const float D2 = Dot(Rel, Rel);
	if (D2 > 750.f * 750.f) return 0.f;
	const V2 Vel = Other.D * Other.Speed - Me.D * Me.Speed;
	const float Tca = Clampf(-Dot(Rel, Vel) / (Dot(Vel, Vel) + 900.f), 0.f, 2.4f);
	const V2 Then = Rel + Vel * Tca;
	const float Along = Dot(Then, Me.D), Across = Dot(Then, RightOf(Me.D));
	const float Need = 66.f;
	const float Room = SoftPos(Need - std::fabs(Across), 9.f);
	if (Room <= 0.f) return 0.f;
	// Away from them.  Meeting head on, both bear right.  Going the same way, bearing right would keep
	// them stacked, so they part along whatever offset they already have; dead level, a fixed tie-break
	// (opposite for the two of them) decides who goes which side.
	const float Same = SmoothRange(0.1f, 0.75f, Dot(Me.D, Other.D));
	const float Way = -std::tanh((Across - Lerpf(3.f, 2.5f * Tie, Same)) / Lerpf(5.f, 4.5f, Same));
	const float Close = 1.f - SmoothRange(55.f, 175.f, std::fabs(Along));
	const float Soon = 1.f - SmoothRange(1.25f, 2.4f, Tca);
	const float Near = 1.f - SmoothRange(560.f, 750.f, std::sqrt(D2));
	const float Share = Lerpf(1.f, 0.55f, SmoothRange(10.f, 50.f, Other.Speed));
	return Way * Room * Close * Soon * Near * Share;
}

inline Mover MoverAt(const Walker& W, double Time)
{
	const float Tau = W.Time.Local(Time);
	float Speed = 0.f;
	const float S = W.Time.Eval(Tau, &Speed);
	Mover M;
	M.P = W.Path.At(S);
	M.D = W.Path.Heading(S, 40.f);
	M.Speed = Speed;
	return M;
}

/** How far a walker steps aside at Time to get past the people listed in Near.  A function of Time
 *  alone (every neighbour is evaluated at that same instant), so a planted foot never moves.
 *  Get(i) returns the Resident with index i. */
template <typename GetResident>
inline float AvoidanceAt(const GetResident& Get, int Index, double Time, const int* Near, int NumNear)
{
	const Resident& P = Get(Index);
	const Walker& W = P.W;
	const float Tau = W.Time.Local(Time);
	float Speed = 0.f;
	const float S = W.Time.Eval(Tau, &Speed);
	// people standing, or about to stand at a kerb, hold their ground
	const float Respond = SmoothRange(12.f, 62.f, Speed) * SmoothRange(55.f, 250.f, W.Time.StopDistance(S));
	if (Respond <= 0.001f) return 0.f;
	Mover Me;
	Me.P = W.Path.At(S);
	Me.D = W.Path.Heading(S, 40.f);
	Me.Speed = Speed;
	float Sum = 0.f;
	for (int k = 0; k < NumNear; ++k)
	{
		if (Near[k] == P.Partner) continue;
		Sum += AvoidPush(Me, MoverAt(Get(Near[k]).W, Time), Index < Near[k] ? 1.f : -1.f);
	}
	return kMaxStepAside * std::tanh(Sum / kMaxStepAside) * Respond;
}
}
