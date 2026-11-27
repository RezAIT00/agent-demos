// Skeleton and pose solver.  Given where the two feet are this instant (from the footstep plan) and a
// handful of upper-body states, builds every bone of one walker.  Pure functions, no state.
#pragma once

#include "WalkerMath.h"

namespace nycw
{
enum EBone
{
	B_PELVIS, B_SPINE, B_CHEST, B_NECK, B_HEAD,
	B_UARM_L, B_FARM_L, B_HAND_L,
	B_UARM_R, B_FARM_R, B_HAND_R,
	B_THIGH_L, B_SHIN_L, B_FOOT_L, B_TOE_L,
	B_THIGH_R, B_SHIN_R, B_FOOT_R, B_TOE_R,
	B_FLAP_FL, B_FLAP_FR, B_FLAP_BL, B_FLAP_BR,
	B_PROP_R, B_PROP_L,
	B_COUNT
};

/** Rest pose of one body: joint positions in cm, feet flat on z = 0, facing +X, left at -Y.
 *  Every bone's rest orientation is the identity. */
struct Skeleton
{
	V3 J[B_COUNT];
	V3 GripL, GripR;         // palm centres
	float Height = 176.f;
	// foot landmarks relative to the ground point under the ankle
	float AnkleH = 8.5f;     // ankle joint height
	float HeelX = -5.5f;     // heel strike contact point
	float BallX = 13.0f;     // forefoot rocker pivot (and the toe joint)
	float TipX = 20.5f;      // toe tip
	float HipWidth = 9.5f;
	/** half width of the clothed body at the hips, so hanging arms stay outside coats */
	float HipClear = 19.f;

