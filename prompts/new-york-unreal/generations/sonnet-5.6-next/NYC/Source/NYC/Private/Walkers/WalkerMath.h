// Small math types for the walker core.  Plain C++17 with no engine headers, so the same code runs inside
// Unreal and inside the standalone gait test harness (tools/gaittest).
//
// Axes follow Unreal: +X forward, +Y right, +Z up.  Distances are centimetres, angles radians.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace nycw
{
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTwoPi = 6.28318530717958647692f;

inline float Rad(float Deg) { return Deg * (kPi / 180.f); }
inline float Deg(float R) { return R * (180.f / kPi); }
inline float Clampf(float X, float A, float B) { return X < A ? A : (X > B ? B : X); }
inline float Sat(float X) { return Clampf(X, 0.f, 1.f); }
inline float Lerpf(float A, float B, float T) { return A + (B - A) * T; }
inline float Smooth01(float T) { T = Sat(T); return T * T * (3.f - 2.f * T); }
inline float Smoother01(float T) { T = Sat(T); return T * T * T * (T * (T * 6.f - 15.f) + 10.f); }
inline float SmoothRange(float A, float B, float X) { return Smooth01((X - A) / (B - A)); }
inline float Fract(float X) { return X - std::floor(X); }
inline float WrapAngle(float A)
{
	A = std::fmod(A + kPi, kTwoPi);
	if (A < 0.f) A += kTwoPi;
	return A - kPi;
}
/** Smooth minimum: never above min(A, B), and within K of it. */
inline float SoftMin(float A, float B, float K)
{
	const float H = Sat(0.5f + 0.5f * (B - A) / K);
	return Lerpf(B, A, H) - K * H * (1.f - H);
}
/** max(X, 0) with a rounded corner of width K. */
inline float SoftPos(float X, float K)
{
	if (X > K) return X;
	if (X < -K) return 0.f;
	const float T = X + K;
	return T * T / (4.f * K);
}

/** Deterministic hash to [0, 1). */
inline float Hash01(uint32_t N)
{
	N ^= N >> 16;
	N *= 0x7feb352du;
	N ^= N >> 15;
	N *= 0x846ca68bu;
	N ^= N >> 16;
	return (float)(N >> 8) * (1.f / 16777216.f);
}
inline float Hash01(uint32_t A, uint32_t B) { return Hash01(A * 0x9E3779B1u + B * 0x85EBCA77u + 0x27d4eb2fu); }
inline float HashRange(uint32_t A, uint32_t B, float Lo, float Hi) { return Lerpf(Lo, Hi, Hash01(A, B)); }

struct V2
{
	float x = 0.f, y = 0.f;
	V2() = default;
	V2(float InX, float InY) : x(InX), y(InY) {}
};
inline V2 operator+(V2 A, V2 B) { return V2(A.x + B.x, A.y + B.y); }
inline V2 operator-(V2 A, V2 B) { return V2(A.x - B.x, A.y - B.y); }
inline V2 operator*(V2 A, float S) { return V2(A.x * S, A.y * S); }
inline float Dot(V2 A, V2 B) { return A.x * B.x + A.y * B.y; }
inline float Len(V2 A) { return std::sqrt(A.x * A.x + A.y * A.y); }
inline V2 Norm(V2 A)
{
	const float L = Len(A);
	return L > 1.0e-6f ? V2(A.x / L, A.y / L) : V2(1.f, 0.f);
}
/** The walker's right hand side when heading along D. */
inline V2 RightOf(V2 D) { return V2(-D.y, D.x); }

struct V3
{
	float x = 0.f, y = 0.f, z = 0.f;
	V3() = default;
	V3(float InX, float InY, float InZ) : x(InX), y(InY), z(InZ) {}
};
inline V3 operator+(V3 A, V3 B) { return V3(A.x + B.x, A.y + B.y, A.z + B.z); }
inline V3 operator-(V3 A, V3 B) { return V3(A.x - B.x, A.y - B.y, A.z - B.z); }
inline V3 operator-(V3 A) { return V3(-A.x, -A.y, -A.z); }
inline V3 operator*(V3 A, float S) { return V3(A.x * S, A.y * S, A.z * S); }
inline V3 operator*(float S, V3 A) { return A * S; }
inline V3& operator+=(V3& A, V3 B) { A.x += B.x; A.y += B.y; A.z += B.z; return A; }
inline float Dot(V3 A, V3 B) { return A.x * B.x + A.y * B.y + A.z * B.z; }
inline V3 Cross(V3 A, V3 B) { return V3(A.y * B.z - A.z * B.y, A.z * B.x - A.x * B.z, A.x * B.y - A.y * B.x); }
inline float Len(V3 A) { return std::sqrt(Dot(A, A)); }
inline V3 Norm(V3 A)
{
	const float L = Len(A);
	return L > 1.0e-6f ? A * (1.f / L) : V3(0.f, 0.f, 1.f);
}
inline V3 Lerp(V3 A, V3 B, float T) { return A + (B - A) * T; }

/** Unit quaternion.  (A * B) rotates by B first, then A, like FQuat. */
struct Q
{
	float x = 0.f, y = 0.f, z = 0.f, w = 1.f;
	Q() = default;
	Q(float InX, float InY, float InZ, float InW) : x(InX), y(InY), z(InZ), w(InW) {}
};
inline Q operator*(const Q& A, const Q& B)
{
	return Q(A.w * B.x + A.x * B.w + A.y * B.z - A.z * B.y,
		A.w * B.y - A.x * B.z + A.y * B.w + A.z * B.x,
		A.w * B.z + A.x * B.y - A.y * B.x + A.z * B.w,
		A.w * B.w - A.x * B.x - A.y * B.y - A.z * B.z);
}
inline Q Conj(const Q& A) { return Q(-A.x, -A.y, -A.z, A.w); }
inline V3 Rot(const Q& R, V3 V)
{
	const V3 U(R.x, R.y, R.z);
	const V3 T = Cross(U, V) * 2.f;
	return V + T * R.w + Cross(U, T);
}
inline Q AxisAngle(V3 Axis, float Angle)
{
	const float H = Angle * 0.5f;
	const float S = std::sin(H);
	return Q(Axis.x * S, Axis.y * S, Axis.z * S, std::cos(H));
}
/** +X toward +Y */
inline Q YawQ(float A) { return Q(0.f, 0.f, std::sin(A * 0.5f), std::cos(A * 0.5f)); }
/** +X toward +Z (nose up); a limb hanging down swings forward. */
inline Q PitchQ(float A) { return Q(0.f, -std::sin(A * 0.5f), 0.f, std::cos(A * 0.5f)); }
/** +Y toward +Z (right side up) */
inline Q RollQ(float A) { return Q(std::sin(A * 0.5f), 0.f, 0.f, std::cos(A * 0.5f)); }

inline Q Normalize(const Q& A)
{
	const float L = std::sqrt(A.x * A.x + A.y * A.y + A.z * A.z + A.w * A.w);
	if (L < 1.0e-8f) return Q();
	const float I = 1.f / L;
	return Q(A.x * I, A.y * I, A.z * I, A.w * I);
}
inline Q Nlerp(const Q& A, Q B, float T)
{
	if (A.x * B.x + A.y * B.y + A.z * B.z + A.w * B.w < 0.f) B = Q(-B.x, -B.y, -B.z, -B.w);
	return Normalize(Q(Lerpf(A.x, B.x, T), Lerpf(A.y, B.y, T), Lerpf(A.z, B.z, T), Lerpf(A.w, B.w, T)));
}
/** Rotation whose matrix has columns X, Y, Z (an orthonormal right-handed set in algebraic terms). */
inline Q FromBasis(V3 X, V3 Y, V3 Z)
{
	const float M00 = X.x, M01 = Y.x, M02 = Z.x;
	const float M10 = X.y, M11 = Y.y, M12 = Z.y;
	const float M20 = X.z, M21 = Y.z, M22 = Z.z;
	const float Tr = M00 + M11 + M22;
	Q R;
	if (Tr > 0.f)
	{
		const float S = std::sqrt(Tr + 1.f) * 2.f;
		R = Q((M21 - M12) / S, (M02 - M20) / S, (M10 - M01) / S, 0.25f * S);
	}
	else if (M00 > M11 && M00 > M22)
	{
		const float S = std::sqrt(1.f + M00 - M11 - M22) * 2.f;
		R = Q(0.25f * S, (M01 + M10) / S, (M02 + M20) / S, (M21 - M12) / S);
	}
	else if (M11 > M22)
	{
		const float S = std::sqrt(1.f + M11 - M00 - M22) * 2.f;
		R = Q((M01 + M10) / S, 0.25f * S, (M12 + M21) / S, (M02 - M20) / S);
	}
	else
	{
		const float S = std::sqrt(1.f + M22 - M00 - M11) * 2.f;
		R = Q((M02 + M20) / S, (M12 + M21) / S, 0.25f * S, (M10 - M01) / S);
	}
	return Normalize(R);
}
/** Frame with Z along Dir and X as close to Pole as possible. */
inline Q AimBasis(V3 Dir, V3 Pole)
{
	const V3 Z = Norm(Dir);
	V3 Y = Cross(Z, Pole);
	if (Dot(Y, Y) < 1.0e-8f) Y = Cross(Z, std::fabs(Z.x) < 0.9f ? V3(1.f, 0.f, 0.f) : V3(0.f, 1.f, 0.f));
	Y = Norm(Y);
	const V3 X = Cross(Y, Z);
	return FromBasis(X, Y, Z);
}
/** Rotation carrying the rest bone (direction, pole) onto the posed bone (direction, pole). */
inline Q Align(V3 RestDir, V3 RestPole, V3 Dir, V3 Pole) { return AimBasis(Dir, Pole) * Conj(AimBasis(RestDir, RestPole)); }
/** The same, with the rest side worked out in advance (RestInverse = Conj(AimBasis(RestDir, RestPole))). */
inline Q AlignTo(const Q& RestInverse, V3 Dir, V3 Pole) { return AimBasis(Dir, Pole) * RestInverse; }
}
