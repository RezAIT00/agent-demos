// Where each walker is, as a pure function of the clock.
//
//   Route     a closed path (polyline with rounded corners), with the stretches that lie on the roadway
//   Schedule  distance along the route against time: eased starts and stops, waits for the walk signal
//   FootPlan  every footprint the walker will ever make in one lap: where it lands, when it lands and
//             when it lifts.  A planted foot is one fixed footprint, so it cannot slide.
//
// Everything is periodic and built once; evaluating it at time t needs no history.
#pragma once

#include <vector>

#include "WalkerPose.h"

namespace nycw
{
constexpr float kCurbHeight = 15.f;

// ------------------------------------------------------------------------------------------------ route
struct RouteNode
{
	float X, Y, S;
};

struct Route
{
	std::vector<RouteNode> N;             // closed: the last node repeats the first, S = length
	float Length = 0.f;
	std::vector<std::pair<float, float>> Road;   // [enter, leave] distances where the path is on the roadway
	float GroundHigh = kCurbHeight, GroundLow = 0.f;
	bool bFixed = false;       // someone standing: one spot and one direction to face
	V2 FixedDir = V2(1.f, 0.f);

	void Add(V2 P)
	{
		if (N.empty()) { N.push_back({ P.x, P.y, 0.f }); return; }
		const float D = Len(P - V2(N.back().X, N.back().Y));
		if (D < 0.5f) return;
		N.push_back({ P.x, P.y, N.back().S + D });
	}
	void Close()
	{
		if (N.size() < 2) return;
		Add(V2(N.front().X, N.front().Y));
		Length = N.back().S;
	}
	float Wrap(float S) const
	{
		if (Length <= 0.f) return 0.f;
		S = std::fmod(S, Length);
		return S < 0.f ? S + Length : S;
	}
	int Find(float S) const
	{
		int Lo = 0, Hi = (int)N.size() - 1;
		while (Hi - Lo > 1)
		{
			const int Mid = (Lo + Hi) / 2;
			if (N[Mid].S <= S) Lo = Mid; else Hi = Mid;
		}
		return Lo;
	}
	V2 At(float S) const
	{
		if (bFixed) return V2(N[0].X, N[0].Y) + FixedDir * S;
		if (N.size() < 2) return N.empty() ? V2() : V2(N[0].X, N[0].Y);
		S = Wrap(S);
		const int I = Find(S);
		const RouteNode& A = N[I];
		const RouteNode& B = N[I + 1];
		const float T = B.S > A.S ? (S - A.S) / (B.S - A.S) : 0.f;
		return V2(Lerpf(A.X, B.X, T), Lerpf(A.Y, B.Y, T));
	}
	/** Direction of travel averaged over +-Half, which turns corners gradually. */
	V2 Heading(float S, float Half) const
	{
		if (bFixed) return FixedDir;
		const V2 D = At(S + Half) - At(S - Half);
		if (Len(D) < 1.f) return Norm(At(S + Half * 2.f + 5.f) - At(S));
		return Norm(D);
	}
	bool OnRoad(float S) const
	{
		if (bFixed) return false;
		S = Wrap(S);
		for (const auto& R : Road) if (S >= R.first && S <= R.second) return true;
		return false;
	}
	float GroundZ(float S) const { return OnRoad(S) ? GroundLow : GroundHigh; }
	/** Moves a footprint fully onto one side of a kerb so no foot straddles the edge. */
	float ClearOfKerb(float S) const
	{
		const float W = Wrap(S);
		for (const auto& R : Road)
		{
			// footprint origin is under the ankle: the shoe reaches 7 cm behind and 21 cm ahead of it
			for (const float Edge : { R.first, R.second })
			{
				const float D = W - Edge;
				if (D > -23.f && D < 9.f) return S + (D < -7.f ? -23.f - D : 9.f - D);
			}
		}
		return S;
	}
};

// ------------------------------------------------------------------------------------------------ schedule
struct MoveSeg
{
	float T0, Dur, S0, V0, V1;
	float DistAt(float U) const { return S0 + Dur * (V0 * U + (V1 - V0) * (U * U * U - 0.5f * U * U * U * U)); }
	float SpeedAt(float U) const { return V0 + (V1 - V0) * U * U * (3.f - 2.f * U); }
	float EndS() const { return DistAt(1.f); }
};

struct Schedule
{
	std::vector<MoveSeg> Seg;
	float Period = 1.f;      // seconds per lap
	float Dist = 0.f;        // distance per lap
	double Base = 0.0;       // absolute time of lap-local zero
	std::vector<float> Stops; // distances at which the walker stands still