	// worked out once from the joints: call Prepare() after filling J
	Q RestInv[B_COUNT];       // limb bone i toward joint i + 1, bend toward the front
	Q RestInvBack[B_COUNT];   // the same with the bend toward the back, as the arm reach solver wants
	float Segment[B_COUNT] = {};
	void Prepare()
	{
		for (int i = 0; i + 1 < B_COUNT; ++i)
		{
			const V3 Rest = J[i + 1] - J[i];
			Segment[i] = Len(Rest);
			if (Segment[i] < 0.01f) continue;
			RestInv[i] = Conj(AimBasis(Rest, V3(1.f, 0.f, 0.f)));
			RestInvBack[i] = Conj(AimBasis(Rest, V3(-1.f, 0.f, 0.f)));
		}
	}
};

/** Per-walker gait constants. */
struct Style
{
	float Speed = 135.f;        // cruise cm/s
	float StepLen = 70.f;       // cm between successive footprints
	float StepWidth = 11.f;     // cm between left and right footprint centre lines
	float ToeOut = 0.10f;
	float ArmFwd = 0.34f, ArmBack = 0.24f, ArmBias = 0.03f;
	float ElbowBase = 0.30f, ElbowSwing = 0.36f;
	float ArmOut = 0.11f;       // abduction
	float ArmLag = 0.03f;       // phase lag of the arms behind the legs
	float Lean = 0.055f;        // forward trunk lean, rad
	float HeadPitch = -0.04f;   // negative looks down
	float Bob = 2.15f;          // vertical oscillation amplitude, cm
	float Sway = 2.0f;          // lateral pelvis sway amplitude, cm
	float PelvisYaw = 0.085f, PelvisList = 0.065f, ChestYaw = 0.075f;
	float Hunch = 0.f;          // raised shoulders (cold)
	float HipSwing = 1.f;       // scales pelvis list for individual character
	float Scale = 1.f;          // uniform size of this walker relative to its body mesh
	uint32_t Seed = 1;
};

struct FootSample
{
	V3 Ankle;                // world (or local after conversion)
	float Yaw = 0.f;
	float Pitch = 0.f;       // positive = toes up
	float ToePitch = 0.f;    // world pitch of the toe segment
	float SupportZ = 0.f;    // ground height this foot is carrying the body at
	bool Planted = true;
};

struct PoseInput
{
	V3 RootPos;              // world position of the walker's root (on the ground)
	float RootYaw = 0.f;
	FootSample Foot[2];      // 0 left, 1 right, world space
	V2 PelvisXY;             // world ground position under the pelvis, including sway
	float SupportZ = 0.f;    // world ground height the body rides on
	float Phase = 0.f;       // stride phase: 0 = left heel strike, 0.5 = right heel strike
	float Walk = 0.f;        // 0 standing .. 1 full gait
	float StepAmp = 1.f;     // current step length relative to this walker's nominal
	float WeightShift = 0.f; // standing: -1 weight on left leg .. +1 on right
	float Breathe = 0.f;     // -1..1
	float Time = 0.f;
	float HeadYaw = 0.f;     // look direction relative to the body
	float HeadPitch = 0.f;
	float Turn = 0.f;        // path curvature lean-in, rad
	// upper body overlays, 0..1
	float Umbrella = 0.f;    // right arm raised with an umbrella
	float PocketL = 0.f, PocketR = 0.f;
	float Phone = 0.f;       // right hand holds a phone in front of the chest
	float Coffee = 0.f;      // right hand carries a cup
	float Sip = 0.f;         // lifting the cup to drink
	float CarryL = 0.f, CarryR = 0.f;  // a weight hangs from this hand
	float Talk = 0.f;        // conversational gesture
	float TalkSide = 1.f;    // -1 partner on the left, +1 on the right
	V2 Wind;                 // world wind direction times strength 0..1
};

struct BoneXf
{
	Q R;
	V3 P;     // joint position, root-local
};

struct Pose
{
	BoneXf B[B_COUNT];
	// diagnostics (used by the gait test harness)
	float KneeFlexL = 0.f, KneeFlexR = 0.f, HipFlexL = 0.f, HipFlexR = 0.f;
	float PelvisZ = 0.f, ReachDrop = 0.f;
};

namespace detail
{
/** Two bone IK: returns the middle joint.  Pole says which way the joint bends. */
inline V3 SolveTwoBone(V3 Root, V3 Target, float A, float Bl, V3 Pole, V3* OutEnd = nullptr)
{
	V3 D = Target - Root;
	float Dist = Len(D);
	const V3 U = Dist > 1.0e-4f ? D * (1.f / Dist) : V3(0.f, 0.f, -1.f);
	Dist = Clampf(Dist, std::fabs(A - Bl) + 0.5f, A + Bl - 0.01f);
	const float CosA = Clampf((A * A + Dist * Dist - Bl * Bl) / (2.f * A * Dist), -1.f, 1.f);
	const float SinA = std::sqrt(1.f - CosA * CosA);
	V3 Perp = Pole - U * Dot(Pole, U);
	if (Dot(Perp, Perp) < 1.0e-6f) Perp = Cross(U, V3(0.f, 1.f, 0.f));
	Perp = Norm(Perp);
	if (OutEnd) *OutEnd = Root + U * Dist;
	return Root + U * (A * CosA) + Perp * (A * SinA);
}

struct ArmResult
{
	Q Upper, Fore, Hand;
};

/** Arm reaching for a wrist target; hand direction follows the forearm, rolled about it by Twist. */
inline ArmResult ReachArm(const Skeleton& S, int UpperBone, V3 Shoulder, V3 Wrist, V3 ElbowPole, float Twist, float WristBend)
{
	V3 End;
	const V3 Elbow = SolveTwoBone(Shoulder, Wrist, S.Segment[UpperBone], S.Segment[UpperBone + 1], ElbowPole, &End);
	ArmResult R;
	// in the rest pose the elbow points backwards
	R.Upper = AlignTo(S.RestInvBack[UpperBone], Elbow - Shoulder, ElbowPole);
	// the forearm keeps the elbow crease facing the way the elbow bends
	const V3 ForeDir = Norm(End - Elbow);
	V3 ForePole = ElbowPole - ForeDir * Dot(ElbowPole, ForeDir);
	R.Fore = AlignTo(S.RestInvBack[UpperBone + 1], ForeDir, ForePole);
	R.Fore = AxisAngle(ForeDir, Twist * 0.5f) * R.Fore;
	R.Hand = AxisAngle(ForeDir, Twist * 0.5f) * R.Fore;
	if (WristBend != 0.f)
	{
		const V3 Axis = Rot(R.Hand, V3(0.f, 1.f, 0.f));
		R.Hand = AxisAngle(Axis, WristBend) * R.Hand;
	}
	return R;
}
}

/** World ankle position for a flat or rolling foot whose flat-foot ground point is Origin. */
inline V3 AnkleForPitch(const Skeleton& S, V3 Origin, float Yaw, float Pitch, float Scale = 1.f)
{
	// roll about the heel when the toes are up, about the ball of the foot when the heel is up
	const float Pivot = Pitch >= 0.f ? S.HeelX : S.BallX;
	const V3 Rel(-Pivot, 0.f, S.AnkleH);
	const V3 Turned = Rot(PitchQ(Pitch), Rel);
	return Origin + Rot(YawQ(Yaw), V3(Pivot + Turned.x, 0.f, Turned.z) * Scale);
}

inline void SolvePose(const Skeleton& S, const Style& St, const PoseInput& In, Pose& Out)
{
	const Q ToLocal = YawQ(-In.RootYaw);
	// the instance is drawn scaled, so world targets shrink by the same factor on the way in
	const float InvScale = 1.f / St.Scale;
	auto Local = [&](V3 W) { return Rot(ToLocal, W - In.RootPos) * InvScale; };

	const float Walk = Sat(In.Walk);
	const float Idle = 1.f - Walk;
	const float Phi = In.Phase;
	const float C1 = std::cos(kTwoPi * Phi);
	const float C2 = std::cos(2.f * kTwoPi * (Phi - 0.045f));
	const float ListWave = std::sin(kTwoPi * (Phi + 0.1f));
	const float Amp = Clampf(In.StepAmp, 0.35f, 1.2f);
	const float Scale = S.Height / 176.f;

	// ---------------------------------------------------------------- pelvis orientation
	const float PelvisYawA = Walk * St.PelvisYaw * Amp * C1 + In.Turn * 0.35f;
	const float Loaded = In.WeightShift * Idle;
	// the hip on the swinging side drops; standing, the unloaded hip drops
	const float PelvisRoll = -Walk * St.PelvisList * St.HipSwing * Amp * ListWave + 0.055f * Loaded;
	const float PelvisPitch = -0.055f - Walk * (0.018f * std::cos(2.f * kTwoPi * Phi)) - St.Lean * 0.3f * Walk;
	const Q QPelvis = YawQ(PelvisYawA) * PitchQ(PelvisPitch) * RollQ(PelvisRoll);

	// ---------------------------------------------------------------- pelvis position
	const V3 PelvisGround = Local(V3(In.PelvisXY.x, In.PelvisXY.y, In.SupportZ));
	float Px = PelvisGround.x;
	float Py = PelvisGround.y + 4.2f * Loaded;
	const float StandDrop = 0.05f * Scale + 0.7f * std::fabs(Loaded);
	const float WalkDrop = (1.05f + 0.85f * Amp * Amp) * Scale;
	const float Bob = -Walk * St.Bob * Scale * Amp * C2;
	float Pz = PelvisGround.z + S.J[B_PELVIS].z - Lerpf(StandDrop, WalkDrop, Walk) + Bob + 0.12f * In.Breathe * Idle;

	// feet in local space
	V3 Ankle[2];
	float FootYaw[2];
	for (int i = 0; i < 2; ++i)
	{
		Ankle[i] = Local(In.Foot[i].Ankle);
		FootYaw[i] = WrapAngle(In.Foot[i].Yaw - In.RootYaw);
	}
	// never ask a leg to be longer than it is: lower the pelvis smoothly instead
	const float Wanted = Pz;
	for (int i = 0; i < 2; ++i)
	{
		const int Th = i == 0 ? B_THIGH_L : B_THIGH_R;
		const float Reach = (S.Segment[Th] + S.Segment[Th + 1]) * 0.9990f;
		const V3 HipOff = Rot(QPelvis, S.J[Th] - S.J[B_PELVIS]);
		const float Dx = Px + HipOff.x - Ankle[i].x, Dy = Py + HipOff.y - Ankle[i].y;
		const float H2 = Reach * Reach - (Dx * Dx + Dy * Dy);
		const float MaxZ = Ankle[i].z + std::sqrt(std::max(H2, Reach * Reach * 0.3f)) - HipOff.z;
		Pz = SoftMin(Pz, MaxZ, Lerpf(0.35f, 1.3f, Walk));
	}
	const V3 Pelvis(Px, Py, Pz);
	Out.PelvisZ = Pz - PelvisGround.z;
	Out.ReachDrop = Wanted - Pz;
	Out.B[B_PELVIS] = { QPelvis, Pelvis };

	// ---------------------------------------------------------------- spine, neck and head
	const float ChestYawA = -Walk * St.ChestYaw * Amp * std::cos(kTwoPi * (Phi - 0.02f)) + In.Turn * 0.2f + 0.10f * In.Talk * In.TalkSide;
	const float Lean = St.Lean * Lerpf(0.55f, 1.f, Walk) + 0.012f * St.Hunch;
	const float ChestRoll = Walk * St.PelvisList * 0.22f * ListWave - 0.026f * Loaded;
	const Q QChest = YawQ(ChestYawA) * PitchQ(-Lean + 0.008f * In.Breathe) * RollQ(ChestRoll);
	const Q QSpine = Nlerp(QPelvis, QChest, 0.5f);
	const V3 Spine = Pelvis + Rot(QPelvis, S.J[B_SPINE] - S.J[B_PELVIS]);
	const V3 Chest = Spine + Rot(QSpine, S.J[B_CHEST] - S.J[B_SPINE]);
	const V3 Neck = Chest + Rot(QChest, S.J[B_NECK] - S.J[B_CHEST]);
	// the head stays level and steady while the trunk turns under it
	const float HeadPitch = St.HeadPitch + In.HeadPitch - 0.012f * Walk * C2;
	const Q QHead = YawQ(In.HeadYaw + ChestYawA * 0.12f + PelvisYawA * 0.05f) * PitchQ(HeadPitch) * RollQ(ChestRoll * 0.2f);
	const Q QNeck = Nlerp(QChest, QHead, 0.45f);
	const V3 Head = Neck + Rot(QNeck, S.J[B_HEAD] - S.J[B_NECK]);
	Out.B[B_SPINE] = { QSpine, Spine };
	Out.B[B_CHEST] = { QChest, Chest };
	Out.B[B_NECK] = { QNeck, Neck };
	Out.B[B_HEAD] = { QHead, Head };

	// ---------------------------------------------------------------- legs
	for (int i = 0; i < 2; ++i)
	{
		const int Th = i == 0 ? B_THIGH_L : B_THIGH_R;
		const int FlapF = i == 0 ? B_FLAP_FL : B_FLAP_FR;
		const int FlapB = i == 0 ? B_FLAP_BL : B_FLAP_BR;
		const V3 Hip = Pelvis + Rot(QPelvis, S.J[Th] - S.J[B_PELVIS]);
		const float A = S.Segment[Th];
		const float Bl = S.Segment[Th + 1];
		// knees point where the toes point, softened toward where the hips face
		const float PoleYaw = FootYaw[i] * 0.65f + PelvisYawA * 0.35f;
		const V3 Pole(std::cos(PoleYaw), std::sin(PoleYaw), 0.f);
		V3 End;
		const V3 Knee = detail::SolveTwoBone(Hip, Ankle[i], A, Bl, Pole, &End);
		const Q QThigh = AlignTo(S.RestInv[Th], Knee - Hip, Pole);
		const Q QShin = AlignTo(S.RestInv[Th + 1], End - Knee, Pole);
		const Q QFoot = YawQ(FootYaw[i]) * PitchQ(In.Foot[i].Pitch);
		const Q QToe = YawQ(FootYaw[i]) * PitchQ(In.Foot[i].ToePitch);
		Out.B[Th] = { QThigh, Hip };
		Out.B[Th + 1] = { QShin, Knee };
		Out.B[Th + 2] = { QFoot, End };
		Out.B[Th + 3] = { QToe, End + Rot(QFoot, S.J[Th + 3] - S.J[Th + 2]) };

		const float CosK = Clampf(Dot(Norm(Knee - Hip), Norm(End - Knee)), -1.f, 1.f);
		const V3 InPelvis = Rot(Conj(QPelvis), Knee - Hip);
		const float HipFlex = std::atan2(InPelvis.x, -InPelvis.z);
		(i == 0 ? Out.KneeFlexL : Out.KneeFlexR) = std::acos(CosK);
		(i == 0 ? Out.HipFlexL : Out.HipFlexR) = HipFlex;

		// coat skirts are pushed forward by the leading thigh and dragged back by the trailing one;
		// the shin matters too, when a bent knee swings the calf back under a long coat
		const V3 ShinRel = Rot(Conj(QPelvis), End - Hip);
		const float LegLine = std::atan2(ShinRel.x, -ShinRel.z);
		const float Fwd = SoftPos(std::max(HipFlex, LegLine) - 0.035f, 0.07f);
		const float Back = -SoftPos(-(std::min(HipFlex, LegLine)) - 0.035f, 0.07f);
		const float Spread = (i == 0 ? -1.f : 1.f) * 0.02f * Walk;
		// the leading thigh also pushes the cloth bodily forward, or it would show through the front of the skirt
		Out.B[FlapF] = { QPelvis * PitchQ(Fwd) * RollQ(Spread), Pelvis + Rot(QPelvis, S.J[FlapF] - S.J[B_PELVIS] + V3(6.5f * Fwd, 0.f, 0.f)) };
		Out.B[FlapB] = { QPelvis * PitchQ(Back * 0.80f) * RollQ(Spread), Pelvis + Rot(QPelvis, S.J[FlapB] - S.J[B_PELVIS]) };
	}

	// ---------------------------------------------------------------- arms
	V3 Grip[2];
	Q HandQ[2];
	for (int i = 0; i < 2; ++i)
	{
		const float Side = i == 0 ? -1.f : 1.f;
		const int Up = i == 0 ? B_UARM_L : B_UARM_R;
		const float Carry = i == 0 ? In.CarryL : In.CarryR;
		const V3 ShoulderOff = S.J[Up] - S.J[B_CHEST] + V3(0.6f * St.Hunch, -Side * 0.4f * St.Hunch, 1.6f * St.Hunch + 0.2f * In.Breathe);
		const V3 Shoulder = Chest + Rot(QChest, ShoulderOff);
		// each arm swings with the opposite leg
		const float Cycle = Phi - (i == 0 ? 0.5f : 0.f) - St.ArmLag;
		const float Swing = std::cos(kTwoPi * Cycle);
		const float Late = Sat(0.5f + 0.5f * std::cos(kTwoPi * (Cycle - 0.06f)));
		const float SwingScale = Walk * Amp * (1.f - 0.72f * Carry);
		// small personal asymmetry, as real arms never match
		const float Mine = 1.f + 0.22f * (Hash01(St.Seed, 71u + i) - 0.5f);
		float Flex = St.ArmBias + SwingScale * Mine * (Swing > 0.f ? St.ArmFwd : St.ArmBack) * Swing;
		float Elbow = St.ElbowBase * (1.f - 0.6f * Carry) + SwingScale * Mine * St.ElbowSwing * Late * Late;
		Flex += 0.012f * std::sin(In.Time * 0.9f + Hash01(St.Seed, 5u + i) * 6.f) * Idle;
		const float Abduct = Side * (St.ArmOut + 0.03f * Carry);

		// gesture while talking: the arm on the far side from the partner lifts now and then
		const float Gest = In.Talk * (Side * In.TalkSide < 0.f ? 1.f : 0.15f);
		Flex = Lerpf(Flex, 0.30f + 0.10f * std::sin(In.Time * 5.3f), Gest);
		Elbow = Lerpf(Elbow, 1.45f + 0.18f * std::sin(In.Time * 4.1f + 1.f), Gest);

		const V3 RestU = S.J[Up + 1] - S.J[Up];
		const V3 RestF = S.J[Up + 2] - S.J[Up + 1];
		const Q UpperLocal = PitchQ(Flex) * RollQ(Abduct);
		const V3 UpDir = Rot(QChest * UpperLocal, V3(0.f, 0.f, -1.f));
		const V3 UpFwd = Rot(QChest * PitchQ(Flex), V3(1.f, 0.f, 0.f));
		const Q ForeLocal = PitchQ(Flex + Elbow) * RollQ(Abduct * 0.45f - Side * 0.02f);
		const V3 FoDir = Rot(QChest * ForeLocal, V3(0.f, 0.f, -1.f));
		const V3 FoFwd = Rot(QChest * PitchQ(Flex + Elbow), V3(1.f, 0.f, 0.f));
		Q QUp = AlignTo(S.RestInv[Up], UpDir, UpFwd);
		Q QFore = AlignTo(S.RestInv[Up + 1], FoDir, FoFwd);
		Q QHand = QFore * RollQ(-Side * 0.04f);

		auto Blend = [&](const detail::ArmResult& R, float W)
		{
			QUp = Nlerp(QUp, R.Upper, W);
			QFore = Nlerp(QFore, R.Fore, W);
			QHand = Nlerp(QHand, R.Hand, W);
		};
		const float Pocket = i == 0 ? In.PocketL : In.PocketR;
		if (Pocket > 0.001f)
		{
			// wrists rest at the coat's side pockets and the hands disappear into them
			const V3 Target = Pelvis + Rot(QPelvis, V3(6.5f * Scale, Side * (S.HipClear - 4.2f), 2.0f * Scale));
			const V3 PoleDir = Rot(QChest, V3(-0.75f, Side * 0.66f, 0.f));
			Blend(detail::ReachArm(S, Up, Shoulder, Target, PoleDir, 0.f, 0.f), Pocket);
		}
		if (i == 1 && In.Phone > 0.001f)
		{
			const V3 Target = Chest + Rot(QChest, V3(25.f * Scale, 6.5f, 2.f * Scale));
			const V3 PoleDir = Rot(QChest, V3(-0.15f, 0.72f, -0.68f));
			Blend(detail::ReachArm(S, Up, Shoulder, Target, PoleDir, -0.9f, 0.25f), In.Phone);
		}
		if (i == 1 && In.Coffee > 0.001f)
		{
			const V3 Low = Chest + Rot(QChest, V3(22.f * Scale, 11.f, -9.f * Scale + 0.3f * Walk * C2));
			const V3 AtMouth = Head + Rot(QHead, V3(13.5f * Scale, 3.0f, -3.5f * Scale));
			const V3 PoleDir = Rot(QChest, V3(-0.1f, 0.66f, -0.74f));
			Blend(detail::ReachArm(S, Up, Shoulder, Lerp(Low, AtMouth, Smooth01(In.Sip)), PoleDir, -0.3f, 0.f), In.Coffee);
		}
		if (i == 1 && In.Umbrella > 0.001f)
		{
			// forearm up, fist in front of the chest and a little inside the shoulder
			// nobody holds one quite like anyone else
			const float Hold = Hash01(St.Seed, 80u), Reach = Hash01(St.Seed, 81u);
			const V3 Target = Chest + Rot(QChest, V3((19.f + 6.f * Reach) * Scale, 6.5f + 4.5f * Hash01(St.Seed, 82u),
				(-3.f + 10.f * Hold) * Scale + 0.4f * Walk * C2));
			const V3 PoleDir = Rot(QChest, V3(0.05f, 0.55f, -0.83f));
			Blend(detail::ReachArm(S, Up, Shoulder, Target, PoleDir, -0.25f, 0.f), In.Umbrella);
		}

		const V3 ElbowPos = Shoulder + Rot(QUp, RestU);
		const V3 WristPos = ElbowPos + Rot(QFore, RestF);
		Out.B[Up] = { QUp, Shoulder };
		Out.B[Up + 1] = { QFore, ElbowPos };
		Out.B[Up + 2] = { QHand, WristPos };
		const V3 GripRest = i == 0 ? S.GripL : S.GripR;
		Grip[i] = WristPos + Rot(QHand, GripRest - S.J[Up + 2]);
		HandQ[i] = QHand;
	}

	// ---------------------------------------------------------------- props held in the hands
	for (int i = 0; i < 2; ++i)
	{
		const int Bone = i == 1 ? B_PROP_R : B_PROP_L;
		const float Cycle = Phi - (i == 0 ? 0.5f : 0.f) - St.ArmLag - 0.09f;
		// anything hanging swings a beat behind the hand
		const float Pend = Walk * Amp * (0.13f * std::cos(kTwoPi * Cycle) + 0.02f);
		Q R = PitchQ(Pend) * RollQ((i == 0 ? -1.f : 1.f) * 0.03f);
		if (i == 1 && In.Coffee > In.Umbrella && In.Coffee > In.Phone)
		{
			// the cup stays level until it is tipped to drink
			R = Nlerp(R, QChest * PitchQ(0.75f * Smooth01(In.Sip)) * Conj(YawQ(0.f)), Sat(In.Coffee * 1.5f));
		}
		else if (i == 1 && (In.Umbrella > 0.001f || In.Phone > 0.001f))
		{
			if (In.Umbrella >= In.Phone)
			{
				// the shaft leans so the canopy centres over the head, then into the wind
				const V3 Over = Head + V3(1.f + 11.f * Hash01(St.Seed, 83u), 18.f * (Hash01(St.Seed, 84u) - 0.5f), 45.f * Scale);
				const V3 WindLocal = Rot(ToLocal, V3(In.Wind.x, In.Wind.y, 0.f));
				V3 Shaft = Norm(Over - Grip[i]);
				Shaft = Norm(Shaft + V3(-WindLocal.x * 0.2f + 0.05f * Walk, -WindLocal.y * 0.2f, 0.f)
					+ V3(0.012f * std::sin(In.Time * 2.3f + St.Seed % 7), 0.018f * Walk * C1, 0.f));
				const Q Up = Align(V3(0.f, 0.f, 1.f), V3(1.f, 0.f, 0.f), Shaft, V3(1.f, 0.f, 0.f));
				R = Nlerp(R, Up, Sat(In.Umbrella * 1.6f));
			}
			else
			{
				// phone screen tilted up toward the face
				const Q Facing = Align(V3(0.f, 0.f, 1.f), V3(1.f, 0.f, 0.f), Norm(Head + V3(0.f, 0.f, 12.f) - Grip[i]), V3(1.f, 0.f, 0.f));
				R = Nlerp(R, Facing, Sat(In.Phone * 1.5f));
			}
		}
		Out.B[Bone] = { R, Grip[i] };
	}
}

/** Packs a pose as skinning transforms: 8 floats per bone (quaternion, translation, spare). */
inline void ToSkinFloats(const Skeleton& S, const Pose& P, float* Out)
{
	for (int i = 0; i < B_COUNT; ++i)
	{
		const BoneXf& B = P.B[i];
		const V3 T = B.P - Rot(B.R, S.J[i]);
		float* F = Out + i * 8;
		F[0] = B.R.x; F[1] = B.R.y; F[2] = B.R.z; F[3] = B.R.w;
		F[4] = T.x; F[5] = T.y; F[6] = T.z; F[7] = 1.f;
	}
}

/** Re-expresses a pose captured under another root transform in the current one (for motion vectors). */
inline void Rebase(Pose& P, V3 FromPos, float FromYaw, V3 ToPos, float ToYaw, float Scale = 1.f)
{
	const Q Turn = YawQ(WrapAngle(FromYaw - ToYaw));
	const V3 Shift = Rot(YawQ(-ToYaw), FromPos - ToPos) * (1.f / Scale);
	for (int i = 0; i < B_COUNT; ++i)
	{
		P.B[i].R = Turn * P.B[i].R;
		P.B[i].P = Rot(Turn, P.B[i].P) + Shift;
	}
}
}