	float Local(double T) const
	{
		double R = std::fmod(T - Base, (double)Period);
		if (R < 0.0) R += Period;
		return (float)R;
	}
	int Find(float Tau) const
	{
		int Lo = 0, Hi = (int)Seg.size();
		while (Hi - Lo > 1)
		{
			const int Mid = (Lo + Hi) / 2;
			if (Seg[Mid].T0 <= Tau) Lo = Mid; else Hi = Mid;
		}
		return Lo;
	}
	/** Lap-local distance and speed at lap-local time (times outside the lap wrap, distance follows). */
	float Eval(float Tau, float* Speed = nullptr) const
	{
		float Laps = std::floor(Tau / Period);
		Tau -= Laps * Period;
		const MoveSeg& M = Seg[Find(Tau)];
		const float U = M.Dur > 0.f ? Sat((Tau - M.T0) / M.Dur) : 1.f;
		if (Speed) *Speed = M.SpeedAt(U);
		return Laps * Dist + M.DistAt(U);
	}
	/** First lap-local time at which distance S is reached. */
	float TimeAt(float S) const
	{
		for (const MoveSeg& M : Seg)
		{
			const float End = M.EndS();
			if (S <= End + 0.001f && End > M.S0 + 0.001f)
			{
				float Lo = 0.f, Hi = 1.f;
				for (int It = 0; It < 22; ++It)
				{
					const float Mid = 0.5f * (Lo + Hi);
					if (M.DistAt(Mid) < S) Lo = Mid; else Hi = Mid;
				}
				return M.T0 + M.Dur * Hi;
			}
		}
		return Period;
	}
	/** Distance along the route to the nearest place this walker stands still. */
	float StopDistance(float S) const
	{
		if (Stops.empty() || Dist <= 0.f) return 1.0e9f;
		float W = std::fmod(S, Dist);
		if (W < 0.f) W += Dist;
		float Best = 1.0e9f;
		for (const float P : Stops)
		{
			const float D = std::fabs(W - P);
			Best = std::min(Best, std::min(D, Dist - D));
		}
		return Best;
	}
	static Schedule Constant(float Length, float Speed, float PhaseDist)
	{
		Schedule R;
		R.Dist = Length;
		R.Period = Length / Speed;
		R.Seg.push_back({ 0.f, R.Period, 0.f, Speed, Speed });
		R.Base = -(double)PhaseDist / Speed;
		return R;
	}
	static Schedule Standing(float Phase)
	{
		Schedule R;
		R.Dist = 0.f;
		R.Period = 120.f;
		R.Seg.push_back({ 0.f, R.Period, 0.f, 0.f, 0.f });
		R.Base = -(double)Phase;
		return R;
	}
};

// ------------------------------------------------------------------------------------------------ signals
struct Signals
{
	float Cycle = 90.f, AveGreen = 45.f, Yellow = 3.5f, AllRed = 2.f;
	float WalkStart(int Group) const { return Group == 0 ? 0.f : AveGreen + Yellow + AllRed; }
	float WalkLength(int Group) const { return Group == 0 ? AveGreen : Cycle - AveGreen - 2.f * Yellow - 2.f * AllRed; }
	/** Absolute time of the first walk signal for (Group, Offset) at or after T. */
	double NextWalk(int Group, float Offset, double T) const
	{
		const double Phase = (double)WalkStart(Group) - Offset;
		return Phase + std::ceil((T - Phase) / Cycle) * Cycle;
	}
};

struct StopRequest
{
	float S;          // distance along the route of the waiting spot
	int Group;        // signal group, or -1 for a plain pause
	float Offset;     // signal offset
	float CrossDist;  // distance from the waiting spot to the far kerb
	float React;      // seconds this walker takes to set off after the signal changes
};

/** Builds a lap with waits at the crossings.  The lap always lasts a whole number of signal cycles, so
 *  it repeats exactly.  The route must start at the waiting spot of Crossings[0]. */
inline Schedule BuildTimed(float Length, float Cruise, const std::vector<StopRequest>& Crossings, const Signals& Sig, uint32_t Seed,
	const Route* Path = nullptr)
{
	const float Ta = 1.25f + 0.35f * Hash01(Seed, 11u);   // time to reach cruising speed
	const float Td = 1.55f + 0.35f * Hash01(Seed, 12u);   // time to come to rest
	const StopRequest& First = Crossings[0];
	const double Depart = Sig.NextWalk(First.Group, First.Offset, 0.0) + First.React;

	auto Build = [&](float PauseAt, float PauseFor, float& OutArrive, int& OutLastWaitSeg)
	{
		Schedule R;
		R.Dist = Length;
		R.Base = Depart;
		R.Stops.push_back(0.f);
		float T = 0.f, S = 0.f, V = 0.f;
		auto Push = [&](float Dur, float V1)
		{
			if (Dur <= 0.0005f) { V = V1; return; }
			const MoveSeg M = { T, Dur, S, V, V1 };
			R.Seg.push_back(M);
			S = M.EndS();
			T += Dur;
			V = V1;
		};
		/* travel to Target and come to rest there */
		auto StopAt = [&](float Target, float WaitUntil)
		{
			float Span = Target - S;
			if (V <= 0.f)
			{
				float Peak = Cruise;
				float Ramp = Peak * (Ta + Td) * 0.5f;
				if (Ramp > Span) { Peak = std::max(20.f, 2.f * Span / (Ta + Td)); Ramp = Span; }
				Push(Ta, Peak);
				const float Flat = (Target - S) - Peak * Td * 0.5f;
				if (Flat > 0.5f) Push(Flat / Peak, Peak);
				Push(2.f * std::max(Target - S, 0.f) / std::max(Peak, 1.f), 0.f);
			}
			else
			{
				const float Brake = V * Td * 0.5f;
				if (Span > Brake + 0.5f) Push((Span - Brake) / V, V);
				Push(2.f * std::max(Target - S, 0.f) / std::max(V, 1.f), 0.f);
			}
			R.Stops.push_back(Target >= Length - 1.f ? 0.f : Target);
			if (WaitUntil > T) Push(WaitUntil - T, 0.f);
		};
		/* keep walking to Target, setting off first if standing */
		auto WalkTo = [&](float Target)
		{
			if (V <= 0.f)
			{
				const float Ramp = Cruise * Ta * 0.5f;
				const float Peak = Ramp > Target - S ? std::max(20.f, 2.f * (Target - S) / Ta) : Cruise;
				Push(Ta, Peak);
			}
			if (Target - S > 0.5f) Push((Target - S) / std::max(V, 20.f), V);
		};
		bool bPaused = false;
		for (size_t i = 1; i < Crossings.size(); ++i)
		{
			const StopRequest& C = Crossings[i];
			if (!bPaused && PauseFor > 0.f && PauseAt < C.S)
			{
				StopAt(PauseAt, 0.f);
				Push(PauseFor, 0.f);
				bPaused = true;
			}
			if (C.S - S < 150.f) continue;
			// when would we reach the kerb without breaking stride?
			const float Reach = T + (C.S - S) / Cruise + (V <= 0.f ? Ta * 0.5f : 0.f);
			const double Abs = Depart + Reach;
			const double Open = Sig.NextWalk(C.Group, C.Offset, Abs - Sig.Cycle);
			const double Latest = Open + Sig.WalkLength(C.Group) - C.CrossDist / Cruise - 1.0;
			if (Abs > Open + 0.8 && Abs < Latest)
			{
				WalkTo(C.S);
				continue;
			}
			const float Brake = Cruise * Td * 0.5f / Cruise;
			const double Rest = Depart + Reach + Brake;
			const double Go = Sig.NextWalk(C.Group, C.Offset, Rest - 0.3) + C.React;
			StopAt(C.S, (float)(Go - Depart));
		}
		if (!bPaused && PauseFor > 0.f && PauseAt < Length - 100.f)
		{
			StopAt(PauseAt, 0.f);
			Push(PauseFor, 0.f);
		}
		OutLastWaitSeg = (int)R.Seg.size();
		StopAt(Length, 0.f);
		OutArrive = T;
		R.Period = T;
		return R;
	};

	float Arrive = 0.f;
	int LastWait = 0;
	Schedule R = Build(0.f, 0.f, Arrive, LastWait);
	auto LapFor = [&](float A) { return std::ceil((A + 1.2f) / Sig.Cycle) * Sig.Cycle; };
	float Wait = LapFor(Arrive) - Arrive;
	if (Wait > 34.f)
	{
		// arrived just after the lights changed: spend the spare time on the pavement on the way instead
		const float LastStop = Crossings.back().S;
		const float Room = Length - LastStop;
		if (Room > 1500.f)
		{
			float PauseAt = LastStop + Room * (0.35f + 0.3f * Hash01(Seed, 13u));
			// nobody stops to look at their phone in the middle of a road
			for (int Try = 0; Path && Try < 24 && (Path->OnRoad(PauseAt) || Path->OnRoad(PauseAt - 260.f) || Path->OnRoad(PauseAt + 120.f)); ++Try)
			{
				PauseAt = LastStop + Room * (0.12f + 0.8f * Hash01(Seed, 14u + Try));
			}
			const bool bClear = !Path || !(Path->OnRoad(PauseAt) || Path->OnRoad(PauseAt - 260.f) || Path->OnRoad(PauseAt + 120.f));
			const float PauseFor = bClear ? std::max(2.f, Wait - 7.f - (Ta + Td) * 0.5f) : 0.f;
			float Arrive2 = 0.f;
			Schedule R2 = Build(PauseAt, PauseFor, Arrive2, LastWait);
			if (LapFor(Arrive2) - Arrive2 < Wait)
			{
				R = R2;
				Arrive = Arrive2;
				Wait = LapFor(Arrive) - Arrive;
			}
		}
	}
	const float Lap = LapFor(Arrive);
	R.Seg.push_back({ Arrive, Lap - Arrive, Length, 0.f, 0.f });
	R.Period = Lap;
	return R;
}

// ------------------------------------------------------------------------------------------------ footsteps
/** At heel strike the hips are slightly ahead of the midpoint between the footprints: this is how far
 *  they trail it, as a share of a step (negative = lead). */
constexpr float kHipTrail = -0.035f;

enum EStepKind : uint8_t { STEP_WALK, STEP_CLOSE, STEP_SHUFFLE };

struct Placement
{
	float Land;      // lap-local time the foot arrives
	float Lift;      // lap-local time it leaves again
	float S;         // distance along the route
	float Hs;        // heel strike pitch on arrival (toes up)
	float To;        // toe-off pitch on leaving (heel up, negative)
	float Lat;       // personal offset across the path, cm
	uint8_t Kind;
};

struct FootPlan
{
	std::vector<Placement> F[2];
	float Period = 1.f, Dist = 0.f;

	/** The placement foot Side is on (or leaving) at Tau and the one it goes to next, with times and
	 *  distances unwrapped so they are continuous around Tau. */
	void At(int Side, float Tau, Placement& Cur, Placement& Next) const
	{
		const std::vector<Placement>& V = F[Side];
		const int Num = (int)V.size();
		int Lo = -1, Hi = Num;
		while (Hi - Lo > 1)
		{
			const int Mid = (Lo + Hi) / 2;
			if (V[Mid].Land <= Tau) Lo = Mid; else Hi = Mid;
		}
		auto Get = [&](int I)
		{
			int Wraps = I < 0 ? -1 : (I >= Num ? 1 : 0);
			Placement P = V[I - Wraps * Num];
			P.Land += Wraps * Period;
			P.Lift += Wraps * Period;
			P.S += Wraps * Dist;
			return P;
		};
		Cur = Get(Lo);
		Next = Get(Lo + 1);
		// a lift time that wrapped around the lap
		if (Cur.Lift < Cur.Land) Cur.Lift += Period;
		if (Next.Lift < Next.Land) Next.Lift += Period;
	}
};

inline FootPlan BuildFootPlan(const Schedule& Sch, const Style& St, uint32_t Seed)
{
	struct Raw { float Land, S, Lat; int Side; uint8_t Kind; };
	std::vector<Raw> Steps;
	FootPlan Plan;
	Plan.Period = Sch.Period;
	Plan.Dist = Sch.Dist;
	auto Jit = [&](int K, float Amount) { return (Hash01(Seed, 900u + (uint32_t)K) - 0.5f) * 2.f * Amount; };

	const bool bNeverStops = Sch.Seg.size() == 1 && Sch.Seg[0].V0 > 0.f;
	const bool bStanding = Sch.Dist <= 0.f;
	int Counter = 0;
	if (bNeverStops)
	{
		int Num = std::max(4, (int)std::lround(Sch.Dist / St.StepLen));
		if (Num & 1) ++Num;
		const float B = Sch.Dist / Num;
		const float V = Sch.Seg[0].V0;
		for (int K = 0; K < Num; ++K)
		{
			const float S = (K + 0.75f) * B + Jit(K, 1.6f);
			// strike time follows where the hips are relative to the two footprints
			Steps.push_back({ ((K + 0.25f) * B - B * kHipTrail) / V, S, Jit(K + 5000, 1.1f), K & 1, STEP_WALK });
		}
	}
	else if (bStanding)
	{
		// feet apart under the hips, one a little forward; every so often one of them is moved
		float Fwd[2] = { Jit(1, 7.f), Jit(2, 7.f) };
		float Side[2] = { Jit(3, 3.5f), Jit(4, 3.5f) };
		Steps.push_back({ 0.5f, Fwd[0], Side[0], 0, STEP_SHUFFLE });
		Steps.push_back({ 1.4f, Fwd[1], Side[1], 1, STEP_SHUFFLE });
		float T = 6.f + 8.f * Hash01(Seed, 41u);
		int K = 0;
		while (T < Sch.Period - 6.f)
		{
			const int Foot = Hash01(Seed, 300u + K) < 0.5f ? 0 : 1;
			Steps.push_back({ T, Jit(310 + K, 9.f), Jit(330 + K, 4.5f), Foot, STEP_SHUFFLE });
			T += 7.f + 11.f * Hash01(Seed, 350u + K);
			++K;
		}
	}
	else
	{
		// walking intervals separated by waits
		size_t I = 0;
		const size_t Num = Sch.Seg.size();
		int Foot = Hash01(Seed, 21u) < 0.5f ? 0 : 1;
		float PrevEndS = 0.f;
		while (I < Num)
		{
			if (Sch.Seg[I].V0 <= 0.f && Sch.Seg[I].V1 <= 0.f) { ++I; continue; }
			size_t J = I;
			while (J + 1 < Num && !(Sch.Seg[J + 1].V0 <= 0.f && Sch.Seg[J + 1].V1 <= 0.f)
				&& !(Sch.Seg[J].V1 <= 0.f)) ++J;
			const float Ta = Sch.Seg[I].T0, Tb = Sch.Seg[J].T0 + Sch.Seg[J].Dur;
			const float Sa = Sch.Seg[I].S0, Sb = Sch.Seg[J].EndS();
			const float D = Sb - Sa;
			if (D > 5.f)
			{
				const int Count = std::max(2, (int)std::lround(D / St.StepLen + 0.75f));
				const float B = D / (Count - 0.75f);
				float PrevP = Sa;
				float PrevT = Ta - 0.2f;
				for (int K = 1; K <= Count; ++K)
				{
					const float P = K == Count ? Sb : Sa + (0.55f + (K - 1)) * B;
					// the heel lands as the hips pass the middle of the two footprints
					float T = Sch.TimeAt(0.5f * (PrevP + P) - (K == Count ? 0.f : B * kHipTrail));
					T = std::max(T, PrevT + (K == 1 ? 0.62f : 0.34f));
					const float Wob = K == Count ? Jit(Counter, 3.f) : Jit(Counter, 1.4f);
					Steps.push_back({ T, P + Wob, Jit(Counter + 5000, 1.1f), Foot, STEP_WALK });
					Foot ^= 1;
					++Counter;
					PrevP = P;
					PrevT = T;
				}
				// the trailing foot comes up beside the leading one
				const float TClose = std::max(Tb - 0.05f, PrevT + 0.52f);
				Steps.push_back({ TClose, Sb - 4.f + Jit(Counter, 4.f), Jit(Counter + 5000, 2.5f), Foot, STEP_CLOSE });
				++Counter;
				PrevEndS = Sb;
				// small adjustments while waiting
				float WaitEnd = Sch.Period;
				for (size_t W = J + 1; W < Num; ++W)
				{
					if (!(Sch.Seg[W].V0 <= 0.f && Sch.Seg[W].V1 <= 0.f)) { WaitEnd = Sch.Seg[W].T0; break; }
				}
				float T = TClose + 3.5f + 5.f * Hash01(Seed, 600u + Counter);
				int K = 0;
				int LastFoot = Foot;
				while (T < WaitEnd - 2.6f && K < 12)
				{
					LastFoot = Hash01(Seed, 620u + Counter + K) < 0.5f ? 0 : 1;
					Steps.push_back({ T, Sb + Jit(640 + Counter + K, 8.f), Jit(660 + Counter + K, 4.f), LastFoot, STEP_SHUFFLE });
					T += 5.f + 9.f * Hash01(Seed, 680u + Counter + K);
					++K;
				}
				Foot = Hash01(Seed, 700u + Counter) < 0.5f ? 0 : 1;
			}
			I = J + 1;
		}
		(void)PrevEndS;
	}

	std::sort(Steps.begin(), Steps.end(), [](const Raw& A, const Raw& B) { return A.Land < B.Land; });
	for (const Raw& R : Steps)
	{
		Plan.F[R.Side].push_back({ std::min(R.Land, Sch.Period - 0.01f), 0.f, R.S, 0.f, 0.f, R.Lat, R.Kind });
	}
	// every foot needs at least one placement
	for (int Side = 0; Side < 2; ++Side)
	{
		if (Plan.F[Side].empty()) Plan.F[Side].push_back({ 0.5f, 0.f, 0.f, 0.f, 0.f, 0.f, STEP_SHUFFLE });
	}

	// lift times: a foot leaves shortly after the other one has landed
	for (int Side = 0; Side < 2; ++Side)
	{
		const int Num = (int)Plan.F[Side].size();
		const std::vector<Placement>& Other = Plan.F[Side ^ 1];
		for (int I = 0; I < Num; ++I)
		{
			Placement& P = Plan.F[Side][I];
			Placement N = Plan.F[Side][(I + 1) % Num];
			if (I + 1 >= Num) { N.Land += Plan.Period; N.S += Plan.Dist; }
			// latest strike of the other foot before the next landing
			float OtherLand = P.Land;
			float OtherS = P.S;
			for (int W = -1; W <= 1; ++W)
			{
				for (const Placement& O : Other)
				{
					const float L = O.Land + W * Plan.Period;
					if (L < N.Land - 0.02f && L > OtherLand) { OtherLand = L; OtherS = O.S + W * Plan.Dist; }
				}
			}
			float Swing = (N.Land - OtherLand) * 0.82f;
			if (N.Kind == STEP_SHUFFLE) Swing = 0.52f;
			else if (N.Kind == STEP_CLOSE) Swing = Clampf(Swing, 0.38f, 0.55f);
			else Swing = Clampf(Swing, 0.30f, 0.52f);
			float Lift = N.Land - Swing;
			Lift = std::max(Lift, P.Land + 0.05f);
			P.Lift = Lift >= Plan.Period ? Lift - Plan.Period : Lift;
			(void)OtherS;
		}
	}
	// roll angles follow the length of the step arriving and leaving
	{
		struct Ref { float Land; int Side, I; };
		std::vector<Ref> Order;
		for (int Side = 0; Side < 2; ++Side)
			for (int I = 0; I < (int)Plan.F[Side].size(); ++I) Order.push_back({ Plan.F[Side][I].Land, Side, I });
		std::sort(Order.begin(), Order.end(), [](const Ref& A, const Ref& B) { return A.Land < B.Land; });
		const int Num = (int)Order.size();
		for (int K = 0; K < Num; ++K)
		{
			Placement& P = Plan.F[Order[K].Side][Order[K].I];
			const Placement& Before = Plan.F[Order[(K + Num - 1) % Num].Side][Order[(K + Num - 1) % Num].I];
			float Into = P.S - Before.S;
			if (K == 0) Into += Plan.Dist;
			const float Amount = Sat((Into - 10.f) / 52.f);
			P.Hs = P.Kind == STEP_SHUFFLE ? 0.f : Rad(22.f) * Amount * (P.Kind == STEP_CLOSE ? 0.25f : 1.f);
		}
		for (int Side = 0; Side < 2; ++Side)
		{
			const int Count = (int)Plan.F[Side].size();
			for (int I = 0; I < Count; ++I)
			{
				Placement& P = Plan.F[Side][I];
				const Placement& N = Plan.F[Side][(I + 1) % Count];
				float Travel = N.S - P.S;
				if (I + 1 >= Count) Travel += Plan.Dist;
				P.To = N.Kind == STEP_SHUFFLE ? -Rad(7.f) : -Rad(66.f) * Sat((Travel - 14.f) / 108.f);
			}
		}
	}
	return Plan;
}

// ------------------------------------------------------------------------------------------------ evaluation
struct Walker
{
	Route Path;
	Schedule Time;
	FootPlan Plan;
	Style Gait;
};

/** Sideways offset (cm, positive to the walker's right) added to the path at the five instants a pose
 *  needs: now, and the two placements of each foot. */
struct LateralSet
{
	float Now = 0.f;
	float Cur[2] = { 0.f, 0.f };
	float Next[2] = { 0.f, 0.f };
};

struct GaitState
{
	float Tau = 0.f;
	float S = 0.f;
	float Speed = 0.f;
	Placement Cur[2], Next[2];
};

inline GaitState Locate(const Walker& W, double Time)
{
	GaitState G;
	G.Tau = W.Time.Local(Time);
	G.S = W.Time.Eval(G.Tau, &G.Speed);
	for (int i = 0; i < 2; ++i) W.Plan.At(i, G.Tau, G.Cur[i], G.Next[i]);
	return G;
}

struct Footprint
{
	V3 Origin;
	float Yaw;
};

inline Footprint FootprintAt(const Walker& W, const Placement& P, int Side, float Lateral, float Slope)
{
	const float Sign = Side == 0 ? -1.f : 1.f;
	const float S = W.Path.ClearOfKerb(P.S);
	const V2 Dir = W.Path.Heading(S, 28.f);
	const V2 Right = RightOf(Dir);
	const V2 Pos = W.Path.At(S) + Right * (Lateral + Sign * W.Gait.StepWidth * 0.5f + P.Lat + (P.Kind != STEP_WALK ? Sign * 3.2f : 0.f));
	Footprint F;
	F.Origin = V3(Pos.x, Pos.y, W.Path.GroundZ(S));
	F.Yaw = std::atan2(Dir.y, Dir.x) + Sign * (W.Gait.ToeOut + (P.Kind != STEP_WALK ? 0.045f : 0.f)) + Slope;
	return F;
}

/** A foot that is on the ground: heel strike rolls flat, stays, then the heel peels off. */
inline void StanceFoot(const Skeleton& Sk, const Footprint& F, const Placement& P, float T, FootSample& Out, float Scale = 1.f)
{
	const float Dur = std::max(P.Lift - P.Land, 0.05f);
	const float Load = std::min(0.115f, 0.3f * Dur);
	const float OffStart = std::max(P.Land + std::max(0.50f * Dur, Load), P.Lift - 0.34f);
	float Pitch = 0.f, Toe = 0.f;
	if (T < P.Land + Load)
	{
		const float U = Sat((T - P.Land) / Load);
		Pitch = P.Hs * (1.f - U * (2.f - U));
		Toe = Pitch;
	}
	else if (T > OffStart && P.Lift > OffStart)
	{
		const float U = Sat((T - OffStart) / (P.Lift - OffStart));
		Pitch = P.To * std::pow(U, 2.3f);
		// the toes stay flat on the ground while the heel comes up
		Toe = std::min(0.f, Pitch + Rad(56.f));
	}
	Out.Ankle = AnkleForPitch(Sk, F.Origin, F.Yaw, Pitch, Scale);
	Out.Yaw = F.Yaw;
	Out.Pitch = Pitch;
	Out.ToePitch = Toe;
	Out.SupportZ = F.Origin.z;
	Out.Planted = true;
}

inline void SwingFoot(const Skeleton& Sk, const Footprint& A, const Footprint& B, const Placement& Cur, const Placement& Next,
	float T, int Side, FootSample& Out, float Scale = 1.f)
{
	const float Lift = Cur.Lift, Land = Next.Land;
	const float Dur = std::max(Land - Lift, 0.05f);
	const float U = Sat((T - Lift) / Dur);
	const float Eps = 0.022f;
	FootSample L0, L1, E0, E1;
	StanceFoot(Sk, A, Cur, Lift - 0.0001f, L0, Scale);
	StanceFoot(Sk, A, Cur, Lift - Eps, E0, Scale);
	StanceFoot(Sk, B, Next, Land, L1, Scale);
	StanceFoot(Sk, B, Next, Land + Eps, E1, Scale);
	V3 V0 = (L0.Ankle - E0.Ankle) * (1.f / Eps);
	V3 V1 = (E1.Ankle - L1.Ankle) * (1.f / Eps);
	const V3 Travel = B.Origin - A.Origin;
	const float Span = std::sqrt(Travel.x * Travel.x + Travel.y * Travel.y);
	// keep the end tangents modest so short steps do not overshoot
	const float Limit = Span / Dur * 1.1f + 12.f;
	auto Cap = [Limit](V3 V) { const float L = Len(V); return L > Limit ? V * (Limit / L) : V; };
	V0 = Cap(V0);
	V1 = Cap(V1);
	// the ankle leaves the ground already moving forward faster than the hips, so the knee keeps folding
	if (Span > 20.f)
	{
		const V3 Way(Travel.x / Span, Travel.y / Span, 0.f);
		const float Have = Dot(V0, Way), Want = 0.58f * Span / Dur;
		if (Have < Want) V0 += Way * (Want - Have);
	}
	const float U2 = U * U, U3 = U2 * U;
	V3 P = L0.Ankle * (2.f * U3 - 3.f * U2 + 1.f) + V0 * (Dur * (U3 - 2.f * U2 + U))
		+ L1.Ankle * (-2.f * U3 + 3.f * U2) + V1 * (Dur * (U3 - U2));
	// reach the landing spot a little early over the ground, so the knee is straight before the heel strikes
	{
		const float Ahead = Sat(U + 0.065f * std::sin(kPi * U) * std::sin(kPi * U));
		const float A2 = Ahead * Ahead, A3 = A2 * Ahead;
		const V3 Flat = L0.Ankle * (2.f * A3 - 3.f * A2 + 1.f) + V0 * (Dur * (A3 - 2.f * A2 + Ahead))
			+ L1.Ankle * (-2.f * A3 + 3.f * A2) + V1 * (Dur * (A3 - A2));
		P.x = Flat.x;
		P.y = Flat.y;
	}

	const float Stride = Sat(Span / 120.f);
	float Pitch = Lerpf(Cur.To, Next.Hs, Smooth01(Sat(U * 1.12f))) + 0.09f * Stride * std::sin(kPi * U) * std::sin(kPi * U);
	const float ToeFollow = Smooth01(U / 0.34f);
	const float Toe = Lerpf(L0.ToePitch, Pitch, ToeFollow);

	// the heel kicks up behind just after toe-off, which is what bends the knee
	const float Kick = std::sin(kPi * Sat(U / 0.62f));
	P.z += 5.2f * Stride * Kick * Kick;

	// keep toe and heel off the ground, and over the kerb when stepping up or down
	const float Z0 = A.Origin.z, Z1 = B.Origin.z;
	float Ground = Lerpf(Z0, Z1, Smooth01(U));
	if (Z1 > Z0 + 1.f) Ground = Lerpf(Z0, Z1, Smooth01(U / 0.34f));
	else if (Z1 < Z0 - 1.f) Ground = Lerpf(Z0, Z1, Smooth01((U - 0.55f) / 0.45f));
	const Q Pq = PitchQ(Pitch);
	const float TipZ = (Rot(Pq, V3(Sk.BallX, 0.f, -Sk.AnkleH)).z + std::min(0.f, std::sin(Toe)) * (Sk.TipX - Sk.BallX)) * Scale;
	const float HeelZ = Rot(Pq, V3(Sk.HeelX, 0.f, -Sk.AnkleH)).z * Scale;
	const float Window = Smooth01(U / 0.16f) * Smooth01((1.f - U) / 0.16f);
	const float Clear = (Z1 != Z0 ? 4.5f : 1.7f) * Window;
	const float Lowest = P.z + std::min(TipZ, HeelZ) - Ground;
	P.z += SoftPos(Clear - Lowest, 0.9f) * Smooth01(U / 0.09f) * Smooth01((1.f - U) / 0.09f);

	const V3 Dir(std::cos(B.Yaw), std::sin(B.Yaw), 0.f);
	const V3 Right(-Dir.y, Dir.x, 0.f);
	// the swinging foot passes slightly wide of the standing ankle
	P += Right * ((Side == 0 ? -1.f : 1.f) * 1.9f * Stride * std::sin(kPi * U));
	if (Next.Kind == STEP_SHUFFLE) P.z += 1.6f * std::sin(kPi * U);

	Out.Ankle = P;
	Out.Yaw = A.Yaw + WrapAngle(B.Yaw - A.Yaw) * Smooth01(U);
	Out.Pitch = Pitch;
	Out.ToePitch = Toe;
	Out.SupportZ = Lerpf(Z0, Z1, Smooth01((U - 0.3f) / 0.7f));
	Out.Planted = false;
}

/** A value that holds, then eases to a new random target every so often. */
inline float Wander(uint32_t Seed, uint32_t Channel, float T, float Every, float Ease)
{
	const float K = T / Every + Hash01(Seed, Channel);
	const float Idx = std::floor(K);
	const float F = (K - Idx) * Every;
	const auto Target = [&](float I) { return Hash01(Seed + Channel * 977u, (uint32_t)(int32_t)I + 100000u) * 2.f - 1.f; };
	return Lerpf(Target(Idx - 1.f), Target(Idx), Smooth01(F / Ease));
}

/** Fills the pose input from the plan: feet, hips, phase and the body's heading. */
inline void EvaluateGait(const Skeleton& Sk, const Walker& W, const GaitState& G, const LateralSet& Lat, double Time, PoseInput& In)
{
	const Style& St = W.Gait;
	const float Tau = G.Tau;
	for (int i = 0; i < 2; ++i)
	{
		const Placement& Cur = G.Cur[i];
		const Placement& Next = G.Next[i];
		const float Span = Next.S - Cur.S;
		const float Slope = Span > 25.f ? Clampf(std::atan((Lat.Next[i] - Lat.Cur[i]) / Span), -0.35f, 0.35f) : 0.f;
		const Footprint A = FootprintAt(W, Cur, i, Lat.Cur[i], Slope);
		if (Tau < Cur.Lift)
		{
			StanceFoot(Sk, A, Cur, Tau, In.Foot[i], W.Gait.Scale);
		}
		else
		{
			const Footprint B = FootprintAt(W, Next, i, Lat.Next[i], Slope);
			SwingFoot(Sk, A, B, Cur, Next, Tau, i, In.Foot[i], W.Gait.Scale);
		}
	}

	// stride phase from the nearest strikes either side of now: 0 as the left heel lands
	{
		const int NextSide = G.Next[0].Land < G.Next[1].Land ? 0 : 1;
		const float NextT = G.Next[NextSide].Land;
		const float LastT = std::max(G.Cur[0].Land, G.Cur[1].Land);
		const float Dur = Clampf(NextT - LastT, 0.2f, 0.72f);
		const float F = Sat((Tau - (NextT - Dur)) / Dur);
		In.Phase = (NextSide == 0 ? 0.5f : 0.f) + 0.5f * F;
		if (In.Phase >= 1.f) In.Phase -= 1.f;
	}
	const float Cruise = std::max(St.Speed, 60.f);
	In.Walk = Smooth01(G.Speed / (0.72f * Cruise));
	In.StepAmp = 0.5f + 0.5f * Sat(G.Speed / Cruise);

	const V2 Dir = W.Path.Heading(G.S, 62.f);
	const V2 Right = RightOf(Dir);
	const V2 Centre = W.Path.At(G.S) + Right * Lat.Now;
	// over the standing leg: left while the left foot bears the weight
	const float Sway = -St.Sway * In.Walk * std::sin(kTwoPi * (In.Phase - 0.015f));
	const V2 Pelvis = Centre + Right * Sway;
	In.PelvisXY = Pelvis;
	In.SupportZ = 0.5f * (In.Foot[0].SupportZ + In.Foot[1].SupportZ);
	In.RootPos = V3(Centre.x, Centre.y, In.SupportZ);
	In.RootYaw = std::atan2(Dir.y, Dir.x);
	const V2 Before = W.Path.Heading(G.S - 60.f, 40.f);
	const V2 After = W.Path.Heading(G.S + 90.f, 40.f);
	const float Bend = WrapAngle(std::atan2(After.y, After.x) - std::atan2(Before.y, Before.x));
	In.Turn = Clampf(Bend * 0.28f, -0.3f, 0.3f) * In.Walk;

	// standing still: shift weight, breathe, look about
	const float Clock = (float)std::fmod(Time, 3600.0);
	In.Time = Clock;
	const float Shift = Wander(St.Seed, 3u, Clock, 4.6f, 1.5f);
	In.WeightShift = Clampf(Shift * 1.7f, -1.f, 1.f);
	In.Breathe = std::sin(Clock * (1.5f + 0.35f * Hash01(St.Seed, 9u)) + Hash01(St.Seed, 10u) * 6.2f);
	const float LookRaw = Wander(St.Seed, 4u, Clock, 3.1f, 0.75f);
	// mostly ahead, now and then a real look to one side
	const float Look = LookRaw * LookRaw * LookRaw;
	In.HeadYaw = Look * Lerpf(0.95f, 0.42f, In.Walk);
	In.HeadPitch = Wander(St.Seed, 6u, Clock, 3.7f, 0.9f) * 0.05f;
}
}
